# Supabase Domain Configuration — lyniafinance.com

## Current State

| Setting | Current Value |
|---------|--------------|
| Supabase URL | `https://ghdrnxlsupbzoddtyxcp.supabase.co` |
| Auth Callback | Default Supabase URLs |
| Frontend SDK | Points to `*.supabase.co` |

---

## Option A: Keep Default Supabase Domain (Recommended for Launch)

For initial launch, keeping the default Supabase domain is the simplest approach.
Custom domains require the Supabase **Pro plan** ($25/month) and add operational
complexity without significant user-facing benefit.

### What to Do

1. **Keep** `SUPABASE_URL` pointing to `*.supabase.co`
2. **Update** Supabase Auth allowed redirect URLs
3. **Verify** CSP headers allow connections to `*.supabase.co`

### Update Auth Redirect URLs

In Supabase Dashboard → Authentication → URL Configuration:

```
Site URL:
  https://admin.lyniafinance.com

Redirect URLs (add all):
  https://admin.lyniafinance.com/**
  https://distributor.lyniafinance.com/**
  https://localhost:3000/**
  https://localhost:3001/**
```

### Verify CSP Headers

The frontend CSP must allow connections to Supabase. Both the Next.js config
and CloudFront response headers should include:

```
connect-src 'self' https://*.lyniafinance.com https://*.supabase.co
```

Next.js CSP (admin-portal/next.config.js line 42) has been updated to:
```javascript
"connect-src 'self' https://*.supabase.co https://*.lyniafinance.com",
```

---

## Option B: Custom Supabase Domain (Future Enhancement)

If you later want `db.lyniafinance.com` to point to Supabase:

### Prerequisites

- Supabase **Pro plan** or higher
- Access to Cloudflare DNS

### Steps

1. In Supabase Dashboard → Settings → General → Custom Domains
2. Enter: `db.lyniafinance.com`
3. Supabase provides a CNAME target and a TXT verification record

4. Add to Cloudflare DNS:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `db` | `<supabase-provided-target>.supabase.co` | DNS only (grey) |
| TXT | `_supabase-challenge.db` | `<verification-token>` | N/A |

5. Wait for Supabase to verify (up to 24 hours)
6. Once verified, Supabase provisions an SSL certificate automatically

7. Update application config:
```
SUPABASE_URL=https://db.lyniafinance.com
NEXT_PUBLIC_SUPABASE_URL=https://db.lyniafinance.com
```

8. Update CSP headers to include `db.lyniafinance.com` (already covered by `*.lyniafinance.com`)

### Considerations for Custom Domain

| Aspect | Default | Custom Domain |
|--------|---------|---------------|
| Cost | Included | Pro plan required |
| Setup complexity | None | Medium |
| User visibility | Users see `supabase.co` in network tab | Users see `lyniafinance.com` |
| SSL | Managed by Supabase | Managed by Supabase (automatic) |
| Failover | Supabase handles | You manage DNS |
| Connection pooling | Works on port 6543 | Works on port 6543 |

**Recommendation**: Use Option A for launch, migrate to Option B after the
platform is stable and if the team decides the branding benefit justifies the
Pro plan cost.

---

## Supabase Environment Variables

### Production (.env or Secrets Manager)

```bash
# Backend (Lambda functions)
SUPABASE_URL=https://ghdrnxlsupbzoddtyxcp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<stored-in-secrets-manager>

# Database pooling
DATABASE_POOLER_URL=postgresql://postgres:<password>@db.ghdrnxlsupbzoddtyxcp.supabase.co:6543/postgres
DATABASE_DIRECT_URL=postgresql://postgres:<password>@db.ghdrnxlsupbzoddtyxcp.supabase.co:5432/postgres

# Frontend (public)
NEXT_PUBLIC_SUPABASE_URL=https://ghdrnxlsupbzoddtyxcp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

### If Using Custom Domain (Option B)

```bash
SUPABASE_URL=https://db.lyniafinance.com
NEXT_PUBLIC_SUPABASE_URL=https://db.lyniafinance.com
# Pooler and direct URLs remain the same (custom domain is for API/Auth only)
```

---

## Supabase Auth Configuration Checklist

- [ ] Site URL set to `https://admin.lyniafinance.com`
- [ ] All production redirect URLs added
- [ ] JWT expiry configured (recommended: 1 hour access, 7 day refresh)
- [ ] Email templates updated with lyniafinance.com branding
- [ ] Rate limiting enabled on auth endpoints
- [ ] Confirm email enabled for production
- [ ] Phone auth configured (if using OTP via Supabase)
