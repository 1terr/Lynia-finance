# Page Wireframes & Suggested Content

> Wireframes for all pages beyond the homepage.
> Content follows the same voice: declarative, short, outcome-focused, Zimbabwe-context.
> Based on existing homepage copy — no new brand language introduced.

---

## Table of Contents

1. [/contact — Contact Page](#1-contact)
2. [/about — About Page](#2-about)
3. [/privacy — Privacy Policy](#3-privacy)
4. [/terms — Terms of Service](#4-terms)
5. [/editorial — Blog Listing](#5-editorial)
6. [/editorial/[slug] — Blog Post](#6-editorial-post)
7. [/products — Products Overview](#7-products)
8. [/partnerships — Partnerships Page](#8-partnerships)
9. [/careers — Careers Page](#9-careers)

---

## 1. /contact {#1-contact}

**Priority**: P1 — 5 CTAs across the site link here.
**Layout**: Split (Stripe-style). Info left, form right.
**Background**: White, with light gray (#F6F9FC) partnership section below.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Navbar — same as homepage]                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │                      │  │                                  │ │
│  │  CONTACT             │  │  ┌────────────────────────────┐  │ │
│  │                      │  │  │ Name *                     │  │ │
│  │  Get in touch        │  │  └────────────────────────────┘  │ │
│  │                      │  │  ┌────────────────────────────┐  │ │
│  │  Have a question or  │  │  │ Phone number *             │  │ │
│  │  want to learn more? │  │  │ +263                       │  │ │
│  │  We'd love to hear   │  │  └────────────────────────────┘  │ │
│  │  from you.           │  │  ┌────────────────────────────┐  │ │
│  │                      │  │  │ Email (optional)           │  │ │
│  │  ─────────────────   │  │  └────────────────────────────┘  │ │
│  │                      │  │  ┌────────────────────────────┐  │ │
│  │  📱 WhatsApp         │  │  │                            │  │ │
│  │  Chat with us        │  │  │ Your message               │  │ │
│  │  directly            │  │  │                            │  │ │
│  │                      │  │  │                            │  │ │
│  │  ✉️  Email            │  │  └────────────────────────────┘  │ │
│  │  hello@lynia         │  │                                  │ │
│  │  finance.com         │  │  ┌────────────────────────────┐  │ │
│  │                      │  │  │    Send message             │  │ │
│  │  📍 Location         │  │  └────────────────────────────┘  │ │
│  │  Harare, Zimbabwe    │  │                                  │ │
│  │                      │  │                                  │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────── ─ ─ ─────────────────────────────┤
│  bg: #F6F9FC                                                    │
│                                                                 │
│  PARTNERSHIPS                                                   │
│                                                                 │
│  Want to partner with us?                                       │
│  Become a distributor or integrate our APIs                     │
│  into your platform.                                            │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Name *       │ │ Phone *      │ │ Email *                  │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
│  ┌──────────────────────┐ ┌────────────────────────────────────┐│
│  │ Type of partnership ▼│ │                                    ││
│  │ - Distributor        │ │ Tell us about your business        ││
│  │ - B2B Partnership    │ │                                    ││
│  │ - Other              │ └────────────────────────────────────┘│
│  └──────────────────────┘                                       │
│                                                                 │
│  ┌──────────────────────────────┐                               │
│  │  Submit partnership inquiry   │                               │
│  └──────────────────────────────┘                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Footer — same as homepage]                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Suggested Content

**Page title**: "Get in touch"

**Left column**:
```
CONTACT

Get in touch

Have a question or want to learn more?
We'd love to hear from you.

───

WhatsApp
Chat with us directly
[link: https://wa.me/263...]

Email
hello@lyniafinance.com

Location
Harare, Zimbabwe
```

**Partnership section**:
```
PARTNERSHIPS

Want to partner with us?

Become a distributor or integrate our APIs into your platform.
```

**Form fields**:
- Contact form: Name*, Phone (+263)*, Email, Message
- Partnership form: Name*, Phone*, Email*, Type (dropdown), Details

**Mobile layout**: Single column. Contact info stacks above form. Partnership section below.

---

## 2. /about {#2-about}

**Priority**: P2 — Nav + footer link.
**Layout**: Narrow-width text sections with stats strip.
**Background**: Alternating white / light gray.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Navbar]                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ABOUT LYNIA FINANCE                                            │
│                                                                 │
│  Financial tools for the                                        │
│  underbanked                                                    │
│                                                                 │
│  We build alternative financial infrastructure                  │
│  for the 80% of Zimbabwe's workforce that                       │
│  traditional banks don't serve.                                 │
│                                                                 │
├─────────────────── bg: #F6F9FC ─────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   80%    │  │   <5%    │  │   $14B   │  │   70%+   │       │
│  │workforce │  │bank      │  │ unserved │  │ mobile   │       │
│  │informal  │  │credit    │  │ demand   │  │ money    │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
├─────────────────── bg: white ───────────────────────────────────┤
│                                                                 │
│  THE PROBLEM                                                    │
│                                                                 │
│  Zimbabwe's credit gap                                          │
│                                                                 │
│  [2-3 short paragraphs]                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  OUR APPROACH                                                   │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  WhatsApp-first  │  │  Mobile money     │                    │
│  │  delivery        │  │  native           │                    │
│  └──────────────────┘  └──────────────────┘                    │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Local agent     │  │  Under 5 min     │                    │
│  │  network         │  │  approval        │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                 │
├─────────────────── bg: #F6F9FC ─────────────────────────────────┤
│                                                                 │
│  REGULATED                                                      │
│                                                                 │
│  Regulated by the Reserve Bank of Zimbabwe.                     │
│  Your data and transactions are protected                       │
│  by bank-grade security.                                        │
│                                                                 │
├─────────────────── bg: navy gradient ───────────────────────────┤
│                                                                 │
│  Apply now. Get funded today.                                   │
│  No bank account required. No paperwork.                        │
│                                                                 │
│  [ Start your application ]  Talk to our team →                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Footer]                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Suggested Content

**Hero**:
```
ABOUT LYNIA FINANCE

Financial tools for the underbanked

We build alternative financial infrastructure for the 80% of
Zimbabwe's workforce that traditional banks don't serve.
```

**The Problem section**:
```
THE PROBLEM

Zimbabwe's credit gap

80% of Zimbabwe's workforce is informal. Traders, farmers,
small business owners — they keep the economy moving. But
less than 5% have access to bank credit.

Traditional banks require payslips, collateral, and months
of paperwork. Mobile money is everywhere. Financial products
should be too.
```

**Our Approach** (reuse existing homepage concepts):
```
OUR APPROACH

WhatsApp-first delivery
Apply, get approved, and manage repayments through the app
you already use. No downloads required.

Mobile money native
Receive funds and repay through EcoCash, OneMoney, or
Innbucks. No bank account needed.

Local agent network
Collect devices and assets from a Lynia agent in your area.

Under 5 minute approval
Apply once. Get a decision in minutes, not weeks.
```

**Regulated section**:
```
REGULATED

Licensed and regulated by the Reserve Bank of Zimbabwe.
Your data and transactions are protected by bank-grade security.
```

**Bottom CTA**: Reuse the existing BottomCTA component from homepage.

---

## 3. /privacy {#3-privacy}

**Priority**: P2 — Footer link, RBZ compliance requirement.
**Layout**: Narrow container, long-form text. Table of contents sidebar on desktop.
**Background**: White.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Navbar]                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌────────────────────────────────────────┐   │
│  │             │  │                                        │   │
│  │ Contents    │  │  Privacy Policy                        │   │
│  │             │  │                                        │   │
│  │ 1. Overview │  │  Last updated: February 2026           │   │
│  │ 2. Data we  │  │                                        │   │
│  │    collect  │  │  ──────────────────────────────────     │   │
│  │ 3. How we   │  │                                        │   │
│  │    use it   │  │  1. Overview                           │   │
│  │ 4. Data     │  │                                        │   │
│  │    sharing  │  │  Lynia Finance ("we", "us") is         │   │
│  │ 5. Security │  │  committed to protecting the privacy   │   │
│  │ 6. Your     │  │  of our customers. This policy         │   │
│  │    rights   │  │  explains how we collect, use, and     │   │
│  │ 7. Contact  │  │  protect your personal information.    │   │
│  │             │  │                                        │   │
│  │             │  │  We are regulated by the Reserve Bank  │   │
│  │             │  │  of Zimbabwe and comply with all       │   │
│  │             │  │  applicable data protection laws.      │   │
│  │             │  │                                        │   │
│  │             │  │  2. Data we collect                    │   │
│  │             │  │                                        │   │
│  │             │  │  ...                                   │   │
│  │             │  │                                        │   │
│  └─────────────┘  └────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Footer]                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Suggested Content — Section Headings

```
Privacy Policy
Last updated: February 2026

1. Overview
2. Data we collect
   - Information you provide (name, phone number, national ID)
   - Information from your device
   - Transaction and repayment data
3. How we use your data
   - Process your loan application
   - Verify your identity (KYC)
   - Assess creditworthiness
   - Send payment reminders via WhatsApp
   - Improve our services
4. Who we share data with
   - Identity verification partners (for KYC only)
   - Mobile money providers (to process payments)
   - Regulatory bodies (when required by law)
   - We never sell your data
5. How we protect your data
   - Encryption in transit and at rest
   - Access controls and audit logging
   - Regular security assessments
6. Your rights
   - Access your data
   - Request correction of inaccurate data
   - Request deletion of your data
   - Withdraw consent
7. How long we keep your data
   - Transaction records: 7 years (RBZ requirement)
   - KYC documents: 10 years (RBZ requirement)
   - Marketing data: until you opt out
8. Contact us
   - Email: privacy@lyniafinance.com
   - WhatsApp: [number]
```

**Mobile layout**: Table of contents collapses to a dropdown or sits above the content.

---

## 4. /terms {#4-terms}

**Priority**: P2 — Footer link, regulatory requirement.
**Layout**: Same as Privacy Policy (narrow container, TOC sidebar).
**Background**: White.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Navbar]                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌────────────────────────────────────────┐   │
│  │             │  │                                        │   │
│  │ Contents    │  │  Terms of Service                      │   │
│  │             │  │                                        │   │
│  │ 1. About    │  │  Last updated: February 2026           │   │
│  │ 2. Eligib.  │  │                                        │   │
│  │ 3. Products │  │  These terms govern your use of        │   │
│  │ 4. Fees     │  │  Lynia Finance services. By applying   │   │
│  │ 5. Repay.   │  │  for or using our products, you        │   │
│  │ 6. Default  │  │  agree to these terms.                 │   │
│  │ 7. Device   │  │                                        │   │
│  │    lock     │  │  ─────────────────────────             │   │
│  │ 8. Privacy  │  │                                        │   │
│  │ 9. Disputes │  │  1. About these terms                  │   │
│  │ 10. Changes │  │                                        │   │
│  │             │  │  ...                                   │   │
│  │             │  │                                        │   │
│  └─────────────┘  └────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Footer]                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Suggested Content — Section Headings

```
Terms of Service
Last updated: February 2026

1. About these terms
   - Who we are (Lynia Finance, Harare, Zimbabwe)
   - What these terms cover
   - How to contact us

2. Eligibility
   - Must be 18 years or older
   - Must have a valid Zimbabwean national ID
   - Must have an active mobile money account

3. Our products
   - Asset Financing: financing for smartphones and assets
   - Digital Credit: short-term loans to mobile wallets
   - Enterprise Partnerships: API-based credit products

4. Fees and charges
   - All fees disclosed before you accept
   - No hidden charges
   - Late payment fees (clearly stated)

5. Repayment
   - Repayment schedule agreed at time of application
   - Payments via mobile money (EcoCash, OneMoney, Innbucks)
   - Early repayment accepted with no penalty

6. What happens if you don't repay
   - Reminders via WhatsApp
   - Late fees applied
   - Device lock for asset financing (explained clearly)
   - Impact on future credit eligibility

7. Device lock (Asset Financing)
   - Devices may be remotely locked if payments are missed
   - Device unlocked within 24 hours of payment
   - Emergency calls always available even when locked

8. Your data and privacy
   - See our Privacy Policy at /privacy
   - We only use your data as described

9. Disputes and complaints
   - Contact us first: hello@lyniafinance.com
   - Escalation to Reserve Bank of Zimbabwe if unresolved

10. Changes to these terms
    - We may update these terms
    - You will be notified via WhatsApp
    - Continued use means you accept updates
```

---

## 5. /editorial {#5-editorial}

**Priority**: P2 — Navbar link, homepage section links here.
**Layout**: Featured post hero + category pills + 3-column card grid.
**Background**: White with light gray cards.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Navbar]                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FROM OUR EDITORIAL                                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │   FEATURED                                              │   │
│  │                                                         │   │
│  │   ┌──────────────────────┐  ┌────────────────────────┐  │   │
│  │   │                      │  │                        │  │   │
│  │   │                      │  │  Company               │  │   │
│  │   │   [Featured image]   │  │                        │  │   │
│  │   │                      │  │  Why we built           │  │   │
│  │   │                      │  │  Lynia Finance          │  │   │
│  │   │                      │  │                        │  │   │
│  │   │                      │  │  The story behind our   │  │   │
│  │   │                      │  │  mission to serve       │  │   │
│  │   │                      │  │  Zimbabwe's underbanked │  │   │
│  │   │                      │  │  majority.              │  │   │
│  │   │                      │  │                        │  │   │
│  │   │                      │  │  Read article →         │  │   │
│  │   └──────────────────────┘  └────────────────────────┘  │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────┐ ┌──────────┐ ┌─────────────┐ ┌─────────┐ ┌────────┐  │
│  │ All │ │ Products │ │ Engineering │ │ Company │ │ Market │  │
│  └─────┘ └──────────┘ └─────────────┘ └─────────┘ └────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │              │  │              │  │              │         │
│  │ [Image]      │  │ [Image]      │  │ [Image]      │         │
│  │              │  │              │  │              │         │
│  │ Market       │  │ Products     │  │ Engineering  │         │
│  │              │  │              │  │              │         │
│  │ Zimbabwe's   │  │ How asset    │  │ Building     │         │
│  │ $14B credit  │  │ financing    │  │ credit       │         │
│  │ gap          │  │ works        │  │ scoring for  │         │
│  │              │  │              │  │ the informal │         │
│  │ 8 Feb 2026   │  │ 5 Feb 2026   │  │ economy      │         │
│  │              │  │              │  │              │         │
│  │              │  │              │  │ 1 Feb 2026   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ [Card 4]     │  │ [Card 5]     │  │ [Card 6]     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
│              [ Load more articles ]                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Footer]                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Suggested Content — Initial Blog Posts

Already have 3 placeholder posts from homepage. Add 3 more for a full grid:

```
Post 4:
  Category: Engineering
  Title: "Building credit scoring for the informal economy"
  Excerpt: "No payslips. No bank statements. How we assess
            creditworthiness using mobile money data."
  Date: 1 Feb 2026

Post 5:
  Category: Company
  Title: "Our distributor network"
  Excerpt: "How local agents across Zimbabwe are helping
            communities access financing."
  Date: 28 Jan 2026

Post 6:
  Category: Products
  Title: "Mobile money repayments explained"
  Excerpt: "A simple guide to repaying your loan through
            EcoCash, OneMoney, or Innbucks."
  Date: 25 Jan 2026
```

**Category filter pills**: All (default) | Products | Engineering | Company | Market
**Cards**: Same design as homepage editorial cards (image, category tag, title, excerpt, date)
**Mobile**: 1 column. Featured post image stacks above text.

---

## 6. /editorial/[slug] {#6-editorial-post}

**Priority**: P2 — Needed for editorial listing to link anywhere.
**Layout**: Narrow article container (max 780px), centered.
**Background**: White.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Navbar]                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ← Back to Editorial                                            │
│                                                                 │
│  ┌─────────────────────────────────────────┐                   │
│  │  Company                                │                   │
│  │                                         │                   │
│  │  Why we built Lynia Finance             │                   │
│  │                                         │                   │
│  │  10 Feb 2026  ·  5 min read             │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │               [Featured image — full width]             │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌───────────────── max-w: 780px ──────────────────────────┐   │
│  │                                                         │   │
│  │  [Rich text body — headings, paragraphs, lists,        │   │
│  │   blockquotes, images. Rendered from Sanity             │   │
│  │   Portable Text.]                                       │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────                  │
│                                                                 │
│  ┌──────────────────────────────┐                              │
│  │  Written by                  │                              │
│  │  [Avatar]  Author Name      │                              │
│  │            Role at Lynia     │                              │
│  └──────────────────────────────┘                              │
│                                                                 │
│  ─────────────────────────────────────────────                  │
│                                                                 │
│  RELATED ARTICLES                                               │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ [Card]       │  │ [Card]       │  │ [Card]       │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Footer]                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Content Notes

