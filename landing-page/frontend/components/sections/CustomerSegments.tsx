'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';

const segments = [
  {
    label: 'FOR INDIVIDUALS',
    description: 'Smartphones, assets, and cash. Apply via WhatsApp in under 5 minutes.',
    cta: 'Start your application',
    href: '#apply',
  },
  {
    label: 'FOR DISTRIBUTORS',
    description: 'Sell smartphones and assets in your community. Earn commission on every sale.',
    cta: 'Become a distributor',
    href: '/contact',
  },
  {
    label: 'FOR PARTNERS',
    description: 'Embed credit into your platform. Offer financing at the point of sale through our APIs.',
    cta: 'Partner with us',
    href: '/contact',
  },
];

export function CustomerSegments() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} className="bg-white py-16 lg:py-[120px]">
      <div className="container-main">
        <h2
          className={`text-h1-mobile lg:text-h1 text-primary-dark font-medium text-center transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          Built for how Zimbabwe works
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
          {segments.map((seg, i) => (
            <a
              key={seg.label}
              href={seg.href}
              className={`group block border border-border rounded-lg p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${200 + i * 100}ms` }}
            >
              <span className="text-overline uppercase tracking-wider text-primary">
                {seg.label}
              </span>
              <p className="text-body text-slate mt-4">{seg.description}</p>
              <span className="inline-flex items-center text-body-sm font-medium text-primary mt-6 group-hover:text-primary-hover transition-colors">
                {seg.cta}
                <span className="ml-1.5 transition-transform duration-150 group-hover:translate-x-1">
                  &rarr;
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
