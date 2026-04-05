"""
Seed MTG card catalogue from the Scryfall bulk-data API.

Usage:
    python manage.py seed_mtg_catalogue
    python manage.py seed_mtg_catalogue --limit 1000   # dev: partial import
    python manage.py seed_mtg_catalogue --set-codes MH3 OTJ  # specific sets only

Safe to re-run (idempotent): existing records are updated, not duplicated.
"""
import json
import sys
import time
import urllib.request
from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Card_Master, Set_Master, TcgTypeChoices


SCRYFALL_BULK_URL = "https://api.scryfall.com/bulk-data/default-cards"
# Scryfall requests a small delay between requests
REQUEST_DELAY = 0.1  # seconds


class Command(BaseCommand):
    help = "Seed MTG card catalogue from Scryfall bulk-data API (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Maximum number of cards to import (useful for development).",
        )
        parser.add_argument(
            "--set-codes",
            nargs="+",
            dest="set_codes",
            default=None,
            help="Import only cards from these set codes (e.g. MH3 OTJ).",
        )

    def _fetch_json(self, url):
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "TCGMarketplace/1.0 (contact@tcgmarketplace.example)"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def handle(self, *args, **options):
        limit = options["limit"]
        filter_set_codes = set(options["set_codes"] or [])

        self.stdout.write(self.style.NOTICE("Fetching Scryfall bulk-data index..."))
        bulk_meta = self._fetch_json(SCRYFALL_BULK_URL)
        download_url = bulk_meta["download_uri"]
        self.stdout.write(f"  Bulk file: {download_url}")

        self.stdout.write(self.style.NOTICE("Downloading card data (this may take a moment)..."))
        time.sleep(REQUEST_DELAY)
        cards_data = self._fetch_json(download_url)
        self.stdout.write(f"  Total cards in bulk file: {len(cards_data):,}")

        # --- Filter and deduplicate ---
        seen_api_ids = set()
        filtered = []
        for card in cards_data:
            # Only English cards with images
            if card.get("lang") != "en":
                continue
            if not card.get("image_uris") and not card.get("card_faces"):
                continue
            # Optional set-code filter
            if filter_set_codes and card.get("set", "").upper() not in {s.upper() for s in filter_set_codes}:
                continue
            api_id = card["id"]
            if api_id in seen_api_ids:
                continue
            seen_api_ids.add(api_id)
            filtered.append(card)

        if limit:
            filtered = filtered[:limit]

        self.stdout.write(f"  Cards to process: {len(filtered):,}")

        # --- Group cards by set for Set_Master upsert ---
        sets_seen = {}
        for card in filtered:
            set_code = card.get("set", "").upper()
            if set_code not in sets_seen:
                sets_seen[set_code] = {
                    "set_code": set_code,
                    "set_name": card.get("set_name", set_code),
                    "released_at": card.get("released_at"),
                }

        # --- Upsert Set_Master rows ---
        self.stdout.write(self.style.NOTICE(f"Upserting {len(sets_seen)} MTG sets..."))
        set_obj_map = {}
        with transaction.atomic():
            for set_code, info in sets_seen.items():
                release_date = None
                if info["released_at"]:
                    try:
                        y, m, d = info["released_at"].split("-")
                        release_date = date(int(y), int(m), int(d))
                    except (ValueError, AttributeError):
                        pass

                obj, _ = Set_Master.objects.update_or_create(
                    set_code=set_code,
                    language="en",
                    defaults={
                        "set_name": info["set_name"],
                        "tcg_type": TcgTypeChoices.MTG,
                        "release_date": release_date,
                        "total_cards": 0,
                        "printed_total": 0,
                    },
                )
                set_obj_map[set_code] = obj

        # --- Upsert Card_Master rows ---
        self.stdout.write(self.style.NOTICE("Upserting MTG cards..."))
        created = updated = skipped = 0

        def _image_url(card):
            """Return the best available image URL for a card."""
            if card.get("image_uris"):
                return card["image_uris"].get("normal") or card["image_uris"].get("large", "")
            # Double-faced cards: use front face
            faces = card.get("card_faces", [])
            if faces and faces[0].get("image_uris"):
                return faces[0]["image_uris"].get("normal") or faces[0]["image_uris"].get("large", "")
            return ""

        BATCH_SIZE = 200
        batch = []
        existing_ids = set(
            Card_Master.objects.filter(tcg_type=TcgTypeChoices.MTG)
            .values_list("api_id", flat=True)
        )

        for card in filtered:
            set_code = card.get("set", "").upper()
            set_obj = set_obj_map.get(set_code)
            api_id = card["id"]

            image = _image_url(card)
            if not image:
                skipped += 1
                continue

            defaults = {
                "set": set_obj,
                "language": "en",
                "tcg_type": TcgTypeChoices.MTG,
                "card_name": card.get("name", ""),
                "card_number": card.get("collector_number", ""),
                "card_rarity": card.get("rarity", ""),
                "image_url": image,
                "supertype": card.get("type_line", "").split("—")[0].strip()[:50],
                "subtypes": (card.get("type_line", "").split("—")[1].strip().split() if "—" in card.get("type_line", "") else []),
                "types": card.get("colors") or [],
                "artist": card.get("artist", "")[:200],
                "flavor_text": card.get("flavor_text", ""),
                "legalities": card.get("legalities") or {},
            }
            batch.append((api_id, defaults))

            if len(batch) >= BATCH_SIZE:
                created_n, updated_n = self._flush_batch(batch, existing_ids)
                created += created_n
                updated += updated_n
                batch = []

        if batch:
            created_n, updated_n = self._flush_batch(batch, existing_ids)
            created += created_n
            updated += updated_n

        self.stdout.write(self.style.SUCCESS(
            f"Done. Created: {created}, Updated: {updated}, Skipped (no image): {skipped}"
        ))

    def _flush_batch(self, batch, existing_ids):
        created = updated = 0
        with transaction.atomic():
            for api_id, defaults in batch:
                if api_id in existing_ids:
                    Card_Master.objects.filter(api_id=api_id).update(**defaults)
                    updated += 1
                else:
                    Card_Master.objects.create(api_id=api_id, **defaults)
                    existing_ids.add(api_id)
                    created += 1
        return created, updated
