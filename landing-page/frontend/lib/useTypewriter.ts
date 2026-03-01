'use client';

import { useEffect, useRef, useState } from 'react';

interface UseTypewriterOptions {
  text: string;
  /** Characters typed per second. Default: 40 */
  speed?: number;
  /** Milliseconds to pause after finishing before clearing. Default: 2000 */
  pauseAfterComplete?: number;
  /** Milliseconds to pause after clearing before restarting. Default: 800 */
  pauseAfterClear?: number;
  /** Whether the animation is enabled (tied to scroll visibility). */
  enabled?: boolean;
}

type Phase = 'idle' | 'typing' | 'paused' | 'clearing';

export function useTypewriter({
  text,
  speed = 40,
  pauseAfterComplete = 2000,
  pauseAfterClear = 800,
  enabled = false,
}: UseTypewriterOptions) {
  const [charIndex, setCharIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPhase('idle');
      setCharIndex(0);
      return;
    }

    if (phase === 'idle') {
      if (prefersReducedMotion.current) {
        setCharIndex(text.length);
        setPhase('paused');
      } else {
        setPhase('typing');
      }
      return;
    }

    if (phase === 'typing') {
      if (charIndex >= text.length) {
        setPhase('paused');
        return;
      }
      const timer = setTimeout(() => {
        setCharIndex((prev) => prev + 1);
      }, 1000 / speed);
      return () => clearTimeout(timer);
    }

    if (phase === 'paused') {
      const timer = setTimeout(() => {
        setPhase('clearing');
      }, pauseAfterComplete);
      return () => clearTimeout(timer);
    }

    if (phase === 'clearing') {
      const timer = setTimeout(() => {
        setCharIndex(0);
        setPhase('idle');
      }, pauseAfterClear);
      return () => clearTimeout(timer);
    }
  }, [enabled, phase, charIndex, text, speed, pauseAfterComplete, pauseAfterClear]);

  return {
    displayedText: text.slice(0, charIndex),
    showCursor: enabled,
  };
}
