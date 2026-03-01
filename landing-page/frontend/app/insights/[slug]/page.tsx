import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPostBySlug, getPostSlugs, getRelatedPosts } from '@/lib/insights-data';
import { isSanityConfigured } from '@/lib/sanity';

// Lazy-load Sanity-dependent components to avoid build failures when Sanity isn't configured
const PortableText = isSanityConfigured
  ? require('@/components/PortableText').PortableText
  : ({ value }: { value: unknown[] }) => null;
const urlFor = isSanityConfigured
  ? require('@/lib/sanity').urlFor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  : (_: any) => ({ width: () => ({ height: () => ({ format: () => ({ url: () => '' }), url: () => '' }) }) });

export const dynamicParams = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    const slugs = await getPostSlugs();
    // Next.js 14 with output:'export' requires at least one param for dynamic routes.
    // Return a placeholder when no posts exist (e.g. Sanity not configured).
    if (slugs.length === 0) return [{ slug: '_' }];
    return slugs.map((slug: string) => ({ slug }));
  } catch {
    return [{ slug: '_' }];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: 'Post not found — Lynia Finance' };

  const metaTitle = post.seo?.metaTitle || `${post.title} — Lynia Finance`;
  const metaDescription = post.seo?.metaDescription || post.excerpt;

  return {
    title: metaTitle,
    description: metaDescription,
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: `/insights/${slug}`,
      type: 'article',
      ...(post.featuredImage && {
        images: [urlFor(post.featuredImage).width(1200).height(630).url()],
      }),
    },
  };
}

export default async function InsightsPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(slug);

  const publishedDate = new Date(post.publishedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="pt-[72px]">
      {/* Back link */}
      <div className="container-main pt-8">
        <a
          href="/insights"
          className="text-body-sm font-medium text-primary hover:text-primary-hover transition-colors"
        >
          &larr; Back to Insights
        </a>
      </div>

      {/* Post header */}
      <section className="bg-white py-12 lg:py-16">
        <div className="container-main max-w-narrow">
          <span className="inline-block text-caption font-medium text-primary bg-primary-50 px-3 py-1 rounded-full">
            {post.category.title}
          </span>
          <h1 className="text-display-mobile md:text-hero-tablet lg:text-hero text-primary-dark mt-4">
            {post.title}
          </h1>
          <p className="text-body text-slate mt-4">
            {publishedDate} &middot; {post.readTime}
          </p>
        </div>
      </section>

      {/* Featured image */}
      <div className="container-wide">
        {post.featuredImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlFor(post.featuredImage).width(1600).height(686).format('webp').url()}
              alt={post.featuredImage.alt || post.title}
              className="w-full aspect-[21/9] object-cover rounded-lg"
            />
            {post.featuredImage.caption && (
              <p className="text-caption text-slate mt-3 text-center">
                {post.featuredImage.caption}
              </p>
            )}
          </>
        ) : (
          <div className="aspect-[21/9] bg-primary-light rounded-lg" />
        )}
      </div>

      {/* Post body */}
      <section className="bg-white py-12 lg:py-16">
        <div className="container-main max-w-narrow">
          <PortableText value={post.body} />

          {/* Author */}
          <div className="border-t border-border mt-12 pt-8">
            <p className="text-caption text-slate-light uppercase tracking-wider">
              Written by
            </p>
            <div className="mt-3 flex items-center gap-4">
              {post.author.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={urlFor(post.author.image).width(96).height(96).format('webp').url()}
                  alt={post.author.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
                  <span className="text-body-sm font-medium text-primary">
                    {post.author.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                </div>
              )}
              <div>
                <p className="text-body-sm text-primary-dark font-medium">
                  {post.author.name}
                </p>
                <p className="text-caption text-slate">{post.author.role}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="bg-white py-16 lg:py-20">
          <div className="container-main">
            <span className="text-overline uppercase tracking-wider text-primary">
              RELATED ARTICLES
            </span>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
              {related.map((rel) => (
                <a
                  key={rel._id}
                  href={`/insights/${rel.slug}`}
                  className="group bg-white border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                >
                  {rel.featuredImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={urlFor(rel.featuredImage).width(600).height(338).format('webp').url()}
                      alt={rel.featuredImage.alt || rel.title}
                      className="w-full aspect-video object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="aspect-video bg-primary-light" />
                  )}
                  <div className="p-6">
                    <span className="inline-block text-caption font-medium text-primary bg-primary-50 px-3 py-1 rounded-full">
                      {rel.category.title}
                    </span>
                    <h3 className="text-subheading text-primary-dark mt-3 group-hover:text-primary transition-colors">
                      {rel.title}
                    </h3>
                    <p className="text-body-sm text-slate mt-2 line-clamp-2">
                      {rel.excerpt}
                    </p>
                    <p className="text-caption text-slate-light mt-4">
                      {new Date(rel.publishedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
