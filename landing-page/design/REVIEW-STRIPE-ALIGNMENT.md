# Landing Page Review: Stripe Alignment & Copy Strategy

> Design and content review of all Phase 1 deliverables.
> Evaluated through the lens of Stripe's design language, copy voice, and conversion patterns.
> Inline copy rewrites provided for every section.

---

## Executive Summary

The design system is strong — tokens, component specs, wireframes, and animations are thorough and well-documented. The Stripe visual DNA (navy + blurple, Inter font, generous whitespace, alternating sections) is correctly adopted. The primary gaps are in **copy quality** and a few **structural design choices** that diverge from what makes Stripe's approach effective.

**Three headline issues:**

1. **Copy is too long and too warm** — Stripe writes short, declarative, outcome-focused copy. The current copy reads more like marketing brochure text than Stripe-style product writing.
2. **Hero lacks specificity** — "Credit that works for real people" is a sentiment, not a value proposition. Stripe's headlines declare what the product *is*, not how it *feels*.
3. **Feature descriptions are internally focused** — phrases like "We are a mobile money first platform" and "We move downstream of value creation" describe the company, not the customer outcome. Stripe always frames features from the user's perspective.

---

## Part 1: Copy Review — Section by Section

Stripe's copy style has four rules:
- **Declare, don't describe.** State what the product does. Don't explain how you feel about it.
- **Short beats long.** If a headline can lose a word, lose it.
- **Outcome over mechanism.** "Funds in 10 minutes" not "Our system processes your application quickly."
- **No filler.** Every word earns its place. Cut "helping", "giving", "allowing", "enabling".

---

### Section 1: Hero

**Current:**
- Headline: "Credit that works for real people"
- Subtext: "Lynia Finance helps you get the smartphone, tools, or cash you need—giving you the power to earn more and do more."
- Primary CTA: "Apply now"
- Secondary CTA: "Lets chat on whatsapp"

**Issues:**
1. Headline is abstract. "Real people" is vague. Stripe's equivalent is "Financial infrastructure for the internet" — it tells you exactly what the product is.
2. Subtext starts with the company name (self-referential). Stripe subtext always addresses the user or describes the capability.
3. "Giving you the power to earn more and do more" is filler — it doesn't add information.
4. "Lets" is missing an apostrophe. "Lets chat" should be "Let's chat."
5. Both CTAs point toward the same user (individual borrower). No B2B path from the hero.

**Recommended rewrite:**

> **Headline**: "Financial tools for the underbanked"
>
> **Subtext**: "Smartphones, equipment, and cash — delivered through WhatsApp with approval in under 5 minutes."
>
> **Primary CTA**: `Start your application`
>
> **Secondary CTA**: `Chat with us on WhatsApp →`

**Alternative headlines to consider** (ranked):

| Option | Rationale |
|--------|-----------|
| "Financial tools for the underbanked" | Declares what Lynia is. Positions the company. Stripe-direct. |
| "Credit infrastructure for Africa" | Bold, category-defining. Works if targeting investors/B2B too. |
| "The smartphone, the loan, the future" | Poetic but specific. Lists actual products. |
| "Access credit. Build more." | Short, imperative, two-beat rhythm. |

**Why the current headline falls short:** Stripe never says "Payments that work for real businesses." They say "Financial infrastructure for the internet." The difference is *positioning* vs *sentiment*. The headline should tell the visitor what Lynia is, not how Lynia feels about itself.

---

### Section 2: Social Proof / Trust Bar

**Current:** "Trusted by partners across Zimbabwe"

**Issues:**
1. "Trusted by partners across Zimbabwe" is generic. Stripe says nothing — they just show the logos. The logos speak for themselves.
2. The fallback stats ("500+ customers served | <5 min approval | 100% mobile money") are stronger than the logos line.

**Recommended rewrite:**

If logos are available, use no text — just the logo row (Stripe pattern).

If no logos yet, use the stats-as-proof fallback but sharpen the copy:

> `500+ customers` &nbsp;&nbsp; `<5 min approval` &nbsp;&nbsp; `100% mobile money`

