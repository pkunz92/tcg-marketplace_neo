"""
TCG Marketplace — Grading Microservice
=======================================

Standalone FastAPI service that wraps the ML card recognition and condition
grading pipeline.  The backend calls this service after uploading a card photo
to S3.

Endpoints:
  GET  /health    — liveness check
  POST /grade     — grade a card photo by URL

Authentication:
  All POST requests must include the header:
    X-Grading-Secret: <shared secret>
  Set the secret via the GRADING_SECRET environment variable.
  If GRADING_SECRET is empty the auth check is skipped (local dev only).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import cv2
import httpx
import numpy as np
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

# ML modules live at ./ml/ (copied from backend/api/ml/ by Docker)
from ml import card_normalizer, card_recognizer, grader, photo_validator

logger = logging.getLogger("grading_service")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

app = FastAPI(title="TCG Grading Service", version="1.0.0")

GRADING_SECRET: str = os.environ.get("GRADING_SECRET", "")

# Internal condition labels → public API labels
_CONDITION_MAP: Dict[str, str] = {
    "MT": "Mint",
    "NM": "NM",
    "LP": "LP",
    "MP": "MP",
    "HP": "HP",
    "DMG": "Damaged",
}

# Confidence below this threshold → prompt seller to retake photo
_CONFIDENCE_THRESHOLD = 0.6


# ── Request / response schemas ────────────────────────────────────────────────

class GradeRequest(BaseModel):
    photoUrl: str


class GradeResponse(BaseModel):
    grade: Optional[str]
    confidence: float
    detectedSet: Optional[str]
    detectedName: Optional[str]
    detectedRarity: Optional[str]
    message: Optional[str] = None


# ── Auth helper ───────────────────────────────────────────────────────────────

def _check_auth(x_grading_secret: Optional[str]) -> None:
    if not GRADING_SECRET:
        return  # auth disabled in dev
    if x_grading_secret != GRADING_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Grading-Secret")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/grade", response_model=GradeResponse)
async def grade_card(
    req: GradeRequest,
    x_grading_secret: Optional[str] = Header(default=None),
) -> Any:
    _check_auth(x_grading_secret)

    # 1. Fetch image from URL
    img_bgr = await _fetch_image(req.photoUrl)

    # 2. Photo quality validation
    validation = photo_validator.validate(img_bgr)
    if not validation.ok:
        logger.info("Photo validation failed: %s", validation.errors)
        return GradeResponse(
            grade=None,
            confidence=0.0,
            detectedSet=None,
            detectedName=None,
            detectedRarity=None,
            message="photo quality insufficient",
        )

    # 3. Normalise card geometry + lighting
    normalised, _ = card_normalizer.normalize(img_bgr)

    # 4. Card recognition (identity)
    recognition = card_recognizer.recognize(normalised)

    # 5. Condition grading
    grade_result = grader.grade(normalised)

    logger.info(
        "Graded: card=%s set=%s condition=%s conf=%.2f method=%s",
        recognition.card_name,
        recognition.set_name,
        grade_result.suggested_condition,
        grade_result.confidence,
        grade_result.method,
    )

    # 6. Low confidence → ask seller to retake
    if grade_result.confidence < _CONFIDENCE_THRESHOLD:
        return GradeResponse(
            grade=None,
            confidence=grade_result.confidence,
            detectedSet=recognition.set_name,
            detectedName=recognition.card_name,
            detectedRarity=None,
            message="photo quality insufficient",
        )

    public_grade = _CONDITION_MAP.get(
        grade_result.suggested_condition,
        grade_result.suggested_condition,
    )

    return GradeResponse(
        grade=public_grade,
        confidence=grade_result.confidence,
        detectedSet=recognition.set_name,
        detectedName=recognition.card_name,
        detectedRarity=None,  # rarity lookup not yet in hash index (MVP)
    )


# ── Image fetch helper ────────────────────────────────────────────────────────

async def _fetch_image(url: str) -> np.ndarray:
    """Download a card photo from *url* and decode it to a BGR numpy array."""
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to fetch image (HTTP {exc.response.status_code}): {url}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to fetch image: {exc}",
        ) from exc

    arr = np.frombuffer(resp.content, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=422, detail="Could not decode image data")
    return img
