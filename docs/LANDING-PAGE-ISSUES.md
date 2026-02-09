# Landing Page - GitHub Issues

**Created:** February 9, 2026
**Total Issues:** 15
**Phase:** P4-T007 (Launch Marketing Materials)
**Estimated Total Effort:** 48 hours
**Plan Document:** [LANDING-PAGE-PLAN.md](./LANDING-PAGE-PLAN.md)

---

## Quick Links

- **All Landing Page Issues:** `gh issue list --label "landing-page"`
- **Plan Document:** [LANDING-PAGE-PLAN.md](./LANDING-PAGE-PLAN.md)

---

## Issues Summary

| Task ID | Title | Priority | Est. Hours | Labels |
|---------|-------|----------|------------|--------|
| LP-001 | Project Scaffolding & Configuration | Critical | 4h | landing-page, setup, critical |
| LP-002 | Header & Navigation Component | High | 3h | landing-page, component, high-priority |
| LP-003 | Hero Section | Critical | 4h | landing-page, component, critical |
| LP-004 | How It Works Section | High | 4h | landing-page, component, high-priority |
| LP-005 | Device Grid Section | High | 4h | landing-page, component, high-priority |
| LP-006 | Why Lynia / Trust Section | Medium | 3h | landing-page, component, medium-priority |
| LP-007 | Distributor Section | Medium | 3h | landing-page, component, medium-priority |
| LP-008 | Testimonials Section | Medium | 3h | landing-page, component, medium-priority |
| LP-009 | FAQ Section | Medium | 2h | landing-page, component, medium-priority |
| LP-010 | Footer Component | Medium | 2h | landing-page, component, medium-priority |
| LP-011 | Multi-Language Support (i18n) | High | 6h | landing-page, i18n, high-priority |
| LP-012 | SEO, Meta Tags & Structured Data | High | 3h | landing-page, seo, high-priority |
| LP-013 | Analytics Integration | Medium | 2h | landing-page, analytics, medium-priority |
| LP-014 | Performance Optimization & Testing | High | 3h | landing-page, performance, high-priority |
| LP-015 | Accessibility Audit & Fixes | High | 2h | landing-page, accessibility, high-priority |

**Total:** 48 hours

---

## Issue Details

### LP-001: Project Scaffolding & Configuration

**Priority:** Critical | **Est:** 4 hours
**Labels:** `landing-page`, `setup`, `critical`
**Dependencies:** None

#### Description

Initialize the Next.js 14 landing page project under `frontend/landing-page/` with all required configuration and tooling.

#### Acceptance Criteria

- [ ] Next.js 14 App Router project initialized with TypeScript
- [ ] Tailwind CSS configured with Lynia brand color palette
- [ ] ESLint and Prettier configured (consistent with admin-portal)
- [ ] `tsconfig.json` with strict mode enabled
- [ ] Shared Tailwind theme tokens (colors, fonts, spacing) extracted from admin-portal
- [ ] `next.config.js` with image optimization, compression, and security headers
- [ ] Basic `layout.tsx` with metadata, viewport, and font configuration
- [ ] Vercel deployment configuration (or equivalent)
- [ ] Package scripts: `dev`, `build`, `start`, `lint`, `test`

#### Technical Notes

- Use `pnpm` for package management (consistent with monorepo)
- Reuse Tailwind color palette from `frontend/admin-portal/tailwind.config.ts`
- Configure `next/image` with allowed domains for device images
- Add security headers: X-Content-Type-Options, X-Frame-Options, CSP

---

### LP-002: Header & Navigation Component

**Priority:** High | **Est:** 3 hours
**Labels:** `landing-page`, `component`, `high-priority`
**Dependencies:** LP-001

#### Description

Build a responsive header with the Lynia logo, navigation links, language switcher, and primary CTA button.

#### Acceptance Criteria

- [ ] Fixed header with transparent-to-solid background on scroll
- [ ] Lynia logo (link to homepage)
- [ ] Navigation links: How It Works, Phones, For Distributors, FAQ
- [ ] Smooth scroll to section anchors on click
- [ ] Language switcher component (EN / SN / ND)
- [ ] Primary CTA button: "Get Started" (WhatsApp deep link)
- [ ] Mobile hamburger menu with slide-out drawer
- [ ] Keyboard accessible navigation
- [ ] All text content externalized for i18n

