import type { Metadata } from 'next';
import { Button } from '@/components/ui/Button';
import { WHATSAPP_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'About — Lynia Finance',
  description:
    'Lynia Finance provides alternative financial infrastructure for Zimbabwe\'s underbanked majority. Learn about our mission to serve the 80% informal workforce.',
  openGraph: {
    title: 'About — Lynia Finance',
    description:
      'Lynia Finance provides alternative financial infrastructure for Zimbabwe\'s underbanked majority. Learn about our mission to serve the 80% informal workforce.',
    url: '/about',
  },
};

const values = [
  {
    title: 'Financial inclusion',
    description:
      'Every product we build starts with one question: does this help someone who has no other option? We serve the 80% — traders, vendors, and families who have been excluded from traditional finance.',
  },
  {
    title: 'Trust through transparency',
    description:
      'No hidden fees, no complex terms. Our users know exactly what they owe, when it\'s due, and how to pay. Clear language, honest pricing, instant receipts.',
  },
  {
    title: 'Local-first design',
    description:
      'We build for Zimbabwe\'s reality: low-end smartphones, intermittent connectivity, mobile money wallets, and communities where a handshake still matters.',
  },
  {
    title: 'Technology with empathy',
    description:
      'AI-powered credit scoring that looks beyond bank statements. WhatsApp-first interfaces that meet people where they are. Speed that respects how urgently people need capital.',
  },
];

const stats = [
  { value: '80%', label: 'of Zimbabwe works informally' },
  { value: '<5 min', label: 'average approval time' },
  { value: '100%', label: 'mobile money repayment' },
  { value: '50+', label: 'collection agents nationwide' },
];

export default function AboutPage() {
  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section
        className="py-16 lg:py-[120px]"
        style={{ background: 'var(--gradient-cta)' }}
      >
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-white/50">
            ABOUT LYNIA FINANCE
          </span>
          <h1 className="text-h1-mobile lg:text-display text-white font-medium mt-4 max-w-[720px]">
            Credit infrastructure for Africa&apos;s underbanked majority
          </h1>
          <p className="text-body-lg text-white/70 mt-6 max-w-[600px]">
            We believe that access to credit should not depend on having a bank
            account, a credit history, or a formal employer. Lynia builds the
            financial tools that traditional banks won&apos;t.
          </p>
        </div>
      </section>

      {/* The problem */}
      <section className="bg-white py-16 lg:py-20">
        <div className="container-main">
          <div className="max-w-narrow">
            <span className="text-overline uppercase tracking-wider text-primary">
              WHY WE EXIST
            </span>
            <h2 className="text-h2-mobile lg:text-h2 text-primary-dark font-medium mt-4">
              The underbanked problem
            </h2>
            <div className="space-y-4 mt-6 text-body text-slate">
              <p>
                In Zimbabwe, 80% of the working population operates in the
                informal economy. They earn a living, support families, and run
                small businesses — but have no access to credit, no bank
                accounts, and no way to finance the tools they need to grow.
              </p>
              <p>
                Traditional banks require collateral, formal employment, and
                credit histories that most Zimbabweans simply don&apos;t have.
                Microfinance institutions charge prohibitive interest rates. The
                result: millions of people locked out of the financial system.
              </p>
              <p>
                Lynia Finance is building the alternative. Using mobile money,
                WhatsApp, and AI-powered credit scoring, we deliver smartphones,
                assets, and instant cash to the people who need them most —
                without a single branch visit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-primary-light py-16 lg:py-20">
        <div className="container-main">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-h1-mobile lg:text-h1 text-primary font-medium">
                  {s.value}
                </p>
                <p className="text-body-sm text-slate mt-2">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            OUR VALUES
          </span>
          <h2 className="text-h2-mobile lg:text-h2 text-primary-dark font-medium mt-4">
            What drives us
          </h2>
          <div className="grid md:grid-cols-2 gap-8 mt-12">
            {values.map((v) => (
              <div
                key={v.title}
                className="border border-border rounded-lg p-8"
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

      {/* Team placeholder */}
      <section className="bg-primary-light py-16 lg:py-20">
        <div className="container-main">
          <div className="text-center max-w-[600px] mx-auto">
            <span className="text-overline uppercase tracking-wider text-primary">
              OUR TEAM
            </span>
            <h2 className="text-h2-mobile lg:text-h2 text-primary-dark font-medium mt-4">
              Built by people who understand the problem
            </h2>
            <p className="text-body text-slate mt-4">
              Our team combines fintech engineering, microfinance experience,
              and deep knowledge of Zimbabwean markets. We&apos;re based in
              Harare, building for the communities we serve.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section
        className="py-16 lg:py-[120px]"
        style={{ background: 'var(--gradient-cta)' }}
      >
        <div className="container-main text-center">
          <h2 className="text-h1-mobile lg:text-h1 text-white font-medium">
            Join the mission
          </h2>
          <p className="text-body-lg text-white/70 max-w-[520px] mx-auto mt-4">
            Whether you&apos;re an individual looking for credit, a distributor
            looking to earn, or a company looking to partner — we&apos;d love to
            hear from you.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Button variant="white" size="lg" href={WHATSAPP_URL}>
              Start your application
            </Button>
            <Button variant="ghost" size="lg" href="/contact">
              Contact us &rarr;
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
