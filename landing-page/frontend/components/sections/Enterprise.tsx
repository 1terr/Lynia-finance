'use client';

import { Banknote, Code, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

const features = [
  { icon: Banknote, title: 'Mobile money native', description: 'Transactions settle instantly through your mobile wallet.' },
  { icon: Code, title: 'Developer-ready APIs', description: 'Integrate credit products with a few API calls. Monitor disbursements, repayments, and risk in real time.' },
  { icon: TrendingUp, title: 'Shared growth', description: 'Your customers access more. Your platform retains more. Lynia handles underwriting, collections, and risk.' },
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
              Offer your customers financing at the point of need. Lynia handles
              underwriting, disbursement, and collections — you earn on every
              transaction.
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
