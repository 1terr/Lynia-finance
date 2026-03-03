'use client';

import { useWhatsAppChat, type ChatMessage } from '@/lib/useWhatsAppChat';
import { CheckCheck, ShieldCheck } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ChatHeader() {
  return (
    <div className="bg-[#075E54] px-3 py-2.5 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
        <span className="text-white text-[13px] font-semibold">L</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-white text-[13px] font-medium truncate">
            Lynia Finance
          </span>
          <ShieldCheck className="w-3 h-3 text-[#34B7F1] flex-shrink-0" />
        </div>
        <p className="text-[10px] text-white/60 leading-tight">Online</p>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  animate,
}: {
  message: ChatMessage;
  animate: boolean;
}) {
  const isOutgoing = message.type === 'outgoing';

  return (
    <div
      className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} ${
        animate ? 'animate-fade-up' : ''
      }`}
      style={animate ? { animationFillMode: 'both' } : undefined}
    >
      <div
        className={`max-w-[85%] rounded-lg px-2.5 py-1.5 shadow-sm ${
          isOutgoing
            ? 'bg-[#DCF8C6] rounded-tr-sm'
            : 'bg-white rounded-tl-sm'
        }`}
      >
        <p className="text-[11px] leading-[15px] text-[#303030] whitespace-pre-line">
          {message.text}
        </p>
        <div className="flex items-center gap-0.5 mt-0.5 justify-end">
          <span className="text-[9px] text-[#667781]">
            {message.timestamp}
          </span>
          {isOutgoing && (
            <CheckCheck className="w-3 h-3 text-[#53BDEB]" />
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-up" style={{ animationFillMode: 'both' }}>
      <div className="bg-white rounded-lg rounded-tl-sm px-3 py-2.5 shadow-sm inline-flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#667781] animate-typing-bounce"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

interface WhatsAppChatDemoProps {
  isVisible: boolean;
}

export function WhatsAppChatDemo({ isVisible }: WhatsAppChatDemoProps) {
  const { visibleMessages, isTyping, phase } = useWhatsAppChat(isVisible);

  return (
    <div className="relative rounded-xl overflow-hidden bg-surface-secondary h-[520px]">
      {/* Decorative background */}
      <div className="absolute inset-0 dot-grid opacity-[0.35]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(99, 91, 255, 0.08), transparent)',
        }}
      />

      {/* Narrowed chat screen */}
      <div className="relative z-10 flex items-center justify-center h-full py-4 px-3">
        <div
          className="w-full max-w-[280px] h-[488px] rounded-2xl overflow-hidden transition-opacity duration-700 flex flex-col"
          style={{ opacity: phase === 'fading' ? 0 : 1 }}
        >
          <ChatHeader />

          <div className="whatsapp-wallpaper p-2.5 flex-1 overflow-hidden flex flex-col justify-end">
            <div className="space-y-1">
              {visibleMessages.map((msg, i) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  animate={i === visibleMessages.length - 1}
                />
              ))}
              {isTyping && <TypingIndicator />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
