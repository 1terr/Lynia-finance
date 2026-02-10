'use client';

import { MessageCircle } from 'lucide-react';

export function WhatsAppFAB() {
  return (
    <a
      href="https://wa.me/263"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="group fixed bottom-6 right-6 md:bottom-6 md:right-6 z-fab flex items-center gap-2"
    >
      {/* Tooltip — visible on hover (desktop) */}
      <span className="hidden md:group-hover:block bg-navy text-white text-caption px-3 py-2 rounded-md whitespace-nowrap">
        Chat with us
      </span>

      {/* Button */}
      <div className="w-14 h-14 md:w-14 md:h-14 rounded-full bg-whatsapp shadow-fab flex items-center justify-center transition-transform duration-150 hover:scale-110 active:scale-95">
        <MessageCircle className="w-7 h-7 text-white fill-white" />
      </div>
    </a>
  );
}
