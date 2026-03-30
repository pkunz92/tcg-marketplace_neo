# TCG Marketplace — Agent Context

You are an AI agent working on **TCG Marketplace Neo**, a Pokemon Trading Card Game
marketplace built with Django 4.2 + Django REST Framework (backend) and React 18 +
Vite + Tailwind CSS (frontend).

---

## Project Structure

```
tcg-marketplace_neo/
├── backend/
│   ├── api/                    # Main Django app
│   │   ├── models.py           # DB models (Card_Master, Set_Master, CardPrice, etc.)
│   │   ├── views.py            # DRF API views
│   │   ├── serializers.py      # DRF serializers
│   │   ├── filters.py          # django-filter filters
│   │   ├── urls.py             # URL routing
│   │   └── management/commands/
│   │       ├── import_master_cards.py      # Import English cards from pokemontcg.io JSON
│   │       ├── fetch_pokemontcg_prices.py  # Fetch USD/EUR prices from pokemontcg.io
│   │       ├── fetch_multi_language_data.py # Fetch JA/DE/FR/etc. cards from TCGdex
│   │       ├── import_language_cards.py    # Import non-English cards into DB
│   │       ├── import_translations.py      # Import card/set name translations
│   │       ├── enrich_language_cards.py    # Enrich JA cards with HP/attacks/abilities
│   │       └── enrich_from_pokemontcg.py   # Enrich EN cards from pokemontcg.io dump
│   ├── backend/settings.py     # Django settings
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── pages/              # React page components
│   │   ├── components/         # Reusable UI components
│   │   ├── hooks/              # React Query data hooks
│   │   └── lib/                # Utilities
│   ├── package.json
│   └── vite.config.js
└── paperclip/
    └── agents/                 # Paperclip agent heartbeat scripts
```

---

## Key Models

| Model | Purpose |
|---|---|
| `Card_Master` | One row per card per language. PK = `api_id` |
| `Set_Master` | Card sets. `unique_together = (set_code, language)` |
| `CardPrice` | Latest price snapshot (upserted on each fetch) |
| `CardPriceHistory` | Timestamped price snapshots for history charts |
| `CardTranslation` | Translated name/image for a card in another language |
| `SetTranslation` | Translated set name |
| `Card_Listing` | Marketplace listing by a seller |
| `Order` | Completed purchase |
| `UserProfile` | Shipping details for a user |

---

## Running the Project

```bash
# Backend (from backend/)
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver   # runs on :8000

# Frontend (from frontend/)
npm install
npm run dev   # runs on :3000, proxies /api to :8000
```

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/cards/` | Card catalog (paginated, filterable) |
| `GET /api/cards/<api_id>/` | Card detail with prices & translations |
| `GET /api/cards/<api_id>/price-history/` | Price history for chart |
| `GET /api/sets/` | Set list (supports `?language=ja`) |
| `GET /api/series/` | Series/era list (supports `?language=ja`) |
| `GET /api/rarities/` | Distinct rarities (filterable) |
| `GET /api/listings/` | Active marketplace listings |
| `POST /api/listings/` | Create a listing (auth required) |
| `POST /api/orders/` | Place an order (auth required) |

Card filter params: `language`, `set_code`, `series`, `card_rarity`, `supertype`,
`types`, `hp_min`, `hp_max`, `has_price`, `ordering`, `search`

---

## Management Commands

```bash
# Import/update English card data
python manage.py import_master_cards

# Fetch latest prices (USD from TCGPlayer, EUR from CardMarket)
python manage.py fetch_pokemontcg_prices
python manage.py fetch_pokemontcg_prices --start-page 80   # resume after crash

# Multi-language card data (fetches from TCGdex, saves JSON locally)
python manage.py fetch_multi_language_data

# Import a language into the DB (creates Card_Master + Set_Master rows)
python manage.py import_language_cards --language ja
python manage.py import_language_cards --language ja --overwrite

# Enrich non-English cards with full game data (HP, attacks, abilities…)
python manage.py enrich_language_cards --language ja
python manage.py enrich_language_cards --language ja --start-from ja-base1-50

# Import name translations
python manage.py import_translations --lang ja
```

---

## Tech Stack Details

- **Django 4.2.7**, SQLite in dev, PostgreSQL in prod
- **DRF** with `django-filter` for filtering, `dj-rest-auth` for auth
- **React 18** with **TanStack Query v5** for data fetching
- **Tailwind CSS v3** (dark theme, accent color = yellow-400)
- **Recharts** for price history line chart
- **Framer Motion** for card flip animation
- **Vite** dev server proxies `/api` → Django

---

## Code Conventions

- Backend: snake_case Python, DRF class-based views, `select_related`/`prefetch_related` to avoid N+1
- Frontend: functional React components, hooks in `src/hooks/`, TanStack Query for all API calls
- Tailwind classes only (no custom CSS except `index.css` base layer)
- All API data access through hooks (never fetch directly in components)
- Non-English cards: `api_id` prefixed with `{lang}-` (e.g. `ja-base1-4`)

---

## Important Constraints

- **Never break existing English card functionality** when modifying language logic
- **Always use `select_related`/`prefetch_related`** in Django views to prevent N+1
- **No raw SQL** — use Django ORM only
- **No new dependencies** without checking `requirements.txt` / `package.json` first
- The `set_code` field on `Set_Master` is NOT unique — `unique_together = (set_code, language)`
- Card `api_id` is the primary key — always a string, never an integer

---

## Current Development Branch

`claude/pending-context-Ppxsn` — all changes should be committed and pushed here.

```bash
git add <files>
git commit -m "Description of change"
git push -u origin claude/pending-context-Ppxsn
```
