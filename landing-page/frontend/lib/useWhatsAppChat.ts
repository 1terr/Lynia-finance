'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  type: 'outgoing' | 'incoming';
  text: string;
  timestamp: string;
}

type Phase = 'idle' | 'playing' | 'fading' | 'resetting';

/* ------------------------------------------------------------------ */
/*  Chat script — realistic digital loan application via WhatsApp      */
/* ------------------------------------------------------------------ */

const MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    type: 'outgoing',
    text: 'Mhoro 👋',
    timestamp: '10:30 AM',
  },
  {
    id: 'msg-2',
    type: 'incoming',
    text: 'Welcome to Lynia Finance! 🏦\n\nInstant credit, sent straight to your wallet.\n\n✅ No credit history needed\n✅ Fast approval (<10 min)\n\nWhat\'s your full name?\n(as on your National ID)',
    timestamp: '10:30 AM',
  },
  {
    id: 'msg-3',
    type: 'outgoing',
    text: 'Tendai Mukanya Moyo',
    timestamp: '10:31 AM',
  },
  {
    id: 'msg-4',
    type: 'incoming',
    text: 'Thanks Tendai! What is your monthly income in USD?',
    timestamp: '10:31 AM',
  },
  {
    id: 'msg-5',
    type: 'outgoing',
    text: '350',
    timestamp: '10:31 AM',
  },
  {
    id: 'msg-6',
    type: 'incoming',
    text: '🪪 Enter your National ID number\n\nFormat: XX-XXXXXXX-X-XX\nExample: 63-2345678-B-08',
    timestamp: '10:32 AM',
  },
  {
    id: 'msg-7',
    type: 'outgoing',
    text: '63-2345678-B-08',
    timestamp: '10:32 AM',
  },
  {
    id: 'msg-8',
    type: 'incoming',
    text: '✅ ID received!\n\n📸 Send a clear photo of your National ID\n\nTips:\n✅ Flat surface, good lighting\n✅ All text must be visible',
    timestamp: '10:32 AM',
  },
  {
    id: 'msg-9',
    type: 'outgoing',
    text: '📷 Photo sent',
    timestamp: '10:33 AM',
  },
  {
    id: 'msg-10',
    type: 'incoming',
    text: '✅ ID Photo received!\n\n🤳 Now take a selfie\n✅ Face camera directly\n✅ No sunglasses\n\n🔐 We never share your photos.',
    timestamp: '10:33 AM',
  },
  {
    id: 'msg-11',
    type: 'outgoing',
    text: '🤳 Selfie sent',
    timestamp: '10:33 AM',
  },
  {
    id: 'msg-12',
    type: 'incoming',
    text: '⏳ Verifying your identity...\nThis usually takes 1-2 minutes.',
    timestamp: '10:34 AM',
  },
  {
    id: 'msg-13',
    type: 'incoming',
    text: '✅ Identity Verified!\nAssessing your eligibility...',
    timestamp: '10:35 AM',
  },
  {
    id: 'msg-14',
    type: 'incoming',
    text: '🎉 You\'re Approved!\n\n💰 Amount: $55.00\n📊 Score: 650/850\n💳 Rate: 15% APR\n📅 Repay in 30 days\n\nReply *I Accept* to confirm',
    timestamp: '10:35 AM',
  },
  {
    id: 'msg-15',
    type: 'outgoing',
    text: 'I Accept',
    timestamp: '10:35 AM',
  },
  {
    id: 'msg-16',
    type: 'incoming',
    text: '✅ $55.00 sent to EcoCash •••567!\n\nRepayment: $63.25 due 01 Apr\n\nReply BALANCE anytime to check.\nWelcome to Lynia! 🎉',
    timestamp: '10:36 AM',
  },
];

/** Max messages visible at once — older ones scroll off */
const VISIBLE_WINDOW = 5;

/* ------------------------------------------------------------------ */
/*  Animation steps                                                    */
/* ------------------------------------------------------------------ */

type StepKind =
  | { action: 'pause'; ms: number }
  | { action: 'show'; index: number }
  | { action: 'typing'; ms: number }
  | { action: 'fade-out' }
  | { action: 'reset' };

