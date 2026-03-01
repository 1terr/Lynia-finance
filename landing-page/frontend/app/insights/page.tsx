import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Insights — Lynia Finance',
  description:
    'News, coverage, and updates about Lynia Finance and financial inclusion in Zimbabwe.',
};

const pressReleases = [
  {
    date: 'February 2026',
    headline:
      'Lynia Finance launches WhatsApp-based smartphone financing for informal traders across Zimbabwe.',
    description:
      'The fintech startup is using mobile money data to underwrite loans for entrepreneurs who have never had access to formal credit. Starting with smartphones, the company plans to expand into broader productive asset financing.',
  },
  {
    date: 'January 2026',
    headline:
      'How mobile money velocity is replacing bank statements as the new credit score in Africa.',
    description:
      'Lynia Finance is pioneering a new approach to credit scoring that analyzes transaction patterns across EcoCash, Innbucks, and other mobile money platforms to build credit identities for the unbanked.',
  },
  {
    date: 'December 2025',
    headline:
      'Zimbabwe fintech bridges the $14B credit gap with IoT-backed asset lending and embedded insurance.',
    description:
      'By combining real-time asset telemetry with mobile money disbursement, Lynia Finance is creating a new category of productive credit for Zimbabwe\'s $10B informal economy.',
  },
];

export default function InsightsPage() {
  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section className="bg-white py-16 lg:py-20">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            INSIGHTS
          </span>
          <h1 className="text-display-mobile md:text-display-tablet lg:text-display text-primary-dark mt-4">
            In the news
          </h1>
          <p className="text-body-lg text-slate mt-4 max-w-[600px]">
            Coverage, press releases, and updates about Lynia Finance and
            financial inclusion in Zimbabwe.
          </p>
        </div>
      </section>

      {/* Insights list */}
      <section className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          <div className="max-w-[780px]">
            {pressReleases.map((item, i) => (
              <div
                key={i}
                className="border-b border-border py-8 first:pt-0 last:border-b-0"
              >
                <p className="text-caption text-slate-light uppercase tracking-wider">
                  {item.date}
                </p>
                <h2 className="text-heading-mobile lg:text-heading text-primary-dark mt-3">
                  {item.headline}
                </h2>
                <p className="text-body text-slate mt-4">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="max-w-[780px] mt-12 p-6 bg-primary-light rounded-lg">
            <p className="text-body-sm font-medium text-primary-dark">
              Media inquiries
            </p>
            <p className="text-body-sm text-slate mt-2">
              For press inquiries, partnership announcements, or interview
              requests, contact us at{' '}
              <a
                href="mailto:press@lyniafinance.com"
                className="text-primary hover:text-primary-hover transition-colors"
              >
                press@lyniafinance.com
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
