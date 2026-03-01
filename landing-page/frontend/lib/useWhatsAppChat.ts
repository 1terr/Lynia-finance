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
/*  Chat script                                                        */
/* ------------------------------------------------------------------ */

const MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    type: 'outgoing',
    text: 'Apply for a loan',
    timestamp: '10:31 AM',
  },
  {
    id: 'msg-2',
    type: 'incoming',
    text: 'Upload your National ID for verification 📸',
    timestamp: '10:31 AM',
  },
  {
    id: 'msg-3',
    type: 'outgoing',
    text: '📎 ID uploaded',
    timestamp: '10:32 AM',
  },
  {
    id: 'msg-4',
    type: 'incoming',
    text: '✅ KYC Verified\nScore: 720 · Eligible: $500',
    timestamp: '10:32 AM',
  },
  {
    id: 'msg-5',
    type: 'incoming',
    text: '✅ Approved! $300 sent to EcoCash •••567',
    timestamp: '10:33 AM',
  },
];

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
  { action: 'pause', ms: 800 },
  { action: 'show', index: 0 },
  { action: 'pause', ms: 600 },
  { action: 'typing', ms: 1200 },
  { action: 'show', index: 1 },
  { action: 'pause', ms: 1000 },
  { action: 'show', index: 2 },
  { action: 'pause', ms: 500 },
  { action: 'typing', ms: 1500 },
  { action: 'show', index: 3 },
  { action: 'pause', ms: 400 },
  { action: 'typing', ms: 1000 },
  { action: 'show', index: 4 },
  { action: 'pause', ms: 2500 },
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

  return {
    visibleMessages: MESSAGES.slice(0, visibleCount),
    isTyping,
    phase,
  };
}
