'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { useEffect, useState } from 'react';

const stats = [
  { value: 80, prefix: '', suffix: '%', label: 'informal workforce', sublabel: 'Excluded from traditional banking' },
  { value: 5, prefix: '<', suffix: '%', label: 'have bank credit', sublabel: 'In the informal sector' },
  { value: 14, prefix: '$', suffix: 'B', label: 'credit gap', sublabel: 'Unserved demand in Zimbabwe' },
  { value: 70, prefix: '', suffix: '%+', label: 'mobile money adoption', sublabel: 'Infrastructure already in place' },
];

function CountUp({ target, prefix, suffix, isVisible }: { target: number; prefix: string; suffix: string; isVisible: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    const duration = 1200;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [isVisible, target]);

  return (
    <span>
      {prefix}{count}{suffix}
    </span>
  );
}

export function WhySection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section
      ref={ref}
      className="bg-gradient-to-br from-navy to-primary py-16 lg:py-[120px]"
    >
      <div className="container-main text-center">
        <p
          className={`text-caption uppercase tracking-wider text-white/40 mb-4 transition-all duration-600 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          The opportunity
        </p>
        <h2
          className={`text-h1-mobile lg:text-h1 text-white font-medium transition-all duration-600 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          80% of Zimbabwe works.
          <br />
          Less than 5% can borrow.
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${300 + i * 150}ms` }}
            >
              <div className="text-display-mobile lg:text-display text-white font-medium">
                <CountUp
                  target={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  isVisible={isVisible}
                />
              </div>
              <p className="text-body font-medium text-white/90 mt-3">{stat.label}</p>
              <p className="text-body-sm text-white/50 mt-1">{stat.sublabel}</p>
            </div>
          ))}
        </div>

        <p
          className={`text-body-lg text-white/70 max-w-[680px] mx-auto mt-12 transition-all duration-600 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '800ms' }}
        >
          Traditional banks don&apos;t serve them. We do. Mobile money
          infrastructure is already in place — financial products should be
          too. Lynia builds on what exists to serve those who&apos;ve been excluded.
        </p>
      </div>
    </section>
  );
}
