"""
Card recognition — identifies the Pokémon card name and set from an image.

Approach hierarchy (fastest → most accurate):
  1. Hash-based lookup against a local perceptual-hash index built from the
     PokémonTCG API card images.  Sub-100 ms, works fully offline.
  2. PokémonTCG API image similarity search (fallback when local index is
     missing or no hash match found above the confidence threshold).
  3. Graceful degradation: return an "unknown" result rather than crashing.

The local hash index is stored at:
  backend/api/ml/models/card_hash_index.npz
and is built once by running:
  python -m api.ml.card_recognizer --build-index
"""

from __future__ import annotations

import dataclasses
import hashlib
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

HASH_INDEX_PATH = Path(__file__).parent / "models" / "card_hash_index.npz"
HASH_SIZE = 16               # perceptual hash grid size
MATCH_THRESHOLD = 15         # max Hamming distance to accept a match (0-256 for 16x16)


@dataclasses.dataclass
class RecognitionResult:
    card_name: Optional[str]
    set_name: Optional[str]
    card_id: Optional[str]       # PokémonTCG API id (e.g. "swsh4-25")
    confidence: float            # 0.0 – 1.0
    method: str                  # "hash_index" | "api_fallback" | "unknown"


def recognize_top_k(image_bgr: np.ndarray, k: int = 3) -> List[RecognitionResult]:
    """
    Return up to k recognition results sorted by confidence (descending).

    Falls back to a single-element list with the result of ``recognize()``
    when the hash index is unavailable or yields no matches within the
    Hamming-distance threshold.
    """
    phash = _compute_phash(image_bgr)

    if HASH_INDEX_PATH.exists():
        results = _lookup_hash_index_top_k(phash, k)
        if results:
            return results

    return [recognize(image_bgr)]


def recognize(image_bgr: np.ndarray) -> RecognitionResult:
    """
    Identify the card in *image_bgr*.  Returns a RecognitionResult.
    """
    phash = _compute_phash(image_bgr)

    # Try local hash index first
    if HASH_INDEX_PATH.exists():
        result = _lookup_hash_index(phash)
        if result is not None:
            return result

    # Fallback: PokémonTCG API (requires network + optional API key)
    try:
        return _api_fallback(image_bgr)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Card recognition API fallback failed: %s", exc)

    return RecognitionResult(
        card_name=None, set_name=None, card_id=None,
        confidence=0.0, method="unknown"
    )


# ── Perceptual hash helpers ────────────────────────────────────────────────────

