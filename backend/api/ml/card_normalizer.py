"""
Card image normalisation.

Steps:
  1. Detect the four card corners via Canny + contour approximation.
  2. Apply a perspective warp to produce a flat 224×312 px crop.
  3. Apply CLAHE to reduce lighting variance across the card surface.

Output is a BGR numpy array ready to feed into the grading model.
"""

from __future__ import annotations

from typing import Optional, Tuple

import cv2
import numpy as np

# Standard output dimensions (width × height)
OUTPUT_W = 224
OUTPUT_H = 312


def normalize(image_bgr: np.ndarray) -> Tuple[np.ndarray, bool]:
    """
    Normalise a BGR card image.

    Returns:
        (normalised_bgr, perspective_warped)
        - normalised_bgr: the processed 224×312 BGR image
        - perspective_warped: True if a card contour was found and warped;
          False if we fell back to a plain resize (card contour not found)
    """
    corners = _detect_card_corners(image_bgr)
    if corners is not None:
        warped = _perspective_warp(image_bgr, corners)
        perspective_warped = True
    else:
        warped = cv2.resize(image_bgr, (OUTPUT_W, OUTPUT_H))
        perspective_warped = False

    normalised = _apply_clahe(warped)
    return normalised, perspective_warped


# ── Internals ─────────────────────────────────────────────────────────────────

def _detect_card_corners(img: np.ndarray) -> Optional[np.ndarray]:
    """
    Return the four corners of the card as a (4, 2) float32 array,
    ordered [top-left, top-right, bottom-right, bottom-left].
    Returns None if no suitable contour is found.
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    # Dilate to close small gaps
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    for cnt in contours[:5]:
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) != 4:
            continue
        area = cv2.contourArea(approx)
        if area < (h * w * 0.1):
            continue
        pts = approx.reshape(4, 2).astype(np.float32)
        return _order_corners(pts)

    return None


def _order_corners(pts: np.ndarray) -> np.ndarray:
    """Order four corner points as [TL, TR, BR, BL]."""
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # TL: smallest x+y
    rect[2] = pts[np.argmax(s)]   # BR: largest x+y
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # TR: smallest y-x
    rect[3] = pts[np.argmax(diff)]  # BL: largest y-x
    return rect


def _perspective_warp(img: np.ndarray, corners: np.ndarray) -> np.ndarray:
    """Warp the card region to a flat OUTPUT_W × OUTPUT_H rectangle."""
    dst = np.array([
        [0,          0],
        [OUTPUT_W - 1, 0],
        [OUTPUT_W - 1, OUTPUT_H - 1],
        [0,          OUTPUT_H - 1],
    ], dtype=np.float32)
    M = cv2.getPerspectiveTransform(corners, dst)
    return cv2.warpPerspective(img, M, (OUTPUT_W, OUTPUT_H))


def _apply_clahe(img: np.ndarray) -> np.ndarray:
    """Apply CLAHE per channel in LAB colour space."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lab[:, :, 0] = clahe.apply(lab[:, :, 0])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
