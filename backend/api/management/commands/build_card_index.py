"""
Management command: build_card_index

Downloads card images from the PokémonTCG API, computes perceptual hashes,
and saves the index to backend/api/ml/models/card_hash_index.npz.

Uses the `requests` library which respects system/corporate proxy settings
(including Windows proxy settings) automatically.

Usage:
    python manage.py build_card_index
    python manage.py build_card_index --limit 500   # quick test
    POKEMON_TCG_API_KEY=your_key python manage.py build_card_index
"""

import os

import cv2
import numpy as np
from django.core.management.base import BaseCommand

from api.ml.card_recognizer import HASH_INDEX_PATH, _compute_phash


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
        try:
            import requests  # noqa: PLC0415
        except ImportError:
            self.stderr.write(self.style.ERROR("pip install requests"))
            return

        limit = options["limit"]
        page_size = min(options["page_size"], 250)
        api_key = os.environ.get("POKEMON_TCG_API_KEY", "")

        if not api_key:
            self.stdout.write(
                self.style.WARNING(
                    "POKEMON_TCG_API_KEY not set — unauthenticated requests are "
                    "rate-limited to ~1 000 req/day."
                )
            )

        session = requests.Session()
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (compatible; TCG-Marketplace/1.0)",
            "Accept": "application/json",
        })
        if api_key:
            session.headers["X-Api-Key"] = api_key

        # ── Fetch card list ────────────────────────────────────────────────────
        self.stdout.write("Fetching card list from pokemontcg.io …")
        all_cards = self._fetch_card_list(session, page_size, limit)
        self.stdout.write(f"  {len(all_cards)} cards to index.")

        if not all_cards:
            self.stderr.write(self.style.ERROR("No cards fetched — aborting."))
            return

        # ── Download images and hash ───────────────────────────────────────────
        hashes = []
        metadata = []
        errors = 0

        for i, card in enumerate(all_cards, start=1):
            card_id = card.get("id", "?")
            img_url = card.get("images", {}).get("small")
            if not img_url:
                continue

            try:
                img_resp = session.get(img_url, timeout=10)
                img_resp.raise_for_status()
                arr = np.frombuffer(img_resp.content, dtype=np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if img is None:
                    raise ValueError("imdecode returned None")

                hashes.append(_compute_phash(img))
                metadata.append({
                    "id": card_id,
                    "name": card.get("name"),
                    "set_name": card.get("set", {}).get("name"),
                })
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
            return

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

    def _fetch_card_list(self, session, page_size: int, limit):
        base_url = "https://api.pokemontcg.io/v2/cards"
        all_cards = []
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
                self.stderr.write(self.style.ERROR(f"Failed to fetch page {page}: {exc}"))
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

        self.stdout.write("")
        if limit:
            all_cards = all_cards[:limit]
        return all_cards
