'use client';

import { Component, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Button } from '@/components/ui/Button';
import type { SanityPost } from '@/lib/sanity-types';

/** Error boundary — gracefully handles Sanity CMS failures without crashing the page. */
class InsightsErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return null; // silently hide section on error
    return this.props.children;
  }
}

interface InsightsProps {
  posts: SanityPost[];
}

function InsightsInner({ posts }: InsightsProps) {
  const { ref, isVisible } = useScrollAnimation();

  // Fallback when no Sanity content is configured
  if (posts.length === 0) {
    return (
      <section ref={ref} className="bg-white py-16 lg:py-24">
        <div className="container-main text-center">
          <SectionLabel isVisible={isVisible}>INSIGHTS</SectionLabel>
          <h2
            className={`text-display-mobile md:text-display-tablet lg:text-display text-primary-dark mt-4 fade-in ${
              isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
            }`}
          >
            Research-driven approach
          </h2>
          <p
            className={`text-body-lg text-slate max-w-[540px] mx-auto mt-6 fade-in ${
              isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
            }`}
            style={{ transitionDelay: '60ms' }}
          >
            We publish our thinking on financial inclusion, credit innovation,
            and the dynamics of Zimbabwe&apos;s informal economy.
          </p>
          <div
            className={`mt-8 fade-in ${isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'}`}
            style={{ transitionDelay: '120ms' }}
          >
            <Button variant="accent" href="/thesis" arrow>
              Read the 2026 Thesis
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const featured = posts[0];
  const sideArticles = posts.slice(1, 3);

  return (
    <section ref={ref} id="insights" className="bg-white py-16 lg:py-24">
      <div className="container-main">
        {/* Header row */}
        <div className="flex items-end justify-between">
          <div>
            <SectionLabel isVisible={isVisible}>INSIGHTS</SectionLabel>
            <h2
              className={`text-display-mobile md:text-display-tablet lg:text-display text-primary-dark mt-4 fade-in ${
                isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
            >
              Latest thinking
            </h2>
          </div>

          <a
            href="/insights"
            className={`hidden sm:inline-flex items-center text-body-sm font-semibold text-primary hover:text-primary-hover transition-colors duration-250 ease-stripe fade-in ${
              isVisible ? 'fade-in-visible' : 'fade-in-hidden-sm'
            }`}
            style={{ transitionDelay: '200ms' }}
          >
            VIEW ALL
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </a>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-10">
          {/* Featured card — left, spans 3 columns and 2 rows */}
          <a
            href={`/insights/${featured.slug}`}
            className={`group lg:col-span-3 lg:row-span-2 transition-all duration-300 ease-stripe-out hover:-translate-y-1 hover:shadow-stripe-md fade-in ${
              isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
            }`}
          >
            <div className="relative h-full rounded-xl overflow-hidden bg-gradient-to-br from-navy-dark via-navy to-navy-light p-8 lg:p-10 flex flex-col justify-between shadow-stripe-sm min-h-[360px] lg:min-h-0">
              {/* Grid pattern overlay */}
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center gap-3">
                  <span className="text-overline uppercase tracking-wider text-primary">
                    FEATURED
                  </span>
                  <span className="w-6 h-px bg-white/30" />
                  <span className="text-overline uppercase tracking-wider text-white/60">
                    {featured.category.title.toUpperCase()}
                  </span>
                </div>

                <h3 className="text-title-mobile lg:text-title text-white mt-6 lg:mt-8">
                  {featured.title}
                </h3>

                <p className="text-body-lg text-white/70 mt-4 max-w-[540px]">
                  {featured.excerpt}
                </p>
              </div>

              <div className="relative z-10 mt-8">
                <span className="text-caption text-white/50">
                  {featured.readTime}
                </span>
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.03] transition-colors duration-350 ease-stripe-out" />
            </div>
          </a>

          {/* Side cards — right, each spans 2 columns */}
          {sideArticles.map((article, i) => (
            <a
              key={article._id}
              href={`/insights/${article.slug}`}
              className={`group lg:col-span-2 transition-all duration-300 ease-stripe-out hover:-translate-y-1 hover:shadow-stripe-md fade-in ${
                isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
              }`}
              style={{ transitionDelay: `${60 + i * 60}ms` }}
            >
              <div className="h-full bg-white border-t-2 border-primary rounded-xl p-6 lg:p-8 shadow-stripe-sm flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="text-overline uppercase tracking-wider text-primary">
                    {article.category.title.toUpperCase()}
                  </span>
                  <span className="text-caption text-muted">
                    {article.readTime}
                  </span>
                </div>

                <h3 className="text-heading-mobile lg:text-heading text-primary-dark mt-4">
                  {article.title}
                </h3>

                <p className="text-body-sm text-slate mt-3 line-clamp-3">
                  {article.excerpt}
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* Mobile "View all" link */}
        <div className="mt-8 sm:hidden">
          <a
            href="/insights"
            className="inline-flex items-center text-body-sm font-semibold text-primary hover:text-primary-hover transition-colors duration-250 ease-stripe"
          >
            VIEW ALL
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

export function Insights(props: InsightsProps) {
  return (
    <InsightsErrorBoundary>
      <InsightsInner {...props} />
    </InsightsErrorBoundary>
  );
}
