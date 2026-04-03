"""
Card condition grader.

Production path  → EfficientNet-B4 fine-tuned on labelled card photos.
Prototype path   → Rule-based heuristic grader using OpenCV defect detection.

The module auto-selects the production model when the weights file exists at
  backend/api/ml/models/grader_efficientnet_b4.pt
and falls back to the heuristic grader otherwise, so the pipeline runs end-to-
end without trained weights during prototyping/development.

Condition labels (in severity order):
  MT  Mint
  NM  Near Mint
  LP  Lightly Played
  MP  Moderately Played
  HP  Heavily Played
  DMG Damaged
"""

from __future__ import annotations

import dataclasses
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

CONDITIONS = ["MT", "NM", "LP", "MP", "HP", "DMG"]
MODEL_PATH = Path(__file__).parent / "models" / "grader_efficientnet_b4.pt"


@dataclasses.dataclass
class GradingResult:
    suggested_condition: str                    # e.g. "NM"
    confidence: float                           # probability of top prediction
    confidence_breakdown: Dict[str, float]      # {condition: probability}
    issues_detected: List[str]                  # human-readable defects found
    method: str                                 # "efficientnet" | "heuristic"


def grade(normalised_bgr: np.ndarray) -> GradingResult:
    """
    Grade a normalised 224×312 BGR card image.

    Tries the EfficientNet model first; falls back to the heuristic grader.
    """
    if MODEL_PATH.exists():
        try:
            return _efficientnet_grade(normalised_bgr)
        except Exception as exc:  # noqa: BLE001
            logger.warning("EfficientNet grader failed (%s), using heuristic", exc)

    return _heuristic_grade(normalised_bgr)


# ── EfficientNet model grader ─────────────────────────────────────────────────

def _efficientnet_grade(normalised_bgr: np.ndarray) -> GradingResult:
    """Load EfficientNet-B4 weights and run inference."""
    import torch  # noqa: PLC0415
    import torchvision.transforms as T  # noqa: PLC0415

    model = _load_model()
    model.eval()

    rgb = cv2.cvtColor(normalised_bgr, cv2.COLOR_BGR2RGB)
    transform = T.Compose([
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    tensor = transform(rgb).unsqueeze(0)  # (1, 3, H, W)

    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1).squeeze().tolist()

    breakdown = {c: round(p, 4) for c, p in zip(CONDITIONS, probs)}
    top_idx = int(np.argmax(probs))
    return GradingResult(
        suggested_condition=CONDITIONS[top_idx],
        confidence=round(probs[top_idx], 4),
        confidence_breakdown=breakdown,
        issues_detected=[],
        method="efficientnet",
    )


_model_cache = None  # module-level singleton


def _load_model():
    global _model_cache  # noqa: PLW0603
    if _model_cache is not None:
        return _model_cache

    import torch  # noqa: PLC0415
    import torchvision.models as M  # noqa: PLC0415

    model = M.efficientnet_b4(weights=None)
    # Replace classifier head with 6-class output
    in_features = model.classifier[1].in_features
    model.classifier = torch.nn.Sequential(
        torch.nn.Dropout(p=0.3, inplace=True),
        torch.nn.Linear(in_features, 512),
        torch.nn.ReLU(),
        torch.nn.Dropout(p=0.2),
        torch.nn.Linear(512, len(CONDITIONS)),
    )
    state = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    _model_cache = model
    return model


# ── Heuristic (rule-based) grader ─────────────────────────────────────────────

def _heuristic_grade(normalised_bgr: np.ndarray) -> GradingResult:
    """
    Estimate card condition from measurable image features:

    1. Edge whitening score  — brightness of the card's outer border region
    2. Surface scratch score — standard deviation of Laplacian in centre region
    3. Corner damage score   — bright pixel density in corner patches
    4. Crease score          — high-frequency vertical/horizontal line energy
    """
    issues: List[str] = []
    defect_score = 0.0

    edge_score = _measure_edge_whitening(normalised_bgr)
    scratch_score = _measure_surface_scratches(normalised_bgr)
    corner_score = _measure_corner_damage(normalised_bgr)
    crease_score = _measure_creases(normalised_bgr)

    # Accumulate weighted defect score [0, 1]
    if edge_score > 0.25:
        issues.append("edge_whitening")
        defect_score += edge_score * 0.35
    if scratch_score > 0.30:
        issues.append("surface_scratches")
        defect_score += scratch_score * 0.25
    if corner_score > 0.25:
        issues.append("corner_wear")
        defect_score += corner_score * 0.25
    if crease_score > 0.40:
        issues.append("creases")
        defect_score += crease_score * 0.15

    defect_score = min(defect_score, 1.0)

    # Map defect score to condition
    thresholds = [
        (0.05, 0, "MT"),
        (0.15, 1, "NM"),
        (0.35, 2, "LP"),
        (0.55, 3, "MP"),
        (0.75, 4, "HP"),
        (1.01, 5, "DMG"),
    ]
    condition_idx = 5
    for upper, idx, _ in thresholds:
        if defect_score < upper:
            condition_idx = idx
            break

    # Build a simple confidence breakdown centred on the predicted condition
    probs = _defect_to_probs(defect_score, condition_idx)
    breakdown = {c: round(p, 4) for c, p in zip(CONDITIONS, probs)}

    return GradingResult(
        suggested_condition=CONDITIONS[condition_idx],
        confidence=round(probs[condition_idx], 4),
        confidence_breakdown=breakdown,
        issues_detected=issues,
        method="heuristic",
    )


def _measure_edge_whitening(img: np.ndarray) -> float:
    """
    Detect edge wear via two complementary signals:

    1. Border-strip spatial variance: worn edges have irregular scuffs
       (high std); clean borders—even white ones by design—are smooth (low std).
    2. Relative brightness: border strip vs. the inner-frame strip behind it.
       Worn borders lighten toward the white card core while the frame behind
       stays darker.  A white-bordered NM card has bright border AND bright
       inner frame, so the differential stays near zero—no false positive.

    Returns max(variance_score, 0.7 × brightness_score) in [0, 1].
    """
    h, w = img.shape[:2]
    bw       = max(2, int(h * 0.04))
    inner_bw = min(bw * 3, int(h * 0.10))

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)

    border_strips = np.concatenate([
        gray[:bw,    bw:-bw].flatten(),
        gray[-bw:,   bw:-bw].flatten(),
        gray[bw:-bw, :bw   ].flatten(),
        gray[bw:-bw, -bw:  ].flatten(),
    ])
    inner_strips = np.concatenate([
        gray[bw:inner_bw,       bw:-bw].flatten(),
        gray[-inner_bw:-bw,     bw:-bw].flatten(),
        gray[bw:-bw, bw:inner_bw      ].flatten(),
        gray[bw:-bw, -inner_bw:-bw    ].flatten(),
    ])

    variance_score = min(float(border_strips.std()) / 45.0, 1.0)
    relative_brightness = max(0.0, float(border_strips.mean()) - float(inner_strips.mean())) / 255.0
    brightness_score = min(relative_brightness * 5.0, 1.0)

    return float(max(variance_score, brightness_score * 0.7))


