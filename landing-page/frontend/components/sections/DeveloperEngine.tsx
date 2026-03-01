'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { useTypewriter } from '@/lib/useTypewriter';
import { SectionHeading } from '@/components/ui/SectionHeading';

const CODE_SAMPLE = `import { Lynia } from '@lynia/sdk';

const client = new Lynia({ apiKey: 'sk_live_...' });

// Verify identity
const kyc = await client.kyc.verify({
  nationalId: '63-123456-A-78',
  phone: '+263771234567',
});

// Score & disburse
const loan = await client.credit.disburse({
  customerId: kyc.customerId,
  amount: 150_00,      // $150 in cents
  currency: 'USD',
  wallet: 'ecocash',   // or innbucks, onewallet, omari
});`;

export function DeveloperEngine() {
  const { ref, isVisible } = useScrollAnimation();
  const { displayedText, showCursor } = useTypewriter({
    text: CODE_SAMPLE,
    speed: 40,
    pauseAfterComplete: 2000,
    pauseAfterClear: 800,
    enabled: isVisible,
  });

  return (
    <section ref={ref} className="bg-white py-16 lg:py-24">
      <div className="container-main">
        <SectionHeading
          overline="THE DEVELOPER ENGINE"
          title="Programmable Resilience."
          subtitle="One integration to manage KYC, scoring, and disbursement across Zimbabwe's mobile money landscape."
          isVisible={isVisible}
        />

        {/* Code-style illustration */}
        <div
          className={`mt-10 max-w-[680px] mx-auto text-left bg-navy rounded-xl p-6 lg:p-8 shadow-stripe-lg fade-in-slow ${
            isVisible ? 'fade-in-visible' : 'fade-in-hidden-lg'
          }`}
          style={{ transitionDelay: '180ms' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-error/60" />
            <div className="w-3 h-3 rounded-full bg-warning/60" />
            <div className="w-3 h-3 rounded-full bg-success/60" />
          </div>
          <pre className="text-body-sm text-white/80 overflow-x-auto font-mono min-h-[320px]">
            <code>
              {displayedText}
              {showCursor && (
                <span className="animate-blink text-primary font-normal">|</span>
              )}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}
