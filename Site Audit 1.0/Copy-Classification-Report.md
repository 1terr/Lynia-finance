# Lynia Finance Website — Complete Copy Classification Report

> **Audit Date:** 23 February 2026
> **Scope:** All pages on lyniafinance.com (Homepage, /products, /thesis, /press, /contact, /editorial, /privacy, /terms, /compliance)
> **Pages Audited:** 10
> **Total Copy Items Catalogued:** ~200+

---

## Typography System Key

| Classification | Tailwind Class | Size | Weight | Typical HTML Element |
|---------------|---------------|------|--------|---------------------|
| **H1 (Hero)** | `text-hero` | 56px / 3.5rem | 700 (Bold) | `<h1>` |
| **H2 (Display)** | `text-display` | 38px / 2.375rem | 700 (Bold) | `<h2>` |
| **H3 (Title)** | `text-title` | 32px / 2rem | 600 (Semibold) | `<h2>`, `<h3>` |
| **H4 (Heading)** | `text-heading` | 26px / 1.625rem | 600 (Semibold) | `<h3>` |
| **H5 (Subheading)** | `text-subheading` | 20px / 1.25rem | 600 (Semibold) | `<h3>`, `<p>` |
| **Section Label** | `text-overline` | 12px / 0.75rem | 600 (Semibold), uppercase | `<span>` |
| **Lead / Subtext** | `text-body-lg` | 18px / 1.125rem | 400 (Regular) | `<p>` |
| **Body Text** | `text-body` | 15px / 0.9375rem | 400 (Regular) | `<p>` |
| **Small Text** | `text-body-sm` | 14px / 0.875rem | 400 (Regular) | `<p>`, `<span>` |
| **Caption** | `text-caption` | 13px / 0.8125rem | 500 (Medium) | `<p>`, `<span>` |
| **Button Text** | (varies by size) | — | 500–600 | `<button>` |

Each classification also has responsive variants for mobile (`text-*-mobile`) and tablet (`text-*-tablet`) breakpoints.

---

## HOMEPAGE (lyniafinance.com)

### 1. Navbar

| Copy | Classification | Element |
|------|---------------|---------|
| Lynia | **H5 (Subheading)** | `<span>` logo |
| Products | **Body Text** | `<a>` nav link |
| Thesis | **Body Text** | `<a>` nav link |
| Press | **Body Text** | `<a>` nav link |
| Get started → | **Button Text** | `<Button>` CTA |

---

### 2. Hero Section

| Copy | Classification | Element |
|------|---------------|---------|
| Financing for the productive majority. | **H1 (Hero)** | `<h1>` → `<span>` |
| We are providing financing necessary for thin-file entrepreneurs to transition from survival to growth. | **H1 (Hero) — accent style** | `<h1>` → `<span class="text-hero-accent">` |
| Get started | **Button Text (lg)** | `<Button variant="accent">` |
| Read the 2026 Thesis | **Button Text (lg)** | `<Button variant="outline">` |

---

### 3. DataStrip Section

| Copy | Classification | Element |
|------|---------------|---------|
| The state of financial inclusion | **H2 (Display)** | `<h2>` |
| Behind every statistic is someone building a livelihood without a safety net—a vendor, a farmer, a mother. The tools to reach them already exist. | **Lead / Subtext** | `<p>` |
| 16% | **H1 (Hero) — stat value** | `<div>` with `text-hero` + `tabular-nums` |
| of adults access formal credit | **Lead / Subtext** (medium weight) | `<p class="text-body-lg font-medium">` |
| 63% | **H1 (Hero) — stat value** | `<div>` with `text-hero` + `tabular-nums` |
| use mobile money | **Lead / Subtext** (medium weight) | `<p class="text-body-lg font-medium">` |
| 52% | **H1 (Hero) — stat value** | `<div>` with `text-hero` + `tabular-nums` |
| own a smartphone | **Lead / Subtext** (medium weight) | `<p class="text-body-lg font-medium">` |
| 58% | **H1 (Hero) — stat value** | `<div>` with `text-hero` + `tabular-nums` |
| work in the informal sector | **Lead / Subtext** (medium weight) | `<p class="text-body-lg font-medium">` |

---

### 4. ProductBento Section

