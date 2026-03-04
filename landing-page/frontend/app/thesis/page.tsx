'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SystemIllustration } from '@/components/sections/SystemIllustration';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

/* ------------------------------------------------------------------ */
/*  Count-up animation (matches DataStrip pattern with hasAnimated)   */
/* ------------------------------------------------------------------ */

function CountUp({
  target,
  suffix,
  isVisible,
}: {
  target: number;
  suffix: string;
  isVisible: boolean;
}) {
  const [count, setCount] = useState(0);
  const isDecimal = target % 1 !== 0;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isVisible || hasAnimated.current) return;
    hasAnimated.current = true;

    const duration = 1200;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      setCount(isDecimal ? Math.round(current * 100) / 100 : Math.round(current));
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [isVisible, target, isDecimal]);

  return (
    <span className="tabular-nums">
      {isDecimal ? count.toFixed(2) : count}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats data                                                        */
/* ------------------------------------------------------------------ */

const stats = [
  {
    value: 97.5,
    suffix: '%',
    label: 'Mobile penetration across Zimbabwe',
    source: 'POTRAZ',
  },
  {
    value: 9.96,
    suffix: 'M',
    label: 'Active mobile money accounts',
    source: 'RBZ',
  },
  {
    value: 83,
    suffix: '%',
    label: 'Formally served but credit-constrained',
    source: 'NFIS II',
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function ThesisPage() {
  const conviction = useScrollAnimation();
  const statSection = useScrollAnimation();
  const strategy = useScrollAnimation();
  const cta = useScrollAnimation();

  return (
    <div className="pt-[72px]">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-navy py-20 lg:py-28">
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #0A2540 0%, #0D2E4D 30%, #112B45 60%, #0A2540 100%)',
          }}
        />

        {/* Subtle purple accent overlay */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 70% 40%, rgba(99, 91, 255, 0.15), transparent)',
          }}
        />

        {/* Dot grid pattern */}
        <div className="absolute inset-0 dot-grid opacity-[0.04]" />

        {/* Gradient orbs */}
        <div
          className="gradient-orb hidden md:block animate-float"
          style={{
            width: '500px',
            height: '500px',
            top: '-15%',
            right: '-5%',
            background:
              'radial-gradient(circle, rgba(99, 91, 255, 0.12) 0%, transparent 70%)',
          }}
        />
        <div
          className="gradient-orb hidden md:block animate-float"
          style={{
            width: '400px',
            height: '400px',
            bottom: '-10%',
            left: '-5%',
            background:
              'radial-gradient(circle, rgba(110, 195, 244, 0.08) 0%, transparent 70%)',
            animationDelay: '2s',
          }}
        />

        <div className="container-main relative z-10">
          <p
            className="text-overline uppercase tracking-wider text-primary opacity-0 animate-fade-up"
            style={{ animationFillMode: 'forwards' }}
          >
            THE 2026 THESIS
          </p>
          <h1
            className="text-display-mobile md:text-hero-tablet lg:text-hero text-white mt-4 max-w-[780px] opacity-0 animate-fade-up"
            style={{ animationFillMode: 'forwards', animationDelay: '80ms' }}
          >
            Credit infrastructure for the productive majority.
          </h1>
          <p
            className="text-body-lg text-white/60 mt-6 max-w-[640px] leading-relaxed opacity-0 animate-fade-up"
            style={{ animationFillMode: 'forwards', animationDelay: '160ms' }}
          >
            We believe transaction velocity is a more accurate predictor of
            creditworthiness than a bank statement.
          </p>
          <p
            className="text-body-sm text-white/40 mt-4 opacity-0 animate-fade-up"
            style={{ animationFillMode: 'forwards', animationDelay: '240ms' }}
          >
            March 2026 &middot; 4 min read
          </p>
        </div>
      </section>

      {/* ── The Conviction ── */}
      <section
        ref={conviction.ref}
        className="bg-surface-secondary py-16 lg:py-[120px]"
      >
        <div className="container-main">
          <div className="max-w-[780px]">
            <h2
              className={`text-title-mobile md:text-title-tablet lg:text-title text-primary-dark fade-in ${
                conviction.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
            >
              The Conviction
            </h2>
            <p
              className={`text-body-lg text-slate mt-6 leading-relaxed fade-in ${
                conviction.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
              style={{ transitionDelay: '60ms' }}
            >
              We believe transaction velocity is a more accurate predictor of
              creditworthiness than a bank statement.
            </p>
            <p
              className={`text-body text-slate mt-4 leading-relaxed fade-in ${
                conviction.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
              style={{ transitionDelay: '120ms' }}
            >
              In Zimbabwe, 97.5% of adults have mobile phones. 9.96 million use
              mobile money actively. Yet 83% remain credit-constrained&mdash;not
              because they lack economic activity, but because the formal system
              cannot see it.
            </p>
            <p
              className={`text-body text-slate mt-4 leading-relaxed fade-in ${
                conviction.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
              style={{ transitionDelay: '180ms' }}
            >
              Every EcoCash transfer, every Innbucks payment, every OneWallet
              top-up generates a signal. These signals, when read correctly,
              reveal patterns of reliability, consistency, and economic
              productivity that no bank statement can capture.
            </p>

            {/* Pull quote — dark card */}
            <div
              className={`mt-8 rounded-xl p-6 lg:p-8 bg-navy relative overflow-hidden shadow-stripe-sm fade-in ${
                conviction.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
              style={{ transitionDelay: '240ms' }}
            >
              <div className="absolute inset-0 line-grid opacity-50" />
              <div className="relative z-10">
                <p className="text-body-lg font-medium text-white leading-relaxed">
                  &ldquo;The $10B informal economy is not an absence of economic
                  activity&mdash;it is an absence of infrastructure to recognise
                  it.&rdquo;
                </p>
                <p className="text-caption text-white/40 mt-4">
                  Lynia builds that infrastructure.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Statistics ── */}
      <section
        ref={statSection.ref}
        className="relative overflow-hidden bg-navy py-16 lg:py-24"
      >
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #0A2540 0%, #0D2E4D 40%, #112B45 70%, #0A2540 100%)',
          }}
        />

        {/* Dot grid */}
        <div className="absolute inset-0 dot-grid opacity-[0.03]" />

        {/* Gradient orb */}
        <div
          className="gradient-orb hidden md:block"
          style={{
            width: '350px',
            height: '350px',
            top: '-20%',
            right: '10%',
            background:
              'radial-gradient(circle, rgba(99, 91, 255, 0.10) 0%, transparent 70%)',
          }}
        />

        <div className="container-main relative z-10">
          <div className="grid sm:grid-cols-3 gap-6 lg:gap-8 max-w-[780px]">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`bg-white/[0.06] border border-white/[0.08] rounded-xl p-6 fade-in ${
                  statSection.isVisible
                    ? 'fade-in-visible'
                    : 'fade-in-hidden-lg'
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="w-8 h-0.5 bg-primary rounded-full mb-4" />
                <p className="text-stat-mobile md:text-stat-tablet lg:text-stat text-white tabular-nums">
                  <CountUp
                    target={stat.value}
                    suffix={stat.suffix}
                    isVisible={statSection.isVisible}
                  />
                </p>
                <p className="text-body-sm text-white/60 mt-2">
                  {stat.label}
                </p>
                <p className="text-caption text-white/40 mt-1">
                  {stat.source}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Strategy ── */}
      <section
        ref={strategy.ref}
        className="bg-white py-16 lg:py-[120px]"
      >
        <div className="container-main">
          <div className="max-w-[780px]">
            <h2
              className={`text-title-mobile md:text-title-tablet lg:text-title text-primary-dark fade-in ${
                strategy.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
            >
              The Strategy
            </h2>
            <p
              className={`text-body-lg text-slate mt-6 leading-relaxed fade-in ${
                strategy.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
              style={{ transitionDelay: '60ms' }}
            >
              We focus exclusively on{' '}
              <span className="font-medium text-primary-dark">
                productive credit
              </span>
              &mdash;funding tools that generate income, supported by insurance
              to protect against economic shocks.
            </p>
            <p
              className={`text-body text-slate mt-4 leading-relaxed fade-in ${
                strategy.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
              style={{ transitionDelay: '120ms' }}
            >
              Starting with smartphones&mdash;the single most transformative
              productive asset for informal workers&mdash;we use IoT-based risk
              management to substitute traditional collateral with real-time
              asset telemetry. This shifts the paradigm from &ldquo;negative
              collateral&rdquo; to &ldquo;productive trust&rdquo;: funding
              assets that grow cash flow.
            </p>
            <p
              className={`text-body text-slate mt-4 leading-relaxed fade-in ${
                strategy.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
              style={{ transitionDelay: '180ms' }}
            >
              Loans are bundled with insurance, creating a resilience layer
              that protects borrowers from the economic shocks that derail
              informal livelihoods.
            </p>

            {/* Pull quote — dark card */}
            <div
              className={`mt-8 rounded-xl p-6 lg:p-8 bg-navy relative overflow-hidden shadow-stripe-sm fade-in ${
                strategy.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
              style={{ transitionDelay: '240ms' }}
            >
              <div className="absolute inset-0 line-grid opacity-50" />
              <div className="relative z-10">
                <p className="text-body-lg font-medium text-white leading-relaxed">
                  &ldquo;Credit without protection is incomplete
                  infrastructure.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Embedded Lending Infrastructure ── */}
      <SystemIllustration />

      {/* ── CTA ── */}
      <section
        ref={cta.ref}
        className="relative overflow-hidden bg-navy py-20 lg:py-28"
      >
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #0A2540 0%, #0D2E4D 40%, #112B45 70%, #0A2540 100%)',
          }}
        />

        {/* Dot grid */}
        <div className="absolute inset-0 dot-grid opacity-[0.03]" />

        {/* Gradient orbs */}
        <div
          className="gradient-orb hidden md:block"
          style={{
            width: '400px',
            height: '400px',
            top: '-20%',
            right: '10%',
            background:
              'radial-gradient(circle, rgba(99, 91, 255, 0.10) 0%, transparent 70%)',
          }}
        />
        <div
          className="gradient-orb hidden md:block"
          style={{
            width: '300px',
            height: '300px',
            bottom: '-15%',
            left: '5%',
            background:
              'radial-gradient(circle, rgba(110, 195, 244, 0.06) 0%, transparent 70%)',
          }}
        />

        <div className="container-main relative z-10 text-center">
          <h2
            className={`text-display-mobile md:text-display-tablet lg:text-display text-white mx-auto max-w-[640px] fade-in ${
              cta.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
            }`}
          >
            Build with us.
          </h2>
          <p
            className={`text-body-lg text-white/60 max-w-[540px] mx-auto mt-6 fade-in ${
              cta.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
            }`}
            style={{ transitionDelay: '60ms' }}
          >
            Whether you are an entrepreneur, a distributor, or a platform
            looking to embed credit&mdash;Lynia is built for you.
          </p>
          <div
            className={`flex flex-wrap justify-center gap-4 mt-10 fade-in ${
              cta.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
            }`}
            style={{ transitionDelay: '120ms' }}
          >
            <Button variant="accent" href="/contact" arrow>
              Talk to our team
            </Button>
            <Button variant="ghost" href="/#products">
              View our products
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
