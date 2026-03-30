# Paperclip Setup — TCG Marketplace

This directory contains everything needed to run the TCG Marketplace as a
Paperclip-orchestrated company of AI agents.

---

## 1. Install Paperclip

```bash
npx paperclipai onboard --yes
# or manually:
git clone https://github.com/paperclipai/paperclip.git
cd paperclip && pnpm install && pnpm dev
```

Paperclip UI → http://localhost:3000
API → http://localhost:3100/api

---

## 2. Create the Company

In the Paperclip UI click **New Company**:

| Field | Value |
|---|---|
| Name | TCG Marketplace |
| Mission | Build the leading Pokemon TCG card marketplace — comprehensive catalog, fair pricing, and great seller/buyer experience |

---

## 3. Org Chart

Create agents in this order (each reports to the one above it):

### CEO — Strategic Oversight
| Field | Value |
|---|---|
| Name | CEO |
| Role | ceo |
| Adapter | `claude_local` |
| CWD | `/path/to/tcg-marketplace_neo` |
| Model | `claude-sonnet-4-6` |
| Budget | $20/month |
| Heartbeat | On-demand + on assignment |
| Goal | Grow the marketplace: more cards, better prices, more languages, more listings |

### CTO — Technical Decisions
| Field | Value |
|---|---|
| Name | CTO |
| Role | cto |
| Reports to | CEO |
| Adapter | `claude_local` |
| CWD | `/path/to/tcg-marketplace_neo` |
| Model | `claude-sonnet-4-6` |
| Budget | $30/month |
| Heartbeat | On assignment, every 24h |

### Backend Engineer
| Field | Value |
|---|---|
| Name | Backend Engineer |
| Role | engineer |
| Reports to | CTO |
| Adapter | `claude_local` |
| CWD | `/path/to/tcg-marketplace_neo` |
| Model | `claude-sonnet-4-6` |
| Budget | $50/month |
| Heartbeat | On assignment |

### Frontend Engineer
| Field | Value |
|---|---|
| Name | Frontend Engineer |
| Role | engineer |
| Reports to | CTO |
| Adapter | `claude_local` |
| CWD | `/path/to/tcg-marketplace_neo` |
| Model | `claude-sonnet-4-6` |
| Budget | $50/month |
| Heartbeat | On assignment |

### Data Operations (automated, no AI)
| Field | Value |
|---|---|
| Name | Data Ops |
| Role | devops |
| Reports to | CTO |
| Adapter | `process` |
| Command | `python` |
| Args | `["paperclip/agents/data_ops.py"]` |
| CWD | `/path/to/tcg-marketplace_neo/backend` |
| Budget | $1/month (no LLM — just runs scripts) |
| Heartbeat interval | Every 6 hours (21600s) |
| Wake on assignment | Yes |

> **Env vars for Data Ops agent:**
> No extra env vars needed — the script uses Django's existing environment.
> Make sure `DJANGO_SETTINGS_MODULE=backend.settings` is set in the agent's env.

---

## 4. Set Goals

After creating the company, add these goals:

### Company Goal
> Build the #1 Pokemon TCG marketplace in Europe — complete multi-language card
> catalog, real-time price data, and a trusted peer-to-peer trading experience.

### Project: Catalog Quality
> Every card in the catalog has accurate game data (HP, attacks, types) and a card
> image. Non-English cards are fully enriched. Price data is refreshed daily.

Tasks to create under this project:
- `Enrich ja` — assigned to Data Ops
- `Fetch prices` — assigned to Data Ops (recurs automatically via timer)
- `Import de` — assigned to Data Ops when ready to add German cards

### Project: Marketplace Features
> The marketplace is easy to use for both sellers and buyers. Listings are priced
> fairly relative to market data. Filters and search work intuitively.

Tasks to create (assigned to Backend/Frontend engineers):
- Add bulk listing creation (sellers can list multiple cards at once)
- Add "Similar listings" section on card detail page
- Add seller profile pages with listing history
- Add price alert feature (notify when a card drops below a target price)
- Add card collection tracker (users can mark cards they own/want)

### Project: Language Expansion
> The marketplace supports Japanese, German, French, and Italian cards with
> correct names, images, and where possible, local market pricing.

Tasks:
- `Import de` — German cards
- `Import fr` — French cards
- `Enrich de` — after import
- `Enrich fr` — after import

---

## 5. Data Ops Agent — Supported Tasks

Create these tasks and assign to the **Data Ops** agent:

| Task title | What it does |
|---|---|
| `Fetch prices` | Runs `fetch_pokemontcg_prices` — updates all USD/EUR prices |
| `Enrich ja` | Runs `enrich_language_cards --language ja` |
| `Enrich de` | Runs `enrich_language_cards --language de` |
| `Import de` | Fetches + imports + translates German cards |
| `Import fr` | Fetches + imports + translates French cards |

The Data Ops agent also runs `Fetch prices` automatically every 6 hours on the
timer heartbeat, even without an assigned task.

---

## 6. Claude Code Agents (Backend/Frontend Engineer)

These agents use the `claude_local` adapter and run Claude Code directly in
the project directory. They can:
- Read and write code
- Run tests and management commands
- Create commits and push to the development branch
- Comment progress on their assigned tasks

**Important:** Before assigning tasks to these agents, make sure:
1. `ANTHROPIC_API_KEY` is set in the agent's environment (via Paperclip secrets)
2. The working directory is the project root
3. `AGENTS.md` is in the project root — Claude reads this on every heartbeat

**Example tasks for Backend Engineer:**
- "Add bulk listing endpoint — allow sellers to submit multiple card listings in one API call"
- "Add GET /api/sellers/:username/listings endpoint for seller profile pages"
- "Fix N+1 query on CardMasterListAPIView — profile and optimise"
- "Add price alert model and email notification when market price drops below user threshold"

**Example tasks for Frontend Engineer:**
- "Build seller profile page at /sellers/:username showing all active listings"
- "Add 'Similar cards' section on CardDetailPage showing same Pokémon in other sets"
- "Add collection tracker — users can mark cards as owned or wanted"
- "Improve mobile layout of FilterSidebar — currently hard to use on small screens"

---

## 7. Board Controls

As the board (human operator) you can at any time:
- **Pause** the Data Ops agent to stop scheduled price fetches
- **Override** a budget if an agent is close to its monthly limit
- **Assign** tasks directly from the task list
- **Approve** any agent hire requests from the CEO
- **Terminate** an agent that's misbehaving

---

## Architecture Diagram

```
Board (You)
│
└── CEO (claude_local) — strategy & goal setting
     │
     ├── CTO (claude_local) — technical decisions, code review
     │    ├── Backend Engineer (claude_local) — Django/Python
     │    ├── Frontend Engineer (claude_local) — React/Tailwind
     │    └── Data Ops (process) — scheduled maintenance jobs
     │         ├── Timer: fetch prices every 6h
     │         ├── Task: "Enrich ja/de/fr"
     │         └── Task: "Import de/fr"
     │
     └── [Future] Marketing Agent — SEO, social media
```
