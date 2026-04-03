"""
Original (v1) heuristic grader — kept as benchmark baseline.

DO NOT modify this file.  It contains the original feature extractors
from the first implementation so benchmark.py can compare v1 vs v2.
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
        method="heuristic_v1",
    )


def _measure_edge_whitening(img: np.ndarray) -> float:
    """v1: absolute border brightness / 255."""
    h, w = img.shape[:2]
    bw = max(1, int(h * 0.03))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(float)
    border = np.concatenate([
        gray[:bw, :].flatten(),
        gray[-bw:, :].flatten(),
        gray[:, :bw].flatten(),
        gray[:, -bw:].flatten(),
    ])
    return float(border.mean()) / 255.0


def _measure_surface_scratches(img: np.ndarray) -> float:
    h, w = img.shape[:2]
    centre = img[h // 4: 3 * h // 4, w // 4: 3 * w // 4]
    gray = cv2.cvtColor(centre, cv2.COLOR_BGR2GRAY).astype(np.float32)
    lap = cv2.Laplacian(gray, cv2.CV_32F)
    std = float(lap.std())
    return min(std / 80.0, 1.0)


def _measure_corner_damage(img: np.ndarray) -> float:
    """v1: absolute corner brightness / 255."""
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
    """v1: Hough lines with low thresholds — prone to false positives from card art."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=40,
                            minLineLength=30, maxLineGap=5)
    if lines is None:
        return 0.0
    h, w = img.shape[:2]
    significant = 0
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
        if angle < 10 or angle > 170 or (80 < angle < 100):
            significant += 1
    return min(significant / 20.0, 1.0)


def _defect_to_probs(defect_score: float, peak_idx: int) -> List[float]:
    raw = np.zeros(len(CONDITIONS))
    sigma = 0.8
    for i in range(len(CONDITIONS)):
        raw[i] = np.exp(-0.5 * ((i - peak_idx) / sigma) ** 2)
    raw /= raw.sum()
    return raw.tolist()
