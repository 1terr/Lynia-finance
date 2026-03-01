'use client';

import { useWhatsAppChat, type ChatMessage } from '@/lib/useWhatsAppChat';
import { CheckCheck, ShieldCheck } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ChatHeader() {
  return (
    <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
        <span className="text-white text-body-sm font-semibold">L</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white text-body-sm font-medium truncate">
            Lynia Finance
          </span>
          <ShieldCheck className="w-3.5 h-3.5 text-[#34B7F1] flex-shrink-0" />
        </div>
        <p className="text-[11px] text-white/60">Online</p>
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
        className={`max-w-[80%] rounded-lg px-3 py-1.5 shadow-sm ${
          isOutgoing
            ? 'bg-[#DCF8C6] rounded-tr-sm'
            : 'bg-white rounded-tl-sm'
        }`}
      >
        <p className="text-[13px] leading-[18px] text-[#303030] whitespace-pre-line">
          {message.text}
        </p>
        <div
          className={`flex items-center gap-1 mt-0.5 ${
            isOutgoing ? 'justify-end' : 'justify-end'
          }`}
        >
          <span className="text-[10px] text-[#667781]">
            {message.timestamp}
          </span>
          {isOutgoing && (
            <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-up" style={{ animationFillMode: 'both' }}>
      <div className="bg-white rounded-lg rounded-tl-sm px-4 py-3 shadow-sm inline-flex items-center gap-1">
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
    <div
      className="rounded-2xl overflow-hidden shadow-stripe-md border border-border transition-opacity duration-700"
      style={{ opacity: phase === 'fading' ? 0 : 1 }}
    >
      <ChatHeader />

      <div className="whatsapp-wallpaper p-3 min-h-[300px] lg:min-h-[360px] flex flex-col justify-end">
        <div className="space-y-1.5">
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
  );
}
