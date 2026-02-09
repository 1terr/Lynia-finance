# Lynia Finance - Landing Page Implementation Plan

**Created:** February 9, 2026
**Phase:** P4-T007 (Launch Marketing Materials)
**Status:** Planning
**Estimated Total Effort:** 48 hours

---

## Overview

The Lynia Finance landing page serves as the public-facing entry point for our device financing platform. It targets three key audiences:

1. **Customers** - Zimbabwe's informal sector workers seeking affordable smartphone financing
2. **Distributors/Agents** - Retail partners interested in joining the distribution network
3. **Investors/Partners** - Stakeholders evaluating the business opportunity

The landing page must be optimized for low-bandwidth connections, work on low-end devices, and communicate clearly to semi-literate users through visual storytelling and simple language.

---

## Technical Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 14 (App Router) | Framework (consistent with admin-portal) |
| Tailwind CSS | Styling |
| Framer Motion | Animations (lightweight, tree-shakable) |
| next/image | Optimized image delivery |
| Supabase | Waitlist/contact form submissions |
| Vercel | Hosting (free tier, edge CDN) |

### Performance Targets

- **First Contentful Paint (FCP):** < 1.2s
- **Largest Contentful Paint (LCP):** < 2.0s
- **Time to Interactive (TTI):** < 2.5s
- **Initial bundle size:** < 100KB (gzipped)
- **Lighthouse Performance Score:** > 95
- **3G connection load time:** < 5s

---

## Page Structure

### 1. Hero Section
- Bold headline: "Affordable Smartphones for Every Zimbabwean"
- Sub-headline explaining the WhatsApp-first financing model
- Primary CTA: "Get Started on WhatsApp" (deep link to WhatsApp bot)
- Secondary CTA: "Become a Distributor"
- Hero image: Diverse Zimbabwean customers using smartphones

### 2. How It Works
- 4-step visual flow:
  1. **Message Us** - Start a conversation on WhatsApp
  2. **Quick Verification** - Submit your ID for fast KYC
  3. **Choose Your Phone** - Browse available devices and plans
  4. **Pay & Collect** - Pay your deposit via EcoCash and collect from a distributor
- Simple icons/illustrations for each step
- Designed for semi-literate comprehension (visual-first)

### 3. Available Devices
- Grid of 3-4 featured phone models
- Each card shows: device image, name, monthly payment amount, total term
- Currency display: USD with ZWL equivalent
- "View All Phones" link to WhatsApp catalog

### 4. Why Lynia
- Trust indicators and value propositions:
  - No bank account required
  - Pay via EcoCash or mobile money
  - Flexible repayment plans (up to 8 months)
  - Transparent pricing - no hidden fees
  - Thousands of customers served (social proof metric)

### 5. Distributor Section
- Value proposition for retail partners
- Commission structure overview
- "Become a Distributor" CTA with application form/WhatsApp link
- Map or list of existing distribution points

### 6. Testimonials
- 3-4 customer stories with photos
- Focus on real impact: business growth, education access, family connectivity
- Shona/Ndebele quotes with English translations

### 7. FAQ Section
- Expandable accordion component
- Common questions:
  - What documents do I need?
  - What happens if I miss a payment?
  - Can I pay off early?
  - Which phones are available?
  - How long does approval take?

### 8. Footer
- Company info and registration details
- WhatsApp contact link
- Social media links
- Privacy policy and terms of service links
- Language selector (English / Shona / Ndebele)

---

## Multi-Language Support

The landing page must support three languages from day one:

| Language | Coverage | Notes |
|----------|----------|-------|
| English | 100% | Default language |
| Shona | 100% | ~70% of Zimbabwe population |
| Ndebele | 100% | ~20% of Zimbabwe population |

Implementation via `next-intl` or custom i18n with URL-based locale routing:
- `lynia.co.zw/en` (English)
- `lynia.co.zw/sn` (Shona)
- `lynia.co.zw/nd` (Ndebele)

---

## SEO Strategy

- Server-side rendered for full crawlability
- Structured data (JSON-LD) for organization and product offers
- Open Graph and Twitter Card meta tags
- Target keywords:
  - "smartphone financing Zimbabwe"
  - "buy phone on credit Zimbabwe"
  - "EcoCash phone installment"
  - "affordable phones Harare"
  - "device financing no bank account"

