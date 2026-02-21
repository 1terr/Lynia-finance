import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { posts, getPostBySlug, getRelatedPosts } from '@/lib/editorial-data';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Post not found — Lynia Finance' };

  return {
    title: `${post.title} — Lynia Finance`,
    description: post.excerpt,
    openGraph: {
      title: `${post.title} — Lynia Finance`,
      description: post.excerpt,
      url: `/editorial/${slug}`,
      type: 'article',
    },
  };
}

export default async function EditorialPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(slug);

  return (
    <div className="pt-[72px]">
      {/* Back link */}
      <div className="container-main pt-8">
        <a
          href="/editorial"
          className="text-body-sm font-medium text-primary hover:text-primary-hover transition-colors"
        >
          &larr; Back to Editorial
        </a>
      </div>

      {/* Post header */}
      <section className="bg-white py-12 lg:py-16">
        <div className="container-main max-w-narrow">
          <span className="inline-block text-caption font-medium text-primary bg-primary-50 px-3 py-1 rounded-full">
            {post.category}
          </span>
          <h1 className="text-display-mobile lg:text-hero text-primary-dark mt-4">
            {post.title}
          </h1>
          <p className="text-body text-slate mt-4">
            {post.date} &middot; {post.readTime}
          </p>
        </div>
      </section>

      {/* Featured image placeholder */}
      <div className="container-wide">
        <div className="aspect-[21/9] bg-primary-light rounded-lg" />
      </div>

      {/* Post body */}
      <section className="bg-white py-12 lg:py-16">
        <div className="container-main max-w-narrow">
          <div className="space-y-5">
            {post.body.map((paragraph, i) => (
              <p key={i} className="text-body text-slate leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Author */}
          <div className="border-t border-border mt-12 pt-8">
            <p className="text-caption text-slate-light uppercase tracking-wider">
              Written by
            </p>
            <div className="mt-3 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
                <span className="text-body-sm font-medium text-primary">
                  {post.author.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)}
                </span>
              </div>
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
      <section className="bg-primary-light py-16 lg:py-20">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            RELATED ARTICLES
          </span>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
            {related.map((rel) => (
              <a
                key={rel.slug}
                href={`/editorial/${rel.slug}`}
                className="group bg-white border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div className="aspect-video bg-primary-light" />
                <div className="p-6">
                  <span className="inline-block text-caption font-medium text-primary bg-primary-50 px-3 py-1 rounded-full">
                    {rel.category}
                  </span>
                  <h3 className="text-subheading text-primary-dark mt-3 group-hover:text-primary transition-colors">
                    {rel.title}
                  </h3>
                  <p className="text-body-sm text-slate mt-2 line-clamp-2">
                    {rel.excerpt}
                  </p>
                  <p className="text-caption text-slate-light mt-4">{rel.date}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
