"""
Fetches pricing data from pokemontcg.io REST API using requests directly.

Uses the REST API instead of the SDK to avoid strict field validation
(e.g. missing tcgplayer.updatedAt on some cards crashing the SDK).

Rate limits: 30 requests/minute with API key (20K/day).
Uses pageSize=250 to minimise request count (~82 pages for all cards).

Designed to be run as a cron job for regular price updates.
"""

import time
import logging
import requests
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import transaction
from api.models import Card_Master, CardPrice, CardPriceHistory

logger = logging.getLogger(__name__)

API_BASE = "https://api.pokemontcg.io/v2/cards"
REQUEST_DELAY = 2.1  # seconds between requests (~28 req/min, under the 30/min limit)


def _fetch_page(api_key, page, page_size, set_filter):
    """Fetch one page from the pokemontcg.io REST API. Returns list of card dicts or None on failure."""
    headers = {"X-Api-Key": api_key}
    params = {"page": page, "pageSize": page_size}
    if set_filter:
        params["q"] = f"set.id:{set_filter}"

    for attempt in range(3):
        try:
            r = requests.get(API_BASE, headers=headers, params=params, timeout=30)
            if r.status_code == 200:
                return r.json().get("data", [])
            if r.status_code == 429:
                time.sleep(10 * (attempt + 1))
                continue
            logger.warning("HTTP %s on page %s", r.status_code, page)
            return None
        except requests.RequestException as exc:
            wait = 5 * (attempt + 1)
            logger.warning("Request error page %s: %s. Retrying in %ss", page, exc, wait)
            time.sleep(wait)
    return None


def _upsert_tcgplayer(card_id, tcgplayer):
    count = 0
    prices = tcgplayer.get("prices") or {}
    for variant, pdata in prices.items():
        if not isinstance(pdata, dict):
            continue
        low    = pdata.get("low")
        mid    = pdata.get("mid")
        high   = pdata.get("high")
        market = pdata.get("market")
        direct = pdata.get("directLow")
        if not any(v is not None for v in [low, mid, high, market, direct]):
            continue
        CardPrice.objects.update_or_create(
            card_master_id=card_id,
            source="tcgplayer",
            variant=variant,
            defaults={"currency": "USD", "low": low, "mid": mid,
                      "high": high, "market": market, "direct_low": direct},
        )
        CardPriceHistory.objects.create(
            card_master_id=card_id,
            source="tcgplayer", variant=variant, currency="USD",
            low=low, mid=mid, high=high, market=market,
        )
        count += 1
    return count


def _upsert_cardmarket(card_id, cardmarket):
    prices = cardmarket.get("prices") or {}
    avg_sell = prices.get("averageSellPrice")
    low      = prices.get("lowPrice")
    trend    = prices.get("trendPrice")
    if not any(v is not None for v in [avg_sell, low, trend]):
        return 0
    CardPrice.objects.update_or_create(
        card_master_id=card_id,
        source="cardmarket",
        variant="normal",
        defaults={"currency": "EUR", "low": low, "mid": avg_sell,
                  "high": None, "market": trend, "direct_low": None},
    )
    CardPriceHistory.objects.create(
        card_master_id=card_id,
        source="cardmarket", variant="normal", currency="EUR",
        low=low, mid=avg_sell, high=None, market=trend,
    )
    return 1


class Command(BaseCommand):
    help = "Fetches card prices from pokemontcg.io REST API into CardPrice table."

    def add_arguments(self, parser):
        parser.add_argument("--set", dest="set_filter", type=str,
                            help='Only fetch prices for this set (e.g. "sv3pt5").')
        parser.add_argument("--limit", type=int, default=0,
                            help="Stop after this many pages (0 = all).")
        parser.add_argument("--page-size", type=int, default=250,
                            help="Cards per API page (max 250).")
        parser.add_argument("--start-page", type=int, default=1,
                            help="Resume from this page number.")

    def handle(self, *args, **options):
        api_key = getattr(settings, "POKEMON_TCG_API_KEY", None)
        if not api_key:
            self.stdout.write(self.style.ERROR(
                "POKEMON_TCG_API_KEY not set. Get a free key at https://dev.pokemontcg.io/"
            ))
            return

        set_filter = options["set_filter"]
        page_limit = options["limit"]
        page_size  = min(options["page_size"], 250)
        page       = options["start_page"]

        self.stdout.write(self.style.NOTICE("--- Fetching prices from pokemontcg.io API ---"))
        if set_filter:
            self.stdout.write(f"Filtering by set: {set_filter}")
        if page > 1:
            self.stdout.write(f"Resuming from page {page}.")

        total_cards = total_prices = total_pages = 0

        # Pre-load our card IDs into a set for fast membership checks
        our_ids = set(Card_Master.objects.values_list("api_id", flat=True))
        self.stdout.write(f"Loaded {len(our_ids)} card IDs from DB.")

        while True:
            if page_limit and page > page_limit:
                self.stdout.write(f"Reached page limit ({page_limit}).")
                break

            self.stdout.write(f"Fetching page {page} (pageSize={page_size})...")
            cards = _fetch_page(api_key, page, page_size, set_filter)

            if cards is None:
                self.stdout.write(self.style.WARNING(f"  Page {page} failed — skipping."))
                page += 1
                time.sleep(REQUEST_DELAY)
                continue

            if not cards:
                self.stdout.write("No more cards. Done.")
                break

            prices_in_page = 0
            with transaction.atomic():
                for card in cards:
                    card_id = card.get("id")
                    if not card_id or card_id not in our_ids:
                        continue
                    if tcgplayer := card.get("tcgplayer"):
                        prices_in_page += _upsert_tcgplayer(card_id, tcgplayer)
                    if cardmarket := card.get("cardmarket"):
                        prices_in_page += _upsert_cardmarket(card_id, cardmarket)
                    total_cards += 1

            total_prices += prices_in_page
            total_pages  += 1
            self.stdout.write(
                f"  Page {page}: {len(cards)} cards, {prices_in_page} price rows upserted."
            )

            if len(cards) < page_size:
                self.stdout.write("Reached last page. Done.")
                break

            page += 1
            time.sleep(REQUEST_DELAY)

        self.stdout.write(self.style.SUCCESS(
            f"\n--- Price Fetch Complete ---\n"
            f"Pages fetched      : {total_pages}\n"
            f"Cards with prices  : {total_cards}\n"
            f"Price rows upserted: {total_prices}"
        ))
