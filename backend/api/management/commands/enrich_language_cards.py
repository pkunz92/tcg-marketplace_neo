"""
Enriches non-English Card_Master records with full card data from the TCGdex REST API.

For each card in the DB with the given language, calls:
  GET https://api.tcgdex.net/v2/{lang}/cards/{tcgdex_id}

and populates: hp, types, supertype, subtypes, attacks, abilities, weaknesses,
resistances, retreat_cost, evolves_from, artist, flavor_text,
national_pokedex_numbers, regulation_mark, legalities.

Usage:
  python manage.py enrich_language_cards --language ja
  python manage.py enrich_language_cards --language ja --start-from ja-base1-50
  python manage.py enrich_language_cards --language ja --dry-run
"""

import time
import requests
from django.core.management.base import BaseCommand
from api.models import Card_Master

TCGDEX_BASE = 'https://api.tcgdex.net/v2'
REQUEST_DELAY = 0.15   # seconds between API calls
MAX_RETRIES = 3

SUPPORTED = ['ja', 'de', 'fr', 'it', 'es', 'pt', 'zh-cn', 'ko']


def _get(url, retries=MAX_RETRIES):
    """GET with simple retry/backoff. Returns parsed JSON or None."""
    for attempt in range(retries):
        try:
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 404:
                return None          # card not in TCGdex — not an error
            # Other HTTP errors — retry
        except requests.RequestException:
            pass
        if attempt < retries - 1:
            time.sleep(2 ** attempt)
    return None


def _normalize_attacks(attacks):
    """Rename TCGdex 'effect' → 'text' so the frontend renders correctly."""
    if not attacks:
        return []
    result = []
    for a in attacks:
        if not isinstance(a, dict):
            continue
        result.append({
            'name':   a.get('name', ''),
            'cost':   a.get('cost') or [],
            'damage': a.get('damage') or '',
            'text':   a.get('effect') or '',
        })
    return result


def _normalize_abilities(abilities):
    if not abilities:
        return []
    result = []
    for a in abilities:
        if not isinstance(a, dict):
            continue
        result.append({
            'name': a.get('name', ''),
            'type': a.get('type', ''),
            'text': a.get('effect') or '',
        })
    return result


def _normalize_weak_res(entries):
    if not entries:
        return []
    return [
        {'type': e.get('type', ''), 'value': e.get('value', '')}
        for e in entries if isinstance(e, dict)
    ]


def _build_subtypes(data):
    """Assemble subtypes list from TCGdex stage / trainerType / energyType."""
    subtypes = []
    stage = data.get('stage')
    if stage:
        subtypes.append(stage)
    trainer_type = data.get('trainerType')
    if trainer_type:
        subtypes.append(trainer_type)
    energy_type = data.get('energyType')
    if energy_type:
        subtypes.append(energy_type)
    return subtypes


def _supertype(data):
    """Map TCGdex 'category' to pokemontcg.io-style supertype."""
    cat = (data.get('category') or '').strip()
    mapping = {'Pokemon': 'Pokémon', 'Trainer': 'Trainer', 'Energy': 'Energy'}
    return mapping.get(cat, cat)


def _map_fields(data):
    """Return a dict of Card_Master field values extracted from TCGdex JSON."""
    raw_types = data.get('type')
    types = raw_types if isinstance(raw_types, list) else ([raw_types] if raw_types else [])

    raw_dex = data.get('dexId')
    dex_ids = raw_dex if isinstance(raw_dex, list) else ([raw_dex] if raw_dex else [])

    retreat = data.get('retreat')

    legalities_raw = data.get('legal') or {}
    legalities = {k: v for k, v in legalities_raw.items() if v}

    return {
        'hp':                       str(data['hp']) if data.get('hp') else '',
        'types':                    types,
        'supertype':                _supertype(data),
        'subtypes':                 _build_subtypes(data),
        'attacks':                  _normalize_attacks(data.get('attacks')),
        'abilities':                _normalize_abilities(data.get('abilities')),
        'weaknesses':               _normalize_weak_res(data.get('weaknesses')),
        'resistances':              _normalize_weak_res(data.get('resistances')),
        'retreat_cost':             int(retreat) if retreat is not None else None,
        'evolves_from':             data.get('evolveFrom') or '',
        'artist':                   data.get('illustrator') or '',
        'flavor_text':              data.get('description') or '',
        'national_pokedex_numbers': dex_ids,
        'regulation_mark':          data.get('regulationMark') or '',
        'legalities':               legalities,
    }


SAVE_FIELDS = [
    'hp', 'types', 'supertype', 'subtypes', 'attacks', 'abilities',
    'weaknesses', 'resistances', 'retreat_cost', 'evolves_from',
    'artist', 'flavor_text', 'national_pokedex_numbers',
    'regulation_mark', 'legalities',
]


class Command(BaseCommand):
    help = 'Enriches non-English cards with full data from the TCGdex REST API.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--language', '-l',
            required=True,
            choices=SUPPORTED,
            help='Language of cards to enrich (e.g. ja).',
        )
        parser.add_argument(
            '--start-from',
            default='',
            help='api_id to resume from (skip all cards before this, alphabetically).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Fetch data and print what would be updated, but do not save.',
        )

    def handle(self, *args, **options):
        lang      = options['language']
        start_from = options['start_from']
        dry_run   = options['dry_run']

        # TCGdex uses 'zh' not 'zh-cn'
        api_lang = 'zh' if lang == 'zh-cn' else lang

        cards = Card_Master.objects.filter(language=lang).order_by('api_id')
        total = cards.count()

        if total == 0:
            self.stdout.write(self.style.WARNING(
                f'No cards found for language={lang}. '
                f'Run import_language_cards --language {lang} first.'
            ))
            return

        if start_from:
            cards = cards.filter(api_id__gte=start_from)
            self.stdout.write(self.style.NOTICE(f'Resuming from {start_from}'))

        self.stdout.write(self.style.NOTICE(
            f'Enriching {cards.count()} / {total} {lang.upper()} cards '
            f'{"(DRY RUN) " if dry_run else ""}from TCGdex REST API…'
        ))

        updated = skipped = errors = 0

        for i, card in enumerate(cards.iterator(), 1):
            # Derive TCGdex ID: strip language prefix  "ja-base1-4" → "base1-4"
            tcgdex_id = card.api_id[len(lang) + 1:]  # +1 for the '-'

            url = f'{TCGDEX_BASE}/{api_lang}/cards/{tcgdex_id}'
            data = _get(url)

            if data is None:
                skipped += 1
            else:
                fields = _map_fields(data)
                if dry_run:
                    self.stdout.write(
                        f'  [DRY RUN] {card.api_id}: hp={fields["hp"]} '
                        f'types={fields["types"]} attacks={len(fields["attacks"])}'
                    )
                else:
                    for field, value in fields.items():
                        setattr(card, field, value)
                    card.save(update_fields=SAVE_FIELDS)
                updated += 1

            if i % 100 == 0:
                self.stdout.write(
                    f'  {i}/{cards.count()} — updated={updated} skipped={skipped} errors={errors}'
                )

            time.sleep(REQUEST_DELAY)

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. updated={updated} skipped={skipped} errors={errors}'
        ))