def _measure_surface_scratches(img: np.ndarray) -> float:
    """High texture variance in the centre region → scratches/scuffs."""
    h, w = img.shape[:2]
    centre = img[h // 4: 3 * h // 4, w // 4: 3 * w // 4]
    gray = cv2.cvtColor(centre, cv2.COLOR_BGR2GRAY).astype(np.float32)
    lap = cv2.Laplacian(gray, cv2.CV_32F)
    std = float(lap.std())
    # Normalise empirically: clean card ~10–30, very scratched ~80+
    return min(std / 80.0, 1.0)


def _measure_corner_damage(img: np.ndarray) -> float:
    """
    Detect corner wear via the brightness differential between corner patches
    and the mid-border strip (border strip with corners excluded).

    Worn corners whiten beyond the rest of the border.
    White-bordered NM cards have bright mid-border AND bright corners, so
    the differential stays near zero—no false positive.

    A 15-point buffer is applied before normalising to absorb minor natural
    variation.  Returns a score in [0, 1].
    """
    h, w = img.shape[:2]
    ph = max(4, int(h * 0.07))
    pw = max(4, int(w * 0.07))
    bw = max(2, int(h * 0.03))

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(float)

    corner_means = [
        gray[:ph,  :pw ].mean(),
        gray[:ph,  -pw:].mean(),
        gray[-ph:, :pw ].mean(),
        gray[-ph:, -pw:].mean(),
    ]
    corner_mean = float(np.mean(corner_means))

    mid_strips = np.concatenate([
        gray[:bw,    pw:-pw].flatten(),
        gray[-bw:,   pw:-pw].flatten(),
        gray[ph:-ph, :bw   ].flatten(),
        gray[ph:-ph, -bw:  ].flatten(),
    ])
    mid_mean = float(mid_strips.mean())

    relative = max(0.0, corner_mean - mid_mean - 15.0) / 100.0
    return min(relative, 1.0)


def _measure_creases(img: np.ndarray) -> float:
    """
    Detect card creases via Hough line transform on the card interior.

    Improvements over v1:
    1. Analyse only the interior (crop border) so the sharp border–art
       boundary (which is a full-width horizontal line) is not mis-detected
       as a crease.  In v1 this caused crease_score ≈ 0.55 on clean MT/NM
       cards because the card border edge is ~224 px long and was picked up
       by the low minLineLength=30.
    2. Require lines to span at least 70 % of the interior width — true
       creases run nearly edge-to-edge; art-texture lines do not.
    3. Higher Canny/Hough thresholds (80/200 vs 50/150) to reduce noise.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    bw = max(3, int(h * 0.06))          # strip border before analysis
    interior = gray[bw:h - bw, bw:w - bw]
    ih, iw = interior.shape

    edges = cv2.Canny(interior, 80, 200)
    min_length = int(iw * 0.70)         # must span 70 % of interior width
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=60,
                            minLineLength=min_length, maxLineGap=8)
    if lines is None:
        return 0.0
    significant = 0
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
        if angle < 10 or angle > 170 or (80 < angle < 100):
            significant += 1
    # Normalise: 1 crease → 0.5, 2+ → 1.0
    return min(significant / 2.0, 1.0)


def _defect_to_probs(defect_score: float, peak_idx: int) -> List[float]:
    """
    Generate a soft probability distribution centred on peak_idx.
    Adjacent conditions get smoothed probability mass.
    """
    raw = np.zeros(len(CONDITIONS))
    raw[peak_idx] = 1.0
    sigma = 0.8
    for i in range(len(CONDITIONS)):
        raw[i] = np.exp(-0.5 * ((i - peak_idx) / sigma) ** 2)
    raw /= raw.sum()
    return raw.tolist()
