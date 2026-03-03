'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { useTypewriter } from '@/lib/useTypewriter';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ShieldCheck, BarChart3, Banknote, Lock } from 'lucide-react';

const CODE_SAMPLE = `import { Lynia } from '@lynia/sdk';

const client = new Lynia({
  apiKey: 'sk_live_...',
});

// Verify identity
const kyc = await client.kyc.verify({
  nationalId: '63-123456-A-78',
  phone: '+263771234567',
});

// Score & disburse
const loan = await client.credit.disburse({
  customerId: kyc.customerId,
  amount: 150_00,
  currency: 'USD',
  wallet: 'ecocash',
});`;

const features = [
  { icon: ShieldCheck, label: 'KYC Verification', desc: 'National ID + face match in seconds' },
  { icon: BarChart3, label: 'Credit Scoring', desc: 'ML-based scoring from mobile money data' },
  { icon: Banknote, label: 'Instant Disbursement', desc: 'Push to EcoCash, Innbucks, OneWallet' },
  { icon: Lock, label: 'Device Management', desc: 'IoT-based collateral via Trustonic' },
];

function highlightCode(text: string) {
  // Simple tokenizer for syntax highlighting
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const parts: { text: string; className: string }[] = [];
    let remaining = line;

    // Comments
    const commentIdx = remaining.indexOf('//');
    if (commentIdx !== -1) {
      const before = remaining.slice(0, commentIdx);
      const comment = remaining.slice(commentIdx);
      if (before) processSegment(before, parts);
      parts.push({ text: comment, className: 'text-white/35' });
      remaining = '';
    }

    if (remaining) processSegment(remaining, parts);

    return (
      <span key={lineIdx}>
        {parts.map((p, i) => (
          <span key={i} className={p.className}>{p.text}</span>
        ))}
        {lineIdx < lines.length - 1 ? '\n' : ''}
      </span>
    );
  });
}

function processSegment(text: string, parts: { text: string; className: string }[]) {
  // Match keywords, strings, and numbers
  const regex = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b(?:import|from|const|await|new)\b)|(\b\d[\d_]*\b)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), className: 'text-white/80' });
    }

    if (match[1]) {
      // String
      parts.push({ text: match[0], className: 'text-success' });
    } else if (match[2]) {
      // Keyword
      parts.push({ text: match[0], className: 'text-primary' });
    } else if (match[3]) {
      // Number
      parts.push({ text: match[0], className: 'text-warning' });
    }

    lastIndex = regex.lastIndex;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), className: 'text-white/80' });
  }
}

export function DeveloperEngine() {
  const { ref, isVisible } = useScrollAnimation();
  const { displayedText, showCursor } = useTypewriter({
    text: CODE_SAMPLE,
    speed: 40,
    pauseAfterComplete: 2000,
    pauseAfterClear: 800,
    enabled: isVisible,
  });

  return (
    <section ref={ref} className="relative bg-navy py-16 lg:py-24 overflow-hidden">
      {/* Subtle background texture */}
      <div className="absolute inset-0 dot-grid opacity-[0.03]" />

      <div className="container-main relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left: heading + feature highlights */}
          <div>
            <SectionHeading
              overline="THE DEVELOPER ENGINE"
              title="Programmable Resilience."
              subtitle="One integration to manage KYC, scoring, and disbursement across Zimbabwe's mobile money landscape."
              isVisible={isVisible}
              dark
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10">
              {features.map((feat, i) => (
                <div
                  key={feat.label}
                  className={`flex items-start gap-3 p-4 rounded-lg bg-white/[0.04] border border-white/[0.06] fade-in ${
                    isVisible ? 'fade-in-visible' : 'fade-in-hidden-sm'
                  }`}
                  style={{ transitionDelay: `${180 + i * 60}ms` }}
                >
                  <feat.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-body-sm font-medium text-white">{feat.label}</p>
                    <p className="text-caption text-white/50 mt-1">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: code block */}
          <div
            className={`text-left bg-navy-darker rounded-xl p-6 lg:p-8 shadow-stripe-lg ring-1 ring-white/[0.08] fade-in-slow ${
              isVisible ? 'fade-in-visible' : 'fade-in-hidden-lg'
            }`}
            style={{ transitionDelay: '180ms' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-error/60" />
              <div className="w-3 h-3 rounded-full bg-warning/60" />
              <div className="w-3 h-3 rounded-full bg-success/60" />
            </div>
            <pre className="text-body-sm overflow-hidden font-mono h-[420px]">
              <code>
                {highlightCode(displayedText)}
                {showCursor && (
                  <span className="animate-blink text-primary font-normal">|</span>
                )}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
