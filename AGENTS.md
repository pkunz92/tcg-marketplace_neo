# TCG Marketplace — Agent Context

You are an AI agent working on **TCG Marketplace Neo**, a multi-service Pokemon (and MTG / Yu-Gi-Oh!) trading card marketplace.

---

## Architecture Overview

```
tcg-marketplace_neo/
├── backend/           Django 4.2 REST API             → :8000
├── frontend/          Old Vite/React 19 SPA            → :3000  (being replaced)
├── frontend-next/     New Next.js 15 frontend          → :3001  (active)
├── grading-service/   FastAPI ML card-grading service  → :8001
├── mobile/            Expo React Native app (iOS/Android)
├── e2e/               Playwright end-to-end tests
├── paperclip/         Paperclip AI agent orchestration
├── scripts/           Load-testing scripts (autocannon/k6)
├── tasks/             Implementation planning docs
├── .github/workflows/ CI/CD (e2e.yml, lighthouse.yml)
└── docker-compose.yml 5 services: db, backend, frontend, frontend-next, grading-service
```

**Active development target:** `frontend-next/` (Next.js). The old `frontend/` is kept for reference only.

---

## Running the Project

```bash
# Full stack (recommended)
docker-compose up --build

# Backend only
cd backend && pip install -r requirements.txt
python manage.py migrate
gunicorn backend.wsgi:application --bind 0.0.0.0:8000  # production
python manage.py runserver                              # dev only

# frontend-next (active)
cd frontend-next && npm install && npm run dev   # :3001, proxies /api → :8000

# Grading service
cd grading-service && pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# Mobile
cd mobile && npm install && npx expo start
```

---

## Key Models

### Phase 1 — Catalog & Marketplace

| Model | Purpose |
|---|---|
| `Card_Master` | One row per card per language. PK = `api_id` (string) |
| `Set_Master` | Card sets. `unique_together = (set_code, language)` |
| `CardTranslation` | Translated card name/image for another language |
| `SetTranslation` | Translated set name |
| `CardPrice` | Latest price snapshot (upserted on each fetch) |
| `CardPriceHistory` | Timestamped price snapshots for history charts |
| `Card_Listing` | Marketplace listing by a seller. Has `grading_status` + `auto_grade` JSON |
| `ListingPhoto` | S3-backed photo attached to a listing |
| `Order` | Purchase. Statuses: PENDING → COMPLETED / CANCELLED / DELIVERED |
| `UserProfile` | Shipping details for a user (auto-created via signal on registration) |

### Phase 2 — Payments & Offers

| Model | Purpose |
|---|---|
| `Offer` | Buyer offer on a listing. Statuses: PENDING / ACCEPTED / DECLINED / EXPIRED / COUNTERED |
| `Transaction` | 1:1 to Order. Stores Stripe `payment_intent_id`, `charge_id`, status |
| `CardGrade` | Professional grading cert (PSA/BGS/CGC) linked to a listing |

### Phase 5 — Reviews, Analytics, Disputes

| Model | Purpose |
|---|---|
| `Review` | Post-purchase review (1:1 to Order). Stars 1–5, comment |
| `PriceSoldSnapshot` | Actual sold price recorded when order reaches DELIVERED |
| `Dispute` | Buyer-opened dispute on an order. Statuses: OPEN / RESOLVED / CLOSED |
| `UserFlag` | Fraud signal record (excess cancellations, payment velocity, Stripe dispute) |

---

## API Endpoints

### Catalog
| Endpoint | Notes |
|---|---|
| `GET /api/cards/list/` | Paginated, filterable (see filter params below) |
| `GET /api/cards/<api_id>/` | Card detail with prices & translations |
| `GET /api/cards/<api_id>/stats/` | Card + listings + market stats |
| `GET /api/cards/<api_id>/price-history/` | `?days=30|90|365` |
| `GET /api/cards/<api_id>/sold-price-history/` | Actual sold prices |
| `GET /api/sets/` | Set list (`?language=ja`) |
| `GET /api/series/` | Series list (`?language=ja`) |
| `GET /api/rarities/` | Distinct rarities |
| `GET /api/stats/` | DB-level counts (cached 5 min) |
| `GET /api/search/` | Fast PostgreSQL trigram search (`?q=<term>`) |
| `GET /api/market/analytics/` | Aggregate market analytics |

### Marketplace
| Endpoint | Notes |
|---|---|
| `GET /api/listings/` | Active listings (`?my_listings=true` for seller) |
| `POST /api/listings/` | Create listing (auth) |
| `PATCH/DELETE /api/listings/<id>/` | Edit/delete (owner only) |
| `POST /api/listings/analyze-photo/` | Trigger ML grading on uploaded photo |
| `POST /api/listings/bulk/` | Bulk create from mobile |
| `GET/POST /api/offers/` | List/create offers (auth) |
| `PATCH /api/offers/<id>/` | Accept / decline / counter offer |
| `GET/POST /api/orders/` | My orders (auth) |
| `POST /api/orders/<id>/review/` | Post-purchase review |
| `POST /api/orders/<id>/dispute/` | Open dispute |

### Users & Reputation
| Endpoint | Notes |
|---|---|
| `GET/PATCH /api/user/profile/` | Shipping info (auth) |
| `GET /api/sellers/<id>/` | Public seller profile |
| `GET /api/users/<id>/reviews/` | Reviews for a seller |
| `GET /api/users/<id>/reputation/` | Weighted reputation score |

