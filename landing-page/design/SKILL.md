# Front-End Skill Guide — Stripe Homepage Design Language

> Implementation reference for developers building the Lynia Finance landing page.
> Maps Stripe's design patterns to our specific tokens, Tailwind config, and component library.
> Read alongside [`DESIGN-TOKENS.md`](./DESIGN-TOKENS.md), [`COMPONENTS.md`](./COMPONENTS.md), and [`ANIMATIONS.md`](./ANIMATIONS.md).

---

## 1. Typography & Hierarchy

Stripe uses **Soehne** (Klim Type Foundry) for marketing. We use **Inter** — the closest open-source equivalent with geometric precision and variable-weight support.

### Font Stack

```css
font-family: 'Inter', system-ui, -apple-system, sans-serif;
```

Tailwind: `font-sans` (configured in `tailwind.config.ts`).

### Heading Weights — The Stripe Signature

Stripe headings use **medium weight (500)**, not bold. This creates a refined, confident feel without heaviness. Body text uses **light weight (300)**.

| Element | Size (Desktop) | Size (Mobile) | Weight | Tailwind Class | Letter Spacing |
|---------|---------------|--------------|--------|---------------|----------------|
| Hero headline | `64px` / `4rem` | `36px` / `2.25rem` | `500` | `text-display` / `text-display-mobile` | `tracking-normal` (0em) |
| Section headline | `48px` / `3rem` | `30px` / `1.875rem` | `500` | `text-h1` / `text-h1-mobile` | `tracking-normal` |
| Sub-section headline | `38px` / `2.375rem` | `26px` / `1.625rem` | `500` | `text-h2` / `text-h2-mobile` | `tracking-normal` |
| Card title | `28px` / `1.75rem` | `22px` / `1.375rem` | `500` | `text-h3` / `text-h3-mobile` | `tracking-normal` |
| Small heading | `22px` / `1.375rem` | — | `500` | `text-h4` | `tracking-normal` |
| Label / overline | `13px` / `0.8125rem` | — | `500` | `text-overline` | `tracking-wider` (0.1em) |
| Hero subtext | `20px` / `1.25rem` | `18px` | `400` | `text-body-lg` | `tracking-normal` |
| Body copy | `18px` / `1.125rem` | `16px` (min) | `300` | `text-body` | `tracking-normal` |
| Secondary text | `15px` / `0.9375rem` | — | `400` | `text-body-sm` | `tracking-normal` |
| Caption / tag | `13px` / `0.8125rem` | — | `500` | `text-caption` | `tracking-normal` |

### Line Heights

Stripe uses generous line heights for a "breathable" feel.

| Element | Line Height | Ratio |
|---------|------------|-------|
| Display heading | `1.15` | Tight — large text needs less leading |
| Section headings | `1.2–1.35` | Compact but readable |
| Body copy (18px) | `1.56` (~28px) | Stripe's standard body rhythm |
| Body large (20px) | `1.6` (32px) | Generous for lead paragraphs |

### Font Smoothing

```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

Applied globally via `body { @apply antialiased; }` in `globals.css`. Maintains that crisp, high-end look on Mac/Retina displays.

### Key Rule

**Zero letter-spacing on headings.** Stripe does not use tight tracking (`-0.02em`) on their current site. The geometric precision of Inter provides visual tightness without CSS adjustment. Only overline labels use `tracking-wider` (0.1em) for uppercase legibility.

---

## 2. The Color System

Stripe's palette is built on perceptual uniformity — each shade step feels equidistant to the human eye.

### Brand Colors

| Token | Hex | Tailwind | Usage |
|-------|-----|---------|-------|
| Primary (Blurple) | `#635BFF` | `bg-primary` / `text-primary` | Brand accent, CTA buttons, links, highlights, badges |
| Primary Dark (Navy) | `#0A2540` | `bg-primary-dark` / `text-primary-dark` | Headings, dark sections, footer, nav text |
| Primary Hover | `#5651E5` | `bg-primary-hover` | Button/link hover state (darkened blurple) |
| Primary Light | `#F6F9FC` | `bg-primary-light` | Light section backgrounds |
| Primary 50 | `#EBEEF8` | `bg-primary-50` | Subtle tinted backgrounds, category pills |

Stripe uses blurple (`#635BFF`) for **both** brand identity and CTA buttons — there is no separate "CTA blue." This unified approach creates strong brand recognition.

### Text Colors

| Token | Hex | Tailwind | Usage |
|-------|-----|---------|-------|
| Primary text | `#0A2540` | `text-primary-dark` | Headlines, primary headings |
| Body text | `#425466` | `text-slate` | Paragraph text, descriptions |
| Muted text | `#ADBDCC` | `text-slate-light` | Placeholders, timestamps, secondary labels |
| White | `#FFFFFF` | `text-white` | Text on dark backgrounds |
| White secondary | `rgba(255,255,255,0.7)` | `text-white/70` | Subtext on dark backgrounds |

### Neutrals

| Token | Hex | Tailwind | Usage |
|-------|-----|---------|-------|
| Border | `#E0E6EB` | `border-border` | Dividers, card outlines |
| Gray 300 | `#c4cdd6` | — | Input borders (default state) |
| Gray 100 | `#F6F9FC` | `bg-primary-light` | Alternating section backgrounds |

### Semantic Colors

| Token | Hex | Tailwind | Usage |
|-------|-----|---------|-------|
| Success | `#1DB954` | `text-success` / `bg-success` | Approved states |
| Warning | `#F59E0B` | `text-warning` / `bg-warning` | Pending states |
| Error | `#df1b41` | `text-error` / `bg-error` | Rejected states, validation errors |

### Accessibility

All text colors are tested to ensure a **4.5:1 contrast ratio** against their backgrounds:
- `#0A2540` on `#FFFFFF` = 15.4:1 (AAA)
- `#425466` on `#FFFFFF` = 7.1:1 (AAA)
- `#FFFFFF` on `#0A2540` = 15.4:1 (AAA)
- `#635BFF` on `#FFFFFF` = 4.6:1 (AA)

### The Gradient System

