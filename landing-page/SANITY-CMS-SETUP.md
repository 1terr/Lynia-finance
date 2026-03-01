# Sanity CMS Setup Guide

## Overview

The Lynia Finance landing page uses **Sanity CMS** for editorial content management. Content is fetched at build time and baked into static HTML. Publishing in Sanity triggers an automatic rebuild via webhook.

```
Sanity Studio (lynia-finance.sanity.studio)
  --> publish event
Webhook --> GitHub Actions (repository_dispatch)
  --> triggers rebuild
Build: Next.js fetches from Sanity API at build time
  --> static HTML
Deploy: S3 upload + CloudFront invalidation
```

---

## Setup Steps

### 1. Create the Sanity Project

```bash
cd landing-page/sanity-studio
npm install
npx sanity@latest init
```

During init:
- **Project name**: `Lynia Finance Editorial`
- **Dataset**: `production`
- Note the **Project ID** — you'll need it in steps 2-5

### 2. Update Project ID in Studio Config

Edit `landing-page/sanity-studio/sanity.config.ts` and `sanity.cli.ts`:

```ts
projectId: 'YOUR_ACTUAL_PROJECT_ID',
```

### 3. Configure Frontend Environment

Create `landing-page/frontend/.env.local`:

```env
NEXT_PUBLIC_SANITY_PROJECT_ID=YOUR_ACTUAL_PROJECT_ID
NEXT_PUBLIC_SANITY_DATASET=production
```

### 4. Deploy Sanity Studio

```bash
cd landing-page/sanity-studio
npx sanity deploy
```

Choose a hostname (e.g. `lynia-finance`). Studio will be available at `https://lynia-finance.sanity.studio`.

### 5. Migrate Existing Content

Generate a write token at [manage.sanity.io](https://manage.sanity.io) → API → Tokens → Add token (Editor role).

```bash
cd landing-page/sanity-studio
SANITY_STUDIO_PROJECT_ID=YOUR_PROJECT_ID \
SANITY_AUTH_TOKEN=YOUR_WRITE_TOKEN \
npx tsx migrations/seed-content.ts
```

This creates:
- 6 categories (Company, Market, Products, Engineering, Investment Thesis, Technology)
- 3 authors (Founding Team, Product, Engineering)
- 9 existing articles converted to Sanity Portable Text

### 6. Add GitHub Repository Secret

Go to GitHub → Repository Settings → Secrets and variables → Actions → New repository secret:

| Secret Name | Value |
|-------------|-------|
| `SANITY_PROJECT_ID` | Your Sanity project ID |

This is used by both `deploy-frontend.yml` and `sanity-rebuild.yml` workflows.

### 7. Configure Sanity Webhook (Auto-Rebuild)

In [manage.sanity.io](https://manage.sanity.io) → API → Webhooks → Create webhook:

| Setting | Value |
|---------|-------|
| **Name** | GitHub Rebuild Trigger |
| **URL** | `https://api.github.com/repos/YOUR_ORG/Lynia-finance-1/dispatches` |
| **Dataset** | production |
| **Trigger on** | Create, Update, Delete |
| **Filter** | `_type in ["post", "author", "category"]` |
| **Projection** | `{}` |
| **HTTP method** | POST |
| **HTTP Headers** | `Authorization: Bearer YOUR_GITHUB_PAT` |
| | `Accept: application/vnd.github+json` |
| **Request body** | `{"event_type": "sanity-content-publish"}` |

**GitHub PAT requirements**: Create at [github.com/settings/tokens/new](https://github.com/settings/tokens/new) with `repo` scope.

---

## Content Management

### Accessing Sanity Studio

**URL**: `https://lynia-finance.sanity.studio`

### Content Types

#### Editorial Post
| Field | Description |
|-------|-------------|
| Title | Article headline, max 120 chars |
| Slug | URL path (auto-generated from title) |
| Excerpt | Summary for cards, max 300 chars |
| Category | Reference to a category |
| Author | Reference to an author |
| Published Date | Controls ordering on the site |
| Read Time | e.g. "5 min read" |
| Featured Image | Hero image with required alt text |
| Body | Rich text with images, videos, headings, lists |
| SEO | Optional meta title and description overrides |

#### Rich Text Body Supports
- **Headings**: H2, H3
- **Formatting**: Bold, italic, inline code
- **Links**: External with "open in new tab" option
- **Lists**: Bullet and numbered
- **Block quotes**
- **Inline images**: With alt text and optional caption
- **Video embeds**: YouTube and Vimeo URLs

### Publishing Workflow

1. Create or edit content in Sanity Studio
2. Click **Publish**
3. Webhook triggers GitHub Actions rebuild (~3-5 min)
4. CloudFront cache is invalidated automatically
5. Changes appear live on lyniafinance.com

---

## Architecture

### Files

| File | Purpose |
|------|---------|
| `sanity-studio/schemas/post.ts` | Article content schema |
| `sanity-studio/schemas/author.ts` | Author schema |
| `sanity-studio/schemas/category.ts` | Category schema |
| `sanity-studio/migrations/seed-content.ts` | Initial content migration script |
| `frontend/lib/sanity.ts` | Sanity client + image URL builder |
| `frontend/lib/sanity-types.ts` | TypeScript types for Sanity documents |
| `frontend/lib/editorial-data.ts` | GROQ queries + fetch functions |
| `frontend/lib/insights-data.ts` | Re-exports from editorial-data |
| `frontend/components/PortableText.tsx` | Rich text renderer |
| `frontend/components/EditorialContent.tsx` | Editorial listing (client component) |
| `frontend/components/InsightsContent.tsx` | Insights listing (client component) |
| `.github/workflows/sanity-rebuild.yml` | Webhook-triggered rebuild workflow |

### Data Flow

- **Homepage Insights**: `app/page.tsx` (server) fetches posts → passes to `Insights` (client) as prop
- **Insights listing**: `app/insights/page.tsx` (server) fetches posts + categories → passes to `InsightsContent` (client)
- **Article detail**: `app/insights/[slug]/page.tsx` (server) fetches single post → renders with `PortableText`
- **Editorial listing**: `app/editorial/page.tsx` (server) → `EditorialContent` (client)

### Why Server→Client Handoff?

The site uses `output: 'export'` (static HTML). Client components can't fetch async data at build time. Server components fetch from Sanity at build time and pass data as props to client components that handle interactivity (filtering, animations).

---

## Troubleshooting

**Content not appearing after publish?**
Check GitHub Actions → `sanity-rebuild.yml` workflow status. Rebuilds take 3-5 minutes.

**Images not loading?**
Verify the image uploaded successfully in Sanity Studio. Check that `NEXT_PUBLIC_SANITY_PROJECT_ID` is set.

**Webhook not triggering?**
Check webhook logs in Sanity dashboard (API → Webhooks). Verify the GitHub PAT hasn't expired.

**Build failing locally?**
Ensure `.env.local` exists with valid `NEXT_PUBLIC_SANITY_PROJECT_ID`.

---

## Sanity Free Tier Limits

| Resource | Limit |
|----------|-------|
| Team members | 3 users |
| API requests | 500K / month |
| Asset storage | 10 GB |
| Datasets | 2 |
| History retention | 3 days |

More than sufficient for editorial content management.
