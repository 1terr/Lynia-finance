'use client';

import { Button } from '@/components/ui/Button';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

export function BottomCTA() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="get-started" className="relative overflow-hidden bg-navy py-20 lg:py-28">
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, #0A2540 0%, #0D2E4D 40%, #112B45 70%, #0A2540 100%)',
        }}
      />

      {/* Dot grid pattern */}
      <div className="absolute inset-0 dot-grid opacity-[0.03]" />

      {/* Gradient orbs */}
      <div
        className="gradient-orb hidden md:block"
        style={{
          width: '400px',
          height: '400px',
          top: '-20%',
          right: '10%',
          background: 'radial-gradient(circle, rgba(99, 91, 255, 0.10) 0%, transparent 70%)',
        }}
      />
      <div
        className="gradient-orb hidden md:block"
        style={{
          width: '300px',
          height: '300px',
          bottom: '-15%',
          left: '5%',
          background: 'radial-gradient(circle, rgba(110, 195, 244, 0.06) 0%, transparent 70%)',
        }}
      />

      <div className="container-main relative z-10 text-center">
        <h2
          className={`text-display-mobile md:text-display-tablet lg:text-display text-white mx-auto max-w-[640px] fade-in ${
            isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
          }`}
        >
          Ready to build with us?
        </h2>
        <p
          className={`text-body-lg text-white/60 max-w-[540px] mx-auto mt-6 fade-in ${
            isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
          }`}
          style={{ transitionDelay: '60ms' }}
        >
          Transform mobile money velocity into credit identities. Get started
          with Lynia&apos;s financial infrastructure for Zimbabwe&apos;s informal
          economy.
        </p>
        <div
          className={`flex flex-wrap justify-center gap-4 mt-10 fade-in ${
            isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
          }`}
          style={{ transitionDelay: '120ms' }}
        >
          <Button variant="accent" href="/contact" arrow>
            Talk to our team
          </Button>
          <Button variant="ghost" href="/products">
            View our products
          </Button>
        </div>
      </div>
    </section>
  );
}
