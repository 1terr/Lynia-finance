'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';

export function DeveloperEngine() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} className="bg-primary-light py-16 lg:py-[120px]">
      <div className="container-main text-center">
        <span
          className={`text-overline uppercase tracking-wider text-primary transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          THE DEVELOPER ENGINE
        </span>
        <h2
          className={`text-h1-mobile lg:text-h1 text-primary-dark font-medium mt-4 transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          Programmable Resilience.
        </h2>
        <p
          className={`text-body-lg text-slate max-w-[600px] mx-auto mt-6 transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          One integration to manage KYC, scoring, and disbursement across
          Zimbabwe&apos;s mobile money landscape.
        </p>

        {/* Code-style illustration */}
        <div
          className={`mt-12 max-w-[680px] mx-auto text-left bg-navy rounded-xl p-6 lg:p-8 shadow-lg transition-all duration-600 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: '300ms' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-error/60" />
            <div className="w-3 h-3 rounded-full bg-warning/60" />
            <div className="w-3 h-3 rounded-full bg-success/60" />
          </div>
          <pre className="text-body-sm text-white/80 overflow-x-auto">
            <code>{`import { Lynia } from '@lynia/sdk';

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
});`}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
