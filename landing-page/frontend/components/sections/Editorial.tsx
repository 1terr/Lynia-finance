'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { posts } from '@/lib/editorial-data';

const displayPosts = posts.slice(0, 3);

export function Editorial() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} className="bg-white py-16 lg:py-[120px]">
      <div className="container-main">
        <h2
          className={`text-h1-mobile lg:text-h1 text-primary-dark font-medium text-center transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          From our Editorial
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
          {displayPosts.map((post, i) => (
            <a
              key={post.slug}
              href={`/editorial/${post.slug}`}
              className={`group border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${200 + i * 100}ms` }}
            >
              {/* Image placeholder */}
              <div className="aspect-video bg-primary-light" />

              {/* Content */}
              <div className="p-6">
                <span className="inline-block text-caption font-medium text-primary bg-primary-50 px-3 py-1 rounded-full">
                  {post.category}
                </span>
                <h3 className="text-h4 text-primary-dark font-medium mt-3 group-hover:text-primary transition-colors">
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

        <div className="text-center mt-10">
          <a
            href="/editorial"
            className="text-body-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            View all articles &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
