# Wireframes — Lynia Finance Landing Page

> Mobile-first wireframes with desktop adaptations.
> Design language follows [stripe.com](https://stripe.com).
> Reference [`COMPONENTS.md`](./COMPONENTS.md) for detailed component specs.
> Reference [`DESIGN-TOKENS.md`](./DESIGN-TOKENS.md) for all spacing and sizing values.
> Reference [`CONTENT.md`](./CONTENT.md) for all copy (source of truth).

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
┌──────────────────────────────────────┐
│                                      │
│  [Logo]                         [☰]  │
│                                      │
└──────────────────────────────────────┘

Height: 64px
Background: transparent over hero → white on scroll
```

- Logo left-aligned, hamburger icon right-aligned
- Transparent over hero, solid white + backdrop blur on scroll
- Hamburger opens full-screen overlay

#### Mobile Nav Overlay

```
┌──────────────────────────────────────┐
│                                 [✕]  │
│                                      │
│  Products                            │
│  ─────────────────────────────       │
│  About                               │
│  ─────────────────────────────       │
│  Partnerships                        │
│  ─────────────────────────────       │
│  Editorial                           │
│  ─────────────────────────────       │
│                                      │
│  ┌──────────────────────────────┐    │
│  │     Start your application    │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘

CTA button appears as last item in mobile menu
```

#### Desktop (`≥ 1024px`)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  [Logo]       Products  About  Partnerships  Editorial     [Start your application]  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Height: 72px
CTA: primary button style (blurple bg, white text)
Container: max-width 1280px, centered
```

- Logo left, nav links center-right, CTA button far right
- CTA button provides persistent conversion path from any scroll position (Stripe pattern)

---

### Section 1: Hero

#### Mobile (`< 768px`)

```
┌──────────────────────────────────────┐
│          (gradient background)        │
│                                      │
│  Financial tools                     │
│  for the underbanked                 │   32px headline
│                                      │
│  Smartphones, assets, and         │
│  cash — delivered through            │   16px subtext
│  WhatsApp with approval in           │
│  under 5 minutes.                    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │     Start your application    │    │   Primary CTA
│  └──────────────────────────────┘    │
│                                      │
│  See how it works →                  │   Secondary CTA
│                                      │
└──────────────────────────────────────┘

Height: auto (content-driven, NOT full viewport)
Padding: 48px top (after 64px nav), 48px bottom
Phone mockup: HIDDEN on < 768px
Above the fold: headline + subtext + CTA must all appear on 375px screen
```

- Single column, text left-aligned
- CTAs stack vertically
- No phone mockup — prioritize content load speed and above-fold CTA

#### Desktop (`≥ 1024px`)

```
┌──────────────────────────────────────────────────────────────────┐
│                       (CSS gradient background)                   │
│                  (WebGL progressive enhancement)                  │
│                                                                  │
│   ┌────────────────────────────┐  ┌──────────────────────────┐   │
│   │                            │  │                          │   │
│   │  Financial tools           │  │   ┌────────────────┐     │   │
│   │  for the underbanked       │  │   │                │     │   │
│   │                            │  │   │  [WhatsApp UI  │     │   │
│   │  Smartphones, assets,   │  │   │   phone mockup │     │   │
│   │  and cash — delivered      │  │   │   with loan    │     │   │
│   │  through WhatsApp with     │  │   │   approval     │     │   │
│   │  approval in under         │  │   │   flow]        │     │   │
│   │  5 minutes.                │  │   │                │     │   │
│   │                            │  │   └────────────────┘     │   │
│   │  [Start your application]  │  │                          │   │
│   │  See how it works →        │  │                          │   │
│   │                            │  │                          │   │
│   └────────────────────────────┘  └──────────────────────────┘   │
│            50%                            50%                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Height: 100vh
Grid: 1fr 1fr, gap 48px
Gradient: CSS fallback default, WebGL if hardwareConcurrency >= 4
```

- Two columns, vertically centered
- Left: text + CTAs
- Right: animated phone mockup with floating animation

---

### Section 2: Social Proof / Trust Bar

#### Mobile

```
┌──────────────────────────────────────┐
│                                      │
│  500+ loans    <5 min     100%       │
│  funded        approval   mobile     │
│                                      │
└──────────────────────────────────────┘

Padding: 32px vertical
Fallback: 3 stat items in flex row, centered
```

- Stats as proof when logos unavailable
- No label text (Stripe pattern — logos/numbers speak for themselves)

#### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│    [Logo]    [Logo]    [Logo]    [Logo]    [Logo]    [Logo]      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Padding: 40px vertical
Logos: single row, flex, centered, 48px gap, grayscale by default
```

- When logos available: horizontal flex row, no label
- When logos unavailable: stat numbers in flex row

---

### Section 3: Why Alternative Financing (Stats)

**Moved from position 7 to position 3** — establishes the problem before products.

#### Mobile

```
┌──────────────────────────────────────┐
│          (blue gradient bg)           │
│                                      │
│  80% of Zimbabwe works.              │
│  Less than 5% can                    │   28px headline
│  borrow.                             │
│                                      │
│  ┌────────────┐  ┌────────────┐      │
│  │    80%      │  │    <5%     │      │
│  │  of the     │  │  have bank │      │
│  │  workforce  │  │  credit    │      │
│  │  is informal│  │            │      │
│  └────────────┘  └────────────┘      │
│                                      │
│  ┌────────────┐  ┌────────────┐      │
│  │   $14B     │  │   70%+     │      │
│  │  unserved  │  │  mobile    │      │
│  │  credit    │  │  money     │      │
│  │  demand    │  │  adoption  │      │
│  └────────────┘  └────────────┘      │
│                                      │
│  Traditional banks don't serve       │
│  them. We do. Mobile money is        │
│  everywhere — financial products     │
│  should be too.                      │
│                                      │
└──────────────────────────────────────┘

Stats: 2-column grid
All text: white / white-70%
Padding: 64px vertical
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│                       (blue gradient bg)                          │
│                                                                  │
│        80% of Zimbabwe works. Less than 5% can borrow.           │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐│
│  │     80%       │ │     <5%      │ │    $14B      │ │   70%+   ││
│  │  of the       │ │  have bank   │ │  unserved    │ │  mobile  ││
│  │  workforce    │ │  credit      │ │  credit      │ │  money   ││
│  │  is informal  │ │              │ │  demand      │ │  adoption││
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘│
│                                                                  │
│     Traditional banks don't serve them. We do. Mobile money      │
│     is everywhere — financial products should be too.            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Stats: 4-column grid, centered
Headline: centered
Supporting text: centered, max-width 680px
Padding: 120px vertical
```

---

### Section 4: Product Suite Overview

#### Mobile

```
┌──────────────────────────────────────┐
│                                      │
│  Three products. One mission.        │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [illustration]               │    │
│  │  ASSET FINANCING              │    │
│  │  Own the tools that power     │    │
│  │  your trade                   │    │
│  │  Learn more →                 │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [illustration]               │    │
│  │  DIGITAL CREDIT               │    │
│  │  Cash when you need it most   │    │
│  │  Learn more →                 │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [illustration]               │    │
│  │  ENTERPRISE PARTNERSHIPS      │    │
│  │  Embed credit into your       │    │
│  │  platform                     │    │
│  │  Learn more →                 │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘

Cards: stacked, full width
Gap: 16px between cards
Padding: 64px vertical
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                Three products. One mission.                       │
│                                                                  │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐│
│  │  [illustration]    │ │  [illustration]    │ │  [illustration]    ││
│  │                    │ │                    │ │                    ││
│  │  ASSET FINANCING   │ │  DIGITAL CREDIT    │ │  ENTERPRISE        ││
│  │  Own the tools     │ │  Cash when you     │ │  PARTNERSHIPS      ││
│  │  that power your   │ │  need it most      │ │  Embed credit into ││
│  │  trade             │ │                    │ │  your platform     ││
│  │                    │ │                    │ │                    ││
│  │  Learn more →      │ │  Learn more →      │ │  Learn more →      ││
│  └────────────────────┘ └────────────────────┘ └────────────────────┘│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Grid: 3 columns, equal width
Gap: 32px
Padding: 120px vertical
```

---

### Section 5: Asset Financing Deep Dive

#### Mobile

```
┌──────────────────────────────────────┐
│             (white bg)                │
│                                      │
│  ASSET FINANCING                     │
│                                      │
│  Own the tools that                  │
│  power your trade                    │   28px headline
│                                      │
│  Finance a smartphone or             │
│  assets with a small deposit.     │   16px subtext
│  Collect from a local agent,         │
│  repay via mobile money.             │
│                                      │
│  ┌──────────────┐  ┌──────────────┐  │
│  │ [icon]       │  │ [icon]       │  │
│  │ Pay a        │  │ Pick up      │  │
│  │ deposit,     │  │ locally      │  │
│  │ own the      │  │              │  │
│  │ device       │  │ Collect from │  │
│  │              │  │ any Lynia    │  │
│  │ Start with   │  │ agent.       │  │
│  │ a small      │  │              │  │
│  │ deposit.     │  │              │  │
│  └──────────────┘  └──────────────┘  │
│                                      │
│  ┌──────────────┐  ┌──────────────┐  │
│  │ [icon]       │  │ [icon]       │  │
│  │ Approved in  │  │ Repay via    │  │
│  │ minutes      │  │ mobile money │  │
│  │              │  │              │  │
│  │ Apply via    │  │ Your mobile  │  │
│  │ WhatsApp.    │  │ wallet.      │  │
│  └──────────────┘  └──────────────┘  │
│                                      │
│  ┌──────────────────────────────┐    │
│  │    Start your application     │    │
│  └──────────────────────────────┘    │
│  Learn more →                        │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [Flat illustration:         │    │
│  │   smartphone + checkmark]    │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘

Features: 2-column grid
Visual: below text, max 280px height
Padding: 64px vertical (compact)
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│                            (white bg)                             │
│                                                                  │
│  ┌──────────────────────────────┐ ┌──────────────────────────┐   │
│  │                              │ │                          │   │
│  │  ASSET FINANCING             │ │                          │   │
│  │                              │ │  [Flat illustration:     │   │
│  │  Own the tools that          │ │   smartphone with        │   │
│  │  power your trade            │ │   approval animation]    │   │
│  │                              │ │                          │   │
│  │  Finance a smartphone or     │ │                          │   │
│  │  assets with a small      │ │                          │   │
│  │  deposit. Collect from a     │ │                          │   │
│  │  local agent, repay via      │ │                          │   │
│  │  mobile money.               │ │                          │   │
│  │                              │ │                          │   │
│  │  [Deposit] [Local] [Fast]    │ │                          │   │
│  │  [Mobile]                    │ │                          │   │
│  │                              │ │                          │   │
│  │  [Start your application]    │ │                          │   │
│  │  Learn more →                │ │                          │   │
│  │                              │ │                          │   │
│  └──────────────────────────────┘ └──────────────────────────┘   │
│          TEXT LEFT                       VISUAL RIGHT             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Grid: 1fr 1fr, gap 48px
Features: 2×2 grid within text column
Padding: 80px vertical (compact — reduced from 120px)
```

---

### Section 6: Digital Credit Deep Dive

#### Mobile

```
┌──────────────────────────────────────┐
│          (navy bg #0A2540)            │
│                                      │
│  DIGITAL CREDIT                      │   #635BFF blurple
│                                      │
│  Cash when you need                  │   white text
│  it most                             │   28px
│                                      │
│  Digital loans deposited             │   white 70% opacity
│  directly into your mobile            │
│  wallet. Apply                       │
│  once, get funded in under           │
│  10 minutes.                         │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ [icon]                        │    │
│  │ Application to wallet         │    │
│  │ in minutes                    │    │
│  │ From application to cash      │    │
│  │ — under 10 minutes.           │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ [icon]                        │    │
│  │ Works with your mobile money  │    │
│  │ Receive and repay through     │    │
│  │ the wallet you already use.   │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ Get notified when we launch → │    │   Lead capture CTA
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [Flat illustration:         │    │
│  │   mobile wallet + funds]     │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘

Features: single column (stacked)
CTA: lead capture (not disabled button)
Padding: 64px vertical (compact)
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│                        (navy bg #0A2540)                          │
│                                                                  │
│  ┌──────────────────────────┐ ┌──────────────────────────────┐   │
│  │                          │ │                              │   │
│  │  [Flat illustration:     │ │  DIGITAL CREDIT              │   │
│  │   mobile wallet          │ │                              │   │
│  │   receiving funds]       │ │  Cash when you need          │   │
│  │                          │ │  it most                     │   │
│  │                          │ │                              │   │
│  │                          │ │  Digital loans deposited     │   │
│  │                          │ │  directly into your mobile   │   │
│  │                          │ │  wallet.                     │   │
│  │                          │ │                              │   │
│  │                          │ │  [Fast]  [Mobile money]      │   │
│  │                          │ │                              │   │
│  │                          │ │  [Get notified when we       │   │
│  │                          │ │   launch →]                  │   │
│  │                          │ │                              │   │
│  └──────────────────────────┘ └──────────────────────────────┘   │
│        VISUAL LEFT                     TEXT RIGHT                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Grid: 1fr 1fr (REVERSED from Section 5)
Features: 2 columns within text column
CTA: lead capture (phone/email input + submit) — NOT disabled "Coming soon"
Padding: 80px vertical (compact)
```

---

### Section 7: Enterprise Partnerships Deep Dive

#### Mobile

```
┌──────────────────────────────────────┐
│          (light gray bg #F6F9FC)      │
│                                      │
│  ENTERPRISE PARTNERSHIPS             │
│                                      │
│  Embed credit into                   │
│  your platform                       │   28px
│                                      │
│  Offer your customers financing      │
│  at the point of need. Lynia         │
│  handles underwriting,               │
│  disbursement, and collections       │
│  — you earn on every transaction.    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ [icon] Mobile money native    │    │
│  │ Transactions settle instantly │    │
│  │ through your mobile wallet.   │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ [icon] Developer-ready APIs   │    │
│  │ Integrate credit products     │    │
│  │ with a few API calls.         │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ [icon] Shared growth          │    │
│  │ Your customers access more.   │    │
│  │ Your platform retains more.   │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │       Partner with us         │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [Flat illustration:         │    │
│  │   connected platforms]       │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘

Features: single column (stacked)
Padding: 64px vertical (compact)
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│                       (light gray bg #F6F9FC)                     │
│                                                                  │
│  ┌──────────────────────────────┐ ┌──────────────────────────┐   │
│  │                              │ │                          │   │
│  │  ENTERPRISE PARTNERSHIPS     │ │  [Flat illustration:     │   │
│  │                              │ │   connected platforms    │   │
│  │  Embed credit into           │ │   / API integration     │   │
│  │  your platform               │ │   diagram]              │   │
│  │                              │ │                          │   │
│  │  Offer your customers        │ │                          │   │
│  │  financing at the point of   │ │                          │   │
│  │  need. Lynia handles         │ │                          │   │
│  │  underwriting, disbursement, │ │                          │   │
│  │  and collections — you earn  │ │                          │   │
│  │  on every transaction.       │ │                          │   │
│  │                              │ │                          │   │
│  │  [Mobile] [APIs] [Growth]    │ │                          │   │
│  │                              │ │                          │   │
│  │  [Partner with us]           │ │                          │   │
│  │                              │ │                          │   │
│  └──────────────────────────────┘ └──────────────────────────┘   │
│          TEXT LEFT                       VISUAL RIGHT             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Grid: 1fr 1fr (same direction as Section 5)
Features: 3 columns within text column
Padding: 80px vertical (compact)
```

---

### Section 8: Customer Segments

#### Mobile

```
┌──────────────────────────────────────┐
│                                      │
│  Built for how Zimbabwe works        │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  FOR INDIVIDUALS              │    │
│  │                               │    │
│  │  Smartphones, assets, and  │    │
│  │  cash. Apply via WhatsApp in  │    │
│  │  under 5 minutes.             │    │
│  │                               │    │
│  │  Start your application →     │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  FOR DISTRIBUTORS             │    │
│  │                               │    │
│  │  Sell smartphones and assets  │    │
│  │  in your community. Earn      │    │
│  │  commission on every sale.    │    │
│  │                               │    │
│  │  Become a distributor →       │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  FOR PARTNERS                 │    │
│  │                               │    │
│  │  Embed credit into your       │    │
│  │  platform. Offer financing    │    │
│  │  at the point of sale through │    │
│  │  our APIs.                    │    │
│  │                               │    │
│  │  Partner with us →            │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘

Cards: stacked, full width
Padding: 64px vertical
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│              Built for how Zimbabwe works                         │
│                                                                  │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐│
│  │  FOR INDIVIDUALS   │ │  FOR DISTRIBUTORS  │ │  FOR PARTNERS     ││
│  │                    │ │                    │ │                    ││
│  │  Smartphones,      │ │  Sell smartphones  │ │  Embed credit into ││
│  │  assets, and       │ │  and assets in     │ │  your platform.    ││
│  │  cash. Apply via   │ │  your community.   │ │  Offer financing   ││
│  │  WhatsApp in under │ │  Earn commission   │ │  at the point of   ││
│  │  5 minutes.        │ │  on every sale.    │ │  sale through our  ││
│  │                    │ │                    │ │  APIs.             ││
│  │  Start your        │ │  Become a          │ │                    ││
│  │  application →     │ │  distributor →     │ │  Partner with us → ││
│  └────────────────────┘ └────────────────────┘ └────────────────────┘│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Grid: 3 equal columns, 32px gap
Padding: 120px vertical
```

---

### Section 9: Editorial

#### Mobile

```
┌──────────────────────────────────────┐
│                                      │
│  From our Editorial                   │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  ┌────────────────────────┐  │    │
│  │  │  [Illustration]         │  │    │
│  │  └────────────────────────┘  │    │
│  │  CATEGORY                     │    │
│  │  Post Headline                │    │
│  │  Excerpt text...              │    │
│  │  12 Feb 2026                  │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [Card 2]                     │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [Card 3]                     │    │
│  └──────────────────────────────┘    │
│                                      │
│  View all articles →                 │
│                                      │
└──────────────────────────────────────┘

Cards: stacked, full width
Padding: 64px vertical
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  From our Editorial                                               │
│                                                                  │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐│
│  │  ┌──────────────┐  │ │  ┌──────────────┐  │ │  ┌──────────────┐  ││
│  │  │  [Image]     │  │ │  │  [Image]     │  │ │  │  [Image]     │  ││
│  │  └──────────────┘  │ │  └──────────────┘  │ │  └──────────────┘  ││
│  │  CATEGORY          │ │  CATEGORY          │ │  CATEGORY          ││
│  │  Headline          │ │  Headline          │ │  Headline          ││
│  │  Excerpt text...   │ │  Excerpt text...   │ │  Excerpt text...   ││
│  │  12 Feb 2026       │ │  12 Feb 2026       │ │  12 Feb 2026       ││
│  └────────────────────┘ └────────────────────┘ └────────────────────┘│
│                                                                  │
│                        View all articles →                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Grid: 3 equal columns, 32px gap
Padding: 120px vertical
```

---

### Section 10: Bottom CTA

#### Mobile

```
┌──────────────────────────────────────┐
│        (dark gradient bg)             │
│                                      │
│  Apply now. Get funded today.        │
│                                      │
│  No bank account required. No        │
│  paperwork. Approval in under        │
│  5 minutes.                          │
│                                      │
│  ┌──────────────────────────────┐    │
│  │    Start your application     │    │
│  └──────────────────────────────┘    │
│                                      │
│  Talk to our team →                  │
│                                      │
└──────────────────────────────────────┘

Text: centered
CTAs: stacked
Padding: 64px vertical
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│                        (dark gradient bg)                         │
│                                                                  │
│                 Apply now. Get funded today.                      │
│                                                                  │
│       No bank account required. No paperwork.                    │
│       Approval in under 5 minutes.                               │
│                                                                  │
│         [Start your application]   Talk to our team →            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Text: centered
CTAs: inline row, centered
Padding: 120px vertical
```

---

### Section 11: Footer

#### Mobile

```
┌──────────────────────────────────────┐
│          (navy bg #0A2540)            │
│                                      │
│  [Logo - white]                      │
│                                      │
│  Products                            │
│  ────────                            │
│  Asset financing                     │
│  Digital credit                      │
│  Enterprise partnerships             │
│                                      │
│  Company                             │
│  ───────                             │
│  About                               │
│  Careers                             │
│  Contact                             │
│                                      │
│  Connect                             │
│  ───────                             │
│  X (Twitter)                         │
│  LinkedIn                            │
│  WhatsApp                            │
│                                      │
│  Legal                               │
│  ─────                               │
│  Privacy Policy                      │
│  Terms                               │
│                                      │
│  ────────────────────                │
│                                      │
│  © 2026 Lynia Finance.              │
│  All rights reserved.               │
│  Regulated by the Reserve           │
│  Bank of Zimbabwe.                  │
│                                      │
└──────────────────────────────────────┘

Layout: single column, stacked groups
```

#### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│                         (navy bg #0A2540)                         │
│                                                                  │
│  [Logo - white variant]                                          │
│                                                                  │
│  Products             Company       Connect       Legal          │
│  ────────             ───────       ───────       ─────          │
│  Asset financing      About         X (Twitter)   Privacy Policy │
│  Digital credit       Careers       LinkedIn      Terms          │
│  Enterprise           Contact       WhatsApp                     │
│   partnerships                                                   │
│                                                                  │
│  ────────────────────────────────────────────────                │
│                                                                  │
│  © 2026 Lynia Finance. All rights reserved.                      │
│  Regulated by the Reserve Bank of Zimbabwe.                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Grid: 4 columns
Product names match labels used across the site
Company column includes "About" (renamed from "Mission")
```

---

## Editorial Page

### Mobile

```
┌──────────────────────────────────────┐
│  [Nav]                                │
├──────────────────────────────────────┤
│                                      │
│  EDITORIAL                            │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  ┌────────────────────────┐  │    │
│  │  │  [Featured image]      │  │    │
│  │  └────────────────────────┘  │    │
│  │  CATEGORY                     │    │
│  │  Featured Headline            │    │   H2
│  │  Excerpt text...              │    │
│  │  12 Feb 2026                  │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ All │ Products │ Eng │ Company  ││   Horizontal scroll
│  └──────────────────────────────────┘│
│                                      │
│  ┌──────────────────────────────┐    │
│  │  [Post card 1]                │    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │  [Post card 2]                │    │
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │  [Post card 3]                │    │
│  └──────────────────────────────┘    │
│                                      │
│  [Load more]                         │
│                                      │
├──────────────────────────────────────┤
│  [Footer]                            │
└──────────────────────────────────────┘

Post cards: stacked, full width
Category pills: horizontally scrollable
```

### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│  [Nav]                                                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  EDITORIAL                                                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐      │
│  │  ┌──────────────────────────────────────────────────┐  │      │
│  │  │  [Featured post large image]                      │  │      │
│  │  └──────────────────────────────────────────────────┘  │      │
│  │  CATEGORY                                              │      │
│  │  Featured Headline Here in Large Text                  │      │   H1
│  │  Excerpt text describing the article...                │      │
│  │  12 Feb 2026                                           │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                  │
│  [All] [Products] [Engineering] [Company] [Market]               │
│                                                                  │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────┐│
│  │  [Post card]       │ │  [Post card]       │ │  [Post card]   ││
│  └────────────────────┘ └────────────────────┘ └────────────────┘│
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────┐│
│  │  [Post card]       │ │  [Post card]       │ │  [Post card]   ││
│  └────────────────────┘ └────────────────────┘ └────────────────┘│
│                                                                  │
│  [Load more]                                                     │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  [Footer]                                                        │
└──────────────────────────────────────────────────────────────────┘

Post grid: 3 columns
Category pills: flex row, centered
```

---

## Contact Page

### Mobile

```
┌──────────────────────────────────────┐
│  [Nav]                                │
├──────────────────────────────────────┤
│                                      │
│  Get in touch                        │
│                                      │
│  Have a question or want to          │
│  learn more? We'd love to hear       │
│  from you.                           │
│                                      │
│  ──────────────                      │
│                                      │
│  OTHER WAYS TO REACH US              │
│                                      │
│  [WhatsApp icon] WhatsApp            │
│  Chat with us directly               │
│                                      │
│  [Mail icon] Email                   │
│  hello@lyniafinance.com              │
│                                      │
│  [Map icon] Location                 │
│  Harare, Zimbabwe                    │
│                                      │
│  ──────────────                      │
│                                      │
│  CONTACT FORM                        │
│                                      │
│  Name *                              │
│  ┌──────────────────────────────┐    │
│  └──────────────────────────────┘    │
│  Phone number *                      │
│  ┌──────────────────────────────┐    │
│  └──────────────────────────────┘    │
│  Email                               │
│  ┌──────────────────────────────┐    │
│  └──────────────────────────────┘    │
│  Message                             │
│  ┌──────────────────────────────┐    │
│  │                               │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │        Send message           │    │
│  └──────────────────────────────┘    │
│                                      │
│  ══════════════════════════════      │
│                                      │
│  WANT TO PARTNER WITH US?            │
│                                      │
│  Name *                              │
│  ┌──────────────────────────────┐    │
│  └──────────────────────────────┘    │
│  Phone number *                      │
│  ┌──────────────────────────────┐    │
│  └──────────────────────────────┘    │
│  Email *                             │
│  ┌──────────────────────────────┐    │
│  └──────────────────────────────┘    │
│  Type of partnership *               │
│  ┌──────────────────────────────┐    │
│  │ Distributor               ▼   │    │
│  └──────────────────────────────┘    │
│  Message                             │
│  ┌──────────────────────────────┐    │
│  │                               │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  Submit partnership app       │    │
│  └──────────────────────────────┘    │
│                                      │
├──────────────────────────────────────┤
│  [Footer]                            │
└──────────────────────────────────────┘

Layout: single column, stacked
Info section first, then contact form, then partnership form
```

### Desktop

```
┌──────────────────────────────────────────────────────────────────┐
│  [Nav]                                                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────┬────────────────────────────┐     │
│  │                            │                            │     │
│  │  Get in touch              │  CONTACT FORM              │     │
│  │                            │                            │     │
│  │  Have a question or        │  Name *                    │     │
│  │  want to learn more?       │  ┌──────────────────────┐  │     │
│  │  We'd love to hear         │  └──────────────────────┘  │     │
│  │  from you.                 │  Phone number *            │     │
│  │                            │  ┌──────────────────────┐  │     │
│  │  ─────────────             │  └──────────────────────┘  │     │
│  │                            │  Email                     │     │
│  │  OTHER WAYS TO REACH US    │  ┌──────────────────────┐  │     │
│  │                            │  └──────────────────────┘  │     │
│  │  [WA] WhatsApp             │  Message                   │     │
│  │  Chat with us directly     │  ┌──────────────────────┐  │     │
│  │                            │  │                      │  │     │
│  │  [Mail] Email              │  └──────────────────────┘  │     │
│  │  hello@lyniafinance.com    │                            │     │
│  │                            │  [Send message]            │     │
│  │  [Pin] Location            │                            │     │
│  │  Harare, Zimbabwe          │                            │     │
│  │                            │                            │     │
│  └────────────────────────────┴────────────────────────────┘     │
│                                                                  │
│  ════════════════════════════════════                             │
│                                                                  │
│  WANT TO PARTNER WITH US?                                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐        │
│  │  Name *   Phone *   Email *   Type *                  │        │
│  │  [input]  [input]   [input]   [select]                │        │
│  │  Message                                              │        │
│  │  [textarea                                    ]       │        │
│  │                                                       │        │
│  │  [Submit partnership application]                     │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  [Footer]                                                        │
└──────────────────────────────────────────────────────────────────┘

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
- Serves as universal WhatsApp access — secondary CTAs on page freed for other actions
