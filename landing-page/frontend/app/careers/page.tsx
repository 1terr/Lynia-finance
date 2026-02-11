import type { Metadata } from 'next';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Careers — Lynia Finance',
  description:
    'Build financial tools for Zimbabwe\u2019s underbanked majority. Join the team at Lynia Finance.',
};

const values = [
  {
    title: 'Mission-driven',
    description:
      'Every feature we ship helps real people access credit for the first time. Your work has direct, measurable impact on financial inclusion.',
  },
  {
    title: 'Early stage',
    description:
      'Shape the product and the company from day one. We\u2019re small enough that every person matters and every decision counts.',
  },
  {
    title: 'Zimbabwe-first',
    description:
      'We build for and in Zimbabwe. Local context matters. You\u2019ll work on real problems for real communities.',
  },
  {
    title: 'Remote-friendly',
    description:
      'Work from anywhere. Ship what matters. We care about outcomes, not hours at a desk.',
  },
];

export default function CareersPage() {
  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section
        className="py-16 lg:py-[120px]"
        style={{ background: 'var(--gradient-cta)' }}
      >
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-white/50">
            CAREERS
          </span>
          <h1 className="text-h1-mobile lg:text-display text-white font-medium mt-4 max-w-[720px]">
            Build financial tools for the underbanked
          </h1>
          <p className="text-body-lg text-white/70 mt-6 max-w-[600px]">
            We&apos;re building alternative financial infrastructure for the 80%
            of Zimbabwe&apos;s workforce that traditional banks don&apos;t
            serve.
          </p>
        </div>
      </section>

      {/* Why Lynia */}
      <section className="bg-primary-light py-16 lg:py-[120px]">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            WHY LYNIA
          </span>
          <h2 className="text-h2-mobile lg:text-h2 text-primary-dark font-medium mt-4">
            What it&apos;s like here
          </h2>
          <div className="grid md:grid-cols-2 gap-8 mt-12">
            {values.map((v) => (
              <div
                key={v.title}
                className="bg-white border border-border rounded-lg p-8"
              >
                <h3 className="text-h4 text-primary-dark font-medium">
                  {v.title}
                </h3>
                <p className="text-body text-slate mt-3">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open positions */}
      <section className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          <div className="max-w-[600px] mx-auto text-center">
            <span className="text-overline uppercase tracking-wider text-primary">
              OPEN POSITIONS
            </span>
            <h2 className="text-h2-mobile lg:text-h2 text-primary-dark font-medium mt-4">
              We&apos;re always looking for great people
            </h2>
            <p className="text-body text-slate mt-4">
              We don&apos;t have open positions right now, but we&apos;re always
              interested in hearing from talented people who care about
              financial inclusion in Africa.
            </p>
            <p className="text-body text-slate mt-4">
              Send us a message at{' '}
              <a
                href="mailto:careers@lyniafinance.com"
                className="text-primary hover:text-primary-hover font-medium transition-colors"
              >
                careers@lyniafinance.com
              </a>{' '}
              or reach out on WhatsApp.
            </p>
            <div className="mt-8">
              <Button variant="primary" size="lg" href="/contact">
                Get in touch &rarr;
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
