'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';

export function ThesisSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="thesis" className="bg-white py-16 lg:py-[120px]">
      <div className="container-main">
        <div className="max-w-[780px] mx-auto">
          <span
            className={`text-overline uppercase tracking-wider text-primary transition-all duration-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            THE THESIS
          </span>

          <div className="mt-8 space-y-10">
            {/* The Conviction */}
            <div
              className={`transition-all duration-600 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: '100ms' }}
            >
              <h3 className="text-h3-mobile lg:text-h3 text-primary-dark font-medium">
                The Conviction
              </h3>
              <p className="text-body-lg text-slate mt-4">
                We believe transaction velocity is a more accurate predictor of
                creditworthiness than a bank statement.
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* The Strategy */}
            <div
              className={`transition-all duration-600 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: '250ms' }}
            >
              <h3 className="text-h3-mobile lg:text-h3 text-primary-dark font-medium">
                The Strategy
              </h3>
              <p className="text-body-lg text-slate mt-4">
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
      </div>
    </section>
  );
}
