'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { SectionLabel } from '@/components/ui/SectionLabel';

interface PressItem {
  logo: string;
  headline: string;
  description: string;
  href: string;
  gradient: string;
  logoSize?: string;
}

const pressItems: PressItem[] = [
  {
    logo: 'ZBC',
    headline:
      'Lynia Finance launches WhatsApp-based smartphone financing for informal traders across Zimbabwe.',
    description:
      'How Lynia Finance is using mobile money data to underwrite loans for entrepreneurs across Zimbabwe.',
    href: '/insights',
    gradient: 'from-[#0A2540] via-[#1A3A5C] to-[#0A2540]',
  },
  {
    logo: 'TechHub',
    headline:
      'How mobile money velocity is replacing bank statements as the new credit score in Africa.',
    description:
      'Lynia Finance pioneers alternative credit scoring using EcoCash and mobile money patterns.',
    href: '/insights',
    gradient: 'from-[#0e4429] via-[#006d32] to-[#0e4429]',
  },
  {
    logo: 'BD',
    headline:
      'Zimbabwe fintech bridges the $14B credit gap with IoT-backed asset lending and embedded insurance.',
    description:
      'Lynia Finance combines real-time asset telemetry with mobile money disbursement for productive credit.',
    href: '/insights',
    gradient: 'from-[#2D1B69] via-[#635BFF] to-[#2D1B69]',
  },
  {
    logo: 'Reuters',
    headline:
      'African fintech startups are redefining credit access for the informal economy.',
    description:
      'Reuters explores how companies like Lynia Finance use alternative data for financial inclusion.',
    href: '/insights',
    gradient: 'from-[#1a1a2e] via-[#16213e] to-[#0f3460]',
  },
  {
    logo: 'Disrupt',
    headline:
      'The next wave of African fintech is built on WhatsApp and mobile money rails.',
    description:
      'Disrupt Africa profiles Lynia Finance among startups leveraging chat-based financial services.',
    href: '/insights',
    gradient: 'from-[#4a0e0e] via-[#8b1a1a] to-[#4a0e0e]',
  },
];

function PressCard({
  item,
  index,
  isVisible,
}: {
  item: PressItem;
  index: number;
  isVisible: boolean;
}) {
  return (
    <a
      href={item.href}
      className={`group flex-shrink-0 press-card fade-in ${
        isVisible ? 'fade-in-visible' : 'fade-in-hidden-md'
      }`}
      style={{ transitionDelay: `${150 + index * 100}ms` }}
    >
      {/* Image / brand area */}
      <div
        className={`relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-gradient-to-br ${item.gradient} shadow-stripe-sm group-hover:shadow-stripe-md transition-shadow duration-350 ease-stripe-out`}
      >
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Decorative glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-40 h-40 rounded-full bg-white/5 blur-3xl" />
        </div>

        {/* Logo */}
        <div className="absolute inset-0 flex items-end p-6">
          <span className="text-white/90 text-heading font-bold tracking-tight">
            {item.logo}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.03] transition-colors duration-350 ease-stripe-out" />
      </div>

      {/* Text content */}
      <div className="mt-4">
        <p className="text-body text-slate leading-relaxed line-clamp-2">
          {item.description}
        </p>
        <span className="inline-flex items-center text-body-sm font-semibold text-primary mt-3 group-hover:text-primary-hover transition-colors duration-250 ease-stripe">
          Read the story
          <ChevronRight className="w-4 h-4 ml-0.5 transition-transform duration-250 ease-stripe-out group-hover:translate-x-1" />
        </span>
      </div>
    </a>
  );
}

export function Insights() {
  const { ref, isVisible } = useScrollAnimation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const firstCard = el.querySelector('.press-card') as HTMLElement | null;
    const step = firstCard ? firstCard.offsetWidth + 24 : 380;
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

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
              In the news
            </h2>
          </div>

          {/* Navigation arrows */}
          <div
            className={`hidden sm:flex items-center gap-2 fade-in ${
              isVisible ? 'fade-in-visible' : 'fade-in-hidden-sm'
            }`}
            style={{ transitionDelay: '200ms' }}
          >
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center transition-all duration-250 ease-stripe hover:border-border-strong hover:shadow-stripe-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:shadow-none"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 text-primary-dark" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center transition-all duration-250 ease-stripe hover:border-border-strong hover:shadow-stripe-xs disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:shadow-none"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 text-primary-dark" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable cards — full-bleed on the right */}
      <div
        ref={scrollRef}
        className="mt-10 flex gap-6 overflow-x-auto scroll-smooth pl-6 lg:pl-[max(calc((100vw-1080px)/2+48px),48px)] pr-6 pb-2 snap-x snap-mandatory scrollbar-hide"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {pressItems.map((item, i) => (
          <div key={i} className="snap-start flex-shrink-0">
            <PressCard item={item} index={i} isVisible={isVisible} />
          </div>
        ))}
        {/* End spacer */}
        <div className="flex-shrink-0 w-6 lg:w-12" />
      </div>
    </section>
  );
}
