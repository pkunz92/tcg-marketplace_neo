# Pokemon TCG Marketplace — Frontend Implementation Plan

## 0. Codebase Findings

The frontend directory (`/home/user/tcg-marketplace_neo/frontend/`) does not exist yet. This is a **complete greenfield build**. The backend is fully functional at `http://127.0.0.1:8000` with these confirmed characteristics:

- JWT stored in HttpOnly cookies named `app-access-token` / `app-refresh-token`
- CSRF is **disabled** for all `/api/` routes (safe to omit CSRF headers)
- CORS allows `localhost:3000` with credentials
- Pagination: `PageNumberPagination`, 50 per page, response shape `{ count, next, previous, results }`
- Auth registration requires: `username`, `email`, `password1`, `password2`, plus full shipping address fields
- Email verification is mandatory (`ACCOUNT_EMAIL_VERIFICATION = 'mandatory'`)
- All listing prices are in CHF (`price_chf` field)
- Card images come from `image_url` on `Card_Master` (pokemontcg.io CDN URLs)
- `api_id` is the primary key for cards (e.g. `xy1-1`, `swsh1-25`)
- Condition choices: MT, NM, LP, MP, HP, DMG
- Grading choices: RAW, PSA, BGS, CGC, TAG, ACE
- Order status: PENDING, COMPLETED, CANCELLED (only seller can complete/cancel)

---

## 1. Recommended Additional Packages

### Core

```
react-router-dom@6          # client-side routing (SPA)
@tanstack/react-query@5     # server state, caching, pagination, background refetch
axios@1                     # HTTP client with interceptors for cookie-based JWT
```

### UI & Animations

```
framer-motion@11            # card flip, page transitions, stagger animations
lucide-react                # icon system (consistent, tree-shakeable)
clsx                        # conditional className utility
tailwind-merge              # merge Tailwind classes safely (avoids conflicts)
```

### Forms & Validation

```
react-hook-form@7           # performant, uncontrolled forms
zod@3                       # schema validation
@hookform/resolvers         # connect zod to react-hook-form
```

### Virtualisation & UX

```
@tanstack/react-virtual@3   # virtual scroll for 20K+ card grid
react-intersection-observer # sentinel-based infinite scroll trigger
react-hot-toast             # toast notifications (buy success, errors)
```

### Dev

```
vite@5                      # already implied by stack
@vitejs/plugin-react         # React fast refresh
prettier                    # code formatting
eslint + eslint-plugin-react-hooks
```

### Vite Setup Notes

- Port: `3000` (matches CORS allowlist)
- Proxy: configure Vite `server.proxy` so `/api/` proxies to `http://127.0.0.1:8000` during dev. This means all `axios` calls use relative URLs (`/api/cards/list/`) — no hardcoded backend URL in component code.

---

## 2. Page / Route Structure

```
/                           HomePage
/cards                      CatalogPage
/cards/:apiId               CardDetailPage
/market                     MarketplacePage
/market/listing/:id         ListingDetailPage     (buy flow)
/dashboard                  DashboardPage         (auth required)
/dashboard/listings         MyListingsPage        (auth required)
/dashboard/orders           MyOrdersPage          (auth required)
/dashboard/profile          ProfilePage           (auth required)
/login                      LoginPage
/register                   RegisterPage
/verify-email               VerifyEmailPage       (post-registration)
*                           NotFoundPage
```

React Router v6 structure: a root `<Layout>` wraps all routes. An `<AuthLayout>` nested route wraps the `/dashboard/*` subtree and redirects unauthenticated users to `/login`.

---

## 3. Component Architecture

### Layout Layer

```
src/components/layout/
  RootLayout.jsx            # Navbar + Outlet + Footer + ToastProvider
  AuthLayout.jsx            # Checks auth, redirects if not logged in
  PageContainer.jsx         # max-w wrapper + padding, used inside each page
```

### Navigation

```
src/components/nav/
  Navbar.jsx                # logo, global search, nav links, auth state
  GlobalSearchBar.jsx       # combobox with debounced autocomplete (card names)
  NavLink.jsx               # active-state styled link
  UserMenu.jsx              # avatar dropdown (dashboard, logout)
  MobileMenu.jsx            # slide-in drawer for small screens
```

### Card Components (most reused)

