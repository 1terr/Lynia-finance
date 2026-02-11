'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';

const stats = [
  { value: '500+', label: 'loans funded' },
  { value: '<5 min', label: 'average approval' },
  { value: '100%', label: 'mobile money' },
  { value: '50+', label: 'agent locations' },
];

export function SocialProof() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} className="bg-white py-10 border-b border-border">
      <div className="container-main">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`flex items-baseline gap-1.5 transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
              style={{ transitionDelay: `${i * 50}ms` }}
            >
              <span className="text-body font-medium text-primary-dark">
                {stat.value}
              </span>
              <span className="text-body-sm text-slate/60">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
