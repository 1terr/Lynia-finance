'use client';

import { Button } from '@/components/ui/Button';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

export function BottomCTA() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section
      ref={ref}
      id="get-started"
      className="py-16 lg:py-[120px]"
      style={{ background: 'var(--gradient-cta)' }}
    >
      <div className="container-main text-center">
        <h2
          className={`text-display-mobile lg:text-display text-white transition-all duration-500 ease-stripe-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          Financing for the productive majority.
        </h2>
        <p
          className={`text-body-lg text-white/70 max-w-[600px] mx-auto mt-6 transition-all duration-500 ease-stripe-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '60ms' }}
        >
          Transform mobile money velocity into credit identities. Get started
          with Lynia&apos;s financial infrastructure for Zimbabwe&apos;s informal
          economy.
        </p>
        <div
          className={`flex flex-wrap justify-center gap-4 mt-8 transition-all duration-500 ease-stripe-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '120ms' }}
        >
          <Button variant="white" size="lg" href="/contact">
            Get started &rarr;
          </Button>
          <Button variant="ghost" size="lg" href="/thesis">
            Read the 2026 Thesis
          </Button>
        </div>
      </div>
    </section>
  );
}