**Card 1 — Digital Credit:**

| Copy | Classification | Element |
|------|---------------|---------|
| DIGITAL CREDIT | **Section Label** | `<span class="text-overline">` |
| Conversational Liquidity | **H4 (Heading)** | `<h3>` |
| Instant, collateral-free credit for civil servants and partner employees. | **Body Text** | `<p>` |
| WhatsApp-native applications with instant disbursement to Innbucks, EcoCash, OneWallet, or OMari. | **Small Text** | `<p>` |
| Innbucks | **Small Text — emphasis** | `<span class="font-medium text-primary-dark">` |
| EcoCash | **Small Text — emphasis** | `<span class="font-medium text-primary-dark">` |
| OneWallet | **Small Text — emphasis** | `<span class="font-medium text-primary-dark">` |
| OMari | **Small Text — emphasis** | `<span class="font-medium text-primary-dark">` |

**Card 2 — Embedded Credit:**

| Copy | Classification | Element |
|------|---------------|---------|
| EMBEDDED CREDIT | **Section Label** | `<span class="text-overline">` |
| API for Ecosystem Resilience | **H4 (Heading)** | `<h3>` |
| Connect via API or data sharing to finance your platform's ecosystem. We analyze mobile money activity to provide credit bundled with health/life insurance and capacity-building mechanisms. | **Body Text** | `<p>` |

**Card 3 — Asset-Backed Credit:**

| Copy | Classification | Element |
|------|---------------|---------|
| ASSET-BACKED CREDIT | **Section Label** | `<span class="text-overline">` |
| Productive Asset Financing | **H3 (Title)** | `<h3>` |
| We finance the income-generating tools of the informal sector—starting with smartphones and scaling to gig-economy assets. | **Body Text** | `<p>` |
| IoT-based risk management | **Small Text — bold** | `<p class="text-body-sm font-medium">` |
| We substitute traditional collateral with real-time asset telemetry. By monitoring usage and health, we enable credit for those the formal system deems "unbankable." | **Small Text** | `<p>` |
| CGAP Alignment: Shifting from "negative collateral" to "productive trust" by funding assets that grow cash flow. | **Caption** | `<p class="text-caption text-muted">` |

---

### 5. DeveloperEngine Section

| Copy | Classification | Element |
|------|---------------|---------|
| THE DEVELOPER ENGINE | **Section Label** | `<span class="text-overline">` |
| Programmable Resilience. | **H2 (Display)** | `<h2>` |
| One integration to manage KYC, scoring, and disbursement across Zimbabwe's mobile money landscape. | **Lead / Subtext** | `<p>` |
| *(SDK code example — 18 lines of code)* | **Code Block** | `<pre><code>` with `text-body-sm font-mono` |

---

### 6. SystemIllustration Section

| Copy | Classification | Element |
|------|---------------|---------|
| EMBEDDED LENDING INFRASTRUCTURE | **Section Label** | `<span class="text-overline">` |
| Connect to existing systems. | **H2 (Display)** | `<h2>` |
| Orchestrate lending across mobile money providers, build custom workflows, and connect to ecosystem partners via APIs. | **Lead / Subtext** | `<p>` |
| Ecosystem Partners | **Caption** (uppercase) | `<p class="text-caption uppercase">` |
| Retailers | **Small Text** | `<div>` diagram label |
| Distributors | **Small Text** | `<div>` diagram label |
| Employers | **Small Text** | `<div>` diagram label |
| Platforms | **Small Text** | `<div>` diagram label |
| Lynia | **H5 (Subheading)** | `<p class="text-subheading">` |
| Core Engine | **Caption** | `<p class="text-caption">` |
| KYC Data | **Caption** | `<div>` API service label |
| Credit Scoring | **Caption** | `<div>` API service label |
| Loan Disbursement | **Caption** | `<div>` API service label |
| Insurance | **Caption** | `<div>` API service label |
| Mobile Money | **Caption** (uppercase) | `<p class="text-caption uppercase">` |
| EcoCash | **Small Text** | `<span>` provider label |
| Innbucks | **Small Text** | `<span>` provider label |
| OneWallet | **Small Text** | `<span>` provider label |
| OMari | **Small Text** | `<span>` provider label |

---

### 7. ThesisSection

