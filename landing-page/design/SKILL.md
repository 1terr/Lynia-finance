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
