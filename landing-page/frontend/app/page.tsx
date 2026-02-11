import { Hero } from '@/components/sections/Hero';
import { SocialProof } from '@/components/sections/SocialProof';
import { WhySection } from '@/components/sections/WhySection';
import { ProductSuite } from '@/components/sections/ProductSuite';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { AssetFinancing } from '@/components/sections/AssetFinancing';
import { DigitalCredit } from '@/components/sections/DigitalCredit';
import { Enterprise } from '@/components/sections/Enterprise';
import { CustomerSegments } from '@/components/sections/CustomerSegments';
import { Editorial } from '@/components/sections/Editorial';
import { BottomCTA } from '@/components/sections/BottomCTA';

export default function HomePage() {
  return (
    <>
      {/* 1. Hero */}
      <Hero />
      {/* 2. Social Proof */}
      <SocialProof />
      {/* 3. Why Alternative Financing (stats) */}
      <WhySection />
      {/* 4. Product Suite Overview */}
      <ProductSuite />
      {/* 5. How It Works (step-by-step process) */}
      <HowItWorks />
      {/* 6. Asset Financing Deep Dive */}
      <AssetFinancing />
      {/* 7. Digital Credit Deep Dive */}
      <DigitalCredit />
      {/* 8. Enterprise Partnerships Deep Dive */}
      <Enterprise />
      {/* 9. Customer Segments */}
      <CustomerSegments />
      {/* 10. Editorial */}
      <Editorial />
      {/* 11. Bottom CTA */}
      <BottomCTA />
    </>
  );
}
