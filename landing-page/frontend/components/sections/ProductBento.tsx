'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { SectionHeading } from '@/components/ui/SectionHeading';

export function ProductBento() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="products" className="bg-white py-16 lg:py-24">
      <div className="container-main">
        <SectionHeading
          overline="OUR PRODUCTS"
          title="Three products, one mission."
          isVisible={isVisible}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
          {/* Digital Credit — Top Left */}
          <div
            className={`border border-border rounded-xl p-8 shadow-stripe-sm transition-all duration-300 ease-stripe-out hover:-translate-y-1 hover:shadow-stripe-md ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <span className="text-overline uppercase tracking-wider text-primary">
              DIGITAL CREDIT
            </span>
            <h3 className="text-heading-mobile lg:text-heading text-primary-dark mt-4">
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

          {/* Embedded Credit — Top Right */}
          <div
            className={`border border-border rounded-xl p-8 shadow-stripe-sm transition-all duration-300 ease-stripe-out hover:-translate-y-1 hover:shadow-stripe-md ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: '60ms' }}
          >
            <span className="text-overline uppercase tracking-wider text-primary">
              EMBEDDED CREDIT
            </span>
            <h3 className="text-heading-mobile lg:text-heading text-primary-dark mt-4">
              API for Ecosystem Resilience
            </h3>
            <p className="text-body text-slate mt-3">
              Connect via API or data sharing to finance your platform&apos;s
              ecosystem. We analyze mobile money activity to provide credit
              bundled with health/life insurance and capacity-building
              mechanisms.
            </p>
          </div>

          {/* Asset-Backed Credit — Full Width Bottom */}
          <div
            className={`border border-border rounded-xl p-8 lg:p-10 shadow-stripe-sm transition-all duration-300 ease-stripe-out hover:-translate-y-1 hover:shadow-stripe-md lg:col-span-2 flex flex-col justify-between ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: '120ms' }}
          >
            <div>
              <span className="text-overline uppercase tracking-wider text-primary">
                ASSET-BACKED CREDIT
              </span>
              <h3 className="text-heading-mobile lg:text-heading text-primary-dark mt-4">
                Productive Asset Financing
              </h3>
              <p className="text-body text-slate mt-3">
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
            <p className="text-caption text-muted mt-6">
              CGAP Alignment: Shifting from &ldquo;negative collateral&rdquo; to
              &ldquo;productive trust&rdquo; by funding assets that grow cash
              flow.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
