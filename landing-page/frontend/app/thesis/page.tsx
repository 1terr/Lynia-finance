import type { Metadata } from 'next';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'The 2026 Thesis — Lynia Finance',
  description:
    'We believe transaction velocity is a more accurate predictor of creditworthiness than a bank statement.',
};

export default function ThesisPage() {
  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section className="bg-white py-16 lg:py-20">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            THE 2026 THESIS
          </span>
          <h1 className="text-display-mobile md:text-hero-tablet lg:text-hero text-primary-dark mt-4 max-w-[780px]">
            Credit infrastructure for the productive majority.
          </h1>
        </div>
      </section>

      {/* The Conviction */}
      <section className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          <div className="max-w-[780px]">
            <h2 className="text-title-mobile md:text-title-tablet lg:text-title text-primary-dark">
              The Conviction
            </h2>
            <p className="text-body-lg text-slate mt-6 leading-relaxed">
              We believe transaction velocity is a more accurate predictor of
              creditworthiness than a bank statement.
            </p>
            <p className="text-body text-slate mt-4 leading-relaxed">
              In Zimbabwe, 97.5% of adults have mobile phones. 9.96 million use
              mobile money actively. Yet 83% remain credit-constrained&mdash;not
              because they lack economic activity, but because the formal system
              cannot see it.
            </p>
            <p className="text-body text-slate mt-4 leading-relaxed">
              Every EcoCash transfer, every Innbucks payment, every OneWallet
              top-up generates a signal. These signals, when read correctly,
              reveal patterns of reliability, consistency, and economic
              productivity that no bank statement can capture.
            </p>
            <p className="text-body text-slate mt-4 leading-relaxed">
              The $10B informal economy is not an absence of economic
              activity&mdash;it is an absence of infrastructure to recognise it.
              Lynia builds that infrastructure.
            </p>
          </div>
        </div>
      </section>

      {/* The Strategy */}
      <section className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          <div className="max-w-[780px]">
            <h2 className="text-title-mobile md:text-title-tablet lg:text-title text-primary-dark">
              The Strategy
            </h2>
            <p className="text-body-lg text-slate mt-6 leading-relaxed">
              We focus exclusively on{' '}
              <span className="font-medium text-primary-dark">
                productive credit
              </span>
              &mdash;funding tools that generate income, supported by insurance
              to protect against economic shocks.
            </p>
            <p className="text-body text-slate mt-4 leading-relaxed">
              Starting with smartphones&mdash;the single most transformative
              productive asset for informal workers&mdash;we use IoT-based risk
              management to substitute traditional collateral with real-time
              asset telemetry. This shifts the paradigm from &ldquo;negative
              collateral&rdquo; to &ldquo;productive trust&rdquo;: funding
              assets that grow cash flow.
            </p>
            <p className="text-body text-slate mt-4 leading-relaxed">
              Every loan is bundled with health and life insurance, creating a
              resilience layer that protects borrowers from the economic shocks
              that derail informal livelihoods. Credit without protection is
              incomplete infrastructure.
            </p>

            <div className="mt-12 grid sm:grid-cols-3 gap-8">
              <div>
                <p className="text-display-mobile text-primary font-medium">97.5%</p>
                <p className="text-body-sm text-slate mt-2">Mobile penetration across Zimbabwe (POTRAZ)</p>
              </div>
              <div>
                <p className="text-display-mobile text-primary font-medium">9.96M</p>
                <p className="text-body-sm text-slate mt-2">Active mobile money accounts (RBZ)</p>
              </div>
              <div>
                <p className="text-display-mobile text-primary font-medium">83%</p>
                <p className="text-body-sm text-slate mt-2">Formally served but credit-constrained (NFIS II)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-16 lg:py-[120px]">
        <div className="container-main text-center">
          <h2 className="text-display-mobile md:text-display-tablet lg:text-display text-primary-dark">
            Build with us.
          </h2>
          <p className="text-body-lg text-slate max-w-[560px] mx-auto mt-6">
            Whether you are an entrepreneur, a distributor, or a platform
            looking to embed credit&mdash;Lynia is built for you.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Button variant="accent" size="lg" href="/contact">
              Get started &rarr;
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
