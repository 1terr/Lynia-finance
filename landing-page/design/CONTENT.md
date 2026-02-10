# Landing Page Content - lyniafinance.com

> Source of truth for all page copy.
> Homepage structure follows [stripe.com](https://stripe.com) design patterns.

---

## Navigation

```
Lynia Finance (logo)    Products    Mission    Partnerships    Research
```

- Nav is clean text links only - no buttons
- Contact, Careers, and other links live in the footer
- Sticky nav with transparent → solid background on scroll

---

## Homepage Structure (Stripe-inspired)

The homepage follows Stripe's proven section flow: Hero → Product suite → Why alternative financing → Customer segments → Editorial → Bottom CTA → Footer.

```
┌─────────────────────────────────────────────────────────┐
│ 1. HERO (animated gradient background)                  │
├─────────────────────────────────────────────────────────┤
│ 2. SOCIAL PROOF (partner/trust logos)                   │
├─────────────────────────────────────────────────────────┤
│ 3. PRODUCT SUITE (3 product cards in grid)              │
├─────────────────────────────────────────────────────────┤
│ 4. PRODUCT DEEP DIVE: Asset Financing                   │
├─────────────────────────────────────────────────────────┤
│ 5. PRODUCT DEEP DIVE: Digital Credit                    │
├─────────────────────────────────────────────────────────┤
│ 6. PRODUCT DEEP DIVE: Enterprise Partnerships           │
├─────────────────────────────────────────────────────────┤
│ 7. WHY ALTERNATIVE FINANCING (underbanked stats)        │
├─────────────────────────────────────────────────────────┤
│ 8. CUSTOMER SEGMENTS (who we serve)                     │
├─────────────────────────────────────────────────────────┤
│ 9. EDITORIAL (featured Research posts)                  │
├─────────────────────────────────────────────────────────┤
│ 10. BOTTOM CTA (final conversion)                       │
├─────────────────────────────────────────────────────────┤
│ 11. FOOTER                                              │
└─────────────────────────────────────────────────────────┘
```

---

## Section 1: Hero

**Design**: Full-viewport height. Animated gradient background (WebGL canvas with brand blue hues). Bold headline left-aligned or centered with product UI illustration on the right.

**Stripe pattern**: Big bold headline + short subtext + 2 CTAs + animated visual element.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │                     │  │                          │  │
│  │  Credit that works  │  │  [Animated illustration  │  │
│  │  for real people    │  │   of WhatsApp phone UI   │  │
│  │                     │  │   showing loan approval   │  │
│  │  Lynia Finance      │  │   flow or mobile money   │  │
│  │  helps you get the  │  │   transaction]           │  │
│  │  smartphone, tools, │  │                          │  │
│  │  or cash you need   │  │                          │  │
│  │  —giving you the    │  │                          │  │
│  │  power to earn more │  │                          │  │
│  │  and do more.       │  │                          │  │
│  │                     │  │                          │  │
│  │  [Apply now]        │  │                          │  │
│  │  Lets chat on       │  │                          │  │
│  │  whatsapp           │  │                          │  │
│  │                     │  │                          │  │
│  └─────────────────────┘  └──────────────────────────┘  │
│                                                         │
│            ──── animated gradient background ────        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Headline**:
> Credit that works for real people

**Subtext**:
> Lynia Finance helps you get the smartphone, tools, or cash you need—giving you the power to earn more and do more.

**CTAs**:
- Primary: `[Apply now]` (filled button, brand blue)
- Secondary: `Lets chat on whatsapp` (text link with arrow)

**Visual**: Animated flat illustration showing a WhatsApp loan approval flow or mobile money transaction on a phone mockup (CSS-rendered device, Stripe style).

**Technical notes**:
- Animated gradient using WebGL canvas (blue hues: `#0052FF`, `#003ECB`, `#0A1628`, `#60A5FA`)
- CSS Grid layout: 2 columns (text left, visual right)
- On mobile: stacks (text on top, visual below or hidden)

---

## Section 2: Social Proof / Trust Bar

**Design**: Narrow horizontal strip. Logos in a row. Subtle grey or light background.

**Stripe pattern**: Row of major customer/partner logos to build immediate credibility.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Trusted by partners across Zimbabwe                    │
│                                                         │
│  [Logo]   [Logo]   [Logo]   [Logo]   [Logo]   [Logo]   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Content**: Partner logos, payment provider logos (EcoCash, OneMoney), or trust indicators.
- If logos not yet available, use stats instead: "500+ customers served | <5 min approval | 100% mobile money"

---

## Section 3: Product Suite Overview

**Design**: Clean grid of 3 product cards. Each card has an icon/illustration, product name, one-line description, and a link. Like Stripe's product showcase grid.

**Stripe pattern**: Show the breadth of offerings at a glance before deep-diving into each.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  A fully integrated suite of credit products            │
│                                                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐ │
│  │ [illustration]  │ │ [illustration]  │ │ [illustration]   │ │
│  │                 │ │                 │ │                  │ │
│  │ ASSET FINANCING │ │ DIGITAL CREDIT  │ │ ENTERPRISE       │ │
│  │                 │ │                 │ │ PARTNERSHIPS     │ │
│  │ Own the tools   │ │ Cash when you   │ │ Credit built     │ │
│  │ that power      │ │ need it most    │ │ into your        │ │
│  │ your trade      │ │                 │ │ business         │ │
│  │                 │ │                 │ │                  │ │
│  │ Learn more →    │ │ Learn more →    │ │ Learn more →     │ │
│  └─────────────────┘ └─────────────────┘ └────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Section headline**:
> A fully integrated suite of credit products

**Cards** link/scroll to the product deep-dive sections below.

---

## Section 4: Product Deep Dive — Asset Financing

**Design**: Full-width section. Split layout: text left, product visual/illustration right. Alternating background (white or light blue). Feature grid below the headline.

**Stripe pattern**: Each product gets a dedicated section with headline + description + features + CTA + visual.

**Label**: ASSET FINANCING

**Headline**:
> Own the tools that power your trade

**Subtext**:
> Get smartphones, tools of your trade through flexible financing. These assets are productive tools that help you earn more, while our system ensures fair repayment terms

**Features** (4-column grid):

| Feature | Description |
|---------|-------------|
| **Ownership** | Own asset after paying a deposit |
| **Collection** | Collect asset at your nearest agent |
| **Application** | Get approved in less than 5 minutes |
| **Repayment** | Repay using mobile money |

**CTAs**:
- Primary: `[Apply now]`
- Secondary: `Lets chat on whatsapp`

**Visual**: Flat illustration of a smartphone with a checkmark / approval animation.

---

## Section 5: Product Deep Dive — Digital Credit

**Design**: Alternating background (dark navy `#0A1628` with light text, Stripe-style dark section). Split layout: visual left, text right.

**Label**: DIGITAL CREDIT

**Headline**:
> Cash when you need it most

**Subtext**:
> Quick, secure digital loans delivered straight to your mobile wallet. Designed to cover everyday needs or business growth, with repayment made simple via EcoCash or Omari

**Features** (2-column grid):

| Feature | Description |
|---------|-------------|
| **Instant approval** | Apply, get approved and receive your funds in less than 10 minutes. |
| **Mobile money friendly** | Your money is deposited directly into your mobile money wallet. You also repay using mobile. |

**CTA**:
- Primary: `[Coming soon]` (muted/disabled style)

**Visual**: Flat illustration of mobile wallet receiving funds.

---

## Section 6: Product Deep Dive — Enterprise Partnerships

**Design**: White/light background. Split layout: text left, visual right.

**Label**: ENTERPRISE PARTNERSHIPS

**Headline**:
> Credit built into your business

**Subtext**:
> We partner with enterprises to embed financing directly into their platforms. From distributors to service providers, Lynia Finance integrates credit at the point of need—helping businesses grow and customers access more

**Features** (3-item grid):

| Feature | Description |
|---------|-------------|
| **Mobile money first** | We are a mobile money first platform for speed of transactions. |
| **API friendly platform** | We are a modern platform that is ready to plug into any third party system. Monitor key metrics in real time |
| **Value creation** | We move downstream of value creation. We understand customers' needs, we understand the risks and we leverage our insights to help your business grow. Our mission is building ecosystems to expand our product offerings. |

**CTA**:
- Primary: `[Partner with us]`

**Visual**: Flat illustration of connected platforms / API integration diagram.

---

## Section 7: Why Alternative Financing

**Design**: Full-width section with brand blue gradient background. Large stat numbers in a grid. Stripe shows global reach with impressive numbers — Lynia shows the underbanked opportunity.

**Stripe pattern**: The "Why Stripe" / global scale section with big numbers and concise supporting text.

**Purpose**: Make the case for alternative financing by highlighting the scale of the underbanked population and the gap in traditional financial services.

```
┌─────────────────────────────────────────────────────────┐
│                (brand blue gradient bg)                  │
│                                                         │
│  Why Alternative Financing                              │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │   80%    │  │   <5%    │  │  $14B    │  │  70%+   │ │
│  │ Informal │  │  Have    │  │ Unserved │  │  Mobile  │ │
│  │ workforce│  │  bank    │  │  credit  │  │  money   │ │
│  │          │  │  credit  │  │  demand  │  │ adoption │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                         │
│  The underbanked aren't high risk — they're unmodeled.  │
│  Traditional banks don't serve them. We do.             │
│                                                         │
│  Zimbabwe's informal workforce is 80% of the economy   │
│  yet almost entirely excluded from credit. Mobile money │
│  penetration is high, but financial products haven't    │
│  followed. Alternative financing bridges this gap.      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Stats to feature** (underbanked focus):
- `80%` — Of Zimbabwe's workforce is informal and excluded from traditional credit
- `<5%` — Of informal workers have access to bank credit
- `$14B` — Estimated unserved credit demand in Zimbabwe's informal sector
- `70%+` — Mobile money adoption rate (EcoCash, OneMoney)

**Supporting headline**:
> The underbanked aren't high risk — they're unmodeled.

**Supporting text**:
> Traditional banks don't serve them. We do. Zimbabwe's informal workforce is 80% of the economy yet almost entirely excluded from credit. Mobile money penetration is high, but financial products haven't followed. Alternative financing bridges this gap.

---

## Section 8: Customer Segments

**Design**: 3-column card layout. Each card targets a different audience with tailored messaging. Stripe does this for startups / enterprises / platforms.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Built for everyone in the value chain                  │
│                                                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐ │
│  │ FOR INDIVIDUALS │ │ FOR BUSINESSES  │ │ FOR PARTNERS    │ │
│  │                 │ │                 │ │                 │ │
│  │ Get the tools   │ │ Grow your       │ │ Embed credit    │ │
│  │ you need to     │ │ business with   │ │ into your       │ │
│  │ earn more.      │ │ instant digital │ │ platform and    │ │
│  │ Smartphones,    │ │ credit. No      │ │ help your       │ │
│  │ equipment,      │ │ paperwork, no   │ │ customers       │ │
│  │ and cash —      │ │ bank visits.    │ │ access more.    │ │
│  │ all via         │ │                 │ │                 │ │
│  │ WhatsApp.       │ │                 │ │                 │ │
│  │                 │ │                 │ │                 │ │
│  │ Apply now →     │ │ Coming soon →   │ │ Partner with    │ │
│  │                 │ │                 │ │ us →            │ │
│  └─────────────────┘ └─────────────────┘ └────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Section 9: Editorial / Featured Research

**Design**: 2-3 column card grid showing latest Research posts. Stripe features curated editorial content (reports, interviews, announcements).

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  From our Research                                      │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ [Image]  │  │ [Image]  │  │ [Image]  │              │
│  │ TAG      │  │ TAG      │  │ TAG      │              │
│  │ Headline │  │ Headline │  │ Headline │              │
│  │ Excerpt  │  │ Excerpt  │  │ Excerpt  │              │
│  │ Date     │  │ Date     │  │ Date     │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                         │
│                 View all research →                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Source**: Pulls latest 3 posts from Sanity CMS.

---

## Section 10: Bottom CTA

**Design**: Full-width section with gradient or dark background. Final push to convert. Stripe ends with "Ready to get started?" + pricing mention.

```
┌─────────────────────────────────────────────────────────┐
│              (dark navy or gradient bg)                  │
│                                                         │
│  Ready to get started?                                  │
│                                                         │
│  Get the smartphone, tools, or cash you need.           │
│  Apply in under 5 minutes via WhatsApp.                 │
│                                                         │
│  [Apply now]    Lets chat on whatsapp                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Footer

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Lynia Finance (logo)                                   │
│                                                         │
│  Products        Company        Connect       Legal     │
│  ─────────       ───────        ───────       ─────     │
│  Smartphone      Careers        X (Twitter)   Privacy   │
│   financing      Contact        LinkedIn      Terms     │
│  Digital loans                  WhatsApp                │
│  Embedded                                               │
│   financing                                             │
│                                                         │
│  © 2026 Lynia Finance. All rights reserved.             │
│  Regulated by the Reserve Bank of Zimbabwe.             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Products column**:
- Smartphone financing
- Digital loans
- Embedded financing

**Company column**:
- Careers
- Contact

**Connect column**:
- X (Twitter)
- LinkedIn
- WhatsApp

**Legal column**:
- Privacy Policy
- Terms

**Bottom line**: Copyright + RBZ regulatory disclaimer

---

## Design Pattern Reference (Stripe → Lynia mapping)

| Stripe Section | Lynia Equivalent | Notes |
|---------------|-----------------|-------|
| Hero with gradient + animated UI | Hero with gradient + WhatsApp UI illustration | WebGL gradient canvas |
| Customer logos bar | Partner/trust logos bar | EcoCash, OneMoney, or stats |
| Product suite grid | 3 product cards (Asset, Digital, Enterprise) | Icons + one-liner + link |
| Individual product sections | 3 product deep-dives | Alternating backgrounds |
| "Why Stripe" + global numbers | "Why Alternative Financing" + underbanked stats | Stats on gradient bg |
| Customer segments | For Individuals / Businesses / Partners | 3-column cards |
| Editorial content | Featured Research posts | Pulls from Sanity |
| Bottom CTA + pricing | Bottom CTA | Apply now + WhatsApp |
| Multi-column footer | Multi-column footer | Products, Company, Connect, Legal |

## Technical Design Notes

| Pattern | Implementation |
|---------|---------------|
| **Gradient background** | WebGL canvas with animated blue hues (`#0052FF`, `#003ECB`, `#0A1628`, `#60A5FA`) |
| **Device mockups** | CSS-rendered phones/laptops (<1KB, hardware-accelerated, responsive) |
| **Section transitions** | Scroll-triggered fade-in animations using Intersection Observer API |
| **Layout** | CSS Grid throughout, 2-column splits for product sections |
| **Dark sections** | Alternating light/dark backgrounds (white ↔ navy `#0A1628`) |
| **Hover effects** | Subtle card elevation/shadow on hover, button color transitions |
| **Mobile** | Single-column stack, hero visual below text or hidden, reduced animations |

---

## Research Page (Blog)

**CMS**: Sanity (free tier)
**Inspiration**: stripe.com/blog

### Page Layout

```
┌─────────────────────────────────────────────────────┐
│  RESEARCH                                           │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  FEATURED POST                                │  │
│  │  [Large illustration]                         │  │
│  │  Category tag                                 │  │
│  │  Featured Headline Here                       │  │
│  │  Excerpt text describing the article...       │  │
│  │  12 Feb 2026                                  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [All] [Products] [Engineering] [Company] [Market]  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ [Image]  │  │ [Image]  │  │ [Image]  │          │
│  │ TAG      │  │ TAG      │  │ TAG      │          │
│  │ Headline │  │ Headline │  │ Headline │          │
│  │ Excerpt  │  │ Excerpt  │  │ Excerpt  │          │
│  │ Date     │  │ Date     │  │ Date     │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
│  [Load more]                                        │
└─────────────────────────────────────────────────────┘
```

### Suggested Categories

- All
- Products (asset financing, digital credit updates)
- Engineering (tech behind the platform)
- Company (team, milestones, culture)
- Market (Zimbabwe fintech landscape, financial inclusion research)

### Sanity Content Types

| Type | Fields |
|------|--------|
| **Post** | Title, slug, featured image, excerpt, body (rich text), category, author, published date |
| **Author** | Name, avatar, role |
| **Category** | Name, slug, description |

---

## Contact Page

**Inspiration**: stripe.com/contact/sales (styling only - our fields differ)

### Page Layout

```
┌──────────────────────────┬──────────────────────────┐
│                          │                          │
│  Get in touch            │  CONTACT FORM            │
│                          │                          │
│  Have a question or      │  Name *                  │
│  want to learn more?     │  ┌────────────────────┐  │
│  We'd love to hear       │  └────────────────────┘  │
│  from you.               │  Phone number *          │
│                          │  ┌────────────────────┐  │
│  ─────────────────       │  └────────────────────┘  │
│                          │  Email                   │
│  OTHER WAYS TO REACH US  │  ┌────────────────────┐  │
│                          │  └────────────────────┘  │
│  WhatsApp                │  Message                 │
│  Chat with us directly   │  ┌────────────────────┐  │
│                          │  │                    │  │
│  Email                   │  └────────────────────┘  │
│  hello@lyniafinance.com  │                          │
│                          │  [Send message]          │
│  Location                │                          │
│  Harare, Zimbabwe        │                          │
│                          │                          │
└──────────────────────────┴──────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                                                     │
│  WANT TO PARTNER WITH US?                           │
│                                                     │
│  Name *    Phone number *    Email *                │
│  Type of partnership *                              │
│  [ Distributor / B2B Partnership / Other ]          │
│  Message                                            │
│                                                     │
│  [Submit partnership application]                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Contact Form Fields

| Field | Required | Type |
|-------|----------|------|
| Name | Yes | Text input |
| Phone number | Yes | Tel input (with country code) |
| Email | No | Email input |
| Message | No | Textarea |

### Partnership Application Fields

| Field | Required | Type |
|-------|----------|------|
| Name | Yes | Text input |
| Phone number | Yes | Tel input |
| Email | Yes | Email input |
| Type of partnership | Yes | Select: Distributor / B2B Partnership / Other |
| Message / details | No | Textarea |

### Design Notes

- Split layout on desktop (info left, form right) - Stripe contact/sales style
- Stacks to single column on mobile (info first, then form)
- Partnership application as separate section below the main contact form
- Brand blue primary buttons
- Clean labels above each field
- WhatsApp floating button also visible on this page

---

## Separate Pages (linked from nav)

- **Products** → Detailed product pages for the 3 product lines
- **Mission** → Company mission, vision, and values
- **Partnerships** → Distributor and B2B partnership info + application form
- **Research** → Blog / research articles and news (Sanity CMS)
- **Privacy Policy / Terms** → Legal pages (footer links)