- **Back link**: "← Back to Editorial" links to `/editorial`
- **Category tag**: Same pill style as listing page
- **Read time**: Calculated from word count (~200 words/min)
- **Author bio**: Name + role. Placeholder until real team bios exist.
- **Related articles**: 3 posts from the same category (or most recent)
- **Mobile**: Full width. Image spans edge to edge.

---

## 7. /products {#7-products}

**Priority**: P3 — Product card "Learn more" links.
**Layout**: Full-page product showcase. Reuses existing deep-dive sections from homepage with expanded content.
**Background**: Alternating white / light gray / navy.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Navbar]                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  OUR PRODUCTS                                                   │
│                                                                 │
│  Three products. One mission.                                   │
│                                                                 │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐│
│  │ Asset Financing  │ │ Digital Credit   │ │ Enterprise       ││
│  │ [Jump link ↓]    │ │ [Jump link ↓]    │ │ [Jump link ↓]    ││
│  └──────────────────┘ └──────────────────┘ └──────────────────┘│
│                                                                 │
├──────────────── #asset-financing ────────────────────────────────┤
│                                                                 │
│  ASSET FINANCING                                                │
│                                                                 │
│  Own the tools that power your trade                            │
│                                                                 │
│  Finance smartphones and assets with a small deposit.           │
│  Collect from a local agent, repay via mobile money.            │
│                                                                 │
│  How it works                                                   │
│                                                                 │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐              │
│  │  01    │  │  02    │  │  03    │  │  04    │              │
│  │ Apply  │  │ Get    │  │ Collect│  │ Repay  │              │
│  │ via    │→ │ appro- │→ │ from a │→ │ via    │              │
│  │ What-  │  │ ved in │  │ local  │  │ mobile │              │
│  │ sApp   │  │ <5 min │  │ agent  │  │ money  │              │
│  └────────┘  └────────┘  └────────┘  └────────┘              │
│                                                                 │
│  Features                                                       │
│  [Reuse existing 4-feature grid from homepage]                  │
│                                                                 │
│  [ Start your application ]                                     │
│                                                                 │
├──────────────── #digital-credit ── bg: #0A2540 ─────────────────┤
│                                                                 │
│  DIGITAL CREDIT                                                 │
│                                                                 │
│  Cash when you need it most                                     │
│                                                                 │
│  Digital loans deposited directly into your mobile wallet.      │
│  Apply once, get funded in under 10 minutes.                    │
│                                                                 │
│  How it works                                                   │
│                                                                 │
│  ┌────────┐  ┌────────┐  ┌────────┐                           │
│  │  01    │  │  02    │  │  03    │                           │
│  │ Apply  │→ │ Get    │→ │ Cash   │                           │
│  │ on     │  │ scored │  │ in     │                           │
│  │ What-  │  │ in     │  │ your   │                           │
│  │ sApp   │  │ seconds│  │ wallet │                           │
│  └────────┘  └────────┘  └────────┘                           │
│                                                                 │
│  Features                                                       │
│  [Reuse existing 2-feature grid from homepage]                  │
│                                                                 │
│  COMING SOON                                                    │
│  [Lead capture form: phone + "Get notified when we launch →"]   │
│                                                                 │
├──────────────── #enterprise ── bg: white ────────────────────────┤
│                                                                 │
│  ENTERPRISE PARTNERSHIPS                                        │
│                                                                 │
│  Embed credit into your platform                                │
│                                                                 │
│  Offer your customers financing at the point of need.           │
│  Lynia handles underwriting, disbursement, and                  │
│  collections — you earn on every transaction.                   │
│                                                                 │
│  How it works                                                   │
│                                                                 │
│  ┌────────┐  ┌────────┐  ┌────────┐                           │
│  │  01    │  │  02    │  │  03    │                           │
│  │ Inte-  │→ │ Your   │→ │ Lynia  │                           │
│  │ grate  │  │ users  │  │handles │                           │
│  │ our    │  │ apply  │  │ the    │                           │
│  │ APIs   │  │ at POS │  │ rest   │                           │
│  └────────┘  └────────┘  └────────┘                           │
│                                                                 │
│  Features                                                       │
│  [Reuse existing 3-feature grid from homepage]                  │
│                                                                 │
│  [ Partner with us ]                                            │
│                                                                 │
├──────────────── bg: navy gradient ──────────────────────────────┤
│  [Bottom CTA — reuse homepage component]                        │
├─────────────────────────────────────────────────────────────────┤
│  [Footer]                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Suggested "How it works" Content