| Copy | Classification | Element |
|------|---------------|---------|
| THE THESIS | **Section Label** | `<span class="text-overline">` |
| The Conviction | **H4 (Heading)** | `<h3>` |
| We believe transaction velocity is a more accurate predictor of creditworthiness than a bank statement. | **Lead / Subtext** | `<p>` |
| The Strategy | **H4 (Heading)** | `<h3>` |
| We focus exclusively on productive credit—funding tools that generate income, supported by insurance to protect against economic shocks. | **Lead / Subtext** | `<p>` |
| productive credit | **Lead / Subtext — emphasis** | `<span class="font-medium text-primary-dark">` |

---

### 8. Press Section

| Copy | Classification | Element |
|------|---------------|---------|
| PRESS | **Section Label** | `<span class="text-overline">` |
| In the news | **H2 (Display)** | `<h2>` |

**Press Card 1:**

| Copy | Classification | Element |
|------|---------------|---------|
| ZBC | **Card Logo Text** (24px bold) | `<span>` |
| How Lynia Finance is using mobile money data to underwrite loans for entrepreneurs across Zimbabwe. | **Body Text** | `<p>` card description |
| Read the story | **Small Text — bold link** | `<span class="text-body-sm font-semibold">` |

**Press Card 2:**

| Copy | Classification | Element |
|------|---------------|---------|
| TechHub | **Card Logo Text** (24px bold) | `<span>` |
| Lynia Finance pioneers alternative credit scoring using EcoCash and mobile money patterns. | **Body Text** | `<p>` card description |
| Read the story | **Small Text — bold link** | `<span>` |

**Press Card 3:**

| Copy | Classification | Element |
|------|---------------|---------|
| BD | **Card Logo Text** (24px bold) | `<span>` |
| Lynia Finance combines real-time asset telemetry with mobile money disbursement for productive credit. | **Body Text** | `<p>` card description |
| Read the story | **Small Text — bold link** | `<span>` |

**Press Card 4:**

| Copy | Classification | Element |
|------|---------------|---------|
| Reuters | **Card Logo Text** (24px bold) | `<span>` |
| Reuters explores how companies like Lynia Finance use alternative data for financial inclusion. | **Body Text** | `<p>` card description |
| Read the story | **Small Text — bold link** | `<span>` |

**Press Card 5:**

| Copy | Classification | Element |
|------|---------------|---------|
| Disrupt | **Card Logo Text** (24px bold) | `<span>` |
| Disrupt Africa profiles Lynia Finance among startups leveraging chat-based financial services. | **Body Text** | `<p>` card description |
| Read the story | **Small Text — bold link** | `<span>` |

---

### 9. BottomCTA Section

| Copy | Classification | Element |
|------|---------------|---------|
| Financing for the productive majority. | **H2 (Display)** | `<h2>` |
| Transform mobile money velocity into credit identities. Get started with Lynia's financial infrastructure for Zimbabwe's informal economy. | **Lead / Subtext** | `<p>` |
| Get started → | **Button Text (lg)** | `<Button variant="accent">` |
| Read the 2026 Thesis | **Button Text (lg)** | `<Button variant="outline">` |

---

### 10. Footer

| Copy | Classification | Element |
|------|---------------|---------|
| Lynia Finance | **H5 (Subheading)** | `<span>` logo |
| Built for the productive majority. | **Small Text** (italic) | `<p class="text-body-sm italic">` |
| Products | **Caption** (uppercase, column header) | `<h4 class="text-caption uppercase">` |
| Products | **Small Text** (link) | `<a>` |
| Company | **Caption** (uppercase, column header) | `<h4 class="text-caption uppercase">` |
| Thesis | **Small Text** (link) | `<a>` |
| Press | **Small Text** (link) | `<a>` |
| RBZ Compliance | **Small Text** (link) | `<a>` |
| Connect | **Caption** (uppercase, column header) | `<h4 class="text-caption uppercase">` |
| X (Twitter) | **Small Text** (link) | `<a>` |
| LinkedIn | **Small Text** (link) | `<a>` |
| WhatsApp | **Small Text** (link) | `<a>` |
| Legal | **Caption** (uppercase, column header) | `<h4 class="text-caption uppercase">` |
| Privacy Policy | **Small Text** (link) | `<a>` |
| Terms | **Small Text** (link) | `<a>` |
| © 2026 Lynia Finance. All rights reserved. | **Caption** | `<p class="text-caption text-muted">` |
| Regulated by the Reserve Bank of Zimbabwe. | **Caption** | `<p class="text-caption text-muted">` |

