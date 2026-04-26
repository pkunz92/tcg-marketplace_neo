"""
Management command: build_card_index

Downloads card images from the PokémonTCG API, computes perceptual hashes,
and saves the index to backend/api/ml/models/card_hash_index.npz.

Usage:
    python manage.py build_card_index
    python manage.py build_card_index --limit 500   # quick test
    POKEMON_TCG_API_KEY=your_key python manage.py build_card_index
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

import cv2
import numpy as np
from django.core.management.base import BaseCommand

from api.ml.card_recognizer import HASH_INDEX_PATH, HASH_SIZE, _compute_phash


class Command(BaseCommand):
    help = "Build the local perceptual-hash card index from the PokémonTCG API."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            metavar="N",
            help="Cap number of cards to index (omit for full catalogue ~20 k cards).",
        )
        parser.add_argument(
            "--page-size",
            type=int,
            default=250,
            dest="page_size",
            help="Cards per API page (max 250, default 250).",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        page_size = min(options["page_size"], 250)
        api_key = os.environ.get("POKEMON_TCG_API_KEY", "")

        if not api_key:
            self.stdout.write(
                self.style.WARNING(
                    "POKEMON_TCG_API_KEY not set — unauthenticated requests are "
                    "rate-limited to ~1 000 req/day.  Set the env var for full access."
                )
            )

        # ── Fetch card list ────────────────────────────────────────────────────
        self.stdout.write("Fetching card list from pokemontcg.io …")
        all_cards = self._fetch_card_list(api_key, page_size, limit, options["verbosity"])
        self.stdout.write(f"  {len(all_cards)} cards to index.")

        # ── Download images and hash ───────────────────────────────────────────
        hashes = []
        metadata = []
        errors = 0
        img_headers = {
            "User-Agent": "Mozilla/5.0 (compatible; TCG-Marketplace/1.0; +https://tcg-marketplace.local)",
        }

        for i, card in enumerate(all_cards, start=1):
            card_id = card.get("id", "?")
            img_url = card.get("images", {}).get("small")
            if not img_url:
                continue

            try:
                img_req = urllib.request.Request(img_url, headers=img_headers)
                with urllib.request.urlopen(img_req, timeout=10) as resp:
                    arr = np.frombuffer(resp.read(), dtype=np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if img is None:
                    raise ValueError("imdecode returned None")

                hashes.append(_compute_phash(img))
                metadata.append(
                    {
                        "id": card_id,
                        "name": card.get("name"),
                        "set_name": card.get("set", {}).get("name"),
                    }
                )
            except Exception as exc:  # noqa: BLE001
                errors += 1
                if options["verbosity"] >= 2:
                    self.stderr.write(f"  skip {card_id}: {exc}")

            if i % 500 == 0 or i == len(all_cards):
                pct = i / len(all_cards) * 100
                self.stdout.write(
                    f"  [{pct:5.1f}%] {i}/{len(all_cards)} processed, "
                    f"{len(hashes)} hashed, {errors} errors",
                    ending="\r",
                )
                self.stdout.flush()

        self.stdout.write("")  # newline after \r progress

        if not hashes:
            self.stderr.write(self.style.ERROR("No hashes computed — aborting."))
            sys.exit(1)

        # ── Save index ─────────────────────────────────────────────────────────
        HASH_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            HASH_INDEX_PATH,
            hashes=np.array(hashes, dtype=bool),
            metadata=np.array(metadata, dtype=object),
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Hash index saved: {len(hashes)} cards → {HASH_INDEX_PATH}"
            )
        )
        if errors:
            self.stdout.write(self.style.WARNING(f"  {errors} cards skipped due to errors."))

    # ── helpers ────────────────────────────────────────────────────────────────

    def _fetch_card_list(self, api_key: str, page_size: int, limit, verbosity: int = 1):
        import urllib.error  # noqa: PLC0415

        base_url = "https://api.pokemontcg.io/v2/cards"
        # Cloudflare blocks default Python-urllib UA — pretend to be a real client.
        extra_headers = {
            "User-Agent": "Mozilla/5.0 (compatible; TCG-Marketplace/1.0; +https://tcg-marketplace.local)",
            "Accept": "application/json",
        }
        if api_key:
            extra_headers["X-Api-Key"] = api_key
        all_cards = []
        page = 1

        while True:
            url = (
                f"{base_url}?pageSize={page_size}&page={page}"
                "&select=id,name,set,images"
            )
            req = urllib.request.Request(url, headers=extra_headers)
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    payload = json.loads(resp.read().decode())
            except urllib.error.HTTPError as exc:
                body = exc.read().decode("utf-8", errors="replace")[:500]
                self.stderr.write(
                    self.style.ERROR(
                        f"Failed to fetch page {page}: HTTP {exc.code} {exc.reason}\n"
                        f"Response body: {body}"
                    )
                )
                break
            except Exception as exc:  # noqa: BLE001
                self.stderr.write(
                    self.style.ERROR(f"Failed to fetch page {page}: {exc}")
                )
                break

            batch = payload.get("data", [])
            if not batch:
                break
            all_cards.extend(batch)

            total = payload.get("totalCount", len(all_cards))
            self.stdout.write(
                f"  page {page}: +{len(batch)} cards ({len(all_cards)}/{total})",
                ending="\r",
            )
            self.stdout.flush()

            if len(all_cards) >= total:
                break

            if limit and len(all_cards) >= limit:
                break

            page += 1

        self.stdout.write("")  # newline
        if limit:
            all_cards = all_cards[:limit]
        return all_cards
