# Lynia Finance - UI/UX Design System

> Stripe-inspired design language adapted for African fintech. Premium, trustworthy, and accessible.

---

## Design Philosophy

Stripe's design DNA distilled for Lynia Finance:

1. **Typography-driven hierarchy** - Let type size and weight do the heavy lifting
2. **Deep navy as trust anchor** - Dark backgrounds convey authority and security
3. **Indigo-tinted shadows** - Never pure black; use `rgba(50,50,93,...)` for warmth
4. **Precision micro-interactions** - 250ms transitions, custom easing, subtle transforms
5. **Content-first layout** - Full-width sections with constrained content containers
6. **Restrained visual effects** - Glassmorphism and gradients used sparingly, not decoratively

---

## 1. Color System

### Brand Palette

```css
:root {
  /* --- Primary Brand --- */
  --lynia-navy:         #0A2540;   /* Primary text, dark backgrounds */
  --lynia-navy-light:   #1A3A5C;   /* Hover state for navy */
  --lynia-navy-dark:    #061B31;   /* Deeper navy for emphasis */

  /* --- Accent Colors (Stripe-inspired) --- */
  --lynia-purple:       #635BFF;   /* Primary accent / CTA highlight */
  --lynia-purple-dark:  #533AFD;   /* Links, interactive elements */
  --lynia-purple-light: #9966FF;   /* Secondary purple, badges */

  /* --- Functional Colors --- */
  --lynia-success:      #30D158;   /* Approved, paid, active */
  --lynia-warning:      #FF9F0A;   /* Pending, review, locked */
  --lynia-danger:       #FF453A;   /* Rejected, overdue, failed */
  --lynia-info:         #0A84FF;   /* Informational, links */

  /* --- Surfaces --- */
  --lynia-bg-primary:   #FFFFFF;   /* Main background */
  --lynia-bg-secondary: #F6F9FC;   /* Section backgrounds, alternating rows */
  --lynia-bg-tertiary:  #F0F3F9;   /* Card backgrounds, input backgrounds */
  --lynia-bg-elevated:  #FFFFFF;   /* Elevated cards, modals */

  /* --- Text --- */
  --lynia-text-primary:   #0A2540;   /* Headings, primary content */
  --lynia-text-secondary: #425466;   /* Body text, descriptions */
  --lynia-text-muted:     #6B7C93;   /* Captions, placeholders, metadata */
  --lynia-text-disabled:  #A3ACB9;   /* Disabled states */

  /* --- Borders --- */
  --lynia-border:         #E6EBF1;   /* Default borders */
  --lynia-border-strong:  #D3D9E3;   /* Emphasized borders (tables, dividers) */
  --lynia-border-focus:   rgba(99, 91, 255, 0.4);  /* Focus ring color */

  /* --- Gradients --- */
  --lynia-gradient-brand:    linear-gradient(135deg, #635BFF 0%, #0A84FF 100%);
  --lynia-gradient-hero:     linear-gradient(135deg, #0A2540 0%, #1A3A5C 50%, #533AFD 100%);
  --lynia-gradient-accent:   linear-gradient(90deg, #FF6118, #FB76FA, #533AFD);
  --lynia-gradient-success:  linear-gradient(135deg, #30D158 0%, #34C759 100%);
  --lynia-gradient-surface:  linear-gradient(180deg, #F6F9FC 0%, #FFFFFF 100%);
}
```

### Dark Mode Palette

```css
.dark {
  --lynia-bg-primary:     #0A1628;
  --lynia-bg-secondary:   #0F1D32;
  --lynia-bg-tertiary:    #162844;
  --lynia-bg-elevated:    #1A2F4A;

  --lynia-text-primary:   #F6F9FC;
  --lynia-text-secondary: #A3B8D0;
  --lynia-text-muted:     #6B7C93;

  --lynia-border:         #1E3A5F;
  --lynia-border-strong:  #2A4A6B;

  --lynia-gradient-hero:  linear-gradient(135deg, #0A1628 0%, #162844 50%, #2D1B69 100%);
}
```

### Tailwind Integration

Map these to your existing HSL variable system in `globals.css`:

```css
@layer base {
  :root {
    /* Stripe-inspired mapping */
    --background:            210 20% 100%;        /* #FFFFFF */
    --foreground:            210 50% 15%;          /* #0A2540 */
    --card:                  210 33% 98%;          /* #F6F9FC */
    --card-foreground:       210 50% 15%;          /* #0A2540 */
    --primary:               243 100% 67%;         /* #635BFF */
    --primary-foreground:    0 0% 100%;            /* #FFFFFF */
    --secondary:             210 33% 97%;          /* #F0F3F9 */
    --secondary-foreground:  210 28% 30%;          /* #425466 */
    --muted:                 210 33% 97%;          /* #F0F3F9 */
    --muted-foreground:      210 18% 50%;          /* #6B7C93 */
    --accent:                243 100% 67%;         /* #635BFF */
    --accent-foreground:     0 0% 100%;            /* #FFFFFF */
    --destructive:           1 100% 61%;           /* #FF453A */
    --destructive-foreground: 0 0% 100%;           /* #FFFFFF */
    --border:                214 30% 92%;          /* #E6EBF1 */
    --input:                 214 30% 92%;          /* #E6EBF1 */
    --ring:                  243 100% 67%;         /* #635BFF */
    --radius:                0.5rem;

    /* Extended Stripe tokens */
    --success:               145 100% 50%;         /* #30D158 */
    --success-foreground:    0 0% 100%;
    --warning:               36 100% 52%;          /* #FF9F0A */
    --warning-foreground:    0 0% 100%;
    --info:                  211 100% 50%;         /* #0A84FF */
    --info-foreground:       0 0% 100%;

    /* Navy brand color */
    --navy:                  210 73% 15%;          /* #0A2540 */
    --navy-foreground:       0 0% 100%;
  }

  .dark {
    --background:            215 50% 7%;           /* #0A1628 */
    --foreground:            210 33% 98%;          /* #F6F9FC */
    --card:                  215 45% 10%;          /* #0F1D32 */
    --card-foreground:       210 33% 98%;
    --primary:               243 100% 67%;         /* #635BFF */
    --primary-foreground:    0 0% 100%;
    --secondary:             215 45% 15%;          /* #162844 */
    --secondary-foreground:  210 40% 80%;
    --muted:                 215 45% 15%;
    --muted-foreground:      210 18% 50%;
    --accent:                243 100% 67%;
    --accent-foreground:     0 0% 100%;
    --destructive:           1 100% 61%;
    --destructive-foreground: 0 0% 100%;
    --border:                215 50% 20%;          /* #1E3A5F */
    --input:                 215 50% 20%;
    --ring:                  243 100% 67%;
  }
}
```

