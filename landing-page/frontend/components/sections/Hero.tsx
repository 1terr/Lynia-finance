'use client';

import { Button } from '@/components/ui/Button';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-white">
      <div className="container-main relative z-10">
        <div className="max-w-[680px] md:max-w-[780px] lg:max-w-[900px] pt-24 lg:pt-0">
          <p
            className="text-sm text-slate tracking-wide opacity-0 animate-fade-up mb-5"
            style={{ animationFillMode: 'forwards' }}
          >
            Zimbabwean informal MSMEs: &nbsp;<span className="font-medium">86%</span>
          </p>
          <h1
            className="text-hero-mobile md:text-hero-tablet lg:text-hero opacity-0 animate-fade-up"
            style={{ animationFillMode: 'forwards' }}
          >
            <span className="text-primary-dark">
              Financing for the productive majority.
            </span>{' '}
            <span className="text-hero-accent">
              We are providing financing necessary for thin-file entrepreneurs to transition from survival to growth.
            </span>
          </h1>
          <div
            className="mt-10 flex flex-wrap items-center gap-4 opacity-0 animate-fade-up"
            style={{ animationDelay: '60ms', animationFillMode: 'forwards' }}
          >
            <Button variant="accent" href="#get-started" arrow>
              Get started
            </Button>
            <Button variant="outline" href="/thesis" arrow>
              Read the 2026 Thesis
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