---

### 11. WhatsApp FAB (Floating Action Button)

| Copy | Classification | Element |
|------|---------------|---------|
| Chat with us | **Caption** (tooltip) | `<span>` tooltip |

---

## /products PAGE

| Copy | Classification | Element |
|------|---------------|---------|
| PRODUCTS | **Section Label** | `<span class="text-overline">` |
| Something big is coming. | **H1 (Hero)** | `<h1>` |
| We're building financial tools for Zimbabwe's underbanked majority. Join the waitlist to be the first to know when we launch. | **Lead / Subtext** | `<p>` |
| +263 7XX XXX XXX | **Small Text** (placeholder) | `<input>` placeholder |
| Get notified when we launch → | **Button Text** | `<button>` |
| Joining… | **Button Text** (loading state) | `<button>` |
| You're on the list! We'll notify you when Digital Credit launches. | **Small Text** (success message) | `<p class="text-body-sm text-success">` |

---

## /thesis PAGE

### Hero

| Copy | Classification | Element |
|------|---------------|---------|
| THE 2026 THESIS | **Section Label** | `<span class="text-overline">` |
| Credit infrastructure for the productive majority. | **H1 (Hero)** | `<h1>` |

### The Conviction

| Copy | Classification | Element |
|------|---------------|---------|
| The Conviction | **H3 (Title)** | `<h2>` |
| We believe transaction velocity is a more accurate predictor of creditworthiness than a bank statement. | **Lead / Subtext** | `<p>` |
| In Zimbabwe, 97.5% of adults have mobile phones. 9.96 million use mobile money actively. Yet 83% remain credit-constrained—not because they lack economic activity, but because the formal system cannot see it. | **Body Text** | `<p>` |
| Every EcoCash transfer, every Innbucks payment, every OneWallet top-up generates a signal. These signals, when read correctly, reveal patterns of reliability, consistency, and economic productivity that no bank statement can capture. | **Body Text** | `<p>` |
| The $10B informal economy is not an absence of economic activity—it is an absence of infrastructure to recognise it. Lynia builds that infrastructure. | **Body Text** | `<p>` |

### The Strategy

| Copy | Classification | Element |
|------|---------------|---------|
| The Strategy | **H3 (Title)** | `<h2>` |
| We focus exclusively on productive credit—funding tools that generate income, supported by insurance to protect against economic shocks. | **Lead / Subtext** | `<p>` |
| Starting with smartphones—the single most transformative productive asset for informal workers—we use IoT-based risk management to substitute traditional collateral with real-time asset telemetry. This shifts the paradigm from "negative collateral" to "productive trust": funding assets that grow cash flow. | **Body Text** | `<p>` |
| Every loan is bundled with health and life insurance, creating a resilience layer that protects borrowers from the economic shocks that derail informal livelihoods. Credit without protection is incomplete infrastructure. | **Body Text** | `<p>` |

### Statistics Block

| Copy | Classification | Element |
|------|---------------|---------|
| 97.5% | **H2 (Display) — stat value** | `<p class="text-display-mobile text-primary">` |
| Mobile penetration across Zimbabwe (POTRAZ) | **Small Text** | `<p class="text-body-sm">` |
| 9.96M | **H2 (Display) — stat value** | `<p class="text-display-mobile text-primary">` |
| Active mobile money accounts (RBZ) | **Small Text** | `<p class="text-body-sm">` |
| 83% | **H2 (Display) — stat value** | `<p class="text-display-mobile text-primary">` |
| Formally served but credit-constrained (NFIS II) | **Small Text** | `<p class="text-body-sm">` |

### CTA

| Copy | Classification | Element |
|------|---------------|---------|
| Build with us. | **H2 (Display)** | `<h2>` |
| Whether you are an entrepreneur, a distributor, or a platform looking to embed credit—Lynia is built for you. | **Lead / Subtext** | `<p>` |
| Get started → | **Button Text (lg)** | `<Button variant="accent">` |

