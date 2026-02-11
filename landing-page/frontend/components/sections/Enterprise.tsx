'use client';

import { Banknote, Code, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

const features = [
  { icon: Banknote, title: 'Revenue on every transaction', description: 'Earn commission on every loan originated through your platform. We handle risk, you earn recurring revenue.' },
  { icon: Code, title: 'Developer-ready APIs', description: 'Integrate credit products with a few API calls. Real-time dashboards for disbursements, repayments, and portfolio risk.' },
  { icon: TrendingUp, title: 'We handle the hard parts', description: 'Underwriting, KYC, collections, and compliance — all managed by Lynia. You focus on your customers.' },
];

export function Enterprise() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="enterprise" className="bg-primary-light py-16 lg:py-20">
      <div className="container-main">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text column */}
          <div
            className={`transition-all duration-600 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <span className="text-overline uppercase tracking-wider text-primary">
              ENTERPRISE PARTNERSHIPS
            </span>
            <h2 className="text-h1-mobile lg:text-h1 text-primary-dark font-medium mt-4">
              Embed credit into your platform
            </h2>
            <p className="text-body-lg text-slate mt-6">
              Offer your customers financing at the point of need. Distributors,
              retailers, and platforms integrate Lynia to unlock new revenue —
              we handle underwriting, disbursement, and collections.
            </p>

            <div className="grid grid-cols-1 gap-6 mt-10">
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

            <div className="mt-8">
              <Button variant="primary" href="/contact">
                Partner with us
              </Button>
            </div>
          </div>

          {/* Visual placeholder */}
          <div
            className={`flex justify-center transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
            }`}
            style={{ transitionDelay: '300ms' }}
          >
            <div className="w-full max-w-[420px] aspect-square rounded-xl bg-white border border-border flex items-center justify-center">
              <Code className="w-24 h-24 text-primary/20" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
