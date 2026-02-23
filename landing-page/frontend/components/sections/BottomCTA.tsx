'use client';

import { Button } from '@/components/ui/Button';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

export function BottomCTA() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section
      ref={ref}
      id="get-started"
      className="bg-white py-16 lg:py-[120px]"
    >
      <div className="container-main">
        <h2
          className={`text-display-mobile md:text-display-tablet lg:text-display text-primary-dark transition-all duration-500 ease-stripe-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          Financing for the productive majority.
        </h2>
        <p
          className={`text-body-lg text-slate max-w-[600px] mt-6 transition-all duration-500 ease-stripe-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '60ms' }}
        >
          Transform mobile money velocity into credit identities. Get started
          with Lynia&apos;s financial infrastructure for Zimbabwe&apos;s informal
          economy.
        </p>
        <div
          className={`flex flex-wrap justify-start gap-4 mt-8 transition-all duration-500 ease-stripe-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '120ms' }}
        >
          <Button variant="accent" size="lg" href="/contact">
            Get started &rarr;
          </Button>
          <Button variant="outline" size="lg" href="/thesis">
            Read the 2026 Thesis
          </Button>
        </div>
      </div>
    </section>
  );
}
