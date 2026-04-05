"""
Seed Yu-Gi-Oh! card catalogue from the YGOPRO (YGOPRODeck) API.

Usage:
    python manage.py seed_yugioh_catalogue
    python manage.py seed_yugioh_catalogue --limit 500   # dev: partial import

API docs: https://ygoprodeck.com/api-guide/

Safe to re-run (idempotent): existing records are updated, not duplicated.
"""
import json
import sys
import time
import urllib.request
import urllib.parse

from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Card_Master, Set_Master, TcgTypeChoices


YGOPRO_CARDINFO_URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php"
YGOPRO_SETS_URL = "https://db.ygoprodeck.com/api/v7/cardsets.php"

# YGOPRO synthetic set code for cards with no set affiliation
YGOPRO_MISC_SET_CODE = "YGO-MISC"

REQUEST_DELAY = 0.2  # seconds — be polite to the free API


class Command(BaseCommand):
    help = "Seed Yu-Gi-Oh! card catalogue from YGOPRO API (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Maximum number of cards to import (useful for development).",
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

        # --- Fetch card sets ---
        self.stdout.write(self.style.NOTICE("Fetching Yu-Gi-Oh! set list from YGOPRO..."))
        time.sleep(REQUEST_DELAY)
        try:
            sets_data = self._fetch_json(YGOPRO_SETS_URL)
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f"Could not fetch sets: {exc}. Will create a fallback set."))
            sets_data = []

        # --- Upsert Set_Master rows ---
        set_obj_map = {}
        self.stdout.write(self.style.NOTICE(f"Upserting {len(sets_data)} YGO sets..."))
        with transaction.atomic():
            for s in sets_data:
                raw_code = (s.get("set_code") or s.get("setCode") or "").upper().strip()
                raw_name = s.get("set_name") or s.get("setName") or raw_code
                if not raw_code:
                    continue
                # Prefix to avoid collisions with Pokemon/MTG set codes
                set_code = f"YGO-{raw_code}"[:20]
                obj, _ = Set_Master.objects.update_or_create(
                    set_code=set_code,
                    language="en",
                    defaults={
                        "set_name": raw_name[:100],
                        "tcg_type": TcgTypeChoices.YUGIOH,
                        "total_cards": s.get("num_of_cards") or s.get("numOfCards") or 0,
                        "printed_total": s.get("num_of_cards") or s.get("numOfCards") or 0,
                    },
                )
                set_obj_map[raw_code] = obj

            # Fallback/misc set for cards with no set info
            misc_set, _ = Set_Master.objects.update_or_create(
                set_code=YGOPRO_MISC_SET_CODE,
                language="en",
                defaults={
                    "set_name": "Yu-Gi-Oh! (Misc)",
                    "tcg_type": TcgTypeChoices.YUGIOH,
                    "total_cards": 0,
                },
            )
            set_obj_map["__misc__"] = misc_set

        # --- Fetch all cards ---
        self.stdout.write(self.style.NOTICE("Fetching Yu-Gi-Oh! card info from YGOPRO..."))
        time.sleep(REQUEST_DELAY)
        try:
            raw = self._fetch_json(YGOPRO_CARDINFO_URL)
            cards_data = raw.get("data", [])
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"Failed to fetch card data: {exc}"))
            sys.exit(1)

        self.stdout.write(f"  Total cards from YGOPRO: {len(cards_data):,}")

        if limit:
            cards_data = cards_data[:limit]
            self.stdout.write(f"  (Limited to {limit})")

        # --- Upsert Card_Master rows ---
        self.stdout.write(self.style.NOTICE("Upserting YGO cards..."))
        created = updated = skipped = 0

        existing_ids = set(
            Card_Master.objects.filter(tcg_type=TcgTypeChoices.YUGIOH)
            .values_list("api_id", flat=True)
        )

        BATCH_SIZE = 200
        batch = []

        for card in cards_data:
            card_id = card.get("id")
            if not card_id:
                skipped += 1
                continue

            # Use the first card image available
            images = card.get("card_images", [])
            if not images:
                skipped += 1
                continue
            image_url = images[0].get("image_url") or images[0].get("image_url_small", "")
            if not image_url:
                skipped += 1
                continue

            # Resolve set — use first card_set entry
            card_sets = card.get("card_sets", [])
            set_obj = misc_set
            set_code_raw = ""
            if card_sets:
                raw_set_code = (card_sets[0].get("set_code") or "").split("-")[0].upper()
                set_obj = set_obj_map.get(raw_set_code, misc_set)
                set_code_raw = card_sets[0].get("set_code", "")

            api_id = f"ygo-{card_id}"

            defaults = {
                "set": set_obj,
                "language": "en",
                "tcg_type": TcgTypeChoices.YUGIOH,
                "card_name": card.get("name", "")[:255],
                "card_number": set_code_raw[:10],
                "card_rarity": (card_sets[0].get("set_rarity") or "Common")[:50] if card_sets else "Common",
                "image_url": image_url[:500],
                "supertype": (card.get("type") or "")[:50],
                "subtypes": card.get("race", "").split("/") if card.get("race") else [],
                "types": [card.get("attribute")] if card.get("attribute") else [],
                "artist": "",
                "flavor_text": card.get("desc", ""),
                "legalities": {},
            }
            batch.append((api_id, defaults))

            if len(batch) >= BATCH_SIZE:
                c, u = self._flush_batch(batch, existing_ids)
                created += c
                updated += u
                batch = []

        if batch:
            c, u = self._flush_batch(batch, existing_ids)
            created += c
            updated += u

        self.stdout.write(self.style.SUCCESS(
            f"Done. Created: {created}, Updated: {updated}, Skipped: {skipped}"
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
