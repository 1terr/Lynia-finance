'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { useEffect, useState } from 'react';

const stats = [
  { value: 97.5, suffix: '%', label: 'Mobile Penetration', source: 'POTRAZ' },
  { value: 9.96, suffix: 'M', label: 'Active Mobile Money Accounts', source: 'RBZ' },
  { value: 83, suffix: '%', label: 'Formally Served but Credit-Constrained', source: 'NFIS II' },
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
      className="bg-gradient-to-br from-navy to-primary py-16 lg:py-[120px]"
    >
      <div className="container-main text-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-16">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center transition-all duration-500 ease-stripe-out ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="text-hero-mobile lg:text-hero text-white tabular-nums">
                <CountUp
                  target={stat.value}
                  suffix={stat.suffix}
                  isVisible={isVisible}
                />
              </div>
              <p className="text-body-lg font-medium text-white/90 mt-3">{stat.label}</p>
              <p className="text-body-sm text-white/50 mt-1">{stat.source}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
