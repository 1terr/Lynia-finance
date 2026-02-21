'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';

export function ProductBento() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="products" className="bg-white py-16 lg:py-[120px]">
      <div className="container-main">
        {/* Bento Grid: large card + two smaller cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Asset-Backed Lending — Large Card */}
          <div
            className={`border border-border rounded-xl p-8 lg:p-10 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 lg:row-span-2 flex flex-col justify-between ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <div>
              <span className="text-overline uppercase tracking-wider text-primary">
                ASSET-BACKED LENDING
              </span>
              <h3 className="text-h2-mobile lg:text-h2 text-primary-dark font-medium mt-4">
                Productive Asset Financing
              </h3>
              <p className="text-body text-slate mt-4">
                We finance the income-generating tools of the informal
                sector&mdash;starting with smartphones and scaling to gig-economy
                assets.
              </p>
              <div className="mt-6 p-4 bg-primary-light rounded-lg">
                <p className="text-body-sm font-medium text-primary-dark">
                  IoT-based risk management
                </p>
                <p className="text-body-sm text-slate mt-2">
                  We substitute traditional collateral with real-time asset
                  telemetry. By monitoring usage and health, we enable credit for
                  those the formal system deems &ldquo;unbankable.&rdquo;
                </p>
              </div>
            </div>
            <p className="text-caption text-slate-light mt-6">
              CGAP Alignment: Shifting from &ldquo;negative collateral&rdquo; to
              &ldquo;productive trust&rdquo; by funding assets that grow cash
              flow.
            </p>
          </div>

          {/* Digital Credit — Square Card */}
          <div
            className={`border border-border rounded-xl p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: '100ms' }}
          >
            <span className="text-overline uppercase tracking-wider text-primary">
              DIGITAL CREDIT
            </span>
            <h3 className="text-h3-mobile lg:text-h3 text-primary-dark font-medium mt-4">
              Conversational Liquidity
            </h3>
            <p className="text-body text-slate mt-3">
              Instant, collateral-free credit for civil servants and partner
              employees.
            </p>
            <p className="text-body-sm text-slate mt-4">
              WhatsApp-native applications with instant disbursement to{' '}
              <span className="font-medium text-primary-dark">Innbucks</span>,{' '}
              <span className="font-medium text-primary-dark">EcoCash</span>,{' '}
              <span className="font-medium text-primary-dark">OneWallet</span>,
              or{' '}
              <span className="font-medium text-primary-dark">OMari</span>.
            </p>
          </div>

          {/* Embedded Credit — Wide Card */}
          <div
            className={`border border-border rounded-xl p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: '200ms' }}
          >
            <span className="text-overline uppercase tracking-wider text-primary">
              EMBEDDED CREDIT
            </span>
            <h3 className="text-h3-mobile lg:text-h3 text-primary-dark font-medium mt-4">
              API for Ecosystem Resilience
            </h3>
            <p className="text-body text-slate mt-3">
              Connect via API or data sharing to finance your platform&apos;s
              ecosystem. We analyze mobile money activity to provide credit
              bundled with health/life insurance and capacity-building
              mechanisms.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