Stripe's hero uses an animated "mesh gradient" with 4-8 colors moving via WebGL. Our implementation:

```css
/* CSS fallback (default — all devices) */
--gradient-hero: linear-gradient(135deg, #0A2540 0%, #3a3aff 40%, #635BFF 70%, #6ec3f4 100%);

/* WebGL mesh colors (progressive enhancement on capable devices) */
--gradient-color-zero: #6ec3f4;   /* Light blue */
--gradient-color-one: #3a3aff;    /* Vivid blue */
--gradient-color-two: #ff61ab;    /* Pink */
--gradient-color-three: #E63946;  /* Red */

/* CTA / bottom section */
--gradient-cta: linear-gradient(135deg, #0A2540 0%, #1A3550 100%);

/* Stats section */
--gradient-stats: linear-gradient(135deg, #0A2540 0%, #635BFF 100%);
```

**Rule:** CSS gradient is the default. WebGL is loaded only when `navigator.hardwareConcurrency >= 4`. Our target audience uses low-end devices — performance over polish.

---

## 3. Cards & Container Geometry

Stripe is the master of "The Card." Every card follows the same geometry.

### Card Properties

| Property | Value | Tailwind |
|----------|-------|---------|
| Border radius | `12px` | `rounded-lg` |
| Border | `1px solid #E0E6EB` | `border border-border` |
| Background | `#FFFFFF` | `bg-white` |
| Padding | `32px` | `p-8` |
| Default shadow | `var(--shadow-sm)` | `shadow-sm` |
| Hover shadow | `var(--shadow-lg)` | `hover:shadow-lg` |
| Hover lift | `translateY(-4px)` | `hover:-translate-y-1` |
| Transition | `200ms ease` | `transition-all duration-200` |

### The "Stripe Shadow" — Layered Depth

Instead of one heavy `box-shadow`, Stripe stacks multiple layers. This creates a soft, natural depth that feels like physical paper.

```css
/* Small (default cards) */
box-shadow:
  0px 1px 1px rgba(0, 0, 0, 0.03),
  0px 3px 6px rgba(18, 42, 66, 0.02);

/* Medium (elevated) */
box-shadow:
  0px 2px 4px rgba(0, 0, 0, 0.04),
  0px 6px 12px rgba(18, 42, 66, 0.04);

/* Large (hover state) */
box-shadow:
  0px 4px 8px rgba(0, 0, 0, 0.04),
  0px 12px 24px rgba(18, 42, 66, 0.06);

/* XL (modals, popups) */
box-shadow:
  0px 8px 16px rgba(0, 0, 0, 0.06),
  0px 24px 48px rgba(18, 42, 66, 0.08);
```

**Key detail:** The shadow tint uses `rgba(18, 42, 66, ...)` — a blue-tinted shadow that matches the navy palette, not a generic black. This is pre-configured in `tailwind.config.ts` as `shadow-sm` through `shadow-xl`.

### Card Radius Scale

| Element | Radius | Tailwind |
|---------|--------|---------|
| Small elements, tags | `4px` | `rounded-xs` |
| Input fields | `6px` | `rounded-sm` |
| Buttons | `8px` | `rounded-md` |
| Cards, modals | `12px` | `rounded-lg` |
| Large cards, hero visuals | `16px` | `rounded-xl` |
| Pills, avatars | `9999px` | `rounded-full` |

### Card Borders

Stripe uses extremely subtle borders. Never a hard line:

```css
/* Standard card border */
border: 1px solid #E0E6EB;

/* Even subtler (on white background) */
border: 1px solid rgba(0, 0, 0, 0.08);
```

---

## 4. Design Patterns & UI Components

### The Navigation

Stripe's nav uses a transparent-to-solid scroll transition:

| State | Background | Text Color | Border |
|-------|-----------|------------|--------|
| Top (hero visible) | `transparent` | `white` | `none` |
| Scrolled (>80px) | `rgba(255,255,255,0.95)` | `#425466` | `1px solid #E0E6EB` |

Implementation: `backdrop-filter: blur(12px)` on scroll. Transition: `250ms ease`.

The nav includes a **persistent CTA button** on the right — `"Start your application"` in blurple. This provides a conversion path from any scroll position (critical Stripe pattern).

### Section Backgrounds

Stripe alternates section backgrounds to create visual rhythm:

| Section | Background | Tailwind |
|---------|-----------|---------|
| White (default) | `#FFFFFF` | `bg-white` |
| Light gray | `#F6F9FC` | `bg-primary-light` |
| Dark navy | `#0A2540` | `bg-primary-dark` / `bg-navy` |
| Gradient (stats) | `linear-gradient(...)` | `style={{ background: 'var(--gradient-stats)' }}` |
| Gradient (CTA) | `linear-gradient(...)` | `style={{ background: 'var(--gradient-cta)' }}` |

Our homepage flow: Hero (gradient) → Social Proof (white/light) → Stats (gradient) → Products (white) → Asset Financing (white) → Digital Credit (dark) → Enterprise (light) → Segments (white) → Editorial (light) → Bottom CTA (dark/gradient) → Footer (dark).

### Section Labels (Overlines)

Every product section starts with an uppercase overline label:

```tsx
<span className="text-overline uppercase tracking-wider text-primary">
  ASSET FINANCING
</span>
```

### Product Deep Dive — Split Layout

Stripe's product sections use asymmetric 2-column grids (text + visual):

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
  <div>{/* Text column: label, headline, description, features, CTAs */}</div>
  <div>{/* Visual column: illustration or mockup */}</div>
</div>
```

Alternate layout direction per section:
- Asset Financing: text left, visual right
- Digital Credit: visual left, text right (reverse with `lg:order-first` on visual)
- Enterprise: text left, visual right

### Form Elements

Stripe's form inputs use a flat style with subtle focus transitions:

| State | Border | Shadow |
|-------|--------|--------|
| Default | `1px solid #c4cdd6` | `none` |
| Focus | `1px solid #635BFF` | `0px 3px 10px rgba(18, 42, 66, 0.08)` |
| Error | `1px solid #df1b41` | `none` |