#### Technical Notes

- Use `IntersectionObserver` for scroll-based header style changes
- WhatsApp deep link format: `https://wa.me/263XXXXXXXXX?text=Hi`
- Mobile menu should trap focus when open (accessibility)

---

### LP-003: Hero Section

**Priority:** Critical | **Est:** 4 hours
**Labels:** `landing-page`, `component`, `critical`
**Dependencies:** LP-001

#### Description

Create the hero section with headline, sub-headline, CTAs, and hero image. This is the first thing visitors see and must immediately communicate Lynia's value proposition.

#### Acceptance Criteria

- [ ] Bold headline: "Affordable Smartphones for Every Zimbabwean" (localized)
- [ ] Sub-headline explaining WhatsApp-first financing in simple language
- [ ] Primary CTA: "Get Started on WhatsApp" with WhatsApp icon
- [ ] Secondary CTA: "Become a Distributor"
- [ ] Hero image/illustration optimized for mobile and desktop
- [ ] Responsive layout: stacked on mobile, side-by-side on desktop
- [ ] Background gradient or pattern consistent with brand
- [ ] Subtle entrance animation (respects `prefers-reduced-motion`)
- [ ] All text externalized for i18n

#### Technical Notes

- Use `next/image` with priority loading for hero image (LCP element)
- Provide WebP and JPEG formats with responsive srcset
- CTA buttons must have minimum 48px height for touch targets
- Test with slow 3G to ensure hero loads acceptably

---

### LP-004: How It Works Section

**Priority:** High | **Est:** 4 hours
**Labels:** `landing-page`, `component`, `high-priority`
**Dependencies:** LP-001

#### Description

Visual 4-step flow explaining the customer journey from WhatsApp message to phone collection. Must be comprehensible to semi-literate users through visual design.

#### Acceptance Criteria

- [ ] Section heading: "How It Works"
- [ ] 4 steps with icon, number, title, and short description:
  1. Message Us on WhatsApp
  2. Quick ID Verification
  3. Choose Your Phone
  4. Pay & Collect
- [ ] Visual connector lines/arrows between steps
- [ ] Responsive: horizontal on desktop, vertical on mobile
- [ ] Icons are clear and universally understandable
- [ ] Scroll-triggered entrance animation (staggered)
- [ ] All text externalized for i18n

#### Technical Notes

- Use SVG icons for crisp rendering at all sizes
- Consider using Lottie animations for step icons (keep total under 50KB)
- Connector lines via CSS (not images) for flexibility

---

### LP-005: Device Grid Section

**Priority:** High | **Est:** 4 hours
**Labels:** `landing-page`, `component`, `high-priority`
**Dependencies:** LP-001

#### Description

Showcase 3-4 featured phone models with pricing and payment plan information. Drive users to start a WhatsApp conversation for the full catalog.

#### Acceptance Criteria

- [ ] Section heading: "Choose Your Phone"
- [ ] Grid of 3-4 device cards (2 columns mobile, 3-4 columns desktop)
- [ ] Each card shows: device image, name, monthly payment, total term, deposit amount
- [ ] Currency display in USD with ZWL equivalent shown
- [ ] "View Details" CTA per card (links to WhatsApp with pre-filled message)
- [ ] "View All Phones" link at section bottom
- [ ] Card hover/tap effects for interactivity
- [ ] Placeholder device data (replaceable with real catalog)
- [ ] All text and pricing externalized for i18n and easy updates

#### Technical Notes

- Use `next/image` with lazy loading for device images
- Money formatting: `$XX.XX/month` with thousand separators
- Device data should be in a separate JSON/config file for easy updates
- Consider using Supabase to fetch live device catalog in future iteration

---

### LP-006: Why Lynia / Trust Section

**Priority:** Medium | **Est:** 3 hours
**Labels:** `landing-page`, `component`, `medium-priority`
**Dependencies:** LP-001

