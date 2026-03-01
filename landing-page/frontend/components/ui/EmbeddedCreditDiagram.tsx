'use client';

const mobileMoneyProviders = [
  { name: 'EcoCash', color: '#00A651' },
  { name: 'Innbucks', color: '#FF6B00' },
];

const apiServices = [
  { name: 'KYC Data' },
  { name: 'Credit Scoring' },
  { name: 'Loan Disbursement' },
  { name: 'Insurance' },
];

const ecosystemPartners = [
  { name: 'Retailers' },
  { name: 'Platforms' },
];

function AnimatedConnectorBlue() {
  return (
    <div className="flex items-center justify-center">
      <svg
        width="60"
        height="40"
        viewBox="0 0 60 40"
        fill="none"
        aria-hidden="true"
      >
        {/* Base line */}
        <line
          x1="4"
          y1="20"
          x2="52"
          y2="20"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.5"
        />

        {/* Animated dashed overlay — blue theme */}
        <line
          x1="4"
          y1="20"
          x2="52"
          y2="20"
          stroke="rgba(10,132,255,0.35)"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          strokeLinecap="round"
          style={{ animation: 'flow-dash 1.5s linear infinite' }}
        />

        {/* Pulsing start dot */}
        <circle cx="4" cy="20" r="3" fill="rgba(10,132,255,0.15)" />
        <circle
          cx="4"
          cy="20"
          r="2"
          fill="rgba(10,132,255,0.5)"
          style={{ animation: 'pulse-dot 3s ease-in-out infinite' }}
        />

        {/* Flowing particle 1 */}
        <circle r="2" fill="rgba(10,132,255,0.8)">
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path="M 4 20 L 52 20"
          />
        </circle>

        {/* Flowing particle 2 (staggered) */}
        <circle r="1.5" fill="rgba(110,195,244,0.6)">
          <animateMotion
            dur="2s"
            begin="0.8s"
            repeatCount="indefinite"
            path="M 4 20 L 52 20"
          />
        </circle>

        {/* Arrow tip */}
        <path
          d="M 48 14 L 56 20 L 48 26"
          stroke="rgba(10,132,255,0.5)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

interface EmbeddedCreditDiagramProps {
  isVisible: boolean;
}

export function EmbeddedCreditDiagram({ isVisible }: EmbeddedCreditDiagramProps) {
  return (
    <div className="relative rounded-xl overflow-hidden bg-navy min-h-[340px] lg:min-h-[400px] w-full flex items-center justify-center">
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
      <div className="relative z-10 w-full py-6 px-4 flex items-center justify-center">
        <div className="w-full max-w-[420px] grid grid-cols-[1fr_60px_auto_60px_1fr] gap-0 items-center">
          {/* Left: Ecosystem Partners */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
              Partners
            </p>
            {ecosystemPartners.map((partner, index) => (
              <div
                key={partner.name}
                className="bg-white/[0.06] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-[11px] text-white/80"
                style={{
                  animation: `float-subtle ${5 + index * 0.5}s ease-in-out infinite`,
                  animationDelay: `${index * 0.4}s`,
                }}
              >
                {partner.name}
              </div>
            ))}
          </div>

          {/* Left → Center Connector */}
          <AnimatedConnectorBlue />

          {/* Center: Lynia Core */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="bg-info rounded-lg p-4 text-center min-w-[120px]"
              style={{ animation: 'pulse-glow-blue 4s ease-in-out infinite' }}
            >
              <p className="text-body-sm text-white font-medium">Lynia</p>
              <p className="text-[10px] text-white/70 mt-0.5">Core Engine</p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mt-1">
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

          {/* Center → Right Connector */}
          <AnimatedConnectorBlue />

          {/* Right: Mobile Money Providers */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
              Mobile $
            </p>
            {mobileMoneyProviders.map((provider, index) => (
              <div
                key={provider.name}
                className="bg-white/[0.06] border border-white/[0.08] rounded-md px-2.5 py-1.5 flex items-center gap-2"
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
  );
}
