'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { useEffect, useState } from 'react';

const stats = [
  { value: 16, suffix: '%', label: 'of adults access formal credit' },
  { value: 63, suffix: '%', label: 'use mobile money' },
  { value: 52, suffix: '%', label: 'own a smartphone' },
  { value: 58, suffix: '%', label: 'work in the informal sector' },
];

function CountUp({ target, suffix, isVisible }: { target: number; suffix: string; isVisible: boolean }) {
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
      {isDecimal ? count.toFixed(2) : count}{suffix}
    </span>
  );
}

export function DataStrip() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section
      ref={ref}
      className="bg-white py-16 lg:py-[120px]"
    >
      <div className="container-main">
        {/* Overline */}
        <span
          className={`text-overline uppercase tracking-wider text-primary transition-all duration-500 ease-stripe-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          THE OPPORTUNITY
        </span>

        {/* Heading */}
        <h2
          className={`text-display-mobile md:text-display-tablet lg:text-display text-navy mt-4 transition-all duration-500 ease-stripe-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          The state of financial inclusion
        </h2>

        {/* Subtitle */}
        <p
          className={`text-body-lg text-slate max-w-[640px] mt-6 transition-all duration-500 ease-stripe-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '60ms' }}
        >
          Behind every statistic is someone building a livelihood without a safety
          net&nbsp;&mdash; a vendor, a farmer, a mother. The tools to reach them
          already exist.
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-16 mt-12 lg:mt-16">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center transition-all duration-500 ease-stripe-out ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${120 + i * 80}ms` }}
            >
              <div className="text-display-mobile md:text-display-tablet lg:text-display text-navy tabular-nums">
                <CountUp
                  target={stat.value}
                  suffix={stat.suffix}
                  isVisible={isVisible}
                />
              </div>
              <p className="text-body-lg font-medium text-navy/90 mt-3">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