---

## /press PAGE

### Hero

| Copy | Classification | Element |
|------|---------------|---------|
| PRESS | **Section Label** | `<span class="text-overline">` |
| In the news | **H1 (Display)** | `<h1>` |
| Coverage, press releases, and updates about Lynia Finance and financial inclusion in Zimbabwe. | **Lead / Subtext** | `<p>` |

### Press Items

**Item 1:**

| Copy | Classification | Element |
|------|---------------|---------|
| February 2026 | **Caption** (uppercase) | `<p class="text-caption uppercase">` |
| Lynia Finance launches WhatsApp-based smartphone financing for informal traders across Zimbabwe. | **H4 (Heading)** | `<h2>` |
| The fintech startup is using mobile money data to underwrite loans for entrepreneurs who have never had access to formal credit. Starting with smartphones, the company plans to expand into broader productive asset financing. | **Body Text** | `<p>` |

**Item 2:**

| Copy | Classification | Element |
|------|---------------|---------|
| January 2026 | **Caption** (uppercase) | `<p class="text-caption uppercase">` |
| How mobile money velocity is replacing bank statements as the new credit score in Africa. | **H4 (Heading)** | `<h2>` |
| Lynia Finance is pioneering a new approach to credit scoring that analyzes transaction patterns across EcoCash, Innbucks, and other mobile money platforms to build credit identities for the unbanked. | **Body Text** | `<p>` |

**Item 3:**

| Copy | Classification | Element |
|------|---------------|---------|
| December 2025 | **Caption** (uppercase) | `<p class="text-caption uppercase">` |
| Zimbabwe fintech bridges the $14B credit gap with IoT-backed asset lending and embedded insurance. | **H4 (Heading)** | `<h2>` |
| By combining real-time asset telemetry with mobile money disbursement, Lynia Finance is creating a new category of productive credit for Zimbabwe's $10B informal economy. | **Body Text** | `<p>` |

### Media Box

| Copy | Classification | Element |
|------|---------------|---------|
| Media inquiries | **Small Text — bold** | `<p class="text-body-sm font-medium">` |
| For press inquiries, partnership announcements, or interview requests, contact us at press@lyniafinance.com | **Small Text** | `<p class="text-body-sm">` |

---

## /contact PAGE

### Hero

| Copy | Classification | Element |
|------|---------------|---------|
| CONTACT | **Section Label** | `<span class="text-overline">` |
| Get in touch | **H2 (Display)** | `<h1>` |
| Have a question about our products, want to become a distributor, or explore a partnership? We'd love to hear from you. | **Lead / Subtext** | `<p>` |

### Contact Methods

| Copy | Classification | Element |
|------|---------------|---------|
| Contact methods | **H4 (Heading)** | `<h2>` |
| Reach us through WhatsApp for the fastest response. We typically reply within a few hours during business days. | **Body Text** | `<p>` |
| WHATSAPP | **Caption** (uppercase label) | `<p class="text-caption uppercase">` |
| Chat with us | **Small Text — bold** | `<p class="text-body-sm font-medium">` |
| EMAIL | **Caption** (uppercase label) | `<p class="text-caption uppercase">` |
| hello@lyniafinance.com | **Small Text — bold** | `<p class="text-body-sm font-medium">` |
| LOCATION | **Caption** (uppercase label) | `<p class="text-caption uppercase">` |
| Harare, Zimbabwe | **Small Text — bold** | `<p class="text-body-sm font-medium">` |

### Contact Form

| Copy | Classification | Element |
|------|---------------|---------|
| Send us a message | **H5 (Subheading)** | `<h3>` |
| Name * | **Small Text — bold** (label) | `<label class="text-body-sm font-medium">` |
| Your full name | **Small Text** (placeholder) | `<input>` placeholder |
| Phone number * | **Small Text — bold** (label) | `<label>` |
| +263 7X XXX XXXX | **Small Text** (placeholder) | `<input>` placeholder |
| Email (optional) | **Small Text — bold** (label) | `<label>` |
| you@example.com | **Small Text** (placeholder) | `<input>` placeholder |
| Message (optional) | **Small Text — bold** (label) | `<label>` |
| How can we help? | **Small Text** (placeholder) | `<textarea>` placeholder |
| Send message | **Button Text (lg)** | `<Button>` |
| Sending… | **Button Text (lg)** (loading) | `<Button>` |
| Message sent | **H5 (Subheading)** (success) | `<p>` |
| We'll get back to you within 24 hours. | **Small Text** (success) | `<p>` |

