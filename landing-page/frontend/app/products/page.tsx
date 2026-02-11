'use client';

import { Button } from '@/components/ui/Button';

/* ─── Asset Financing steps ─── */
const assetSteps = [
  { number: '01', title: 'Apply via WhatsApp', description: 'Send us a message. Tell us what you need. The entire application takes under 2 minutes.' },
  { number: '02', title: 'Get approved in under 5 minutes', description: 'We check your eligibility using mobile money data. No payslips. No bank statements.' },
  { number: '03', title: 'Collect from a local agent', description: 'Pick up your device from a Lynia agent near you. Over 50 locations across Zimbabwe.' },
  { number: '04', title: 'Repay via mobile money', description: 'Pay back through EcoCash, OneMoney, or Innbucks. Flexible schedule, no penalty for early repayment.' },
];

const assetFeatures = [
  { title: 'Deposit as low as $15', description: 'Start with a small deposit. The device is yours from day one \u2014 no collateral required.' },
  { title: 'Pick up from 50+ agents', description: 'Collect your device from a Lynia agent in your area. Growing network across Zimbabwe.' },
  { title: 'Approved in under 5 min', description: 'Apply via WhatsApp. AI-powered credit scoring delivers decisions in minutes, not days.' },
  { title: 'Repay via EcoCash or OneMoney', description: 'Flexible repayment through the mobile wallet you already use. No bank account needed.' },
];

/* ─── Digital Credit steps ─── */
const creditSteps = [
  { number: '01', title: 'Apply on WhatsApp', description: 'Tell us how much you need. One message.' },
  { number: '02', title: 'Get scored in seconds', description: 'We assess your eligibility using mobile money transaction data.' },
  { number: '03', title: 'Cash in your wallet', description: 'Funds deposited directly into your mobile wallet. Under 10 minutes.' },
];

const creditFeatures = [
  { title: 'Application to wallet in minutes', description: 'From application to cash in your wallet \u2014 under 10 minutes. No paperwork, no branch visit.' },
  { title: 'EcoCash and OneMoney supported', description: 'Receive and repay through the mobile money wallet you already use. Repayment is automated and flexible.' },
];

/* ─── Enterprise steps ─── */
const enterpriseSteps = [
  { number: '01', title: 'Integrate our APIs', description: 'A few API calls to embed credit into your platform.' },
  { number: '02', title: 'Your users apply at point of sale', description: 'Customers access financing without leaving your app.' },
  { number: '03', title: 'Lynia handles the rest', description: 'Underwriting, disbursement, collections, and risk. You earn on every transaction.' },
];

const enterpriseFeatures = [
  { title: 'Revenue on every transaction', description: 'Earn commission on every loan originated through your platform. We handle risk, you earn recurring revenue.' },
  { title: 'Developer-ready APIs', description: 'Integrate credit products with a few API calls. Real-time dashboards for disbursements, repayments, and portfolio risk.' },
  { title: 'We handle the hard parts', description: 'Underwriting, KYC, collections, and compliance \u2014 all managed by Lynia. You focus on your customers.' },
];

