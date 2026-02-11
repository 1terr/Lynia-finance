'use client';

import { MessageCircle, ShieldCheck, Package, Repeat } from 'lucide-react';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

const steps = [
  {
    number: '01',
    icon: MessageCircle,
    title: 'Apply via WhatsApp',
    description:
      'No app download. No bank visit. Start a conversation and apply in under 2 minutes.',
  },
  {
    number: '02',
    icon: ShieldCheck,
    title: 'Get verified instantly',
    description:
      'AI-powered credit scoring and KYC verification. Decisions in under 5 minutes.',
  },
  {
    number: '03',
    icon: Package,
    title: 'Receive your device or funds',
    description:
      'Collect a smartphone from a local agent, or receive cash directly into your mobile wallet.',
  },
  {
    number: '04',
    icon: Repeat,
    title: 'Repay via mobile money',
    description:
      'Flexible repayment through EcoCash or OneMoney. No bank account needed.',
  },
];

export function HowItWorks() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="how-it-works" className="bg-primary-light py-16 lg:py-[120px]">
      <div className="container-main">
        <div className="text-center">
          <p
            className={`text-caption uppercase tracking-wider text-primary mb-4 transition-all duration-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            How it works
          </p>
          <h2
            className={`text-h1-mobile lg:text-h1 text-primary-dark font-medium transition-all duration-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            From application to funded in minutes
          </h2>
          <p
            className={`text-body-lg text-slate max-w-[600px] mx-auto mt-4 transition-all duration-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
            style={{ transitionDelay: '100ms' }}
          >
            Everything happens on WhatsApp — the app your customers already use
            every day.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={`relative transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${200 + i * 100}ms` }}
              >
                {/* Connector line (hidden on last item and mobile) */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+32px)] right-[-32px] h-[2px] bg-primary/15" />
                )}

                <div className="text-center">
                  <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-border mb-6">
                    <Icon className="w-7 h-7 text-primary" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-white text-[11px] font-medium flex items-center justify-center">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-h4 text-primary-dark font-medium">
                    {step.title}
                  </h3>
                  <p className="text-body-sm text-slate mt-3">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
