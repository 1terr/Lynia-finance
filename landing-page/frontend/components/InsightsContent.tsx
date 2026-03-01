'use client';

import { useState } from 'react';
import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { urlFor } from '@/lib/sanity';
import type { SanityPost, SanityCategory } from '@/lib/sanity-types';

interface InsightsContentProps {
  posts: SanityPost[];
  categories: SanityCategory[];
}

export function InsightsContent({ posts, categories }: InsightsContentProps) {
  const { ref, isVisible } = useScrollAnimation();
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const featured = posts[0];
  const filtered =
    activeCategory === 'All'
      ? posts.slice(1)
      : posts.filter(
          (p) => p.category.title === activeCategory && p._id !== featured?._id
        );

  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            FROM OUR INSIGHTS
          </span>

          {/* Featured post */}
          {featured && (
            <a
              href={`/insights/${featured.slug}`}
              className="group block mt-10 border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-200"
            >
              <div className="grid md:grid-cols-2">
                {featured.featuredImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={urlFor(featured.featuredImage).width(800).height(600).format('webp').url()}
                    alt={featured.featuredImage.alt || featured.title}
                    className="w-full aspect-video md:aspect-auto md:h-full object-cover"
                  />
                ) : (
                  <div className="aspect-video md:aspect-auto bg-primary-light" />
                )}
                <div className="p-8 lg:p-12 flex flex-col justify-center">
                  <span className="inline-block self-start text-caption font-medium text-primary bg-primary-50 px-3 py-1 rounded-full">
                    {featured.category.title}
                  </span>
                  <h2 className="text-title-mobile md:text-title-tablet lg:text-title text-primary-dark mt-4 group-hover:text-primary transition-colors">
                    {featured.title}
                  </h2>
                  <p className="text-body text-slate mt-3">{featured.excerpt}</p>
                  <p className="text-body-sm font-medium text-primary mt-6">
                    Read article &rarr;
                  </p>
                </div>
              </div>
            </a>
          )}
        </div>
      </section>

      {/* Category pills + grid */}
      <section ref={ref} className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-12">
            <button
              onClick={() => setActiveCategory('All')}
              className={`h-11 px-5 rounded-md text-base font-semibold shadow-btn transition-all duration-250 ease-stripe ${
                activeCategory === 'All'
                  ? 'bg-primary text-white'
                  : 'bg-white text-[#08090A] hover:bg-gray-50 border border-[#e6e6e6]'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => setActiveCategory(cat.title)}
                className={`h-11 px-5 rounded-md text-base font-semibold shadow-btn transition-all duration-250 ease-stripe ${
                  activeCategory === cat.title
                    ? 'bg-primary text-white'
                    : 'bg-white text-[#08090A] hover:bg-gray-50 border border-[#e6e6e6]'
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>

          {/* Article grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((post, i) => (
              <a
                key={post._id}
                href={`/insights/${post.slug}`}
                className={`group bg-white border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${200 + i * 100}ms` }}
              >
                {post.featuredImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={urlFor(post.featuredImage).width(600).height(338).format('webp').url()}
                    alt={post.featuredImage.alt || post.title}
                    className="w-full aspect-video object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-video bg-primary-light" />
                )}
                <div className="p-6">
                  <span className="inline-block text-caption font-medium text-primary bg-primary-50 px-3 py-1 rounded-full">
                    {post.category.title}
                  </span>
                  <h3 className="text-subheading text-primary-dark mt-3 group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-body-sm text-slate mt-2 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <p className="text-caption text-slate-light mt-4">
                    {new Date(post.publishedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </a>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-body text-slate text-center py-12">
              No articles in this category yet. Check back soon.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
