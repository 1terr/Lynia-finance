# Landing Page Review

> Reviewed: 2026-02-11
> Scope: `landing-page/frontend/` — all pages, components, styles, config
> Stack: Next.js 14, React 18, Tailwind CSS 3.4, Lucide icons

---

## Summary

The landing page is a well-built Next.js 14 marketing site with 11 modular
homepage sections, 10 routes, clean Tailwind design system, and solid
accessibility. The review found **1 critical issue** (broken CTA links) and
several improvements that were fixed in this pass.

| Severity | Count | Fixed |
|----------|-------|-------|
| **CRITICAL** | 1 | Yes |
| **HIGH** | 3 | Yes |
| **MEDIUM** | 3 | 1 partially, 2 documented |
| **LOW** | 3 | Documented |

---

## Fixes Applied

### F1. Broken WhatsApp Links (CRITICAL)

Every "Start your application" CTA pointed to `https://wa.me/263` — just a
country code with no phone number. This is the **primary conversion action**
across the entire site and it did nothing.

**Fix**: Created `lib/constants.ts` centralising `WHATSAPP_URL`, `SOCIAL_LINKS`,
and `CONTACT_EMAIL`. Updated all 8 files that referenced the broken URL.
The placeholder `263XXXXXXXXX` must be replaced with the real business number
before launch.

**Files**: `WhatsAppFAB.tsx`, `Footer.tsx`, `BottomCTA.tsx`, `contact/page.tsx`,
`about/page.tsx`, `products/page.tsx`, `lib/constants.ts` (new)

### F2. Placeholder Social Links (HIGH)

Footer linked to `https://x.com` and `https://linkedin.com` (generic homepages)
instead of Lynia's profiles. The JSON-LD schema had the correct URLs
(`x.com/lyniafinance`, `linkedin.com/company/lyniafinance`) but the footer
didn't match.

**Fix**: Footer now imports `SOCIAL_LINKS` from `lib/constants.ts` which matches
the JSON-LD schema. External links now open in new tabs with `rel="noopener noreferrer"`.

### F3. No Client-Side Navigation (HIGH)

Every link (`Navbar`, `Footer`, `Button`, section links) used plain `<a>` tags
instead of Next.js `<Link>`. This caused full page reloads on every click —
the entire JS bundle re-downloaded and re-parsed on every navigation.

**Fix**:
- `Navbar.tsx`: All nav links converted to `<Link>`. Added `useEffect` to
  close mobile menu on route changes (works with client-side nav).
- `Footer.tsx`: Internal links use `<Link>`, external links stay as `<a>`.
- `Button.tsx`: Internal `href` renders `<Link>`, external `href` renders `<a>`
  with `target="_blank"`.

### F4. `useScrollAnimation` Ref Type Mismatch (LOW)

The hook used `useRef<HTMLDivElement>` but was applied to `<section>` elements.
Changed to `useRef<HTMLElement>` for correctness.

---

## Remaining Issues (Not Fixed)

### M1. Forms Don't Submit Anywhere

Both forms on `/contact` (ContactForm, PartnershipForm) fake submission:
```typescript
setTimeout(() => setStatus('success'), 800);
```
The "Get notified when we launch" forms on the Digital Credit sections also do
nothing (`e.preventDefault()` with no API call).

**Impact**: All lead capture data is silently discarded. Every form submission
shows "success" but nothing is recorded.

**Recommendation**: Connect to a form backend (Supabase function, email
service, or a simple API route) before launch.

### M2. No Favicon or OG Image

The metadata specifies `twitter: { card: 'summary_large_image' }` but provides
no image. No favicon is configured. These are essential for social sharing and
browser tabs.

**Recommendation**: Add `icons` to metadata in `layout.tsx` and provide OG
images for social cards.

### M3. Image Placeholders Throughout

All visual sections use colored `<div>` elements with oversized Lucide icons
as placeholder images:
- Hero: Phone mockup frame with chat bubbles (CSS-only)
- AssetFinancing: `bg-primary-light` div with Smartphone icon
- DigitalCredit: `bg-navy-light` div with Wallet icon
- Enterprise: White bordered div with Code icon
- Editorial: `bg-primary-light` divs for post thumbnails

**Impact**: The site looks unfinished without real product imagery.

### M4. Google Fonts via `<link>` (Render-Blocking)

Inter is loaded via a render-blocking `<link>` stylesheet. Ideally this should
use `next/font/google` which inlines CSS and eliminates FOUT. The build
environment currently lacks network access for `next/font` font downloads.

**Recommendation**: When deploying via CI/CD (which has network), switch to:
```typescript
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], weight: ['300','400','500','600'], display: 'swap' });
```

### L1. Products Page Has Unnecessary `'use client'`

`/products/page.tsx` has `'use client'` at the top but only uses it for one
inline `onSubmit={(e) => e.preventDefault()}`. This prevents the page from
exporting metadata and forces client-side rendering.

**Recommendation**: Extract the small lead capture form into a separate client
component. The rest of the page can be a Server Component with metadata.

### L2. Duplicate Content Between Homepage and Products

AssetFinancing, DigitalCredit, and Enterprise sections repeat nearly identical
copy between the homepage components and `/products/page.tsx`.

**Recommendation**: Extract shared copy into `lib/constants.ts` or a content
data file to keep copy in sync.

### L3. No Error Boundary

No `error.tsx` or `not-found.tsx` pages exist. A broken section component
would crash the entire page with a white screen.

---

## Positive Findings

1. **Clean architecture**: 11 modular section components, reusable Button/SectionContainer
2. **Design system**: Comprehensive Tailwind config with custom typography scale, colors, shadows, spacing
3. **Scroll animations**: `useScrollAnimation` with IntersectionObserver — fires once, unobserves after
4. **Accessibility**: `aria-label`, `aria-current`, keyboard focus states, semantic HTML
5. **Reduced motion**: `prefers-reduced-motion` media query disables all animations
6. **Passive listeners**: Navbar scroll handler uses `{ passive: true }`
7. **SEO**: JSON-LD schema, per-page metadata, robots.txt, sitemap.xml
8. **Minimal dependencies**: Only 4 production deps (next, react, react-dom, lucide-react)
9. **Build output**: All pages statically prerendered, first load JS ~87KB shared + ~12KB page
10. **Mission-driven copy**: Clear, compelling messaging for Zimbabwe's underbanked

---

## Files Modified

| File | Change |
|------|--------|
| `lib/constants.ts` | **NEW** — Centralised WhatsApp URL, social links, email |
| `components/layout/Navbar.tsx` | `<a>` → `<Link>`, mobile menu close on route change |
| `components/layout/Footer.tsx` | Social links from constants, `<Link>` for internal, `target="_blank"` for external |
| `components/layout/WhatsAppFAB.tsx` | WhatsApp URL from constants |
| `components/ui/Button.tsx` | `<Link>` for internal hrefs, `<a target="_blank">` for external |
| `components/sections/BottomCTA.tsx` | WhatsApp URL from constants |
| `app/layout.tsx` | Comment noting `next/font` migration path |
| `app/about/page.tsx` | WhatsApp URL from constants |
| `app/contact/page.tsx` | WhatsApp URL + email from constants |
| `app/products/page.tsx` | WhatsApp URL from constants |
| `lib/useScrollAnimation.ts` | Ref type `HTMLDivElement` → `HTMLElement` |
