from django.core.management.base import BaseCommand
from django.db import transaction
from django.conf import settings
from api.models import Card_Master, Set_Master
from pathlib import Path
import json
import sys
from datetime import datetime


class Command(BaseCommand):
    help = 'Imports Set Master from sets/en.json and then Card Master from individual set files, establishing Foreign Keys and secondary IDs.'

    def parse_date(self, date_str):
        """Attempts to parse the date string (YYYY/MM/DD) into a datetime.date object."""
        if not date_str:
            return None
        try:
            return datetime.strptime(date_str, '%Y/%m/%d').date()
        except ValueError:
            return None

    def resolve_path(self, path: Path) -> Path:
        """Resolve Windows-encoded symlinks (text files containing relative paths)."""
        if path.is_file() and path.stat().st_size < 300:
            content = path.read_text(encoding='utf-8').strip()
            if not content.startswith('{') and not content.startswith('['):
                resolved = (path.parent / content).resolve()
                if resolved.exists():
                    return resolved
        return path

    def handle(self, *args, **options):
        BASE_DATA_DIR = Path(settings.BASE_DIR) / 'api' / 'data'
        SETS_JSON_PATH = self.resolve_path(BASE_DATA_DIR / 'sets' / 'en.json')
        CARDS_DIR = BASE_DATA_DIR / 'raw_cards'

        if not SETS_JSON_PATH.exists():
            self.stdout.write(self.style.ERROR(f"FATAL: Set Master file not found at: {SETS_JSON_PATH}"))
            sys.exit(1)

        if not CARDS_DIR.is_dir() or not list(CARDS_DIR.glob('*.json')):
            self.stdout.write(self.style.ERROR(f"FATAL: Card files not found in: {CARDS_DIR}"))
            sys.exit(1)

        # --- PASS 1: IMPORT/UPDATE SETS ---
        self.stdout.write(self.style.NOTICE("--- Pass 1: Importing Set Master data... ---"))
        sets_processed = 0
        try:
            with open(SETS_JSON_PATH, 'r', encoding='utf-8') as f:
                sets_data = json.load(f)
        except json.JSONDecodeError:
            self.stdout.write(self.style.ERROR(f"Error: {SETS_JSON_PATH.name} is not a valid JSON format."))
            sys.exit(1)

        for set_info in sets_data:
            set_code = set_info.get('id')
            set_name = set_info.get('name')
            if set_code and set_name:
                sets_processed += 1
                Set_Master.objects.update_or_create(
                    set_code=set_code,
                    defaults={
                        'set_name': set_name,
                        'ptcgo_code': set_info.get('ptcgoCode', ''),
                        'series': set_info.get('series', ''),
                        'total_cards': set_info.get('total', 0),
                        'release_date': self.parse_date(set_info.get('releaseDate')),
                    }
                )
        self.stdout.write(self.style.SUCCESS(f"Successfully processed {sets_processed} sets. Set Master table is up-to-date."))
        set_lookup = {s.set_code: s for s in Set_Master.objects.all()}

        # --- PASS 2: IMPORT/UPDATE CARDS AND LINK TO SETS ---
        self.stdout.write(self.style.NOTICE("\n--- Pass 2: Importing Card Master data and calculating secondary ID... ---"))

        json_files = list(CARDS_DIR.glob('*.json'))
        processed_card_count = 0

        with transaction.atomic():
            for json_file_path in json_files:
                try:
                    resolved_path = self.resolve_path(json_file_path)
                    with open(resolved_path, 'r', encoding='utf-8') as f:
                        set_data = json.load(f)

                    if not isinstance(set_data, list):
                        continue

                    for card_object in set_data:
                        api_id = card_object.get('id')

                        card_name = card_object.get('name', '').strip()
                        card_number_simple = card_object.get('number', '').strip()

                        set_code = api_id.split('-')[0] if api_id else None

                        if not api_id or not set_code or not card_number_simple or not card_name:
                            continue

                        set_obj = set_lookup.get(set_code)
                        if not set_obj:
                            self.stdout.write(self.style.WARNING(f"Set '{set_code}' not found for card {api_id}. Skipping card."))
                            continue

                        # --- SECONDARY ID CALCULATION ---
                        # Format: PTCGO_CODE SIMPLE_NUMBER/TOTAL_CARDS CARD_NAME
                        ptcgo_code = set_obj.ptcgo_code.upper() if set_obj.ptcgo_code else set_code.upper()
                        total_cards = set_obj.total_cards

                        # Example: CEL 2/25 Blastoise
                        composite_id = f"{ptcgo_code} {card_number_simple}/{total_cards} {card_name}"

                        Card_Master.objects.update_or_create(
                            api_id=api_id,
                            defaults={
                                'set': set_obj,
                                'card_name': card_name,
                                'card_number': card_number_simple,
                                'card_rarity': card_object.get('rarity', 'Unknown'),
                                'image_url': card_object.get('images', {}).get('large', ''),
                                'secondary_id': composite_id,
                            }
                        )
                        processed_card_count += 1

                    self.stdout.write(self.style.SUCCESS(f"Processed set {json_file_path.name}..."))

                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"An error occurred in Pass 2 while processing {json_file_path.name}: {e}. Skipping set."))

        self.stdout.write(self.style.SUCCESS(
            f"\n--- Import Complete ---\n"
            f"Total cards processed (imported or updated): {processed_card_count}"
        ))