#### Description

Build trust with potential customers by highlighting key value propositions and differentiators. Address common concerns about device financing.

#### Acceptance Criteria

- [ ] Section heading: "Why Choose Lynia"
- [ ] 4-6 value proposition cards with icons:
  - No bank account required
  - Pay via EcoCash or mobile money
  - Flexible plans up to 8 months
  - No hidden fees - transparent pricing
  - Fast approval via WhatsApp
  - Trusted by X+ customers (social proof counter)
- [ ] Clean grid layout (2 columns mobile, 3 columns desktop)
- [ ] Animated counter for social proof metric
- [ ] All text externalized for i18n

#### Technical Notes

- Use `IntersectionObserver` to trigger counter animation on scroll
- Social proof number should be configurable (environment variable or config)

---

### LP-007: Distributor Section

**Priority:** Medium | **Est:** 3 hours
**Labels:** `landing-page`, `component`, `medium-priority`
**Dependencies:** LP-001

#### Description

Dedicated section targeting potential distribution partners. Explain the partnership model and provide a clear path to apply.

#### Acceptance Criteria

- [ ] Section heading: "Become a Lynia Distributor"
- [ ] Value proposition for distributors:
  - Earn commission on every device sold
  - No upfront inventory cost
  - Training and support provided
  - Real-time dashboard for tracking sales
- [ ] CTA: "Apply to Become a Distributor" (WhatsApp or form)
- [ ] Optional: embedded waitlist/interest form (name, phone, location, business type)
- [ ] If form used, submit to Supabase `distributor_inquiries` table
- [ ] Visual distinction from customer-facing sections (different background)
- [ ] All text externalized for i18n

#### Technical Notes

- Form validation: Zimbabwe phone number format (+263...), required fields
- Rate limit form submissions (prevent spam)
- Send confirmation message via WhatsApp on form submission (future)

---

### LP-008: Testimonials Section

**Priority:** Medium | **Est:** 3 hours
**Labels:** `landing-page`, `component`, `medium-priority`
**Dependencies:** LP-001

#### Description

Customer success stories that build trust and show real-world impact. Include quotes in local languages with English translations.

#### Acceptance Criteria

- [ ] Section heading: "What Our Customers Say"
- [ ] 3-4 testimonial cards with:
  - Customer photo (placeholder avatar initially)
  - Customer name and location
  - Quote in original language (Shona/Ndebele)
  - English translation below
  - Star rating (optional)
- [ ] Carousel/slider on mobile, grid on desktop
- [ ] Smooth auto-advance with pause on hover/touch
- [ ] Navigation dots or arrows
- [ ] All text externalized for i18n

#### Technical Notes

- Use placeholder testimonials initially (clearly marked for replacement)
- Photos: use `next/image` with blur placeholder
- Carousel: use CSS scroll-snap for lightweight implementation (no heavy library)

---

### LP-009: FAQ Section

**Priority:** Medium | **Est:** 2 hours
**Labels:** `landing-page`, `component`, `medium-priority`
**Dependencies:** LP-001

#### Description

Expandable FAQ accordion addressing common customer questions about the financing process.

#### Acceptance Criteria

- [ ] Section heading: "Frequently Asked Questions"
- [ ] 6-8 FAQ items in accordion format
- [ ] Questions cover:
  - Required documents for application
  - Payment methods accepted
  - What happens on missed payment
  - Early payoff options
  - Available phone models
  - Approval timeline
  - Coverage areas
  - Contact/support options
- [ ] Smooth expand/collapse animation
- [ ] Only one item open at a time (or allow multiple - configurable)
- [ ] Keyboard accessible (Enter/Space to toggle)
- [ ] Schema.org FAQPage structured data for SEO
- [ ] All text externalized for i18n

#### Technical Notes

- Use `<details>/<summary>` as base for native accessibility, enhanced with JS
- Add FAQPage JSON-LD schema for Google rich results
- Keep answers concise (2-3 sentences max)

---

### LP-010: Footer Component

