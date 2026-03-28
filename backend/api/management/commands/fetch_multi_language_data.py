import json
import os
import time
from django.core.management.base import BaseCommand
from django.conf import settings
from pathlib import Path
from tcgdexsdk import TCGdex


class Command(BaseCommand):
    help = 'Fetches all required multi-language card data from the TCGdex API using manual serialization.'

    LANGUAGES_TO_FETCH = {
        'en': 'English',
        'ja': 'Japanese',
        'de': 'German',
        'fr': 'French',
        'it': 'Italian',
        'zh-cn': 'Simplified Chinese',
    }

    tcgdex = TCGdex()

    def safe_serialize_set(self, set_obj):
        """
        Manually extracts data from the SDK Set object to avoid recursion errors.
        Maps TCGdex fields to the format your Import Script expects.
        """
        series_val = getattr(set_obj, 'series', None)
        series_name = getattr(series_val, 'name', str(series_val)) if series_val else ''

        card_count_obj = getattr(set_obj, 'cardCount', None)
        total_count = getattr(card_count_obj, 'total', 0) if card_count_obj else 0

        return {
            'id': getattr(set_obj, 'id', ''),
            'name': getattr(set_obj, 'name', ''),
            'series': series_name,
            'total': total_count,
            'releaseDate': getattr(set_obj, 'releaseDate', None),
            'ptcgoCode': getattr(set_obj, 'tcgOnline', ''),
        }

    def safe_serialize_card(self, card_obj):
        """
        Manually extracts data from the SDK Card object.
        TRANSFORMS data to match what import_master_cards.py expects.
        """
        image_url = getattr(card_obj, 'image', '')

        return {
            'id': getattr(card_obj, 'id', ''),
            'name': getattr(card_obj, 'name', ''),
            'number': getattr(card_obj, 'localId', ''),
            'rarity': getattr(card_obj, 'rarity', ''),
            'images': {'large': image_url}
        }

    def handle(self, *args, **options):
        BASE_DATA_DIR = Path(settings.BASE_DIR) / 'api' / 'data'
        CARDS_BASE_DIR = BASE_DATA_DIR / 'raw_cards'
        SETS_BASE_DIR = BASE_DATA_DIR / 'sets'

        os.makedirs(CARDS_BASE_DIR, exist_ok=True)
        os.makedirs(SETS_BASE_DIR, exist_ok=True)

        for lang_code, lang_name in self.LANGUAGES_TO_FETCH.items():
            self.stdout.write(self.style.NOTICE(f"\n--- Starting data fetch for {lang_name} ({lang_code.upper()}) ---"))

            self.tcgdex.setLanguage(lang_code)

            dir_code = 'zh' if lang_code.lower() == 'zh-cn' else lang_code
            lang_cards_dir = CARDS_BASE_DIR / dir_code if dir_code != 'en' else CARDS_BASE_DIR
            os.makedirs(lang_cards_dir, exist_ok=True)

            # 1. FETCH SETS
            self.stdout.write(f"Fetching Set Master data for {lang_name}...")
            try:
                sets_list_sdk = self.tcgdex.set.listSync()

                sets_data = [self.safe_serialize_set(s) for s in sets_list_sdk]

                sets_file_path = SETS_BASE_DIR / f"{lang_code}.json"
                with open(sets_file_path, 'w', encoding='utf-8') as f:
                    json.dump(sets_data, f, ensure_ascii=False, indent=2)
                self.stdout.write(self.style.SUCCESS(f"Saved Set Master data to {sets_file_path.name}"))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error fetching sets for {lang_name}: {e}. Skipping sets."))
                continue

            # 2. FETCH CARDS
            sets_fetched = 0
            for set_info_sdk in sets_list_sdk:
                set_id = getattr(set_info_sdk, 'id', None)
                set_name = getattr(set_info_sdk, 'name', 'Unknown')

                if not set_id:
                    continue

                try:
                    full_set_sdk = self.tcgdex.set.getSync(set_id)

                    cards_list = [self.safe_serialize_card(c) for c in full_set_sdk.cards]

                    if not cards_list:
                        self.stdout.write(self.style.WARNING(f"[{lang_code.upper()}] No cards found for set {set_id}. Skipping."))
                        continue

                    set_file_path = lang_cards_dir / f"{set_id}.json"
                    with open(set_file_path, 'w', encoding='utf-8') as f:
                        json.dump(cards_list, f, ensure_ascii=False, indent=2)

                    self.stdout.write(f"  > Saved {len(cards_list)} cards from set '{set_name}' ({set_id})")
                    sets_fetched += 1

                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error fetching cards for set {set_id} ({lang_code}): {e}."))

                time.sleep(0.1)

            self.stdout.write(self.style.SUCCESS(
                f"\nFinished data fetch for {lang_name} ({lang_code.upper()}): {sets_fetched} sets saved."
            ))