const STEPS: StepKind[] = [
  // Greeting
  { action: 'pause', ms: 600 },
  { action: 'show', index: 0 },        // "Mhoro 👋"
  { action: 'pause', ms: 500 },
  { action: 'typing', ms: 1200 },
  { action: 'show', index: 1 },        // Welcome message
  { action: 'pause', ms: 1200 },

  // Personal info
  { action: 'show', index: 2 },        // "Tendai Mukanya Moyo"
  { action: 'pause', ms: 400 },
  { action: 'typing', ms: 800 },
  { action: 'show', index: 3 },        // "Thanks Tendai! Monthly income?"
  { action: 'pause', ms: 600 },
  { action: 'show', index: 4 },        // "350"
  { action: 'pause', ms: 400 },

  // KYC — ID number
  { action: 'typing', ms: 1000 },
  { action: 'show', index: 5 },        // "Enter your National ID"
  { action: 'pause', ms: 800 },
  { action: 'show', index: 6 },        // "63-2345678-B-08"
  { action: 'pause', ms: 400 },

  // KYC — ID photo
  { action: 'typing', ms: 800 },
  { action: 'show', index: 7 },        // "Send photo of ID"
  { action: 'pause', ms: 1000 },
  { action: 'show', index: 8 },        // "📷 Photo sent"
  { action: 'pause', ms: 400 },

  // KYC — Selfie
  { action: 'typing', ms: 800 },
  { action: 'show', index: 9 },        // "Now take a selfie"
  { action: 'pause', ms: 800 },
  { action: 'show', index: 10 },       // "🤳 Selfie sent"
  { action: 'pause', ms: 400 },

  // Verification
  { action: 'typing', ms: 2000 },
  { action: 'show', index: 11 },       // "⏳ Verifying..."
  { action: 'pause', ms: 2500 },
  { action: 'show', index: 12 },       // "✅ Identity Verified!"
  { action: 'pause', ms: 400 },

  // Scoring + Approval
  { action: 'typing', ms: 1500 },
  { action: 'show', index: 13 },       // "🎉 You're Approved!"
  { action: 'pause', ms: 2000 },

  // Acceptance + Disbursement
  { action: 'show', index: 14 },       // "I Accept"
  { action: 'pause', ms: 400 },
  { action: 'typing', ms: 1000 },
  { action: 'show', index: 15 },       // "✅ $55.00 sent to EcoCash"
  { action: 'pause', ms: 3000 },

  // Loop
  { action: 'fade-out' },
  { action: 'reset' },
];

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useWhatsAppChat(enabled: boolean) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');

  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const stepRef = useRef(0);
  const activeRef = useRef(false);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
  }, []);

  const runStep = useCallback(() => {
    if (!activeRef.current) return;

    const stepIndex = stepRef.current % STEPS.length;
    const step = STEPS[stepIndex];

    const advance = (delayMs: number) => {
      timerRef.current = setTimeout(() => {
        stepRef.current++;
        runStep();
      }, delayMs);
    };

    switch (step.action) {
      case 'pause':
        advance(step.ms);
        break;

      case 'show':
        setIsTyping(false);
        setVisibleCount(step.index + 1);
        advance(50);
        break;

      case 'typing':
        setIsTyping(true);
        advance(step.ms);
        break;

      case 'fade-out':
        setIsTyping(false);
        setPhase('fading');
        advance(800);
        break;

      case 'reset':
        setVisibleCount(0);
        setPhase('resetting');
        timerRef.current = setTimeout(() => {
          setPhase('playing');
          stepRef.current++;
          runStep();
        }, 600);
        break;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      if (prefersReducedMotion.current) {
        setVisibleCount(MESSAGES.length);
        setPhase('playing');
        return;
      }

      activeRef.current = true;
      stepRef.current = 0;
      setVisibleCount(0);
      setIsTyping(false);
      setPhase('playing');
      runStep();
    } else {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase('idle');
      setVisibleCount(0);
      setIsTyping(false);
      stepRef.current = 0;
    }

    return () => {
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, runStep]);

  // Window the visible messages — only show the last VISIBLE_WINDOW
  const start = Math.max(0, visibleCount - VISIBLE_WINDOW);
  const windowedMessages = MESSAGES.slice(start, visibleCount);

  return {
    visibleMessages: windowedMessages,
    isTyping,
    phase,
  };
}
