'use client';

import { CreditCard, MapPin, Zap, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

const features = [
  { icon: CreditCard, title: 'Deposit as low as $15', description: 'Start with a small deposit. The device is yours from day one — no collateral required.' },
  { icon: MapPin, title: 'Pick up from 50+ agents', description: 'Collect your device from a Lynia agent in your area. Growing network across Zimbabwe.' },
  { icon: Zap, title: 'Approved in under 5 min', description: 'Apply via WhatsApp. AI-powered credit scoring delivers decisions in minutes, not days.' },
  { icon: Smartphone, title: 'Repay via EcoCash or OneMoney', description: 'Flexible repayment through the mobile wallet you already use. No bank account needed.' },
];

export function AssetFinancing() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="asset-financing" className="bg-white py-16 lg:py-20">
      <div className="container-main">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text column */}
          <div
            className={`transition-all duration-600 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <span className="text-overline uppercase tracking-wider text-primary">
              ASSET FINANCING
            </span>
            <h2 className="text-h1-mobile lg:text-h1 text-primary-dark font-medium mt-4">
              Own the tools that power your trade
            </h2>
            <p className="text-body-lg text-slate mt-6">
              Finance smartphones and productive assets with a small deposit.
              Collect from a local agent, repay via mobile money. Built for
              traders, vendors, and entrepreneurs who need tools to earn.
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
                    <h4 className="text-h5 text-primary-dark font-medium">{f.title}</h4>
                    <p className="text-body-sm text-slate mt-2">{f.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-8">
              <Button variant="primary" href="#apply">
                Start your application
              </Button>
              <Button variant="secondary">Learn more &rarr;</Button>
            </div>
          </div>

          {/* Visual placeholder */}
          <div
            className={`flex justify-center transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
            }`}
            style={{ transitionDelay: '300ms' }}
          >
            <div className="w-full max-w-[420px] aspect-square rounded-xl bg-primary-light flex items-center justify-center">
              <Smartphone className="w-24 h-24 text-primary/30" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
