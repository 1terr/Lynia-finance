import dynamic from 'next/dynamic';
import { Hero } from '@/components/sections/Hero';
import { DataStrip } from '@/components/sections/DataStrip';
import { getPosts } from '@/lib/insights-data';

/* Below-fold sections — lazy-loaded for smaller initial JS bundle */
const ProductBento = dynamic(() =>
  import('@/components/sections/ProductBento').then((m) => ({ default: m.ProductBento }))
);
const DeveloperEngine = dynamic(() =>
  import('@/components/sections/DeveloperEngine').then((m) => ({ default: m.DeveloperEngine }))
);
const Insights = dynamic(() =>
  import('@/components/sections/Insights').then((m) => ({ default: m.Insights }))
);
const BottomCTA = dynamic(() =>
  import('@/components/sections/BottomCTA').then((m) => ({ default: m.BottomCTA }))
);

export default async function HomePage() {
  const posts = await getPosts();
  const insightsPosts = posts.slice(0, 3);

  return (
    <>
      {/* 1. Hero (dark gradient) — above the fold, eagerly loaded */}
      <Hero />
      {/* 2. Data Strip (light gray bg) — above the fold */}
      <DataStrip />
      {/* 3. Product Bento Grid (white bg) */}
      <ProductBento />
      {/* 4. The Developer Engine (dark navy bg) */}
      <DeveloperEngine />
      {/* 5. Insights (white bg) */}
      <Insights posts={insightsPosts} />
      {/* 6. Bottom CTA (dark gradient) */}
      <BottomCTA />
    </>
  );
}
