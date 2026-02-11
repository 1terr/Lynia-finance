'use client';

import { Button } from '@/components/ui/Button';

export function Hero() {
  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: 'var(--gradient-hero)' }}
    >
      <div className="container-main relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text column */}
          <div className="pt-20 lg:pt-0">
            <p
              className="text-caption uppercase tracking-wider text-white/50 mb-4 opacity-0 animate-fade-in-up"
            >
              Credit infrastructure for Africa
            </p>
            <h1
              className="text-display-mobile lg:text-display text-white opacity-0 animate-fade-in-up"
              style={{ animationDelay: '50ms' }}
            >
              Financial tools for the underbanked
            </h1>
            <p
              className="mt-6 text-body-lg text-white/70 max-w-[520px] opacity-0 animate-fade-in-up"
              style={{ animationDelay: '150ms' }}
            >
              Smartphones, assets, and instant credit — delivered through
              WhatsApp to Zimbabwe&apos;s 80% informal workforce. No bank
              account. No paperwork. Approved in minutes.
            </p>
            <div
              className="mt-8 flex flex-wrap items-center gap-4 opacity-0 animate-fade-in-up"
              style={{ animationDelay: '250ms' }}
            >
              <Button variant="white" size="lg" href="#apply">
                Start your application
              </Button>
              <Button variant="secondary" href="#how-it-works" className="text-white hover:text-white/80">
                See how it works &rarr;
              </Button>
            </div>
          </div>

          {/* Visual column — phone mockup placeholder */}
          <div
            className="hidden lg:flex justify-center opacity-0 animate-fade-in-right"
            style={{ animationDelay: '300ms' }}
          >
            <div className="relative w-[280px] h-[560px] animate-float">
              {/* Phone frame */}
              <div className="absolute inset-0 rounded-[36px] border-[3px] border-white/20 bg-white/10 backdrop-blur-sm overflow-hidden">
                {/* Screen content */}
                <div className="p-6 pt-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-whatsapp/20 flex items-center justify-center">
                      <span className="text-whatsapp text-body-sm font-medium">L</span>
                    </div>
                    <div>
                      <p className="text-white text-body-sm font-medium">Lynia Finance</p>
                      <p className="text-white/50 text-caption">Online</p>
                    </div>
                  </div>

                  {/* Chat bubbles */}
                  <div className="space-y-3">
                    <div className="bg-white/10 rounded-lg rounded-tl-none p-3 max-w-[200px]">
                      <p className="text-white/90 text-caption">
                        Hi! Apply for your smartphone or instant credit here.
                      </p>
                    </div>
                    <div className="bg-whatsapp/20 rounded-lg rounded-tr-none p-3 max-w-[180px] ml-auto">
                      <p className="text-white/90 text-caption">I need a smartphone</p>
                    </div>
                    <div className="bg-white/10 rounded-lg rounded-tl-none p-3 max-w-[220px]">
                      <p className="text-white/90 text-caption">
                        Verified! Deposit $15, collect from your nearest agent.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
                        <span className="text-white text-[10px]">&#10003;</span>
                      </div>
                      <p className="text-success text-caption font-medium">Approved in 3 min</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
