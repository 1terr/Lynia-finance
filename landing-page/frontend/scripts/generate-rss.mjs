/**
 * Post-build script to generate RSS feed from Sanity blog posts.
 * Runs after `next build` and writes feed.xml into the `out/` directory.
 *
 * Usage: node scripts/generate-rss.mjs
 */
import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'out');
const siteUrl = 'https://lyniafinance.com';

async function fetchPosts() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';

  if (!projectId) {
    console.log('[generate-rss] Sanity not configured — skipping RSS generation.');
    return [];
  }

  const query = encodeURIComponent(
    `*[_type == "post"] | order(publishedAt desc) { title, "slug": slug.current, excerpt, publishedAt }`
  );
  const url = `https://${projectId}.api.sanity.io/v2024-01-01/data/query/${dataset}?query=${query}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.result || [];
  } catch (err) {
    console.error('[generate-rss] Failed to fetch posts:', err.message);
    return [];
  }
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function main() {
  if (!existsSync(outDir)) {
    console.log('[generate-rss] out/ directory not found — run next build first.');
    return;
  }

  const posts = await fetchPosts();

  const items = posts
    .map(
      (post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${siteUrl}/insights/${post.slug}/</link>
      <guid isPermaLink="true">${siteUrl}/insights/${post.slug}/</guid>
      <description>${escapeXml(post.excerpt || '')}</description>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
    </item>`
    )
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Lynia Finance — Insights</title>
    <link>${siteUrl}/insights/</link>
    <description>Articles on financial inclusion, credit infrastructure, and building for Zimbabwe's underbanked majority.</description>
    <language>en</language>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}
  </channel>
</rss>`;

  writeFileSync(resolve(outDir, 'feed.xml'), rss, 'utf-8');
  console.log(`[generate-rss] Generated feed.xml with ${posts.length} items.`);
}

main();
