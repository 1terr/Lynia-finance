# Design Tokens — Lynia Finance Landing Page

> Single source of truth for all design primitives.
> Import these tokens into Tailwind config or CSS custom properties.

---

## 1. Color Tokens

### Brand Colors

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--color-primary` | `#0052FF` | `0, 82, 255` | Primary brand blue — buttons, links, accents |
| `--color-primary-dark` | `#003ECB` | `0, 62, 203` | Hover states, active elements |
| `--color-primary-light` | `#E6EEFF` | `230, 238, 255` | Light backgrounds, card fills |
| `--color-primary-50` | `#F0F4FF` | `240, 244, 255` | Subtle tinted backgrounds |

### Neutral Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-navy` | `#0A1628` | Dark sections, dark text, headers |
| `--color-navy-light` | `#132039` | Dark section secondary |
| `--color-black` | `#0A0A0A` | Body text |
| `--color-gray-900` | `#111827` | Primary text |
| `--color-gray-700` | `#374151` | Secondary text |
| `--color-gray-500` | `#6B7280` | Muted text, placeholders |
| `--color-gray-400` | `#9CA3AF` | Disabled text, borders |
| `--color-gray-200` | `#E5E7EB` | Borders, dividers |
| `--color-gray-100` | `#F3F4F6` | Light backgrounds |
| `--color-gray-50` | `#F9FAFB` | Subtle backgrounds |
| `--color-white` | `#FFFFFF` | Backgrounds, text on dark |

### Accent Blues

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-accent-1` | `#3B7BF6` | Secondary buttons, links |
| `--color-accent-2` | `#60A5FA` | Highlights, badges, gradient stops |
| `--color-accent-3` | `#93C5FD` | Subtle accents |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-success` | `#10B981` | Success states, approved |
| `--color-warning` | `#F59E0B` | Warning states, pending |
| `--color-error` | `#EF4444` | Error states, rejected |
| `--color-info` | `#3B82F6` | Info states |

### Gradient Definitions

```css
/* Hero gradient (WebGL canvas colors) */
--gradient-hero: linear-gradient(135deg, #0052FF, #003ECB, #0A1628, #60A5FA);

/* CTA / bottom section gradient */
--gradient-cta: linear-gradient(135deg, #0A1628 0%, #0052FF 100%);

/* Stats section gradient */
--gradient-stats: linear-gradient(135deg, #003ECB 0%, #0052FF 50%, #3B7BF6 100%);

/* Subtle card gradient (hover) */
--gradient-card: linear-gradient(180deg, #F0F4FF 0%, #FFFFFF 100%);
```

---

## 2. Typography

### Font Family

```css
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

Use **Inter** for all text. Load variable weight (400–700) for optimal file size.

### Type Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `--text-display` | `72px` / `4.5rem` | `1.1` | `700` | Hero headline (desktop) |
| `--text-h1` | `56px` / `3.5rem` | `1.15` | `700` | Section headlines (desktop) |
| `--text-h2` | `40px` / `2.5rem` | `1.2` | `600` | Sub-section headlines |
| `--text-h3` | `30px` / `1.875rem` | `1.3` | `600` | Card titles, feature titles |
| `--text-h4` | `24px` / `1.5rem` | `1.35` | `600` | Small headings |
| `--text-h5` | `20px` / `1.25rem` | `1.4` | `600` | Labels, overlines |
| `--text-body-lg` | `20px` / `1.25rem` | `1.6` | `400` | Hero subtext, lead paragraphs |
| `--text-body` | `17px` / `1.0625rem` | `1.65` | `400` | Body copy |
| `--text-body-sm` | `15px` / `0.9375rem` | `1.6` | `400` | Secondary body text |
| `--text-caption` | `13px` / `0.8125rem` | `1.5` | `500` | Labels, tags, overlines |
| `--text-overline` | `13px` / `0.8125rem` | `1.5` | `600` | Section labels (uppercase, tracked) |

### Mobile Type Scale

| Token | Desktop | Mobile | Notes |
|-------|---------|--------|-------|
| `--text-display` | `72px` | `40px` | Hero headline scales down |
| `--text-h1` | `56px` | `32px` | |
| `--text-h2` | `40px` | `28px` | |
| `--text-h3` | `30px` | `24px` | |
| `--text-body-lg` | `20px` | `18px` | |
| `--text-body` | `17px` | `16px` | Minimum 16px for body on mobile |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--font-regular` | `400` | Body text |
| `--font-medium` | `500` | Labels, captions, nav links |
| `--font-semibold` | `600` | Headings, buttons |
| `--font-bold` | `700` | Display text, hero headlines |

### Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--tracking-tight` | `-0.02em` | Display and H1 headings |
| `--tracking-normal` | `0em` | Body text |
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
| `--space-32` | `128px` | Large section padding (desktop) |
| `--space-40` | `160px` | Hero section vertical padding |

### Section Spacing

| Section Type | Desktop | Mobile |
|-------------|---------|--------|
| Between major sections | `128px` (`--space-32`) | `64px` (`--space-16`) |
| Section vertical padding | `96px` (`--space-24`) | `64px` (`--space-16`) |
| Hero vertical padding | `160px` (`--space-40`) | `80px` (`--space-20`) |
| Between elements in section | `48px` (`--space-12`) | `32px` (`--space-8`) |
| Between text blocks | `24px` (`--space-6`) | `16px` (`--space-4`) |

---

## 4. Layout

### Container

| Token | Value | Usage |
|-------|-------|-------|
| `--container-max` | `1280px` | Maximum content width |
| `--container-narrow` | `960px` | Narrow content (blog posts, forms) |
| `--container-wide` | `1440px` | Full-bleed backgrounds with padded inner |
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

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `6px` | Input fields, small elements |
| `--radius-md` | `8px` | Buttons, tags |
| `--radius-lg` | `12px` | Cards, modals |
| `--radius-xl` | `16px` | Large cards, hero illustrations |
| `--radius-2xl` | `24px` | Feature sections, device mockups |
| `--radius-full` | `9999px` | Pills, avatars, circular elements |

---

## 6. Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(10, 22, 40, 0.05)` | Subtle shadow |
| `--shadow-md` | `0 4px 6px -1px rgba(10, 22, 40, 0.07), 0 2px 4px -2px rgba(10, 22, 40, 0.05)` | Cards default |
| `--shadow-lg` | `0 10px 15px -3px rgba(10, 22, 40, 0.08), 0 4px 6px -4px rgba(10, 22, 40, 0.04)` | Cards hover |
| `--shadow-xl` | `0 20px 25px -5px rgba(10, 22, 40, 0.1), 0 8px 10px -6px rgba(10, 22, 40, 0.05)` | Modals, popups |
| `--shadow-inner` | `inset 0 2px 4px rgba(10, 22, 40, 0.05)` | Input fields focus |

---

## 7. Transitions & Timing

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | `150ms` | Micro-interactions (button color) |
| `--duration-normal` | `250ms` | Standard transitions (hover, focus) |
| `--duration-slow` | `400ms` | Complex transitions (card expand) |
| `--duration-slower` | `600ms` | Section entry animations |
| `--easing-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard ease |
| `--easing-in` | `cubic-bezier(0.4, 0, 1, 1)` | Ease in |
| `--easing-out` | `cubic-bezier(0, 0, 0.2, 1)` | Ease out |
| `--easing-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy / playful |

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
| `--bp-sm` | `640px` | Small mobile → large mobile |
| `--bp-md` | `768px` | Mobile → tablet |
| `--bp-lg` | `1024px` | Tablet → desktop |
| `--bp-xl` | `1280px` | Desktop → wide |
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
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0052FF',
          dark: '#003ECB',
          light: '#E6EEFF',
          50: '#F0F4FF',
        },
        navy: {
          DEFAULT: '#0A1628',
          light: '#132039',
        },
        accent: {
          1: '#3B7BF6',
          2: '#60A5FA',
          3: '#93C5FD',
        },
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        display: ['4.5rem', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
        h1: ['3.5rem', { lineHeight: '1.15', fontWeight: '700', letterSpacing: '-0.02em' }],
        h2: ['2.5rem', { lineHeight: '1.2', fontWeight: '600' }],
        h3: ['1.875rem', { lineHeight: '1.3', fontWeight: '600' }],
        h4: ['1.5rem', { lineHeight: '1.35', fontWeight: '600' }],
        'body-lg': ['1.25rem', { lineHeight: '1.6', fontWeight: '400' }],
        body: ['1.0625rem', { lineHeight: '1.65', fontWeight: '400' }],
        'body-sm': ['0.9375rem', { lineHeight: '1.6', fontWeight: '400' }],
        caption: ['0.8125rem', { lineHeight: '1.5', fontWeight: '500' }],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
        34: '8.5rem',
      },
    },
  },
};
```