### Partnerships Section

| Copy | Classification | Element |
|------|---------------|---------|
| PARTNERSHIPS | **Section Label** | `<span class="text-overline">` |
| Become a Lynia partner | **H3 (Title)** | `<h2>` |
| Sell smartphones in your community as a distributor, or embed credit into your platform through our APIs. Apply below and our team will be in touch. | **Body Text** | `<p>` |

### Partnership Form

| Copy | Classification | Element |
|------|---------------|---------|
| Name * | **Small Text — bold** (label) | `<label>` |
| Your full name | **Small Text** (placeholder) | `<input>` placeholder |
| Phone number * | **Small Text — bold** (label) | `<label>` |
| +263 7X XXX XXXX | **Small Text** (placeholder) | `<input>` placeholder |
| Email * | **Small Text — bold** (label) | `<label>` |
| you@example.com | **Small Text** (placeholder) | `<input>` placeholder |
| Type of partnership * | **Small Text — bold** (label) | `<label>` |
| Select partnership type | **Small Text** (placeholder) | `<select>` default |
| Distributor | **Small Text** (option) | `<option>` |
| B2B Partnership | **Small Text** (option) | `<option>` |
| Other | **Small Text** (option) | `<option>` |
| Message (optional) | **Small Text — bold** (label) | `<label>` |
| Tell us about your business and partnership goals | **Small Text** (placeholder) | `<textarea>` placeholder |
| Submit partnership application | **Button Text (lg)** | `<Button>` |
| Submitting… | **Button Text (lg)** (loading) | `<Button>` |
| Application received | **H5 (Subheading)** (success) | `<p>` |
| Our partnerships team will review your application and get in touch shortly. | **Small Text** (success) | `<p>` |

---

## /editorial PAGE

### Hero

| Copy | Classification | Element |
|------|---------------|---------|
| FROM OUR EDITORIAL | **Section Label** | `<span class="text-overline">` |

### Featured Post Card (dynamic content from editorial-data.ts)

| Copy | Classification | Element |
|------|---------------|---------|
| [post.category] | **Caption — badge** | `<span class="text-caption font-medium bg-primary-50">` |
| [post.title] | **H3 (Title)** | `<h2>` |
| [post.excerpt] | **Body Text** | `<p>` |
| Read article → | **Small Text — bold** (link) | `<p class="text-body-sm font-medium text-primary">` |

### Category Filter

| Copy | Classification | Element |
|------|---------------|---------|
| All | **Small Text — bold** (pill button) | `<button class="text-body-sm font-medium">` |
| Company | **Small Text — bold** (pill button) | `<button>` |
| Market | **Small Text — bold** (pill button) | `<button>` |
| Products | **Small Text — bold** (pill button) | `<button>` |
| Engineering | **Small Text — bold** (pill button) | `<button>` |

### Article Grid Cards (dynamic content)

| Copy | Classification | Element |
|------|---------------|---------|
| [post.category] | **Caption — badge** | `<span>` |
| [post.title] | **H5 (Subheading)** | `<h3>` |
| [post.excerpt] | **Small Text** | `<p class="text-body-sm">` |
| [post.date] | **Caption** | `<p class="text-caption">` |

### Blog Post Titles (from editorial-data.ts)

| Title | Classification |
|-------|---------------|
| Why we built Lynia Finance | **H3 (Title)** or **H5 (Subheading)** depending on context |
| Zimbabwe's $14B credit gap | **H3 (Title)** or **H5 (Subheading)** depending on context |
| How asset financing works | **H3 (Title)** or **H5 (Subheading)** depending on context |
| Building credit scoring for the informal economy | **H3 (Title)** or **H5 (Subheading)** depending on context |
| Our distributor network | **H3 (Title)** or **H5 (Subheading)** depending on context |
| Mobile money repayments explained | **H3 (Title)** or **H5 (Subheading)** depending on context |