Input height: `48px`. Border radius: `6px` (`rounded-sm`). Font: `18px` / `400`.

### Empty States & Icons

Use **Lucide React** for all icons — tree-shakeable, consistent stroke width.

| Property | Value |
|----------|-------|
| Stroke width | `1.5px` or `2px` |
| Default size | `24px` (`var(--icon-lg)`) |
| Color | `#635BFF` (blurple) for feature icons |
| Style | Monoline, geometric — matches Inter's aesthetic |

For illustrations, use flat SVGs with subtle gradients rather than flat single-color icons. This elevates the visual quality without adding weight.

---

## 5. Motion & Animations

Stripe's animations follow a **"Natural and Functional"** philosophy. Motion serves a purpose — guide attention, confirm interaction, create polish. Never decorative.

### Interaction States

| Component | Hover Effect | Duration | Easing |
|-----------|-------------|----------|--------|
| Cards | `translateY(-4px)` + shadow deepens to `shadow-lg` | `200ms` | `ease` (`cubic-bezier(0.4, 0, 0.2, 1)`) |
| Primary button | Background `#635BFF` → `#5651E5`, shadow appears | `150ms` | `ease` |
| Secondary link | Color darkens, arrow shifts right `4px` | `150ms` | `ease` |
| Ghost button | `background: rgba(255,255,255,0.1)`, border brightens | `150ms` | `ease` |
| Active/press | `scale(0.98)`, shadow reduces | `100ms` | `ease` |

### Scroll-Triggered Reveals

Content fades in as the user scrolls, using Intersection Observer:

```typescript
// Trigger at 15% visibility, 50px before entering viewport
const observer = new IntersectionObserver(callback, {
  threshold: 0.15,
  rootMargin: '0px 0px -50px 0px'
});
```

| Animation | CSS | Duration | Easing |
|-----------|-----|----------|--------|
| Fade up (sections) | `opacity: 0→1`, `translateY: 24px→0` | `600ms` | `cubic-bezier(0, 0, 0.2, 1)` |
| Fade up (cards, staggered) | `opacity: 0→1`, `translateY: 32px→0` | `500ms` + `100ms` stagger | `cubic-bezier(0, 0, 0.2, 1)` |
| Slide in (visuals) | `opacity: 0→1`, `translateX: ±40px→0` | `700ms` | `cubic-bezier(0, 0, 0.2, 1)` |

Pre-configured in Tailwind:
- `animate-fade-in-up` — `600ms` fade + translateY
- `animate-fade-in-right` — `700ms` fade + translateX

### Micro-Interactions

| Element | Interaction | Timing |
|---------|------------|--------|
| Button background change | `150ms` transition | Responsive but not jarring |
| Nav scroll state change | `250ms` transition | Background, color, border all shift together |
| Form input focus | `150ms` border + shadow transition | Immediate visual feedback |
| WhatsApp FAB hover | `scale(1.1)` + shadow grows, `150ms` | Inviting tap target |

### Persistent Animations

| Animation | Properties | Duration | Note |
|-----------|-----------|----------|------|
| Hero phone float | `translateY(0 → -8px → 0)` | `4s` infinite | Pause when hero is not visible |
| Hero gradient (WebGL) | Organic color mesh movement | Continuous at `0.3` speed | Only on capable devices |
| Skeleton shimmer | `background-position` sweep | `1.5s` infinite | For loading states |

### Reduced Motion

**All animations must respect `prefers-reduced-motion: reduce`:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Already configured in `globals.css`. When reduced motion is active:
- Hero gradient: static CSS gradient only
- Phone mockup: no float animation
- Scroll reveals: elements visible immediately
- Count-up stats: show final numbers immediately
- Card hover: color change only, no `translateY`

---

## 6. Layout & Spacing

### The Container

Stripe uses a narrower max-width (~1080px) than most sites. This creates a focused, editorial feel where the eye doesn't have to scan wide.

| Container | Width | Tailwind | Usage |
|-----------|-------|---------|-------|
| Main | `1080px` | `max-w-container` | All section content |
| Narrow | `780px` | `max-w-narrow` | Blog posts, forms |
| Wide | `1280px` | `max-w-wide` | Nav bar, full-bleed inner padding |

Centering: `mx-auto`. Horizontal padding: `px-6 lg:px-12`.

Utility classes (defined in `globals.css`):
- `.container-main` — `mx-auto max-w-container px-6 lg:px-12`
- `.container-wide` — `mx-auto max-w-wide px-6 lg:px-12`

### Whitespace — The Stripe Differentiator

Massive vertical padding between sections prevents information overload. This is what makes Stripe feel "premium."

| Spacing Context | Desktop | Mobile | Tailwind |
|----------------|---------|--------|---------|
| Between major sections | `120px` | `64px` | `py-[120px] lg:py-16` → `.section-padding` |
| Between elements in section | `48px` | `32px` | `gap-12 lg:gap-8` |
| Between text blocks | `24px` | `16px` | `gap-6 lg:gap-4` |
| Card padding | `32px` | `24px` | `p-8 lg:p-6` |
| Grid gap | `32px` | `24px` | `gap-8 lg:gap-6` |

Utility class: `.section-padding` applies `py-16 lg:py-[120px]`.

### Grid System

Standard 12-column grid, often used **asymmetrically**:

```tsx
{/* Equal split for product deep dives */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

{/* 3-column for product cards */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

{/* 4-column for stats */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
```

Default grid gap: `32px` (`gap-8`).

### Breakpoints

| Token | Width | Description |
|-------|-------|-------------|
| `sm` | `640px` | Large mobile |
| `md` | `768px` | Tablet |
| `lg` | `1024px` | Desktop |
| `xl` | `1280px` | Wide desktop |
| `2xl` | `1536px` | Ultrawide |

**Mobile-first approach.** Default styles target mobile. Use `md:`, `lg:`, `xl:` prefixes for larger screens.

---

## 7. Development Checklist

