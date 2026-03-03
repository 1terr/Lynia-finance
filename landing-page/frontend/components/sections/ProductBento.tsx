'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { SectionHeading } from '@/components/ui/SectionHeading';

import { WhatsAppChatDemo } from '@/components/ui/WhatsAppChatDemo';
import { EmbeddedCreditDiagram } from '@/components/ui/EmbeddedCreditDiagram';


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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10 items-stretch">
          {/* Digital Credit — Top Left */}
          <div
            className={`border border-border border-t-4 border-t-primary rounded-xl p-8 shadow-stripe-sm transition-all duration-300 ease-stripe-out hover:-translate-y-1 hover:shadow-stripe-md hover:bg-primary-50/50 flex flex-col ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <span className="text-overline uppercase tracking-wider text-primary">
              DIGITAL CREDIT
            </span>
            <h3 className="text-heading-mobile lg:text-heading text-primary-dark mt-3">
              Conversational Liquidity
            </h3>
            <p className="text-body text-slate mt-3">
              Instant, collateral-free credit for civil servants and partner
              employees.
            </p>
            {/* WhatsApp Chat Flow Demo */}
            <div className="mt-6 flex-1 flex flex-col min-h-0">
              <WhatsAppChatDemo isVisible={isVisible} />
            </div>
          </div>

          {/* Embedded Credit — Top Right */}
          <div
            className={`border border-border border-t-4 border-t-info rounded-xl p-8 shadow-stripe-sm transition-all duration-300 ease-stripe-out hover:-translate-y-1 hover:shadow-stripe-md hover:bg-primary-50/50 flex flex-col ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: '60ms' }}
          >
            <span className="text-overline uppercase tracking-wider text-info">
              EMBEDDED CREDIT
            </span>
            <h3 className="text-heading-mobile lg:text-heading text-primary-dark mt-3">
              API for Ecosystem Resilience
            </h3>
            <p className="text-body text-slate mt-3">
              Connect via API or data sharing to finance your platform&apos;s
              ecosystem.
            </p>
            {/* Architecture Diagram */}
            <div className="mt-6 flex-1 flex flex-col min-h-0">
              <EmbeddedCreditDiagram isVisible={isVisible} />
            </div>
          </div>

          {/* Asset-Backed Credit — Full Width Bottom (Dark Treatment) */}
          <div
            className={`rounded-xl p-8 lg:p-10 shadow-stripe-md transition-all duration-300 ease-stripe-out hover:-translate-y-1 hover:shadow-stripe-lg lg:col-span-2 flex flex-col justify-between bg-navy relative overflow-hidden ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: '120ms' }}
          >
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 line-grid opacity-50" />

            <div className="relative z-10">
              <span className="text-overline uppercase tracking-wider text-success">
                ASSET-BACKED CREDIT
              </span>
              <h3 className="text-heading-mobile lg:text-heading text-white mt-3">
                Productive Asset Financing
              </h3>
              <p className="text-body text-white/70 mt-3 max-w-[640px]">
                We finance the income-generating tools of the informal
                sector&mdash;starting with smartphones and scaling to gig-economy
                assets.
              </p>
              <div className="mt-6 p-4 bg-white/[0.06] border border-white/10 rounded-lg">
                <p className="text-body-sm font-medium text-white">
                  IoT-based risk management
                </p>
                <p className="text-body-sm text-white/60 mt-2">
                  We substitute traditional collateral with real-time asset
                  telemetry. By monitoring usage and health, we enable credit for
                  those the formal system deems &ldquo;unbankable.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
