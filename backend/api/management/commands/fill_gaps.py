"""
Fills gaps in the card database by fetching missing cards/sets from
pokemontcg.io API and TCGdex API.

Run verify_database first to identify what's missing.
"""

import time
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from api.models import Card_Master, Set_Master


REQUEST_DELAY = 2.1  # 30 req/min limit


class Command(BaseCommand):
    help = 'Fills missing cards and sets from pokemontcg.io API.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix-rarity',
            action='store_true',
            help='Fetch cards that still have rarity="Unknown" from the API.',
        )
        parser.add_argument(
            '--fill-sets',
            action='store_true',
            help='Fetch cards for sets where actual count < total_cards.',
        )
        parser.add_argument(
            '--set',
            type=str,
            help='Only fill gaps for a specific set code.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Only report gaps, do not fetch.',
        )

    def handle(self, *args, **options):
        try:
            from pokemontcgsdk import RestClient, Card, Set as PokemonSet
        except ImportError:
            self.stdout.write(self.style.ERROR(
                'pokemontcgsdk not installed. Run: pip install pokemontcgsdk'
            ))
            return

        api_key = getattr(settings, 'POKEMON_TCG_API_KEY', None)
        if not api_key:
            self.stdout.write(self.style.ERROR('POKEMON_TCG_API_KEY not set.'))
            return

        RestClient.configure(api_key)

        if options['fix_rarity']:
            self._fix_rarity(Card, options['dry_run'], options.get('set'))

        if options['fill_sets']:
            self._fill_incomplete_sets(Card, options['dry_run'], options.get('set'))

        if not options['fix_rarity'] and not options['fill_sets']:
            self.stdout.write('No action specified. Use --fix-rarity and/or --fill-sets.')

    def _fix_rarity(self, Card, dry_run, set_filter=None):
        """Fetch cards that have rarity='Unknown' and try to get real rarity."""
        self.stdout.write(self.style.NOTICE('\n--- Fixing Unknown Rarity ---'))

        queryset = Card_Master.objects.filter(
            Q(card_rarity='Unknown') | Q(card_rarity='') | Q(card_rarity__isnull=True)
        )
        if set_filter:
            queryset = queryset.filter(set__set_code=set_filter)

        unknown_count = queryset.count()
        self.stdout.write(f'Cards with Unknown rarity: {unknown_count}')

        if dry_run or unknown_count == 0:
            return

        # Process by set to minimize API calls
        sets_with_unknown = (
            queryset
            .values('set__set_code')
            .annotate(count=Count('api_id'))
            .order_by('-count')
        )

        total_fixed = 0
        for set_info in sets_with_unknown:
            set_code = set_info['set__set_code']
            if not set_code:
                continue

            self.stdout.write(f'  Fetching set {set_code}...')

            try:
                api_cards = Card.where(q=f'set.id:{set_code}', pageSize=250)
                api_lookup = {c.id: c for c in api_cards}

                cards_to_fix = queryset.filter(set__set_code=set_code)
                fixed = 0

                with transaction.atomic():
                    for card in cards_to_fix:
                        api_card = api_lookup.get(card.api_id)
                        if api_card and api_card.rarity:
                            card.card_rarity = api_card.rarity
                            # Also fill other fields if missing
                            if not card.supertype and api_card.supertype:
                                card.supertype = api_card.supertype
                            if not card.hp and getattr(api_card, 'hp', None):
                                card.hp = api_card.hp
                            if not card.artist and getattr(api_card, 'artist', None):
                                card.artist = api_card.artist
                            card.save()
                            fixed += 1

                total_fixed += fixed
                self.stdout.write(f'    Fixed {fixed} cards in {set_code}')
                time.sleep(REQUEST_DELAY)

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'    Error: {e}'))
                time.sleep(REQUEST_DELAY * 2)

        self.stdout.write(self.style.SUCCESS(f'Total rarity fixes: {total_fixed}'))

    def _fill_incomplete_sets(self, Card, dry_run, set_filter=None):
        """Fetch missing cards for sets where actual count < total_cards."""
        self.stdout.write(self.style.NOTICE('\n--- Filling Incomplete Sets ---'))

        sets_query = (
            Set_Master.objects
            .annotate(actual_cards=Count('cards'))
            .filter(total_cards__gt=0)
        )

        if set_filter:
            sets_query = sets_query.filter(set_code=set_filter)

        incomplete_sets = [
            s for s in sets_query
            if s.actual_cards < s.total_cards
        ]

        self.stdout.write(f'Incomplete sets: {len(incomplete_sets)}')

        if dry_run:
            for s in incomplete_sets[:20]:
                gap = s.total_cards - s.actual_cards
                self.stdout.write(
                    f'  {s.set_code} ({s.set_name}): {s.actual_cards}/{s.total_cards} (missing {gap})'
                )
            return

        total_added = 0
        for s in incomplete_sets:
            gap = s.total_cards - s.actual_cards
            self.stdout.write(f'  Filling {s.set_code} ({s.set_name}): missing {gap} cards...')

            try:
                api_cards = Card.where(q=f'set.id:{s.set_code}', pageSize=250)
                existing_ids = set(
                    Card_Master.objects
                    .filter(set=s)
                    .values_list('api_id', flat=True)
                )

                added = 0
                with transaction.atomic():
                    for api_card in api_cards:
                        if api_card.id not in existing_ids:
                            images = getattr(api_card, 'images', None)
                            image_url = ''
                            if images:
                                image_url = getattr(images, 'large', '') or getattr(images, 'small', '')

                            ptcgo = s.ptcgo_code.upper() if s.ptcgo_code else s.set_code.upper()
                            number = getattr(api_card, 'number', '')
                            name = getattr(api_card, 'name', '')
                            secondary_id = f"{ptcgo} {number}/{s.total_cards} {name}"

                            Card_Master.objects.create(
                                api_id=api_card.id,
                                set=s,
                                card_name=name,
                                card_number=number,
                                secondary_id=secondary_id,
                                card_rarity=getattr(api_card, 'rarity', 'Unknown') or 'Unknown',
                                image_url=image_url,
                                supertype=getattr(api_card, 'supertype', ''),
                                subtypes=getattr(api_card, 'subtypes', []) or [],
                                hp=getattr(api_card, 'hp', ''),
                                types=getattr(api_card, 'types', []) or [],
                                evolves_from=getattr(api_card, 'evolvesFrom', ''),
                                attacks=getattr(api_card, 'attacks', []) or [],
                                abilities=getattr(api_card, 'abilities', []) or [],
                                weaknesses=getattr(api_card, 'weaknesses', []) or [],
                                resistances=getattr(api_card, 'resistances', []) or [],
                                retreat_cost=getattr(api_card, 'convertedRetreatCost', None),
                                artist=getattr(api_card, 'artist', ''),
                                flavor_text=getattr(api_card, 'flavorText', ''),
                                legalities=getattr(api_card, 'legalities', {}) or {},
                                regulation_mark=getattr(api_card, 'regulationMark', ''),
                            )
                            added += 1

                total_added += added
                self.stdout.write(f'    Added {added} new cards')
                time.sleep(REQUEST_DELAY)

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'    Error: {e}'))
                time.sleep(REQUEST_DELAY * 2)

        self.stdout.write(self.style.SUCCESS(f'Total cards added: {total_added}'))