export default function ProductsPage() {
  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section
        className="py-16 lg:py-[120px]"
        style={{ background: 'var(--gradient-cta)' }}
      >
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-white/50">
            OUR PRODUCTS
          </span>
          <h1 className="text-h1-mobile lg:text-display text-white font-medium mt-4 max-w-[720px]">
            Three products. One mission.
          </h1>
          <p className="text-body-lg text-white/70 mt-6 max-w-[600px]">
            Smartphones, instant credit, and embedded finance &mdash; built for
            Zimbabwe&apos;s 80% informal workforce.
          </p>

          {/* Jump links */}
          <div className="flex flex-wrap gap-4 mt-10">
            <a
              href="#asset-financing"
              className="h-11 px-6 inline-flex items-center rounded-md border border-white/30 text-body-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Asset Financing
            </a>
            <a
              href="#digital-credit"
              className="h-11 px-6 inline-flex items-center rounded-md border border-white/30 text-body-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Digital Credit
            </a>
            <a
              href="#enterprise"
              className="h-11 px-6 inline-flex items-center rounded-md border border-white/30 text-body-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Enterprise
            </a>
          </div>
        </div>
      </section>

      {/* ─── Asset Financing ─── */}
      <section id="asset-financing" className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            ASSET FINANCING
          </span>
          <h2 className="text-h1-mobile lg:text-h1 text-primary-dark font-medium mt-4 max-w-[720px]">
            Own the tools that power your trade
          </h2>
          <p className="text-body-lg text-slate mt-6 max-w-[640px]">
            Finance smartphones and productive assets with a small deposit.
            Collect from a local agent, repay via mobile money. Built for
            traders, vendors, and entrepreneurs who need tools to earn.
          </p>

          <div className="mt-16">
            <h3 className="text-h4 text-primary-dark font-medium mb-8">How it works</h3>
            <div className="grid md:grid-cols-4 gap-8">
              {assetSteps.map((step, i) => (
                <div key={step.number} className="relative">
                  {i < assetSteps.length - 1 && (
                    <div className="hidden md:block absolute top-5 left-[calc(50%+28px)] right-[-28px] h-[2px] bg-primary/15" />
                  )}
                  <div className="text-center">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-body-sm font-medium text-primary mb-4">
                      {step.number}
                    </span>
                    <h4 className="text-h5 text-primary-dark font-medium">{step.title}</h4>
                    <p className="text-body-sm text-slate mt-2">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16">
            <h3 className="text-h4 text-primary-dark font-medium mb-8">Features</h3>
            <div className="grid sm:grid-cols-2 gap-8">
              {assetFeatures.map((f) => (
                <div key={f.title} className="border border-border rounded-lg p-6">
                  <h4 className="text-h5 text-primary-dark font-medium">{f.title}</h4>
                  <p className="text-body-sm text-slate mt-2">{f.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <Button variant="primary" size="lg" href="https://wa.me/263">
              Start your application
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Digital Credit ─── */}
      <section id="digital-credit" className="bg-navy py-16 lg:py-[120px]">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            DIGITAL CREDIT
          </span>
          <h2 className="text-h1-mobile lg:text-h1 text-white font-medium mt-4 max-w-[720px]">
            Cash when you need it most
          </h2>
          <p className="text-body-lg text-white/70 mt-6 max-w-[640px]">
            Instant digital loans deposited directly into your mobile wallet.
            Apply via WhatsApp, get funded in under 10 minutes. Designed for
            everyday needs and working capital.
          </p>

          <div className="mt-16">
            <h3 className="text-h4 text-white font-medium mb-8">How it works</h3>
            <div className="grid md:grid-cols-3 gap-8">
              {creditSteps.map((step, i) => (
                <div key={step.number} className="relative">
                  {i < creditSteps.length - 1 && (
                    <div className="hidden md:block absolute top-5 left-[calc(50%+28px)] right-[-28px] h-[2px] bg-white/15" />
                  )}
                  <div className="text-center">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-body-sm font-medium text-white mb-4">
                      {step.number}
                    </span>
                    <h4 className="text-h5 text-white font-medium">{step.title}</h4>
                    <p className="text-body-sm text-white/70 mt-2">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16">
            <h3 className="text-h4 text-white font-medium mb-8">Features</h3>
            <div className="grid sm:grid-cols-2 gap-8">
              {creditFeatures.map((f) => (
                <div key={f.title} className="border border-white/15 rounded-lg p-6">
                  <h4 className="text-h5 text-white font-medium">{f.title}</h4>
                  <p className="text-body-sm text-white/70 mt-2">{f.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <p className="text-body-sm text-white/50 mb-3">Coming soon</p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-[480px]" onSubmit={(e: React.FormEvent) => e.preventDefault()}>
              <input
                type="tel"
                placeholder="+263 7XX XXX XXX"
                className="h-11 px-4 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-body-sm focus:border-primary focus:outline-none flex-1"
              />
              <button
                type="submit"
                className="h-11 px-6 rounded-md bg-primary text-white text-body-sm font-medium hover:bg-primary-hover transition-colors whitespace-nowrap"
              >
                Get notified &rarr;
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ─── Enterprise ─── */}
      <section id="enterprise" className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            ENTERPRISE PARTNERSHIPS
          </span>
          <h2 className="text-h1-mobile lg:text-h1 text-primary-dark font-medium mt-4 max-w-[720px]">
            Embed credit into your platform
          </h2>
          <p className="text-body-lg text-slate mt-6 max-w-[640px]">
            Offer your customers financing at the point of need. Distributors,
            retailers, and platforms integrate Lynia to unlock new revenue &mdash;
            we handle underwriting, disbursement, and collections.
          </p>

          <div className="mt-16">
            <h3 className="text-h4 text-primary-dark font-medium mb-8">How it works</h3>
            <div className="grid md:grid-cols-3 gap-8">
              {enterpriseSteps.map((step, i) => (
                <div key={step.number} className="relative">
                  {i < enterpriseSteps.length - 1 && (
                    <div className="hidden md:block absolute top-5 left-[calc(50%+28px)] right-[-28px] h-[2px] bg-primary/15" />
                  )}
                  <div className="text-center">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-body-sm font-medium text-primary mb-4">
                      {step.number}
                    </span>
                    <h4 className="text-h5 text-primary-dark font-medium">{step.title}</h4>
                    <p className="text-body-sm text-slate mt-2">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16">
            <h3 className="text-h4 text-primary-dark font-medium mb-8">Features</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {enterpriseFeatures.map((f) => (
                <div key={f.title} className="border border-border rounded-lg p-6">
                  <h4 className="text-h5 text-primary-dark font-medium">{f.title}</h4>
                  <p className="text-body-sm text-slate mt-2">{f.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <Button variant="primary" size="lg" href="/contact">
              Partner with us
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
            Apply now. Get funded today.
          </h2>
          <p className="text-body-lg text-white/70 max-w-[600px] mx-auto mt-6">
            No bank account required. No paperwork. No branch visits. Just
            WhatsApp, your national ID, and 5 minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Button variant="white" size="lg" href="https://wa.me/263">
              Start your application
            </Button>
            <Button variant="ghost" size="lg" href="/contact">
              Talk to our team &rarr;
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