| Feature | Implementation Detail | Tailwind / CSS |
|---------|----------------------|---------------|
| Grid | CSS Grid / Flexbox | `grid`, `flex`, `gap-8` |
| Icons | Lucide React, `stroke-width: 1.5px` or `2px` | `w-6 h-6` (24px default) |
| Buttons | Rounded `8px`, shadow on hover, `font-weight: 500` | `rounded-md`, `hover:shadow-md`, `font-medium` |
| Code blocks | Dark mode by default, monospaced font | SF Mono / system monospace |
| Font smoothing | Antialiased on all text | `antialiased` (applied globally) |
| Card shadows | Layered dual-shadow system | `shadow-sm` through `shadow-xl` |
| Card hover | `translateY(-4px)` + shadow upgrade | `hover:-translate-y-1 hover:shadow-lg transition-all duration-200` |
| Section padding | `120px` desktop / `64px` mobile | `.section-padding` or `py-16 lg:py-[120px]` |
| Container | `1080px` max-width, centered | `.container-main` or `max-w-container mx-auto px-6 lg:px-12` |
| Border radius | `12px` for cards, `8px` for buttons | `rounded-lg`, `rounded-md` |
| Borders | `1px solid #E0E6EB` | `border border-border` |
| Heading weight | `500` (medium), never bold | `font-medium` |
| Body weight | `300` (light) | Applied via `text-body` fontSize config |
| Overline labels | `13px`, `500`, uppercase, `0.1em` tracking | `text-overline uppercase tracking-wider text-primary` |
| Scroll animations | Intersection Observer at 15% threshold | Custom hook: `useScrollAnimation.ts` |
| Reduced motion | Disable all animation/transition | `@media (prefers-reduced-motion: reduce)` in `globals.css` |
| Nav scroll | Transparent → solid white at 80px | JS scroll listener + CSS transition `250ms` |
| Hero gradient | CSS default, WebGL progressive enhancement | `var(--gradient-hero)` in `globals.css` |
| WhatsApp FAB | Fixed bottom-right, `#25D366`, `56px` circle | `fixed bottom-6 right-6 z-fab` |
| z-index | Layered scale: 100 (nav) → 500 (FAB) | `z-sticky`, `z-overlay`, `z-modal`, `z-toast`, `z-fab` |

---

## 8. Component Quick Reference

### Button Variants

```tsx
{/* Primary */}
<button className="bg-primary text-white text-body-sm font-medium px-6 py-3 rounded-md
  hover:bg-primary-hover hover:shadow-md active:scale-[0.98] transition-all duration-150">
  Start your application
</button>

{/* Secondary (text link) */}
<button className="text-primary text-body-sm font-medium flex items-center gap-1
  hover:text-primary-hover transition-colors duration-150">
  Learn more <span className="transition-transform duration-150 hover:translate-x-1">→</span>
</button>

{/* Ghost (on dark backgrounds) */}
<button className="text-white text-body-sm font-medium px-6 py-3 rounded-md
  border border-white/30 hover:bg-white/10 hover:border-white/50 transition-all duration-150">
  Talk to our team
</button>
```

### Card Template

```tsx
<div className="bg-white border border-border rounded-lg p-8 shadow-sm
  hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
  {/* Overline */}
  <span className="text-overline uppercase tracking-wider text-primary">
    ASSET FINANCING
  </span>
  {/* Title */}
  <h3 className="text-h3 font-medium text-primary-dark mt-4">
    Own the tools that power your trade
  </h3>
  {/* Description */}
  <p className="text-body text-slate mt-3">
    Finance smartphones and assets with a small deposit.
  </p>
</div>
```

### Section Template

```tsx
<section className="bg-white">
  <div className="section-padding">
    <div className="container-main">
      {/* Section label */}
      <span className="text-overline uppercase tracking-wider text-primary">
        OUR PRODUCTS
      </span>
      {/* Section headline */}
      <h2 className="text-h1 lg:text-h1-mobile font-medium text-primary-dark mt-4">
        Three products. One mission.
      </h2>
      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
        {/* Cards */}
      </div>
    </div>
  </div>
</section>
```

---

## 9. Common Anti-Patterns to Avoid

| Anti-Pattern | Why It's Wrong | Correct Approach |
|-------------|---------------|-----------------|
| Bold headings (`font-bold` / `700`) | Stripe uses medium (`500`). Bold feels heavy and unsophisticated | `font-medium` on all headings |
| Tight letter-spacing on headings | Stripe uses `0em`. Inter's geometry provides natural tightness | `tracking-normal` (default) |
| Single heavy box-shadow | Looks artificial. Stripe layers two shadows for natural depth | Use the pre-configured `shadow-sm` through `shadow-xl` |
| Generic black shadows | Doesn't match the blue-tinted palette | Shadows use `rgba(18, 42, 66, ...)` — already in Tailwind config |
| Separate "CTA color" | Stripe uses blurple for brand AND CTAs. One accent color | `bg-primary` for all buttons and accents |
| Small section padding | Makes the page feel cramped and cheap | `120px` vertical padding on desktop (`.section-padding`) |
| Narrow container width over `1080px` | Stripe's focused feel comes from constrained content width | `max-w-container` (1080px) |
| Animating `width`, `height`, `top`, `left` | Not GPU-accelerated. Causes jank | Only animate `transform` and `opacity` |
| Heavy WebGL on all devices | Target audience uses $50 Android phones on 2G | CSS gradient default, WebGL only if `hardwareConcurrency >= 4` |
| Flat single-color icons | Feels generic | Lucide with `1.5px` stroke, blurple color, optional subtle gradients on feature illustrations |
| Starting copy with "We" | Stripe never leads with the company. User is the subject | Frame from the customer's perspective |

---

## 10. Performance Budget

Our target audience works on low-end devices over slow connections. Every decision must pass the performance test.

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s on 3G |
| Largest Contentful Paint | < 2.5s on 3G |
| Time to Interactive | < 3.5s on 3G |
| Total initial page weight | < 200KB |
| Lighthouse Performance | > 90 |
| Animation JS bundle | < 5KB gzipped |
| WebGL gradient (if loaded) | < 8KB (lazy) |
| Animation frame rate | 60fps on mid-range devices |

### Optimization Rules

