# Landing Page Content - lyniafinance.com

> Extracted from wireframe mockups. This is the source of truth for all page copy.

---

## Navigation

```
Lynia Finance (logo)    Products    Mission    Partnerships    Research
```

- Nav is clean text links only - no buttons
- Contact, Careers, and other links live in the footer

---

## Hero Section

**Headline**:
> Credit that works for real people

**Subtext**:
> Lynia Finance helps you get the smartphone, tools, or cash you need—giving you the power to earn more and do more.

**CTAs**:
- Primary: `[Apply now]`
- Secondary: `Lets chat on whatsapp`

---

## Product 1: Asset Financing

**Label**: ASSET FINANCING

**Headline**:
> Own the tools that power your trade

**Subtext**:
> Get smartphones, tools of your trade through flexible financing. These assets are productive tools that help you earn more, while our system ensures fair repayment terms

**Features** (4 columns):

| Feature | Description |
|---------|-------------|
| **Ownership** | Own asset after paying a deposit |
| **Collection** | Collect asset at your nearest agent |
| **Application** | Get approved in less than 5 minutes |
| **Repayment** | Repay using mobile money |

**CTAs**:
- Primary: `[Apply now]`
- Secondary: `Lets chat on whatsapp`

---

## Product 2: Digital Credit

**Label**: DIGITAL CREDIT

**Headline**:
> Cash when you need it most

**Subtext**:
> Quick, secure digital loans delivered straight to your mobile wallet. Designed to cover everyday needs or business growth, with repayment made simple via EcoCash or Omari

**Features** (2 columns):

| Feature | Description |
|---------|-------------|
| **Instant approval** | Apply, get approved and receive your funds in less than 10 minutes. |
| **Mobile money friendly** | Your money is deposited directly into your mobile money wallet. You also repay using mobile. |

**CTA**:
- Primary: `[Coming soon]`

---

## Product 3: Enterprise Partnerships

**Label**: ENTERPRISE PARTNERSHIPS

**Headline**:
> Credit built into your business

**Subtext**:
> We partner with enterprises to embed financing directly into their platforms. From distributors to service providers, Lynia Finance integrates credit at the point of need—helping businesses grow and customers access more

**Features** (3 items):

| Feature | Description |
|---------|-------------|
| **Mobile money first** | We are a mobile money first platform for speed of transactions. |
| **API friendly platform** | We are a modern platform that is ready to plug into any third party system. Monitor key metrics in real time |
| **Value creation** | We move downstream of value creation. We understand customers' needs, we understand the risks and we leverage our insights to help your business grow. Our mission is building ecosystems to expand our product offerings. |

**CTA**:
- Primary: `[Partner with us]`

---

## Footer

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
│  💬 WhatsApp             │  Message                 │
│  Chat with us directly   │  ┌────────────────────┐  │
│                          │  │                    │  │
│  ✉ Email                 │  └────────────────────┘  │
│  hello@lyniafinance.com  │                          │
│                          │  [Send message]          │
│  📍 Location             │                          │
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

## Page Structure Summary

The homepage is a single scrolling page with this order:

```
1. Navigation bar (sticky): Products | Mission | Partnerships | Research
2. Hero section (headline + subtext + 2 CTAs)
3. Asset Financing section (label + headline + subtext + 4 features + 2 CTAs)
4. Digital Credit section (label + headline + subtext + 2 features + CTA)
5. Enterprise Partnerships section (label + headline + subtext + 3 features + CTA)
6. Contact section (contact form + partnership form - bottom of page)
7. Footer (Products links + Social links + Legal links)
```

Separate pages (linked from nav):
- **Products** → Detailed product pages for the 3 product lines
- **Mission** → Company mission, vision, and values
- **Partnerships** → Distributor and B2B partnership info + application form
- **Research** → Blog / research articles and news
- **Privacy Policy / Terms** → Legal pages (footer links)
