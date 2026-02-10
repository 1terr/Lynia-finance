# Wireframes — Lynia Finance Landing Page

> Mobile-first wireframes with desktop adaptations.
> Reference [`COMPONENTS.md`](./COMPONENTS.md) for detailed component specs.
> Reference [`DESIGN-TOKENS.md`](./DESIGN-TOKENS.md) for all spacing and sizing values.

---

## Breakpoint Summary

| Name | Min Width | Target Devices |
|------|-----------|----------------|
| Mobile | `0px` | Phones (320–639px) |
| SM | `640px` | Large phones, small tablets |
| MD | `768px` | Tablets (portrait) |
| LG | `1024px` | Tablets (landscape), small laptops |
| XL | `1280px` | Desktops |
| 2XL | `1536px` | Wide desktops |

**Design approach**: All wireframes below show mobile first (default), then desktop adaptation.

---

## Homepage

### Section 1: Navigation

#### Mobile (`< 768px`)

```
┌─────────────────────────────────────┐
│  [Logo]                        [☰]  │  64px tall
└─────────────────────────────────────┘
```

- Logo left, hamburger icon right
- Transparent over hero, solid white on scroll
- Hamburger opens full-screen overlay

#### Mobile Nav Overlay

```
┌─────────────────────────────────────┐
│                                [✕]  │
│                                     │
│  Products                           │
│  ─────────────────────────          │
│  Mission                            │
│  ─────────────────────────          │
│  Partnerships                       │
│  ─────────────────────────          │
│  Research                           │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

#### Desktop (`≥ 1024px`)

```
┌──────────────────────────────────────────────────────────────┐
│  [Logo]              Products   Mission   Partnerships   Research  │  72px tall
└──────────────────────────────────────────────────────────────┘
```

- Logo left, links right, all in single row
- Centered within `max-width: 1280px` container

---

### Section 1: Hero

#### Mobile

```
┌─────────────────────────────────────┐
│          (gradient background)       │
│                                     │
│  Credit that works                  │
│  for real people                    │
│                                     │  40px headline
│  Lynia Finance helps you get the    │
│  smartphone, tools, or cash you     │  18px subtext
│  need—giving you the power to       │
│  earn more and do more.             │
│                                     │
│  ┌─────────────────────────────┐    │
│  │        Apply now             │    │  Primary CTA
│  └─────────────────────────────┘    │
│                                     │
│  Lets chat on whatsapp →            │  Secondary CTA
│                                     │
│                                     │
│  ┌─────────────────────────┐        │
│  │  [Phone mockup,         │        │  Optional: visible
│  │   reduced size]         │        │  on larger mobiles
│  └─────────────────────────┘        │
│                                     │
└─────────────────────────────────────┘

Height: auto (content-driven)
Padding: 80px top, 64px bottom
```

- Single column, text centered or left-aligned
- CTAs stack vertically on very small screens, inline on `≥ 640px`
- Phone mockup optional — hide on `< 640px`, show reduced at `≥ 640px`

#### Desktop (`≥ 1024px`)

```
┌──────────────────────────────────────────────────────────────┐
│                     (WebGL gradient background)               │
│                                                              │
│   ┌──────────────────────┐  ┌────────────────────────────┐   │
│   │                      │  │                            │   │
│   │  Credit that works   │  │   ┌──────────────────┐     │   │
│   │  for real people     │  │   │                  │     │   │
│   │                      │  │   │   [WhatsApp UI   │     │   │
│   │  Lynia Finance helps │  │   │    phone mockup  │     │   │
│   │  you get the         │  │   │    with loan     │     │   │
│   │  smartphone, tools,  │  │   │    approval      │     │   │
│   │  or cash you need    │  │   │    flow]         │     │   │
│   │  —giving you the     │  │   │                  │     │   │
│   │  power to earn more  │  │   └──────────────────┘     │   │
│   │  and do more.        │  │                            │   │
│   │                      │  │                            │   │
│   │  [Apply now]         │  │                            │   │
│   │  Lets chat on        │  │                            │   │
│   │  whatsapp →          │  │                            │   │
│   │                      │  │                            │   │
│   └──────────────────────┘  └────────────────────────────┘   │
│           50%                         50%                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Height: 100vh
Grid: 1fr 1fr
```

- Two columns, vertically centered
- Left: text + CTAs
- Right: animated phone mockup with floating animation

---

### Section 2: Social Proof / Trust Bar

#### Mobile

```
┌─────────────────────────────────────┐
│  Trusted by partners across         │
│  Zimbabwe                           │
│                                     │
│   [Logo]  [Logo]  [Logo]           │
│   [Logo]  [Logo]  [Logo]           │
│                                     │
└─────────────────────────────────────┘

