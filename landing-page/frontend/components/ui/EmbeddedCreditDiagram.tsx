'use client';

const mobileMoneyProviders = [
  { name: 'EcoCash', color: '#00A651' },
  { name: 'Innbucks', color: '#FF6B00' },
  { name: 'OneWallet', color: '#0072CE' },
  { name: 'OMari', color: '#8B5CF6' },
];

const apiServices = [
  { name: 'KYC Data' },
  { name: 'Credit Scoring' },
  { name: 'Loan Disbursement' },
  { name: 'Insurance' },
];

const ecosystemPartners = [
  { name: 'Retailers' },
  { name: 'Distributors' },
  { name: 'Employers' },
  { name: 'Platforms' },
];

function AnimatedConnectorBlue() {
  return (
    <div className="flex items-center justify-center py-3">
      <div className="flex flex-col items-center gap-1">
        <div className="w-[2px] h-6 bg-gradient-to-b from-white/10 to-info/30" />
        <svg
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          className="text-info/50"
          style={{ animation: 'bounce-subtle 2s ease-in-out infinite' }}
        >
          <path
            d="M1 1L6 6L11 1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

interface EmbeddedCreditDiagramProps {
  isVisible: boolean;
}

export function EmbeddedCreditDiagram({ isVisible }: EmbeddedCreditDiagramProps) {
  return (
    <div className="relative rounded-xl overflow-hidden bg-navy h-[520px] w-full flex items-center justify-center">
      {/* Dot grid texture */}
      <div className="absolute inset-0 dot-grid opacity-[0.03]" />

      {/* Blue gradient orb */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(10, 132, 255, 0.12), transparent)',
        }}
      />

      {/* Centered compact diagram */}
      <div className="relative z-10 w-full py-6 px-2 flex items-center justify-center">
        <div className="w-full max-w-[300px] mx-auto grid grid-cols-1 gap-0 items-center">
          {/* Ecosystem Partners — 2x2 grid */}
          <div className="flex flex-col items-center">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5 text-center">
              Ecosystem Partners
            </p>
            <div className="grid grid-cols-2 gap-1.5 w-full">
              {ecosystemPartners.map((partner, index) => (
                <div
                  key={partner.name}
                  className="bg-white/[0.06] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-[11px] text-white/80 text-center"
                  style={{
                    animation: `float-subtle ${5 + index * 0.5}s ease-in-out infinite`,
                    animationDelay: `${index * 0.4}s`,
                  }}
                >
                  {partner.name}
                </div>
              ))}
            </div>
          </div>

          {/* Connector: Partners → Core */}
          <AnimatedConnectorBlue />

          {/* Center: Lynia Core */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="bg-info rounded-lg p-4 text-center w-full"
              style={{ animation: 'pulse-glow-blue 4s ease-in-out infinite' }}
            >
              <p className="text-body-sm text-white font-medium">Lynia</p>
              <p className="text-[10px] text-white/70 mt-0.5">Core Engine</p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mt-1 w-full">
              {apiServices.map((service, index) => (
                <div
                  key={service.name}
                  className="bg-white/[0.08] border border-white/[0.12] rounded-sm px-2 py-1 text-[9px] text-white/80 text-center leading-tight"
                  style={{
                    animation: `float-subtle ${6 + index * 0.3}s ease-in-out infinite`,
                    animationDelay: `${index * 0.25}s`,
                  }}
                >
                  {service.name}
                </div>
              ))}
            </div>
          </div>

          {/* Connector: Core → Mobile Money */}
          <AnimatedConnectorBlue />

          {/* Mobile Money Providers — 2x2 grid */}
          <div className="flex flex-col items-center">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5 text-center">
              Mobile Money
            </p>
            <div className="grid grid-cols-2 gap-1.5 w-full">
              {mobileMoneyProviders.map((provider, index) => (
                <div
                  key={provider.name}
                  className="bg-white/[0.06] border border-white/[0.08] rounded-md px-2.5 py-1.5 flex items-center justify-center gap-2"
                  style={{
                    animation: `float-subtle ${5 + index * 0.5}s ease-in-out infinite`,
                    animationDelay: `${index * 0.4}s`,
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: provider.color,
                      animation: 'pulse-dot 3s ease-in-out infinite',
                      animationDelay: `${index * 0.5}s`,
                    }}
                  />
                  <span className="text-[11px] text-white/80">
                    {provider.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
