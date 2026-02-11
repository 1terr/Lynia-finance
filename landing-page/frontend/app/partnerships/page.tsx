import type { Metadata } from 'next';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Partnerships — Lynia Finance',
  description:
    'Sell devices in your community or embed credit into your platform. Partner with Lynia Finance.',
  openGraph: {
    title: 'Partnerships — Lynia Finance',
    description:
      'Sell devices in your community or embed credit into your platform. Partner with Lynia Finance.',
    url: '/partnerships',
  },
};

const distributorBenefits = [
  'Commission on every sale',
  'Training and onboarding',
  'Marketing materials',
  'Dedicated support',
];

const distributorRequirements = [
  'Registered business or physical location',
  'Active mobile money account',
  'Ability to serve customers in your area',
];

const integrationOptions = [
  'Developer-ready APIs',
  'Real-time monitoring',
  'Sandbox environment',
  'Dedicated integration support',
];

const revenueModel = [
  'Earn on every funded transaction',
  'No upfront costs',
  'Performance dashboard',
];

export default function PartnershipsPage() {
  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section
        className="py-16 lg:py-[120px]"
        style={{ background: 'var(--gradient-cta)' }}
      >
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-white/50">
            PARTNERSHIPS
          </span>
          <h1 className="text-h1-mobile lg:text-display text-white font-medium mt-4 max-w-[720px]">
            Grow with Lynia Finance
          </h1>
          <p className="text-body-lg text-white/70 mt-6 max-w-[600px]">
            Sell devices in your community or embed credit into your platform.
            We handle the financing.
          </p>
        </div>
      </section>

      {/* For Distributors */}
      <section className="bg-primary-light py-16 lg:py-[120px]">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            FOR DISTRIBUTORS
          </span>
          <div className="grid lg:grid-cols-2 gap-12 mt-8">
            <div>
              <h2 className="text-h2-mobile lg:text-h2 text-primary-dark font-medium">
                Sell smartphones and assets in your community
              </h2>
              <p className="text-body text-slate mt-4">
                Earn commission on every sale. Carry Lynia-financed inventory at
                zero risk &mdash; we own the stock until the customer completes
                payment. You earn, your community gets access.
              </p>
              <h3 className="text-h5 text-primary-dark font-medium mt-8">
                Who it&apos;s for
              </h3>
              <ul className="mt-3 space-y-2">
                {['Phone shops', 'General dealers', 'Community leaders', 'Anyone with a customer base'].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-body text-slate">
                    <span className="text-primary mt-1">&bull;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-8">
              <div className="bg-white border border-border rounded-lg p-8">
                <h3 className="text-h5 text-primary-dark font-medium">What you get</h3>
                <ul className="mt-4 space-y-3">
                  {distributorBenefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-body text-slate">
                      <span className="text-primary mt-1">&bull;</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white border border-border rounded-lg p-8">
                <h3 className="text-h5 text-primary-dark font-medium">Requirements</h3>
                <ul className="mt-4 space-y-3">
                  {distributorRequirements.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-body text-slate">
                      <span className="text-primary mt-1">&bull;</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <Button variant="primary" size="lg" href="/contact">
              Become a distributor &rarr;
            </Button>
          </div>
        </div>
      </section>

      {/* For Businesses & Platforms */}
      <section className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            FOR BUSINESSES &amp; PLATFORMS
          </span>
          <div className="grid lg:grid-cols-2 gap-12 mt-8">
            <div>
              <h2 className="text-h2-mobile lg:text-h2 text-primary-dark font-medium">
                Embed credit into your platform
              </h2>
              <p className="text-body text-slate mt-4">
                Offer your customers financing at the point of need. Lynia
                handles underwriting, disbursement, and collections &mdash; you
                earn on every transaction.
              </p>
            </div>

            <div className="space-y-8">
              <div className="border border-border rounded-lg p-8">
                <h3 className="text-h5 text-primary-dark font-medium">Integration options</h3>
                <ul className="mt-4 space-y-3">
                  {integrationOptions.map((o) => (
                    <li key={o} className="flex items-start gap-2 text-body text-slate">
                      <span className="text-primary mt-1">&bull;</span>
                      {o}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border border-border rounded-lg p-8">
                <h3 className="text-h5 text-primary-dark font-medium">Revenue model</h3>
                <ul className="mt-4 space-y-3">
                  {revenueModel.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-body text-slate">
                      <span className="text-primary mt-1">&bull;</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <Button variant="primary" size="lg" href="/contact">
              Partner with us &rarr;
            </Button>
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
            Ready to partner?
          </h2>
          <p className="text-body-lg text-white/70 max-w-[520px] mx-auto mt-4">
            Get in touch and we&apos;ll walk you through the process.
          </p>
          <div className="mt-8">
            <Button variant="white" size="lg" href="/contact">
              Talk to our team &rarr;
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
