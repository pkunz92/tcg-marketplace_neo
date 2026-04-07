"""
Improved heuristic card condition grader (v2).

Key improvements over the baseline grader
──────────────────────────────────────────
1. Edge-whitening detection  — replaced absolute-brightness measure with a
   combination of (a) border-strip spatial variance and (b) brightness of the
   border relative to the card's inner frame.  This correctly handles
   white-bordered cards by design: a clean white border has *low* variance and
   scores near zero; a worn border has *high* variance (irregular scuffs) and
   is brighter than the frame layer behind it.

2. Corner-damage detection   — replaced absolute-brightness measure with a
   *relative* measure: how much brighter corner patches are compared to the
   mid-border strip (excluding corners).  A white-bordered NM card will have
   bright mid-border *and* bright corners, so the differential stays near zero.
   A worn card's corners whiten well beyond the already-worn mid-border.

These two changes address the biggest accuracy gap identified in benchmarking:
NM cards with naturally bright borders were being misclassified as LP or MP
(false-positive edge/corner flags), reducing NM recall to ~0.3 in the baseline.

The surface-scratch and crease detection functions are unchanged.

This module exposes the same `_heuristic_grade` name so benchmark.py can
import it via `from api.ml.grader_improved import _heuristic_grade`.
The production `grader.py` is updated to call these improved functions.
"""

from __future__ import annotations

import dataclasses
import logging
from typing import Dict, List

import cv2
import numpy as np

logger = logging.getLogger(__name__)

CONDITIONS = ["MT", "NM", "LP", "MP", "HP", "DMG"]


@dataclasses.dataclass
class GradingResult:
    suggested_condition: str
    confidence: float
    confidence_breakdown: Dict[str, float]
    issues_detected: List[str]
    method: str


def _heuristic_grade(normalised_bgr: np.ndarray) -> GradingResult:
    """Improved heuristic grader — see module docstring for details."""
    issues: List[str] = []
    defect_score = 0.0

    edge_score   = _measure_edge_whitening(normalised_bgr)
    scratch_score = _measure_surface_scratches(normalised_bgr)
    corner_score = _measure_corner_damage(normalised_bgr)
    crease_score = _measure_creases(normalised_bgr)

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

    probs = _defect_to_probs(defect_score, condition_idx)
    breakdown = {c: round(p, 4) for c, p in zip(CONDITIONS, probs)}

    return GradingResult(
        suggested_condition=CONDITIONS[condition_idx],
        confidence=round(probs[condition_idx], 4),
        confidence_breakdown=breakdown,
        issues_detected=issues,
        method="heuristic_v2",
    )


# ── Improved feature extractors ────────────────────────────────────────────────

def _measure_edge_whitening(img: np.ndarray) -> float:
    """
    Detect edge wear via two complementary signals:

    1. Border-strip spatial variance (std of pixel brightness):
       Worn edges show irregular scuffs → high variance.
       Clean borders (even white ones by design) are smooth → low variance.
       Normalised against empirical maximum (~45 std for severe wear).

    2. Relative brightness: border strip brightness vs. the card's
       inner-frame strip immediately behind the border.
       Worn borders lighten toward the white card core; the frame behind
       them stays closer to the card's base colour.
       A white-bordered card has bright border AND bright inner frame,
       so the differential stays near zero.

    Returns max(variance_score, 0.7 × brightness_score) in [0, 1].
    """
    h, w = img.shape[:2]
    bw       = max(2, int(h * 0.04))
    inner_bw = min(bw * 3, int(h * 0.10))

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)

    # Outer border strip (exclude corners to keep signals independent)
    border_strips = np.concatenate([
        gray[:bw,    bw:-bw].flatten(),
        gray[-bw:,   bw:-bw].flatten(),
        gray[bw:-bw, :bw   ].flatten(),
        gray[bw:-bw, -bw:  ].flatten(),
    ])

    # Inner-frame strip immediately behind the border
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


def _measure_corner_damage(img: np.ndarray) -> float:
    """
    Detect corner wear via the brightness differential between corner patches
    and the mid-border strip (the border strip excluding corner regions).

    Worn corners whiten significantly beyond the rest of the border.
    A card whose border is white by design will have bright mid-border *and*
    bright corners, keeping the differential near zero — no false positive.

    A 15-point brightness buffer is applied before normalising so minor
    natural corner/mid variation does not trigger false flags.
    Returns a score in [0, 1].
    """
    h, w = img.shape[:2]
    ph = max(4, int(h * 0.07))
    pw = max(4, int(w * 0.07))
    bw = max(2, int(h * 0.03))

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(float)

    corner_means = [
        gray[:ph,   :pw  ].mean(),
        gray[:ph,   -pw: ].mean(),
        gray[-ph:,  :pw  ].mean(),
        gray[-ph:,  -pw: ].mean(),
    ]
    corner_mean = float(np.mean(corner_means))

    # Mid-border: border-width strips with corner regions excluded
    mid_strips = np.concatenate([
        gray[:bw,      pw:-pw].flatten(),
        gray[-bw:,     pw:-pw].flatten(),
        gray[ph:-ph,   :bw   ].flatten(),
        gray[ph:-ph,   -bw:  ].flatten(),
    ])
    mid_mean = float(mid_strips.mean())

    # Differential wear score: corners must be >15 pts brighter than mid-border
    relative = max(0.0, corner_mean - mid_mean - 15.0) / 100.0
    return min(relative, 1.0)


# ── Unchanged feature extractors (from baseline grader) ───────────────────────

def _measure_surface_scratches(img: np.ndarray) -> float:
    """High texture variance in the centre region → scratches/scuffs."""
    h, w = img.shape[:2]
    centre = img[h // 4: 3 * h // 4, w // 4: 3 * w // 4]
    gray = cv2.cvtColor(centre, cv2.COLOR_BGR2GRAY).astype(np.float32)
    lap = cv2.Laplacian(gray, cv2.CV_32F)
    std = float(lap.std())
    return min(std / 80.0, 1.0)


def _measure_creases(img: np.ndarray) -> float:
    """
    Detect card creases via Hough line transform.

    Requires each line to span at least 60 % of the shorter card dimension
    (true creases go near edge-to-edge) and uses higher Canny/Hough thresholds
    to eliminate false positives from short art-texture edges.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 80, 200)
    h, w = img.shape[:2]
    min_length = int(min(h, w) * 0.60)
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
    return min(significant / 5.0, 1.0)


def _defect_to_probs(defect_score: float, peak_idx: int) -> List[float]:
    raw = np.zeros(len(CONDITIONS))
    sigma = 0.8
    for i in range(len(CONDITIONS)):
        raw[i] = np.exp(-0.5 * ((i - peak_idx) / sigma) ** 2)
    raw /= raw.sum()
    return raw.tolist()