Extend `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        // ...existing colors...
        navy: {
          DEFAULT: 'hsl(var(--navy))',
          foreground: 'hsl(var(--navy-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
      },
    },
  },
};
```

---

## 2. Typography

### Font Stack

Use **Inter** as the primary typeface (free, open-source alternative to Stripe's Sohne with similar geometric quality). Import via `next/font/google`.

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Apply: <body className={`${inter.variable} font-sans`}>
```

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
};
```

### Type Scale

Follow Stripe's typography hierarchy with responsive sizing:

| Role | Mobile | Desktop | Weight | Letter Spacing | Line Height | Tailwind Class |
|------|--------|---------|--------|----------------|-------------|----------------|
| **Hero** | 40px | 56px | 700 | -0.04em | 1.1 | `text-hero` |
| **H1** | 34px | 44px | 700 | -0.03em | 1.15 | `text-display` |
| **H2** | 28px | 36px | 600 | -0.02em | 1.2 | `text-title` |
| **H3** | 22px | 26px | 600 | -0.015em | 1.3 | `text-heading` |
| **H4** | 18px | 20px | 600 | -0.01em | 1.4 | `text-subheading` |
| **Body Large** | 18px | 18px | 400 | 0.01em | 1.6 | `text-body-lg` |
| **Body** | 16px | 16px | 400 | 0.01em | 1.6 | `text-body` |
| **Body Small** | 14px | 14px | 400 | 0.01em | 1.5 | `text-body-sm` |
| **Caption** | 13px | 13px | 500 | 0.02em | 1.4 | `text-caption` |
| **Overline** | 12px | 12px | 600 | 0.08em | 1.3 | `text-overline` |

### Tailwind Font Size Config

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontSize: {
        'hero': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '700' }],
        'display': ['2.75rem', { lineHeight: '1.15', letterSpacing: '-0.03em', fontWeight: '700' }],
        'title': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        'heading': ['1.625rem', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' }],
        'subheading': ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', letterSpacing: '0.01em', fontWeight: '400' }],
        'body': ['1rem', { lineHeight: '1.6', letterSpacing: '0.01em', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.01em', fontWeight: '400' }],
        'caption': ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.02em', fontWeight: '500' }],
        'overline': ['0.75rem', { lineHeight: '1.3', letterSpacing: '0.08em', fontWeight: '600' }],
      },
    },
  },
};
```

### Typography Rules

```markdown
1. Headings use tight negative letter-spacing (tighter as size increases)
2. Body text uses subtle positive letter-spacing for readability
3. Overlines are UPPERCASE with wide letter-spacing
4. Never go below 13px for any readable text
5. Use `text-wrap: balance` on headings for clean line breaks
6. Max line length: 65-75 characters for body text (max-w-prose)
7. Financial figures use tabular-nums for aligned columns
```

### Financial Typography

```tsx
// Money: Always use tabular numerals for alignment
<span className="font-semibold tabular-nums">$1,250.00</span>

// Large financial figures
<span className="text-display tabular-nums tracking-tight">$1.4T</span>

// Percentages
<span className="text-heading tabular-nums">24.5%</span>

// Currency with label
<div className="flex items-baseline gap-1">
  <span className="text-caption text-muted-foreground uppercase">USD</span>
  <span className="text-title tabular-nums">1,250.00</span>
</div>
```

---

## 3. Layout System

### Container & Grid

Based on Stripe's 1080px content width with responsive padding:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      maxWidth: {
        'content': '1080px',     /* Primary content container */
        'content-lg': '1264px',  /* Wide content (dashboards) */
        'content-sm': '720px',   /* Narrow content (forms, articles) */
      },
      screens: {
        'xs': '480px',
        'sm': '600px',     /* Stripe mobile breakpoint */
        'md': '900px',     /* Stripe tablet breakpoint */
        'lg': '1080px',
        'xl': '1264px',
        '2xl': '1440px',
      },
    },
  },
};
```

### Spacing Scale (8px base grid)

Stripe uses an 8px base grid. Tailwind's default spacing already aligns well:

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `xxs` | 2px | `0.5` | Micro adjustments |
| `xs` | 4px | `1` | Icon gaps, tight padding |
| `sm` | 8px | `2` | Inline element spacing |
| `md` | 16px | `4` | Component internal padding |
| `lg` | 24px | `6` | Section padding, card padding |
| `xl` | 32px | `8` | Between components |
| `2xl` | 48px | `12` | Section gaps |
| `3xl` | 64px | `16` | Major section breaks |
| `4xl` | 96px | `24` | Hero padding, page sections |
| `5xl` | 128px | `32` | Full section vertical padding |

### Page Layout Patterns

