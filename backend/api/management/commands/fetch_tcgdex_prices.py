"""
Fetches pricing data from TCGdex API (https://api.tcgdex.net/v2).

TCGdex provides Cardmarket prices (EUR) for Pokemon TCG cards.
No API key required — fully free.

Strategy:
  1. Fetch all sets from TCGdex to build a mapping:
       pokemontcg-set-code → tcgdex-set-id
     (matched by set name and release date)
  2. For each card in our DB, construct the TCGdex card ID as
       {tcgdex_set_id}-{card_number}
     then fetch price data from the card endpoint.
  3. Upsert into CardPrice with source='cardmarket', currency='EUR'.

Run as a cron job for regular price updates.
"""

import time
import logging
import requests
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import Card_Master, CardPrice, Set_Master

logger = logging.getLogger(__name__)

TCGDEX_BASE = "https://api.tcgdex.net/v2/en"
REQUEST_DELAY = 0.15   # seconds between card requests (~6/s — polite ceiling)
BATCH_DELAY   = 1.0    # extra pause between set batches


def _get(url, timeout=15):
    """GET with basic retry on transient errors."""
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
            if r.status_code == 429:
                wait = 10 * (attempt + 1)
                logger.warning("Rate-limited by TCGdex. Waiting %ss…", wait)
                time.sleep(wait)
                continue
            logger.warning("TCGdex %s → HTTP %s", url, r.status_code)
            return None
        except requests.exceptions.RequestException as exc:
            wait = 3 * (attempt + 1)
            logger.warning("Request error (%s). Retrying in %ss…", exc, wait)
            time.sleep(wait)
    return None


def _build_set_mapping():
    """
    Fetch all sets from TCGdex and match them to our Set_Master rows.
    Returns dict: our_set_code → tcgdex_set_id
    """
    data = _get(f"{TCGDEX_BASE}/sets")
    if not data:
        return {}

    # Index TCGdex sets by normalised name and by release date
    tcgdex_by_name = {}
    tcgdex_by_date = {}
    for s in data:
        sid   = s.get("id", "")
        sname = (s.get("name") or "").strip().lower()
        sdate = (s.get("releaseDate") or "")[:10]   # "YYYY/MM/DD" → "YYYY/MM/DD"
        if sname:
            tcgdex_by_name[sname] = sid
        if sdate:
            tcgdex_by_date.setdefault(sdate, []).append(sid)

    mapping = {}
    for our_set in Set_Master.objects.all():
        # Try exact name match first
        our_name = our_set.set_name.strip().lower()
        if our_name in tcgdex_by_name:
            mapping[our_set.set_code] = tcgdex_by_name[our_name]
            continue

        # Try matching by release date when only one TCGdex set has that date
        if our_set.release_date:
            # pokemontcg.io stores dates as YYYY/MM/DD; convert our date field
            our_date = str(our_set.release_date)   # "YYYY-MM-DD"
            # TCGdex might store as "YYYY/MM/DD" or "YYYY-MM-DD"
            candidates = (
                tcgdex_by_date.get(our_date, []) +
                tcgdex_by_date.get(our_date.replace("-", "/"), [])
            )
            if len(candidates) == 1:
                mapping[our_set.set_code] = candidates[0]
                continue

        # Last resort: use our own set_code (often identical for modern sets)
        mapping[our_set.set_code] = our_set.set_code

    return mapping


def _extract_prices(card_data):
    """
    Extract Cardmarket price fields from a TCGdex card response.
    Returns a list of dicts suitable for CardPrice.update_or_create.
    Each dict has: variant, low, mid, high, market
    """
    prices = card_data.get("prices") or {}
    results = []

    # TCGdex price structure (Cardmarket):
    # {
    #   "normal":  { "low": x, "avg1": x, "avg7": x, "avg30": x, "averageSellPrice": x, "trendPrice": x },
    #   "holo":    { ... },
    #   "reverse": { ... },
    #   "firstEd": { ... }
    # }
    if not prices:
        return results

    for variant, pdata in prices.items():
        if not isinstance(pdata, dict):
            continue
        low     = pdata.get("low")
        avg_sell = pdata.get("averageSellPrice")
        trend   = pdata.get("trendPrice")
        avg7    = pdata.get("avg7")

        if not any(v is not None for v in [low, avg_sell, trend]):
            continue

        results.append({
            "variant": variant,
            "low":     float(low)      if low      is not None else None,
            "mid":     float(avg_sell) if avg_sell is not None else None,
            "high":    float(avg7)     if avg7     is not None else None,
            "market":  float(trend)    if trend    is not None else None,
        })

    return results


