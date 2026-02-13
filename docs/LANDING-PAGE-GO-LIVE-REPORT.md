# Landing Page — Go-Live Engineering Report

> **Date**: 2026-02-13
> **Branch**: `claude/review-frontend-tasks-l2a7x`
> **Commits**: `3423a05` (merged to master via PR #356), `60759ae` (pending)
> **Scope**: Full production readiness — static export, form backend, AWS hosting, CI/CD pipeline

---

## Executive Summary

The Lynia Finance landing page (`lyniafinance.com`) has been converted from a
development-mode SSR application into a production-ready static site deployable
to AWS S3 + CloudFront. Three blocking issues were resolved:

1. **Forms were broken** — Next.js API routes don't work with static exports.
   A new Lambda function now handles all form submissions via API Gateway.
2. **No hosting infrastructure existed** — S3 bucket, CloudFront distribution,
   DNS records, and CloudFront Functions were added to the CloudFormation stack.
3. **No CI/CD pipeline existed** — The deploy-frontend.yml workflow now includes
   full blue-green deployment support for the landing page.

The site builds to 20 static HTML pages totalling ~93.5 kB First Load JS, well
under the 200 kB target.

---

## Architecture Before vs After

### Before (development mode)

```
Browser → Next.js dev server (standalone, SSR)
         ├── Pages rendered server-side
         └── API routes (/api/contact, /api/partnership, /api/waitlist)
              └── validation.ts (server-side)
              └── Response sent (no database — simulated)
```

**Problems**:
- `output: 'standalone'` requires a Node.js server — incompatible with S3
- API routes only work with a running Next.js server
- No hosting configuration in AWS CloudFormation
- No CI/CD pipeline for deployment

### After (production-ready)

```
Browser → CloudFront CDN → S3 bucket (static HTML/CSS/JS)
  │
  └── Form submit → API Gateway (POST /forms/submit)
                      └── form-submission-service Lambda (no auth)
                           └── RDS PostgreSQL
                                ├── contact_submissions
                                ├── partnership_applications
                                └── waitlist
```

**Key properties**:
- Fully static — no server runtime required
- Global CDN distribution via CloudFront (HTTP/2 + HTTP/3)
- Forms routed to a dedicated Lambda (7th function in the SAM stack)
- Public endpoint — no Cognito authorizer (landing page visitors are unauthenticated)
- CORS locked to `lyniafinance.com` and `www.lyniafinance.com`

---

## Changes by Category

### 1. Static Export Conversion

**File**: `landing-page/frontend/next.config.js`

| Setting | Before | After | Why |
|---------|--------|-------|-----|
| `output` | `'standalone'` | `'export'` | S3 serves static files, not Node.js |
| `trailingSlash` | not set | `true` | S3 needs `/about/index.html`, not `/about` |

**Build output**: `out/` directory with 20 HTML pages:
```
out/
├── index.html
├── about/index.html
├── careers/index.html
├── contact/index.html
├── editorial/index.html
├── editorial/[slug]/index.html  (×6 articles)
├── partnerships/index.html
├── privacy/index.html
├── products/index.html
├── terms/index.html
├── 404.html
├── _next/static/...
└── sitemap.xml, robots.txt
```

### 2. Form Submission Lambda

**New service**: `services/form-submission-service/`

| File | Purpose |
|------|---------|
| `src/index.ts` | Lambda handler — 179 lines |
| `package.json` | Dependencies (esbuild, aws-lambda types) |
| `tsconfig.json` | TypeScript config with `@shared/*` path alias |

**Endpoint**: `POST /forms/submit` (API Gateway, public — no Cognito)

**How it works**:

1. Receives JSON body with a `type` discriminator (`contact`, `partnership`, or `waitlist`)
2. Validates inputs using shared utilities (`isValidPhoneNumber`, `isValidEmail`, `sanitizePhoneNumber`)
3. Sanitises text fields (strips control characters, enforces max length)
4. Inserts into the appropriate RDS PostgreSQL table (migration 014)
5. Returns `{ success: true }` or `{ success: false, error: "..." }`

**Validation rules by form type**:

| Field | Contact | Partnership | Waitlist |
|-------|---------|-------------|----------|
| `name` | Required, max 200 chars | Required, max 200 chars | — |
| `phone` | Required, Zimbabwe format | Required, Zimbabwe format | Required, Zimbabwe format |
| `email` | Optional, validated if present | Required | — |
| `partner_type` | — | Required (distributor/b2b/other) | — |
| `message` | Optional, max 1000 chars | Optional, max 1000 chars | — |

**Security measures**:
- CORS origin whitelist (not `*`)
- Input sanitisation (control character stripping)
- Length limits on all text fields
- Parameterised database queries (via shared `db` client)
- Duplicate phone on waitlist silently succeeds (no information leakage)
- Error messages don't expose internals

**SAM template addition** (`template.yaml`):
```yaml
FormSubmissionFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub ${Environment}-lynia-form-submission
    MemorySize: 256
    Timeout: 15
    Events:
      SubmitForm:    POST /forms/submit  (Authorizer: NONE)
      SubmitFormOptions: OPTIONS /forms/submit (Authorizer: NONE — CORS preflight)
    Policies:
      - secretsmanager:GetSecretValue (database credentials)
      - cloudwatch:PutMetricData
```

### 3. Database

**Migration**: `database/migrations/014_landing_page_forms.sql` (pre-existing — no changes needed)

| Table | Columns | Constraints |
|-------|---------|-------------|
| `contact_submissions` | id (UUID PK), name, phone, email, message, created_at | RLS enabled |
| `partnership_applications` | id (UUID PK), name, phone, email, partner_type, message, created_at | partner_type CHECK constraint, RLS enabled |
| `waitlist` | id (UUID PK), phone (UNIQUE), created_at | UNIQUE on phone, RLS enabled |

All tables have:
- UUID primary keys (prevents enumeration)
- `created_at DESC` indexes (for admin queries)
- Row Level Security enabled (service role only)

### 4. Frontend Form Rewiring

Forms now call `submitForm()` from `lib/api.ts` which POSTs directly to API Gateway.

**`lib/api.ts`** (rewritten):
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function submitForm(formData: Record<string, unknown>): Promise<FormResult> {
  const response = await fetch(`${API_URL}/forms/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  // ...
}
```

**Modified components**:

| Component | Form | `type` discriminator |
|-----------|------|---------------------|
| `app/contact/page.tsx` — ContactForm | Contact form | `{ type: 'contact', name, phone, email, message }` |
| `app/contact/page.tsx` — PartnershipForm | Partnership application | `{ type: 'partnership', name, phone, email, partner_type, message }` |
| `components/ui/WaitlistForm.tsx` | Digital Credit waitlist | `{ type: 'waitlist', phone }` |

### 5. Deleted Files

| File | Reason |
|------|--------|
| `app/api/contact/route.ts` | Replaced by form-submission-service Lambda |
| `app/api/partnership/route.ts` | Replaced by form-submission-service Lambda |
| `app/api/waitlist/route.ts` | Replaced by form-submission-service Lambda |
| `lib/validation.ts` | Server-side validation moved to Lambda; shared utilities used instead |

### 6. AWS Hosting Infrastructure

**File**: `infrastructure/aws/frontend-hosting.yaml`

Added the following resources for the landing page, following the same pattern as admin-portal and distributor-dashboard:

| Resource | Type | Purpose |
|----------|------|---------|
| `LandingPageBucket` | `AWS::S3::Bucket` | Static file storage (AES256 encryption, versioning in prod, 30-day noncurrent lifecycle) |
| `LandingPageBucketPolicy` | `AWS::S3::BucketPolicy` | CloudFront OAC access only (no public access) |
| `LandingPageOAC` | `AWS::CloudFront::OriginAccessControl` | Secure S3 access (sigv4) |
| `DirectoryIndexFunction` | `AWS::CloudFront::Function` | URI rewriting: `/about/` → `/about/index.html` |
| `LandingPageDistribution` | `AWS::CloudFront::Distribution` | CDN with HTTP/2+3, TLS 1.2, custom error pages |
| `LandingPageDnsRecord` | `AWS::Route53::RecordSet` | `lyniafinance.com` → CloudFront |
| `LandingPageWwwDnsRecord` | `AWS::Route53::RecordSet` | `www.lyniafinance.com` → CloudFront |

**CloudFront configuration**:
- **Aliases**: `lyniafinance.com` + `www.lyniafinance.com` (production), `landing-{env}.lyniafinance.com` (staging/dev)
- **TLS**: ACM certificate, minimum TLS 1.2 (2021 policy)
- **Cache**: CachingOptimized policy for all content
- **Static assets**: Long cache (`/_next/static/*`)
- **Error handling**: 404 → `/404.html`, 403 → `/404.html` (S3 returns 403 for missing objects)
- **Function association**: `DirectoryIndexFunction` on viewer-request

**CloudFront Function** (directory index rewriting):
```javascript
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) { request.uri += 'index.html'; }
  else if (!uri.includes('.')) { request.uri += '/index.html'; }
  return request;
}
```

This is required because S3 with OAC does not auto-resolve directory indices. Without it, requests to `/about/` would return a 403.

**CSP header update** (SecurityHeadersPolicy):
- Removed: `https://*.supabase.co` (Supabase no longer used)
- Added: `https://fonts.gstatic.com` (Google Fonts), `https://*.execute-api.*.amazonaws.com` (API Gateway for forms)

**Outputs**:
- `LandingPageBucketName` — S3 bucket name for CI/CD
- `LandingPageDistributionId` — CloudFront distribution ID for cache invalidation
- `LandingPageDistributionDomain` — CloudFront domain
- `LandingPageUrl` — Final URL (`https://lyniafinance.com` in production)

### 7. CORS Updates

**`services/shared/utils/response.ts`**:
Added `https://lyniafinance.com` and `https://www.lyniafinance.com` to the `ALLOWED_ORIGINS` array, so all existing Lambda functions accept requests from the landing page domain.

**`services/form-submission-service/src/index.ts`**:
Has its own CORS implementation allowing the same origins plus `localhost:3000`/`localhost:3001` in non-production environments.

### 8. CI/CD Pipeline

**File**: `.github/workflows/deploy-frontend.yml`

Extended the existing blue-green frontend deployment workflow with full landing page support.

**Changes**:

| Area | What was added |
|------|---------------|
| **workflow_dispatch inputs** | New `landing-page` and `all` choices (alongside existing `admin-portal`, `distributor-dashboard`, `both`) |
| **Push triggers** | Added `landing-page/frontend/**` to path filters |
| **Build stage** | New build step for landing page (`pnpm --filter "@lynia/landing-page" build`) with `NEXT_PUBLIC_API_URL` env var |
| **Artifact upload** | Landing page build artifact (`landing-page/frontend/out/`) |
| **Deploy stage** | Full **Stage 4: Deploy Landing Page (Blue-Green)** — S3 sync, version tracking, cleanup, CloudFront invalidation, health check |
| **Lint/test/build conditions** | All steps updated to support the `all` option |
| **Deploy conditions** | Admin and distributor deploy stages updated to also trigger on `all` |
| **Notifications** | Landing page failures included in Slack alert and GitHub step summary |

**Blue-green deployment flow** (Stage 4):

```
1. Download build artifact
2. Configure AWS credentials
3. Upload to versioned S3 prefix: s3://{bucket}/deployments/v{timestamp}-{sha}/
4. Switch traffic: sync to root prefix with --delete
5. Record CURRENT_VERSION for rollback
6. Clean old deployments (keep last 5)
7. Invalidate CloudFront cache
8. Health check (HTTP 200/301/302)
```

**Bucket naming**: `{environment}-lynia-landing-page` (matches CloudFormation template)

**Cache headers**:
- HTML/XML/TXT/manifest: `max-age=0, must-revalidate` (always fresh)
- Static assets (JS/CSS/images): `max-age=31536000, immutable` (1 year, fingerprinted)

### 9. TODO(launch) Markers

Placeholder content flagged for replacement before DNS cutover. All discoverable via `grep -r "TODO(launch)"`.

| File | What needs replacing |
|------|---------------------|
| `lib/constants.ts:8` | WhatsApp business number — currently `263XXXXXXXXX` |
| `lib/constants.ts:12` | Twitter and LinkedIn URLs — verify before go-live |
| `lib/editorial-data.ts:1` | Static editorial content — replace with real articles or connect Sanity CMS |
| `app/about/page.tsx:145` | Team section — add real names, roles, and photos |

---

## Files Changed — Complete Inventory

### Commit 1: `3423a05` — Production readiness (merged to master)

| Action | File | Lines |
|--------|------|-------|
| Modified | `landing-page/frontend/next.config.js` | 8 |
| **Created** | `services/form-submission-service/src/index.ts` | 179 |
| **Created** | `services/form-submission-service/package.json` | 23 |
| **Created** | `services/form-submission-service/tsconfig.json` | 25 |
| Modified | `template.yaml` | +60 |
| **Deleted** | `landing-page/frontend/app/api/contact/route.ts` | -50 |
| **Deleted** | `landing-page/frontend/app/api/partnership/route.ts` | -57 |
| **Deleted** | `landing-page/frontend/app/api/waitlist/route.ts` | -34 |
| **Deleted** | `landing-page/frontend/lib/validation.ts` | -33 |
| Modified | `landing-page/frontend/app/contact/page.tsx` | +28/-11 |
| Modified | `landing-page/frontend/components/ui/WaitlistForm.tsx` | +12/-8 |
| Modified | `landing-page/frontend/lib/api.ts` | 19 (rewritten) |
| Modified | `landing-page/frontend/lib/constants.ts` | +3/-1 |
| Modified | `landing-page/frontend/lib/editorial-data.ts` | +2 |
| Modified | `landing-page/frontend/app/about/page.tsx` | +2/-1 |
| Modified | `infrastructure/aws/frontend-hosting.yaml` | +213 |
| Modified | `services/shared/utils/response.ts` | +2 |
| Modified | `landing-page/frontend/TASKS.md` | +81 |
| Modified | `pnpm-lock.yaml` | +40 |

**Totals**: 19 files, +640 insertions, -219 deletions

### Commit 2: `60759ae` — CI/CD pipeline (pending merge)

| Action | File | Lines |
|--------|------|-------|
| Modified | `.github/workflows/deploy-frontend.yml` | +164/-11 |

---

## Deployment Prerequisites

Before the site can go live, the following must be in place:

### AWS Infrastructure (one-time)

| Prerequisite | Status | Action |
|--------------|--------|--------|
| ACM certificate for `lyniafinance.com` + `*.lyniafinance.com` | Required | Must be in **us-east-1** (CloudFront requirement) |
| Route 53 hosted zone for `lyniafinance.com` | Required | Provide `HostedZoneId` parameter to CloudFormation |
| Frontend hosting stack deployed | Required | `aws cloudformation deploy --stack-name {env}-lynia-frontend --template-file infrastructure/aws/frontend-hosting.yaml` |
| SAM stack deployed with FormSubmissionFunction | Required | `sam build && sam deploy` |
| Database migration 014 applied | Required | Ensure `contact_submissions`, `partnership_applications`, `waitlist` tables exist |
| RDS accessible from Lambda VPC | Required | Lambda needs database connectivity |

### GitHub Configuration

| Setting | Location | Value |
|---------|----------|-------|
| `AWS_ACCESS_KEY_ID` | Repository secrets | IAM user with S3 + CloudFront + CloudFormation access |
| `AWS_SECRET_ACCESS_KEY` | Repository secrets | Corresponding secret key |
| `API_URL` | Repository variables | API Gateway invoke URL (e.g., `https://{id}.execute-api.us-east-1.amazonaws.com/prod`) |

### Content (TODO(launch) items)

| Item | File | Current value |
|------|------|---------------|
| WhatsApp number | `lib/constants.ts` | `263XXXXXXXXX` (placeholder) |
| Twitter URL | `lib/constants.ts` | `https://x.com/lyniafinance` (verify) |
| LinkedIn URL | `lib/constants.ts` | `https://linkedin.com/company/lyniafinance` (verify) |
| Team member data | `app/about/page.tsx` | Generic placeholder text |
| Editorial content | `lib/editorial-data.ts` | Sample articles |

---

## Deployment Steps

### Option A: GitHub Actions (recommended)

1. Merge PR from `claude/review-frontend-tasks-l2a7x` to `master`
2. Go to **Actions** → **Deploy Frontend (Blue-Green)** → **Run workflow**
3. Select `environment: production`, `application: landing-page`
4. Monitor workflow run for success
5. Verify at `https://lyniafinance.com`

### Option B: Manual deployment

```bash
# 1. Build with production API URL
cd landing-page/frontend
NEXT_PUBLIC_API_URL=https://{api-id}.execute-api.us-east-1.amazonaws.com/prod pnpm build

# 2. Upload to S3
aws s3 sync out/ s3://production-lynia-landing-page/ --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "*.html" --exclude "*.xml" --exclude "*.txt"

aws s3 sync out/ s3://production-lynia-landing-page/ \
  --cache-control "public, max-age=0, must-revalidate" \
  --include "*.html" --include "*.xml" --include "*.txt"

# 3. Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id {dist-id} --paths "/*"
```

---

## Post-Deployment Verification Checklist

| Check | URL/Command | Expected |
|-------|-------------|----------|
| Homepage loads | `https://lyniafinance.com` | HTTP 200, full page render |
| WWW redirect | `https://www.lyniafinance.com` | Serves or redirects to main domain |
| About page | `https://lyniafinance.com/about/` | HTTP 200 |
| Contact page | `https://lyniafinance.com/contact/` | HTTP 200 |
| Products page | `https://lyniafinance.com/products/` | HTTP 200 |
| Editorial listing | `https://lyniafinance.com/editorial/` | HTTP 200 |
| Privacy policy | `https://lyniafinance.com/privacy/` | HTTP 200 |
| Terms of service | `https://lyniafinance.com/terms/` | HTTP 200 |
| 404 page | `https://lyniafinance.com/nonexistent/` | Custom 404 page |
| SSL certificate | Browser padlock | Valid, issued by Amazon |
| Contact form | Submit test on /contact/ | Success message, row in `contact_submissions` |
| Partnership form | Submit test on /contact/ | Success message, row in `partnership_applications` |
| Waitlist form | Submit phone on homepage | Success message, row in `waitlist` |
| WhatsApp links | Click any WhatsApp CTA | Opens WhatsApp with correct number |
| Social links | Footer Twitter/LinkedIn | Correct profiles load |
| Mobile layout | Viewport 375px | Responsive, hamburger menu works |
| Performance | Lighthouse | Score > 90, FCP < 1.5s |
| Security headers | `curl -I` | HSTS, X-Content-Type-Options, X-Frame-Options, CSP |

---

## Rollback Procedure

If issues are discovered post-deployment:

```bash
# 1. Check previous version
aws s3 cp s3://production-lynia-landing-page/deployments/CURRENT_VERSION -

# 2. List available versions
aws s3 ls s3://production-lynia-landing-page/deployments/

# 3. Restore previous version
aws s3 sync s3://production-lynia-landing-page/deployments/{previous-version}/ \
  s3://production-lynia-landing-page/ --delete --exclude "deployments/*"

# 4. Invalidate cache
aws cloudfront create-invalidation --distribution-id {dist-id} --paths "/*"
```

Up to 5 previous deployment versions are retained in the S3 bucket.

---

## Remaining Work (Post-Launch)

| Priority | Item | Effort |
|----------|------|--------|
| P2 | Connect Sanity CMS for editorial content | Medium |
| P3 | Keyboard navigation accessibility audit | Small |
| P3 | Screen reader testing for forms | Small |
| P3 | WCAG AA color contrast verification | Small |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TODO(launch) placeholders go live | Medium | Low | `grep -r "TODO(launch)"` in deploy pipeline; content review step |
| Form submission Lambda cold starts | Low | Low | 256 MB memory, <15s timeout; acceptable for marketing forms |
| CloudFront Function edge case | Low | Medium | Tested with trailing slash pattern; `/about/` → `/about/index.html` |
| CORS misconfiguration | Low | Medium | Whitelist-based (not `*`); tested in dev with localhost origins |
| Database migration not applied | Low | High | Migration 014 must be run before form Lambda goes live |
| API Gateway URL not set | Medium | High | `NEXT_PUBLIC_API_URL` baked into static build; must rebuild if URL changes |
