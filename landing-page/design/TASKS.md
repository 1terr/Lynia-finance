# Design Phase - Task Checklist

## Phase 1A: Gather Inputs - COMPLETE

All inputs received and recorded in `DESIGN-BRIEF.md`.

- [x] Define primary and secondary goals for the site
- [x] Rank target audiences by priority
- [x] Decide which pages/sections to include
- [x] Provide logo or confirm logo design is needed (logo not available, part of design phase)
- [x] Confirm or adjust color palette (vibrant blue, Coinbase/Stanbic-inspired)
- [x] Decide on typography (Stripe.com style)
- [x] Provide imagery direction (flat illustrations, Stripe-like)
- [x] Define primary CTA behavior (WhatsApp floating button confirmed)
- [x] Decide on language support (English only)
- [x] State technical preferences (Next.js, AWS, high SEO priority)
- [x] Share 2-5 inspiration websites (Stripe, Moniepoint, Paystack)
- [x] List constraints and non-negotiables (no pink/purple, RBZ disclaimers, not minimalist)
- [x] Define success metrics (speed, signups, trust)

## Phase 1B: Content Preparation - MOSTLY COMPLETE

- [x] **Provide page content wireframes** (received as screenshots)
- [x] Write hero section copy (headline, subtext, CTA button text)
- [x] Write Asset Financing product section
- [x] Write Digital Credit product section
- [x] Write Enterprise Partnerships product section
- [x] Define footer structure (Products + Connect links)
- [x] Define Editorial page structure (Stripe blog-inspired, Sanity CMS)
- [x] Define Contact page layout (Stripe contact/sales-inspired, split layout)
- [x] Select CMS → **Sanity** (free tier)
- [ ] Prepare legal text (privacy policy, terms, RBZ regulatory disclaimers)
- [ ] Commission/source flat illustrations (Stripe-like style)
- [ ] Design logo (SVG + PNG, light + dark variants)
- [ ] Write initial Editorial page content (first blog posts)

## Phase 1C: Design Execution (Claude) - COMPLETE

- [x] Document site map / page hierarchy (from wireframes)
- [x] Define design tokens (colors, spacing, typography scale, border radius, shadows, z-index) → `DESIGN-TOKENS.md`
- [x] Design wireframes - mobile first → `WIREFRAMES.md`
- [x] Design wireframes - desktop → `WIREFRAMES.md`
- [x] Design component specifications (nav, hero, product cards, forms, buttons, footer, WhatsApp FAB) → `COMPONENTS.md`
- [x] Design high-fidelity mockups - mobile (documented as detailed wireframes with exact specs)
- [x] Design high-fidelity mockups - desktop (documented as detailed wireframes with exact specs)
- [x] Document responsive breakpoints → `DESIGN-TOKENS.md` Section 9, `WIREFRAMES.md`
- [x] Create interaction/animation notes (scroll animations, hover states, section transitions) → `ANIMATIONS.md`
- [x] Compile final design handoff package → `HANDOFF.md`

## Phase 1D: Review & Sign-off - COMPLETE

- [x] Review wireframes and provide feedback → `REVIEW-STRIPE-ALIGNMENT.md`
- [x] Review mockups and provide feedback → `REVIEW-STRIPE-ALIGNMENT.md`
- [x] Apply review recommendations to all design documents
- [x] Confirm all content is final and proofread

### Key Changes Applied from Stripe Alignment Review

| Change | Details |
|--------|---------|
| Hero headline rewritten | "Financial tools for the underbanked" (declarative, Stripe-style) |
| Section order changed | Stats moved from #7 to #3 (problem before products) |
| Nav CTA button added | "Start your application" button in navigation |
| "Mission" → "About" | Nav link renamed for broader utility |
| Copy fully rewritten | All sections use Stripe copy style (short, outcome-focused, no filler) |
| "Coming soon" → lead capture | Digital Credit gets "Get notified when we launch" with email/phone capture |
| CSS gradient default | WebGL is progressive enhancement, not default |
| Product naming standardized | Footer matches section labels (Asset financing, Digital credit, Enterprise partnerships) |
| Enterprise copy reframed | All "We" sentences rewritten to lead with customer outcomes |
| Product section padding reduced | 80px instead of 120px for deep-dives (tighter scroll) |
