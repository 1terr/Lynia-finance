'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { SectionLabel } from '@/components/ui/SectionLabel';

export function ThesisSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="thesis" className="bg-white py-16 lg:py-24">
      <div className="container-main">
        <SectionLabel isVisible={isVisible}>THE THESIS</SectionLabel>

        <div className="mt-6 space-y-8">
          {/* The Conviction */}
          <div
            className={`fade-in-slow ${
              isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
            }`}
            style={{ transitionDelay: '60ms' }}
          >
            <h3 className="text-heading-mobile lg:text-heading text-primary-dark">
              The Conviction
            </h3>
            <p className="text-body-lg text-slate max-w-[640px] mt-4">
              We believe transaction velocity is a more accurate predictor of
              creditworthiness than a bank statement.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* The Strategy */}
          <div
            className={`fade-in-slow ${
              isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
            }`}
            style={{ transitionDelay: '180ms' }}
          >
            <h3 className="text-heading-mobile lg:text-heading text-primary-dark">
              The Strategy
            </h3>
            <p className="text-body-lg text-slate max-w-[640px] mt-4">
              We focus exclusively on{' '}
              <span className="font-medium text-primary-dark">
                productive credit
              </span>
              &mdash;funding tools that generate income, supported by insurance
              to protect against economic shocks.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
