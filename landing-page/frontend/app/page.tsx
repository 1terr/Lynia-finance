import { Hero } from '@/components/sections/Hero';
import { DataStrip } from '@/components/sections/DataStrip';
import { ProductBento } from '@/components/sections/ProductBento';
import { DeveloperEngine } from '@/components/sections/DeveloperEngine';
import { Insights } from '@/components/sections/Insights';
import { BottomCTA } from '@/components/sections/BottomCTA';
import { getPosts } from '@/lib/insights-data';

export default async function HomePage() {
  const posts = await getPosts();
  const insightsPosts = posts.slice(0, 3);

  return (
    <>
      {/* 1. Hero (dark gradient) */}
      <Hero />
      {/* 2. Data Strip (light gray bg) */}
      <DataStrip />
      {/* 3. Product Bento Grid (white bg) */}
      <ProductBento />
      {/* 5. The Developer Engine (dark navy bg) */}
      <DeveloperEngine />
      {/* 6. Insights (white bg) */}
      <Insights posts={insightsPosts} />
      {/* 7. Bottom CTA (dark gradient) */}
      <BottomCTA />
    </>
  );
}