Padding: 40px vertical
Logos: 3-column grid, grayscale
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Trusted by partners across Zimbabwe                         │
│                                                              │
│  [Logo]    [Logo]    [Logo]    [Logo]    [Logo]    [Logo]   │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Padding: 40px vertical
Logos: single row, flex, centered, 48px gap
```

---

### Section 3: Product Suite Overview

#### Mobile

```
┌─────────────────────────────────────┐
│                                     │
│  A fully integrated suite           │
│  of credit products                 │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  [illustration]              │    │
│  │  ASSET FINANCING             │    │
│  │  Own the tools that power    │    │
│  │  your trade                  │    │
│  │  Learn more →                │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  [illustration]              │    │
│  │  DIGITAL CREDIT              │    │
│  │  Cash when you need it most  │    │
│  │  Learn more →                │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  [illustration]              │    │
│  │  ENTERPRISE PARTNERSHIPS     │    │
│  │  Credit built into your      │    │
│  │  business                    │    │
│  │  Learn more →                │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘

Cards: stacked, full width
Gap: 16px between cards
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│             A fully integrated suite of credit products       │
│                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │  [illustration]  │ │  [illustration]  │ │  [illustration]  │ │
│  │                  │ │                  │ │                  │ │
│  │  ASSET FINANCING │ │  DIGITAL CREDIT  │ │  ENTERPRISE      │ │
│  │  Own the tools   │ │  Cash when you   │ │  PARTNERSHIPS    │ │
│  │  that power your │ │  need it most    │ │  Credit built    │ │
│  │  trade           │ │                  │ │  into your biz   │ │
│  │                  │ │                  │ │                  │ │
│  │  Learn more →    │ │  Learn more →    │ │  Learn more →    │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Grid: 3 columns, equal width
Gap: 32px
```

---

### Section 4: Asset Financing Deep Dive

#### Mobile

```
┌─────────────────────────────────────┐
│            (white bg)                │
│                                     │
│  ASSET FINANCING                    │
│                                     │
│  Own the tools that                 │
│  power your trade                   │
│                                     │
│  Get smartphones, tools of your     │
│  trade through flexible financing.  │
│  These assets are productive tools  │
│  that help you earn more...         │
│                                     │
│  ┌────────────┐  ┌────────────┐    │
│  │ [icon]     │  │ [icon]     │    │
│  │ Ownership  │  │ Collection │    │
│  │ Own asset  │  │ Collect at │    │
│  │ after a    │  │ nearest    │    │
│  │ deposit    │  │ agent      │    │
│  └────────────┘  └────────────┘    │
│                                     │
│  ┌────────────┐  ┌────────────┐    │
│  │ [icon]     │  │ [icon]     │    │
│  │ Application│  │ Repayment  │    │
│  │ Approved   │  │ Repay via  │    │
│  │ in < 5 min │  │ mobile     │    │
│  └────────────┘  └────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │        Apply now             │    │
│  └─────────────────────────────┘    │
│  Lets chat on whatsapp →            │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  [Flat illustration:        │    │
│  │   smartphone with           │    │
│  │   checkmark]                │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘

