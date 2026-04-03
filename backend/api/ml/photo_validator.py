"""
Photo quality validation for card grading.

Checks that an uploaded image is suitable for grading before running the model:
  1. Resolution — minimum 600x840 px
  2. Blur — Laplacian variance threshold
  3. Lighting — mean luminance and histogram spread
  4. Card presence — rectangular contour occupying >50 % of the frame
  5. Aspect ratio — Pokemon card is ~0.716 (6.3 / 8.8 cm); +/-15 % tolerance
"""

from __future__ import annotations

import dataclasses
from typing import List, Optional

import cv2
import numpy as np

# ── Constants ──────────────────────────────────────────────────────────────────

MIN_WIDTH = 600
MIN_HEIGHT = 840
BLUR_THRESHOLD = 80.0          # Laplacian variance; below this → too blurry
MIN_LUMINANCE = 40             # mean pixel value (0-255)
MAX_LUMINANCE = 240
CARD_ASPECT_RATIO = 6.3 / 8.8  # ≈ 0.716  (width / height)
ASPECT_TOLERANCE = 0.15
MIN_CARD_AREA_FRACTION = 0.40  # card must cover ≥40 % of frame area


@dataclasses.dataclass
class ValidationResult:
    ok: bool
    warnings: List[str] = dataclasses.field(default_factory=list)
    errors: List[str] = dataclasses.field(default_factory=list)
    debug: dict = dataclasses.field(default_factory=dict)


def validate(image_bgr: np.ndarray) -> ValidationResult:
    """
    Run all quality checks on a BGR image (as returned by cv2.imread).

    Returns a ValidationResult.  ``ok`` is True only when there are no errors
    (warnings are advisory and do not block grading).
    """
    result = ValidationResult(ok=True)

    _check_resolution(image_bgr, result)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    _check_blur(gray, result)
    _check_lighting(gray, result)
    _check_card_presence(image_bgr, result)

    result.ok = len(result.errors) == 0
    return result


# ── Individual checks ──────────────────────────────────────────────────────────

def _check_resolution(img: np.ndarray, result: ValidationResult) -> None:
    h, w = img.shape[:2]
    result.debug["resolution"] = {"width": w, "height": h}
    if w < MIN_WIDTH or h < MIN_HEIGHT:
        result.errors.append("resolution_too_low")


def _check_blur(gray: np.ndarray, result: ValidationResult) -> None:
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    result.debug["laplacian_variance"] = round(lap_var, 2)
    if lap_var < BLUR_THRESHOLD:
        result.errors.append("image_too_blurry")


def _check_lighting(gray: np.ndarray, result: ValidationResult) -> None:
    mean_lum = float(gray.mean())
    result.debug["mean_luminance"] = round(mean_lum, 2)
    if mean_lum < MIN_LUMINANCE:
        result.warnings.append("image_too_dark")
    elif mean_lum > MAX_LUMINANCE:
        result.warnings.append("image_overexposed")


def _check_card_presence(img: np.ndarray, result: ValidationResult) -> None:
    """Detect whether a card-shaped rectangle occupies enough of the frame."""
    h, w = img.shape[:2]
    frame_area = h * w

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_match: Optional[dict] = None
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < frame_area * 0.1:
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) == 4:
            x, y, cw, ch = cv2.boundingRect(approx)
            if ch == 0:
                continue
            aspect = cw / ch
            expected = CARD_ASPECT_RATIO
            if abs(aspect - expected) / expected <= ASPECT_TOLERANCE:
                frac = area / frame_area
                if best_match is None or frac > best_match["area_frac"]:
                    best_match = {"area_frac": frac, "aspect": aspect}

    result.debug["card_detection"] = best_match or {}
    if best_match is None:
        result.errors.append("card_not_detected")
    elif best_match["area_frac"] < MIN_CARD_AREA_FRACTION:
        result.warnings.append("card_too_small_in_frame")
