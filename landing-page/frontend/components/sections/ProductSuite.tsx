'use client';

import { Smartphone, Wallet, Building2 } from 'lucide-react';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

const products = [
  {
    icon: Smartphone,
    label: 'ASSET FINANCING',
    headline: 'Own the tools that power your trade',
    description: 'Finance smartphones and assets with a small deposit. Collect from a local agent, repay via mobile money.',
    href: '/products#asset-financing',
  },
  {
    icon: Wallet,
    label: 'DIGITAL CREDIT',
    headline: 'Cash when you need it most',
    description: 'Digital loans deposited directly into your mobile wallet. Apply once, get funded in under 10 minutes.',
    href: '/products#digital-credit',
  },
  {
    icon: Building2,
    label: 'ENTERPRISE PARTNERSHIPS',
    headline: 'Embed credit into your platform',
    description: 'Offer your customers financing at the point of need. Lynia handles underwriting, disbursement, and collections.',
    href: '/products#enterprise',
  },
];

export function ProductSuite() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="products" className="bg-white py-16 lg:py-[120px]">
      <div className="container-main">
        <h2
          className={`text-h1-mobile lg:text-h1 text-primary-dark font-medium text-center transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          Three products. One mission.
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
          {products.map((product, i) => {
            const Icon = product.icon;
            return (
              <a
                key={product.label}
                href={product.href}
                className={`group block border border-border rounded-lg p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${200 + i * 100}ms` }}
              >
                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mb-6">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-overline uppercase tracking-wider text-primary">
                  {product.label}
                </span>
                <h3 className="text-h3-mobile lg:text-h3 text-primary-dark font-medium mt-3">
                  {product.headline}
                </h3>
                <p className="text-body text-slate mt-3">{product.description}</p>
                <span className="inline-flex items-center text-body-sm font-medium text-primary mt-6 group-hover:text-primary-hover transition-colors">
                  Learn more
                  <span className="ml-1.5 transition-transform duration-150 group-hover:translate-x-1">
                    &rarr;
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
