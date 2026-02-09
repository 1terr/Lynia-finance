# Lynia Finance Landing Page — Implementation Plan

## Context

Lynia Finance needs a public-facing marketing landing page to attract potential customers (Zimbabwe's underbanked majority) and distribution partners. Currently the repo has two internal-facing Next.js apps (`admin-portal` and `distributor-dashboard`) but no public website. The project is a pnpm monorepo with `frontend/*` in the workspace config, so the landing page fits naturally as `frontend/landing-page/` — no separate repo needed.

## Approach: Next.js 14 Static Site in the Monorepo

**Tech stack:** Next.js 14 (App Router) + `output: 'export'` for fully static HTML — matching the existing apps for consistency while producing a zero-server-runtime site deployable to any CDN.

**Why not a separate repo or different framework (Astro)?**
- `pnpm-workspace.yaml` already includes `frontend/*` — a new folder is auto-recognized
- Same framework = shared tooling, configs, and team knowledge
- `output: 'export'` produces the same static output Astro would, with no runtime overhead
- Complete code isolation — each app has its own `package.json` and builds independently

## Project Location

`frontend/landing-page/` — an independent Next.js 14 package within the existing monorepo.

## Landing Page Sections

1. **Hero** — Headline, WhatsApp CTA, phone mockup, trust stats
2. **Problem** — 80% credit gap stats on dark background
3. **How It Works** — 4-step visual process (WhatsApp → KYC → Pick phone → Pay)
4. **Features** — 6-card grid (WhatsApp-first, AI scoring, mobile money, fast approval, device protection, transparent pricing)
5. **Device Showcase** — Phone cards with specs, pricing, and per-device WhatsApp CTA
6. **Trust & Security** — RBZ compliance, encryption, transparent fees
7. **Distributor CTA** — Full-width banner for partnership signup
8. **FAQ** — Accordion with common questions
9. **Footer** — Contact, links, floating WhatsApp button

## Implementation Phases

### Phase 1: Project Scaffolding
Create the project structure and config files, adapted from admin-portal:

| File | Source/Notes |
|------|-------------|
| `package.json` | Based on admin-portal. Keep: `next@14.2.18`, `react`, `class-variance-authority`, `clsx`, `lucide-react`, `next-themes`, `tailwind-merge`, `tailwindcss-animate`. Add: `framer-motion`. Drop: supabase, react-query, react-table, zustand, recharts, react-hook-form, zod |
| `next.config.js` | `output: 'export'`, `images: { unoptimized: true }` |
| `tailwind.config.ts` | Copy HSL variable system from `frontend/admin-portal/tailwind.config.js` |
| `globals.css` | Copy CSS variables from `frontend/admin-portal/src/app/globals.css`, add `html { scroll-behavior: smooth }` |
| `tsconfig.json` | Copy from admin-portal with `@/*` alias |
| `postcss.config.js` | Identical to admin-portal |
| `src/lib/utils.ts` | Copy `cn()` verbatim from `frontend/admin-portal/src/lib/utils.ts` |

Run `pnpm install` from root to link the workspace.

### Phase 2: Foundation & Layout
- `src/types/index.ts` — `Device`, `FAQ`, `Feature`, `Step` interfaces
- `src/lib/constants.ts` — All static data (devices, FAQs, features, WhatsApp URL, nav links)
- `src/lib/metadata.ts` — SEO metadata helpers
- UI primitives: `container.tsx`, `section-header.tsx`, `button.tsx` (with `whatsapp` + `cta` variants), `card.tsx`, `badge.tsx`
- Layout: `navbar.tsx` (server), `mobile-menu.tsx` (client), `footer.tsx`, `theme-provider.tsx`
- `src/app/layout.tsx` — Root layout with Inter font, ThemeProvider, full SEO metadata + JSON-LD
- `src/components/ui/whatsapp-cta-button.tsx` — Floating green button (fixed bottom-right)

### Phase 3: Section Components
Build each section as an independent component:

- `hero-section.tsx` — Two-column layout, h1 headline, WhatsApp CTA, `<Image priority>` for phone mockup
- `problem-section.tsx` — Dark background, 3 stat cards with animated counters
- `how-it-works-section.tsx` — 4-step timeline with Lucide icons
- `features-section.tsx` — 2x3 grid of feature cards (pattern adapted from admin-portal's `metric-card.tsx`)
- `device-showcase-section.tsx` + `device-card.tsx` — Device grid with specs/pricing
- `trust-section.tsx` — Compliance badges row
- `distributor-cta-section.tsx` — Full-width gradient banner
- `faq-section.tsx` + `accordion.tsx` — Client component with expand/collapse

### Phase 4: Page Assembly & Polish
- `src/app/page.tsx` — Compose all sections with `id` attributes for smooth-scroll nav
- `src/app/not-found.tsx` — Custom 404
- `src/app/distributors/page.tsx` — Distributor partnership page
- `src/app/privacy/page.tsx` — Privacy policy
- `scroll-animation.tsx` — Framer Motion fade-in wrapper (dynamically imported)
- `public/robots.txt`

### Phase 5: Testing
- Unit tests for UI components (button, accordion, device-card, whatsapp-cta-button)
- Section tests (hero renders h1 + CTA, how-it-works renders 4 steps, FAQ expands/collapses)
- Page integration test (all sections present, single h1, valid WhatsApp links)
- Accessibility tests with `jest-axe` (WCAG 2.1 AA)
- Verify `next build` produces static `out/` directory

## Key Files to Reuse (Copy & Adapt)

| Admin Portal File | Landing Page Target | Changes |
|---|---|---|
| `frontend/admin-portal/tailwind.config.js` | `tailwind.config.ts` | Add marketing extensions (larger fonts) |
| `frontend/admin-portal/src/app/globals.css` | `src/app/globals.css` | Add scroll-behavior, animation keyframes |
| `frontend/admin-portal/src/lib/utils.ts` | `src/lib/utils.ts` | None — verbatim copy |
| `frontend/admin-portal/src/components/ui/button.tsx` | `src/components/ui/button.tsx` | Add `whatsapp`, `cta` variants |
| `frontend/admin-portal/src/components/ui/card.tsx` | `src/components/ui/card.tsx` | Add hover shadow transition |
| `frontend/admin-portal/src/components/ui/badge.tsx` | `src/components/ui/badge.tsx` | Minor — for pricing tier labels |
| `frontend/admin-portal/src/components/dashboard/metric-card.tsx` | Pattern for feature cards | Adapt icon+title+content layout |
| `frontend/admin-portal/jest.config.ts` | `jest.config.ts` | Adjust paths, add jest-axe |

## Performance Targets

- **FCP** < 1.5s, **TTI** < 3s, **Lighthouse** > 90 across all categories
- **Initial bundle** < 200KB (static export + minimal client JS)
- **Client components:** Only 3 — `mobile-menu.tsx`, `accordion.tsx`, `scroll-animation.tsx`
- **Images:** WebP, lazy-loaded below fold, `priority` on hero image

## Design Principles

- **Mobile-first** — Many users on low-end devices with slow connections
- **Simple language** — 8th-grade reading level, no financial jargon
- **All strings in `constants.ts`** — Prepares for future Shona/Ndebele i18n
- **WCAG 2.1 AA** — Keyboard nav, screen reader support, high contrast
- **Brand consistency** — Same HSL color system as admin-portal and distributor-dashboard

## Verification

1. `pnpm install` succeeds from root (workspace recognized)
2. `pnpm --filter @lynia/landing-page build` produces static `out/` directory
3. `pnpm --filter @lynia/landing-page test` passes with 80%+ coverage
4. Serve `out/` locally and verify all sections render, smooth scroll works, WhatsApp links open correctly
5. Run Lighthouse on served static site — all scores > 90
6. Test on mobile viewport (375px) — all sections responsive, CTA buttons tappable
7. Verify dark mode toggle works correctly