1. CSS animations over JS where possible (zero bundle impact)
2. `will-change: transform, opacity` only on actively animated elements
3. Single shared Intersection Observer instance for all scroll-triggered sections
4. Debounce scroll events to `requestAnimationFrame`
5. Lazy-load WebGL gradient (not needed for FCP/LCP)
6. Inter font: load variable font (weights 300–600) for optimal file size
7. Code-split aggressively — only load what's above the fold initially

---

## 11. File Structure Reference

```
landing-page/frontend/
├── app/
│   ├── layout.tsx              # Root layout with Inter font, global styles
│   ├── page.tsx                # Homepage — assembles all sections
│   ├── about/page.tsx
│   ├── careers/page.tsx
│   ├── contact/page.tsx
│   ├── editorial/page.tsx
│   ├── partnerships/page.tsx
│   ├── privacy/page.tsx
│   ├── products/page.tsx
│   └── terms/page.tsx
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx          # Sticky nav with scroll transition
│   │   ├── Footer.tsx          # 4-column footer on dark navy
│   │   └── WhatsAppFAB.tsx     # Floating action button
│   ├── sections/               # Homepage sections (order matches page)
│   │   ├── Hero.tsx
│   │   ├── SocialProof.tsx
│   │   ├── WhySection.tsx      # Stats on gradient
│   │   ├── ProductSuite.tsx    # 3-card overview grid
│   │   ├── AssetFinancing.tsx  # Split layout
│   │   ├── DigitalCredit.tsx   # Split layout (dark bg)
│   │   ├── Enterprise.tsx      # Split layout
│   │   ├── CustomerSegments.tsx
│   │   ├── Editorial.tsx       # Blog card grid
│   │   └── BottomCTA.tsx       # Dark CTA section
│   └── ui/
│       ├── Button.tsx          # Primary, Secondary, Ghost variants
│       ├── SectionContainer.tsx # Reusable section wrapper
│       ├── SectionLabel.tsx    # Overline label component
│       └── WaitlistForm.tsx    # Lead capture form
├── lib/
│   ├── constants.ts            # Shared constants
│   ├── api.ts                  # API utilities
│   ├── editorial-data.ts       # Editorial content
│   └── useScrollAnimation.ts   # Intersection Observer hook
├── styles/
│   └── globals.css             # CSS custom properties, utilities, reduced motion
├── tailwind.config.ts          # All design tokens mapped to Tailwind
├── next.config.js
└── package.json
```

---

## Quick Summary: The Five Rules of Stripe Design

1. **Medium, not bold.** Headings at weight `500`. Body at `300`. Never `700`.
2. **Breathe.** `120px` between sections. `1080px` max content width. Let whitespace do the work.
3. **Layer shadows.** Two-layer `box-shadow` with blue-tinted `rgba(18, 42, 66, ...)`. Never a single heavy shadow.
4. **Navy + Blurple.** `#0A2540` for authority. `#635BFF` for action. No separate CTA color.
5. **Animate with purpose.** `translateY(-4px)` on hover. Fade-up on scroll. `150ms` for micro-interactions. Respect reduced motion. GPU-only properties.

---

## 12. The Elite Tech Stack

Building a Stripe-level landing page requires more than a component library. It demands hardware-accelerated rendering (WebGL) and layout-aware animations. This is the toolkit mapped to our Next.js + Tailwind codebase.

### Core Stack

| Category | Primary Choice | Elite Alternative | Notes |
|----------|---------------|-------------------|-------|
| Framework | **Next.js 15+ (App Router)** | Remix | We use App Router for RSC + streaming |
| Styling | **Tailwind CSS** | Vanilla Extract (zero-runtime) | Tailwind is configured with all our design tokens |
| Animations | **Framer Motion** | GSAP (complex scroll timelines) | Framer for declarative React; GSAP if we need ScrollTrigger |
| WebGL / Canvas | **Three.js + React Three Fiber** | PixiJS (2D high-performance) | R3F for the mesh gradient; PixiJS if we add 2D particle effects |
| Icons | **Lucide React** (1.5px stroke) | Custom SVG set from Figma | Tree-shakeable, matches Inter's geometric style |
| State / Data | **React Query (TanStack Query)** | SWR | For any API calls on the landing page (waitlist, analytics) |

### Package Installation

```bash
# Core animation + WebGL dependencies
pnpm add framer-motion @react-three/fiber @react-three/drei three

# Types for Three.js
pnpm add -D @types/three

# Optional: GSAP for complex scroll-coupled timelines
pnpm add gsap @gsap/react
```

### Progressive Enhancement Strategy

Our audience includes low-end $50 Android phones on 2G. The elite stack must degrade gracefully:

```
Layer 0 (all devices):   Static HTML + CSS gradients + Tailwind utilities
Layer 1 (JS enabled):    Framer Motion entrance animations + Intersection Observer
Layer 2 (mid-range):     Framer Motion scroll-coupled transforms (useScroll/useTransform)
Layer 3 (high-end only): WebGL mesh gradient via React Three Fiber
```

Detection logic:

```typescript
const canRunWebGL = (): boolean => {
  if (typeof window === 'undefined') return false;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const cores = navigator.hardwareConcurrency || 2;
  return !!gl && cores >= 4;
};
```

---

## 13. WebGL Mesh Gradient (The Stripe Background)

Stripe's hero background is not a video or CSS gradient — it is a live WebGL shader called "MiniGL." We replicate this with React Three Fiber and a custom fragment shader.

### Architecture

```
HeroSection.tsx
├── HeroGradientCanvas.tsx      ← React Three Fiber <Canvas>
│   └── MeshGradientShader.tsx  ← Custom shader material
├── HeroContent.tsx             ← Text overlay (z-indexed above canvas)
└── CSS fallback gradient       ← var(--gradient-hero) for non-WebGL devices
```

### Implementation: The Fragment Shader

The gradient uses a fragment shader that blends 3-4 colors based on `uTime` and UV coordinates, creating organic movement.