Features: 2-column grid
Visual: below text, max 300px height
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│                          (white bg)                           │
│                                                              │
│  ┌────────────────────────────┐ ┌────────────────────────┐   │
│  │                            │ │                        │   │
│  │  ASSET FINANCING           │ │                        │   │
│  │                            │ │  [Flat illustration:   │   │
│  │  Own the tools that        │ │   smartphone with      │   │
│  │  power your trade          │ │   approval animation]  │   │
│  │                            │ │                        │   │
│  │  Get smartphones, tools... │ │                        │   │
│  │                            │ │                        │   │
│  │  [Ownership] [Collection]  │ │                        │   │
│  │  [Application] [Repayment] │ │                        │   │
│  │                            │ │                        │   │
│  │  [Apply now]               │ │                        │   │
│  │  Lets chat on whatsapp →   │ │                        │   │
│  │                            │ │                        │   │
│  └────────────────────────────┘ └────────────────────────┘   │
│          TEXT LEFT                    VISUAL RIGHT            │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Grid: 1fr 1fr, gap 48px
Features: 4 columns within text column (or 2×2)
```

---

### Section 5: Digital Credit Deep Dive

#### Mobile

```
┌─────────────────────────────────────┐
│            (navy bg #0A1628)         │
│                                     │
│  DIGITAL CREDIT                     │  (accent-2 color)
│                                     │
│  Cash when you need                 │  (white text)
│  it most                            │
│                                     │
│  Quick, secure digital loans        │  (white 70% opacity)
│  delivered straight to your         │
│  mobile wallet...                   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ [icon]                       │    │
│  │ Instant approval             │    │
│  │ Apply, get approved and      │    │
│  │ receive funds in < 10 min.   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ [icon]                       │    │
│  │ Mobile money friendly        │    │
│  │ Deposited directly into      │    │
│  │ your mobile wallet.          │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │       Coming soon            │    │  (disabled button)
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  [Flat illustration:        │    │
│  │   mobile wallet              │    │
│  │   receiving funds]           │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘

Features: single column (stacked)
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│                      (navy bg #0A1628)                        │
│                                                              │
│  ┌────────────────────────┐ ┌────────────────────────────┐   │
│  │                        │ │                            │   │
│  │  [Flat illustration:   │ │  DIGITAL CREDIT            │   │
│  │   mobile wallet        │ │                            │   │
│  │   receiving funds]     │ │  Cash when you need        │   │
│  │                        │ │  it most                   │   │
│  │                        │ │                            │   │
│  │                        │ │  Quick, secure digital...  │   │
│  │                        │ │                            │   │
│  │                        │ │  [Instant] [Mobile money]  │   │
│  │                        │ │                            │   │
│  │                        │ │  [Coming soon]             │   │
│  │                        │ │                            │   │
│  └────────────────────────┘ └────────────────────────────┘   │
│        VISUAL LEFT                   TEXT RIGHT              │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Grid: 1fr 1fr (REVERSED from Section 4)
Features: 2 columns within text column
```

---

### Section 6: Enterprise Partnerships Deep Dive

#### Mobile

```
┌─────────────────────────────────────┐
│            (light gray bg)           │
│                                     │
│  ENTERPRISE PARTNERSHIPS            │
│                                     │
│  Credit built into                  │
│  your business                      │
│                                     │
│  We partner with enterprises        │
│  to embed financing directly        │
│  into their platforms...            │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ [icon] Mobile money first    │    │
│  │ Description text...          │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ [icon] API friendly          │    │
│  │ Description text...          │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ [icon] Value creation        │    │
│  │ Description text...          │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     Partner with us          │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  [Flat illustration:        │    │
│  │   connected platforms]      │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘

Features: single column (stacked)
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│                       (light gray bg)                         │
│                                                              │
│  ┌────────────────────────────┐ ┌────────────────────────┐   │
│  │                            │ │                        │   │
│  │  ENTERPRISE PARTNERSHIPS   │ │  [Flat illustration:   │   │
│  │                            │ │   connected platforms   │   │
│  │  Credit built into         │ │   / API integration    │   │
│  │  your business             │ │   diagram]             │   │
│  │                            │ │                        │   │
│  │  We partner with...        │ │                        │   │
│  │                            │ │                        │   │
│  │  [Mobile]  [API]  [Value]  │ │                        │   │
│  │                            │ │                        │   │
│  │  [Partner with us]         │ │                        │   │
│  │                            │ │                        │   │
│  └────────────────────────────┘ └────────────────────────┘   │
│         TEXT LEFT                    VISUAL RIGHT             │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Grid: 1fr 1fr (same direction as Section 4)
Features: 3 columns within text column
```

---

### Section 7: Why Alternative Financing

#### Mobile

```
┌─────────────────────────────────────┐
│         (blue gradient bg)           │
│                                     │
│  Building credit rails              │
│  for the underbanked                │
│                                     │
│  ┌────────────┐  ┌────────────┐    │
│  │    80%      │  │    <5%     │    │
│  │  Informal   │  │  Have bank │    │
│  │  workforce  │  │  credit    │    │
│  └────────────┘  └────────────┘    │
│                                     │
│  ┌────────────┐  ┌────────────┐    │
│  │   $14B     │  │   70%+     │    │
│  │  Unserved  │  │  Mobile    │    │
│  │  credit    │  │  money     │    │
│  │  demand    │  │  adoption  │    │
│  └────────────┘  └────────────┘    │
│                                     │
│  Traditional banks don't serve      │
│  them. We do. Zimbabwe's informal   │
│  workforce is 80% of the economy    │
│  yet almost entirely excluded...    │
│                                     │
└─────────────────────────────────────┘

Stats: 2-column grid
All text: white / white-70%
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│                      (blue gradient bg)                       │
│                                                              │
│          Building credit rails for the underbanked            │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────┐ │
│  │    80%      │  │    <5%     │  │   $14B     │  │  70%+  │ │
│  │  Informal   │  │  Have bank │  │  Unserved  │  │ Mobile │ │
│  │  workforce  │  │  credit    │  │  credit    │  │ money  │ │
│  │             │  │  access    │  │  demand    │  │ adopt. │ │
│  └────────────┘  └────────────┘  └────────────┘  └────────┘ │
│                                                              │
│  Traditional banks don't serve them. We do. Zimbabwe's       │
│  informal workforce is 80% of the economy yet almost         │
│  entirely excluded from credit. Mobile money penetration     │
│  is high, but financial products haven't followed.           │
│  Alternative financing bridges this gap.                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Stats: 4-column grid, centered
Headline: centered
Supporting text: centered, max-width 680px
```

---

### Section 8: Customer Segments

#### Mobile

```
┌─────────────────────────────────────┐
│                                     │
│  Built for everyone in              │
│  the value chain                    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  FOR INDIVIDUALS             │    │
│  │                              │    │
│  │  Get the tools you need to   │    │
│  │  earn more. Smartphones,     │    │
│  │  equipment, and cash — all   │    │
│  │  via WhatsApp.               │    │
│  │                              │    │
│  │  Apply now →                 │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  FOR BUSINESSES              │    │
│  │  ...                         │    │
│  │  Coming soon →               │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  FOR PARTNERS                │    │
│  │  ...                         │    │
│  │  Partner with us →           │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘

Cards: stacked, full width
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│            Built for everyone in the value chain              │
│                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │  FOR INDIVIDUALS │ │  FOR BUSINESSES  │ │  FOR PARTNERS   │ │
│  │                  │ │                  │ │                  │ │
│  │  Get the tools   │ │  Grow your       │ │  Embed credit   │ │
│  │  you need to     │ │  business with   │ │  into your      │ │
│  │  earn more...    │ │  instant digital │ │  platform...    │ │
│  │                  │ │  credit...       │ │                  │ │
│  │  Apply now →     │ │  Coming soon →   │ │  Partner with   │ │
│  │                  │ │                  │ │  us →            │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Grid: 3 equal columns, 32px gap
```

---

### Section 9: Editorial / Featured Research

#### Mobile

```
┌─────────────────────────────────────┐
│                                     │
│  From our Research                  │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ┌───────────────────────┐  │    │
│  │  │  [Illustration]        │  │    │
│  │  └───────────────────────┘  │    │
│  │  CATEGORY                    │    │
│  │  Post Headline               │    │
│  │  Excerpt text...             │    │
│  │  12 Feb 2026                 │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  [Card 2]                    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  [Card 3]                    │    │
│  └─────────────────────────────┘    │
│                                     │
│  View all research →                │
│                                     │
└─────────────────────────────────────┘

Cards: stacked, full width
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  From our Research                                           │
│                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │  ┌────────────┐  │ │  ┌────────────┐  │ │  ┌────────────┐  │ │
│  │  │  [Image]   │  │ │  │  [Image]   │  │ │  │  [Image]   │  │ │
│  │  └────────────┘  │ │  └────────────┘  │ │  └────────────┘  │ │
│  │  CATEGORY        │ │  CATEGORY        │ │  CATEGORY        │ │
│  │  Headline        │ │  Headline        │ │  Headline        │ │
│  │  Excerpt text... │ │  Excerpt text... │ │  Excerpt text... │ │
│  │  12 Feb 2026     │ │  12 Feb 2026     │ │  12 Feb 2026     │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│                                                              │
│                      View all research →                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Grid: 3 equal columns, 32px gap
```

---

### Section 10: Bottom CTA

#### Mobile

```
┌─────────────────────────────────────┐
│        (dark gradient bg)            │
│                                     │
│  Ready to get started?              │
│                                     │
│  Get the smartphone, tools, or      │
│  cash you need. Apply in under      │
│  5 minutes via WhatsApp.            │
│                                     │
│  ┌─────────────────────────────┐    │
│  │        Apply now             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Lets chat on whatsapp →            │
│                                     │
└─────────────────────────────────────┘

Text: centered
CTAs: stacked
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│                      (dark gradient bg)                       │
│                                                              │
│               Ready to get started?                           │
│                                                              │
│       Get the smartphone, tools, or cash you need.            │
│       Apply in under 5 minutes via WhatsApp.                  │
│                                                              │
│              [Apply now]   Lets chat on whatsapp →             │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Text: centered
CTAs: inline row, centered
```

---

### Section 11: Footer

#### Mobile

```
┌─────────────────────────────────────┐
│             (navy bg)                │
│                                     │
│  [Logo - white]                     │
│                                     │
│  Products                           │
│  ────────                           │
│  Smartphone financing               │
│  Digital loans                      │
│  Embedded financing                 │
│                                     │
│  Company                            │
│  ───────                            │
│  Careers                            │
│  Contact                            │
│                                     │
│  Connect                            │
│  ───────                            │
│  X (Twitter)                        │
│  LinkedIn                           │
│  WhatsApp                           │
│                                     │
│  Legal                              │
│  ─────                              │
│  Privacy Policy                     │
│  Terms                              │
│                                     │
│  ────────────────────               │
│                                     │
│  © 2026 Lynia Finance.              │
│  All rights reserved.               │
│  Regulated by the Reserve           │
│  Bank of Zimbabwe.                  │
│                                     │
└─────────────────────────────────────┘

Layout: single column, stacked groups
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│                            (navy bg)                          │
│                                                              │
│  [Logo - white variant]                                      │
│                                                              │
│  Products          Company       Connect       Legal         │
│  ────────          ───────       ───────       ─────         │
│  Smartphone        Careers       X (Twitter)   Privacy Policy│
│   financing        Contact       LinkedIn      Terms         │
│  Digital loans                   WhatsApp                    │
│  Embedded                                                    │
│   financing                                                  │
│                                                              │
│  ──────────────────────────────────────────────              │
│                                                              │
│  © 2026 Lynia Finance. All rights reserved.                  │
│  Regulated by the Reserve Bank of Zimbabwe.                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Grid: 4 columns
```

---

## Research Page

### Mobile

```
┌─────────────────────────────────────┐
│  [Nav]                               │
├─────────────────────────────────────┤
│                                     │
│  RESEARCH                           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ┌───────────────────────┐  │    │
│  │  │  [Featured image]      │  │    │
│  │  └───────────────────────┘  │    │
│  │  CATEGORY                    │    │
│  │  Featured Headline           │    │  H2
│  │  Excerpt text...             │    │
│  │  12 Feb 2026                 │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ All │ Products │ Eng │ Company ││  Horizontal scroll
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────┐    │
│  │  [Post card 1]               │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  [Post card 2]               │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  [Post card 3]               │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Load more]                        │
│                                     │
├─────────────────────────────────────┤
│  [Footer]                           │
└─────────────────────────────────────┘

Post cards: stacked, full width
Category pills: horizontally scrollable
```

### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│  [Nav]                                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  RESEARCH                                                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  ┌────────────────────────────────────────────────┐  │    │
│  │  │  [Featured post large image]                    │  │    │
│  │  └────────────────────────────────────────────────┘  │    │
│  │  CATEGORY                                            │    │
│  │  Featured Headline Here in Large Text                │    │  H1
│  │  Excerpt text describing the article...              │    │
│  │  12 Feb 2026                                         │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  [All] [Products] [Engineering] [Company] [Market]           │
│                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│  │  [Post card]     │ │  [Post card]     │ │  [Post card]  │ │
│  └──────────────────┘ └──────────────────┘ └──────────────┘ │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐ │
│  │  [Post card]     │ │  [Post card]     │ │  [Post card]  │ │
│  └──────────────────┘ └──────────────────┘ └──────────────┘ │
│                                                              │
│  [Load more]                                                 │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [Footer]                                                    │
└──────────────────────────────────────────────────────────────┘

Post grid: 3 columns
Category pills: flex row, centered
```

---

## Contact Page

### Mobile

```
┌─────────────────────────────────────┐
│  [Nav]                               │
├─────────────────────────────────────┤
│                                     │
│  Get in touch                       │
│                                     │
│  Have a question or want to         │
│  learn more? We'd love to hear      │
│  from you.                          │
│                                     │
│  ──────────────                     │
│                                     │
│  OTHER WAYS TO REACH US             │
│                                     │
│  [WhatsApp icon] WhatsApp           │
│  Chat with us directly              │
│                                     │
│  [Mail icon] Email                  │
│  hello@lyniafinance.com             │
│                                     │
│  [Map icon] Location                │
│  Harare, Zimbabwe                   │
│                                     │
│  ──────────────                     │
│                                     │
│  CONTACT FORM                       │
│                                     │
│  Name *                             │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│  Phone number *                     │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│  Email                              │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│  Message                            │
│  ┌─────────────────────────────┐    │
│  │                              │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │       Send message           │    │
│  └─────────────────────────────┘    │
│                                     │
│  ══════════════════════════════     │
│                                     │
│  WANT TO PARTNER WITH US?           │
│                                     │
│  Name *                             │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│  Phone number *                     │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│  Email *                            │
│  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │
│  Type of partnership *              │
│  ┌─────────────────────────────┐    │
│  │ Distributor              ▼   │    │
│  └─────────────────────────────┘    │
│  Message                            │
│  ┌─────────────────────────────┐    │
│  │                              │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Submit partnership app      │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│  [Footer]                           │
└─────────────────────────────────────┘

Layout: single column, stacked
Info section first, then contact form, then partnership form
```

### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│  [Nav]                                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────┬──────────────────────────┐     │
│  │                          │                          │     │
│  │  Get in touch            │  CONTACT FORM            │     │
│  │                          │                          │     │
│  │  Have a question or      │  Name *                  │     │
│  │  want to learn more?     │  ┌────────────────────┐  │     │
│  │  We'd love to hear       │  └────────────────────┘  │     │
│  │  from you.               │  Phone number *          │     │
│  │                          │  ┌────────────────────┐  │     │
│  │  ─────────────           │  └────────────────────┘  │     │
│  │                          │  Email                   │     │
│  │  OTHER WAYS TO REACH US  │  ┌────────────────────┐  │     │
│  │                          │  └────────────────────┘  │     │
│  │  [WA] WhatsApp           │  Message                 │     │
│  │  Chat with us directly   │  ┌────────────────────┐  │     │
│  │                          │  │                    │  │     │
│  │  [Mail] Email            │  └────────────────────┘  │     │
│  │  hello@lyniafinance.com  │                          │     │
│  │                          │  [Send message]          │     │
│  │  [Pin] Location          │                          │     │
│  │  Harare, Zimbabwe        │                          │     │
│  │                          │                          │     │
│  └──────────────────────────┴──────────────────────────┘     │
│                                                              │
│  ════════════════════════════════════                         │
│                                                              │
│  WANT TO PARTNER WITH US?                                    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐      │
│  │  Name *   Phone *   Email *   Type *               │      │
│  │  [input]  [input]   [input]   [select]             │      │
│  │  Message                                           │      │
│  │  [textarea                                    ]    │      │
│  │                                                    │      │
│  │  [Submit partnership application]                  │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [Footer]                                                    │
└──────────────────────────────────────────────────────────────┘

Contact: split layout (info left, form right)
Partnership: full width, fields in row
```

---

## WhatsApp Floating Button (all pages)

```
                                    ┌──────────────┐
                                    │ Chat with us │
                                    └──────────────┘
                                         ┌────┐
                                         │ WA │  56px circle
                                         └────┘
                                    ↑ 24px from bottom-right
```

- Always visible on all pages
- Fixed position, bottom-right corner
- Above footer when scrolled to bottom
- Tooltip on hover (desktop) or briefly on load (mobile)
