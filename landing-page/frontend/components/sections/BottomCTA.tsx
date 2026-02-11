'use client';

import { Button } from '@/components/ui/Button';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

export function BottomCTA() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section
      ref={ref}
      id="apply"
      className="py-16 lg:py-[120px]"
      style={{ background: 'var(--gradient-cta)' }}
    >
      <div className="container-main text-center">
        <h2
          className={`text-h1-mobile lg:text-h1 text-white font-medium transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          Apply now. Get funded today.
        </h2>
        <p
          className={`text-body-lg text-white/70 max-w-[600px] mx-auto mt-6 transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          No bank account required. No paperwork. No branch visits. Just
          WhatsApp, your national ID, and 5 minutes. Join the 500+ Zimbabweans
          already building with Lynia.
        </p>
        <div
          className={`flex flex-wrap justify-center gap-4 mt-8 transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <Button variant="white" size="lg">
            Start your application
          </Button>
          <Button variant="ghost" size="lg" href="/contact">
            Talk to our team &rarr;
          </Button>
        </div>
      </div>
    </section>
  );
}
