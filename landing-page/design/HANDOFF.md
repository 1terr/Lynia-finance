# Design Handoff — Lynia Finance Landing Page

> Summary of all design deliverables for the frontend development phase.
> Design language follows [stripe.com](https://stripe.com).
> This document serves as the entry point to the complete design system.

---

## Deliverables Index

| Document | Purpose | Status |
|----------|---------|--------|
| [`DESIGN-BRIEF.md`](./DESIGN-BRIEF.md) | Project overview, brand direction, audience, technical choices | Complete |
| [`CONTENT.md`](./CONTENT.md) | Full page copy for all sections and pages | Complete |
| [`DESIGN-TOKENS.md`](./DESIGN-TOKENS.md) | Colors, typography, spacing, shadows, radii, z-index, breakpoints | Complete |
| [`COMPONENTS.md`](./COMPONENTS.md) | Detailed specs for all 16 reusable UI components | Complete |
| [`WIREFRAMES.md`](./WIREFRAMES.md) | Mobile-first and desktop wireframes for all pages and sections | Complete |
| [`ANIMATIONS.md`](./ANIMATIONS.md) | Motion, transitions, scroll animations, hover/focus states | Complete |
| [`TASKS.md`](./TASKS.md) | Design phase task tracking | Complete |

---

## Quick Reference — Key Decisions

| Decision | Value |
|----------|-------|
| **Framework** | Next.js (App Router) |
| **Hosting** | AWS |
| **CMS** | Sanity (free tier) |
| **Font** | Inter (variable, 300–600) |
| **Icon library** | Lucide React |
| **Brand accent / CTA** | `#635BFF` (Stripe "blurple" — used for both brand accent and buttons) |
| **Primary dark** | `#0A2540` (Stripe "Downriver" navy) |
| **Body text** | `#425466` (Stripe blue-gray) |
| **Muted text** | `#ADBDCC` (secondary text on dark backgrounds) |
| **Light BG** | `#F6F9FC` (Stripe "Black Squeeze") |
| **Hero gradient** | WebGL: `#6ec3f4`, `#3a3aff`, `#ff61ab`, `#E63946` (Stripe's vibrant multi-hue) |
| **CSS framework** | Tailwind CSS (config in DESIGN-TOKENS.md) |
| **Breakpoints** | 640 / 768 / 1024 / 1280 / 1536 px |
| **Max container** | 1080px |
| **Mobile-first** | Yes |

---

## Pages to Build

### Homepage (11 sections)

| # | Section | Background | Key Component |
|---|---------|-----------|---------------|
| 1 | Hero | WebGL gradient | Hero Section |
| 2 | Social Proof | White/Gray-50 | Logo Strip |
| 3 | Product Suite | White | Product Card (×3) |
| 4 | Asset Financing | White | Product Deep Dive (text L, visual R) |
| 5 | Digital Credit | Navy (#0A2540) | Product Deep Dive (visual L, text R) |
| 6 | Enterprise Partnerships | Light (#F6F9FC) | Product Deep Dive (text L, visual R) |
| 7 | Why Alternative Financing | Blue gradient | Stat Card (×4) |
| 8 | Customer Segments | White | Segment Card (×3) |
| 9 | Editorial | White | Blog Post Card (×3, from Sanity) |
| 10 | Bottom CTA | Navy/gradient | CTA Section |
| 11 | Footer | Navy | Footer |

### Other Pages

| Page | Layout | Key Components |
|------|--------|---------------|
| Research | Featured post + 3-col grid | Blog Post Card, category pills |
| Contact | Split (info L, form R) + partnership form | Form Elements, buttons |
| Products | Detailed product pages | Product Deep Dive sections |
| Mission | Company mission/vision/values | Text sections |
| Partnerships | Info + application form | Form Elements |
| Privacy Policy | Legal text | Text content |
| Terms | Legal text | Text content |

### Global Elements (all pages)

| Element | Notes |
|---------|-------|
| Navigation Bar | Sticky, transparent→solid on scroll |
| Footer | 4-column, navy background |
| WhatsApp FAB | Fixed bottom-right, all pages |

---

## Component Build Order (recommended)

Build in this order for maximum reuse:

```
Phase 1: Foundation
├── Tailwind config (from DESIGN-TOKENS.md)
├── CSS custom properties
├── Inter font loading
└── Lucide icon setup

Phase 2: Base components
├── Button (primary, secondary, ghost, disabled)
├── Form elements (input, label, select, textarea, phone)
├── Section Label (overline)
└── Section Container (wrapper)

Phase 3: Compound components
├── Navigation Bar (+ mobile menu)
├── Product Card
├── Feature Grid Item
├── Stat Card
├── Segment Card
├── Blog Post Card
└── WhatsApp FAB

Phase 4: Page sections
├── Hero Section (+ WebGL gradient)
├── Logo Strip
├── Product Deep Dive Section
├── CTA Section
└── Footer

Phase 5: Page assembly
├── Homepage (compose all 11 sections)
├── Research page (Sanity integration)
├── Contact page (forms)
└── Remaining pages
```

---

## Performance Targets

| Metric | Target |
|--------|--------|
| FCP | < 1.5s on 3G |
| LCP | < 2.5s on 3G |
| TTI | < 3.5s on 3G |
| Total page weight | < 200KB initial |
| Lighthouse | > 90 |
| Animation JS | < 5KB gzipped |

---

## Assets Still Needed (from client)

These items are required before or during frontend development:

| Asset | Status | Blocker? |
|-------|--------|----------|
| Logo (SVG, light + dark) | Not started | Yes — needed for nav and footer |
| Flat illustrations (per product) | Not started | Partial — can use placeholders |
| Partner/trust logos | Not started | Partial — can use text stats fallback |
| Legal text (privacy, terms) | Not started | No — separate pages, can add later |
| Initial blog posts | Not started | No — Sanity CMS, content added post-launch |

**Recommendation**: Start frontend development immediately. Use placeholder illustrations and the text-stats fallback for the trust bar. Logo and illustrations can be dropped in as they become available without requiring code changes.

---

## File Structure (suggested for Next.js)

```
landing-page/frontend/
├── app/
│   ├── layout.tsx              # Root layout (nav + footer + WhatsApp FAB)
│   ├── page.tsx                # Homepage (11 sections)
│   ├── research/
│   │   ├── page.tsx            # Research listing
│   │   └── [slug]/page.tsx     # Individual post
│   ├── contact/page.tsx        # Contact + partnership forms
│   ├── products/page.tsx       # Products overview
│   ├── mission/page.tsx        # Mission page
│   ├── partnerships/page.tsx   # Partnerships page
│   ├── privacy/page.tsx        # Privacy policy
│   └── terms/page.tsx          # Terms of service
├── components/
│   ├── ui/                     # Base components (Button, Input, etc.)
│   ├── sections/               # Homepage sections
│   ├── layout/                 # Nav, Footer, WhatsApp FAB
│   └── blog/                   # Blog-specific components
├── lib/
│   ├── sanity.ts               # Sanity client + queries
│   └── utils.ts                # Shared utilities
├── styles/
│   └── globals.css             # CSS custom properties, base styles
├── public/
│   ├── images/                 # Static images, illustrations
│   └── icons/                  # Favicon, app icons
└── tailwind.config.ts          # Tailwind config (from DESIGN-TOKENS.md)
```
