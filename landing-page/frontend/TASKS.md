# Landing Page Frontend — Task Tracker

> Tracks all implementation work for lyniafinance.com.
> Design specs live in `../design/`. This file tracks the build.

---

## Overall Status

| Area | Progress | Notes |
|------|----------|-------|
| **Homepage (11 sections)** | ✅ 100% | All sections built, animations working |
| **Layout (Nav + Footer + FAB)** | ✅ 100% | Responsive, mobile menu, WhatsApp FAB |
| **Design tokens / Tailwind** | ✅ 100% | Full DESIGN-TOKENS.md mapped to config |
| **Destination pages** | ❌ 0% | 7 pages need building |
| **Forms** | ⚠️ 20% | Lead capture renders; no backend; contact/partnership missing |
| **CMS (Sanity)** | ❌ 0% | Editorial page has placeholder posts only |
| **Dead link fixes** | ❌ 0% | 10+ broken links/CTAs need destinations |

---

## Phase 2A: Homepage — COMPLETE ✅

All work from the initial frontend scaffold.

- [x] Scaffold Next.js 14 project (App Router, TypeScript, Tailwind CSS)
- [x] Map DESIGN-TOKENS.md to `tailwind.config.ts` (colors, type, shadows, spacing, radii, z-index)
- [x] Create `globals.css` with CSS custom properties (gradients, section utilities, reduced-motion)
- [x] Add landing-page to pnpm monorepo workspace
- [x] **Section 1 — Hero**: CSS gradient, headline + subtext + 2 CTAs, WhatsApp phone mockup with chat bubbles, staggered entrance animations
- [x] **Section 2 — Social Proof**: Stats bar with scroll-triggered fade-in
- [x] **Section 3 — Why Section (Stats)**: Gradient bg, count-up animation, 4 stat cards
- [x] **Section 4 — Product Suite**: 3-card grid with icons, hover lift, staggered entry
- [x] **Section 5 — Asset Financing**: Split layout (text L, visual R), 4-feature grid
- [x] **Section 6 — Digital Credit**: Dark section, lead capture form, 2-feature grid
- [x] **Section 7 — Enterprise**: Light bg, 3 features, "Partner with us" CTA
- [x] **Section 8 — Customer Segments**: 3 cards (Individuals, Distributors, Partners)
- [x] **Section 9 — Editorial**: 3-column blog card grid, placeholder posts
- [x] **Section 10 — Bottom CTA**: Gradient bg, headline + 2 CTAs
- [x] **Navbar**: Sticky, transparent→solid on scroll, mobile hamburger menu, CTA button
- [x] **Footer**: 4-column (Products, Company, Connect, Legal), RBZ disclaimer
- [x] **WhatsApp FAB**: Fixed bottom-right, tooltip on hover
- [x] **Scroll animations**: Intersection Observer hook (`useScrollAnimation`)
- [x] **Build verification**: 93.5 kB First Load JS (under 200KB target)

### Files created

```
app/layout.tsx                          Root layout (nav + footer + FAB)
app/page.tsx                            Homepage (11 sections composed)
components/ui/Button.tsx                4 variants (primary, secondary, ghost, white)
components/ui/SectionLabel.tsx          Overline label
components/ui/SectionContainer.tsx      Section wrapper with bg variants
components/layout/Navbar.tsx            Sticky nav with scroll detection
components/layout/Footer.tsx            4-column footer
components/layout/WhatsAppFAB.tsx       Floating action button
components/sections/Hero.tsx            Hero with gradient + phone mockup
components/sections/SocialProof.tsx     Stats trust bar
components/sections/WhySection.tsx      Stats with count-up animation
components/sections/ProductSuite.tsx    3-product card grid
components/sections/AssetFinancing.tsx  Product deep dive
components/sections/DigitalCredit.tsx   Product deep dive (dark) + lead capture
components/sections/Enterprise.tsx      Product deep dive (light)
components/sections/CustomerSegments.tsx  3 segment cards
components/sections/Editorial.tsx       Blog card grid (placeholder)
components/sections/BottomCTA.tsx       Final conversion CTA
lib/useScrollAnimation.ts              Intersection Observer hook
styles/globals.css                      Tailwind base + custom utilities
tailwind.config.ts                      Full design token mapping
```