```tsx
{/* Full-width section with constrained content */}
<section className="w-full py-24 bg-background">
  <div className="mx-auto max-w-content px-6 md:px-8">
    {/* Content here */}
  </div>
</section>

{/* Alternating background sections */}
<section className="w-full py-24 bg-secondary">
  <div className="mx-auto max-w-content px-6 md:px-8">
    {/* Content on light gray */}
  </div>
</section>

{/* Dashboard layout (full width, sidebar) */}
<div className="flex h-screen">
  <aside className="w-64 shrink-0 border-r border-border bg-card">
    {/* Sidebar */}
  </aside>
  <main className="flex-1 overflow-y-auto">
    <div className="mx-auto max-w-content-lg px-6 py-8">
      {/* Dashboard content */}
    </div>
  </main>
</div>
```

### Dashboard Grid Patterns

```tsx
{/* Stats row - responsive grid */}
<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
  <StatCard label="Total Disbursed" value="$1.2M" trend="+12%" />
  <StatCard label="Active Loans" value="2,847" trend="+5%" />
  <StatCard label="Repayment Rate" value="94.2%" trend="+1.3%" />
  <StatCard label="Avg Score" value="485" trend="+8" />
</div>

{/* Content + sidebar layout */}
<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
  <div className="lg:col-span-2">{/* Primary content */}</div>
  <div>{/* Sidebar / secondary info */}</div>
</div>

{/* Feature grid (Stripe product grid style) */}
<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
  <FeatureCard />
  <FeatureCard />
  <FeatureCard />
</div>
```

---

## 4. Shadow System

Stripe's signature: **indigo-tinted shadows** using `rgba(50,50,93,...)` instead of pure black.

### Shadow Scale

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      boxShadow: {
        'stripe-xs':  '0 1px 2px rgba(50,50,93,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'stripe-sm':  '0 2px 5px rgba(50,50,93,0.08), 0 1px 3px rgba(0,0,0,0.05)',
        'stripe':     '0 6px 12px rgba(50,50,93,0.10), 0 3px 7px rgba(0,0,0,0.06)',
        'stripe-md':  '0 13px 27px rgba(50,50,93,0.15), 0 8px 16px rgba(0,0,0,0.08)',
        'stripe-lg':  '0 20px 40px rgba(50,50,93,0.18), 0 15px 30px rgba(0,0,0,0.10)',
        'stripe-xl':  '0 30px 60px rgba(50,50,93,0.25), 0 18px 36px rgba(0,0,0,0.12)',

        /* Focus / ring shadow */
        'stripe-focus': '0 0 0 1px rgba(99,91,255,0.3), 0 1px 1px rgba(0,0,0,0.07), 0 0 0 4px rgba(99,91,255,0.15)',

        /* Navigation shadow */
        'stripe-nav': '0 30px 60px -50px rgba(0,0,0,0.10), 0 30px 60px -10px rgba(50,50,93,0.25)',

        /* Dropdown menu shadow */
        'stripe-menu': '0 18px 36px -18px rgba(0,0,0,0.10), 0 30px 45px -30px rgba(50,50,93,0.25)',
      },
    },
  },
};
```

### Shadow Usage Guide

```markdown
stripe-xs    → Table rows on hover, subtle card borders
stripe-sm    → Resting cards, input fields, dropdowns
stripe       → Elevated cards, active states
stripe-md    → Modal dialogs, popovers, floating elements
stripe-lg    → Feature cards on hover, command palette
stripe-xl    → Hero cards, full-page modals
stripe-focus → Focus rings for interactive elements
stripe-nav   → Sticky navigation bar
stripe-menu  → Dropdown menus, select lists
```

### Implementation

```tsx
{/* Card with hover elevation */}
<div className="rounded-lg border border-border bg-card p-6 shadow-stripe-sm
                transition-shadow duration-300 hover:shadow-stripe-md">
  {/* Card content */}
</div>

{/* Navigation bar */}
<nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md shadow-stripe-nav">
  {/* Nav content */}
</nav>

{/* Focus-visible inputs */}
<input className="rounded-md border border-border px-3 py-2
                  focus:border-primary focus:shadow-stripe-focus focus:outline-none" />
```

---

## 5. Animation & Motion

### Core Principles

```markdown
1. Animations serve function, not decoration
2. Default duration: 200-300ms for micro-interactions
3. Always respect prefers-reduced-motion
4. Use GPU-accelerated properties only (transform, opacity)
5. Stagger sequential elements with 50-80ms delays
```

### Easing Curves

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      transitionTimingFunction: {
        'stripe':     'cubic-bezier(0.45, 0.05, 0.55, 0.95)',  /* Standard ease-in-out */
        'stripe-out': 'cubic-bezier(0.215, 0.61, 0.355, 1)',    /* Deceleration (hover) */
        'stripe-in':  'cubic-bezier(0.55, 0.055, 0.675, 0.19)', /* Acceleration (exit) */
        'spring':     'cubic-bezier(0.34, 1.56, 0.64, 1)',      /* Springy overshoot */
      },
      transitionDuration: {
        '250': '250ms',  /* Stripe standard */
        '350': '350ms',  /* Content transitions */
      },
    },
  },
};
```

### Micro-Interactions

```tsx
{/* Button hover - subtle lift + shadow */}
<button className="transform transition-all duration-250 ease-stripe
                   hover:-translate-y-0.5 hover:shadow-stripe-md
                   active:translate-y-0 active:shadow-stripe-sm">
  Get Started
</button>

{/* Link arrow nudge (Stripe signature) */}
<a className="group inline-flex items-center gap-2 font-semibold text-primary">
  Learn more
  <ArrowRight className="h-4 w-4 transition-transform duration-250 ease-stripe-out
                          group-hover:translate-x-1" />
</a>

{/* Card hover elevation */}
<div className="transition-all duration-300 ease-stripe-out
                hover:-translate-y-1 hover:shadow-stripe-lg">
  {/* Card */}
</div>

{/* Scale on press (buttons, clickable cards) */}
<button className="transition-transform duration-150 ease-stripe
                   active:scale-[0.98]">
  Submit
</button>
```

