"""
Fetches pricing data from pokemontcg.io API.

The static GitHub JSON does NOT include prices — this command uses the
pokemontcg.io REST API to fetch TCGPlayer and Cardmarket prices for all cards.

Rate limits: 30 requests/minute with API key (20K/day).
Uses pagination (pageSize=250) to minimize request count.

Designed to be run as a cron job for regular price updates.
"""

import time
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import transaction
from api.models import Card_Master, CardPrice

logger = logging.getLogger(__name__)

# Rate limit: 30 requests per minute
REQUEST_DELAY = 2.1  # seconds between requests (slightly over 2s = ~28 req/min)


class Command(BaseCommand):
    help = 'Fetches card prices from pokemontcg.io API into CardPrice table.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--set',
            type=str,
            help='Only fetch prices for cards in this set (e.g., "base1").',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help='Limit number of API pages to fetch (0 = all).',
        )
        parser.add_argument(
            '--page-size',
            type=int,
            default=250,
            help='Number of cards per API page (max 250).',
        )
        parser.add_argument(
            '--start-page',
            type=int,
            default=1,
            help='Resume from this page number (useful after a crash).',
        )

    def handle(self, *args, **options):
        try:
            from pokemontcgsdk import RestClient, Card
        except ImportError:
            self.stdout.write(self.style.ERROR(
                'pokemontcgsdk not installed. Run: pip install pokemontcgsdk'
            ))
            return

        api_key = getattr(settings, 'POKEMON_TCG_API_KEY', None)
        if not api_key:
            self.stdout.write(self.style.ERROR(
                'POKEMON_TCG_API_KEY not set in settings/environment. '
                'Get a free key at https://dev.pokemontcg.io/'
            ))
            return

        RestClient.configure(api_key)

        set_filter = options['set']
        page_limit = options['limit']
        page_size = min(options['page_size'], 250)
        start_page = options['start_page']

        self.stdout.write(self.style.NOTICE('--- Fetching prices from pokemontcg.io API ---'))
        if set_filter:
            self.stdout.write(f'Filtering by set: {set_filter}')
        if start_page > 1:
            self.stdout.write(f'Resuming from page {start_page}.')

        page = start_page
        total_cards_processed = 0
        total_prices_upserted = 0
        total_pages = 0

        while True:
            if page_limit and page > page_limit:
                self.stdout.write(f'Reached page limit ({page_limit}). Stopping.')
                break

            self.stdout.write(f'Fetching page {page} (pageSize={page_size})...')

            try:
                query = f'set.id:{set_filter}' if set_filter else ''
                cards = Card.where(q=query, page=page, pageSize=page_size) if query else Card.where(page=page, pageSize=page_size)

                if not cards:
                    self.stdout.write('No more cards. Done.')
                    break

                prices_in_page = 0

                with transaction.atomic():
                    for card in cards:
                        card_id = card.id

                        # Check if this card exists in our DB
                        if not Card_Master.objects.filter(api_id=card_id).exists():
                            continue

                        # Extract TCGPlayer prices
                        tcgplayer = getattr(card, 'tcgplayer', None)
                        if tcgplayer:
                            prices_dict = getattr(tcgplayer, 'prices', None)
                            if prices_dict:
                                for variant_name in dir(prices_dict):
                                    if variant_name.startswith('_'):
                                        continue
                                    variant_data = getattr(prices_dict, variant_name, None)
                                    if variant_data is None:
                                        continue
                                    # Check if it has price attributes
                                    low = getattr(variant_data, 'low', None)
                                    mid = getattr(variant_data, 'mid', None)
                                    high = getattr(variant_data, 'high', None)
                                    market_price = getattr(variant_data, 'market', None)
                                    direct = getattr(variant_data, 'directLow', None)

                                    if any(v is not None for v in [low, mid, high, market_price, direct]):
                                        CardPrice.objects.update_or_create(
                                            card_master_id=card_id,
                                            source='tcgplayer',
                                            variant=variant_name,
                                            defaults={
                                                'currency': 'USD',
                                                'low': low,
                                                'mid': mid,
                                                'high': high,
                                                'market': market_price,
                                                'direct_low': direct,
                                            },
                                        )
                                        prices_in_page += 1

                        # Extract Cardmarket prices
                        cardmarket = getattr(card, 'cardmarket', None)
                        if cardmarket:
                            cm_prices = getattr(cardmarket, 'prices', None)
                            if cm_prices:
                                avg_sell = getattr(cm_prices, 'averageSellPrice', None)
                                low_price = getattr(cm_prices, 'lowPrice', None)
                                trend = getattr(cm_prices, 'trendPrice', None)
                                avg1 = getattr(cm_prices, 'avg1', None)
                                avg7 = getattr(cm_prices, 'avg7', None)
                                avg30 = getattr(cm_prices, 'avg30', None)

                                if any(v is not None for v in [avg_sell, low_price, trend]):
                                    CardPrice.objects.update_or_create(
                                        card_master_id=card_id,
                                        source='cardmarket',
                                        variant='normal',
                                        defaults={
                                            'currency': 'EUR',
                                            'low': low_price,
                                            'mid': avg_sell,
                                            'high': None,
                                            'market': trend,
                                            'direct_low': None,
                                        },
                                    )
                                    prices_in_page += 1

                        total_cards_processed += 1

                total_prices_upserted += prices_in_page
                total_pages += 1
                self.stdout.write(
                    f'  Page {page}: processed {len(cards)} cards, '
                    f'{prices_in_page} price entries upserted.'
                )

                # Check if we got fewer cards than page_size (last page)
                if len(cards) < page_size:
                    self.stdout.write('Reached last page. Done.')
                    break

                page += 1
                time.sleep(REQUEST_DELAY)

            except Exception as e:
                # SDK exception __str__ can return bytes — handle safely
                err_msg = e.args[0].decode('utf-8', errors='replace') if e.args and isinstance(e.args[0], bytes) else str(e)
                self.stdout.write(self.style.ERROR(f'Error on page {page}: {err_msg}'))
                wait = min(30.0, REQUEST_DELAY * (2 ** min(page % 5, 4)))
                self.stdout.write(f'Waiting {wait:.1f}s before retry...')
                time.sleep(wait)
                continue

        self.stdout.write(self.style.SUCCESS(
            f'\n--- Price Fetch Complete ---\n'
            f'Pages fetched: {total_pages}\n'
            f'Cards processed: {total_cards_processed}\n'
            f'Price entries upserted: {total_prices_upserted}'
        ))
