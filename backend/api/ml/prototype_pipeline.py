"""
TCG Marketplace — Card Recognition & Pre-grading Prototype Pipeline
====================================================================

Usage (CLI):
    python -m api.ml.prototype_pipeline path/to/card.jpg
    python -m api.ml.prototype_pipeline path/to/card.jpg --json

    # Build the card hash index first (one-time, requires internet):
    python -m api.ml.card_recognizer --build-index --limit 500

Output (example):
    {
      "card_name": "Charizard",
      "set_name": "Base Set",
      "card_id": "base1-4",
      "recognition_confidence": 0.91,
      "suggested_condition": "NM",
      "grading_confidence": 0.74,
      "confidence_breakdown": {"MT": 0.09, "NM": 0.74, "LP": 0.13, ...},
      "issues_detected": ["minor_edge_whitening"],
      "photo_quality": {"ok": true, "warnings": []},
      "grading_method": "heuristic",
      "recognition_method": "hash_index"
    }
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any, Dict

import cv2
import numpy as np

from . import card_normalizer, card_recognizer, grader, photo_validator

logger = logging.getLogger(__name__)


def run_pipeline(image_path: str) -> Dict[str, Any]:
    """
    Full pipeline: validate → normalise → recognise → grade.

    Parameters
    ----------
    image_path : str
        Path to the card image (JPEG, PNG, WebP, etc.).

    Returns
    -------
    dict
        Structured result suitable for the `/api/listings/analyze-photo/`
        endpoint response.
    """
    t0 = time.perf_counter()

    # ── 1. Load ────────────────────────────────────────────────────────────────
    img_bgr = cv2.imread(str(image_path))
    if img_bgr is None:
        return _error_response(f"Cannot read image: {image_path}")

    # ── 2. Photo quality validation ────────────────────────────────────────────
    validation = photo_validator.validate(img_bgr)
    if not validation.ok:
        return {
            "error": "photo_quality_failure",
            "details": validation.errors,
            "warnings": validation.warnings,
            "debug": validation.debug,
        }

    # ── 3. Normalise card ──────────────────────────────────────────────────────
    normalised, perspective_warped = card_normalizer.normalize(img_bgr)

    # ── 4. Card recognition ────────────────────────────────────────────────────
    recognition = card_recognizer.recognize(normalised)

    # ── 5. Condition grading ───────────────────────────────────────────────────
    grade_result = grader.grade(normalised)

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

    return {
        # Card identity
        "card_name": recognition.card_name,
        "set_name": recognition.set_name,
        "card_id": recognition.card_id,
        "recognition_confidence": recognition.confidence,
        "recognition_method": recognition.method,

        # Condition grading
        "suggested_condition": grade_result.suggested_condition,
        "grading_confidence": grade_result.confidence,
        "confidence_breakdown": grade_result.confidence_breakdown,
        "issues_detected": grade_result.issues_detected,
        "grading_method": grade_result.method,

        # Photo quality (passed)
        "photo_quality": {
            "ok": True,
            "warnings": validation.warnings,
            "debug": validation.debug,
        },

        # Meta
        "perspective_warped": perspective_warped,
        "elapsed_ms": elapsed_ms,
    }


def _error_response(msg: str) -> Dict[str, Any]:
    return {"error": "pipeline_error", "details": [msg]}


# ── Benchmark helpers ──────────────────────────────────────────────────────────

def benchmark(image_paths: list, runs: int = 5) -> None:
    """
    Run the pipeline N times on each image and print timing statistics.

    Not used in production — for local accuracy / latency benchmarking only.
    """
    import statistics  # noqa: PLC0415

    print(f"\n{'Image':<40} {'Runs':>5} {'Mean ms':>10} {'Stdev ms':>10} {'Condition':>10}")
    print("-" * 80)

    for path in image_paths:
        times = []
        last_result = {}
        for _ in range(runs):
            t0 = time.perf_counter()
            result = run_pipeline(path)
            times.append((time.perf_counter() - t0) * 1000)
            last_result = result

        mean_ms = statistics.mean(times)
        stdev_ms = statistics.stdev(times) if len(times) > 1 else 0.0
        condition = last_result.get("suggested_condition", "ERROR")
        name = Path(path).name
        print(f"{name:<40} {runs:>5} {mean_ms:>10.1f} {stdev_ms:>10.1f} {condition:>10}")

    print()


# ── CLI ────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="TCG card recognition and pre-grading prototype"
    )
    parser.add_argument("image", nargs="?", help="Path to card image")
    parser.add_argument("--json", action="store_true",
                        help="Output raw JSON instead of pretty-print")
    parser.add_argument("--benchmark", nargs="+", metavar="IMAGE",
                        help="Benchmark mode: run pipeline N times on each image")
    parser.add_argument("--runs", type=int, default=5,
                        help="Number of runs per image in benchmark mode (default: 5)")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.WARNING)

    if args.benchmark:
        benchmark(args.benchmark, runs=args.runs)
        return

    if not args.image:
        parser.error("Provide an image path or use --benchmark")

    result = run_pipeline(args.image)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        _pretty_print(result)


def _pretty_print(result: Dict[str, Any]) -> None:
    if "error" in result:
        print(f"\n  ERROR: {result['error']}")
        for d in result.get("details", []):
            print(f"    - {d}")
        for w in result.get("warnings", []):
            print(f"    ! {w}")
        return

    card = result.get("card_name") or "Unknown card"
    set_ = result.get("set_name") or "Unknown set"
    rec_conf = result.get("recognition_confidence", 0.0)
    cond = result.get("suggested_condition", "?")
    grade_conf = result.get("grading_confidence", 0.0)
    breakdown = result.get("confidence_breakdown", {})
    issues = result.get("issues_detected", [])
    elapsed = result.get("elapsed_ms", 0)

    print(f"\n  Card:        {card} [{set_}]  (recognition: {rec_conf:.0%})")
    print(f"  Condition:   {cond}  (confidence: {grade_conf:.0%})")
    print(f"  Breakdown:   " +
          "  ".join(f"{k}:{v:.2f}" for k, v in breakdown.items()))
    if issues:
        print(f"  Issues:      {', '.join(issues)}")
    warnings = result.get("photo_quality", {}).get("warnings", [])
    if warnings:
        print(f"  Warnings:    {', '.join(warnings)}")
    method_g = result.get("grading_method", "?")
    method_r = result.get("recognition_method", "?")
    print(f"  Methods:     grader={method_g}  recognizer={method_r}")
    print(f"  Elapsed:     {elapsed} ms\n")


if __name__ == "__main__":
    main()
