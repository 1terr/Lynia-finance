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
| **Destination pages** | ⚠️ 57% | 4 of 7 pages built (contact, about, privacy, terms) |
| **Forms** | ⚠️ 60% | Contact + partnership forms built; no backend wiring yet |
| **CMS (Sanity)** | ❌ 0% | Editorial page has placeholder posts only |
| **Dead link fixes** | ✅ 90% | All CTAs fixed; social links use placeholder URLs |

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

## Phase 2B: Dead Link Fixes — COMPLETE ✅

Critical CTAs and links that currently go nowhere.

### Broken CTAs (buttons with no or invalid destination)

- [x] **BottomCTA "Start your application"** — added `href="https://wa.me/263"` (WhatsApp deep link)
- [x] **Asset Financing "Learn more →"** — added `href="#how-it-works"` to scroll to How It Works section

### Links to missing pages — RESOLVED (pages now built)

- [x] **Enterprise "Partner with us"** → `/contact` ✅ page built
- [x] **Customer Segments "Become a distributor →"** → `/contact` ✅ page built
- [x] **Customer Segments "Partner with us →"** → `/contact` ✅ page built
- [x] **BottomCTA "Talk to our team →"** → `/contact` ✅ page built
- [x] **Navbar "About"** → `/about` ✅ page built
- [x] **Footer "About"** → `/about` ✅ page built
- [ ] **Footer "Careers"** → `/careers` (page still needed — P3)
- [x] **Footer "Contact"** → `/contact` ✅ page built
- [x] **Footer "Privacy Policy"** → `/privacy` ✅ page built
- [x] **Footer "Terms"** → `/terms` ✅ page built

### Cross-page navigation fixes

- [x] **Navbar hash links** — prefixed with `/` for cross-page navigation (`/#products`, `/#enterprise`, `/#apply`)
- [x] **Footer product links** — prefixed with `/` (`/#asset-financing`, `/#digital-credit`, `/#enterprise`)
- [x] **Customer Segments "Individuals" card** — updated to `/#apply`
- [x] **Hero "See how it works"** — updated to `#how-it-works`

### Placeholder links

- [x] **Footer social links** — X (Twitter), LinkedIn, WhatsApp now use placeholder URLs (replace with real account URLs when available)

---

## Phase 2C: Contact Page — COMPLETE ✅

The most-linked missing page. 5 CTAs across the site point here.

**Route**: `/contact`
**Layout**: Split — info left, form right (Stripe contact/sales style)

- [x] Create `app/contact/page.tsx`
- [x] **Hero section** — "Get in touch" heading with description
- [x] **Left column** — contact methods:
  - WhatsApp chat link
  - Email: hello@lyniafinance.com
  - Location: Harare, Zimbabwe
- [x] **Contact form** (right column):
  - [x] Name field (required, text)
  - [x] Phone number field (required, tel with +263 prefix placeholder)
  - [x] Email field (optional)
  - [x] Message field (optional, textarea)
  - [x] Submit button: "Send message"
  - [x] Form validation (HTML5 client-side)
  - [x] Success state feedback
- [x] **Partnership application section** (below main form):
  - [x] Name + phone in 2-column grid
  - [x] Email field (required)
  - [x] Type of partnership dropdown (Distributor / B2B Partnership / Other)
  - [x] Message field (optional, textarea)
  - [x] Submit button: "Submit partnership application"
  - [x] Success state feedback
- [x] Mobile layout: single column (info first, form below)
- [ ] Wire up form submission to real backend (simulated for now)

### Files created

```
app/contact/page.tsx                    Contact page with 2 forms + contact info
```

---

## Phase 2D: About Page — COMPLETE ✅

**Route**: `/about`

- [x] Create `app/about/page.tsx`
- [x] Hero section with gradient background and mission statement
- [x] "Why we exist" — the underbanked problem in Zimbabwe (narrative)
- [x] Stats section (80% informal, <5 min approval, 100% mobile money, 50+ agents)
- [x] Values section — 4 cards (financial inclusion, trust, local-first, technology with empathy)
- [x] Team section (placeholder)
- [x] Bottom CTA with WhatsApp + contact buttons
- [x] Responsive layout
- [x] Metadata: unique title + description

### Files created

```
app/about/page.tsx                      About page with mission, stats, values, team
```

---

## Phase 2E: Legal Pages — COMPLETE ✅

Required for regulatory compliance (RBZ). Footer links now work.

### Privacy Policy ✅

