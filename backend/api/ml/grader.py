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
    """Brightness of the card border strip (top 3 %, bottom 3 %, left 3 %, right 3 %)."""
    h, w = img.shape[:2]
    bw = max(1, int(h * 0.03))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(float)
    border = np.concatenate([
        gray[:bw, :].flatten(),
        gray[-bw:, :].flatten(),
        gray[:, :bw].flatten(),
        gray[:, -bw:].flatten(),
    ])
    # Normalise: 0 = dark border, 1 = completely white
    return float(border.mean()) / 255.0


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
    """Bright pixels (whitening) in the four 5 % corner patches."""
    h, w = img.shape[:2]
    ph, pw = max(1, int(h * 0.05)), max(1, int(w * 0.05))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(float)
    patches = [
        gray[:ph, :pw],
        gray[:ph, -pw:],
        gray[-ph:, :pw],
        gray[-ph:, -pw:],
    ]
    means = [p.mean() for p in patches]
    return float(np.mean(means)) / 255.0


def _measure_creases(img: np.ndarray) -> float:
    """Detect strong horizontal/vertical lines (creases) via Hough transform."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=40,
                            minLineLength=30, maxLineGap=5)
    if lines is None:
        return 0.0
    h, w = img.shape[:2]
    # Count near-horizontal / near-vertical lines
    significant = 0
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
        if angle < 10 or angle > 170 or (80 < angle < 100):
            significant += 1
    # Normalise: 0 = no creases, 1 = many strong lines
    return min(significant / 20.0, 1.0)


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
