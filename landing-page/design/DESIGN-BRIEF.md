# Lynia Finance Landing Page - Design Brief

> **Status**: All inputs received. Ready for content preparation and design execution.
>
> Items marked **[TODO]** still need content to be written/sourced.
> Items marked **[PENDING]** require a separate deliverable (e.g., PDF content).

---

## 1. Project Overview

- **Website URL**: lyniafinance.com
- **Type**: Public marketing / landing page
- **Primary Goal**: Attract sign-ups for B2C and B2B customers
- **Secondary Goals**: Build trust with partners, investors, and regulators
- **Launch Target Date**: Already launched (redesign/improvement in progress)

---

## 2. Target Audience

| # | Audience | Purpose |
|---|----------|---------|
| 1 | Potential borrowers (informal workers) | Semi-literate, WhatsApp-first, low-data devices |
| 2 | Distributors and agents | Partnership opportunities, agent network |
| 3 | B2B customers | Companies with platforms where Lynia can lend to their customers via API/data partnerships |
| 4 | Investors | Build conviction in the business |
| 5 | Regulators | Build trust and demonstrate compliance |
| 6 | Press / media | Access media assets and news |
| 7 | Job seekers | Express interest, apply, and learn about the culture |

---

## 3. Site Map

| Page / Section | Include | Name on Site |
|----------------|---------|-------------|
| Hero / Above the fold | Yes | _(homepage hero)_ |
| How It Works | No | _(excluded)_ |
| Features / Benefits | Yes | **Products** |
| About Us / Mission | Yes | **Mission** |
| For Distributors | Yes | **Partnerships** |
| For Investors | No | _(excluded)_ |
| Testimonials / Social Proof | No | _(excluded)_ |
| FAQ | No | _(excluded)_ |
| Contact / Get in Touch | Yes | **Contact** |
| Blog / News | Yes | **Research** |
| Careers | No | _(excluded)_ |
| Privacy Policy / Terms | Yes | **Privacy Policy / Terms** |

### Confirmed Navigation Structure

```
Home (Hero)  |  Products  |  Mission  |  Partnerships  |  Research  |  Contact
```

Footer: Privacy Policy, Terms

---

## 4. Key Messaging

### 4.1 Value Propositions to Feature