```
src/components/cards/
  CardGrid.jsx              # responsive grid, renders CardThumbnail list
  CardThumbnail.jsx         # flip card: front = image, back = quick stats
  CardImage.jsx             # img with skeleton placeholder + error fallback
  CardBadge.jsx             # rarity / supertype / type badge chip
  CardFlipWrapper.jsx       # Framer Motion perspective-flip container
  PriceTag.jsx              # formatted CHF price display
  ConditionBadge.jsx        # color-coded MT/NM/LP/MP/HP/DMG
  GradingBadge.jsx          # RAW/PSA/BGS/CGC/TAG/ACE badge
```

### Catalog / Filtering

```
src/components/catalog/
  FilterSidebar.jsx         # supertype, rarity, type, set, HP range, has_price
  FilterChips.jsx           # active filter pills with remove button
  SortSelector.jsx          # ordering dropdown
  SearchInput.jsx           # debounced text input
  PaginationControls.jsx    # prev/next with page count
  VirtualCardGrid.jsx       # @tanstack/react-virtual grid for infinite scroll
```

### Marketplace

```
src/components/marketplace/
  ListingCard.jsx           # listing thumbnail: card image, condition, price, seller
  ListingGrid.jsx           # grid of ListingCards
  ListingFilters.jsx        # condition, grading, price range, set, rarity filters
  BuyModal.jsx              # full buy flow modal (shipping confirm + submit)
  CreateListingModal.jsx    # list-a-card form (card search + condition + price + photo)
  OrderStatusBadge.jsx      # PENDING/COMPLETED/CANCELLED chip
```

### Card Detail

```
src/components/detail/
  CardHero.jsx              # large card image + key stats side-by-side
  CardAttackList.jsx        # attacks table
  CardAbilityList.jsx       # abilities
  MarketPriceTable.jsx      # CardPrice rows (source/variant/low/mid/high/market)
  ListingsTable.jsx         # active listings for this card, sortable by price
  PriceStatBar.jsx          # min / avg / max visual bar from /stats endpoint
  TranslationSelector.jsx   # language switcher showing translated card name/image
```

### Dashboard

```
src/components/dashboard/
  DashboardNav.jsx          # sidebar tabs: listings / orders / profile
  ListingRow.jsx            # my listing row with edit/delete
  OrderRow.jsx              # order row with status + card image
  ShippingForm.jsx          # shared form for profile + order shipping fields
  ProfileEditor.jsx         # wraps ShippingForm + save
  CreateListingForm.jsx     # full standalone form for /dashboard/listings
```

### Auth

```
src/components/auth/
  LoginForm.jsx
  RegisterForm.jsx          # includes all shipping fields
  VerifyEmailBanner.jsx     # shown post-registration
```

### Shared / Primitives

```
src/components/ui/
  Button.jsx                # variants: primary, secondary, ghost, danger
  Input.jsx                 # base input with label + error state
  Select.jsx                # native select styled
  Modal.jsx                 # Framer Motion backdrop + panel
  Spinner.jsx               # loading spinner
  Skeleton.jsx              # shimmer placeholder
  EmptyState.jsx            # illustration + message for empty lists
  ErrorBoundary.jsx         # React error boundary
  Badge.jsx                 # generic colored pill
  Tooltip.jsx               # hover label
  StatCard.jsx              # used on homepage counter
```

---

## 4. Design System

### Color Palette (Dark Theme)

```
Background:
  bg-base:     #0a0a0f   (near-black, main background)
  bg-surface:  #12121a   (cards, panels)
  bg-elevated: #1a1a28   (modals, dropdowns)
  bg-border:   #2a2a3e   (dividers, input borders)

Accent — Poké Gold:
  accent-400:  #f5c842
  accent-500:  #e2b228   (primary CTA, hover)
  accent-600:  #c99a18

Secondary — Electric Blue:
  blue-400:    #60a5fa
  blue-500:    #3b82f6

Rarity Gradients (used in badges):
  Common:      #94a3b8 → #64748b   (slate)
  Uncommon:    #4ade80 → #16a34a   (green)
  Rare:        #60a5fa → #2563eb   (blue)
  Holo Rare:   #a78bfa → #7c3aed   (violet)
  Ultra Rare:  #fb923c → #ea580c   (orange)
  Secret Rare: #f472b6 → #db2777   (pink)
  Special:     gold gradient

Text:
  text-primary:   #f1f5f9
  text-secondary: #94a3b8
  text-muted:     #475569

Status:
  success: #22c55e
  warning: #f59e0b
  danger:  #ef4444
```