No label text needed. The numbers are the proof.

If a label is required:

> "Powering credit across Zimbabwe"

(Active verb. Not "trusted by" — that's passive and unverifiable.)

---

### Section 3: Product Suite Overview

**Current:** "A fully integrated suite of credit products"

**Issue:** This is directly lifted from Stripe ("A fully integrated suite of financial products"). It works on Stripe because Stripe has 15+ products — the word "suite" is earned. Lynia has 3 products. "Suite" oversells the breadth.

**Recommended rewrite:**

> "Three products. One mission."

Or:

> "Credit products for every stage"

**Product card descriptions — current vs recommended:**

| Product | Current | Recommended |
|---------|---------|-------------|
| Asset Financing | "Own the tools that power your trade" | "Own the tools that power your trade" *(keep — this is strong)* |
| Digital Credit | "Cash when you need it most" | "Cash when you need it most" *(keep — clear and direct)* |
| Enterprise Partnerships | "Credit built into your business" | "Embed credit into your platform" *(makes the B2B user the subject)* |

---

### Section 4: Asset Financing Deep Dive

**Current subtext:**
> "Get smartphones, tools of your trade through flexible financing. These assets are productive tools that help you earn more, while our system ensures fair repayment terms"

**Issues:**
1. "Tools of your trade" repeats "tools" from the headline.
2. "These assets are productive tools that help you earn more" — redundant with the headline's message.
3. "While our system ensures fair repayment terms" — internally focused, vague.
4. Sentence doesn't end with a period.

**Recommended rewrite:**

> "Finance a smartphone or equipment with a small deposit. Collect from a local agent, repay via mobile money."

Two sentences. Tells you exactly what happens. No filler.

**Feature grid — current vs recommended:**

| Feature | Current Title | Current Description | Recommended Title | Recommended Description |
|---------|--------------|-------------------|-------------------|----------------------|
| 1 | Ownership | Own asset after paying a deposit | Pay a deposit, own the device | Start with as little as $X down. The device is yours from day one. |
| 2 | Collection | Collect asset at your nearest agent | Pick up locally | Collect your device from any Lynia agent in your area. |
| 3 | Application | Get approved in less than 5 minutes | Approved in minutes | Apply via WhatsApp. Get a decision in under 5 minutes. |
| 4 | Repayment | Repay using mobile money | Repay via mobile money | Pay back through EcoCash or OneMoney. No bank account needed. |

**Key pattern:** Stripe feature titles are 2-4 words max. Descriptions are one sentence that answers "how does this work?", not "what is this?"

---

### Section 5: Digital Credit Deep Dive

**Current subtext:**
> "Quick, secure digital loans delivered straight to your mobile wallet. Designed to cover everyday needs or business growth, with repayment made simple via EcoCash or Omari"

**Issues:**
1. "Omari" — is this a typo for "OneMoney"? If it's a brand name, it's not introduced elsewhere in the docs. This needs verification.
2. "Designed to cover everyday needs or business growth" — vague. Stripe would state the specific range or use case.
3. "With repayment made simple" — passive construction, filler.
4. Missing period at end of sentence.

**Recommended rewrite:**

> "Digital loans deposited directly into your EcoCash or OneMoney wallet. Apply once, get funded in under 10 minutes."

**Feature descriptions — current vs recommended:**

| Feature | Current | Recommended |
|---------|---------|-------------|
| Instant approval | "Apply, get approved and receive your funds in less than 10 minutes." | "From application to cash in your wallet — under 10 minutes." |
| Mobile money friendly | "Your money is deposited directly into your mobile money wallet. You also repay using mobile." | "Receive and repay through the mobile money wallet you already use." |

---

### Section 6: Enterprise Partnerships Deep Dive

**Current subtext:**
> "We partner with enterprises to embed financing directly into their platforms. From distributors to service providers, Lynia Finance integrates credit at the point of need—helping businesses grow and customers access more"

**Issues:**
1. Opens with "We partner with" — Stripe never starts with "We." The subject should be the customer or the capability.
2. "Helping businesses grow and customers access more" — double filler. "Access more" what?
3. Missing period.

**Recommended rewrite:**

> "Embed Lynia's credit products directly into your platform. Your customers get financing at the point of need — you get a new revenue stream."

**Feature descriptions — these need the most work:**

| Feature | Current Title | Current Description | Recommended Title | Recommended Description |
|---------|--------------|-------------------|-------------------|----------------------|
| 1 | Mobile money first | "We are a mobile money first platform for speed of transactions." | Mobile money native | Transactions settle instantly through EcoCash and OneMoney. |
| 2 | API friendly platform | "We are a modern platform that is ready to plug into any third party system. Monitor key metrics in real time" | Developer-ready APIs | Integrate credit products with a few API calls. Monitor disbursements, repayments, and risk in real time. |
| 3 | Value creation | "We move downstream of value creation. We understand customers' needs, we understand the risks and we leverage our insights to help your business grow. Our mission is building ecosystems to expand our product offerings." | Shared growth | Your customers access more. Your platform retains more. Lynia handles underwriting, collections, and risk. |

**Why the current Enterprise copy is the weakest section:** Every sentence starts with "We." This reads like an internal pitch deck, not a customer-facing product page. Stripe's B2B copy always makes the reader the subject: "Accept payments online," "Manage subscriptions," "Optimize revenue." Reframe every sentence to start with what the *partner* gets.

---

### Section 7: Why Alternative Financing (Stats)

**Current headline:** "Building credit rails for the underbanked"

**Issue:** "Credit rails" is an insider/investor term. The target audience includes semi-literate borrowers. This section needs to serve dual purposes — impressive to investors but legible to everyone.

**Recommended rewrite:**

> "The opportunity no bank is serving"

Or for a more declarative Stripe-style approach:

> "80% of Zimbabwe works. Less than 5% can borrow."

(Using two stats as the headline is a bold Stripe move — it creates immediate tension.)

**Current supporting text:**
> "Traditional banks don't serve them. We do. Zimbabwe's informal workforce is 80% of the economy yet almost entirely excluded from credit. Mobile money penetration is high, but financial products haven't followed. Alternative financing bridges this gap."

**Issues:**
1. "Traditional banks don't serve them. We do." — Strong opening. Keep this.
2. "Alternative financing bridges this gap" — corporate jargon ending. Weak close.

**Recommended rewrite:**

> "Traditional banks don't serve them. We do. 80% of Zimbabwe's economy runs on informal work, yet almost no one in it can access credit. Mobile money is everywhere — financial products should be too."

Last sentence reframes "alternative financing bridges this gap" into a specific, concrete statement.

**Stat card labels — tighten the descriptors:**

| Stat | Current Label | Recommended Label |
|------|-------------|-----------------|
| 80% | "Of Zimbabwe's workforce is informal and excluded from traditional credit" | "of Zimbabwe's workforce is informal" |
| <5% | "Of informal workers have access to bank credit" | "have access to bank credit" |
| $14B | "Estimated unserved credit demand in Zimbabwe's informal sector" | "unserved credit demand" |
| 70%+ | "Mobile money adoption rate (EcoCash, OneMoney)" | "mobile money adoption" |

**Rule:** Stat descriptions should be 3-5 words. The number does the heavy lifting. The label just provides context.

---

### Section 8: Customer Segments

**Current headline:** "Built for everyone in the value chain"

**Issue:** "Value chain" is B-school language. Stripe says "Designed for your business" or segments by type without a parent label.

**Recommended rewrite:**

> "Built for how Zimbabwe works"

Or simply:

> "Who we serve"

**Segment card copy — current vs recommended:**

| Segment | Current | Recommended |
|---------|---------|-------------|
| For Individuals | "Get the tools you need to earn more. Smartphones, equipment, and cash — all via WhatsApp." | "Smartphones, equipment, and cash. Apply via WhatsApp in under 5 minutes." *(Cut the abstract "earn more", add specificity)* |
| For Businesses | "Grow your business with instant digital credit. No paperwork, no bank visits." | "Digital credit with no paperwork and no bank visits. Apply and receive funds on your phone." *(Lead with what they get, not what they'll do with it)* |
| For Partners | "Embed credit into your platform and help your customers access more." | "Embed credit into your platform. Offer financing at the point of sale through our APIs." *(Specific mechanism, not vague "access more")* |

---

### Section 9: Editorial / Research

**Current headline:** "From our Research"

**This is fine.** Clean, understated. Matches Stripe's blog presentation. No changes needed.

---

### Section 10: Bottom CTA

**Current:**
> Headline: "Ready to get started?"
> Subtext: "Get the smartphone, tools, or cash you need. Apply in under 5 minutes via WhatsApp."
> CTAs: "Apply now" / "Lets chat on whatsapp"

**Issues:**
1. "Ready to get started?" is the Stripe default. It works, but it's generic. For a fintech serving underbanked populations, the CTA should acknowledge the significance of the decision.
2. "Lets" — missing apostrophe again. Must be "Let's."

**Recommended rewrite:**

> **Headline**: "Start building with better credit"
>
> **Subtext**: "Apply in under 5 minutes. No bank account required. No paperwork."
>
> **Primary CTA**: `Start your application`
>
> **Secondary CTA**: `Chat with us on WhatsApp →`

**Alternative headlines:**

| Option | Tone |
|--------|------|
| "Start building with better credit" | Aspirational, forward-looking |
| "Your next step starts here" | Simple, action-oriented |
| "Apply now. Get funded today." | Direct, urgent, specific |

---

### Navigation

**Current:** `Products | Mission | Partnerships | Research`

**Recommendation:** This is clean. One adjustment — consider renaming "Mission" to "About" for broader utility (investors, press, job seekers all look for "About"). "Mission" is a subset of what that page should contain.

> `Products | About | Partnerships | Research`

---

### Footer

**Current product labels:**
- Smartphone financing
- Digital loans
- Embedded financing

**Issue:** These don't match the product names used elsewhere (Asset Financing, Digital Credit, Enterprise Partnerships). Consistency matters.

**Recommendation:** Use the same product names everywhere, or deliberately choose customer-friendly short names and use them consistently:

> **Products column:**
> - Asset financing
> - Digital credit
> - Enterprise partnerships

Or the simplified versions (pick one set and use everywhere):

> - Smartphone financing → matches "Asset Financing" but is more specific
> - Digital loans → matches "Digital Credit"
> - Embedded financing → matches "Enterprise Partnerships" but is more descriptive

Either way — pick one naming convention and commit to it across nav, hero, cards, footer, and all pages.

---

## Part 2: Design & Structure Review

### What's working well

1. **Color system** — The navy + blurple palette is correctly derived from Stripe. The token naming is clean and the Tailwind mapping is production-ready.

2. **Typography** — Inter at weight 500 for headings and 300 for body correctly replicates Stripe's typographic feel. The type scale is well-proportioned.

3. **Section rhythm** — Alternating light/dark backgrounds with 120px vertical padding creates the breathing room that makes Stripe feel premium. This is correctly specified.

4. **Component specs** — The 16 components are well-documented with all necessary properties. The hierarchy and build order are thoughtful.

5. **Animation specs** — The motion design is restrained and purposeful. The `prefers-reduced-motion` support and performance budget show mature thinking.

6. **Mobile-first wireframes** — Every section has both mobile and desktop wireframes. The responsive behavior is clearly defined.

### Design issues and recommendations

#### Issue 1: Navigation lacks a CTA button

**Current:** Text links only — "Clean nav only - no buttons"

**Stripe's pattern:** Stripe includes a CTA button in the nav ("Start now" or "Contact sales"). This is intentional — it provides a persistent conversion path from any scroll position.

**Recommendation:** Add a single nav CTA button on desktop:

```
[Logo]     Products   About   Partnerships   Research     [Apply now]
```

On mobile, add it as the last item in the hamburger menu. This is a high-impact conversion optimization that Stripe, Paystack, and every successful fintech landing page uses.

#### Issue 2: Hero visual may not load on target devices

**Current:** WebGL animated gradient + CSS-rendered phone mockup with WhatsApp UI

**Concern:** The target audience uses "low-end devices and slow connections" (per the design brief). WebGL on a $50 Android phone over 2G will either not render or consume significant battery/data.

**Recommendation:**
- Default to the CSS gradient fallback, not WebGL
- Make WebGL the progressive enhancement (load only on devices that score above a hardware threshold)
- Consider a static optimized illustration instead of the CSS-rendered phone mockup — simpler to maintain, lighter to load, and avoids the uncanny valley of a CSS phone that doesn't quite look real
- The `< 200KB initial load` budget is in direct tension with a WebGL shader. Prioritize content load speed over visual polish for this audience.

#### Issue 3: Hero should be shorter on mobile

**Current:** Hero content stacks with optional phone mockup, `padding: 80px top, 64px bottom`

**Recommendation:** On mobile, the hero should be **content-visible without scrolling**. The headline, subtext, and primary CTA must all appear above the fold on a 375px-wide screen. Consider:
- Reducing mobile top padding to `48px` (after accounting for 64px nav)
- Hiding the phone mockup entirely on `< 768px` (it adds scroll depth without adding conversion value on mobile)
- Making the headline `32px` instead of `36px` on mobile to ensure the CTA appears above the fold

#### Issue 4: Three product deep-dives create a long scroll

**Current:** Sections 4-5-6 are three full-width split-layout sections with 120px padding each. That's ~1800px of product content before the user reaches the stats section.

**Stripe pattern:** Stripe gives each product a compact section — about 600-800px tall. The deep content lives on the individual product pages, not the homepage.

**Recommendation:**
- Reduce the product deep-dive sections to a more compact format — shorter descriptions, fewer features shown (2 max per product), with a clear "Learn more →" link to the full product page
- Consider combining Sections 3 (Product Suite cards) and 4-5-6 (deep dives) into a single section with tabbed or scrollable product detail, similar to how Stripe handles their product selector
- At minimum, reduce section padding from `120px` to `80px` for the deep-dive sections to tighten the scroll

#### Issue 5: "Coming Soon" is a conversion dead-end

**Current:** Digital Credit section has a disabled `[Coming soon]` button.

**Issue:** A disabled button tells the user "there's nothing for you here." This is wasted real estate.

**Recommendation:** Replace with an email/phone capture:

> `Get notified when Digital Credit launches →`

This converts interest into a lead. Even a simple "Enter your phone number" field inline would be better than a grayed-out button.

#### Issue 6: Stats section placement

**Current:** Section 7 (stats) comes *after* the three product deep-dives.

**Issue:** By the time a user reaches the stats, they've already scrolled through ~2500px of content. The stats section makes the case for *why* Lynia exists — this is contextual information that should come earlier.

**Recommendation:** Move the stats section to position 3 (after Social Proof, before the Product Suite). The narrative flow becomes:

1. **Hero** — Here's what we do
2. **Social Proof** — Others trust us
3. **Why This Matters** (stats) — Here's the problem we solve
4. **Product Suite** — Here's how we solve it
5. **Product Deep Dives** — Here's the detail
6. **Customer Segments** — Here's who it's for
7. **Editorial** — Here's our thinking
8. **Bottom CTA** — Take action

This mirrors Stripe's "Why Stripe" section placement — it comes early in the page to establish stakes before the product details.

#### Issue 7: WhatsApp floating button + "Let's chat on WhatsApp" CTA redundancy

The WhatsApp FAB is persistent on all pages. The "Let's chat on WhatsApp" secondary CTA appears in the hero, Asset Financing section, and bottom CTA. That's four WhatsApp entry points on one page.

**Recommendation:** Keep the FAB (it's the universal escape hatch for the audience). Remove the "Let's chat on WhatsApp" text from the hero and bottom CTA — the FAB covers that intent. Use the secondary CTA slot for a different action:

- Hero secondary: `See how it works →` (scrolls to product section)
- Bottom CTA secondary: `Talk to our team →` (goes to contact page)

This diversifies the conversion paths instead of duplicating one.

#### Issue 8: Missing social proof strategy

**Current:** The trust bar plans for partner logos, but notes they're "not yet available." The fallback is stats.

**Recommendation for launch without logos:**
- Use **customer count + approval speed + repayment stat** as the trust bar content
- Format: three clean numbers in a row, no label above
- Example: `500+ loans funded` &middot; `<5 min average approval` &middot; `98% mobile money repayment`
- Add logos as they become available — the section is designed to accommodate both

---

## Part 3: Global Copy Style Guide (Stripe-Aligned)

### Rules for all Lynia landing page copy

| Rule | Example (Bad) | Example (Good) |
|------|--------------|----------------|
| Never start with "We" | "We are a mobile money first platform" | "Transactions settle via mobile money" |
| Lead with outcome, not mechanism | "Our system processes your application quickly" | "Get approved in under 5 minutes" |
| One idea per sentence | "Get smartphones, tools of your trade through flexible financing that helps you earn more" | "Finance a smartphone or equipment with a small deposit." |
| Cut "helping", "enabling", "allowing" | "Helping businesses grow" | "Your business grows" (or better: state *how*) |
| Use numbers over adjectives | "Fast approval" | "Approved in 5 minutes" |
| End every sentence with a period | "Repay using mobile money" | "Repay using mobile money." |
| Contractions are fine | "We would love to" | "We'd love to" |
| Name the product, not the category | "Mobile money services" | "EcoCash and OneMoney" |
| Apostrophe on "Let's" | "Lets chat" | "Let's chat" |
| No trailing ellipsis in production copy | "Learn more..." | "Learn more" |

### CTA button text rules

| Pattern | Example |
|---------|---------|
| Verb + object | "Start your application" |
| Specific over generic | "Apply via WhatsApp" > "Get started" |
| Match the user's intent | "See pricing" not "Learn more" (if they want pricing) |
| No "Click here" or "Submit" | Use descriptive action text |

### Headline formula

Stripe headlines follow one of three patterns:

1. **Declarative:** "Financial infrastructure for the internet" → **"Financial tools for the underbanked"**
2. **Imperative:** "Start accepting payments today" → **"Start building with better credit"**
3. **Noun phrase:** "A fully integrated suite of financial products" → **"Three products. One mission."**

Avoid:
- Questions as headlines ("Ready to grow?")
- Superlatives ("The best credit platform")
- Sentiment without specificity ("Credit that works for real people")

---

## Part 4: Prioritized Action Items

### Critical (fix before development)

| # | Item | Section | Impact |
|---|------|---------|--------|
| 1 | Rewrite hero headline and subtext | Hero | First impression — defines positioning |
| 2 | Fix "Lets" → "Let's" everywhere | Hero, Section 4, Section 10 | Grammar error on primary CTA |
| 3 | Verify "Omari" reference | Section 5 (Digital Credit) | Possible typo — should this be "OneMoney"? |
| 4 | Rewrite Enterprise Partnership feature descriptions | Section 6 | Currently reads as internal pitch deck |
| 5 | Add missing periods to all copy | Sections 4, 5, 6 | Multiple sentences missing terminal punctuation |
| 6 | Add nav CTA button | Navigation | Missing primary conversion path |

### High priority (improve before launch)

| # | Item | Section | Impact |
|---|------|---------|--------|
| 7 | Move stats section earlier in page | Section 7 → Section 3 | Establishes problem before presenting solution |
| 8 | Shorten product deep-dive sections | Sections 4-5-6 | Reduces scroll depth, improves engagement |
| 9 | Replace "Coming soon" with lead capture | Section 5 | Converts dead-end into lead gen |
| 10 | Standardize product naming across all sections | Global | Footer names don't match section names |
| 11 | Reduce WhatsApp CTA redundancy | Hero, Sections 4, 10 | FAB handles this — use secondary CTAs for other paths |
| 12 | Rename "Mission" to "About" in nav | Navigation | Broader utility for all audience segments |

### Nice to have (polish)

| # | Item | Section | Impact |
|---|------|---------|--------|
| 13 | Tighten stat card labels to 3-5 words | Section 7 | Cleaner visual impact |
| 14 | Rewrite customer segment card copy | Section 8 | Remove abstract language, add specifics |
| 15 | Default to CSS gradient over WebGL | Hero | Better performance on target devices |
| 16 | Reduce hero mobile padding for above-fold CTA | Hero | Mobile conversion optimization |

---

## Appendix: Complete Rewritten Copy (Ready to Replace)

Below is the full rewritten copy for CONTENT.md. All changes follow the Stripe copy principles outlined above.

### Hero

```
Headline: Financial tools for the underbanked
Subtext: Smartphones, equipment, and cash — delivered through WhatsApp with approval in under 5 minutes.
Primary CTA: Start your application
Secondary CTA: See how it works →
```

### Social Proof

```
(No label if logos available)
Fallback: 500+ loans funded  ·  <5 min approval  ·  100% mobile money
```

### Product Suite

```
Headline: Three products. One mission.
```

### Asset Financing

```
Label: ASSET FINANCING
Headline: Own the tools that power your trade
Subtext: Finance a smartphone or equipment with a small deposit. Collect from a local agent, repay via mobile money.

Features:
- Pay a deposit, own the device: Start with a small deposit. The device is yours from day one.
- Pick up locally: Collect your device from any Lynia agent in your area.
- Approved in minutes: Apply via WhatsApp. Get a decision in under 5 minutes.
- Repay via mobile money: Pay back through EcoCash or OneMoney. No bank account needed.

Primary CTA: Start your application
Secondary CTA: Learn more →
```

### Digital Credit

```
Label: DIGITAL CREDIT
Headline: Cash when you need it most
Subtext: Digital loans deposited directly into your EcoCash or OneMoney wallet. Apply once, get funded in under 10 minutes.

Features:
- Application to wallet in minutes: From application to cash in your wallet — under 10 minutes.
- Works with your mobile money: Receive and repay through the mobile money wallet you already use.

CTA: Get notified when we launch →
```

### Enterprise Partnerships

```
Label: ENTERPRISE PARTNERSHIPS
Headline: Embed credit into your platform
Subtext: Offer your customers financing at the point of need. Lynia handles underwriting, disbursement, and collections — you earn on every transaction.

Features:
- Mobile money native: Transactions settle instantly through EcoCash and OneMoney.
- Developer-ready APIs: Integrate credit products with a few API calls. Monitor disbursements, repayments, and risk in real time.
- Shared growth: Your customers access more. Your platform retains more. Lynia handles underwriting, collections, and risk.

CTA: Partner with us →
```

### Why Alternative Financing (Stats)

```
Headline: 80% of Zimbabwe works. Less than 5% can borrow.

Stats:
- 80% — of the workforce is informal
- <5% — have access to bank credit
- $14B — unserved credit demand
- 70%+ — mobile money adoption

Supporting text: Traditional banks don't serve them. We do. Mobile money is everywhere — financial products should be too.
```

### Customer Segments

```
Headline: Built for how Zimbabwe works

For Individuals:
Smartphones, equipment, and cash. Apply via WhatsApp in under 5 minutes.
CTA: Start your application →

For Businesses:
Digital credit with no paperwork and no bank visits. Apply and receive funds on your phone.
CTA: Coming soon →

For Partners:
Embed credit into your platform. Offer financing at the point of sale through our APIs.
CTA: Partner with us →
```

### Bottom CTA

```
Headline: Apply now. Get funded today.
Subtext: No bank account required. No paperwork. Approval in under 5 minutes.
Primary CTA: Start your application
Secondary CTA: Talk to our team →
```

---

*Review prepared for the Lynia Finance design phase. All recommendations are grounded in Stripe's documented design patterns and copy conventions, adapted for Lynia's audience and market context.*
