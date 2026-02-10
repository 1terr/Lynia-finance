# Landing Page Content — lyniafinance.com

> Source of truth for all page copy.
> Homepage structure follows [stripe.com](https://stripe.com) design patterns.
> Copy style: declarative, outcome-focused, short sentences, no filler.
> See [`REVIEW-STRIPE-ALIGNMENT.md`](./REVIEW-STRIPE-ALIGNMENT.md) for the copy style guide.

---

## Navigation

```
Lynia Finance (logo)    Products    About    Partnerships    Editorial    [Start your application]
```

- Text links for primary nav items
- CTA button on the right (primary style, brand blurple)
- Sticky nav with transparent → solid background on scroll
- CTA button hidden on mobile — appears as last item in hamburger menu

---

## Homepage Structure (Stripe-inspired)

The homepage follows a reordered Stripe-inspired flow: Hero → Social Proof → Why (stats) → Product suite → Product deep dives → Customer segments → Editorial → Bottom CTA → Footer.

The stats section is placed early to establish the problem before presenting products — this mirrors how Stripe positions "Why Stripe" early in their page flow.

```
┌─────────────────────────────────────────────────────────┐
│ 1. HERO (animated gradient background)                  │
├─────────────────────────────────────────────────────────┤
│ 2. SOCIAL PROOF (partner/trust logos or stats)          │
├─────────────────────────────────────────────────────────┤
│ 3. WHY ALTERNATIVE FINANCING (underbanked stats)        │
├─────────────────────────────────────────────────────────┤
│ 4. PRODUCT SUITE (3 product cards in grid)              │
├─────────────────────────────────────────────────────────┤
│ 5. PRODUCT DEEP DIVE: Asset Financing                   │
├─────────────────────────────────────────────────────────┤
│ 6. PRODUCT DEEP DIVE: Digital Credit                    │
├─────────────────────────────────────────────────────────┤
│ 7. PRODUCT DEEP DIVE: Enterprise Partnerships           │
├─────────────────────────────────────────────────────────┤
│ 8. CUSTOMER SEGMENTS (who we serve)                     │
├─────────────────────────────────────────────────────────┤
│ 9. EDITORIAL (featured Editorial posts)                 │
├─────────────────────────────────────────────────────────┤
│ 10. BOTTOM CTA (final conversion)                      │
├─────────────────────────────────────────────────────────┤
│ 11. FOOTER                                             │
└─────────────────────────────────────────────────────────┘
```

**Section order change from v1:** Stats section moved from position 7 to position 3. This establishes the market problem before presenting products — a Stripe narrative pattern.

---

## Section 1: Hero

**Design**: Full-viewport height. Animated gradient background (CSS gradient default, WebGL as progressive enhancement). Bold headline left-aligned with product UI illustration on the right.

**Stripe pattern**: Big bold headline + short subtext + 2 CTAs + animated visual element.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │                     │  │                          │  │
│  │  Financial tools    │  │  [Animated illustration  │  │
│  │  for the            │  │   of WhatsApp phone UI   │  │
│  │  underbanked        │  │   showing loan approval  │  │
│  │                     │  │   flow or mobile money   │  │
│  │  Smartphones,       │  │   transaction]           │  │
│  │  assets, and     │  │                          │  │
│  │  cash — delivered   │  │                          │  │
│  │  through WhatsApp   │  │                          │  │
│  │  with approval in   │  │                          │  │
│  │  under 5 minutes.   │  │                          │  │
│  │                     │  │                          │  │
│  │  [Start your        │  │                          │  │
│  │   application]      │  │                          │  │
│  │  See how it works → │  │                          │  │
│  │                     │  │                          │  │
│  └─────────────────────┘  └──────────────────────────┘  │
│                                                         │
│            ──── animated gradient background ────        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Headline**:
> Financial tools for the underbanked

**Subtext**:
> Smartphones, assets, and cash — delivered through WhatsApp with approval in under 5 minutes.

**CTAs**:
- Primary: `[Start your application]` (filled button, white bg with brand text on dark hero)
- Secondary: `See how it works →` (text link with arrow, scrolls to product section)

**Visual**: Animated flat illustration showing a WhatsApp loan approval flow or mobile money transaction on a phone mockup (CSS-rendered device, Stripe style).

**Technical notes**:
- CSS gradient as default (`linear-gradient(135deg, #0A2540 0%, #3a3aff 40%, #635BFF 70%, #6ec3f4 100%)`)
- WebGL animated gradient as progressive enhancement (load only if `navigator.hardwareConcurrency >= 4`)
- CSS Grid layout: 2 columns (text left, visual right)
- On mobile: single column (text only, phone mockup hidden on `< 768px`)
- Mobile hero must be short enough for headline + subtext + CTA to appear above the fold on 375px screens

---

## Section 2: Social Proof / Trust Bar

**Design**: Narrow horizontal strip. Logos in a row or stat numbers. Subtle grey or light background.

**Stripe pattern**: Row of logos — no label text. Logos speak for themselves.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [Logo]   [Logo]   [Logo]   [Logo]   [Logo]   [Logo]   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Content**: Partner logos, payment provider logos, or trust indicators.

- If logos available: no label text — just the logo row (Stripe pattern)
- If logos not yet available, use stats-as-proof (no label needed):

```
500+ loans funded  ·  <5 min approval  ·  100% mobile money
```

If a label is required:
> Powering credit across Zimbabwe

---

## Section 3: Why Alternative Financing

**Design**: Full-width section with brand blue gradient background. Large stat numbers in a grid. Moved to position 3 to establish the problem before presenting products.

**Stripe pattern**: The "Why Stripe" / global scale section with big numbers and concise supporting text. Stripe places this early to create stakes.

```
┌─────────────────────────────────────────────────────────┐
│                (brand blue gradient bg)                  │
│                                                         │
│  80% of Zimbabwe works.                                 │
│  Less than 5% can borrow.                               │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │   80%    │  │   <5%    │  │  $14B    │  │  70%+   │ │
│  │ of the   │  │ have     │  │ unserved │  │ mobile  │ │
│  │ workforce│  │ bank     │  │ credit   │  │ money   │ │
│  │ is       │  │ credit   │  │ demand   │  │ adoption│ │
│  │ informal │  │          │  │          │  │         │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                         │
│  Traditional banks don't serve them. We do.             │
│  Mobile money is everywhere — financial                 │
│  products should be too.                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Stats** (short labels — 3-5 words each):
- `80%` — of the workforce is informal
- `<5%` — have access to bank credit
- `$14B` — unserved credit demand
- `70%+` — mobile money adoption

**Section headline**:
> 80% of Zimbabwe works. Less than 5% can borrow.

**Supporting text**:
> Traditional banks don't serve them. We do. Mobile money is everywhere — financial products should be too.

---

## Section 4: Product Suite Overview

**Design**: Clean grid of 3 product cards. Each card has an icon/illustration, product name, one-line description, and a link. Like Stripe's product showcase grid.

**Stripe pattern**: Show the breadth of offerings at a glance before deep-diving into each.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Three products. One mission.                           │
│                                                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐ │
│  │ [illustration]  │ │ [illustration]  │ │ [illustration]   │ │
│  │                 │ │                 │ │                  │ │
│  │ ASSET FINANCING │ │ DIGITAL CREDIT  │ │ ENTERPRISE       │ │
│  │                 │ │                 │ │ PARTNERSHIPS     │ │
│  │ Own the tools   │ │ Cash when you   │ │ Embed credit     │ │
│  │ that power      │ │ need it most    │ │ into your        │ │
│  │ your trade      │ │                 │ │ platform         │ │
│  │                 │ │                 │ │                  │ │
│  │ Learn more →    │ │ Learn more →    │ │ Learn more →     │ │
│  └─────────────────┘ └─────────────────┘ └────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Section headline**:
> Three products. One mission.

**Cards** link/scroll to the product deep-dive sections below.

---

## Section 5: Product Deep Dive — Asset Financing

**Design**: Full-width section. Split layout: text left, product visual/illustration right. White background. Compact — reduced padding (`80px` instead of `120px`) to tighten scroll depth.

**Stripe pattern**: Each product gets a dedicated section with headline + description + features + CTA + visual.

**Label**: ASSET FINANCING

**Headline**:
> Own the tools that power your trade

**Subtext**:
> Finance smartphones and assets with a small deposit. Collect from a local agent, repay via mobile money.

**Features** (4-column grid):

| Feature | Description |
|---------|-------------|
| **Pay a deposit, own the device** | Start with a small deposit. The device is yours from day one. |
| **Pick up locally** | Collect your device from any Lynia agent in your area. |
| **Approved in minutes** | Apply via WhatsApp. Get a decision in under 5 minutes. |
| **Repay via mobile money** | Pay back through your mobile wallet. No bank account needed. |

**CTAs**:
- Primary: `[Start your application]`
- Secondary: `Learn more →`

**Visual**: Flat illustration of a smartphone with a checkmark / approval animation.

---

## Section 6: Product Deep Dive — Digital Credit

**Design**: Alternating background (dark navy `#0A2540` with light text, Stripe-style dark section). Split layout: visual left, text right. Compact padding.

**Label**: DIGITAL CREDIT

**Headline**:
> Cash when you need it most

**Subtext**:
> Digital loans deposited directly into your mobile wallet. Apply once, get funded in under 10 minutes.

**Features** (2-column grid):

| Feature | Description |
|---------|-------------|
| **Application to wallet in minutes** | From application to cash in your wallet — under 10 minutes. |
| **Works with your mobile money** | Receive and repay through the mobile money wallet you already use. |

**CTA**:
- Primary: `[Get notified when we launch →]` (captures phone number or email — converts interest into a lead instead of a dead-end disabled button)

**Visual**: Flat illustration of mobile wallet receiving funds.

---

## Section 7: Product Deep Dive — Enterprise Partnerships

**Design**: Light background (`#F6F9FC`). Split layout: text left, visual right. Compact padding.

**Label**: ENTERPRISE PARTNERSHIPS

**Headline**:
> Embed credit into your platform

**Subtext**:
> Offer your customers financing at the point of need. Lynia handles underwriting, disbursement, and collections — you earn on every transaction.

**Features** (3-item grid):

| Feature | Description |
|---------|-------------|
| **Mobile money native** | Transactions settle instantly through your mobile wallet. |
| **Developer-ready APIs** | Integrate credit products with a few API calls. Monitor disbursements, repayments, and risk in real time. |
| **Shared growth** | Your customers access more. Your platform retains more. Lynia handles underwriting, collections, and risk. |

**CTA**:
- Primary: `[Partner with us]`

**Visual**: Flat illustration of connected platforms / API integration diagram.

---

## Section 8: Customer Segments

**Design**: 3-column card layout. Each card targets a different audience with tailored messaging. Stripe does this for startups / enterprises / platforms.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Built for how Zimbabwe works                           │
│                                                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐ │
│  │ FOR INDIVIDUALS │ │ FOR DISTRIBUTORS│ │ FOR PARTNERS    │ │
│  │                 │ │                 │ │                 │ │
│  │ Smartphones,    │ │ Sell smart-     │ │ Embed credit    │ │
│  │ assets, and     │ │ phones and      │ │ into your       │ │
│  │ cash. Apply     │ │ assets in your  │ │ platform.       │ │
│  │ via WhatsApp    │ │ community. Earn │ │ Offer financing │ │
│  │ in under 5      │ │ commission on   │ │ at the point    │ │
│  │ minutes.        │ │ every sale.     │ │ of sale through │ │
│  │                 │ │                 │ │ our APIs.       │ │
│  │                 │ │                 │ │                 │ │
│  │ Start your      │ │ Become a        │ │ Partner with    │ │
│  │ application →   │ │ distributor →   │ │ us →            │ │
│  └─────────────────┘ └─────────────────┘ └────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Section headline**:
> Built for how Zimbabwe works

---

## Section 9: Editorial

**Design**: 2-3 column card grid showing latest Editorial posts. Stripe features curated editorial content (reports, interviews, announcements).

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  From our Editorial                                     │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ [Image]  │  │ [Image]  │  │ [Image]  │              │
│  │ TAG      │  │ TAG      │  │ TAG      │              │
│  │ Headline │  │ Headline │  │ Headline │              │
│  │ Excerpt  │  │ Excerpt  │  │ Excerpt  │              │
│  │ Date     │  │ Date     │  │ Date     │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                         │
│                 View all articles →                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Source**: Pulls latest 3 posts from Sanity CMS.

---

## Section 10: Bottom CTA

**Design**: Full-width section with gradient or dark background. Final push to convert.

```
┌─────────────────────────────────────────────────────────┐
│              (dark navy or gradient bg)                  │
│                                                         │
│  Apply now. Get funded today.                           │
│                                                         │
│  No bank account required. No paperwork.                │
│  Approval in under 5 minutes.                           │
│                                                         │
│  [Start your application]    Talk to our team →         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Headline**:
> Apply now. Get funded today.

**Subtext**:
> No bank account required. No paperwork. Approval in under 5 minutes.

**CTAs**:
- Primary: `[Start your application]` (filled button, white bg)
- Secondary: `Talk to our team →` (text link, goes to contact page)

---

## Footer

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Lynia Finance (logo)                                   │
│                                                         │
│  Products        Company        Connect       Legal     │
│  ─────────       ───────        ───────       ─────     │
│  Asset           About          X (Twitter)   Privacy   │
│   financing      Careers        LinkedIn       Policy   │
│  Digital         Contact        WhatsApp      Terms     │
│   credit                                                │
│  Enterprise                                             │
│   partnerships                                          │
│                                                         │
│  © 2026 Lynia Finance. All rights reserved.             │
│  Regulated by the Reserve Bank of Zimbabwe.             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Products column** (names match product labels used across the site):
- Asset financing
- Digital credit
- Enterprise partnerships

**Company column**:
- About
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
| Hero with gradient + animated UI | Hero with gradient + WhatsApp UI illustration | CSS gradient default, WebGL progressive enhancement |
| Customer logos bar | Partner/trust logos bar | Mobile wallet providers or stat numbers |
| "Why Stripe" + global numbers | "80% of Zimbabwe works..." + underbanked stats | Moved early (position 3) to establish stakes |
| Product suite grid | 3 product cards (Asset, Digital, Enterprise) | Icons + one-liner + link |
| Individual product sections | 3 product deep-dives | Alternating backgrounds, compact padding |
| Customer segments | For Individuals / Businesses / Partners | 3-column cards |
| Editorial content | Featured Editorial posts | Pulls from Sanity |
| Bottom CTA + pricing | Bottom CTA | Apply now + Talk to our team |
| Nav with CTA button | Nav with "Start your application" button | Persistent conversion path |
| Multi-column footer | Multi-column footer | Products, Company, Connect, Legal |

## Technical Design Notes

| Pattern | Implementation |
|---------|---------------|
| **Gradient background** | CSS gradient default; WebGL progressive enhancement on capable devices |
| **Device mockups** | CSS-rendered phones/laptops (<1KB, hardware-accelerated, responsive) |
| **Section transitions** | Scroll-triggered fade-in animations using Intersection Observer API |
| **Layout** | CSS Grid throughout, 2-column splits for product sections |
| **Dark sections** | Alternating light/dark backgrounds (white ↔ navy `#0A2540`) |
| **Hover effects** | Subtle card elevation/shadow on hover, button color transitions |
| **Mobile** | Single-column stack, hero visual hidden, reduced animations |
| **Product section padding** | `80px` (compact) instead of `120px` for deep-dives to reduce scroll depth |

---

## Editorial Page (Blog)

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

**Inspiration**: stripe.com/contact/sales (styling only — our fields differ)

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

- Split layout on desktop (info left, form right) — Stripe contact/sales style
- Stacks to single column on mobile (info first, then form)
- Partnership application as separate section below the main contact form
- Brand blurple primary buttons
- Clean labels above each field
- WhatsApp floating button also visible on this page

---

## Separate Pages (linked from nav)

- **Products** → Detailed product pages for the 3 product lines
- **About** → Company mission, vision, and values
- **Partnerships** → Distributor and B2B partnership info + application form
- **Editorial** → Blog / articles and news (Sanity CMS)
- **Privacy Policy / Terms** → Legal pages (footer links)
