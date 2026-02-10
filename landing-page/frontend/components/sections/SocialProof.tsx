'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';

const stats = [
  '500+ loans funded',
  '<5 min approval',
  '100% mobile money',
];

export function SocialProof() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} className="bg-white py-10 border-b border-border">
      <div className="container-main">
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {stats.map((stat, i) => (
            <span
              key={stat}
              className={`text-body-sm font-medium text-slate/60 transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
              style={{ transitionDelay: `${i * 50}ms` }}
            >
              {stat}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