---

## Analytics & Tracking

- Plausible Analytics (privacy-friendly, GDPR-compliant, lightweight)
- Event tracking for:
  - WhatsApp CTA clicks
  - Distributor application clicks
  - FAQ interactions
  - Language switches
  - Device card views
- UTM parameter support for campaign tracking

---

## Mobile-First Design

Given that 95%+ of our target users access the internet via mobile:

- **Mobile-first responsive design** (breakpoints: 320px, 768px, 1024px, 1440px)
- **Touch-optimized**: Minimum 48px tap targets, adequate spacing
- **Reduced motion**: Respect `prefers-reduced-motion` media query
- **Offline support**: Service worker for basic offline page
- **Image optimization**: WebP with JPEG fallback, lazy loading, responsive srcset
- **Font optimization**: System font stack (no custom font downloads on initial load)

---

## Accessibility

- WCAG 2.1 AA compliance
- Semantic HTML5 structure
- Keyboard navigation for all interactive elements
- Screen reader tested
- Color contrast ratio >= 4.5:1 for all text
- Alt text for all images
- Skip-to-content link

---

## Project Directory Structure

```
frontend/
└── landing-page/
    ├── src/
    │   ├── app/
    │   │   ├── [locale]/
    │   │   │   ├── page.tsx          # Main landing page
    │   │   │   ├── layout.tsx        # Locale layout
    │   │   │   ├── privacy/page.tsx  # Privacy policy
    │   │   │   └── terms/page.tsx    # Terms of service
    │   │   ├── layout.tsx            # Root layout
    │   │   └── globals.css           # Global styles
    │   ├── components/
    │   │   ├── Hero.tsx
    │   │   ├── HowItWorks.tsx
    │   │   ├── DeviceGrid.tsx
    │   │   ├── WhyLynia.tsx
    │   │   ├── DistributorSection.tsx
    │   │   ├── Testimonials.tsx
    │   │   ├── FAQ.tsx
    │   │   ├── Footer.tsx
    │   │   ├── Header.tsx
    │   │   └── LanguageSwitcher.tsx
    │   ├── i18n/
    │   │   ├── en.json
    │   │   ├── sn.json
    │   │   └── nd.json
    │   └── lib/
    │       ├── analytics.ts
    │       └── supabase.ts
    ├── public/
    │   ├── images/
    │   ├── icons/
    │   └── og-image.png
    ├── next.config.js
    ├── tailwind.config.ts
    ├── tsconfig.json
    └── package.json
```

---

## Implementation Tasks

See [LANDING-PAGE-ISSUES.md](./LANDING-PAGE-ISSUES.md) for the full breakdown of GitHub issues.

| Task ID | Title | Priority | Est. Hours |
|---------|-------|----------|------------|
| LP-001 | Project scaffolding and configuration | Critical | 4 |
| LP-002 | Header and navigation component | High | 3 |
| LP-003 | Hero section | Critical | 4 |
| LP-004 | How It Works section | High | 4 |
| LP-005 | Device grid section | High | 4 |
| LP-006 | Why Lynia / trust section | Medium | 3 |
| LP-007 | Distributor section | Medium | 3 |
| LP-008 | Testimonials section | Medium | 3 |
| LP-009 | FAQ section | Medium | 2 |
| LP-010 | Footer component | Medium | 2 |
| LP-011 | Multi-language support (i18n) | High | 6 |
| LP-012 | SEO, meta tags, and structured data | High | 3 |
| LP-013 | Analytics integration | Medium | 2 |
| LP-014 | Performance optimization and testing | High | 3 |
| LP-015 | Accessibility audit and fixes | High | 2 |

**Total Estimated:** 48 hours

---

## Dependencies

- Brand assets (logo, color palette, typography) - use existing admin-portal theme as baseline
- Customer testimonials and photos (can use placeholders initially)
- Device catalog data (pull from existing payment-service/device inventory)
- WhatsApp bot deep link URL
- Domain configuration (lynia.co.zw)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| WhatsApp CTA click-through | > 5% of visitors | Analytics events |
| Distributor inquiries | > 10/week | Form submissions |
| Page load time (3G) | < 5 seconds | Lighthouse |
| Bounce rate | < 60% | Analytics |
| Mobile usability score | 100/100 | Google Search Console |
