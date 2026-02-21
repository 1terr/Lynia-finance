'use client';

import { WaitlistForm } from '@/components/ui/WaitlistForm';

export default function ProductsPage() {
  return (
    <div className="pt-16">
      <section
        className="min-h-[60vh] flex items-center py-16 lg:py-[120px]"
        style={{ background: 'var(--gradient-cta)' }}
      >
        <div className="container-main text-center mx-auto">
          <span className="text-overline uppercase tracking-wider text-white/50">
            PRODUCTS
          </span>
          <h1 className="text-display-mobile lg:text-hero text-white mt-4 max-w-[720px] mx-auto">
            Something big is coming.
          </h1>
          <p className="text-body-lg text-white/70 mt-6 max-w-[600px] mx-auto">
            We&apos;re building financial tools for Zimbabwe&apos;s underbanked
            majority. Join the waitlist to be the first to know when we launch.
          </p>
          <div className="mt-10 max-w-[480px] mx-auto">
            <WaitlistForm />
          </div>
        </div>
      </section>
    </div>
  );
}