```tsx
// components/webgl/MeshGradientShader.tsx
'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  varying vec2 vUv;

  // Simplex-style noise for organic movement
  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.3; // Speed factor — keep slow for elegance

    // Create flowing distortion
    float n1 = sin(uv.x * 3.0 + t) * cos(uv.y * 2.0 + t * 0.7);
    float n2 = cos(uv.x * 2.5 - t * 0.8) * sin(uv.y * 3.5 + t * 0.6);

    // Blend four colors based on UV position + noise
    vec3 color = mix(uColor0, uColor1, smoothstep(0.0, 1.0, uv.x + n1 * 0.3));
    color = mix(color, uColor2, smoothstep(0.0, 1.0, uv.y + n2 * 0.3));
    color = mix(color, uColor3, smoothstep(0.3, 0.7, (uv.x + uv.y) * 0.5 + n1 * 0.2));

    gl_FragColor = vec4(color, 1.0);
  }
`;

interface MeshGradientProps {
  colors?: [string, string, string, string];
  speed?: number;
}

export default function MeshGradientShader({
  colors = ['#6ec3f4', '#3a3aff', '#ff61ab', '#E63946'],
  speed = 0.3,
}: MeshGradientProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor0: { value: new THREE.Color(colors[0]) },
    uColor1: { value: new THREE.Color(colors[1]) },
    uColor2: { value: new THREE.Color(colors[2]) },
    uColor3: { value: new THREE.Color(colors[3]) },
  }), [colors]);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = clock.getElapsedTime() * speed;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
```

### The Canvas Wrapper

```tsx
// components/webgl/HeroGradientCanvas.tsx
'use client';

import { Suspense, lazy, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';

const MeshGradientShader = lazy(() => import('./MeshGradientShader'));

export default function HeroGradientCanvas() {
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    // Only mount on capable devices
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const cores = navigator.hardwareConcurrency || 2;
    setCanRender(!!gl && cores >= 4);
  }, []);

  if (!canRender) return null; // Falls back to CSS gradient in parent

  return (
    <Canvas
      className="absolute inset-0 -z-10"
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 1] }}
      dpr={[1, 1.5]} // Cap pixel ratio for performance
    >
      <Suspense fallback={null}>
        <MeshGradientShader
          colors={['#6ec3f4', '#3a3aff', '#ff61ab', '#E63946']}
          speed={0.3}
        />
      </Suspense>
    </Canvas>
  );
}
```

### Hero Integration

```tsx
// components/sections/Hero.tsx (simplified structure)
import HeroGradientCanvas from '../webgl/HeroGradientCanvas';

export default function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Layer 0: CSS fallback gradient (always rendered) */}
      <div
        className="absolute inset-0 -z-20"
        style={{ background: 'var(--gradient-hero)' }}
      />

      {/* Layer 3: WebGL gradient (progressive enhancement) */}
      <HeroGradientCanvas />

      {/* Content on top */}
      <div className="container-main relative z-10 pt-32 pb-20">
        {/* Hero text, CTA buttons, phone mockup */}
      </div>
    </section>
  );
}
```

### Color Tuning

Use Tweakpane (development only) to live-tune shader colors:

```bash
pnpm add -D tweakpane
```

```typescript
// In development, wrap the shader component with a Tweakpane panel
// to adjust uColor0–uColor3 in real time and export final hex values.
// Remove Tweakpane from production builds via tree-shaking.
```

---

## 14. Framer Motion — Advanced Patterns

Framer Motion handles two categories of animation that CSS cannot: **layout-aware morphing** and **scroll-coupled physics**.

### A. The Morphing Mega Menu

Stripe's navigation dropdown moves and resizes its white background container seamlessly as you hover between links. This is NOT multiple boxes appearing/disappearing — it is a single `motion.div` with a shared `layoutId` that morphs its dimensions and position.

```tsx
// components/layout/MorphingNav.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_ITEMS = [
  {
    label: 'Products',
    content: <ProductsMenu />,   // Wide panel with 3 columns
    width: 600,
  },
  {
    label: 'Solutions',
    content: <SolutionsMenu />,  // Narrower panel
    width: 400,
  },
  {
    label: 'Developers',
    content: <DevelopersMenu />, // Medium panel
    width: 500,
  },
];

export default function MorphingNav() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <nav
      className="relative"
      onMouseLeave={() => setActiveIndex(null)}
    >
      <div className="flex gap-8">
        {NAV_ITEMS.map((item, i) => (
          <button
            key={item.label}
            onMouseEnter={() => setActiveIndex(i)}
            className="text-body-sm font-medium text-slate hover:text-primary-dark
                       transition-colors duration-150 py-2"
          >
            {item.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {activeIndex !== null && (
          <motion.div
            // THE KEY TECHNIQUE: layoutId makes one div morph between states
            layoutId="nav-dropdown-bg"
            className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl
                       border border-border overflow-hidden"
            initial={{ opacity: 0, y: -8 }}
            animate={{
              opacity: 1,
              y: 0,
              width: NAV_ITEMS[activeIndex].width,
            }}
            exit={{ opacity: 0, y: -8 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
              opacity: { duration: 0.15 },
            }}
          >
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-6"
            >
              {NAV_ITEMS[activeIndex].content}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
```

**How it works:** When `activeIndex` changes, the `motion.div` with `layoutId="nav-dropdown-bg"` does not unmount and remount. Framer Motion calculates the bounding-box difference and animates `transform` + `width`/`height` with a spring physics curve. The content inside cross-fades separately.

### B. Scroll-Coupled Parallax & Skew

Stripe uses "scroll-coupled" animations where elements respond to scroll position in real time — not just triggering on viewport entry.

```tsx
// components/ui/ScrollParallax.tsx
'use client';

import { useRef, ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface ScrollParallaxProps {
  children: ReactNode;
  offset?: number;     // Parallax distance in pixels
  skewOnScroll?: boolean;
}

export default function ScrollParallax({
  children,
  offset = 50,
  skewOnScroll = false,
}: ScrollParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'], // Track from enter to exit
  });

  // Parallax: element moves slower than scroll
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);

  // Opacity: fade in from 0.2 to 1 in the first 40% of scroll range
  const opacity = useTransform(scrollYProgress, [0, 0.4], [0.2, 1]);

  // Skew: subtle tilt based on scroll velocity (Stripe signature)
  const skewY = useTransform(scrollYProgress, [0, 0.5, 1], [2, 0, -2]);

  return (
    <motion.div
      ref={ref}
      style={{
        y,
        opacity,
        ...(skewOnScroll ? { skewY } : {}),
      }}
    >
      {children}
    </motion.div>
  );
}
```

Usage:

```tsx
<ScrollParallax offset={40}>
  <img src="/hero-phone.png" alt="Lynia app" />
</ScrollParallax>

<ScrollParallax offset={30} skewOnScroll>
  <StatsSection />
</ScrollParallax>
```

**Key detail:** Inspect Stripe's hero elements and you'll see `will-change: transform` on parallax items. Framer Motion sets this automatically via its `style` prop. The skew effect makes the page feel "fluid" — as the user scrolls faster, content subtly tilts, creating a sense of physics.

### C. Staggered Card Reveals

Cards enter the viewport one after another with a cascading delay:

```tsx
// components/ui/StaggeredGrid.tsx
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1, // 100ms between each child
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0, 0, 0.2, 1], // Stripe's deceleration curve
    },
  },
};