**Asset Financing**:
```
01  Apply via WhatsApp
    Send us a message. Tell us what you need.

02  Get approved in under 5 minutes
    We check your eligibility instantly.

03  Collect from a local agent
    Pick up your device from a Lynia agent near you.

04  Repay via mobile money
    Pay back through EcoCash, OneMoney, or Innbucks.
```

**Digital Credit**:
```
01  Apply on WhatsApp
    Tell us how much you need. One message.

02  Get scored in seconds
    We assess your eligibility using mobile money data.

03  Cash in your wallet
    Funds deposited directly into your mobile wallet.
```

**Enterprise**:
```
01  Integrate our APIs
    A few API calls to embed credit into your platform.

02  Your users apply at point of sale
    Customers access financing without leaving your app.

03  Lynia handles the rest
    Underwriting, disbursement, collections, and risk.
    You earn on every transaction.
```

---

## 8. /partnerships {#8-partnerships}

**Priority**: P3 — Navbar link.
**Layout**: Hero + two program sections + CTA form.
**Background**: Alternating white / light gray.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Navbar]                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PARTNERSHIPS                                                   │
│                                                                 │
│  Grow with Lynia Finance                                        │
│                                                                 │
│  Sell devices in your community or embed credit                 │
│  into your platform. We handle the financing.                   │
│                                                                 │
├──────────────── bg: #F6F9FC ────────────────────────────────────┤
│                                                                 │
│  FOR DISTRIBUTORS                                               │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │                      │  │                              │    │
│  │  Sell smartphones    │  │  What you get                │    │
│  │  and assets in your  │  │                              │    │
│  │  community. Earn     │  │  · Commission on every sale  │    │
│  │  commission on       │  │  · Training and onboarding   │    │
│  │  every sale.         │  │  · Marketing materials       │    │
│  │                      │  │  · Dedicated support         │    │
│  │  Who it's for        │  │                              │    │
│  │  · Phone shops       │  │  Requirements                │    │
│  │  · General dealers   │  │                              │    │
│  │  · Community leaders │  │  · Registered business or    │    │
│  │  · Anyone with a     │  │    physical location         │    │
│  │    customer base     │  │  · Active mobile money       │    │
│  │                      │  │    account                   │    │
│  │                      │  │  · Ability to serve          │    │
│  │                      │  │    customers in your area    │    │
│  │                      │  │                              │    │
│  └──────────────────────┘  └──────────────────────────────┘    │
│                                                                 │
│  [ Become a distributor → ]                                     │
│                                                                 │
├──────────────── bg: white ──────────────────────────────────────┤
│                                                                 │
│  FOR BUSINESSES & PLATFORMS                                     │
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │                      │  │                              │    │
│  │  Embed credit into   │  │  Integration options         │    │
│  │  your platform.      │  │                              │    │
│  │  Offer your          │  │  · Developer-ready APIs      │    │
│  │  customers           │  │  · Real-time monitoring      │    │
│  │  financing at the    │  │  · Sandbox environment       │    │
│  │  point of need.      │  │  · Dedicated integration     │    │
│  │                      │  │    support                   │    │
│  │  Lynia handles       │  │                              │    │
│  │  underwriting,       │  │  Revenue model               │    │
│  │  disbursement, and   │  │                              │    │
│  │  collections — you   │  │  · Earn on every funded      │    │
│  │  earn on every       │  │    transaction               │    │
│  │  transaction.        │  │  · No upfront costs          │    │
│  │                      │  │  · Performance dashboard     │    │
│  │                      │  │                              │    │
│  └──────────────────────┘  └──────────────────────────────┘    │
│                                                                 │
│  [ Partner with us → ]                                          │
│                                                                 │
├──────────────── bg: navy gradient ──────────────────────────────┤
│                                                                 │
│  Ready to partner?                                              │
│                                                                 │
│  Get in touch and we'll walk you through                        │
│  the process.                                                   │
│                                                                 │
│  [ Talk to our team → ]                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Footer]                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Content Notes

