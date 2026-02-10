# Animations & Interactions — Lynia Finance Landing Page

> Detailed specifications for all motion, transitions, and interactive behaviors.
> Design language follows [stripe.com](https://stripe.com).
> Reference [`DESIGN-TOKENS.md`](./DESIGN-TOKENS.md) for timing and easing values.

---

## Design Principles for Motion

1. **Purposeful** — Every animation serves a function (guide attention, show state, create polish)
2. **Subtle** — Motion enhances, never distracts. Nothing should feel "flashy"
3. **Fast** — Under 400ms for most transitions. Users on slow connections can't afford to wait
4. **Accessible** — Respect `prefers-reduced-motion`. All animations degrade gracefully
5. **Performance** — Use `transform` and `opacity` only (GPU-accelerated). No `width`/`height`/`top`/`left` animations

---

## 1. Page Load Animations

### Hero Section Entrance

| Element | Animation | Delay | Duration | Easing |
|---------|-----------|-------|----------|--------|
| Headline | `opacity: 0→1`, `translateY: 24px→0` | `0ms` | `600ms` | `var(--easing-out)` |
| Subtext | `opacity: 0→1`, `translateY: 24px→0` | `100ms` | `600ms` | `var(--easing-out)` |
| Primary CTA | `opacity: 0→1`, `translateY: 16px→0` | `200ms` | `500ms` | `var(--easing-out)` |
| Secondary CTA | `opacity: 0→1`, `translateY: 16px→0` | `250ms` | `500ms` | `var(--easing-out)` |
| Phone mockup | `opacity: 0→1`, `translateX: 40px→0` | `300ms` | `700ms` | `var(--easing-out)` |
| Gradient background | Instant (already rendering via WebGL) | `0ms` | — | — |

**Implementation**: Use CSS `@keyframes` with `animation-delay`. No JavaScript needed for initial load.

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Nav Appearance

| State | Behavior |
|-------|----------|
| Initial | Fully visible, transparent background |
| No entrance animation | Nav is immediately present (no fade-in) |

---

## 2. Scroll-Triggered Animations

### Intersection Observer Setup

```javascript
// Trigger when 15% of element is visible
const observer = new IntersectionObserver(callback, {
  threshold: 0.15,
  rootMargin: '0px 0px -50px 0px' // Trigger slightly before fully in view
});
```

### Section Entry Animations

All sections below the hero use scroll-triggered entrance animations.

| Section | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Social Proof logos | `opacity: 0→1`, logos stagger `50ms` each | `400ms` | `var(--easing-out)` |
| Product Suite headline | `opacity: 0→1`, `translateY: 24px→0` | `500ms` | `var(--easing-out)` |
| Product cards | `opacity: 0→1`, `translateY: 32px→0`, stagger `100ms` per card | `500ms` | `var(--easing-out)` |
| Product deep-dive text | `opacity: 0→1`, `translateY: 24px→0` | `600ms` | `var(--easing-out)` |
| Product deep-dive visual | `opacity: 0→1`, `translateX: ±40px→0` (direction matches layout) | `700ms` | `var(--easing-out)` |
| Stat numbers | `opacity: 0→1` + count-up animation | `800ms` | `var(--easing-out)` |
| Segment cards | `opacity: 0→1`, `translateY: 32px→0`, stagger `100ms` | `500ms` | `var(--easing-out)` |
| Blog cards | `opacity: 0→1`, `translateY: 32px→0`, stagger `100ms` | `500ms` | `var(--easing-out)` |
| Bottom CTA text | `opacity: 0→1`, `translateY: 24px→0` | `500ms` | `var(--easing-out)` |

### Feature Grid Items (within product sections)

| Animation | Details |
|-----------|---------|
| Type | `opacity: 0→1`, `translateY: 16px→0` |
| Stagger | `75ms` between items |
| Duration | `400ms` per item |
| Trigger | When parent section is in view |

### Count-Up Animation (Stats Section)

```javascript
// Animate from 0 to target number
// Duration: 1200ms
// Easing: ease-out (decelerating near end)
// Format: Preserve original format (80%, <5%, $14B, 70%+)
// Start: When section enters viewport (15% visible)
```

| Stat | Start | End | Duration |
|------|-------|-----|----------|
| 80% | 0% | 80% | `1200ms` |
| <5% | 0% | <5% | `1200ms` |
| $14B | $0B | $14B | `1200ms` |
| 70%+ | 0%+ | 70%+ | `1200ms` |

Stagger: `150ms` between each stat.

---

## 3. Navigation Interactions

### Scroll-Based Background Transition

| Property | Before Scroll | After Scroll (>80px) |
|----------|--------------|---------------------|
| Background | `transparent` | `rgba(255,255,255,0.95)` |
| Backdrop filter | `none` | `blur(12px)` |
| Border bottom | `transparent` | `1px solid var(--color-gray-200)` |
| Link color | `var(--color-white)` | `var(--color-gray-700)` |
| Logo variant | White | Dark |
| Shadow | `none` | `var(--shadow-sm)` |
| Transition | — | `250ms var(--easing-default)` |

**Implementation**: Listen to `scroll` event (throttled to `requestAnimationFrame`), toggle CSS class.

### Mobile Menu

| State | Animation |
|-------|-----------|
| Open | Menu panel: `opacity: 0→1`, `translateY: -16px→0`, `300ms`, `var(--easing-out)` |
| Open (links) | Each link: `opacity: 0→1`, stagger `50ms`, `200ms` |
| Close | Reverse of open, `200ms`, `var(--easing-in)` |
| Hamburger → X | Morph animation: top line rotates +45°, middle fades out, bottom rotates -45°, `250ms` |

---

## 4. Hover & Focus States

### Buttons

| Type | Hover Animation | Active Animation |
|------|----------------|-----------------|
| Primary | Background darkens (`cta→cta-hover`), `var(--shadow-md)` appears, `150ms` | `scale(0.98)`, shadow reduces, `100ms` |
| Secondary (text) | Color darkens, arrow shifts right `4px`, `150ms` | `opacity: 0.8`, `100ms` |
| Ghost | Background gains `rgba(255,255,255,0.1)`, border brightens, `150ms` | `scale(0.98)`, `100ms` |
| Disabled | No hover effect | No active effect |

### Cards (Product, Segment, Blog)

| State | Animation |
|-------|-----------|
| Default | `shadow: var(--shadow-sm)`, `transform: none` |
| Hover | `shadow: var(--shadow-lg)`, `transform: translateY(-4px)`, `250ms var(--easing-default)` |
| Active/Click | `transform: translateY(-2px)`, `shadow: var(--shadow-md)`, `100ms` |

### Links

| State | Animation |
|-------|-----------|
| Default | `color: var(--color-primary)`, no underline |
| Hover | `color: var(--color-primary-dark)`, underline appears (slide-in from left), `150ms` |
| Focus | `outline: 2px solid var(--color-accent-2)`, `2px` offset |

### Form Inputs

| State | Animation |
|-------|-----------|
| Default | `border: 1px solid var(--color-gray-300)` |
| Focus | `border: 2px solid var(--color-primary)`, subtle `var(--shadow-inner)`, `150ms` |
| Error | `border: 1px solid var(--color-error)`, error message fades in `200ms` |
| Valid | Border returns to gray on blur if valid |

### WhatsApp FAB

| State | Animation |
|-------|-----------|
| Default | Static, `shadow: 0 4px 12px rgba(37,211,102,0.4)` |
| Hover | `scale(1.1)`, shadow grows, `150ms var(--easing-default)` |
| Active | `scale(0.95)`, `100ms` |
| Tooltip (desktop) | Appears on hover: `opacity: 0→1`, `translateX: 8px→0`, `200ms` |
| Tooltip (mobile) | Shows for 5 seconds on page load, then fades out `300ms` |

### Logo Strip Logos

| State | Animation |
|-------|-----------|
| Default | `filter: grayscale(100%)`, `opacity: 0.5` |
| Hover | `filter: grayscale(0%)`, `opacity: 1`, `250ms` |

---

## 5. Persistent Animations

### Hero Phone Mockup Float

```css
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}

.phone-mockup {
  animation: float 4s ease-in-out infinite;
}
```

- Runs continuously while hero is in viewport
- Pause when hero is not visible (Intersection Observer)
- Respect `prefers-reduced-motion`: disable entirely

### Hero WebGL Gradient

| Property | Value |
|----------|-------|
| Type | Animated gradient mesh (WebGL canvas or CSS fallback) |
| Speed | Very slow — `0.3` speed factor, organic movement |
| Colors | `#6ec3f4` (light blue), `#3a3aff` (vivid blue), `#ff61ab` (pink), `#E63946` (red) |
| Fallback | `linear-gradient(135deg, #0A2540 0%, #3a3aff 40%, #635BFF 70%, #6ec3f4 100%)` |
| Performance | Check `navigator.hardwareConcurrency` — disable WebGL if < 4 cores |
| Reduced motion | Static gradient only |

**Library options** (pick one during development):
- `meshgradient` (lightweight, ~5KB)
- Custom WebGL shader (maximum control, ~3KB)
- CSS `@property` gradient animation (zero JS, limited browser support)

---

## 6. Page Transitions

### Route Navigation (Next.js)

| Transition | Animation |
|-----------|-----------|
| Page exit | `opacity: 1→0`, `150ms`, `var(--easing-in)` |
| Page enter | `opacity: 0→1`, `250ms`, `var(--easing-out)` |
| Content shift | None — use Next.js `<Link>` prefetching for instant feel |

**Implementation**: Use Next.js App Router layout transitions or `framer-motion` `AnimatePresence`.

### Scroll to Section (homepage product cards → deep dives)

| Property | Value |
|----------|-------|
| Behavior | `scroll-behavior: smooth` |
| Duration | Browser-native (typically ~400ms) |
| Offset | `-80px` (account for sticky nav height) |

---

## 7. Loading States

### Skeleton Screens

Use skeleton loading instead of spinners for all data-dependent content.

| Element | Skeleton |
|---------|----------|
| Blog post card image | Gray rectangle with shimmer, aspect ratio `16/9` |
| Blog post card text | 3 gray bars (headline width ~80%, excerpt ~100%, date ~30%) |
| Logo strip | Gray circles/rectangles matching logo dimensions |

### Shimmer Animation

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-gray-100) 25%,
    var(--color-gray-200) 50%,
    var(--color-gray-100) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### Button Loading

