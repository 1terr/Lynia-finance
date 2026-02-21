# Design — lyniafinance.com

Design system, copy, and component specs for the Lynia Finance landing page.

## Documents

| File | Purpose |
|------|---------|
| [`WEBSITE-COPY.md`](./WEBSITE-COPY.md) | **Canonical website copy** — all section text, headlines, and UI/UX philosophy |
| [`SKILL.md`](./SKILL.md) | Front-end skill guide — Stripe design language mapped to Tailwind/Next.js |
| [`DESIGN-TOKENS.md`](./DESIGN-TOKENS.md) | Colors, typography, spacing, shadows, breakpoints, Tailwind config |
| [`COMPONENTS.md`](./COMPONENTS.md) | Detailed specs for all reusable UI components |
| [`ANIMATIONS.md`](./ANIMATIONS.md) | Motion, transitions, scroll animations, hover/focus states |

## Key Decisions

| Area | Decision |
|------|----------|
| Color | Navy `#0A2540`, Blurple `#635BFF` (accent + CTA), CSS gradient default |
| Typography | Inter (variable weight, headings 500, body 300) |
| Icons | Lucide React |
| Framework | Next.js 14 (App Router) on AWS S3 + CloudFront |
| CSS | Tailwind CSS |
| Hero gradient | CSS gradient with Great Zimbabwe zig-zag pattern; WebGL as progressive enhancement |
| Navigation | Lynia (left) · Products \| Thesis \| Press (center) · Get started → (right) |
| Products | Asset-Backed Lending · Digital Credit · Embedded Credit |
| Section order | Hero → Data Strip → Product Bento → Developer Engine → System Illustration → Thesis → Press → CTA → Footer |

## Page Structure

| Route | Purpose |
|-------|---------|
| `/` | Homepage — all sections |
| `/products` | Product details |
| `/thesis` | The 2026 Thesis — Conviction + Strategy |
| `/press` | Press releases and media |
| `/contact` | Contact form + partnership application |
| `/compliance` | RBZ regulatory compliance |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