All copy above is derived from existing homepage content:
- Distributor description from Customer Segments card
- Enterprise description from Enterprise section
- Feature lists from Enterprise features
- CTAs reuse existing button labels

---

## 9. /careers {#9-careers}

**Priority**: P3 — Footer link.
**Layout**: Simple hero + values + placeholder positions section.
**Background**: White with light gray sections.

```
┌─────────────────────────────────────────────────────────────────┐
│  [Navbar]                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CAREERS                                                        │
│                                                                 │
│  Build financial tools for                                      │
│  the underbanked                                                │
│                                                                 │
│  We're building alternative financial infrastructure            │
│  for the 80% of Zimbabwe's workforce that                       │
│  traditional banks don't serve.                                 │
│                                                                 │
├──────────────── bg: #F6F9FC ────────────────────────────────────┤
│                                                                 │
│  WHY LYNIA                                                      │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Mission-driven  │  │  Early stage     │                    │
│  │                  │  │                  │                    │
│  │  Every feature   │  │  Shape the       │                    │
│  │  we ship helps   │  │  product and     │                    │
│  │  real people     │  │  the company     │                    │
│  │  access credit   │  │  from day one.   │                    │
│  │  for the first   │  │                  │                    │
│  │  time.           │  │                  │                    │
│  └──────────────────┘  └──────────────────┘                    │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Zimbabwe-first  │  │  Remote-friendly │                    │
│  │                  │  │                  │                    │
│  │  We build for    │  │  Work from       │                    │
│  │  and in          │  │  anywhere.       │                    │
│  │  Zimbabwe.       │  │  Ship what       │                    │
│  │  Local context   │  │  matters.        │                    │
│  │  matters.        │  │                  │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                 │
├──────────────── bg: white ──────────────────────────────────────┤
│                                                                 │
│  OPEN POSITIONS                                                 │
│                                                                 │
│  We don't have open positions right now,                        │
│  but we're always interested in hearing from                    │
│  talented people.                                               │
│                                                                 │
│  Send us a message at careers@lyniafinance.com                  │
│  or reach out on WhatsApp.                                      │
│                                                                 │
│  [ Get in touch → ]                                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Footer]                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Content Notes

- Hero headline reuses brand line from homepage: "Financial tools for the underbanked"
- Values section uses 4 cards — same grid pattern as other pages
- Open positions: placeholder for now. Can later become dynamic with a job board
- CTA links to `/contact`
- Deliberately minimal — no invented team info or fake job listings

---

## Cross-Page Navigation Rules

When these pages are built, navigation anchors need updating:

| Current Link | From Non-Homepage | Should Become |
|-------------|-------------------|---------------|
| `#products` | Broken | `/#products` |
| `#asset-financing` | Broken | `/products#asset-financing` |
| `#digital-credit` | Broken | `/products#digital-credit` |
| `#enterprise` | Broken | `/products#enterprise` |
| `#apply` | Broken | `/#apply` |

The navbar and footer should use absolute paths (`/` prefix) for all homepage anchors so they work from any page.

---

## Shared Components Across All Pages

These components render on every page via `app/layout.tsx`:

1. **Navbar** — Already built. Works globally.
2. **Footer** — Already built. Works globally.
3. **WhatsApp FAB** — Already built. Works globally.

### Reusable section components for new pages:

| Component | Can Be Reused On |
|-----------|-----------------|
| `BottomCTA` | /about, /products, /partnerships |
| `SocialProof` (stats bar) | /about |
| `ProductSuite` (3 cards) | /products (as jump-link nav) |
| `CustomerSegments` | — (homepage only) |
| `Editorial` (3-card grid) | /editorial (with real data) |

---

## Content Principles (Recap)

1. **Reuse existing copy** — don't invent new brand language
2. **Same voice** — declarative, short sentences, outcome-focused
3. **Same stats** — 80% informal, <5% credit access, $14B gap, 70%+ mobile money
4. **Same CTAs** — "Start your application", "Partner with us", "Talk to our team →"
5. **Same product names** — Asset Financing, Digital Credit, Enterprise Partnerships
6. **Zimbabwe context** — always ground content in the local market
7. **Minimal** — no bloat. If it doesn't serve a user journey, don't add it.