### Tailwind Animation Keyframes

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-down': {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in':        'fade-in 0.4s ease-out',
        'fade-up':        'fade-up 0.5s cubic-bezier(0.45,0.05,0.55,0.95)',
        'fade-down':      'fade-down 0.5s cubic-bezier(0.45,0.05,0.55,0.95)',
        'slide-in-right': 'slide-in-right 0.4s cubic-bezier(0.215,0.61,0.355,1)',
        'slide-in-left':  'slide-in-left 0.4s cubic-bezier(0.215,0.61,0.355,1)',
        'scale-in':       'scale-in 0.3s cubic-bezier(0.45,0.05,0.55,0.95)',
        'shimmer':        'shimmer 2s linear infinite',
        'gradient-shift': 'gradient-shift 6s ease infinite',
        'count-up':       'count-up 0.6s cubic-bezier(0.215,0.61,0.355,1)',
      },
    },
  },
};
```

### Page Transition Patterns

```tsx
{/* Staggered list animation */}
{items.map((item, i) => (
  <div
    key={item.id}
    className="animate-fade-up"
    style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
  >
    <ItemCard {...item} />
  </div>
))}

{/* Section entrance (use Intersection Observer) */}
<section className="opacity-0 translate-y-4 transition-all duration-700 ease-stripe-out"
         data-animate="true">
  {/* Animate when visible */}
</section>

{/* Modal / Dialog entrance */}
<div className="animate-scale-in">
  <Dialog />
</div>

{/* Dropdown menu */}
<div className="origin-top-right animate-scale-in">
  <DropdownContent />
</div>
```

### Skeleton Loading (Stripe-style shimmer)

```tsx
{/* Skeleton with shimmer effect */}
<div className="animate-shimmer rounded-md bg-gradient-to-r
                from-muted via-muted/50 to-muted
                bg-[length:200%_100%]"
     style={{ height: '20px', width: '60%' }} />

{/* Table skeleton */}
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="h-4 w-24 animate-shimmer rounded bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%]" />
          <div className="h-4 w-40 animate-shimmer rounded bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%]" />
          <div className="h-4 w-20 animate-shimmer rounded bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%]" />
        </div>
      ))}
    </div>
  );
}

{/* Stat card skeleton */}
function StatSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-3">
      <div className="h-3 w-20 animate-shimmer rounded bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%]" />
      <div className="h-8 w-28 animate-shimmer rounded bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%]" />
    </div>
  );
}
```

### Reduced Motion

```css
/* globals.css */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 6. Component Patterns

### Buttons

```tsx
// Button variants following Stripe's hierarchy

// Primary CTA - Navy background (trust anchor)
<button className="inline-flex items-center justify-center rounded-full
                   bg-navy px-6 py-2.5 text-body-sm font-semibold text-white
                   shadow-stripe-sm transition-all duration-250 ease-stripe
                   hover:bg-navy-light hover:-translate-y-0.5 hover:shadow-stripe
                   active:translate-y-0 active:shadow-stripe-xs
                   focus-visible:outline-none focus-visible:shadow-stripe-focus">
  Start Now
</button>

// Secondary CTA - Outlined
<button className="inline-flex items-center justify-center rounded-full
                   border border-border bg-white px-6 py-2.5 text-body-sm
                   font-semibold text-foreground shadow-stripe-xs
                   transition-all duration-250 ease-stripe
                   hover:bg-secondary hover:shadow-stripe-sm
                   focus-visible:outline-none focus-visible:shadow-stripe-focus">
  Contact Sales
</button>

// Accent CTA - Purple gradient
<button className="inline-flex items-center justify-center rounded-full
                   bg-primary px-6 py-2.5 text-body-sm font-semibold text-white
                   shadow-stripe-sm transition-all duration-250 ease-stripe
                   hover:brightness-110 hover:-translate-y-0.5 hover:shadow-stripe
                   active:translate-y-0 active:brightness-95">
  Approve Loan
</button>

// Text/Link button with arrow (Stripe signature)
<button className="group inline-flex items-center gap-2 text-body-sm
                   font-semibold text-primary transition-colors duration-200
                   hover:text-primary/80">
  View details
  <ArrowRight className="h-4 w-4 transition-transform duration-250
                          ease-stripe-out group-hover:translate-x-1" />
</button>

// Destructive
<button className="inline-flex items-center justify-center rounded-full
                   bg-destructive px-6 py-2.5 text-body-sm font-semibold
                   text-white transition-all duration-250 ease-stripe
                   hover:bg-destructive/90">
  Reject Application
</button>

// Ghost / Subtle
<button className="inline-flex items-center justify-center rounded-md
                   px-3 py-1.5 text-body-sm font-medium text-muted-foreground
                   transition-colors duration-200 hover:bg-secondary
                   hover:text-foreground">
  Cancel
</button>
```

### Button Sizing

| Size | Padding | Font | Radius | Usage |
|------|---------|------|--------|-------|
| **sm** | `px-3 py-1.5` | `text-caption` | `rounded-md` | Inline actions, table rows |
| **md** | `px-5 py-2` | `text-body-sm` | `rounded-full` | Standard actions |
| **lg** | `px-6 py-2.5` | `text-body-sm` | `rounded-full` | Primary CTAs, hero buttons |
| **xl** | `px-8 py-3` | `text-body` | `rounded-full` | Landing page hero CTAs |

### Cards

