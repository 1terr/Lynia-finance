# Lynia Finance Landing Page - Design Brief

> **Status**: Content received. Ready for design execution.
>
> Full page copy available in [`CONTENT.md`](./CONTENT.md).

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

## 3. Site Map & Navigation

### Navigation Bar

```
Lynia Finance (logo)    Products    About    Partnerships    Research    [Start your application]
```

- CTA button on the right provides persistent conversion path from any scroll position (Stripe pattern)
- "Mission" renamed to "About" for broader utility (investors, press, job seekers all look for "About")
- Contact, Careers, and other links live in the footer
- Mobile: CTA appears as last item in hamburger menu

### Homepage Structure (Stripe-inspired flow, reordered)

| # | Section | Stripe Equivalent | Layout |
|---|---------|-------------------|--------|
| 1 | **Hero** | Hero with gradient + animated UI | Full-viewport, CSS gradient (WebGL enhancement), 2-col split |
| 2 | **Social Proof** | Customer logos bar | Horizontal logo strip or stat numbers |
| 3 | **Why Alternative Financing** | "Why Stripe" + global numbers | Stats on gradient background |
| 4 | **Product Suite** | Product showcase grid | 3-column card grid |
| 5 | **Asset Financing** | Product deep dive | Split: text left, visual right (compact padding) |
| 6 | **Digital Credit** | Product deep dive | Split: visual left, text right (dark bg, lead capture CTA) |
| 7 | **Enterprise Partnerships** | Product deep dive | Split: text left, visual right (compact padding) |
| 8 | **Customer Segments** | Startup / Enterprise / Platform cards | 3-column cards |
| 9 | **Featured Research** | Editorial content | 3-column blog card grid (from Sanity) |
| 10 | **Bottom CTA** | Bottom CTA + pricing | Dark/gradient bg, final conversion |
| 11 | **Footer** | Multi-column footer | Products, Company, Connect, Legal |

**Section order change from v1**: Stats section moved from position 7 to position 3 — establishes the market problem before presenting products (Stripe narrative pattern).

Full wireframes and copy in [`CONTENT.md`](./CONTENT.md).

### Three Core Products

| Product | Audience | Status |
|---------|----------|--------|
| **Asset Financing** | B2C (informal workers) | Live - "Apply now" |
| **Digital Credit** | B2C (everyone) | Coming soon |
| **Enterprise Partnerships** | B2B (ride-hailing, employers, platforms) | Active - "Partner with us" |

### Separate Pages

| Page | Purpose |
|------|---------|
| **Products** | Detailed product pages (Asset Financing, Digital Credit, Enterprise Partnerships) |
| **About** | Company mission, vision, and values |
| **Partnerships** | Distributor and B2B partnership information + application form |
| **Research** | Blog / research articles and news |
| **Privacy Policy / Terms** | Legal pages (footer links) |

### Footer

| Products | Company | Connect | Legal |
|----------|---------|---------|-------|
| Asset financing | About | X (Twitter) | Privacy Policy |
| Digital credit | Careers | LinkedIn | Terms |
| Enterprise partnerships | Contact | WhatsApp | |

---

## 4. Key Messaging

### 4.1 Hero Messaging (updated per Stripe alignment review)

- **Headline**: "Financial tools for the underbanked"
- **Subtext**: "Smartphones, assets, and cash — delivered through WhatsApp with approval in under 5 minutes."
- **Primary CTA**: `[Start your application]`
- **Secondary CTA**: `See how it works →`

### 4.2 Product Headlines (updated per Stripe alignment review)

| Product | Headline | Subtext |
|---------|----------|---------|
| **Asset Financing** | "Own the tools that power your trade" | Finance smartphones and assets with a small deposit. Collect from a local agent, repay via mobile money. |
| **Digital Credit** | "Cash when you need it most" | Digital loans deposited directly into your mobile wallet. Apply once, get funded in under 10 minutes. |
| **Enterprise Partnerships** | "Embed credit into your platform" | Offer your customers financing at the point of need. Lynia handles underwriting, disbursement, and collections — you earn on every transaction. |

Full copy in [`CONTENT.md`](./CONTENT.md).

### 4.3 Value Propositions (as featured on page)

