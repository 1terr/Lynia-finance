'use client';

import { WaitlistForm } from '@/components/ui/WaitlistForm';

export default function ProductsPage() {
  return (
    <div className="pt-[72px]">
      <section
        className="min-h-[60vh] flex items-center bg-white py-16 lg:py-[120px]"
      >
        <div className="container-main text-center mx-auto">
          <span className="text-overline uppercase tracking-wider text-primary">
            PRODUCTS
          </span>
          <h1 className="text-display-mobile md:text-hero-tablet lg:text-hero text-primary-dark mt-4 max-w-[720px] mx-auto">
            Something big is coming.
          </h1>
          <p className="text-body-lg text-slate mt-6 max-w-[600px] mx-auto">
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