```tsx
{/* Standard card */}
<div className="rounded-lg border border-border bg-card p-6
                shadow-stripe-xs transition-shadow duration-300
                hover:shadow-stripe-sm">
  <h3 className="text-subheading text-foreground">Card Title</h3>
  <p className="mt-2 text-body-sm text-muted-foreground">Description</p>
</div>

{/* Feature card with accent top border (Stripe style) */}
<div className="group overflow-hidden rounded-lg border border-border bg-card
                shadow-stripe-sm transition-all duration-300 ease-stripe-out
                hover:-translate-y-1 hover:shadow-stripe-md">
  {/* Gradient top accent */}
  <div className="h-1 w-full bg-gradient-to-r from-primary to-info" />
  <div className="p-6">
    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg
                    bg-primary/10 text-primary">
      <CreditCard className="h-5 w-5" />
    </div>
    <h3 className="text-subheading text-foreground">Loan Management</h3>
    <p className="mt-2 text-body-sm text-muted-foreground">
      Process applications, manage disbursements, and track repayments.
    </p>
    <div className="mt-4">
      <span className="group/link inline-flex items-center gap-1.5 text-body-sm
                        font-semibold text-primary">
        Learn more
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-250
                                ease-stripe-out group-hover/link:translate-x-1" />
      </span>
    </div>
  </div>
</div>

{/* Stat card (dashboard) */}
<div className="rounded-lg border border-border bg-card p-6 shadow-stripe-xs">
  <p className="text-caption text-muted-foreground uppercase tracking-wider">
    Total Disbursed
  </p>
  <div className="mt-2 flex items-baseline gap-2">
    <span className="text-display tabular-nums text-foreground">$1.2M</span>
    <span className="inline-flex items-center rounded-full bg-success/10
                     px-2 py-0.5 text-caption font-medium text-success">
      +12.5%
    </span>
  </div>
  <p className="mt-1 text-caption text-muted-foreground">vs last month</p>
</div>

{/* Elevated card (modals, floating panels) */}
<div className="rounded-xl bg-card p-8 shadow-stripe-lg">
  {/* High-elevation content */}
</div>
```

### Navigation

```tsx
{/* Stripe-style sticky nav with backdrop blur */}
<header className="sticky top-0 z-50 w-full border-b border-border/50
                   bg-background/80 backdrop-blur-lg">
  <div className="mx-auto flex h-16 max-w-content-lg items-center
                  justify-between px-6">
    {/* Logo */}
    <div className="flex items-center gap-8">
      <Logo className="h-8" />

      {/* Nav links */}
      <nav className="hidden items-center gap-1 md:flex">
        <NavLink>Dashboard</NavLink>
        <NavLink>Loans</NavLink>
        <NavLink>Customers</NavLink>
        <NavLink>Payments</NavLink>
      </nav>
    </div>

    {/* Right side */}
    <div className="flex items-center gap-3">
      <button className="rounded-md p-2 text-muted-foreground
                         transition-colors hover:text-foreground">
        <Bell className="h-5 w-5" />
      </button>
      <UserMenu />
    </div>
  </div>
</header>

{/* Nav link component */}
function NavLink({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <a className={cn(
      "rounded-md px-3 py-2 text-body-sm font-medium transition-colors duration-200",
      active
        ? "bg-secondary text-foreground"
        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
    )}>
      {children}
    </a>
  );
}
```

### Sidebar Navigation (Dashboard)

```tsx
<aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
  {/* Logo */}
  <div className="flex h-16 items-center border-b border-border px-6">
    <Logo className="h-7" />
  </div>

  {/* Nav sections */}
  <nav className="flex-1 overflow-y-auto px-3 py-4">
    <div className="space-y-1">
      <p className="mb-2 px-3 text-overline text-muted-foreground uppercase">
        Overview
      </p>
      <SidebarLink icon={LayoutDashboard} active>Dashboard</SidebarLink>
      <SidebarLink icon={TrendingUp}>Analytics</SidebarLink>
    </div>

    <div className="mt-6 space-y-1">
      <p className="mb-2 px-3 text-overline text-muted-foreground uppercase">
        Lending
      </p>
      <SidebarLink icon={FileText}>Applications</SidebarLink>
      <SidebarLink icon={DollarSign}>Disbursements</SidebarLink>
      <SidebarLink icon={RotateCcw}>Repayments</SidebarLink>
    </div>
  </nav>

  {/* User section at bottom */}
  <div className="border-t border-border p-4">
    <UserCard />
  </div>
</aside>

{/* Sidebar link */}
function SidebarLink({ icon: Icon, children, active }: SidebarLinkProps) {
  return (
    <a className={cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-body-sm font-medium",
      "transition-colors duration-200",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
    )}>
      <Icon className="h-4.5 w-4.5 shrink-0" />
      {children}
    </a>
  );
}
```

### Forms & Inputs

```tsx
{/* Standard input (Stripe style) */}
<div className="space-y-1.5">
  <label className="text-body-sm font-medium text-foreground">
    Phone Number
  </label>
  <input
    type="tel"
    placeholder="+263 7XX XXX XXX"
    className="h-10 w-full rounded-md border border-border bg-background
               px-3 text-body-sm text-foreground placeholder:text-muted-foreground
               transition-all duration-200
               focus:border-primary focus:shadow-stripe-focus focus:outline-none
               disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50"
  />
  <p className="text-caption text-muted-foreground">
    Include country code (+263)
  </p>
</div>

{/* Select dropdown */}
<select className="h-10 w-full rounded-md border border-border bg-background
                   px-3 text-body-sm text-foreground
                   transition-all duration-200
                   focus:border-primary focus:shadow-stripe-focus focus:outline-none
                   appearance-none bg-[url('data:image/svg+xml,...')] bg-no-repeat
                   bg-[right_12px_center] bg-[length:16px]">
  <option>Select currency</option>
  <option>USD - US Dollar</option>
  <option>ZWL - Zimbabwe Dollar</option>
</select>

{/* Search input with icon */}
<div className="relative">
  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2
                     text-muted-foreground" />
  <input
    type="search"
    placeholder="Search customers..."
    className="h-10 w-full rounded-md border border-border bg-background
               pl-9 pr-3 text-body-sm
               focus:border-primary focus:shadow-stripe-focus focus:outline-none"
  />
</div>
```