| Value Proposition | Where Featured |
|-------------------|---------------|
| Approved in less than 5 minutes | Asset Financing features |
| Own asset after paying a deposit | Asset Financing features |
| Repay using mobile money | Asset Financing + Digital Credit |
| Funds in less than 10 minutes | Digital Credit features |
| Mobile money friendly | Digital Credit features |
| API friendly platform | Enterprise Partnerships features |
| Mobile money first | Enterprise Partnerships features |

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

**Direction**: Follow Stripe.com's design language — deep navy paired with a refined blue-purple accent. Sophisticated, trustworthy, professional.

#### Reference Palette (Stripe.com — current live site)

| Element | Hex | Name |
|---------|-----|------|
| Primary Dark / Navy | `#0A2540` | "Downriver" — trust, stability, professionalism |
| Brand Accent / CTA | `#635BFF` | "Blurple" — used for both brand identity AND CTA buttons |
| CTA Hover | `#5651E5` | Darkened blurple for hover states |
| Light Background | `#F6F9FC` | "Black Squeeze" — alternating section bg |
| Body Text | `#425466` | Blue-gray body copy |
| Muted Text | `#ADBDCC` | Placeholders, timestamps, secondary text on dark bg |
| Borders | `#E0E6EB` | Dividers, card outlines |
| Hero Gradient | `#6ec3f4, #3a3aff, #ff61ab, #E63946` | WebGL animated mesh — vibrant multi-hue |

#### Lynia Landing Page Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary / CTA | `#635BFF` | Brand accent — logo, highlights, buttons, links |
| Primary Dark | `#0A2540` | Headings, dark sections, footer, nav text |
| Primary Hover | `#5651E5` | Button/link hover state (darkened blurple) |
| Light BG | `#F6F9FC` | Light section backgrounds |
| Body Text | `#425466` | Paragraph text |
| Muted Text | `#ADBDCC` | Placeholders, timestamps, secondary labels |
| White | `#FFFFFF` | Backgrounds, cards |

- **Full token definitions**: See [`DESIGN-TOKENS.md`](./DESIGN-TOKENS.md)
- **Colors note**: Hero uses CSS gradient as default; WebGL animated gradient is a progressive enhancement loaded only on capable devices (`hardwareConcurrency >= 4`). Brand palette remains cool navy/blurple

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

### 6.1 CTAs (confirmed from wireframe)

| CTA | Action | Location |
|-----|--------|----------|
| `[Start your application]` | Primary conversion (WhatsApp or application flow) | Nav, Hero, Asset Financing, Bottom CTA |
| `See how it works →` | Scrolls to product section | Hero |
| `[Get notified when we launch →]` | Lead capture (phone/email) for Digital Credit | Digital Credit section |
| `[Partner with us]` | Partnership application form | Enterprise Partnerships section |
| `Talk to our team →` | Links to contact page | Bottom CTA |
| **WhatsApp floating button** | Opens WhatsApp chat | Persistent on all pages |

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
| **CMS** | **Sanity** (free tier - 20 seats, GROQ API, real-time editing, Next.js native integration) |
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

## 8. Research Page (Blog)