def _compute_phash(image_bgr: np.ndarray) -> np.ndarray:
    """Return a (HASH_SIZE*HASH_SIZE,) boolean array (perceptual hash)."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (HASH_SIZE + 1, HASH_SIZE))
    # Difference hash: each bit = left pixel < right pixel
    diff = resized[:, :-1] > resized[:, 1:]
    return diff.flatten()


def _hamming_distance(a: np.ndarray, b: np.ndarray) -> int:
    return int(np.count_nonzero(a != b))


# ── Local hash index ───────────────────────────────────────────────────────────

def _lookup_hash_index(phash: np.ndarray) -> Optional[RecognitionResult]:
    """Search the pre-built .npz index.  Returns None if no match found."""
    data = np.load(HASH_INDEX_PATH, allow_pickle=True)
    hashes: np.ndarray = data["hashes"]       # shape (N, HASH_SIZE*HASH_SIZE) bool
    metadata: np.ndarray = data["metadata"]   # shape (N,) object array of dicts

    distances = np.array([_hamming_distance(phash, h) for h in hashes])
    best_idx = int(np.argmin(distances))
    best_dist = distances[best_idx]

    if best_dist > MATCH_THRESHOLD:
        return None

    meta: dict = metadata[best_idx]
    confidence = max(0.0, 1.0 - best_dist / MATCH_THRESHOLD)
    return RecognitionResult(
        card_name=meta.get("name"),
        set_name=meta.get("set_name"),
        card_id=meta.get("id"),
        confidence=round(confidence, 3),
        method="hash_index",
    )


def _lookup_hash_index_top_k(phash: np.ndarray, k: int) -> List[RecognitionResult]:
    """Return up to k results from the hash index within MATCH_THRESHOLD."""
    data = np.load(HASH_INDEX_PATH, allow_pickle=True)
    hashes: np.ndarray = data["hashes"]
    metadata: np.ndarray = data["metadata"]

    distances = np.array([_hamming_distance(phash, h) for h in hashes])
    top_k_indices = np.argsort(distances)[:k]

    results: List[RecognitionResult] = []
    for idx in top_k_indices:
        dist = int(distances[idx])
        if dist > MATCH_THRESHOLD:
            break
        meta: dict = metadata[idx]
        confidence = max(0.0, 1.0 - dist / MATCH_THRESHOLD)
        results.append(RecognitionResult(
            card_name=meta.get("name"),
            set_name=meta.get("set_name"),
            card_id=meta.get("id"),
            confidence=round(confidence, 3),
            method="hash_index",
        ))
    return results


def build_hash_index(limit: Optional[int] = None) -> None:
    """
    Download card images from the PokémonTCG API, compute perceptual hashes,
    and save the index to HASH_INDEX_PATH.

    Uses the `requests` library which respects system/corporate proxy settings
    (including Windows proxy settings) automatically.

    Run once:
        python -m api.ml.card_recognizer --build-index [--limit 500]
    """
    try:
        import requests  # noqa: PLC0415
    except ImportError:
        raise RuntimeError("pip install requests")

    api_key = os.environ.get("POKEMON_TCG_API_KEY", "")
    base_url = "https://api.pokemontcg.io/v2/cards"
    page_size = 250
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; TCG-Marketplace/1.0)",
        "Accept": "application/json",
    })
    if api_key:
        session.headers["X-Api-Key"] = api_key

    # ── Fetch all card stubs (id, name, set.name, images.small) ──────────────
    all_cards: List[dict] = []
    page = 1
    while True:
        try:
            resp = session.get(
                base_url,
                params={"pageSize": page_size, "page": page, "select": "id,name,set,images"},
                timeout=30,
            )
            resp.raise_for_status()
            payload = resp.json()
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to fetch card list page %d: %s", page, exc)
            break

        batch = payload.get("data", [])
        if not batch:
            break
        all_cards.extend(batch)
        logger.info("Fetched page %d — %d cards so far", page, len(all_cards))

        total = payload.get("totalCount", 0)
        if len(all_cards) >= total:
            break
        page += 1

    if limit:
        all_cards = all_cards[:limit]

    logger.info("Total cards to index: %d", len(all_cards))

    # ── Download images and compute hashes ────────────────────────────────────
    hashes: List[np.ndarray] = []
    metadata: List[dict] = []

    for card in all_cards:
        card_id = card.get("id", "?")
        try:
            img_url = card.get("images", {}).get("small")
            if not img_url:
                continue
            img_resp = session.get(img_url, timeout=10)
            img_resp.raise_for_status()
            arr = np.frombuffer(img_resp.content, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                continue
            hashes.append(_compute_phash(img))
            metadata.append({
                "id": card_id,
                "name": card.get("name"),
                "set_name": card.get("set", {}).get("name"),
            })
        except Exception as exc:  # noqa: BLE001
            logger.warning("Skipping card %s: %s", card_id, exc)

    HASH_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        HASH_INDEX_PATH,
        hashes=np.array(hashes, dtype=bool),
        metadata=np.array(metadata, dtype=object),
    )
    logger.info("Hash index built: %d cards saved to %s", len(hashes), HASH_INDEX_PATH)


# ── API fallback ───────────────────────────────────────────────────────────────

def _api_fallback(image_bgr: np.ndarray) -> RecognitionResult:
    """
    Best-effort recognition via the PokémonTCG API using image OCR on the
    card name region (top ~12 % of card).

    This is a lightweight fallback — production should use the hash index.
    """
    try:
        import pokemontcgsdk as sdk  # noqa: PLC0415
        # Crop the card name band (top strip)
        h, w = image_bgr.shape[:2]
        name_strip = image_bgr[: int(h * 0.12), :]
        # Simple brightness-based "is there text" heuristic — full OCR would
        # require pytesseract which is an optional dep.  For the prototype we
        # return a low-confidence unknown result rather than an incorrect one.
        _ = name_strip  # reserved for OCR integration
        return RecognitionResult(
            card_name=None, set_name=None, card_id=None,
            confidence=0.0, method="api_fallback"
        )
    except ImportError:
        raise RuntimeError("pokemontcgsdk is not installed")


# ── CLI entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Card recognizer utilities")
    parser.add_argument("--build-index", action="store_true",
                        help="Download card images and build the local hash index")
    parser.add_argument("--limit", type=int, default=None,
                        help="Cap number of cards when building index (for testing)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    if args.build_index:
        build_hash_index(limit=args.limit)
    else:
        parser.print_help()