| Value Proposition | Feature? | Display Text |
|-------------------|----------|-------------|
| Instant approval in under 5 minutes via WhatsApp | Yes | Instant approval in under 5 minutes via WhatsApp |
| 100% WhatsApp-based, zero app downloads needed | Yes | _(feature on Products page)_ |
| Designed for informal sector workers with no credit history | Yes | _(core messaging)_ |
| AI/ML scoring based on mobile money behavior | No | _(internal, don't feature)_ |
| Revenue-linked repayment adapts to irregular income | No | _(internal, don't feature)_ |
| Device financing from $100, 8-month repayment | Yes | Device financing from $100, 8-month repayment |

### 4.2 Headline / Tagline

- **Primary headline**: **[TODO]** - to be written during content phase
- **Tagline / sub-headline**: **[TODO]** - to be written during content phase
- **CTA button text**: **[TODO]** - to be written during content phase

### 4.3 Tone of Voice

Established brand voice applies:
- Friendly but professional
- Supportive and encouraging
- Clear and direct
- Zimbabwean context-aware
- 8th-grade reading level maximum
- Avoid financial jargon

**Landing page adjustment**: More polished and corporate for the B2B/investor/regulator audiences while remaining accessible for borrowers.

---

## 5. Brand Identity

### 5.1 Logo

- **Status**: Not yet available
- **Action**: Logo design is part of this phase

### 5.2 Color Palette

**Direction**: Vibrant blue like Stanbic Bank or Coinbase - bold, trustworthy, modern.

#### Reference Palettes

| Brand | Primary Blue | Dark | Light |
|-------|-------------|------|-------|
| Coinbase | `#0052FF` | `#0A0B0D` | `#FFFFFF` |
| Moniepoint | `#0357EE` | `#02102D` | `#FFFFFF` |
| Stanbic Bank | `#4881B0` | `#0A2240` | `#FFFFFF` |
| Current Lynia (admin) | `#2563eb` | `#1e3a8a` | `#eff6ff` |

#### Recommended Lynia Landing Page Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#0052FF` | Brand blue (Coinbase-inspired, vibrant) |
| Primary Dark | `#003ECB` | Hover states, active elements |
| Primary Light | `#E6EEFF` | Backgrounds, cards |
| Dark / Navy | `#0A1628` | Text, headers, dark sections |
| White | `#FFFFFF` | Backgrounds |
| Black | `#0A0A0A` | Body text |
| Accent Blue 1 | `#3B7BF6` | Secondary buttons, links |
| Accent Blue 2 | `#60A5FA` | Highlights, badges |

- **Additional accents**: Blue variations, white, and black only
- **Colors to avoid**: Pink, purple (too minimalist / off-brand)

### 5.3 Typography

**Direction**: Match Stripe.com's typographic feel - clean, geometric, modern.

Stripe uses **Söhne** by Klim Type Foundry (licensed font). Recommended open-source alternatives that achieve the same feel:

| Option | Heading Font | Body Font | Notes |
|--------|-------------|-----------|-------|
| **A (Recommended)** | **Inter** | **Inter** | Closest to Söhne feel. Free, variable weight, excellent readability. Used by many fintech sites. |
| B | **DM Sans** | **Inter** | Slightly softer geometric headings, clean body. |
| C | **Geist** | **Geist** | Vercel's own font. Very Stripe-like. Free. |

### 5.4 Imagery & Illustrations

- **Style**: Flat illustrations, similar to Stripe.com's aesthetic
- **Existing assets**: None - to be sourced/created
- **Illustration approach**: Flat, modern, clean vector illustrations
- **Icons**: Modern design (recommended: **Lucide** or **Phosphor** icon sets - both open source, modern, consistent)
- **Photography**: Illustrations preferred over photography

---

## 6. Functional Requirements

### 6.1 Primary CTA

- **[TODO]** - CTA behavior to be defined during content phase
- WhatsApp floating button confirmed (always visible)

### 6.2 Forms & Interactions

| Form | Fields | Notes |
|------|--------|-------|
| **Contact form** | Name (required), Phone number (required), Email (optional) | General inquiries |
| **Partnership application** | Name, Phone number, Email, Type of partnership (Distributor / B2B Partnership / Other) | On Partnerships page |
| **WhatsApp floating button** | Yes | Persistent across all pages |

### 6.3 Languages

- **English only** at launch

### 6.4 Analytics & Tracking

- **Google Analytics**: Yes
- **Meta (Facebook) Pixel**: Yes

---

## 7. Technical Preferences

| Decision | Choice |
|----------|--------|
| **Framework** | Next.js |
| **Hosting** | AWS (aligned with current stack) |
| **CMS** | TBD - needs cost-effective and scalable option (recommended: **Sanity** free tier or **Keystatic** - both headless, scalable, generous free tiers) |
| **SEO priority** | High |
| **Performance budget** | Must work excellently on 2G and 3G connections |

### Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint (FCP) | < 1.5s on 3G |
| Largest Contentful Paint (LCP) | < 2.5s on 3G |
| Time to Interactive (TTI) | < 3.5s on 3G |
| Total page weight | < 200KB initial load |
| Lighthouse Performance | > 90 |

---

## 8. Inspiration References

| Website | Design Takeaways |
|---------|-----------------|
| **Stripe.com** | Clean typography (Söhne), flat illustrations, gradient backgrounds, smooth animations, content-heavy but uncluttered. Premium fintech feel. |
| **Moniepoint.com** | Bold blue (`#0357EE`) + deep navy (`#02102D`). African fintech. Trust-focused. "Kamona" design system. Clean sections. |
| **Paystack.com** | Vibrant, uncluttered, animated illustrations. African fintech (Stripe-owned). Simple navigation. Quick onboarding feel. |

**Common patterns across all three**:
- Bold blue primary color with dark navy + white
- Flat/geometric illustrations (no stock photos)
- Clean sans-serif typography
- Generous whitespace
- Subtle animations on scroll
- Strong hero section with clear CTA
- Mobile-first responsive design

---

## 9. Constraints & Non-Negotiables

| Constraint | Detail |
|------------|--------|
| **Budget** | Unlimited |
| **Must-have for launch** | All confirmed pages and features |
| **Colors to avoid** | Pink, purple - considered too minimalist / off-brand |
| **Regulatory disclaimers** | RBZ (Reserve Bank of Zimbabwe) compliance required |
| **Design style** | NOT minimalist - should feel vibrant and substantial |

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Page load speed | Very fast, especially on 2G/3G |
| Sign-ups (B2C) | High volume of WhatsApp/contact sign-ups |
| Partner trust | Credibility with potential B2B partners |
| Investor confidence | Professional enough to build conviction |
| Regulatory trust | Demonstrates compliance and legitimacy |

---

## 11. Outstanding Items

| Item | Status | Action |
|------|--------|--------|
| Logo design | Not started | Part of design phase |
| Page content (copy) | **[PENDING]** | User mentioned "attached PDF" with pages/sections content - needs to be provided |
| Headline / tagline | Not started | To be written during content phase |
| CTA button text | Not started | To be written during content phase |
| CMS selection | Needs recommendation | Sanity or Keystatic suggested |
| Illustrations | Not started | To be created in Stripe-like flat style |