**Inspiration**: [stripe.com/blog](https://stripe.com/blog)

### Structure

| Element | Description |
|---------|-------------|
| **Hero / Featured post** | Full-width featured article at top with large image, headline, excerpt |
| **Category filters** | Horizontal pill/tab navigation (e.g., All, Products, Engineering, Company, Partnerships) |
| **Post grid** | 2-3 column responsive card grid below the featured post |
| **Post card** | Thumbnail/illustration + category tag + headline + short excerpt + date |
| **Pagination** | Load more or numbered pagination |

### Post Card Design

```
┌─────────────────────────┐
│  [Illustration/Image]   │
│                         │
│  CATEGORY TAG           │
│  Post Headline Here     │
│  Short excerpt text...  │
│  12 Feb 2026            │
└─────────────────────────┘
```

### CMS Integration (Sanity)

| Content Type | Fields |
|-------------|--------|
| **Post** | Title, slug, featured image, excerpt, body (rich text), category, author, published date |
| **Author** | Name, avatar, role |
| **Category** | Name, slug, description |

### Design Notes

- Custom flat illustrations per post (Stripe style), not stock photos
- Category tags use brand blue as accent color
- Cards have subtle hover elevation/shadow
- Clean typography with strong headline hierarchy
- Generous whitespace between cards

---

## 9. Contact Page

**Inspiration**: [stripe.com/contact/sales](https://stripe.com/contact/sales) for styling

### Layout

Split layout (Stripe-style):

```
┌──────────────────────┬──────────────────────┐
│                      │                      │
│  Left Column         │  Right Column        │
│  (Info + trust)      │  (Form)              │
│                      │                      │
│  Headline            │  Name *              │
│  Subtext explaining  │  Phone number *      │
│  how to reach us     │  Email               │
│                      │  Message             │
│  Other ways:         │                      │
│  • WhatsApp          │  [Send message]      │
│  • Email address     │                      │
│  • Office location   │                      │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

### Contact Form Fields

| Field | Required | Type |
|-------|----------|------|
| Name | Yes | Text input |
| Phone number | Yes | Tel input (with country code) |
| Email | No | Email input |
| Message | No | Textarea |

### Partnership Application Form

Separate section or tab on the same page:

| Field | Required | Type |
|-------|----------|------|
| Name | Yes | Text input |
| Phone number | Yes | Tel input |
| Email | Yes | Email input |
| Type of partnership | Yes | Select: Distributor / B2B Partnership / Other |
| Message / details | No | Textarea |

### Design Notes

- Single-column vertical form (Stripe best practice for conversion)
- Clean labels above each field
- Brand blue primary button
- Left column provides context and alternative contact methods
- Mobile: stacks to single column (info first, then form)
- WhatsApp floating button also available as alternative

---

## 10. Inspiration References

| Website | Design Takeaways |
|---------|-----------------|
| **Stripe.com** (primary reference) | Deep navy `#0A2540` + blurple `#635BFF` (accent AND CTA). Söhne font (we use Inter). Medium-weight headings (500), light body (300). Flat illustrations. WebGL mesh gradient hero (`#6ec3f4, #3a3aff, #ff61ab, #E63946`). Layered subtle shadows. Generous section padding (120px). Narrow container (~1080px). Content-heavy but uncluttered. **Our primary design language.** |
| **Stripe.com/blog** | Featured hero post, category pill filters, 2-3 column card grid, custom illustrations per post, clean hierarchy. **Model for Research page.** |
| **Stripe.com/contact/sales** | Split layout (info left, form right), single-column form, qualifying fields, clean labels, trust indicators. **Model for Contact page.** |
| **Paystack.com** | Vibrant, uncluttered, animated illustrations. African fintech (Stripe-owned). Simple navigation. Quick onboarding feel. |

**Core design language (Stripe)**:
- Deep navy (`#0A2540`) + blurple (`#635BFF`) for accent AND CTA + white
- Medium-weight headings (500), light body text (300)
- Flat/geometric illustrations (no stock photos)
- Generous whitespace and section padding
- Subtle layered shadows, restrained border radius
- Smooth scroll-triggered animations
- Strong hero section with WebGL gradient + clear CTA
- Mobile-first responsive design

---

## 11. Constraints & Non-Negotiables

| Constraint | Detail |
|------------|--------|
| **Budget** | Unlimited |
| **Must-have for launch** | All confirmed pages and features |
| **Colors to avoid** | Standalone pink/purple as brand colors. Note: hero gradient includes pink/red per Stripe's actual WebGL implementation — this is acceptable as gradient accent, not as brand color |
| **Regulatory disclaimers** | RBZ (Reserve Bank of Zimbabwe) compliance required |
| **Design style** | NOT minimalist - should feel vibrant and substantial |

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| Page load speed | Very fast, especially on 2G/3G |
| Sign-ups (B2C) | High volume of WhatsApp/contact sign-ups |
| Partner trust | Credibility with potential B2B partners |
| Investor confidence | Professional enough to build conviction |
| Regulatory trust | Demonstrates compliance and legitimacy |

---

## 13. Outstanding Items

| Item | Status | Action |
|------|--------|--------|
| Page content (copy) | **Done** | All copy extracted to [`CONTENT.md`](./CONTENT.md) |
| Headlines / taglines | **Done** | Confirmed from wireframes |
| CTA button text | **Done** | Confirmed from wireframes |
| CMS selection | **Done** | Sanity (free tier) |
| Research page structure | **Done** | Stripe blog-inspired, spec in Section 8 |
| Contact page layout | **Done** | Stripe contact/sales-inspired, spec in Section 9 |
| Logo design | Not started | Part of design phase |
| Illustrations | Not started | To be created in Stripe-like flat style |
| Sanity schema setup | Not started | Post, Author, Category content types |
| Research initial content | Not started | First blog posts / articles needed |
