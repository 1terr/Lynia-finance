'use client';

import { Button } from '@/components/ui/Button';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

export function BottomCTA() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="get-started" className="bg-white py-16 lg:py-24">
      <div className="container-main">
        <h2
          className={`text-display-mobile md:text-display-tablet lg:text-display text-primary-dark fade-in ${
            isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
          }`}
        >
          Financing for the productive majority.
        </h2>
        <p
          className={`text-body-lg text-slate max-w-[640px] mt-6 fade-in ${
            isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
          }`}
          style={{ transitionDelay: '60ms' }}
        >
          Transform mobile money velocity into credit identities. Get started
          with Lynia&apos;s financial infrastructure for Zimbabwe&apos;s informal
          economy.
        </p>
        <div
          className={`flex flex-wrap justify-start gap-4 mt-10 fade-in ${
            isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
          }`}
          style={{ transitionDelay: '120ms' }}
        >
          <Button variant="accent" href="/contact">
            Get started &rarr;
          </Button>
          <Button variant="outline" href="/thesis">
            Read the 2026 Thesis
          </Button>
        </div>
      </div>
    </section>
  );
}
