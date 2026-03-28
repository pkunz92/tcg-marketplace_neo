"""
Enriches Card_Master and Set_Master records with detailed data from
pokemontcg.io's GitHub data dump.

Run download_pokemontcg_data first to get the JSON files.

This fills in: rarity, supertype, subtypes, hp, types, attacks, abilities,
weaknesses, resistances, retreat_cost, artist, flavor_text, legalities,
regulation_mark, rules, evolves_from, evolves_to, national_pokedex_numbers.

Also enriches Set_Master with: release_date, series, symbol_url, logo_url,
legalities, printed_total.
"""

import json
from datetime import datetime
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import transaction
from api.models import Card_Master, Set_Master


class Command(BaseCommand):
    help = 'Enriches cards and sets with detailed data from pokemontcg.io GitHub dump.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--sets-only',
            action='store_true',
            help='Only enrich sets, skip cards.',
        )
        parser.add_argument(
            '--cards-only',
            action='store_true',
            help='Only enrich cards, skip sets.',
        )

    def handle(self, *args, **options):
        base_dir = Path(settings.BASE_DIR) / 'api' / 'data' / 'pokemontcg'
        sets_path = base_dir / 'sets' / 'en.json'
        cards_dir = base_dir / 'cards' / 'en'

        if not sets_path.exists():
            self.stdout.write(self.style.ERROR(
                f'pokemontcg.io data not found at {base_dir}. '
                f'Run: python manage.py download_pokemontcg_data'
            ))
            return

        if not options['cards_only']:
            self._enrich_sets(sets_path)

        if not options['sets_only']:
            self._enrich_cards(cards_dir)

    def _parse_date(self, date_str):
        if not date_str:
            return None
        for fmt in ['%Y/%m/%d', '%Y-%m-%d']:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return None

    def _enrich_sets(self, sets_path):
        self.stdout.write(self.style.NOTICE('--- Enriching Set Master data ---'))

        with open(sets_path, 'r', encoding='utf-8') as f:
            sets_data = json.load(f)

        enriched = 0
        created = 0

        for set_info in sets_data:
            set_code = set_info.get('id')
            if not set_code:
                continue

            images = set_info.get('images', {})
            legalities = set_info.get('legalities', {})

            obj, was_created = Set_Master.objects.update_or_create(
                set_code=set_code,
                defaults={
                    'set_name': set_info.get('name', ''),
                    'total_cards': set_info.get('total', 0),
                    'printed_total': set_info.get('printedTotal', 0),
                    'ptcgo_code': set_info.get('ptcgoCode', '') or '',
                    'series': set_info.get('series', '') or '',
                    'release_date': self._parse_date(set_info.get('releaseDate')),
                    'symbol_url': images.get('symbol', ''),
                    'logo_url': images.get('logo', ''),
                    'legalities': legalities,
                },
            )

            if was_created:
                created += 1
            else:
                enriched += 1

        self.stdout.write(self.style.SUCCESS(
            f'Sets: {enriched} enriched, {created} newly created. '
            f'Total in pokemontcg.io data: {len(sets_data)}'
        ))

    def _enrich_cards(self, cards_dir):
        self.stdout.write(self.style.NOTICE('\n--- Enriching Card Master data ---'))

        json_files = sorted(cards_dir.glob('*.json'))
        if not json_files:
            self.stdout.write(self.style.ERROR(f'No card JSON files found in {cards_dir}'))
            return

        self.stdout.write(f'Found {len(json_files)} set files to process.')

        total_enriched = 0
        total_created = 0
        total_skipped = 0
        rarity_fixed = 0

        # Pre-load set lookup
        set_lookup = {s.set_code: s for s in Set_Master.objects.all()}

        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    cards_data = json.load(f)

                if not isinstance(cards_data, list):
                    continue

                file_enriched = 0
                file_created = 0

                with transaction.atomic():
                    for card in cards_data:
                        api_id = card.get('id')
                        if not api_id:
                            continue

                        # Extract set code from card ID
                        set_code = api_id.rsplit('-', 1)[0] if '-' in api_id else None
                        set_obj = set_lookup.get(set_code) if set_code else None

                        # Build defaults dict with all enrichment data
                        defaults = self._build_card_defaults(card, set_obj)

                        try:
                            existing = Card_Master.objects.filter(api_id=api_id).first()
                            if existing:
                                # Update existing card with enrichment data
                                updated = False
                                for field, value in defaults.items():
                                    old_value = getattr(existing, field)
                                    # Only update if the new value is non-empty and old is empty/default
                                    if field == 'card_rarity':
                                        if old_value in ('Unknown', '', None) and value and value != 'Unknown':
                                            setattr(existing, field, value)
                                            rarity_fixed += 1
                                            updated = True
                                        elif value and value != 'Unknown':
                                            setattr(existing, field, value)
                                            updated = True
                                    elif field in ('attacks', 'abilities', 'weaknesses', 'resistances',
                                                   'types', 'subtypes', 'national_pokedex_numbers',
                                                   'evolves_to', 'rules'):
                                        if value:  # Only update if we have data
                                            setattr(existing, field, value)
                                            updated = True
                                    elif field == 'legalities':
                                        if value:
                                            setattr(existing, field, value)
                                            updated = True
                                    else:
                                        if value not in ('', None, 0) and (not old_value or old_value in ('', None, 0)):
                                            setattr(existing, field, value)
                                            updated = True

                                if updated:
                                    existing.save()
                                    file_enriched += 1
                            else:
                                # Create new card
                                defaults['api_id'] = api_id
                                Card_Master.objects.create(**defaults)
                                file_created += 1
                        except Exception as e:
                            total_skipped += 1
                            continue

                total_enriched += file_enriched
                total_created += file_created
                self.stdout.write(
                    f'  {json_file.name}: {file_enriched} enriched, {file_created} created'
                )

            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'  Error processing {json_file.name}: {e}'
                ))

        self.stdout.write(self.style.SUCCESS(
            f'\n--- Card Enrichment Complete ---\n'
            f'Enriched: {total_enriched}\n'
            f'Newly created: {total_created}\n'
            f'Rarity fixed (was "Unknown"): {rarity_fixed}\n'
            f'Skipped (errors): {total_skipped}'
        ))

    def _build_card_defaults(self, card, set_obj):
        """Build a dict of card field values from pokemontcg.io card object."""
        images = card.get('images', {})

        # Build secondary ID if we have set info
        secondary_id = None
        if set_obj:
            ptcgo = set_obj.ptcgo_code.upper() if set_obj.ptcgo_code else set_obj.set_code.upper()
            number = card.get('number', '')
            name = card.get('name', '')
            total = set_obj.total_cards
            secondary_id = f"{ptcgo} {number}/{total} {name}"

        return {
            'set': set_obj,
            'card_name': card.get('name', ''),
            'card_number': card.get('number', ''),
            'secondary_id': secondary_id,
            'card_rarity': card.get('rarity', 'Unknown') or 'Unknown',
            'image_url': images.get('large', '') or images.get('small', ''),
            'supertype': card.get('supertype', ''),
            'subtypes': card.get('subtypes', []) or [],
            'hp': card.get('hp', ''),
            'types': card.get('types', []) or [],
            'evolves_from': card.get('evolvesFrom', ''),
            'evolves_to': card.get('evolvesTo', []) or [],
            'attacks': card.get('attacks', []) or [],
            'abilities': card.get('abilities', []) or [],
            'weaknesses': card.get('weaknesses', []) or [],
            'resistances': card.get('resistances', []) or [],
            'retreat_cost': card.get('convertedRetreatCost'),
            'artist': card.get('artist', ''),
            'flavor_text': card.get('flavorText', ''),
            'national_pokedex_numbers': card.get('nationalPokedexNumbers', []) or [],
            'legalities': card.get('legalities', {}) or {},
            'regulation_mark': card.get('regulationMark', ''),
            'rules': card.get('rules', []) or [],
        }
