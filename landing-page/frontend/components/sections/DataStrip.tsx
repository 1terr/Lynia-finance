'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { useEffect, useState, useRef } from 'react';
import { SectionLabel } from '@/components/ui/SectionLabel';

const stats = [
  { value: 16, suffix: '%', label: 'of adults access formal credit' },
  { value: 63, suffix: '%', label: 'use mobile money' },
  { value: 52, suffix: '%', label: 'own a smartphone' },
  { value: 58, suffix: '%', label: 'work in the informal sector' },
];

function CountUp({ target, suffix, isVisible }: { target: number; suffix: string; isVisible: boolean }) {
  const [count, setCount] = useState(0);
  const isDecimal = target % 1 !== 0;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isVisible || hasAnimated.current) return;
    hasAnimated.current = true;

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
  const [forceVisible, setForceVisible] = useState(false);

  // Fallback: if section is already in viewport on mount, trigger immediately
  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        setForceVisible(true);
      }
    }
  }, [ref]);

  const visible = isVisible || forceVisible;

  return (
    <section
      ref={ref}
      className="bg-surface-secondary py-16 lg:py-24"
    >
      <div className="container-main">
        <SectionLabel isVisible={visible}>THE OPPORTUNITY</SectionLabel>

        <h2
          className={`text-display-mobile md:text-display-tablet lg:text-display text-navy mt-4 fade-in ${
            visible ? 'fade-in-visible' : 'fade-in-hidden-md'
          }`}
        >
          The state of financial inclusion
        </h2>

        <p
          className={`text-body-lg text-slate max-w-[640px] mt-6 fade-in ${
            visible ? 'fade-in-visible' : 'fade-in-hidden-md'
          }`}
          style={{ transitionDelay: '60ms' }}
        >
          Behind every statistic is someone building a livelihood without a safety
          net&nbsp;&mdash; a vendor, a farmer, a mother. The tools to reach them
          already exist.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 mt-10 lg:mt-12">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`bg-white rounded-xl p-5 lg:p-6 shadow-stripe-xs text-center fade-in ${
                visible ? 'fade-in-visible' : 'fade-in-hidden-lg'
              }`}
              style={{ transitionDelay: `${120 + i * 80}ms` }}
            >
              <div className="w-8 h-0.5 bg-primary mx-auto mb-4 rounded-full" />
              <div className="text-stat-mobile md:text-stat-tablet lg:text-stat text-navy tabular-nums">
                <CountUp
                  target={stat.value}
                  suffix={stat.suffix}
                  isVisible={visible}
                />
              </div>
              <p className="text-body-sm font-semibold text-navy/80 mt-3">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
