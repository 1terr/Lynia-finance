-- Landing page form submissions
-- Tables for contact form, partnership applications, and waitlist signups.

-- Contact form submissions
CREATE TABLE IF NOT EXISTS contact_submissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    email       TEXT,
    message     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partnership applications
CREATE TABLE IF NOT EXISTS partnership_applications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL,
    email         TEXT NOT NULL,
    partner_type  TEXT NOT NULL CHECK (partner_type IN ('distributor', 'b2b', 'other')),
    message       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Digital Credit waitlist
CREATE TABLE IF NOT EXISTS waitlist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone       TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created
    ON contact_submissions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partnership_applications_created
    ON partnership_applications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_waitlist_created
    ON waitlist (created_at DESC);

-- RLS: only service role can insert/read (no public access)
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Service role bypass (the landing page API uses SUPABASE_SERVICE_KEY)
-- No public-facing policies needed since forms go through our API routes.
