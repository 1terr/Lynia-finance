'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { useEffect, useState } from 'react';

const stats = [
  { value: 80, prefix: '', suffix: '%', label: 'of the workforce is informal' },
  { value: 5, prefix: '<', suffix: '%', label: 'have access to bank credit' },
  { value: 14, prefix: '$', suffix: 'B', label: 'unserved credit demand' },
  { value: 70, prefix: '', suffix: '%+', label: 'mobile money adoption' },
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
              <p className="text-body text-white/70 mt-3">{stat.label}</p>
            </div>
          ))}
        </div>

        <p
          className={`text-body-lg text-white/70 max-w-[680px] mx-auto mt-12 transition-all duration-600 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '800ms' }}
        >
          Traditional banks don&apos;t serve them. We do. Mobile money is
          everywhere — financial products should be too.
        </p>
      </div>
    </section>
  );
}
