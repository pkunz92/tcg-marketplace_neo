"""
Imports multi-language card and set data from existing JSON files
(fetched by fetch_multi_language_data.py) into CardTranslation and
SetTranslation database tables.

Card matching: TCGdex uses identical card IDs across all languages
(e.g., "base1-1" is the same card in every language).
"""

import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import transaction
from api.models import Card_Master, Set_Master, CardTranslation, SetTranslation


class Command(BaseCommand):
    help = 'Imports translations from JSON files into CardTranslation and SetTranslation tables.'

    LANGUAGES = {
        'ja': 'Japanese',
        'de': 'German',
        'fr': 'French',
        'it': 'Italian',
        'zh-cn': 'Simplified Chinese',
    }

    def add_arguments(self, parser):
        parser.add_argument(
            '--lang',
            nargs='+',
            type=str,
            help='Only import specific languages (e.g., --lang ja de).',
        )

    def handle(self, *args, **options):
        base_dir = Path(settings.BASE_DIR) / 'api' / 'data'
        cards_dir = base_dir / 'raw_cards'
        sets_dir = base_dir / 'sets'

        requested_langs = options.get('lang')
        languages = {}
        if requested_langs:
            for lang in requested_langs:
                if lang in self.LANGUAGES:
                    languages[lang] = self.LANGUAGES[lang]
                else:
                    self.stdout.write(self.style.WARNING(
                        f'Unknown language code: {lang}. '
                        f'Available: {", ".join(self.LANGUAGES.keys())}'
                    ))
        else:
            languages = self.LANGUAGES

        if not languages:
            self.stdout.write(self.style.ERROR('No valid languages specified.'))
            return

        for lang_code, lang_name in languages.items():
            self.stdout.write(self.style.NOTICE(
                f'\n--- Importing {lang_name} ({lang_code}) translations ---'
            ))

            # Import set translations
            self._import_set_translations(sets_dir, lang_code, lang_name)

            # Import card translations
            dir_code = 'zh' if lang_code == 'zh-cn' else lang_code
            lang_cards_dir = cards_dir / dir_code
            self._import_card_translations(lang_cards_dir, lang_code, lang_name)

        self.stdout.write(self.style.SUCCESS('\n--- Translation Import Complete ---'))
        self._print_coverage_report()

    def _import_set_translations(self, sets_dir, lang_code, lang_name):
        """Import set translations from sets/{lang}.json."""
        sets_path = sets_dir / f'{lang_code}.json'
        if not sets_path.exists():
            self.stdout.write(self.style.WARNING(
                f'  No set file found: {sets_path.name}'
            ))
            return

        with open(sets_path, 'r', encoding='utf-8') as f:
            sets_data = json.load(f)

        created = 0
        updated = 0
        skipped = 0

        for set_info in sets_data:
            set_code = set_info.get('id')
            name = set_info.get('name', '')

            if not set_code or not name:
                skipped += 1
                continue

            try:
                set_obj = Set_Master.objects.get(set_code=set_code)
            except Set_Master.DoesNotExist:
                skipped += 1
                continue

            _, was_created = SetTranslation.objects.update_or_create(
                set_master=set_obj,
                language=lang_code,
                defaults={'name': name},
            )

            if was_created:
                created += 1
            else:
                updated += 1

        self.stdout.write(
            f'  Sets: {created} created, {updated} updated, {skipped} skipped'
        )

    def _import_card_translations(self, lang_cards_dir, lang_code, lang_name):
        """Import card translations from raw_cards/{lang}/*.json."""
        if not lang_cards_dir.exists():
            self.stdout.write(self.style.WARNING(
                f'  No card directory found: {lang_cards_dir}'
            ))
            return

        json_files = sorted(lang_cards_dir.glob('*.json'))
        if not json_files:
            self.stdout.write(self.style.WARNING(
                f'  No JSON files found in {lang_cards_dir}'
            ))
            return

        total_created = 0
        total_updated = 0
        total_skipped = 0
        total_new_cards = 0

        # Pre-load existing card IDs for fast lookup
        existing_card_ids = set(
            Card_Master.objects.values_list('api_id', flat=True)
        )

        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    cards_data = json.load(f)

                if not isinstance(cards_data, list):
                    continue

                with transaction.atomic():
                    for card in cards_data:
                        api_id = card.get('id')
                        name = card.get('name', '')
                        image_url = card.get('images', {}).get('large', '') or ''

                        if not api_id or not name:
                            total_skipped += 1
                            continue

                        if api_id in existing_card_ids:
                            # Card exists — create/update translation
                            _, was_created = CardTranslation.objects.update_or_create(
                                card_master_id=api_id,
                                language=lang_code,
                                defaults={
                                    'name': name,
                                    'image_url': image_url,
                                },
                            )
                            if was_created:
                                total_created += 1
                            else:
                                total_updated += 1
                        else:
                            # Language-exclusive card — create Card_Master + translation
                            set_code = api_id.rsplit('-', 1)[0] if '-' in api_id else None
                            set_obj = None
                            if set_code:
                                try:
                                    set_obj = Set_Master.objects.get(set_code=set_code)
                                except Set_Master.DoesNotExist:
                                    pass

                            card_number = card.get('number', '')
                            rarity = card.get('rarity', 'Unknown') or 'Unknown'

                            try:
                                Card_Master.objects.create(
                                    api_id=api_id,
                                    set=set_obj,
                                    card_name=name,
                                    card_number=card_number,
                                    card_rarity=rarity,
                                    image_url=image_url,
                                )
                                existing_card_ids.add(api_id)
                                total_new_cards += 1

                                CardTranslation.objects.create(
                                    card_master_id=api_id,
                                    language=lang_code,
                                    name=name,
                                    image_url=image_url,
                                )
                                total_created += 1
                            except Exception:
                                total_skipped += 1
                                continue

            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'  Error processing {json_file.name}: {e}'
                ))

        self.stdout.write(
            f'  Cards: {total_created} translations created, {total_updated} updated, '
            f'{total_new_cards} new cards (language-exclusive), {total_skipped} skipped'
        )

    def _print_coverage_report(self):
        """Print translation coverage summary."""
        self.stdout.write(self.style.NOTICE('\n--- Translation Coverage Report ---'))

        total_cards = Card_Master.objects.count()
        self.stdout.write(f'Total cards in database: {total_cards}')

        for lang_code, lang_name in self.LANGUAGES.items():
            count = CardTranslation.objects.filter(language=lang_code).count()
            pct = (count / total_cards * 100) if total_cards else 0
            self.stdout.write(f'  {lang_name} ({lang_code}): {count} translations ({pct:.1f}%)')

        total_sets = Set_Master.objects.count()
        self.stdout.write(f'\nTotal sets in database: {total_sets}')

        for lang_code, lang_name in self.LANGUAGES.items():
            count = SetTranslation.objects.filter(language=lang_code).count()
            pct = (count / total_sets * 100) if total_sets else 0
            self.stdout.write(f'  {lang_name} ({lang_code}): {count} translations ({pct:.1f}%)')