interface StaggeredGridProps {
  children: ReactNode[];
  className?: string;
}

export default function StaggeredGrid({ children, className }: StaggeredGridProps) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
    >
      {children.map((child, i) => (
        <motion.div key={i} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

Usage:

```tsx
<StaggeredGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
  <ProductCard title="Asset Financing" />
  <ProductCard title="Digital Credit" />
  <ProductCard title="Enterprise API" />
</StaggeredGrid>
```

---

## 15. Visual Asset Techniques

### Typography: Geist Sans vs Inter

| Font | Source | Best For | Notes |
|------|--------|----------|-------|
| **Inter** | Google Fonts / `next/font` | Our primary choice | Geometric, variable weight, free, excellent for fintech |
| **Geist Sans** | Vercel | Alternative | Ships with `next/font/local`, optimized for Next.js |

Both are elite free alternatives to Stripe's Soehne. We use Inter because it has broader language support (important for Shona/Ndebele content).

### Glassmorphism (Frosted Glass)

Used sparingly on nav scroll state, modal overlays, and floating elements:

```tsx
<div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-lg p-6">
  {/* Content appears to float above a blurred background */}
</div>
```

**Rules:**
- Only use on elements that overlap rich backgrounds (hero, gradient sections)
- `backdrop-blur-md` = `12px` blur
- Always pair with a semi-transparent background (`bg-white/10` to `bg-white/80`)
- Add a `1px` border at `border-white/20` for the glass edge effect
- Performance: `backdrop-filter` is GPU-accelerated, but avoid stacking multiple blur layers

### The "Stripe Shadow" — Stacked Implementation

Standard Tailwind shadows feel flat. Stripe uses 5-6 layers of very low opacity to create "soft depth." Our Tailwind config pre-configures these, but here's the raw CSS for reference:

```css
/* The "hero card" shadow — maximum perceived depth */
.shadow-stripe-hero {
  box-shadow:
    0 50px 100px -20px rgba(50, 50, 93, 0.25),
    0 30px 60px -30px rgba(0, 0, 0, 0.30);
}

/* Feature card hover — elevated but controlled */
.shadow-stripe-elevated {
  box-shadow:
    0 13px 27px -5px rgba(50, 50, 93, 0.25),
    0 8px 16px -8px rgba(0, 0, 0, 0.30),
    0 -6px 16px -6px rgba(0, 0, 0, 0.025);
}
```

The key insight: `rgba(50, 50, 93, ...)` is a blue-tinted shadow base that aligns with the navy palette. Never use pure black `rgba(0,0,0,...)` as the primary shadow layer.

---

## 16. Claude Prompting Strategies

To extract production-quality code from Claude, use these structured prompt templates. Each prompt is designed to produce a specific, complete, copy-paste-ready component.

### Strategy 1: Layout Prompts

Provide exact design-system constraints so Claude doesn't improvise:

```
Claude, build a Next.js Hero section using Tailwind. Requirements:
- 12-column CSS Grid
- Container max-width: 1080px (use our .container-main class)
- Font: Inter via next/font/google
- Heading: 64px desktop / 36px mobile, weight 500, color #0A2540
- Subtext: 20px, weight 400, color #425466, max-width 560px
- CTA button: bg-[#635BFF], rounded-lg (8px), px-8 py-4, hover darkens to #5651E5
- Section divider: a full-width div with skewY(-6deg) and bg-[#F6F9FC]
- Section padding: 120px vertical desktop, 64px mobile
- Mobile-first responsive using Tailwind breakpoints
```

### Strategy 2: WebGL Prompts

Be explicit about the shader technique and performance constraints:

```
Claude, create a React Three Fiber component for a Stripe-style animated
mesh gradient background. Specifications:
- Fragment shader that blends 4 colors: #6ec3f4, #3a3aff, #ff61ab, #E63946
- Organic flowing movement using sin/cos wave distortion on UV coordinates
- Speed uniform set to 0.3 (slow, elegant movement)
- Must be a client component ('use client')
- Canvas settings: antialias false, powerPreference 'low-power', dpr capped at 1.5
- Progressive enhancement: only render if navigator.hardwareConcurrency >= 4
- Provide the CSS fallback gradient as a sibling div with z-index below the canvas
- Use React.lazy + Suspense so the WebGL bundle is code-split
```

### Strategy 3: Animation Prompts

Reference Framer Motion APIs by name to avoid generic CSS animation output:

```
Claude, write a Framer Motion navigation menu with a morphing dropdown.
Requirements:
- A single motion.div with layoutId="nav-dropdown-bg" that morphs its
  width/height/position when hovering between nav items
- Spring physics: stiffness 400, damping 30
- Content inside the dropdown should cross-fade with opacity 0.15s
- The dropdown has bg-white, rounded-lg, shadow-xl, border border-[#E0E6EB]
- AnimatePresence wraps the dropdown for enter/exit animations
- Exit animation: opacity 0, translateY -8px
- Use onMouseEnter on nav items and onMouseLeave on the nav container
```

### Strategy 4: Card Prompts

Specify the multi-layer shadow and interaction states precisely:

```
Claude, create a feature card component with Stripe-style depth.
- Border radius: 12px
- Border: 1px solid #E0E6EB
- Default shadow: 0px 1px 1px rgba(0,0,0,0.03), 0px 3px 6px rgba(18,42,66,0.02)
- Hover shadow: 0px 4px 8px rgba(0,0,0,0.04), 0px 12px 24px rgba(18,42,66,0.06)
- Hover transform: translateY(-4px)
- Transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1)
- Padding: 32px
- Include an overline label (13px, weight 500, uppercase, tracking 0.1em, color #635BFF)
- Title: 28px, weight 500, color #0A2540
- Description: 18px, weight 300, color #425466
```

### Strategy 5: Scroll Animation Prompts

```
Claude, build a scroll-coupled parallax wrapper using Framer Motion.
Requirements:
- useScroll with target ref, offset ['start end', 'end start']
- useTransform for: translateY (50px to -50px), opacity (0.2 to 1 in first 40%)
- Optional skewY effect: 2deg to 0 to -2deg based on scroll progress
- The component accepts children and an offset prop
- whileInView with viewport once:true for one-shot reveals
- Respect prefers-reduced-motion: skip all transforms, show content immediately
```

### General Prompting Rules

| Rule | Why |
|------|-----|
| Specify exact pixel values | Prevents Claude from guessing. `12px` not "rounded" |
| Name the Framer Motion API | `useScroll`, `layoutId`, `AnimatePresence` — not "animate on scroll" |
| Include the color hex codes | Claude should use `#635BFF` not "a purple-blue" |
| State the Tailwind class equivalents | Anchors output to our design system |
| Mention 'use client' for interactive components | Next.js App Router requires this |
| Ask for TypeScript with explicit prop interfaces | Prevents `any` types per our CLAUDE.md rules |
| Specify performance constraints | `dpr`, `powerPreference`, `lazy`, code-splitting |
| Request both the component AND its usage example | Ensures the component API is practical |

---

## 17. Implementation Execution Order

When building the landing page, implement in this order. Each step builds on the previous:

### Phase 1: Foundation (No JavaScript Required)

```
1. tailwind.config.ts — All design tokens from sections 1-6
2. globals.css — CSS custom properties, utility classes, reduced motion media query
3. layout.tsx — Inter font via next/font, global styles, metadata
4. Static HTML structure — All sections with correct semantic markup
5. CSS gradient fallback — var(--gradient-hero) renders without JS
```

Claude prompt: *"Set up the Tailwind config and globals.css with all the design tokens from our SKILL.md. Include the layered shadow system, container widths, section padding utilities, typography scale, and color tokens."*

### Phase 2: Components & Layout

```
6. Navbar.tsx — Scroll-aware transparent→solid transition
7. Footer.tsx — 4-column grid on dark navy
8. SectionContainer.tsx — Reusable wrapper with background variants
9. Button.tsx — Primary, secondary, ghost variants
10. All homepage sections — Static content with correct layout
```

Claude prompt: *"Build the Navbar component with a scroll listener that transitions from transparent background + white text to white background + dark text at 80px scroll. Include backdrop-blur-md, a 1px bottom border on scroll, and a persistent blurple CTA button on the right."*

### Phase 3: Animation Layer

```
11. useScrollAnimation.ts — Shared Intersection Observer hook
12. Scroll reveal animations — Fade-up on section entry
13. Card hover interactions — Lift + shadow transition
14. Staggered grid reveals — Cards cascade in
15. Nav morphing dropdown — Framer Motion layoutId
```

Claude prompt: *"Add Framer Motion scroll-triggered animations to all homepage sections. Use whileInView with viewport once:true. Sections fade up (translateY 24px to 0, opacity 0 to 1, 600ms). Cards use staggerChildren with 100ms delay."*

### Phase 4: WebGL Enhancement (Progressive)

```
16. MeshGradientShader.tsx — Fragment shader component
17. HeroGradientCanvas.tsx — R3F Canvas with capability detection
18. Hero.tsx integration — CSS fallback + WebGL overlay
19. Performance testing — Verify <200KB initial, 60fps on mid-range
```

Claude prompt: *"Create the WebGL mesh gradient as a progressive enhancement. The CSS gradient must render first (FCP). The R3F canvas lazy-loads only on devices with hardwareConcurrency >= 4. Cap dpr at 1.5, disable antialias, use powerPreference 'low-power'."*

### Phase 5: Polish & Performance

```
20. Reduced motion support — Verify all animations respect the media query
21. Lighthouse audit — Target >90 performance
22. Bundle analysis — Verify code splitting of WebGL + Framer Motion
23. Device testing — Test on low-end Android (our primary audience)
24. Accessibility audit — Keyboard nav, screen readers, contrast ratios
```

---

## Quick Reference: Stripe Elite Techniques

| Technique | Tool | Key API / Property | Section |
|-----------|------|-------------------|---------|
| Live mesh gradient | React Three Fiber | Custom `fragmentShader` + `useFrame` | 13 |
| Morphing mega menu | Framer Motion | `layoutId` + `AnimatePresence` | 14A |
| Scroll parallax | Framer Motion | `useScroll` + `useTransform` | 14B |
| Skew-on-scroll | Framer Motion | `useTransform(scrollYProgress, ..., skewY)` | 14B |
| Staggered reveals | Framer Motion | `staggerChildren` + `whileInView` | 14C |
| Frosted glass nav | CSS | `backdrop-blur-md` + `bg-white/80` | 15 |
| Layered shadows | CSS | Multi-layer `box-shadow` with `rgba(18,42,66,...)` | 3, 15 |
| GPU-only animation | CSS/FM | Only `transform` + `opacity`, never `width`/`height`/`top` | 5, 9 |
| Progressive WebGL | JS | `hardwareConcurrency >= 4` gate + `React.lazy` | 12, 13 |
