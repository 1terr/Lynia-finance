# Component Specifications — Lynia Finance Landing Page

> Detailed specs for every reusable UI component.
> Design language follows [stripe.com](https://stripe.com).
> Reference [`DESIGN-TOKENS.md`](./DESIGN-TOKENS.md) for all values.

---

## Table of Contents

1. [Navigation Bar](#1-navigation-bar)
2. [Buttons](#2-buttons)
3. [Hero Section](#3-hero-section)
4. [Logo Strip](#4-logo-strip)
5. [Product Card](#5-product-card)
6. [Product Deep Dive Section](#6-product-deep-dive-section)
7. [Feature Grid Item](#7-feature-grid-item)
8. [Stat Card](#8-stat-card)
9. [Segment Card](#9-segment-card)
10. [Blog Post Card](#10-blog-post-card)
11. [CTA Section](#11-cta-section)
12. [Form Elements](#12-form-elements)
13. [Footer](#13-footer)
14. [WhatsApp Floating Button](#14-whatsapp-floating-button)
15. [Section Label](#15-section-label)
16. [Section Container](#16-section-container)

---

## 1. Navigation Bar

### Structure

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]        Products   Mission   Partnerships   Research  │
└──────────────────────────────────────────────────────────┘
```

### Properties

| Property | Value |
|----------|-------|
| Height | `72px` (desktop), `64px` (mobile) |
| Position | `sticky`, `top: 0` |
| Background | Transparent at top → `rgba(255,255,255,0.95)` on scroll |
| Backdrop filter | `blur(12px)` (on scroll) |
| Border bottom | `1px solid var(--color-border)` (on scroll, hidden at top) |
| Z-index | `var(--z-sticky)` (100) |
| Container | `max-width: var(--container-max)` centered with `var(--container-padding)` |
| Transition | Background `var(--duration-normal)` `var(--easing-default)` |

### Logo

| Property | Value |
|----------|-------|
| Size | `120px` width (auto height), max `32px` height |
| Link | Navigates to `/` |
| Format | SVG (light + dark variants available) |

### Nav Links

| Property | Value |
|----------|-------|
| Font | `var(--text-body-sm)` / `15px` |
| Weight | `var(--font-medium)` / `500` |
| Color (default) | `var(--color-slate)` / `#425466` |
| Color (hover) | `var(--color-primary-dark)` / `#0A2540` |
| Color (on dark hero) | `var(--color-white)` at top → `var(--color-slate)` on scroll |
| Spacing | `32px` between items |
| Transition | Color `var(--duration-fast)` |
| Underline | None. Optional: 2px bottom border on active page |

### Mobile Nav

| Property | Value |
|----------|-------|
| Trigger | Hamburger icon (`24px`, 3-line), right-aligned |
| Panel | Full-screen overlay, `background: var(--color-white)` |
| Animation | Slide down from top, `var(--duration-slow)` |
| Links | Stacked vertically, `var(--text-h4)`, `48px` row height |
| Close | X icon top-right, same position as hamburger |
| Z-index | `var(--z-overlay)` (200) |

### Behavior

1. On page load (hero visible): transparent background, white text links
2. On scroll past hero: solid white background, dark text links, bottom border visible
3. Transition between states is smooth (`200ms`)

---

## 2. Buttons

### Primary Button

| Property | Value |
|----------|-------|
| Background | `var(--color-cta)` / `#0048E5` |
| Text color | `var(--color-white)` |
| Font | `var(--text-body-sm)` / `15px`, `var(--font-medium)` / `500` |
| Padding | `12px 24px` |
| Border radius | `var(--radius-md)` / `8px` |
| Min width | `120px` |
| Height | `44px` |
| Hover | Background `var(--color-cta-hover)` / `#003ECB`, shadow `var(--shadow-md)` |
| Active | Scale `0.98`, shadow `var(--shadow-sm)` |
| Focus | `2px` outline, `var(--color-primary)` / `#635BFF`, `2px` offset |
| Disabled | `opacity: 0.5`, `cursor: not-allowed` |
| Transition | All `var(--duration-fast)` |

### Secondary Button (text link style)

| Property | Value |
|----------|-------|
| Background | Transparent |
| Text color | `var(--color-cta)` / `#0048E5` |
| Font | `var(--text-body-sm)` / `15px`, `var(--font-medium)` |
| Padding | `12px 0` |
| Icon | Right arrow `→` (`16px`), `4px` gap |
| Hover | Text color `var(--color-cta-hover)`, arrow shifts right `4px` |
| Transition | All `var(--duration-fast)` |

### Ghost Button (on dark backgrounds)

| Property | Value |
|----------|-------|
| Background | Transparent |
| Border | `1px solid rgba(255,255,255,0.3)` |
| Text color | `var(--color-white)` |
| Padding | `12px 24px` |
| Border radius | `var(--radius-md)` |
| Hover | `background: rgba(255,255,255,0.1)`, border `rgba(255,255,255,0.5)` |

### Disabled / Coming Soon Button

| Property | Value |
|----------|-------|
| Background | `var(--color-border)` / `#E0E6EB` |
| Text color | `var(--color-gray-400)` / `#aab7c4` |
| Cursor | `not-allowed` |
| No hover effects | |

### Button Sizes

| Size | Height | Padding | Font |
|------|--------|---------|------|
| Small | `36px` | `8px 16px` | `13px` |
| Default | `44px` | `12px 24px` | `15px` |
| Large | `52px` | `16px 32px` | `17px` |

---

## 3. Hero Section

### Layout

| Property | Value |
|----------|-------|
| Height | `100vh` min, content-adaptive |
| Background | WebGL animated gradient canvas (full viewport) |
| Content layout | CSS Grid, 2 columns (`1fr 1fr`), `gap: 48px` |
| Container | `max-width: var(--container-max)`, centered |
| Vertical alignment | Center |
| Padding | `var(--space-28)` top and bottom / `120px` |

### Left Column (Text)

| Element | Specification |
|---------|--------------|
| Headline | `var(--text-display)` / `64px`, `var(--font-medium)` / `500`, `var(--color-white)`, `letter-spacing: 0` |
| Subtext | `var(--text-body-lg)` / `20px`, `var(--font-regular)` / `400`, `rgba(255,255,255,0.7)`, `max-width: 520px` |
| Gap headline → subtext | `var(--space-6)` / `24px` |
| Gap subtext → CTAs | `var(--space-8)` / `32px` |
| CTA row | Flex, `gap: 16px`, items center-aligned |
| Primary CTA | Primary button (large size, white bg with `var(--color-cta)` text on dark hero) |
| Secondary CTA | Text link, white color, arrow right |

### Right Column (Visual)

| Property | Value |
|----------|-------|
| Content | CSS-rendered phone mockup with WhatsApp UI illustration |
| Max width | `480px` |
| Alignment | Center, slight float animation |
| Animation | Subtle `translateY` oscillation (`8px` range, `4s` duration, infinite) |

### Mobile (below `var(--bp-lg)`)

| Change | Value |
|--------|-------|
| Grid | Single column |
| Headline | `36px` (mobile scale) |
| Visual | Hidden or reduced size below hero text |
| Padding | `var(--space-20)` top |
| Min height | `auto` (not full viewport) |

### WebGL Gradient Background

| Property | Value |
|----------|-------|
| Colors | `#0A2540`, `#635BFF`, `#0048E5`, `#1A3550` |
| Animation | Slow-moving gradient mesh, `0.3` speed factor |
| Fallback | `background: linear-gradient(135deg, #0A2540 0%, #635BFF 50%, #0048E5 100%)` |
| Performance | Reduce to CSS gradient on `prefers-reduced-motion` or low-end devices |

---

## 4. Logo Strip

### Layout

| Property | Value |
|----------|-------|
| Background | `var(--color-white)` or `var(--color-gray-100)` / `#F6F9FC` |
| Padding | `var(--space-10)` vertical |
| Content | Centered label + horizontal logo row |
| Label | `var(--text-caption)`, `var(--color-text-muted)` / `#aab7c4`, uppercase, `var(--tracking-wide)` |
| Logo container | Flex, `gap: 48px`, center-aligned, `flex-wrap: wrap` |
| Logo height | `28px–36px`, grayscale by default |
| Logo hover | Full color, `var(--duration-normal)` transition |
| Mobile | 2 rows if needed, `gap: 24px` |

---

## 5. Product Card

Used in Section 3 (Product Suite Overview).

### Layout

```
┌──────────────────────┐
│  [Illustration area]  │  80px height
│                       │
│  PRODUCT LABEL        │  Overline
│  Card headline text   │  H3
│  Description text     │  Body
│                       │
│  Learn more →         │  Link
└──────────────────────┘
```

### Properties

| Property | Value |
|----------|-------|
| Background | `var(--color-white)` |
| Border | `1px solid var(--color-border)` / `#E0E6EB` |
| Border radius | `var(--radius-lg)` / `12px` |
| Padding | `var(--space-8)` / `32px` |
| Shadow (default) | `var(--shadow-sm)` |
| Shadow (hover) | `var(--shadow-lg)` |
| Transform (hover) | `translateY(-4px)` |
| Transition | All `var(--duration-normal)` |

### Content

| Element | Specification |
|---------|--------------|
| Illustration | `64px` height area, centered, flat SVG illustration |
| Label | `var(--text-overline)`, uppercase, `var(--tracking-wider)`, `var(--color-cta)` / `#0048E5` |
| Headline | `var(--text-h3)`, `var(--font-medium)`, `var(--color-primary-dark)` / `#0A2540` |
| Description | `var(--text-body)`, `var(--color-text-body)` / `#425466`, max 2 lines |
| Link | Secondary button style, `var(--color-cta)`, arrow right |

### Grid

| Property | Value |
|----------|-------|
| Layout | CSS Grid, 3 columns (`repeat(3, 1fr)`) |
| Gap | `var(--grid-gap-lg)` / `32px` |
| Tablet (< `var(--bp-lg)`) | 2 columns |
| Mobile (< `var(--bp-md)`) | 1 column, full width |

---

## 6. Product Deep Dive Section

Used in Sections 4, 5, 6.

### Layout — Split (text + visual)

```
Desktop:
┌──────────────────────────┬──────────────────────────┐
│  Text Column (50%)        │  Visual Column (50%)      │
│                           │                           │
│  LABEL (overline)         │  [Flat illustration]      │
│  Headline (H1)            │                           │
│  Description (body-lg)    │                           │
│  Feature grid             │                           │
│  CTAs                     │                           │
└──────────────────────────┴──────────────────────────┘
```

### Properties

| Property | Value |
|----------|-------|
| Layout | CSS Grid, `1fr 1fr`, `gap: var(--grid-gap-xl)` / `48px` |
| Vertical padding | `var(--space-28)` / `120px` |
| Container | `max-width: var(--container-max)`, centered |
| Vertical align | Center both columns |

### Alternating Backgrounds

| Section | Background | Text Color |
|---------|-----------|------------|
| Asset Financing (#4) | `var(--color-white)` | Dark text (`#0A2540` / `#425466`) |
| Digital Credit (#5) | `var(--color-navy)` / `#0A2540` | White text |
| Enterprise (#6) | `var(--color-gray-100)` / `#F6F9FC` | Dark text (`#0A2540` / `#425466`) |

### Alternating Layout Direction

| Section | Layout |
|---------|--------|
| Asset Financing (#4) | Text left, visual right |
| Digital Credit (#5) | Visual left, text right |
| Enterprise (#6) | Text left, visual right |

### Text Column

| Element | Specification |
|---------|--------------|
| Label | `var(--text-overline)`, uppercase, `var(--tracking-wider)`, `var(--color-cta)` (or `var(--color-primary)` / `#635BFF` on dark bg) |
| Headline | `var(--text-h1)`, `var(--font-medium)` / `500`, `letter-spacing: 0` |
| Description | `var(--text-body-lg)`, `var(--color-text-body)` / `#425466` (or `rgba(255,255,255,0.7)` on dark) |
| Gap: label → headline | `var(--space-4)` |
| Gap: headline → description | `var(--space-6)` |
| Gap: description → features | `var(--space-10)` |
| Gap: features → CTAs | `var(--space-8)` |

### Visual Column

| Property | Value |
|----------|-------|
| Content | Flat illustration (SVG or optimized PNG) |
| Max width | `100%` of column |
| Animation | Fade in + slight `translateX` on scroll into view |

### Mobile (below `var(--bp-lg)`)

| Change | Value |
|--------|-------|
| Grid | Single column |
| Order | Text first, visual second (always) |
| Visual | Max height `300px`, centered |
| Padding | `var(--space-16)` vertical |

---

## 7. Feature Grid Item

Used inside product deep-dive sections.

### Layout

```
┌───────────────────┐
│  [Icon] (24px)     │
│  Feature Title     │
│  Description text  │
└───────────────────┘
```

### Properties

| Property | Value |
|----------|-------|
| Layout | Grid item in a 2, 3, or 4-column grid (responsive) |
| Icon | Lucide icon, `var(--icon-lg)` / `24px`, `var(--color-cta)` / `#0048E5` (or `var(--color-primary)` / `#635BFF` on dark bg) |
| Title | `var(--text-h5)` / `18px`, `var(--font-medium)` / `500` |
| Description | `var(--text-body-sm)` / `15px`, `var(--color-text-body)` / `#425466` (or `rgba(255,255,255,0.7)`) |
| Gap: icon → title | `var(--space-3)` / `12px` |
| Gap: title → description | `var(--space-2)` / `8px` |

### Feature Grid Layout

| Product | Columns | Items |
|---------|---------|-------|
| Asset Financing | 4 → 2 (mobile) | 4 features |
| Digital Credit | 2 → 1 (mobile) | 2 features |
| Enterprise | 3 → 1 (mobile) | 3 features |

---

## 8. Stat Card

Used in Section 7 (Why Alternative Financing).

### Layout

```
┌──────────────────┐
│     80%           │  Stat number
│  Of Zimbabwe's    │  Description
│  workforce is     │
│  informal         │
└──────────────────┘
```

### Properties

| Property | Value |
|----------|-------|
| Layout | 4-column grid on desktop, 2-column on mobile |
| Number | `var(--text-display)` / `64px`, `var(--font-medium)` / `500`, `var(--color-white)` |
| Description | `var(--text-body)`, `rgba(255,255,255,0.7)` |
| Gap: number → description | `var(--space-3)` |
| Text alignment | Center (desktop), left (mobile) |
| Animation | Count up animation on scroll into view (optional) |

### Section Properties

| Property | Value |
|----------|-------|
| Background | `var(--gradient-stats)` |
| Padding | `var(--space-28)` / `120px` vertical |
| Headline | `var(--text-h1)`, `var(--font-medium)`, `var(--color-white)`, centered |
| Supporting text | `var(--text-body-lg)`, `rgba(255,255,255,0.7)`, centered, `max-width: 680px` |
| Gap: headline → stats | `var(--space-16)` |
| Gap: stats → supporting text | `var(--space-12)` |

---

## 9. Segment Card

Used in Section 8 (Customer Segments).

### Layout

```
┌───────────────────────┐
│  FOR INDIVIDUALS       │  Overline label
│                        │
│  Get the tools you     │  Description
│  need to earn more.    │
│  Smartphones,          │
│  equipment, and cash   │
│  — all via WhatsApp.   │
│                        │
│  Apply now →           │  Link
└───────────────────────┘
```

### Properties

| Property | Value |
|----------|-------|
| Background | `var(--color-white)` |
| Border | `1px solid var(--color-border)` / `#E0E6EB` |
| Border radius | `var(--radius-lg)` |
| Padding | `var(--space-8)` / `32px` |
| Shadow | `var(--shadow-sm)` |
| Hover shadow | `var(--shadow-lg)` |
| Hover transform | `translateY(-4px)` |
| Transition | All `var(--duration-normal)` |
| Overline | `var(--text-overline)`, uppercase, `var(--tracking-wider)`, `var(--color-cta)` / `#0048E5` |
| Description | `var(--text-body)`, `var(--color-text-body)` / `#425466` |
| Link | Secondary button style |
| Grid | 3 columns (desktop) → 1 column (mobile) |

---

## 10. Blog Post Card

Used in Section 9 (Editorial) and Research page.

### Layout

```
┌──────────────────────────┐
│  ┌────────────────────┐  │
│  │  [Illustration]     │  │  Image area
│  │                     │  │
│  └────────────────────┘  │
│                          │
│  CATEGORY TAG            │  Tag pill
│  Post Headline Here      │  H4
│  Short excerpt text...   │  Body-sm
│  12 Feb 2026             │  Caption
└──────────────────────────┘
```

### Properties

| Property | Value |
|----------|-------|
| Background | `var(--color-white)` |
| Border | `1px solid var(--color-border)` |
| Border radius | `var(--radius-lg)` |
| Overflow | `hidden` (for image) |
| Shadow (default) | None or `var(--shadow-sm)` |
| Shadow (hover) | `var(--shadow-lg)` |
| Transform (hover) | `translateY(-4px)` |
| Transition | All `var(--duration-normal)` |
| Cursor | Pointer (entire card is clickable) |

### Image Area

| Property | Value |
|----------|-------|
| Aspect ratio | `16 / 9` |
| Object fit | `cover` |
| Background | `var(--color-primary-light)` / `#F6F9FC` (placeholder while loading) |

### Text Area

| Property | Value |
|----------|-------|
| Padding | `var(--space-6)` / `24px` |
| Category tag | Pill style — `var(--text-caption)`, `var(--font-medium)`, `var(--color-cta)` / `#0048E5`, `background: var(--color-primary-50)` / `#EBEEF8`, `padding: 4px 12px`, `border-radius: var(--radius-full)` |
| Headline | `var(--text-h4)`, `var(--font-medium)`, `var(--color-primary-dark)` / `#0A2540` |
| Excerpt | `var(--text-body-sm)`, `var(--color-text-body)` / `#425466`, max 2 lines (`-webkit-line-clamp: 2`) |
| Date | `var(--text-caption)`, `var(--color-text-muted)` / `#aab7c4` |
| Gaps | Tag → headline: `var(--space-3)`, headline → excerpt: `var(--space-2)`, excerpt → date: `var(--space-4)` |

---

## 11. CTA Section

Used in Section 10 (Bottom CTA).

### Properties

| Property | Value |
|----------|-------|
| Background | `var(--gradient-cta)` or `var(--color-navy)` / `#0A2540` |
| Padding | `var(--space-28)` / `120px` vertical |
| Text align | Center |
| Headline | `var(--text-h1)`, `var(--color-white)`, `var(--font-medium)` / `500` |
| Description | `var(--text-body-lg)`, `rgba(255,255,255,0.7)`, `max-width: 560px`, centered |
| Gap: headline → description | `var(--space-6)` |
| Gap: description → buttons | `var(--space-8)` |
| Button row | Flex, center, `gap: 16px` |
| Primary CTA | Large white button (`background: white`, `color: var(--color-cta)`) |
| Secondary CTA | Ghost button or white text link |

---

## 12. Form Elements

### Text Input

| Property | Value |
|----------|-------|
| Height | `48px` |
| Background | `var(--color-white)` |
| Border | `1px solid var(--color-gray-300)` / `#c4cdd6` |
| Border (focus) | `1px solid var(--color-cta)` / `#0048E5` |
| Box shadow (focus) | `var(--shadow-input)` / `0px 3px 10px rgba(18, 42, 66, 0.08)` |
| Border radius | `var(--radius-sm)` / `6px` |
| Padding | `12px 16px` |
| Font | `var(--text-body)` / `18px`, `var(--font-regular)` / `400` |
| Color | `var(--color-primary-dark)` / `#0A2540` |
| Placeholder | `var(--color-text-muted)` / `#aab7c4` |
| Transition | Border and shadow `var(--duration-fast)` |

### Label

| Property | Value |
|----------|-------|
| Font | `var(--text-body-sm)`, `var(--font-medium)` / `500` |
| Color | `var(--color-primary-dark)` / `#0A2540` |
| Margin bottom | `var(--space-2)` / `8px` |
| Required marker | `*` in `var(--color-error)` |

### Textarea

| Property | Value |
|----------|-------|
| Min height | `120px` |
| Resize | `vertical` |
| All other properties match text input |

### Select

| Property | Value |
|----------|-------|
| Same as text input |
| Custom dropdown arrow | Lucide `chevron-down` icon, `var(--color-text-muted)` |

### Phone Input

| Property | Value |
|----------|-------|
| Country code prefix | `+263` (default), dropdown for others |
| Flag icon | Optional |
| Layout | Prefix + input in flex row |

### Error State

| Property | Value |
|----------|-------|
| Border | `1px solid var(--color-error)` / `#df1b41` |
| Error message | `var(--text-caption)`, `var(--color-error)`, below input |
| Icon | Lucide `alert-circle`, `16px`, `var(--color-error)` |

---

## 13. Footer

### Layout

```
Desktop (4-column grid):
┌──────────┬──────────┬──────────┬──────────┐
│ Products │ Company  │ Connect  │ Legal    │
│ ──────── │ ──────── │ ──────── │ ──────── │
│ Link     │ Link     │ Link     │ Link     │
│ Link     │ Link     │ Link     │ Link     │
│ Link     │          │ Link     │          │
│ Link     │          │          │          │
└──────────┴──────────┴──────────┴──────────┘
│ © 2026 Lynia Finance. Regulated by RBZ.   │
└───────────────────────────────────────────┘
```

### Properties

| Property | Value |
|----------|-------|
| Background | `var(--color-navy)` / `#0A2540` |
| Padding | `var(--space-16)` top, `var(--space-8)` bottom |
| Container | `max-width: var(--container-max)`, centered |
| Logo | White variant, `120px` width, margin-bottom `var(--space-10)` |
| Column title | `var(--text-caption)`, uppercase, `var(--tracking-wide)`, `rgba(255,255,255,0.4)` |
| Column links | `var(--text-body-sm)`, `rgba(255,255,255,0.7)`, hover: `var(--color-white)` |
| Link line height | `var(--space-10)` / `40px` vertical rhythm |
| Grid | 4 columns (desktop), 2 columns (tablet), 1 column (mobile) |
| Divider | `1px solid rgba(255,255,255,0.1)`, `margin: var(--space-10) 0` |
| Copyright | `var(--text-caption)`, `rgba(255,255,255,0.3)` |
| Regulatory | `var(--text-caption)`, `rgba(255,255,255,0.3)` |

---

## 14. WhatsApp Floating Button (FAB)

### Properties

| Property | Value |
|----------|-------|
| Position | Fixed, bottom-right |
| Bottom offset | `24px` |
| Right offset | `24px` |
| Size | `56px` x `56px` |
| Background | `#25D366` (WhatsApp green) |
| Border radius | `var(--radius-full)` (circle) |
| Icon | WhatsApp logo, white, `28px` |
| Shadow | `0 4px 12px rgba(37, 211, 102, 0.4)` |
| Z-index | `var(--z-fab)` (500) |
| Hover | Scale `1.1`, shadow grows |
| Active | Scale `0.95` |
| Transition | All `var(--duration-fast)` |
| Link | `https://wa.me/263...` (WhatsApp deep link) |

### Optional Tooltip

| Property | Value |
|----------|-------|
| Text | "Chat with us" |
| Background | `var(--color-navy)` |
| Color | `var(--color-white)` |
| Font | `var(--text-caption)` |
| Position | Left of FAB, `8px` gap |
| Show | On hover (desktop), first 5 seconds then hide (mobile) |
| Border radius | `var(--radius-md)` |
| Padding | `8px 12px` |

### Mobile Adjustment

| Property | Value |
|----------|-------|
| Bottom offset | `16px` (to avoid overlap with browser UI) |
| Right offset | `16px` |
| Size | `52px` |

---

## 15. Section Label

Reusable overline label used in product sections and other areas.

### Properties

| Property | Value |
|----------|-------|
| Font | `var(--text-overline)` / `13px` |
| Weight | `var(--font-medium)` / `500` |
| Case | Uppercase |
| Letter spacing | `var(--tracking-wider)` / `0.1em` |
| Color (light bg) | `var(--color-cta)` / `#0048E5` |
| Color (dark bg) | `var(--color-primary)` / `#635BFF` |
| Margin bottom | `var(--space-4)` (before headline) |

---

## 16. Section Container

Reusable wrapper for all homepage sections.

### Properties

| Property | Value |
|----------|-------|
| Max width | `var(--container-max)` / `1080px` |
| Padding horizontal | `var(--container-padding)` (mobile) / `var(--container-padding-lg)` (desktop) |
| Padding vertical | `var(--space-28)` / `120px` (desktop) / `var(--space-16)` / `64px` (mobile) |
| Margin | `0 auto` (centered) |

### Background Variants

| Variant | Background |
|---------|-----------|
| White (default) | `var(--color-white)` / `#FFFFFF` |
| Light | `var(--color-gray-100)` / `#F6F9FC` |
| Dark | `var(--color-navy)` / `#0A2540` |
| Gradient | `var(--gradient-stats)` or `var(--gradient-cta)` |

---

## Component Hierarchy (import order for development)

```
1. Design Tokens (CSS custom properties / Tailwind config)
2. Base elements:
   - Buttons
   - Form elements (input, label, select, textarea)
   - Section Label
   - Section Container
3. Compound components:
   - Navigation Bar
   - Product Card
   - Feature Grid Item
   - Stat Card
   - Segment Card
   - Blog Post Card
4. Section-level components:
   - Hero Section
   - Logo Strip
   - Product Deep Dive Section
   - CTA Section
   - Footer
5. Global overlays:
   - WhatsApp Floating Button
   - Mobile Nav Panel
```
