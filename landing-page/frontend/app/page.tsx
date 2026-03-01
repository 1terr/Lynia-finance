import { Hero } from '@/components/sections/Hero';
import { DataStrip } from '@/components/sections/DataStrip';
import { ProductBento } from '@/components/sections/ProductBento';
import { DeveloperEngine } from '@/components/sections/DeveloperEngine';
import { Insights } from '@/components/sections/Insights';
import { BottomCTA } from '@/components/sections/BottomCTA';

export default function HomePage() {
  return (
    <>
      {/* 1. Hero */}
      <Hero />
      {/* 2. Data Strip (ZimStats & POTRAZ 2024-2026) */}
      <DataStrip />
      {/* 3. Product Bento Grid */}
      <ProductBento />
      {/* 4. The Developer Engine */}
      <DeveloperEngine />
      {/* 5. Insights */}
      <Insights />
      {/* 6. Bottom CTA */}
      <BottomCTA />
    </>
  );
}