| State | Animation |
|-------|-----------|
| Loading | Button text replaced with spinner (16px, white, rotating), button disabled |
| Spinner | `rotate 0→360°`, `800ms`, `linear`, `infinite` |
| Width | Button maintains original width during loading (no layout shift) |

---

## 8. Accessibility — Reduced Motion

All animations must respect the user's system preference.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Specific adjustments**:
- Hero gradient: static gradient, no animation
- Phone mockup float: no float animation
- Scroll-triggered entrances: elements visible immediately, no stagger
- Count-up stats: show final numbers immediately
- Card hover: only color change, no `translateY`
- Page transitions: instant (no fade)

---

## 9. Performance Budget for Animations

| Constraint | Target |
|-----------|--------|
| Animation JS bundle | < 5KB gzipped (or zero if CSS-only) |
| WebGL gradient | < 8KB (shader + setup) |
| Frame rate | 60fps on mid-range devices |
| Main thread blocking | < 16ms per frame |
| Total animation CSS | < 2KB |
| Intersection Observer | Shared single observer instance for all sections |

### Optimization Rules

1. Use CSS animations over JS where possible
2. Use `will-change: transform, opacity` sparingly (only on animated elements)
3. Use `contain: layout` on sections to limit reflow scope
4. Batch Intersection Observer entries
5. Debounce scroll events to `requestAnimationFrame`
6. Lazy-load WebGL gradient (not needed for FCP/LCP)

---

## Animation Implementation Summary

| Priority | Animation | Method | Bundle Impact |
|----------|-----------|--------|---------------|
| P0 (must have) | Hero text entrance | CSS `@keyframes` | 0KB JS |
| P0 | Nav scroll transition | Vanilla JS (scroll listener) | ~0.5KB |
| P0 | Button/card hovers | CSS transitions | 0KB JS |
| P0 | Form focus states | CSS transitions | 0KB JS |
| P0 | Reduced motion support | CSS `@media` | 0KB JS |
| P1 (should have) | Scroll-triggered sections | Intersection Observer | ~1KB |
| P1 | Count-up stats | Intersection Observer + JS | ~1.5KB |
| P1 | Mobile menu open/close | CSS transitions + JS toggle | ~0.3KB |
| P2 (nice to have) | WebGL gradient | WebGL shader | ~8KB (lazy) |
| P2 | Phone mockup float | CSS `@keyframes` | 0KB JS |
| P2 | Page route transitions | framer-motion (if used) | ~15KB |
| P2 | Skeleton shimmer | CSS `@keyframes` | 0KB JS |
