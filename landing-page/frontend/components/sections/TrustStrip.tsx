'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';

const partners = [
  { name: 'EcoCash', color: '#00A651' },
  { name: 'Innbucks', color: '#FF6B00' },
  { name: 'OneWallet', color: '#0072CE' },
  { name: 'OMari', color: '#8B5CF6' },
  { name: 'Smile Identity', color: '#2563EB' },
  { name: 'Trustonic', color: '#0EA5E9' },
];

export function TrustStrip() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} className="bg-white py-10 lg:py-12 border-b border-border/50">
      <div className="container-main">
        <div
          className={`flex flex-col items-center gap-6 fade-in ${
            isVisible ? 'fade-in-visible' : 'fade-in-hidden-sm'
          }`}
        >
          <span className="text-overline uppercase tracking-wider text-slate-light">
            Integrated with
          </span>
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 lg:gap-x-12">
            {partners.map((p) => (
              <span
                key={p.name}
                className="inline-flex items-center gap-2 text-body font-medium text-slate/40 transition-colors duration-250 hover:text-slate"
              >
                <span
                  className="w-2 h-2 rounded-full opacity-60"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