### Empty State

| Copy | Classification | Element |
|------|---------------|---------|
| No articles in this category yet. Check back soon. | **Body Text** | `<p>` |

---

## /privacy PAGE

### Header

| Copy | Classification | Element |
|------|---------------|---------|
| Privacy Policy | **H2 (Display)** | `<h1>` |
| Last updated: February 2026 | **Body Text** | `<p>` |

### Content Sections

| Section # | Heading Copy | Heading Classification | Body Classification |
|-----------|-------------|----------------------|-------------------|
| 1 | Introduction | **H4 (Heading)** `<h2>` | **Body Text** `<p>` |
| 2 | Information we collect | **H4 (Heading)** `<h2>` | **Body Text** `<p>` + `<ul><li>` bullets |
| 3 | How we use your information | **H4 (Heading)** `<h2>` | **Body Text** `<p>` + `<ul><li>` bullets |
| 4 | Data sharing | **H4 (Heading)** `<h2>` | **Body Text** `<p>` + `<ul><li>` bullets |
| 5 | Data security | **H4 (Heading)** `<h2>` | **Body Text** `<p>` |
| 6 | Data retention | **H4 (Heading)** `<h2>` | **Body Text** `<p>` |
| 7 | Your rights | **H4 (Heading)** `<h2>` | **Body Text** `<p>` + `<ul><li>` bullets |
| 8 | Contact us | **H4 (Heading)** `<h2>` | **Body Text** `<p>` with email links |

**Inline data labels within Section 2 (bold within list items):**
- Identity information (name, national ID, date of birth, photographs)
- Contact information (phone number, email, address)
- Financial information (mobile money records, income data, repayment history)
- Device information (IMEI, usage patterns, location data)
- Usage data (interaction logs, preferences)
- privacy@lyniafinance.com — link text

---

## /terms PAGE

### Header

| Copy | Classification | Element |
|------|---------------|---------|
| Terms of Service | **H2 (Display)** | `<h1>` |
| Last updated: February 2026 | **Body Text** | `<p>` |

### Content Sections

| Section # | Heading Copy | Heading Classification | Body Classification |
|-----------|-------------|----------------------|-------------------|
| 1 | Acceptance of terms | **H4 (Heading)** `<h2>` | **Body Text** |
| 2 | Eligibility | **H4 (Heading)** `<h2>` | **Body Text** + `<ul><li>` bullets |
| 3 | Services | **H4 (Heading)** `<h2>` | **Body Text** + `<ul><li>` bullets |
| 4 | Loan terms and repayment | **H4 (Heading)** `<h2>` | **Body Text** + `<ul><li>` bullets |
| 5 | Identity verification (KYC) | **H4 (Heading)** `<h2>` | **Body Text** |
| 6 | Device management (asset financing) | **H4 (Heading)** `<h2>` | **Body Text** |
| 7 | Privacy | **H4 (Heading)** `<h2>` | **Body Text** with link to /privacy |
| 8 | Prohibited use | **H4 (Heading)** `<h2>` | **Body Text** + `<ul><li>` bullets |
| 9 | Limitation of liability | **H4 (Heading)** `<h2>` | **Body Text** |
| 10 | Governing law | **H4 (Heading)** `<h2>` | **Body Text** |
| 11 | Changes to these terms | **H4 (Heading)** `<h2>` | **Body Text** |
| 12 | Contact | **H4 (Heading)** `<h2>` | **Body Text** with link to legal@lyniafinance.com |

---

## /compliance PAGE

### Hero

| Copy | Classification | Element |
|------|---------------|---------|
| REGULATORY COMPLIANCE | **Section Label** | `<span class="text-overline">` |
| RBZ Compliance | **H2 (Display)** | `<h1>` |
| Lynia Finance operates within the regulatory framework established by the Reserve Bank of Zimbabwe. | **Lead / Subtext** | `<p>` |

### Content Sections

| Section # | Heading Copy | Heading Classification |
|-----------|-------------|----------------------|
| 1 | Know Your Customer (KYC) | **H4 (Heading)** `<h2>` |
| 2 | Transaction Limits | **H4 (Heading)** `<h2>` |
| 3 | Record Retention | **H4 (Heading)** `<h2>` |
| 4 | Reporting Obligations | **H4 (Heading)** `<h2>` |
| 5 | Multi-Currency Support | **H4 (Heading)** `<h2>` |
| 6 | Data Protection | **H4 (Heading)** `<h2>` |

