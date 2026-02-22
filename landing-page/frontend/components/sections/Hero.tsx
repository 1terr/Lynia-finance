'use client';

import { Button } from '@/components/ui/Button';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-white">
      {/* Stripe-style mesh gradient — right side */}
      <div
        className="absolute right-0 top-0 bottom-0 w-full lg:w-[55%] overflow-hidden pointer-events-none opacity-30 lg:opacity-70"
        aria-hidden="true"
      >
        <div className="absolute -top-[10%] right-[10%] h-[500px] w-[500px] rounded-full bg-[#FFA726] opacity-45 blur-[120px]" />
        <div className="absolute top-[10%] -right-[5%] h-[400px] w-[400px] rounded-full bg-[#FF7043] opacity-40 blur-[100px]" />
        <div className="absolute top-[30%] right-[5%] h-[450px] w-[450px] rounded-full bg-[#EC407A] opacity-40 blur-[110px]" />
        <div className="absolute top-[50%] right-[15%] h-[500px] w-[500px] rounded-full bg-[#AB47BC] opacity-35 blur-[130px]" />
        <div className="absolute bottom-0 right-[30%] h-[400px] w-[400px] rounded-full bg-[#5C6BC0] opacity-30 blur-[110px]" />
        <div className="absolute -bottom-[10%] right-[10%] h-[350px] w-[350px] rounded-full bg-[#26C6DA] opacity-25 blur-[100px]" />
      </div>

      <div className="container-wide relative z-10">
        <div className="max-w-[640px] pt-24 lg:pt-0">
          <h1
            className="text-hero-custom opacity-0 animate-fade-up"
            style={{ animationFillMode: 'forwards' }}
          >
            <span className="text-hero-primary">
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
            <Button variant="accent" size="lg" href="#get-started" arrow>
              Get started
            </Button>
            <Button variant="outline" size="lg" href="/thesis" arrow>
              Read the 2026 Thesis
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