---

## Phase 2B: Dead Link Fixes — PRIORITY 1

Critical CTAs and links that currently go nowhere.

### Broken CTAs (buttons with no or invalid destination)

- [ ] **BottomCTA "Start your application"** — add `href` to WhatsApp deep link (`https://wa.me/263...`)
  - File: `components/sections/BottomCTA.tsx`
  - The primary conversion button has no href attribute
- [ ] **Asset Financing "Learn more →"** — currently a `<Button>` with no href
  - File: `components/sections/AssetFinancing.tsx`
  - Should scroll to Asset Financing section or link to `/products#asset-financing`

### Links to missing pages

- [ ] **Enterprise "Partner with us"** → `/contact` (page doesn't exist)
- [ ] **Customer Segments "Become a distributor →"** → `/contact` (page doesn't exist)
- [ ] **Customer Segments "Partner with us →"** → `/contact` (page doesn't exist)
- [ ] **BottomCTA "Talk to our team →"** → `/contact` (page doesn't exist)
- [ ] **Navbar "About"** → `/about` (page doesn't exist)
- [ ] **Footer "About"** → `/about` (page doesn't exist)
- [ ] **Footer "Careers"** → `/careers` (page doesn't exist)
- [ ] **Footer "Contact"** → `/contact` (page doesn't exist)
- [ ] **Footer "Privacy Policy"** → `/privacy` (page doesn't exist)
- [ ] **Footer "Terms"** → `/terms` (page doesn't exist)

### Placeholder links

- [ ] **Footer social links** — X (Twitter), LinkedIn, WhatsApp all point to `#`
  - Need actual social media URLs or remove until available

---

## Phase 2C: Contact Page — PRIORITY 1

The most-linked missing page. 5 CTAs across the site point here.

**Route**: `/contact`
**Design spec**: `CONTENT.md` Section: Contact Page
**Layout**: Split — info left, form right (Stripe contact/sales style)

- [ ] Create `app/contact/page.tsx`
- [ ] **Left column** — "Get in touch" text + contact methods:
  - WhatsApp chat link
  - Email: hello@lyniafinance.com
  - Location: Harare, Zimbabwe
- [ ] **Contact form** (right column):
  - [ ] Name field (required, text)
  - [ ] Phone number field (required, tel with +263 prefix)
  - [ ] Email field (optional)
  - [ ] Message field (optional, textarea)
  - [ ] Submit button: "Send message"
  - [ ] Form validation (client-side)
  - [ ] Success/error state feedback
- [ ] **Partnership application section** (below main form):
  - [ ] Name field (required)
  - [ ] Phone number field (required)
  - [ ] Email field (required)
  - [ ] Type of partnership dropdown (Distributor / B2B Partnership / Other)
  - [ ] Message field (optional, textarea)
  - [ ] Submit button: "Submit partnership application"
- [ ] Mobile layout: single column (info first, form below)
- [ ] Form submission handling (store leads — can use `formsubmit.co` or API route initially)

---

## Phase 2D: About Page — PRIORITY 2

**Route**: `/about`
**Design spec**: HANDOFF.md (page listed), CONTENT.md (nav/footer reference)

- [ ] Create `app/about/page.tsx`
- [ ] Hero section with company mission statement
- [ ] "Why we exist" — the underbanked problem in Zimbabwe
- [ ] Vision & values section
- [ ] Team section (placeholder — photos/bios to be added later)
- [ ] Bottom CTA (reuse BottomCTA component or variant)
- [ ] Responsive layout

---

## Phase 2E: Legal Pages — PRIORITY 2

Required for regulatory compliance (RBZ). Footer links currently dead.

### Privacy Policy

- [ ] Create `app/privacy/page.tsx`
- [ ] Page header: "Privacy Policy"
- [ ] Content layout: narrow container (`max-w-narrow` / 780px), long-form text
- [ ] Placeholder legal text (to be replaced with real policy)
- [ ] Last updated date
- [ ] Table of contents sidebar (optional)

### Terms of Service

- [ ] Create `app/terms/page.tsx`
- [ ] Page header: "Terms of Service"
- [ ] Same layout as Privacy Policy
- [ ] Placeholder legal text
- [ ] Last updated date

---

## Phase 2F: Editorial Page (Sanity CMS) — PRIORITY 2

Homepage editorial section exists with placeholder posts. Full page needs CMS integration.

**Route**: `/editorial` (listing), `/editorial/[slug]` (individual post)
**Design spec**: CONTENT.md Section: Editorial Page (Blog)
**CMS**: Sanity (free tier)

### Editorial listing page

- [ ] Update `app/editorial/page.tsx` (or create if it doesn't exist)
- [ ] Featured post hero (large card at top)
- [ ] Category filter pills: All / Products / Engineering / Company / Market
- [ ] 3-column card grid (reuse BlogPostCard pattern from homepage)
- [ ] "Load more" pagination
- [ ] Responsive: 1-col mobile, 2-col tablet, 3-col desktop

### Individual post page

- [ ] Create `app/editorial/[slug]/page.tsx`
- [ ] Post header: title, category tag, date, author
- [ ] Featured image (full width)
- [ ] Rich text body (portable text from Sanity)
- [ ] Author bio footer
- [ ] "Related posts" section at bottom
- [ ] Back to editorial link

### Sanity CMS setup

- [ ] Install `@sanity/client` and `next-sanity`
- [ ] Create `lib/sanity.ts` — client configuration + GROQ queries
- [ ] Define Sanity schemas:
  - [ ] **Post**: title, slug, featured image, excerpt, body (rich text), category, author, publishedAt
  - [ ] **Author**: name, avatar, role
  - [ ] **Category**: name, slug, description
- [ ] Set up Sanity Studio (separate project or embedded)
- [ ] Create initial seed content (3 placeholder posts)
- [ ] Connect homepage Editorial section to real Sanity data

---

## Phase 2G: Products Page — PRIORITY 3

Detailed product pages linked from Product Suite cards.

**Route**: `/products` (overview), individual anchors or sub-pages

- [ ] Create `app/products/page.tsx`
- [ ] Full-page versions of the 3 product deep-dives:
  - [ ] Asset Financing — expanded features, how-it-works steps, FAQ
  - [ ] Digital Credit — expanded features, lead capture, FAQ
  - [ ] Enterprise Partnerships — API docs preview, integration steps, FAQ
- [ ] Each product section with anchor IDs for direct linking
- [ ] Update "Learn more →" links in ProductSuite cards to point here
- [ ] Bottom CTA section

---

## Phase 2H: Partnerships Page — PRIORITY 3

Dedicated page for distributor and B2B partnership info.

**Route**: `/partnerships`
**Nav**: Linked from navbar (currently points to `#enterprise` on homepage)

- [ ] Create `app/partnerships/page.tsx`
- [ ] Hero: "Partner with Lynia Finance"
- [ ] Distributor program section:
  - What distributors do
  - Commission structure
  - Requirements
  - "Become a distributor" CTA → contact form
- [ ] B2B API partnership section:
  - Integration overview
  - API capabilities
  - "Partner with us" CTA → contact form
- [ ] Partnership application form (reuse from contact page or embed)
- [ ] Update navbar "Partnerships" link to `/partnerships`

---

## Phase 2I: Careers Page — PRIORITY 3

**Route**: `/careers`

- [ ] Create `app/careers/page.tsx`
- [ ] Company culture section
- [ ] Open positions (can be placeholder initially)
- [ ] "Why work at Lynia" section
- [ ] Application CTA (email or contact form link)

---

## Phase 2J: Fixes & Polish — PRIORITY 3

### Homepage fixes

- [ ] **BottomCTA**: Add `href` to "Start your application" button (WhatsApp deep link)
- [ ] **Digital Credit lead capture**: Wire up form submission (API route or external service)
- [ ] **Footer social links**: Replace `#` placeholders with real URLs
- [ ] **Nav links from non-homepage pages**: Hash links (`#products`, `#apply`) don't work from other pages — prefix with `/` (e.g., `/#products`, `/#apply`)
- [ ] **Editorial section**: Connect to Sanity CMS data instead of hardcoded posts

### Cross-page navigation

- [ ] Ensure navbar scroll-anchor links work from all pages (prefix with `/`)
- [ ] Add active state indicator for current page in navbar
- [ ] Footer product links should use `/#asset-financing` format from non-homepage pages

### Accessibility

- [ ] Add `aria-current="page"` to active nav link
- [ ] Verify keyboard navigation through all interactive elements
- [ ] Test screen reader flow for all forms
- [ ] Verify color contrast ratios (WCAG AA)

### SEO

- [ ] Add unique `<title>` and `<meta description>` per page
- [ ] Add Open Graph tags (og:title, og:description, og:image)
- [ ] Add `robots.txt` and `sitemap.xml`
- [ ] Add structured data (Organization, WebSite)

---

## Route Map

Complete list of routes the site needs.

| Route | Status | Priority | Linked from |
|-------|--------|----------|-------------|
| `/` | ✅ Built | — | — |
| `/about` | ❌ Missing | P2 | Navbar, Footer |
| `/contact` | ❌ Missing | **P1** | Enterprise CTA, Segments (×2), BottomCTA, Footer |
| `/careers` | ❌ Missing | P3 | Footer |
| `/partnerships` | ❌ Missing | P3 | Navbar |
| `/products` | ❌ Missing | P3 | Product cards "Learn more" |
| `/editorial` | ⚠️ Placeholder | P2 | Navbar, Editorial section, Footer |
| `/editorial/[slug]` | ❌ Missing | P2 | Editorial listing page |
| `/privacy` | ❌ Missing | P2 | Footer |
| `/terms` | ❌ Missing | P2 | Footer |

---

## User Journeys — Current Status

### Journey 1: Individual Customer (loan applicant)
```
Hero "Start your application" → #apply (scroll) → BottomCTA → [DEAD END: no href]
Fix: Add WhatsApp deep link to BottomCTA primary button
```
**Status**: ⚠️ Almost works — 1 fix needed

### Journey 2: Distributor (wants to sell devices)
```
Customer Segments "Become a distributor →" → /contact → [PAGE MISSING]
Fix: Build /contact page with partnership form
```
**Status**: ❌ Blocked — needs /contact page

### Journey 3: B2B Partner (API integration)
```
Enterprise "Partner with us" → /contact → [PAGE MISSING]
Fix: Build /contact page with partnership form
```
**Status**: ❌ Blocked — needs /contact page

### Journey 4: Blog reader
```
Editorial "View all articles →" → /editorial → [PLACEHOLDER ONLY]
Fix: Build editorial listing + Sanity CMS integration
```
**Status**: ⚠️ Partial — needs Sanity integration

### Journey 5: Investor / regulator
```
Footer "About" → /about → [PAGE MISSING]
Footer "Privacy Policy" → /privacy → [PAGE MISSING]
Fix: Build /about, /privacy, /terms pages
```
**Status**: ❌ Blocked — needs all 3 pages

### Journey 6: Job seeker
```
Footer "Careers" → /careers → [PAGE MISSING]
Fix: Build /careers page
```
**Status**: ❌ Blocked — needs /careers page

---

## Recommended Build Order

```
1. /contact      — Unblocks 5+ CTAs across the site (highest ROI)
2. /about        — Unblocks nav + footer link, needed for credibility
3. /privacy      — Regulatory requirement (RBZ compliance)
4. /terms        — Regulatory requirement (RBZ compliance)
5. /editorial    — Sanity CMS integration for real blog posts
6. /editorial/[slug] — Individual post pages
7. /products     — Detailed product info pages
8. /partnerships — Dedicated distributor/partner info
9. /careers      — Job listings
```

Priority 1 fix: Add `href` to BottomCTA "Start your application" button — single line change that unblocks the entire individual customer journey.