### Tables (Dashboard)

```tsx
{/* Stripe-style data table */}
<div className="rounded-lg border border-border bg-card shadow-stripe-xs overflow-hidden">
  {/* Table header */}
  <div className="border-b border-border bg-secondary/50 px-6 py-3">
    <div className="flex items-center justify-between">
      <h3 className="text-body-sm font-semibold text-foreground">
        Recent Applications
      </h3>
      <button className="text-body-sm font-medium text-primary">View all</button>
    </div>
  </div>

  <table className="w-full">
    <thead>
      <tr className="border-b border-border">
        <th className="px-6 py-3 text-left text-caption font-semibold
                       text-muted-foreground uppercase tracking-wider">
          Customer
        </th>
        <th className="px-6 py-3 text-left text-caption font-semibold
                       text-muted-foreground uppercase tracking-wider">
          Amount
        </th>
        <th className="px-6 py-3 text-left text-caption font-semibold
                       text-muted-foreground uppercase tracking-wider">
          Status
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-border">
      <tr className="transition-colors duration-150 hover:bg-secondary/30">
        <td className="px-6 py-4 text-body-sm font-medium text-foreground">
          Tendai Moyo
        </td>
        <td className="px-6 py-4 text-body-sm tabular-nums text-foreground">
          $500.00
        </td>
        <td className="px-6 py-4">
          <StatusBadge status="approved" />
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Status Badges

```tsx
{/* Fintech status system */}
const statusStyles = {
  pending:   'bg-warning/10 text-warning border-warning/20',
  approved:  'bg-success/10 text-success border-success/20',
  rejected:  'bg-destructive/10 text-destructive border-destructive/20',
  locked:    'bg-orange-500/10 text-orange-600 border-orange-500/20',
  active:    'bg-success/10 text-success border-success/20',
  overdue:   'bg-destructive/10 text-destructive border-destructive/20',
  disbursed: 'bg-info/10 text-info border-info/20',
  review:    'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

function StatusBadge({ status }: { status: keyof typeof statusStyles }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5",
      "text-caption font-medium capitalize",
      statusStyles[status]
    )}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
```

### Modals / Dialogs

```tsx
{/* Backdrop */}
<div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm
                animate-fade-in" />

{/* Modal */}
<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div className="w-full max-w-lg rounded-xl bg-card p-0
                  shadow-stripe-xl animate-scale-in">
    {/* Header */}
    <div className="flex items-center justify-between border-b border-border px-6 py-4">
      <h2 className="text-subheading text-foreground">Approve Loan</h2>
      <button className="rounded-md p-1.5 text-muted-foreground
                         transition-colors hover:bg-secondary hover:text-foreground">
        <X className="h-5 w-5" />
      </button>
    </div>

    {/* Body */}
    <div className="px-6 py-6">
      {/* Content */}
    </div>

    {/* Footer */}
    <div className="flex items-center justify-end gap-3 border-t
                    border-border px-6 py-4">
      <button className="rounded-full border border-border px-5 py-2
                         text-body-sm font-medium">
        Cancel
      </button>
      <button className="rounded-full bg-primary px-5 py-2
                         text-body-sm font-semibold text-white">
        Confirm Approval
      </button>
    </div>
  </div>
</div>
```

### Toast / Notifications

```tsx
{/* Success toast */}
<div className="pointer-events-auto flex items-center gap-3 rounded-lg
                border border-border bg-card px-4 py-3
                shadow-stripe-md animate-slide-in-right">
  <div className="flex h-8 w-8 items-center justify-center rounded-full
                  bg-success/10">
    <Check className="h-4 w-4 text-success" />
  </div>
  <div>
    <p className="text-body-sm font-semibold text-foreground">
      Loan Approved
    </p>
    <p className="text-caption text-muted-foreground">
      $500.00 disbursement initiated
    </p>
  </div>
</div>
```

---

## 7. Visual Effects

### Gradient Backgrounds

```tsx
{/* Hero section with Stripe-style gradient */}
<section className="relative overflow-hidden bg-navy py-32">
  {/* Gradient mesh (CSS approximation of Stripe's WebGL effect) */}
  <div className="absolute inset-0 opacity-40">
    <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px]
                    rounded-full bg-purple-500 blur-[128px]" />
    <div className="absolute -right-1/4 top-1/4 h-[500px] w-[500px]
                    rounded-full bg-blue-500 blur-[128px]" />
    <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px]
                    rounded-full bg-pink-500 blur-[128px]" />
  </div>

  {/* Content */}
  <div className="relative mx-auto max-w-content px-6 text-center">
    <h1 className="text-hero text-white">
      Financial Inclusion<br />for Zimbabwe
    </h1>
    <p className="mx-auto mt-6 max-w-lg text-body-lg text-white/70">
      Empowering the 80% underbanked with accessible credit,
      digital payments, and smart device financing.
    </p>
  </div>
</section>

