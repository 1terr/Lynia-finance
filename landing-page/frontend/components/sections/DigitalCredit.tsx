'use client';

import { Clock, Wallet } from 'lucide-react';
import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { WaitlistForm } from '@/components/ui/WaitlistForm';

const features = [
  { icon: Clock, title: 'Application to wallet in minutes', description: 'From application to cash in your wallet — under 10 minutes. No paperwork, no branch visit.' },
  { icon: Wallet, title: 'EcoCash and OneMoney supported', description: 'Receive and repay through the mobile money wallet you already use. Repayment is automated and flexible.' },
];

export function DigitalCredit() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="digital-credit" className="bg-navy py-16 lg:py-20">
      <div className="container-main">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Visual placeholder (left on desktop) */}
          <div
            className={`hidden lg:flex justify-center order-2 lg:order-1 transition-all duration-700 ${
              isVisible ? 'opacity-100 -translate-x-0' : 'opacity-0 -translate-x-10'
            }`}
            style={{ transitionDelay: '300ms' }}
          >
            <div className="w-full max-w-[420px] aspect-square rounded-xl bg-navy-light flex items-center justify-center">
              <Wallet className="w-24 h-24 text-primary/30" />
            </div>
          </div>

          {/* Text column */}
          <div
            className={`order-1 lg:order-2 transition-all duration-600 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <span className="text-overline uppercase tracking-wider text-primary">
              DIGITAL CREDIT
            </span>
            <h2 className="text-h1-mobile lg:text-h1 text-white font-medium mt-4">
              Cash when you need it most
            </h2>
            <p className="text-body-lg text-white/70 mt-6">
              Instant digital loans deposited directly into your mobile wallet.
              Apply via WhatsApp, get funded in under 10 minutes. Designed for
              everyday needs and working capital.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className={`transition-all duration-400 ${
                      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}
                    style={{ transitionDelay: `${400 + i * 75}ms` }}
                  >
                    <Icon className="w-6 h-6 text-primary mb-3" />
                    <h4 className="text-h5 text-white font-medium">{f.title}</h4>
                    <p className="text-body-sm text-white/70 mt-2">{f.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Lead capture */}
            <div className="mt-8">
              <p className="text-body-sm text-white/50 mb-3">Coming soon</p>
              <WaitlistForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