### Photos
| Endpoint | Notes |
|---|---|
| `POST /api/photos/presign` | Get S3 presigned upload URL |
| `DELETE /api/photos/<id>/` | Delete photo from S3 |
| `GET /api/listings/<id>/photos/` | Photos for a listing |

### Auth
| Endpoint | Notes |
|---|---|
| `POST /api/auth/login/` | JWT cookie auth |
| `POST /api/auth/logout/` | Clears tokens |
| `POST /api/auth/registration/` | Register + shipping info |
| `POST /api/auth/token/refresh/` | Refresh JWT |

### Admin
| Endpoint | Notes |
|---|---|
| `GET /api/disputes/` | List open disputes (admin) |
| `PATCH /api/disputes/<id>/` | Resolve dispute (admin) |

Card filter params: `language`, `set_code`, `series`, `card_rarity`, `supertype`, `types`, `hp_min`, `hp_max`, `has_price`, `ordering`, `search`, `tcg_type` (pokemon / mtg / yugioh / sports_cards)

---

## Management Commands

```bash
# --- Catalog data ---
python manage.py import_master_cards             # Import English Pokemon cards
python manage.py download_pokemontcg_data        # Download raw JSON from pokemontcg.io
python manage.py fetch_pokemontcg_prices         # Fetch USD/EUR prices
python manage.py fetch_pokemontcg_prices --start-page 80  # Resume after crash
python manage.py fetch_multi_language_data       # Fetch JA/DE/FR cards from TCGdex
python manage.py import_language_cards --language ja
python manage.py enrich_language_cards --language ja
python manage.py import_translations --lang ja
python manage.py enrich_from_pokemontcg          # Enrich EN cards from dump
python manage.py fill_gaps                       # Fill missing rarity/data
python manage.py verify_database                 # Data integrity audit

# --- Multi-game ---
python manage.py seed_mtg_catalogue              # Seed MTG cards
python manage.py seed_yugioh_catalogue           # Seed Yu-Gi-Oh! cards

# --- Scheduled tasks (run by Paperclip Data Ops agent) ---
python manage.py expire_offers                   # Expire PENDING offers older than 48h
python manage.py run_fraud_signals               # Run fraud detection checks
```

---

## Tech Stack Details

### Backend
- **Django 4.2.7** + **DRF 3.14** — class-based views, `select_related`/`prefetch_related`
- **dj-rest-auth** + **django-allauth** + **simplejwt** — JWT in HTTP-only cookies
- **django-filter** — typed filter classes
- **gunicorn** — production WSGI server (3 workers, 120s timeout)
- **boto3** — S3/R2 photo storage
- **stripe** — payment intents and webhooks
- **SQLite** in dev; **PostgreSQL 16** in prod (docker-compose)

### Frontend (active: `frontend-next/`)
- **Next.js 15** (App Router, Server Components)
- **SWR** for data fetching
- **Tailwind CSS v3** + **Radix UI** components
- **TypeScript 5**
- **@stripe/react-stripe-js** for checkout
- Proxies `/api/*` → `http://localhost:8000` via `next.config.ts`

### Grading Service (`grading-service/`)
- **FastAPI** + **uvicorn**
- **OpenCV** for image normalisation and heuristic grading
- **EfficientNet-B4** (when weights present at `backend/api/ml/models/grader_efficientnet_b4.pt`)
- Falls back to heuristic grader if model weights are absent
- Authenticated by `X-Grading-Secret` header

### Mobile (`mobile/`)
- **Expo 52** / **React Native 0.76**
- **expo-camera** for card photo capture
- **zustand** for state
- **axios** with token auth (stored in `expo-secure-store`)
- Flow: capture → compress → S3 upload → `POST /api/listings/analyze-photo/` → review → bulk list

---

## Code Conventions

- **Backend:** snake_case Python, class-based DRF views, always `select_related`/`prefetch_related`
- **frontend-next:** TypeScript, functional components, SWR hooks, Radix + Tailwind
- **No raw SQL** — use Django ORM (or annotate/Cast for computed fields)
- **No new Python dependencies** without adding to `requirements.txt`
- **No new JS dependencies** without adding to the relevant `package.json`
- Card `api_id` is the PK — always a string, never an integer
- `set_code` on `Set_Master` is NOT unique — `unique_together = (set_code, language)`
- Non-English cards: `api_id` prefixed with `{lang}-` (e.g. `ja-base1-4`)
- Use `transaction.atomic()` + `select_for_update()` for all stock/quantity mutations

---

## Important Constraints

- **Never break existing English card functionality** when modifying language logic
- **Stripe keys** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) must come from env — never hardcode
- **`DJANGO_SECRET_KEY`** is required — app will refuse to start without it
- **`CORS_ALLOWED_ORIGINS`** and **`CSRF_TRUSTED_ORIGINS`** are env-driven for production
- The grading service is optional at dev time — backend degrades gracefully if `ML_GRADING_SERVICE_URL` is empty

---

## Environment Variables (key ones)

```bash
DJANGO_SECRET_KEY=<required>
DEBUG=True                       # set False in production
DB_ENGINE=sqlite3                # or postgresql
POKEMON_TCG_API_KEY=<key>
STRIPE_SECRET_KEY=<sk_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
ML_GRADING_SERVICE_URL=http://grading-service:8001
CORS_ALLOWED_ORIGINS=https://yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com
```

---

## Current Development Branch

`claude/pending-context-Ppxsn` — commit and push changes here, then merge to `main`.

```bash
git add <files>
git commit -m "Description of change"
git push -u origin claude/pending-context-Ppxsn
```