**Transaction Limits cards:**

| Copy | Classification | Element |
|------|---------------|---------|
| $5,000 | **H5 (Subheading)** | `<p class="text-subheading">` |
| Daily limit (USD equivalent) | **Small Text** | `<p class="text-body-sm">` |
| $50,000 | **H5 (Subheading)** | `<p class="text-subheading">` |
| Monthly limit (USD equivalent) | **Small Text** | `<p class="text-body-sm">` |
| $2,000 | **H5 (Subheading)** | `<p class="text-subheading">` |
| Single transaction limit (USD equivalent) | **Small Text** | `<p class="text-body-sm">` |

**Record Retention items:**

| Copy | Classification | Element |
|------|---------------|---------|
| 7 years | **Body Text — bold** | `<span class="font-medium text-primary-dark">` |
| — Transaction records | **Body Text** | `<p>` |
| 10 years | **Body Text — bold** | `<span class="font-medium text-primary-dark">` |
| — KYC documents | **Body Text** | `<p>` |
| 5 years | **Body Text — bold** | `<span class="font-medium text-primary-dark">` |
| — Audit logs | **Body Text** | `<p>` |

---

## SEO / META COPY (not visible on page)

| Copy | Type | Location |
|------|------|----------|
| Lynia — Financing for the productive majority | **Page Title** | `<title>` / metadata |
| Lynia is the financial infrastructure for Zimbabwe's $10B informal economy. We transform mobile money velocity into credit identities. | **Meta Description** | `<meta>` |
| Alternative financial infrastructure for Zimbabwe's underbanked majority. | **Schema.org Description** | JSON-LD |
| The 2026 Thesis — Lynia Finance | **Page Title** | /thesis metadata |
| Press — Lynia Finance | **Page Title** | /press metadata |
| Privacy Policy — Lynia Finance | **Page Title** | /privacy metadata |
| Terms of Service — Lynia Finance | **Page Title** | /terms metadata |
| RBZ Compliance — Lynia Finance | **Page Title** | /compliance metadata |

---

## ACCESSIBILITY-ONLY COPY (screen readers)

| Copy | Context |
|------|---------|
| Skip to main content | Skip link in layout.tsx |
| Open menu | Mobile hamburger aria-label |
| Close menu | Mobile hamburger aria-label |
| Scroll left | Press carousel left arrow |
| Scroll right | Press carousel right arrow |
| Chat with us on WhatsApp | WhatsApp FAB aria-label |

---

## SUMMARY: COPY COUNT BY CLASSIFICATION

| Classification | Count | Where Used |
|---------------|-------|------------|
| **H1 (Hero)** — 56px bold | ~4 | Homepage hero, Products, Thesis, DataStrip stat values |
| **H2 (Display)** — 38px bold | ~10 | Section headings across all pages |
| **H3 (Title)** — 32px semibold | ~6 | Thesis subsections, Partnership heading, Asset card, Editorial featured |
| **H4 (Heading)** — 26px semibold | ~30+ | Press items, Privacy/Terms/Compliance subsections, Product cards, Contact |
| **H5 (Subheading)** — 20px semibold | ~8 | Navbar logo, Footer logo, Core Engine, Form titles, Compliance values |
| **Section Label** — 12px uppercase | ~12 | Every major section opener |
| **Lead / Subtext** — 18px | ~15 | Section descriptions, thesis opening paragraphs |
| **Body Text** — 15px | ~60+ | Paragraphs, descriptions, legal body content |
| **Small Text** — 14px | ~40+ | Card details, form labels, placeholders, links |
| **Caption** — 13px | ~20+ | Dates, footer headers, diagram labels, footnotes |
| **Button Text** | ~12 | CTAs across all pages |
| **Code Block** | 1 | DeveloperEngine SDK example |
| **Card Logo Text** — 24px bold | 5 | Press cards (ZBC, TechHub, BD, Reuters, Disrupt) |

---

*Report generated from codebase analysis of `landing-page/frontend/` — 23 February 2026*