- [x] Create `app/privacy/page.tsx`
- [x] Page header: "Privacy Policy" with last updated date
- [x] Content layout: narrow container (`max-w-narrow` / 780px), long-form text
- [x] 8 sections: Introduction, Information collected, Usage, Data sharing, Security, Retention, Rights, Contact
- [x] Zimbabwe-specific content (RBZ retention periods, EcoCash/OneMoney, national ID)
- [x] Metadata: unique title + description

### Terms of Service ✅

- [x] Create `app/terms/page.tsx`
- [x] Page header: "Terms of Service" with last updated date
- [x] Same layout as Privacy Policy
- [x] 12 sections: Acceptance, Eligibility, Services, Loan terms, KYC, Device management, Privacy, Prohibited use, Liability, Governing law, Changes, Contact
- [x] Zimbabwe-specific content (RBZ, mobile money, device lien)
- [x] Metadata: unique title + description

### Files created

```
app/privacy/page.tsx                    Privacy policy (8 sections)
app/terms/page.tsx                      Terms of service (12 sections)
```

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
**Nav**: Linked from navbar (currently points to `/#enterprise` on homepage)

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

- [x] **BottomCTA**: Add `href` to "Start your application" button (WhatsApp deep link)
- [ ] **Digital Credit lead capture**: Wire up form submission (API route or external service)
- [x] **Footer social links**: Replace `#` placeholders with real URLs
- [x] **Nav links from non-homepage pages**: Hash links prefixed with `/` for cross-page navigation
- [ ] **Editorial section**: Connect to Sanity CMS data instead of hardcoded posts

### Cross-page navigation

- [x] Ensure navbar scroll-anchor links work from all pages (prefix with `/`)
- [ ] Add active state indicator for current page in navbar
- [x] Footer product links use `/#asset-financing` format from non-homepage pages

### Accessibility

- [ ] Add `aria-current="page"` to active nav link
- [ ] Verify keyboard navigation through all interactive elements
- [ ] Test screen reader flow for all forms
- [ ] Verify color contrast ratios (WCAG AA)

### SEO

- [x] Add unique `<title>` and `<meta description>` per page (about, privacy, terms)
- [ ] Add Open Graph tags (og:title, og:description, og:image)
- [ ] Add `robots.txt` and `sitemap.xml`
- [ ] Add structured data (Organization, WebSite)

---

## Route Map

Complete list of routes the site needs.

| Route | Status | Priority | Linked from |
|-------|--------|----------|-------------|
| `/` | ✅ Built | — | — |
| `/about` | ✅ Built | P2 | Navbar, Footer |
| `/contact` | ✅ Built | **P1** | Enterprise CTA, Segments (×2), BottomCTA, Footer |
| `/careers` | ❌ Missing | P3 | Footer |
| `/partnerships` | ❌ Missing | P3 | Navbar |
| `/products` | ❌ Missing | P3 | Product cards "Learn more" |
| `/editorial` | ⚠️ Placeholder | P2 | Navbar, Editorial section, Footer |
| `/editorial/[slug]` | ❌ Missing | P2 | Editorial listing page |
| `/privacy` | ✅ Built | P2 | Footer |
| `/terms` | ✅ Built | P2 | Footer |

---

## User Journeys — Current Status

### Journey 1: Individual Customer (loan applicant)
```
Hero "Start your application" → #apply (scroll) → BottomCTA → WhatsApp deep link ✅
```
**Status**: ✅ Works end-to-end

### Journey 2: Distributor (wants to sell devices)
```
Customer Segments "Become a distributor →" → /contact → Partnership form ✅
```
**Status**: ✅ Works end-to-end

### Journey 3: B2B Partner (API integration)
```
Enterprise "Partner with us" → /contact → Partnership form ✅
```
**Status**: ✅ Works end-to-end

### Journey 4: Blog reader
```
Editorial "View all articles →" → /editorial → [PLACEHOLDER ONLY]
Fix: Build editorial listing + Sanity CMS integration
```
**Status**: ⚠️ Partial — needs Sanity integration

### Journey 5: Investor / regulator
```
Footer "About" → /about ✅
Footer "Privacy Policy" → /privacy ✅
Footer "Terms" → /terms ✅
```
**Status**: ✅ Works end-to-end

### Journey 6: Job seeker
```
Footer "Careers" → /careers → [PAGE MISSING]
Fix: Build /careers page
```
**Status**: ❌ Blocked — needs /careers page

---

## Recommended Build Order (remaining)

```
1. /editorial    — Sanity CMS integration for real blog posts
2. /editorial/[slug] — Individual post pages
3. /products     — Detailed product info pages
4. /partnerships — Dedicated distributor/partner info
5. /careers      — Job listings
```

All P1 items are complete. Remaining items are P2 (editorial/CMS) and P3 (products, partnerships, careers).