**Priority:** Medium | **Est:** 2 hours
**Labels:** `landing-page`, `component`, `medium-priority`
**Dependencies:** LP-001

#### Description

Site footer with company info, navigation links, legal links, and contact information.

#### Acceptance Criteria

- [ ] Lynia logo and tagline
- [ ] Navigation links (mirror header sections)
- [ ] Legal links: Privacy Policy, Terms of Service
- [ ] Contact: WhatsApp link, email address
- [ ] Social media links (if applicable)
- [ ] Language selector (duplicate of header for convenience)
- [ ] Company registration info (Zimbabwe business registration)
- [ ] Copyright notice with current year
- [ ] Responsive layout: stacked on mobile, multi-column on desktop
- [ ] All text externalized for i18n

#### Technical Notes

- Privacy Policy and Terms pages can be static markdown rendered pages initially
- Use `new Date().getFullYear()` for copyright year

---

### LP-011: Multi-Language Support (i18n)

**Priority:** High | **Est:** 6 hours
**Labels:** `landing-page`, `i18n`, `high-priority`
**Dependencies:** LP-001, LP-002 through LP-010

#### Description

Implement full internationalization for English, Shona, and Ndebele. All user-facing text must be translatable.

#### Acceptance Criteria

- [ ] i18n framework configured (`next-intl` or equivalent)
- [ ] URL-based locale routing: `/en`, `/sn`, `/nd`
- [ ] Default locale: English (`/en`)
- [ ] Complete English translation file (`en.json`)
- [ ] Complete Shona translation file (`sn.json`) - placeholder translations acceptable initially
- [ ] Complete Ndebele translation file (`nd.json`) - placeholder translations acceptable initially
- [ ] Language switcher updates URL and persists preference (cookie/localStorage)
- [ ] SEO: `hreflang` tags for all locale variants
- [ ] Metadata (title, description) localized per language
- [ ] Right-to-left (RTL) not required (all three languages are LTR)
- [ ] Locale detection from browser `Accept-Language` header for initial visit

#### Technical Notes

- Translation keys should be namespaced by section: `hero.headline`, `faq.q1`, etc.
- Use ICU message format for plurals and interpolation
- Shona and Ndebele translations should be reviewed by native speakers before launch
- Keep translation files flat (max 2 levels of nesting) for maintainability

---

### LP-012: SEO, Meta Tags & Structured Data

**Priority:** High | **Est:** 3 hours
**Labels:** `landing-page`, `seo`, `high-priority`
**Dependencies:** LP-001, LP-011

#### Description

Implement comprehensive SEO optimization including meta tags, Open Graph, Twitter Cards, and structured data.

#### Acceptance Criteria

- [ ] Page title and meta description optimized for target keywords
- [ ] Open Graph tags: title, description, image, type, url, locale
- [ ] Twitter Card tags: card, title, description, image
- [ ] Canonical URL set correctly per locale
- [ ] `hreflang` alternate links for all supported locales
- [ ] JSON-LD structured data:
  - Organization schema
  - Product offers (device financing)
  - FAQPage schema
- [ ] `robots.txt` configured
- [ ] XML sitemap generated (`next-sitemap`)
- [ ] Favicon and Apple touch icon set
- [ ] OG image (1200x630px) designed and optimized

#### Technical Notes

- Use Next.js 14 Metadata API for all meta tags
- OG image can be statically generated or use `next/og` for dynamic generation
- Verify structured data with Google Rich Results Test
- Submit sitemap to Google Search Console after deployment

---

### LP-013: Analytics Integration

**Priority:** Medium | **Est:** 2 hours
**Labels:** `landing-page`, `analytics`, `medium-priority`
**Dependencies:** LP-001

#### Description

Integrate privacy-friendly analytics to track visitor behavior and conversion metrics.

#### Acceptance Criteria

- [ ] Plausible Analytics (or similar privacy-friendly tool) integrated
- [ ] Page view tracking automatic
- [ ] Custom event tracking for:
  - WhatsApp CTA clicks (hero, header, device cards)
  - Distributor application clicks/submissions
  - Language switch events
  - FAQ item interactions
  - Scroll depth milestones (25%, 50%, 75%, 100%)