### Typography

- Font: `Inter` (variable) from Google Fonts — loaded in `index.html`
- Display headings: `font-display` using `Cinzel` (card-game serif feel) — used only on hero/logo
- Body: Inter regular 400 / medium 500 / semibold 600
- Monospace: `JetBrains Mono` — used for card numbers, prices
- Scale: standard Tailwind type scale; `text-xs` for badges, `text-sm` body, `text-base` prose

### Card Flip Animation

```
CardFlipWrapper:
  - perspective-1000 on container
  - inner div: transform-style: preserve-3d
  - hover: rotateY(180deg), transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1)
  - Front face: card image, set logo overlay bottom-right
  - Back face: rotateY(180deg), dark bg, card name / type / rarity / HP / quick price
```

Implemented with Framer Motion `whileHover` + `variants` for stagger on grid enter.

### Page Transitions

Framer Motion `AnimatePresence` on `<Outlet>`, with `opacity: 0 → 1` + `y: 8 → 0` over 200ms.

---

## 5. Data Fetching Strategy

### TanStack Query Configuration

```js
// src/lib/queryClient.js
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 min — cards/sets rarely change
      gcTime:    1000 * 60 * 30,  // 30 min in memory
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})
```

### Query Keys Convention

```
['cards', 'list', filters]         → CardMasterListAPIView
['cards', 'detail', apiId]         → CardMasterDetailAPIView
['cards', 'stats', apiId]          → CardDetailWithStatsAPIView
['sets', 'list', search]           → SetListAPIView
['listings', 'list', filters]      → CardListingViewSet list
['listings', 'my']                 → listings?my_listings=true
['orders', 'my']                   → OrderViewSet (buyer)
['orders', 'selling']              → OrderViewSet?seller=true
['stats', 'db']                    → DatabaseStatsAPIView
['user', 'profile']                → UserProfileView
['auth', 'user']                   → /api/auth/user/
```

### Pagination Strategy

- **Card Catalog** (`/cards`): traditional page-number pagination. Filters stored in URL via `useSearchParams` — shareable, back-button friendly.
- **Marketplace** (`/market`): infinite scroll using `useInfiniteQuery`. `IntersectionObserver` sentinel triggers `fetchNextPage()`.
- **Global Search autocomplete**: debounced 300ms, `staleTime: 0`, top 8 results in dropdown.

### Axios Instance

```js
// src/lib/api.js
const api = axios.create({
  baseURL: '/api',        // proxied by Vite to http://127.0.0.1:8000
  withCredentials: true,  // send JWT cookies on every request
})
```

Add a response interceptor: on 401, call `/api/auth/token/refresh/` once then retry the original request.

---

## 6. Implementation Order (Critical Path)

### Phase 1 — Foundation
1. Scaffold Vite project, install all packages
2. Configure `tailwind.config.js` with custom tokens
3. Configure `vite.config.js` (proxy, port 3000)
4. `src/lib/api.js` + `src/lib/queryClient.js`
5. `src/context/AuthContext.jsx`
6. All `src/components/ui/` primitives (Button, Input, Modal, Spinner, Skeleton…)
7. `RootLayout.jsx` + `Navbar.jsx` + React Router setup

### Phase 2 — Card Catalog
8. `CardImage`, `CardBadge`, `PriceTag`
9. `CardThumbnail` + `CardFlipWrapper` (Framer Motion)
10. `FilterSidebar` + `PaginationControls`
11. `CatalogPage` — wired to `/api/cards/list/`, filters in URL params

### Phase 3 — Card Detail
12. `CardHero`, `CardAttackList`, `CardAbilityList`
13. `MarketPriceTable`, `PriceStatBar`, `ListingsTable`
14. `CardDetailPage` — queries `/api/cards/:apiId/stats/`

### Phase 4 — Auth
15. `LoginForm` + `LoginPage`
16. `RegisterForm` + `RegisterPage` (shipping fields)
17. `VerifyEmailPage` + `AuthLayout` (protected routes)
18. `UserMenu` in Navbar

### Phase 5 — Marketplace
19. `ListingCard`, `ListingGrid`, `ListingFilters`
20. `MarketplacePage` — infinite scroll
21. `BuyModal` — shipping confirm + POST `/api/orders/`
22. `ListingDetailPage`