class Command(BaseCommand):
    help = "Fetches Cardmarket prices from TCGdex API into CardPrice table."

    def add_arguments(self, parser):
        parser.add_argument(
            "--set",
            dest="set_code",
            type=str,
            help="Only fetch prices for cards in this set (our set_code, e.g. 'sv3pt5').",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Stop after processing this many cards (0 = all).",
        )
        parser.add_argument(
            "--skip-mapping",
            action="store_true",
            help="Skip TCGdex set-fetch step and use our set_code as TCGdex set ID directly.",
        )

    def handle(self, *args, **options):
        set_filter   = options["set_code"]
        card_limit   = options["limit"]
        skip_mapping = options["skip_mapping"]

        self.stdout.write(self.style.NOTICE("--- TCGdex Price Fetch ---"))

        # 1. Build set mapping
        if skip_mapping:
            self.stdout.write("Skipping set mapping — using our set codes as TCGdex IDs.")
            set_mapping = {}
        else:
            self.stdout.write("Building pokemontcg → TCGdex set-ID mapping…")
            set_mapping = _build_set_mapping()
            self.stdout.write(f"  Mapped {len(set_mapping)} sets.")

        # 2. Build card queryset
        qs = Card_Master.objects.select_related("set").order_by("set__release_date", "card_number")
        if set_filter:
            qs = qs.filter(set__set_code=set_filter)
            self.stdout.write(f"Filtering to set: {set_filter}")
        if card_limit:
            qs = qs[:card_limit]

        total = qs.count() if not card_limit else min(qs.count(), card_limit)
        self.stdout.write(f"Processing {total} cards…\n")

        processed = 0
        skipped   = 0
        upserted  = 0
        not_found = 0
        current_set = None

        for card in qs.iterator():
            our_code   = card.set.set_code if card.set else ""
            tcgdex_sid = set_mapping.get(our_code, our_code)
            tcgdex_cid = f"{tcgdex_sid}-{card.card_number}"

            # Log set transitions
            if our_code != current_set:
                if current_set is not None:
                    time.sleep(BATCH_DELAY)
                current_set = our_code
                self.stdout.write(
                    f"Set: {card.set.set_name} ({our_code}) → TCGdex ID: {tcgdex_sid}"
                )

            url = f"{TCGDEX_BASE}/cards/{tcgdex_cid}"
            card_data = _get(url)

            if card_data is None:
                not_found += 1
                time.sleep(REQUEST_DELAY)
                continue

            price_rows = _extract_prices(card_data)

            if not price_rows:
                skipped += 1
                time.sleep(REQUEST_DELAY)
                continue

            with transaction.atomic():
                for row in price_rows:
                    CardPrice.objects.update_or_create(
                        card_master_id=card.api_id,
                        source="cardmarket",
                        variant=row["variant"],
                        defaults={
                            "currency":   "EUR",
                            "low":        row["low"],
                            "mid":        row["mid"],
                            "high":       row["high"],
                            "market":     row["market"],
                            "direct_low": None,
                        },
                    )
                    upserted += 1

            processed += 1
            time.sleep(REQUEST_DELAY)

        self.stdout.write(self.style.SUCCESS(
            f"\n--- Done ---\n"
            f"Cards with prices : {processed}\n"
            f"Cards without data: {skipped}\n"
            f"Cards not on TCGdex: {not_found}\n"
            f"Price rows upserted: {upserted}"
        ))
