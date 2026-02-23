'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useScrollAnimation } from '@/lib/useScrollAnimation';

interface PressItem {
  logo: string;
  headline: string;
  excerpt: string;
  href: string;
}

const pressItems: PressItem[] = [
  {
    logo: 'ZBC',
    headline: 'Lynia Finance launches WhatsApp-based smartphone financing for informal traders across Zimbabwe.',
    excerpt: 'The fintech startup is using mobile money data to underwrite loans for entrepreneurs who have never had access to formal credit. Starting with smartphones, the company plans to expand into broader productive asset financing.',
    href: '/press',
  },
  {
    logo: 'TH',
    headline: 'How mobile money velocity is replacing bank statements as the new credit score in Africa.',
    excerpt: 'Lynia Finance is pioneering a new approach to credit scoring that analyzes transaction patterns across EcoCash, Innbucks, and other mobile money platforms to build credit identities for the unbanked.',
    href: '/press',
  },
  {
    logo: 'BD',
    headline: 'Zimbabwe fintech bridges the $14B credit gap with IoT-backed asset lending and embedded insurance.',
    excerpt: 'By combining real-time asset telemetry with mobile money disbursement, Lynia Finance is creating a new category of productive credit for Zimbabwe\'s $10B informal economy.',
    href: '/press',
  },
];

function PressRow({ item, index, isVisible }: { item: PressItem; index: number; isVisible: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border-b border-border transition-all duration-500 ease-stripe-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${120 + index * 80}ms` }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 lg:gap-6 py-5 lg:py-6 text-left group"
      >
        {/* Logo placeholder */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
          <span className="text-caption font-medium text-primary">{item.logo}</span>
        </div>

        {/* Headline */}
        <p className="flex-1 text-body text-primary-dark font-medium group-hover:text-primary transition-colors duration-250 ease-stripe">
          {item.headline}
        </p>

        {/* Expand icon */}
        <div className="flex-shrink-0 transition-transform duration-250 ease-stripe">
          {expanded ? (
            <Minus className="w-5 h-5 text-muted" />
          ) : (
            <Plus className="w-5 h-5 text-muted" />
          )}
        </div>
      </button>

      {/* Expandable content with animation */}
      <div
        className={`overflow-hidden transition-all duration-350 ease-stripe-out ${
          expanded ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pb-6 pl-[56px] lg:pl-[64px]">
          <p className="text-body text-slate max-w-[680px]">
            {item.excerpt}
          </p>
          <a
            href={item.href}
            className="group/link inline-flex items-center text-body-sm font-semibold text-primary mt-4 hover:text-primary-hover transition-colors duration-250 ease-stripe"
          >
            Read the story
            <span className="ml-1.5 transition-transform duration-250 ease-stripe-out group-hover/link:translate-x-1">&rarr;</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export function Press() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="press" className="bg-white py-16 lg:py-[120px]">
      <div className="container-main">
        <span
          className={`text-overline uppercase tracking-wider text-primary transition-all duration-500 ease-stripe-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          PRESS
        </span>
        <h2
          className={`text-display-mobile md:text-display-tablet lg:text-display text-primary-dark mt-4 transition-all duration-500 ease-stripe-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          In the news
        </h2>

        <div className="mt-12 border-t border-border">
          {pressItems.map((item, i) => (
            <PressRow key={i} item={item} index={i} isVisible={isVisible} />
          ))}
        </div>
      </div>
    </section>
  );
}
