'use client';

import { WaitlistForm } from '@/components/ui/WaitlistForm';

const products = [
  {
    id: 'digital-credit',
    title: 'Digital Credit',
    description:
      'Instant micro-loans powered by mobile money transaction history. We analyse EcoCash, Innbucks, and OneMoney velocity to build a credit identity for thin-file borrowers who have never accessed formal credit.',
    audience: 'Informal traders, market vendors, and gig workers across Zimbabwe.',
    icon: (
      <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
  },
  {
    id: 'embedded-credit',
    title: 'Embedded Credit',
    description:
      'API-based lending infrastructure for platforms and enterprises. Embed credit decisioning, disbursement, and collection directly into your app or marketplace with a few lines of code.',
    audience: 'Fintechs, e-commerce platforms, and enterprise partners looking to offer credit at the point of need.',
    icon: (
      <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    id: 'asset-backed-credit',
    title: 'Asset-Backed Credit',
    description:
      'Smartphone financing with IoT-based risk management. Customers receive a productive asset on credit, and Lynia uses real-time device telemetry to substitute traditional collateral\u2014shifting from negative collateral to productive trust.',
    audience: 'First-time smartphone buyers, small business owners, and informal workers building their digital livelihood.',
    icon: (
      <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

export default function ProductsPage() {
  return (
    <div className="pt-[72px]">
      {/* Structured data — FinancialProduct schema for SEO rich snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Lynia Finance Products',
            itemListElement: products.map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'FinancialProduct',
                name: p.title,
                description: p.description,
                provider: {
                  '@type': 'Organization',
                  name: 'Lynia Finance',
                  url: 'https://lyniafinance.com',
                },
                areaServed: {
                  '@type': 'Country',
                  name: 'Zimbabwe',
                },
              },
            })),
          }),
        }}
      />
      {/* Hero + waitlist */}
      <section className="bg-white py-16 lg:py-[120px]">
        <div className="container-main text-center mx-auto">
          <span className="text-overline uppercase tracking-wider text-primary">
            PRODUCTS
          </span>
          <h1 className="text-display-mobile md:text-hero-tablet lg:text-hero text-primary-dark mt-4 max-w-[720px] mx-auto">
            Financial products for Zimbabwe&apos;s underbanked majority.
          </h1>
          <p className="text-body-lg text-slate mt-6 max-w-[600px] mx-auto">
            Three credit products designed to transform mobile money velocity
            into financial access. Join the waitlist to be the first to know
            when we launch.
          </p>
          <div className="mt-10 max-w-[480px] mx-auto">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* Product details */}
      <section className="bg-surface-secondary py-16 lg:py-[120px]">
        <div className="container-main">
          <div className="grid gap-8 lg:gap-12">
            {products.map((product) => (
              <div
                key={product.id}
                id={product.id}
                className="bg-white rounded-xl border border-border p-8 lg:p-10 shadow-stripe-xs"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary-light flex items-center justify-center flex-shrink-0">
                    {product.icon}
                  </div>
                  <div>
                    <h2 className="text-heading text-primary-dark">
                      {product.title}
                    </h2>
                    <p className="text-body text-slate mt-3 leading-relaxed">
                      {product.description}
                    </p>
                    <p className="text-body-sm text-slate-light mt-3">
                      <span className="font-medium text-primary-dark">Who it&apos;s for:</span>{' '}
                      {product.audience}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}