{/* Animated gradient border (Stripe accent line) */}
<div className="h-1 w-full animate-gradient-shift
                bg-gradient-to-r from-[#FF6118] via-[#FB76FA] to-[#533AFD]
                bg-[length:200%_100%]" />

{/* Glassmorphic card */}
<div className="rounded-xl border border-white/10 bg-white/5
                p-6 shadow-stripe-lg backdrop-blur-xl">
  {/* Content over gradient background */}
</div>
```

### Frosted Glass Navigation

```tsx
<nav className="sticky top-0 z-50 border-b border-border/40
                bg-background/70 backdrop-blur-xl backdrop-saturate-150">
  {/* Transparent with blur - reveals content behind */}
</nav>
```

### Gradient Text

```tsx
<h2 className="bg-gradient-to-r from-primary via-purple-400 to-info
               bg-clip-text text-display text-transparent">
  Smart Credit Scoring
</h2>
```

### Dot Grid Background

```css
/* Subtle dot grid (Stripe docs style) */
.dot-grid {
  background-image: radial-gradient(circle, #E6EBF1 1px, transparent 1px);
  background-size: 24px 24px;
}
```

---

## 8. Data Visualization Style

### Chart Color Palette

```typescript
const chartColors = {
  primary:   '#635BFF',  // Main data series
  secondary: '#0A84FF',  // Second series
  tertiary:  '#30D158',  // Third series
  quaternary:'#FF9F0A',  // Fourth series
  danger:    '#FF453A',  // Negative/alert data

  // Softer variants for area fills
  primaryFill:   'rgba(99, 91, 255, 0.1)',
  secondaryFill: 'rgba(10, 132, 255, 0.1)',
  successFill:   'rgba(48, 209, 88, 0.1)',
};
```

### Recharts Configuration

```tsx
// Consistent chart styling
const chartConfig = {
  // Grid
  cartesianGrid: {
    strokeDasharray: '3 3',
    stroke: '#E6EBF1',
    vertical: false,
  },

  // Axes
  xAxis: {
    axisLine: false,
    tickLine: false,
    tick: { fill: '#6B7C93', fontSize: 13 },
  },

  yAxis: {
    axisLine: false,
    tickLine: false,
    tick: { fill: '#6B7C93', fontSize: 13 },
    width: 60,
  },

  // Tooltip
  tooltip: {
    contentStyle: {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E6EBF1',
      borderRadius: '8px',
      boxShadow: '0 6px 12px rgba(50,50,93,0.10), 0 3px 7px rgba(0,0,0,0.06)',
      padding: '12px 16px',
    },
    labelStyle: { color: '#0A2540', fontWeight: 600, marginBottom: 4 },
    itemStyle: { color: '#425466', fontSize: 14 },
  },
};
```

---

## 9. Responsive Design Rules

### Breakpoint Behavior

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| **Mobile** | < 600px | Single column, stacked cards, hamburger nav, full-width buttons |
| **Tablet** | 600-899px | 2-column grids, collapsible sidebar, inline forms |
| **Desktop** | 900-1079px | 3-column grids, fixed sidebar, expanded tables |
| **Wide** | 1080px+ | Full layout, max-width constrained, comfortable spacing |

### Mobile-First Patterns

```tsx
{/* Responsive stat grid */}
<div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">

{/* Stack on mobile, side-by-side on desktop */}
<div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

{/* Hide on mobile, show on tablet+ */}
<div className="hidden sm:block">

{/* Full width on mobile, auto on desktop */}
<button className="w-full sm:w-auto">

{/* Responsive padding */}
<section className="px-4 py-12 sm:px-6 sm:py-16 md:px-8 md:py-24">

{/* Responsive text */}
<h1 className="text-3xl font-bold sm:text-4xl md:text-hero">
```

---

## 10. Accessibility Standards

### Focus Management

```tsx
{/* All interactive elements MUST have visible focus states */}

{/* Keyboard focus ring (Stripe style) */}
<button className="... focus-visible:outline-none focus-visible:shadow-stripe-focus
                       focus-visible:ring-0">

{/* Skip to main content link */}
<a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4
                            focus:top-4 focus:z-[100] focus:rounded-md
                            focus:bg-primary focus:px-4 focus:py-2
                            focus:text-white focus:shadow-stripe-md">
  Skip to main content
</a>
```

### Color Contrast

```markdown
All text must meet WCAG AA minimums:
- Normal text (< 24px):  4.5:1 contrast ratio minimum
- Large text (>= 24px):  3:1 contrast ratio minimum
- UI components:         3:1 contrast ratio minimum

Validated combinations:
- #0A2540 on #FFFFFF → 15.7:1 ✅ (primary text)
- #425466 on #FFFFFF → 7.1:1  ✅ (secondary text)
- #6B7C93 on #FFFFFF → 4.6:1  ✅ (muted text)
- #FFFFFF on #635BFF → 4.6:1  ✅ (white on purple CTA)
- #FFFFFF on #0A2540 → 15.7:1 ✅ (white on navy CTA)

Never rely on color alone for status — always pair with icons or text labels.
```

### Screen Reader Support

```tsx
{/* Status with both color and text */}
<StatusBadge status="approved" />  // Shows: [green dot] Approved

{/* Financial data with proper labeling */}
<span aria-label="Total disbursed: one million two hundred thousand US dollars">
  $1,200,000.00
</span>

{/* Loading states announced */}
<div role="status" aria-live="polite">
  {isLoading ? 'Loading loan applications...' : `${count} applications found`}
</div>

{/* Data tables with proper headers */}
<table role="table" aria-label="Loan applications">
  <thead>
    <tr>
      <th scope="col">Customer</th>
      <th scope="col">Amount</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
</table>
```

---

## 11. Dark Mode Implementation

### Toggle Component

```tsx
function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="rounded-md p-2 text-muted-foreground transition-colors
                 hover:bg-secondary hover:text-foreground"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  );
}
```

### Dark Mode Rules

```markdown
1. NEVER use hardcoded colors — always use CSS variables / Tailwind semantic tokens
2. Shadows become more subtle in dark mode (reduce opacity by ~40%)
3. Borders become more visible in dark mode (slightly lighter than surface)
4. Status colors remain the same in both modes (green=success, red=danger)
5. Images and charts may need opacity adjustments in dark mode
6. Glass effects: increase blur, reduce background opacity
```

### Dark Mode Shadow Override

```css
.dark {
  --shadow-stripe-sm: 0 2px 5px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.15);
  --shadow-stripe:    0 6px 12px rgba(0,0,0,0.25), 0 3px 7px rgba(0,0,0,0.15);
  --shadow-stripe-md: 0 13px 27px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.2);
}
```

---

## 12. Complete Tailwind Config Extension

Consolidated config to add to your existing `tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // --- Existing color system (keep as-is) ---
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // --- New Stripe-inspired tokens ---
        navy: {
          DEFAULT: '#0A2540',
          light: '#1A3A5C',
          dark: '#061B31',
        },
        success: {
          DEFAULT: 'hsl(var(--success, 145 100% 50%))',
          foreground: 'hsl(var(--success-foreground, 0 0% 100%))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning, 36 100% 52%))',
          foreground: 'hsl(var(--warning-foreground, 0 0% 100%))',
        },
        info: {
          DEFAULT: 'hsl(var(--info, 211 100% 50%))',
          foreground: 'hsl(var(--info-foreground, 0 0% 100%))',
        },
      },

      // --- Typography ---
      fontFamily: {
        sans: ['var(--font-inter)', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'hero':       ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '700' }],
        'display':    ['2.75rem', { lineHeight: '1.15', letterSpacing: '-0.03em', fontWeight: '700' }],
        'title':      ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        'heading':    ['1.625rem', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' }],
        'subheading': ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg':    ['1.125rem', { lineHeight: '1.6', letterSpacing: '0.01em', fontWeight: '400' }],
        'body':       ['1rem', { lineHeight: '1.6', letterSpacing: '0.01em', fontWeight: '400' }],
        'body-sm':    ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.01em', fontWeight: '400' }],
        'caption':    ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.02em', fontWeight: '500' }],
        'overline':   ['0.75rem', { lineHeight: '1.3', letterSpacing: '0.08em', fontWeight: '600' }],
      },

      // --- Layout ---
      maxWidth: {
        'content': '1080px',
        'content-lg': '1264px',
        'content-sm': '720px',
      },
      screens: {
        'xs': '480px',
      },

      // --- Border Radius ---
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      // --- Shadows (Stripe indigo-tinted) ---
      boxShadow: {
        'stripe-xs':    '0 1px 2px rgba(50,50,93,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'stripe-sm':    '0 2px 5px rgba(50,50,93,0.08), 0 1px 3px rgba(0,0,0,0.05)',
        'stripe':       '0 6px 12px rgba(50,50,93,0.10), 0 3px 7px rgba(0,0,0,0.06)',
        'stripe-md':    '0 13px 27px rgba(50,50,93,0.15), 0 8px 16px rgba(0,0,0,0.08)',
        'stripe-lg':    '0 20px 40px rgba(50,50,93,0.18), 0 15px 30px rgba(0,0,0,0.10)',
        'stripe-xl':    '0 30px 60px rgba(50,50,93,0.25), 0 18px 36px rgba(0,0,0,0.12)',
        'stripe-focus': '0 0 0 1px rgba(99,91,255,0.3), 0 1px 1px rgba(0,0,0,0.07), 0 0 0 4px rgba(99,91,255,0.15)',
        'stripe-nav':   '0 30px 60px -50px rgba(0,0,0,0.10), 0 30px 60px -10px rgba(50,50,93,0.25)',
        'stripe-menu':  '0 18px 36px -18px rgba(0,0,0,0.10), 0 30px 45px -30px rgba(50,50,93,0.25)',
      },

      // --- Animations ---
      transitionTimingFunction: {
        'stripe':     'cubic-bezier(0.45, 0.05, 0.55, 0.95)',
        'stripe-out': 'cubic-bezier(0.215, 0.61, 0.355, 1)',
        'stripe-in':  'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
        'spring':     'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-down': {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in':        'fade-in 0.4s ease-out',
        'fade-up':        'fade-up 0.5s cubic-bezier(0.45,0.05,0.55,0.95)',
        'fade-down':      'fade-down 0.5s cubic-bezier(0.45,0.05,0.55,0.95)',
        'slide-in-right': 'slide-in-right 0.4s cubic-bezier(0.215,0.61,0.355,1)',
        'slide-in-left':  'slide-in-left 0.4s cubic-bezier(0.215,0.61,0.355,1)',
        'scale-in':       'scale-in 0.3s cubic-bezier(0.45,0.05,0.55,0.95)',
        'shimmer':        'shimmer 2s linear infinite',
        'gradient-shift': 'gradient-shift 6s ease infinite',
        'count-up':       'count-up 0.6s cubic-bezier(0.215,0.61,0.355,1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

---

## Quick Reference Card

### Do's

- Use `shadow-stripe-*` instead of default Tailwind shadows
- Use `ease-stripe` / `ease-stripe-out` for all transitions
- Use `duration-250` as the default transition duration
- Use `tabular-nums` for all financial figures
- Use `rounded-full` for primary/secondary CTAs
- Use `backdrop-blur-lg` for glassmorphic navigation
- Use the arrow-nudge pattern (`group-hover:translate-x-1`) for link buttons
- Use `text-wrap: balance` on headings
- Always pair status colors with text labels or icons

### Don'ts

- Never use pure black shadows (`rgba(0,0,0,...)` alone)
- Never use animation without `prefers-reduced-motion` support
- Never go below 13px font size for readable text
- Never hardcode colors — always use CSS variables / Tailwind tokens
- Never use more than 2 font weights on a single component
- Never rely on color alone to convey meaning
- Never animate layout properties (`width`, `height`, `top`, `left`)
- Never exceed 300ms for micro-interactions (buttons, links, hovers)

---

> "Good design is invisible. Great fintech design builds trust before the user even reads a word."
