'use client';

import { useState } from 'react';
import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { posts, categories, type Category } from '@/lib/editorial-data';

export default function EditorialPage() {
  const { ref, isVisible } = useScrollAnimation();
  const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');

  const featured = posts[0];
  const filtered =
    activeCategory === 'All'
      ? posts.slice(1)
      : posts.filter((p) => p.category === activeCategory && p.slug !== featured.slug);

  return (
    <div className="pt-[72px]">
      {/* Hero */}
      <section className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          <span className="text-overline uppercase tracking-wider text-primary">
            FROM OUR EDITORIAL
          </span>

          {/* Featured post */}
          <a
            href={`/editorial/${featured.slug}`}
            className="group block mt-10 border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-200"
          >
            <div className="grid md:grid-cols-2">
              <div className="aspect-video md:aspect-auto bg-primary-light" />
              <div className="p-8 lg:p-12 flex flex-col justify-center">
                <span className="inline-block self-start text-caption font-medium text-primary bg-primary-50 px-3 py-1 rounded-full">
                  {featured.category}
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
        </div>
      </section>

      {/* Category pills + grid */}
      <section ref={ref} className="bg-white py-16 lg:py-[120px]">
        <div className="container-main">
          {/* Category filters */}
          <div className="flex flex-wrap gap-2 mb-12">
            <button
              onClick={() => setActiveCategory('All')}
              className={`h-8 px-3 rounded-sm text-[13px] font-medium tracking-[-0.01em] shadow-btn transition-all duration-250 ease-stripe ${
                activeCategory === 'All'
                  ? 'bg-primary text-white'
                  : 'bg-white text-[#08090A] hover:bg-gray-50 border border-border'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`h-8 px-3 rounded-sm text-[13px] font-medium tracking-[-0.01em] shadow-btn transition-all duration-250 ease-stripe ${
                  activeCategory === cat
                    ? 'bg-primary text-white'
                    : 'bg-white text-[#08090A] hover:bg-gray-50 border border-border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Article grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((post, i) => (
              <a
                key={post.slug}
                href={`/editorial/${post.slug}`}
                className={`group bg-white border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${200 + i * 100}ms` }}
              >
                <div className="aspect-video bg-primary-light" />
                <div className="p-6">
                  <span className="inline-block text-caption font-medium text-primary bg-primary-50 px-3 py-1 rounded-full">
                    {post.category}
                  </span>
                  <h3 className="text-subheading text-primary-dark mt-3 group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-body-sm text-slate mt-2 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <p className="text-caption text-slate-light mt-4">{post.date}</p>
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