- [ ] UTM parameter preservation and tracking
- [ ] Analytics script loaded asynchronously (no render blocking)
- [ ] Consent not required (Plausible is cookie-free)

#### Technical Notes

- Use `data-analytics` attributes for declarative event tracking
- Create analytics utility: `trackEvent(name: string, props?: Record<string, string>)`
- Ensure analytics works with locale routing

---

### LP-014: Performance Optimization & Testing

**Priority:** High | **Est:** 3 hours
**Labels:** `landing-page`, `performance`, `high-priority`
**Dependencies:** LP-001 through LP-013

#### Description

Optimize landing page performance to meet targets and ensure fast loading on low-bandwidth connections typical in Zimbabwe.

#### Acceptance Criteria

- [ ] Lighthouse Performance score > 95
- [ ] First Contentful Paint < 1.2s
- [ ] Largest Contentful Paint < 2.0s
- [ ] Total Blocking Time < 200ms
- [ ] Cumulative Layout Shift < 0.1
- [ ] Bundle analysis completed, no unnecessary dependencies
- [ ] Images optimized: WebP format, responsive srcset, lazy loading
- [ ] Font optimization: system font stack or font-display: swap
- [ ] Code splitting: only critical CSS/JS in initial bundle
- [ ] Service worker for basic offline page
- [ ] Tested on simulated 3G connection (Chrome DevTools)
- [ ] Cross-browser testing: Chrome, Firefox, Safari (mobile + desktop)

#### Technical Notes

- Use `@next/bundle-analyzer` for bundle analysis
- Implement critical CSS inlining via Next.js built-in optimization
- Use `next/dynamic` for below-fold components
- Test with WebPageTest.org for real-world performance data

---

### LP-015: Accessibility Audit & Fixes

**Priority:** High | **Est:** 2 hours
**Labels:** `landing-page`, `accessibility`, `high-priority`
**Dependencies:** LP-001 through LP-013

#### Description

Comprehensive accessibility audit to ensure WCAG 2.1 AA compliance and usability for all visitors.

#### Acceptance Criteria

- [ ] axe-core automated audit passes with zero violations
- [ ] Keyboard navigation works for all interactive elements
- [ ] Tab order is logical and follows visual layout
- [ ] Focus indicators visible on all focusable elements
- [ ] Screen reader testing (VoiceOver/NVDA) confirms usability
- [ ] All images have descriptive alt text
- [ ] Color contrast ratios meet AA standard (4.5:1 text, 3:1 large text)
- [ ] Skip-to-content link present and functional
- [ ] ARIA labels on icon-only buttons and links
- [ ] Form inputs have associated labels
- [ ] Error messages announced to screen readers
- [ ] No content is conveyed by color alone

#### Technical Notes

- Use `eslint-plugin-jsx-a11y` for linting accessibility issues
- Test with browser extensions: axe DevTools, WAVE
- Manual testing with keyboard-only navigation
- Test with screen reader (NVDA on Windows, VoiceOver on macOS)

---

## Implementation Order

```
Phase 1 - Foundation (Week 1):
  LP-001 → LP-002 + LP-003 (parallel) → LP-010

Phase 2 - Content Sections (Week 2):
  LP-004 + LP-005 + LP-006 (parallel) → LP-007 + LP-008 + LP-009 (parallel)

Phase 3 - Polish (Week 3):
  LP-011 → LP-012 + LP-013 (parallel) → LP-014 + LP-015 (parallel)
```

---

## Labels to Create

```bash
gh label create "landing-page" --color "0E8A16" --description "Landing page implementation"
gh label create "component" --color "C5DEF5" --description "UI component"
gh label create "i18n" --color "D4C5F9" --description "Internationalization"
gh label create "seo" --color "FEF2C0" --description "Search engine optimization"
gh label create "analytics" --color "BFD4F2" --description "Analytics and tracking"
gh label create "performance" --color "FBCA04" --description "Performance optimization"
gh label create "accessibility" --color "F9D0C4" --description "Accessibility (a11y)"
```
