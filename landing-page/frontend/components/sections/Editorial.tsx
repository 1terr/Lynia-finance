'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';

const placeholderPosts = [
  {
    category: 'Company',
    title: 'Why we built Lynia Finance',
    excerpt: 'The story behind our mission to serve Zimbabwe\u2019s underbanked majority.',
    date: '10 Feb 2026',
    image: null,
  },
  {
    category: 'Market',
    title: 'Zimbabwe\u2019s $14B credit gap',
    excerpt: '80% of the workforce is informal. Less than 5% have bank credit. Here\u2019s how we\u2019re closing the gap.',
    date: '8 Feb 2026',
    image: null,
  },
  {
    category: 'Products',
    title: 'How asset financing works',
    excerpt: 'From deposit to device in under 24 hours. A step-by-step walkthrough.',
    date: '5 Feb 2026',
    image: null,
  },
];

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
          {placeholderPosts.map((post, i) => (
            <article
              key={post.title}
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
            </article>
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
