# Phase 1 - Design

Wireframes, mockups, brand assets, and design system for lyniafinance.com.

## Status

- **Phase 1A** (Inputs): Complete
- **Phase 1B** (Content): Complete (legal text and illustrations outstanding)
- **Phase 1C** (Design execution): Complete
- **Phase 1D** (Review & sign-off): Complete

## Documents

| File | Purpose |
|------|---------|
| [`HANDOFF.md`](./HANDOFF.md) | Design handoff summary — start here for development |
| [`DESIGN-BRIEF.md`](./DESIGN-BRIEF.md) | Project overview, brand direction, audience, and technical choices |
| [`CONTENT.md`](./CONTENT.md) | Full page copy for all sections and pages (source of truth) |
| [`DESIGN-TOKENS.md`](./DESIGN-TOKENS.md) | Colors, typography, spacing, shadows, breakpoints, Tailwind config |
| [`COMPONENTS.md`](./COMPONENTS.md) | Detailed specs for all reusable UI components |
| [`WIREFRAMES.md`](./WIREFRAMES.md) | Mobile-first and desktop wireframes for all pages |
| [`ANIMATIONS.md`](./ANIMATIONS.md) | Motion, transitions, scroll animations, hover/focus states |
| [`REVIEW-STRIPE-ALIGNMENT.md`](./REVIEW-STRIPE-ALIGNMENT.md) | Stripe alignment review — design and copy style guide |
| [`TASKS.md`](./TASKS.md) | Step-by-step checklist for the entire design phase |

## Key Decisions

| Area | Decision |
|------|----------|
| Color | Stripe.com palette — navy `#0A2540`, blurple `#635BFF` (accent + CTA), CSS gradient default |
| Typography | Inter (variable weight, Stripe-like, headings 500, body 300) |
| Icons | Lucide React |
| Illustrations | Flat, modern vectors (Stripe aesthetic) |
| Framework | Next.js (App Router) on AWS |
| CSS | Tailwind CSS |
| CMS | Sanity (free tier) |
| Products | Asset Financing, Digital Credit, Enterprise Partnerships |
| Hero gradient | CSS gradient default; WebGL as progressive enhancement |
| Navigation | Includes CTA button ("Start your application") |
| Section order | Stats at position 3 (before products) |

## Key Changes from Stripe Alignment Review

- Hero headline: "Financial tools for the underbanked"
- Stats section moved early (position 3) to establish problem before products
- Navigation includes CTA button for persistent conversion path
- "Mission" renamed to "About" in nav
- "Coming soon" replaced with lead capture for Digital Credit
- All copy rewritten in Stripe style (declarative, outcome-focused, no filler)
- Product naming standardized across all sections and footer
- Enterprise copy reframed from "We" statements to customer outcomes

## Outstanding Assets (client-provided)

- Logo design (SVG + PNG, light + dark variants)
- Flat illustrations for each product section
- Partner/trust logos
- Legal text (privacy policy, terms, RBZ disclaimers)
- Initial Editorial page blog posts