### Phase 6 — Dashboard
23. `DashboardNav` sidebar
24. `MyListingsPage` + `CreateListingModal`
25. `MyOrdersPage`
26. `ProfilePage` + `ShippingForm`

### Phase 7 — Home Page
27. `HomePage` — hero, stats counters, featured sets, recent listings

### Phase 8 — Polish
28. `GlobalSearchBar` with autocomplete
29. Page transition animations (`AnimatePresence`)
30. Mobile menu + full responsiveness pass
31. `ErrorBoundary` on route subtrees
32. `NotFoundPage`
33. Prefetch card detail on thumbnail hover

---

## 7. File Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── context/
    │   └── AuthContext.jsx
    ├── lib/
    │   ├── api.js
    │   ├── queryClient.js
    │   └── utils.js               # formatCHF(), cn(), TYPE_COLORS, RARITY_COLORS
    ├── hooks/
    │   ├── useCards.js
    │   ├── useListings.js
    │   ├── useOrders.js
    │   ├── useSets.js
    │   ├── useProfile.js
    │   ├── useDbStats.js
    │   └── useDebounce.js
    ├── components/
    │   ├── ui/           # Button, Input, Select, Modal, Spinner, Skeleton, Badge, EmptyState, Tooltip, StatCard, ErrorBoundary
    │   ├── layout/       # RootLayout, AuthLayout, PageContainer
    │   ├── nav/          # Navbar, GlobalSearchBar, NavLink, UserMenu, MobileMenu
    │   ├── cards/        # CardGrid, CardThumbnail, CardFlipWrapper, CardImage, CardBadge, PriceTag, ConditionBadge, GradingBadge
    │   ├── catalog/      # FilterSidebar, FilterChips, SortSelector, SearchInput, PaginationControls
    │   ├── detail/       # CardHero, CardAttackList, CardAbilityList, MarketPriceTable, ListingsTable, PriceStatBar, TranslationSelector
    │   ├── marketplace/  # ListingCard, ListingGrid, ListingFilters, BuyModal, CreateListingModal, OrderStatusBadge
    │   ├── dashboard/    # DashboardNav, ListingRow, OrderRow, ShippingForm, ProfileEditor, CreateListingForm
    │   └── auth/         # LoginForm, RegisterForm, VerifyEmailBanner
    └── pages/
        ├── HomePage.jsx
        ├── CatalogPage.jsx
        ├── CardDetailPage.jsx
        ├── MarketplacePage.jsx
        ├── ListingDetailPage.jsx
        ├── DashboardPage.jsx
        ├── MyListingsPage.jsx
        ├── MyOrdersPage.jsx
        ├── ProfilePage.jsx
        ├── LoginPage.jsx
        ├── RegisterPage.jsx
        ├── VerifyEmailPage.jsx
        └── NotFoundPage.jsx
```

---

## 8. Key Technical Decisions

| Decision | Rationale |
|---|---|
| URL-driven filter state (`useSearchParams`) | Shareable URLs, back-button works, TanStack Query cache key includes filters naturally — no extra state store |
| No Zustand/Redux | Auth in `AuthContext`, server state in TanStack Query, UI state in local `useState` — keeps bundle lean |
| Vite proxy for `/api/` | Avoids CORS in dev, no hardcoded backend URLs in components |
| `FormData` for listing photo upload | Axios auto-sets `multipart/form-data` when body is `FormData` |
| `loading="lazy"` on all card images | 20K cards — only load visible images |
| Axios 401 interceptor → token refresh | Access token is 10 min; interceptor silently refreshes using the 7-day refresh cookie |

---

## 9. `tailwind.config.js`

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: '#0a0a0f',
        surface: '#12121a',
        elevated: '#1a1a28',
        border: '#2a2a3e',
        accent: { 400: '#f5c842', 500: '#e2b228', 600: '#c99a18' },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'sans-serif'],
        display: ['Cinzel', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

---

## 10. `vite.config.js`

```js
export default {
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
}
```

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| 20K+ cards slow render | 50/page pagination on catalog; lazy images |
| JWT 10-min expiry | Axios 401 interceptor calls `/api/auth/token/refresh/` then retries |
| Email verification blocking login | Clear UX on `VerifyEmailPage`; resend link |
| Seller photos on `/media/` | Vite proxy covers `/media/` too |
| CHF formatting locale | Use `Intl.NumberFormat('de-CH', { currency: 'CHF' })` |
