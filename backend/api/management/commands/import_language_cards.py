"""
Imports language-exclusive card data (e.g. Japanese) from TCGdex JSON files
produced by fetch_multi_language_data.py.

Each non-English card gets:
  - api_id  = "{lang}-{tcgdex_id}"   e.g. "ja-base1-4"
  - language = "ja"

Each non-English set gets:
  - set_code = "{tcgdex_set_id}"
  - language  = "ja"

Run after fetch_multi_language_data.py has saved JSON files locally:
  python manage.py import_language_cards --language ja
  python manage.py import_language_cards --language fr
  python manage.py import_language_cards --language de
"""

import json
import sys
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Card_Master, Set_Master

SUPPORTED = ['ja', 'de', 'fr', 'it', 'es', 'pt', 'zh-cn', 'ko']


class Command(BaseCommand):
    help = 'Imports language-exclusive cards from TCGdex JSON files.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--language', '-l',
            required=True,
            choices=SUPPORTED,
            help='Language code to import (e.g. ja, de, fr).',
        )
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='Update existing records instead of skipping them.',
        )

    def parse_date(self, date_str):
        if not date_str:
            return None
        for fmt in ('%Y/%m/%d', '%Y-%m-%d', '%Y/%m'):
            try:
                return datetime.strptime(date_str[:len(fmt)], fmt).date()
            except ValueError:
                continue
        return None

    def handle(self, *args, **options):
        lang     = options['language']
        overwrite = options['overwrite']

        BASE_DATA_DIR = Path(settings.BASE_DIR) / 'api' / 'data'
        # fetch_multi_language_data saves to raw_cards/{lang}/ (except 'zh-cn' → 'zh')
        dir_code = 'zh' if lang == 'zh-cn' else lang
        sets_path  = BASE_DATA_DIR / 'sets' / f'{lang}.json'
        cards_dir  = BASE_DATA_DIR / 'raw_cards' / dir_code

        if not sets_path.exists():
            self.stdout.write(self.style.ERROR(
                f'Sets file not found: {sets_path}\n'
                f'Run first: python manage.py fetch_multi_language_data'
            ))
            sys.exit(1)

        if not cards_dir.is_dir():
            self.stdout.write(self.style.ERROR(
                f'Cards directory not found: {cards_dir}'
            ))
            sys.exit(1)

        self.stdout.write(self.style.NOTICE(
            f'--- Importing {lang.upper()} cards ---'
        ))

        # ── Pass 1: Sets ────────────────────────────────────────────────────
        self.stdout.write('Pass 1: Importing sets…')
        with open(sets_path, encoding='utf-8') as f:
            sets_data = json.load(f)

        sets_created = sets_updated = sets_skipped = 0
        set_lookup = {}

        for s in sets_data:
            set_code = s.get('id', '').strip()
            set_name = s.get('name', '').strip()
            if not set_code or not set_name:
                continue

            existing = Set_Master.objects.filter(set_code=set_code, language=lang).first()
            if existing and not overwrite:
                set_lookup[set_code] = existing
                sets_skipped += 1
                continue

            obj, created = Set_Master.objects.update_or_create(
                set_code=set_code,
                language=lang,
                defaults={
                    'set_name':     set_name,
                    'series':       s.get('series', '') or '',
                    'total_cards':  s.get('total', 0),
                    'ptcgo_code':   s.get('ptcgoCode', '') or '',
                    'release_date': self.parse_date(s.get('releaseDate')),
                },
            )
            set_lookup[set_code] = obj
            if created:
                sets_created += 1
            else:
                sets_updated += 1

        self.stdout.write(self.style.SUCCESS(
            f'  Sets: {sets_created} created, {sets_updated} updated, {sets_skipped} skipped.'
        ))

        # ── Pass 2: Cards ────────────────────────────────────────────────────
        self.stdout.write('Pass 2: Importing cards…')
        card_files = sorted(cards_dir.glob('*.json'))
        if not card_files:
            self.stdout.write(self.style.WARNING(
                f'No card JSON files found in {cards_dir}. '
                'Run fetch_multi_language_data first.'
            ))
            return

        cards_created = cards_updated = cards_skipped = 0

        with transaction.atomic():
            for json_file in card_files:
                try:
                    with open(json_file, encoding='utf-8') as f:
                        card_list = json.load(f)

                    if not isinstance(card_list, list):
                        continue

                    for card in card_list:
                        tcgdex_id  = (card.get('id') or '').strip()
                        card_name  = (card.get('name') or '').strip()
                        card_number = (card.get('number') or '').strip()

                        if not tcgdex_id or not card_name:
                            continue

                        # api_id uses language prefix to avoid clashing with English IDs
                        api_id = f'{lang}-{tcgdex_id}'

                        # Derive set_code from tcgdex_id (format: {setId}-{localId})
                        set_code = tcgdex_id.rsplit('-', 1)[0] if '-' in tcgdex_id else ''
                        set_obj  = set_lookup.get(set_code)
                        if not set_obj:
                            continue  # set wasn't in sets.json — skip

                        image_raw = card.get('images', {})
                        image_url = image_raw.get('large') or image_raw.get('small') or ''
                        # TCGdex returns a bare base URL (e.g. https://assets.tcgdex.net/ja/base1/base1-4)
                        # with no file extension — always append /high.webp
                        if image_url:
                            if image_url.startswith('http') and not image_url.endswith(('.webp', '.png', '.jpg')):
                                image_url = f'{image_url}/high.webp'
                            elif not image_url.startswith('http'):
                                image_url = f'https://assets.tcgdex.net/{image_url}/high.webp'

                        existing = Card_Master.objects.filter(api_id=api_id).first()
                        if existing and not overwrite:
                            cards_skipped += 1
                            continue

                        _, created = Card_Master.objects.update_or_create(
                            api_id=api_id,
                            defaults={
                                'language':    lang,
                                'set':         set_obj,
                                'card_name':   card_name,
                                'card_number': card_number,
                                'card_rarity': card.get('rarity') or 'Unknown',
                                'image_url':   image_url,
                            },
                        )
                        if created:
                            cards_created += 1
                        else:
                            cards_updated += 1

                except Exception as e:
                    self.stdout.write(self.style.ERROR(
                        f'  Error processing {json_file.name}: {e}'
                    ))

        self.stdout.write(self.style.SUCCESS(
            f'  Cards: {cards_created} created, {cards_updated} updated, {cards_skipped} skipped.'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'\n--- Done. Total {lang.upper()} cards in DB: '
            f'{Card_Master.objects.filter(language=lang).count()} ---'
        ))
