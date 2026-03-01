'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SystemIllustration } from '@/components/sections/SystemIllustration';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

/* ------------------------------------------------------------------ */
/*  Count-up animation (reuses pattern from DataStrip)                */
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

  useEffect(() => {
    if (!isVisible) return;
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
      <section className="bg-white py-16 lg:py-24">
        <div className="container-main">
          <p
            className="text-overline uppercase tracking-wider text-primary opacity-0 animate-fade-up"
            style={{ animationFillMode: 'forwards' }}
          >
            THE 2026 THESIS
          </p>
          <h1
            className="text-display-mobile md:text-hero-tablet lg:text-hero text-primary-dark mt-4 max-w-[780px] opacity-0 animate-fade-up"
            style={{ animationFillMode: 'forwards', animationDelay: '60ms' }}
          >
            Credit infrastructure for the productive majority.
          </h1>
          <p
            className="text-body-lg text-slate mt-6 max-w-[640px] leading-relaxed opacity-0 animate-fade-up"
            style={{ animationFillMode: 'forwards', animationDelay: '120ms' }}
          >
            We believe transaction velocity is a more accurate predictor of
            creditworthiness than a bank statement.
          </p>
          <p
            className="text-body-sm text-muted mt-4 opacity-0 animate-fade-up"
            style={{ animationFillMode: 'forwards', animationDelay: '180ms' }}
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

            {/* Pull quote */}
            <blockquote
              className={`border-l-4 border-primary pl-6 py-2 mt-8 fade-in ${
                conviction.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
              style={{ transitionDelay: '240ms' }}
            >
              <p className="text-body-lg font-medium text-primary-dark leading-relaxed">
                The $10B informal economy is not an absence of economic
                activity&mdash;it is an absence of infrastructure to recognise
                it. Lynia builds that infrastructure.
              </p>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── Statistics ── */}
      <section ref={statSection.ref} className="bg-primary-dark py-16 lg:py-20">
        <div className="container-main">
          <div className="grid sm:grid-cols-3 gap-8 lg:gap-16 max-w-[780px]">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`fade-in ${
                  statSection.isVisible
                    ? 'fade-in-visible'
                    : 'fade-in-hidden-lg'
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
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
              Every loan is bundled with health and life insurance, creating a
              resilience layer that protects borrowers from the economic shocks
              that derail informal livelihoods.
            </p>

            {/* Pull quote */}
            <blockquote
              className={`border-l-4 border-primary pl-6 py-2 mt-8 fade-in ${
                strategy.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
              style={{ transitionDelay: '240ms' }}
            >
              <p className="text-body-lg font-medium text-primary-dark leading-relaxed">
                Credit without protection is incomplete infrastructure.
              </p>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── Embedded Lending Infrastructure ── */}
      <SystemIllustration />

      {/* ── CTA ── */}
      <section
        ref={cta.ref}
        className="py-16 lg:py-[120px]"
        style={{ background: 'var(--gradient-cta)' }}
      >
        <div className="container-main text-center">
          <h2
            className={`text-display-mobile md:text-display-tablet lg:text-display text-white fade-in ${
              cta.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
            }`}
          >
            Build with us.
          </h2>
          <p
            className={`text-body-lg text-white/70 max-w-[560px] mx-auto mt-6 fade-in ${
              cta.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
            }`}
            style={{ transitionDelay: '60ms' }}
          >
            Whether you are an entrepreneur, a distributor, or a platform
            looking to embed credit&mdash;Lynia is built for you.
          </p>
          <div
            className={`flex flex-wrap justify-center gap-4 mt-8 fade-in ${
              cta.isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
            }`}
            style={{ transitionDelay: '120ms' }}
          >
            <Button variant="white" href="/contact">
              Talk to our team &rarr;
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
