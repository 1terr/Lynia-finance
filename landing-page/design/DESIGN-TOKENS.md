# Design Tokens — Lynia Finance Landing Page

> Single source of truth for all design primitives.
> Design language follows [stripe.com](https://stripe.com).
> Import these tokens into Tailwind config or CSS custom properties.

---

## 1. Color Tokens

### Brand Colors (Stripe-derived)

Stripe's palette centers on a deep navy (`#0A2540`) paired with a distinctive
blue-purple accent (`#635BFF`). We adopt the same tonal foundation, swapping
Stripe's purple-leaning accent for a slightly bluer variant that better suits
a financial-inclusion brand while retaining the same refined feel.

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--color-primary` | `#635BFF` | `99, 91, 255` | Brand accent — logo mark, highlights, badges, gradient stops |
| `--color-primary-dark` | `#0A2540` | `10, 37, 64` | Primary dark — headings, dark sections, nav text |
| `--color-cta` | `#0048E5` | `0, 72, 229` | Buttons, links, interactive elements |
| `--color-cta-hover` | `#003ECB` | `0, 62, 203` | Button/link hover state |
| `--color-primary-light` | `#F6F9FC` | `246, 249, 252` | Light section backgrounds |
| `--color-primary-50` | `#EBEEF8` | `235, 238, 248` | Subtle tinted backgrounds, card hover fills |

### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-text-primary` | `#0A2540` | Headlines, primary headings |
| `--color-text-body` | `#425466` | Body copy, paragraph text |
| `--color-text-muted` | `#aab7c4` | Placeholders, timestamps, secondary labels |
| `--color-text-white` | `#FFFFFF` | Text on dark backgrounds |
| `--color-text-white-secondary` | `rgba(255,255,255,0.7)` | Secondary text on dark backgrounds |

### Neutral Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-navy` | `#0A2540` | Dark sections, footer, hero overlay |
| `--color-navy-light` | `#1A3550` | Dark section secondary |
| `--color-slate` | `#425466` | Body text, descriptions |
| `--color-gray-400` | `#aab7c4` | Muted text, disabled states |
| `--color-gray-300` | `#c4cdd6` | Input borders (default) |
| `--color-border` | `#E0E6EB` | Borders, dividers, card outlines |
| `--color-gray-100` | `#F6F9FC` | Light backgrounds (Stripe "Black Squeeze") |
| `--color-gray-50` | `#FBFCFE` | Subtle backgrounds |
| `--color-white` | `#FFFFFF` | Backgrounds, cards |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-success` | `#1DB954` | Success states, approved |
| `--color-warning` | `#F59E0B` | Warning states, pending |
| `--color-error` | `#df1b41` | Error states, rejected (Stripe danger red) |
| `--color-info` | `#0048E5` | Info states |

### Gradient Definitions

```css
/* Hero gradient — WebGL mesh (Stripe-style animated gradient) */
/* These are the color inputs for the WebGL shader, not a CSS gradient */
--gradient-hero-colors: #0A2540, #635BFF, #0048E5, #1A3550;

/* Hero CSS fallback (when WebGL unavailable) */
--gradient-hero: linear-gradient(135deg, #0A2540 0%, #635BFF 50%, #0048E5 100%);

/* CTA / bottom section */
--gradient-cta: linear-gradient(135deg, #0A2540 0%, #1A3550 100%);

/* Stats section — brand accent gradient */
--gradient-stats: linear-gradient(135deg, #0A2540 0%, #635BFF 100%);

/* Subtle card gradient (hover) */
--gradient-card: linear-gradient(180deg, #F6F9FC 0%, #FFFFFF 100%);
```

---

## 2. Typography

### Font Family

```css
--font-primary: 'Inter var', 'Inter', system-ui, -apple-system, sans-serif;
```

Stripe uses **Söhne** (licensed from Klim Type Foundry). **Inter** is the
closest open-source match — geometric, highly legible, variable-weight.
Load the variable font (weights 300–600) for optimal file size.

**Key Stripe typographic characteristic**: headings use **medium weight (500)**,
not bold. Body text uses **light-to-regular weight (300–400)**. This gives
the distinctive refined, confident feel.

### Type Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `--text-display` | `64px` / `4rem` | `1.15` | `500` | Hero headline (desktop) |
| `--text-h1` | `48px` / `3rem` | `1.2` | `500` | Section headlines (desktop) |
| `--text-h2` | `38px` / `2.375rem` | `1.26` | `500` | Sub-section headlines |
| `--text-h3` | `28px` / `1.75rem` | `1.35` | `500` | Card titles, feature titles |
| `--text-h4` | `22px` / `1.375rem` | `1.4` | `500` | Small headings |
| `--text-h5` | `18px` / `1.125rem` | `1.5` | `500` | Labels, overlines |
| `--text-body-lg` | `20px` / `1.25rem` | `1.6` | `400` | Hero subtext, lead paragraphs |
| `--text-body` | `18px` / `1.125rem` | `1.56` | `300` | Body copy (Stripe uses 18px/28px) |
| `--text-body-sm` | `15px` / `0.9375rem` | `1.6` | `400` | Secondary body text, nav links |
| `--text-caption` | `13px` / `0.8125rem` | `1.5` | `500` | Labels, tags, timestamps |
| `--text-overline` | `13px` / `0.8125rem` | `1.5` | `500` | Section labels (uppercase, tracked) |

### Mobile Type Scale

| Token | Desktop | Mobile | Notes |
|-------|---------|--------|-------|
| `--text-display` | `64px` | `36px` | Hero headline scales down |
| `--text-h1` | `48px` | `30px` | |
| `--text-h2` | `38px` | `26px` | |
| `--text-h3` | `28px` | `22px` | |
| `--text-body-lg` | `20px` | `18px` | |
| `--text-body` | `18px` | `16px` | Minimum 16px for body on mobile |

### Font Weights

Stripe's signature is **restrained weight usage**. Headings are medium, not bold.

| Token | Value | Usage |
|-------|-------|-------|
| `--font-light` | `300` | Body text (Stripe default for paragraphs) |
| `--font-regular` | `400` | Secondary text, form inputs |
| `--font-medium` | `500` | Headings, buttons, nav links, labels |
| `--font-semibold` | `600` | Strong emphasis only (used sparingly) |

### Letter Spacing

Stripe uses **zero letter-spacing** on headings (no tight tracking). The
geometric precision of the font provides visual tightness without CSS adjustment.

| Token | Value | Usage |
|-------|-------|-------|
| `--tracking-normal` | `0em` | Headings and body text (default) |
| `--tracking-wide` | `0.05em` | Overline labels (uppercase) |
| `--tracking-wider` | `0.1em` | Product labels (e.g., ASSET FINANCING) |

---

## 3. Spacing Scale

Based on 4px grid. Consistent spacing throughout the site.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Tight inline spacing |
| `--space-2` | `8px` | Icon gaps, tight padding |
| `--space-3` | `12px` | Small padding |
| `--space-4` | `16px` | Standard padding, form fields |
| `--space-5` | `20px` | Medium padding |
| `--space-6` | `24px` | Card padding, element gaps |
| `--space-8` | `32px` | Section inner gaps |
| `--space-10` | `40px` | Component spacing |
| `--space-12` | `48px` | Large component spacing |
| `--space-16` | `64px` | Section gaps (mobile) |
| `--space-20` | `80px` | Section padding (mobile) |
| `--space-24` | `96px` | Section padding (desktop) |
| `--space-28` | `120px` | Stripe-style generous section padding |
| `--space-32` | `128px` | Large section padding (desktop) |

### Section Spacing

Stripe uses generous vertical padding (120px is common). Sections breathe.

| Section Type | Desktop | Mobile |
|-------------|---------|--------|
| Between major sections | `120px` (`--space-28`) | `64px` (`--space-16`) |
| Section vertical padding | `120px` (`--space-28`) | `64px` (`--space-16`) |
| Hero vertical padding | `120px` (`--space-28`) | `80px` (`--space-20`) |
| Between elements in section | `48px` (`--space-12`) | `32px` (`--space-8`) |
| Between text blocks | `24px` (`--space-6`) | `16px` (`--space-4`) |

---

## 4. Layout

### Container

Stripe uses a narrower max-width (~1080px) than many sites, contributing to
the focused, editorial feel.

| Token | Value | Usage |
|-------|-------|-------|
| `--container-max` | `1080px` | Maximum content width |
| `--container-narrow` | `780px` | Narrow content (blog posts, forms) |
| `--container-wide` | `1280px` | Full-bleed backgrounds with padded inner |
| `--container-padding` | `24px` | Horizontal padding (mobile) |
| `--container-padding-lg` | `48px` | Horizontal padding (desktop) |

### Grid

| Token | Value | Usage |
|-------|-------|-------|
| `--grid-columns` | `12` | Standard 12-column grid |
| `--grid-gap` | `24px` | Default column gap (mobile) |
| `--grid-gap-lg` | `32px` | Column gap (desktop) |
| `--grid-gap-xl` | `48px` | Wide column gap |

---

## 5. Border Radius

Stripe uses restrained border radius — mostly `8px` and `12px`. Nothing
overly rounded.

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | `4px` | Small elements, tags |
| `--radius-sm` | `6px` | Input fields |
| `--radius-md` | `8px` | Buttons, default radius |
| `--radius-lg` | `12px` | Cards, modals |
| `--radius-xl` | `16px` | Large cards, hero illustrations |
| `--radius-full` | `9999px` | Pills, avatars, circular elements |

---

## 6. Shadows

Stripe uses subtle, layered shadows — two-layer composites that feel
natural rather than heavy.

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0px 1px 1px rgba(0, 0, 0, 0.03), 0px 3px 6px rgba(18, 42, 66, 0.02)` | Default cards, tabs |
| `--shadow-md` | `0px 2px 4px rgba(0, 0, 0, 0.04), 0px 6px 12px rgba(18, 42, 66, 0.04)` | Elevated cards |
| `--shadow-lg` | `0px 4px 8px rgba(0, 0, 0, 0.04), 0px 12px 24px rgba(18, 42, 66, 0.06)` | Cards hover, dropdowns |
| `--shadow-xl` | `0px 8px 16px rgba(0, 0, 0, 0.06), 0px 24px 48px rgba(18, 42, 66, 0.08)` | Modals, popups |
| `--shadow-input` | `0px 3px 10px rgba(18, 42, 66, 0.08)` | Input fields focus (Stripe flat theme) |

---

## 7. Transitions & Timing

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | `150ms` | Micro-interactions (button color) |
| `--duration-normal` | `200ms` | Standard transitions (hover, focus) |
| `--duration-slow` | `400ms` | Complex transitions (card expand) |
| `--duration-slower` | `600ms` | Section entry animations |
| `--easing-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard ease |
| `--easing-in` | `cubic-bezier(0.4, 0, 1, 1)` | Ease in |
| `--easing-out` | `cubic-bezier(0, 0, 0.2, 1)` | Ease out |

---

## 8. Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-below` | `-1` | Background elements |
| `--z-base` | `0` | Default stacking |
| `--z-above` | `10` | Cards, elevated elements |
| `--z-sticky` | `100` | Sticky nav |
| `--z-overlay` | `200` | Overlays, backdrops |
| `--z-modal` | `300` | Modals |
| `--z-toast` | `400` | Toast notifications |
| `--z-fab` | `500` | WhatsApp floating button |

---

## 9. Breakpoints

| Token | Value | Description |
|-------|-------|-------------|
| `--bp-sm` | `640px` | Small mobile to large mobile |
| `--bp-md` | `768px` | Mobile to tablet |
| `--bp-lg` | `1024px` | Tablet to desktop |
| `--bp-xl` | `1280px` | Desktop to wide |
| `--bp-2xl` | `1536px` | Wide screens |

**Mobile-first approach**: Default styles = mobile. Add `@media (min-width: token)` for larger.

---

## 10. Icon Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--icon-sm` | `16px` | Inline icons, form hints |
| `--icon-md` | `20px` | Navigation, buttons |
| `--icon-lg` | `24px` | Feature lists, cards |
| `--icon-xl` | `32px` | Product card icons |
| `--icon-2xl` | `48px` | Section feature icons |

**Icon library**: Lucide React (tree-shakeable, consistent stroke width).

---

## Tailwind CSS Configuration

These tokens map to a Tailwind config for implementation:

```js
// tailwind.config.js (excerpt)
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#635BFF',  // Stripe "blurple" accent
          dark: '#0A2540',     // Stripe "Downriver" navy
          light: '#F6F9FC',    // Stripe "Black Squeeze"
          50: '#EBEEF8',
        },
        navy: {
          DEFAULT: '#0A2540',
          light: '#1A3550',
        },
        cta: {
          DEFAULT: '#0048E5',  // Button/link blue
          hover: '#003ECB',
        },
        slate: {
          DEFAULT: '#425466',  // Body text
          light: '#aab7c4',    // Muted text
        },
        border: '#E0E6EB',
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        display: ['4rem', { lineHeight: '1.15', fontWeight: '500' }],
        h1: ['3rem', { lineHeight: '1.2', fontWeight: '500' }],
        h2: ['2.375rem', { lineHeight: '1.26', fontWeight: '500' }],
        h3: ['1.75rem', { lineHeight: '1.35', fontWeight: '500' }],
        h4: ['1.375rem', { lineHeight: '1.4', fontWeight: '500' }],
        'body-lg': ['1.25rem', { lineHeight: '1.6', fontWeight: '400' }],
        body: ['1.125rem', { lineHeight: '1.56', fontWeight: '300' }],
        'body-sm': ['0.9375rem', { lineHeight: '1.6', fontWeight: '400' }],
        caption: ['0.8125rem', { lineHeight: '1.5', fontWeight: '500' }],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        sm: '0px 1px 1px rgba(0, 0, 0, 0.03), 0px 3px 6px rgba(18, 42, 66, 0.02)',
        md: '0px 2px 4px rgba(0, 0, 0, 0.04), 0px 6px 12px rgba(18, 42, 66, 0.04)',
        lg: '0px 4px 8px rgba(0, 0, 0, 0.04), 0px 12px 24px rgba(18, 42, 66, 0.06)',
        xl: '0px 8px 16px rgba(0, 0, 0, 0.06), 0px 24px 48px rgba(18, 42, 66, 0.08)',
        input: '0px 3px 10px rgba(18, 42, 66, 0.08)',
      },
      maxWidth: {
        container: '1080px',
        narrow: '780px',
        wide: '1280px',
      },
    },
  },
};
```

---

## Design Language Reference

| Stripe Pattern | Lynia Adaptation |
|---------------|-----------------|
| Navy `#0A2540` as primary dark | Same — used for headings, dark sections, footer |
| Blurple `#635BFF` as accent | Same — brand mark, highlights, gradients |
| CTA blue `#0048E5` for buttons/links | Same — all interactive elements |
| Body text `#425466` (blue-gray) | Same — all paragraph text |
| Light background `#F6F9FC` | Same — alternating section backgrounds |
| Söhne font | Inter (closest open-source equivalent) |
| Heading weight 500 (medium) | Same — refined, not heavy |
| Body weight 300 (light) | Same — elegant readability |
| Layered subtle shadows | Same — `rgba(18, 42, 66, ...)` tint |
| Container ~1080px | Same — focused, editorial layout |
| Generous section padding (120px) | Same — sections breathe |
