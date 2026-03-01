import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#635BFF',
          dark: '#0A2540',
          hover: '#5651E5',
          light: '#F6F9FC',
          50: '#EBEEF8',
        },
        navy: {
          DEFAULT: '#0A2540',
          light: '#1A3A5C',
          dark: '#061B31',
          darker: '#061525',
        },
        slate: {
          DEFAULT: '#425466',
          light: '#ADBDCC',
        },
        muted: '#6B7C93',
        border: '#E6EBF1',
        'border-strong': '#D3D9E3',
        success: '#30D158',
        warning: '#FF9F0A',
        error: '#FF453A',
        info: '#0A84FF',
        whatsapp: '#25D366',
        surface: {
          secondary: '#F6F9FC',
          tertiary: '#F0F3F9',
        },
        // Custom hero text colors
        'hero-primary': '#2D2564',
        'hero-accent': '#42678E',
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        // Hero H1 — page entry, full-screen impact
        hero: ['3rem', { lineHeight: '1.15', letterSpacing: '-0.03em', fontWeight: '500' }],
        'hero-tablet': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.03em', fontWeight: '500' }],
        'hero-mobile': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],

        // Section H2 — major feature shifts
        display: ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.025em', fontWeight: '500' }],
        'display-tablet': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],
        'display-mobile': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '500' }],

        // Stat numbers — data emphasis (DataStrip)
        stat: ['3rem', { lineHeight: '1.15', letterSpacing: '-0.03em', fontWeight: '500' }],
        'stat-tablet': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.03em', fontWeight: '500' }],
        'stat-mobile': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],

        // Title — intermediate (thesis page, sub-sections)
        title: ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],
        'title-tablet': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],
        'title-mobile': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '500' }],

        // Feature H3 — card titles, small benefits
        heading: ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '500' }],
        'heading-mobile': ['1.125rem', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '500' }],

        // Subheading — UI labels (navbar logo, footer logo)
        subheading: ['1.125rem', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '500' }],

        // Subtext/Lead — high-readability summary text
        'body-lg': ['1.125rem', { lineHeight: '1.55', letterSpacing: '-0.01em', fontWeight: '400' }],

        // Body — general descriptive text
        body: ['1rem', { lineHeight: '1.6', letterSpacing: '0em', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0em', fontWeight: '400' }],

        // Small UI text
        caption: ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.015em', fontWeight: '500' }],
        overline: ['0.75rem', { lineHeight: '1.3', letterSpacing: '0.06em', fontWeight: '600' }],
      },
      letterSpacing: {
        wide: '0.05em',
        wider: '0.1em',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        // Stripe indigo-tinted shadow system (UI-UX-SKILLS.md)
        'stripe-xs': '0 1px 2px rgba(50,50,93,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'stripe-sm': '0 2px 5px rgba(50,50,93,0.08), 0 1px 3px rgba(0,0,0,0.05)',
        stripe: '0 6px 12px rgba(50,50,93,0.10), 0 3px 7px rgba(0,0,0,0.06)',
        'stripe-md': '0 13px 27px rgba(50,50,93,0.15), 0 8px 16px rgba(0,0,0,0.08)',
        'stripe-lg': '0 20px 40px rgba(50,50,93,0.18), 0 15px 30px rgba(0,0,0,0.10)',
        'stripe-xl': '0 30px 60px rgba(50,50,93,0.25), 0 18px 36px rgba(0,0,0,0.12)',
        'stripe-focus': '0 0 0 1px rgba(99,91,255,0.3), 0 1px 1px rgba(0,0,0,0.07), 0 0 0 4px rgba(99,91,255,0.15)',
        'stripe-nav': '0 30px 60px -50px rgba(0,0,0,0.10), 0 30px 60px -10px rgba(50,50,93,0.25)',
        'stripe-menu': '0 18px 36px -18px rgba(0,0,0,0.10), 0 30px 45px -30px rgba(50,50,93,0.25)',
        input: '0px 3px 10px rgba(50,50,93,0.08)',
        btn: '0 1px 2px rgba(0,0,0,0.1)',
        fab: '0 4px 12px rgba(37, 211, 102, 0.4)',
      },
      maxWidth: {
        container: '1080px',
        'content-sm': '720px',
        narrow: '780px',
        wide: '1280px',
      },
      screens: {
        xs: '480px',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
      },
      zIndex: {
        sticky: '100',
        overlay: '200',
        modal: '300',
        toast: '400',
        fab: '500',
      },
      transitionTimingFunction: {
        stripe: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)',
        'stripe-out': 'cubic-bezier(0.215, 0.61, 0.355, 1)',
        'stripe-in': 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-down': {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'slow-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'typing-bounce': {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.45,0.05,0.55,0.95)',
        'fade-down': 'fade-down 0.5s cubic-bezier(0.45,0.05,0.55,0.95)',
        'slide-in-right': 'slide-in-right 0.4s cubic-bezier(0.215,0.61,0.355,1)',
        'slide-in-left': 'slide-in-left 0.4s cubic-bezier(0.215,0.61,0.355,1)',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.45,0.05,0.55,0.95)',
        shimmer: 'shimmer 2s linear infinite',
        'gradient-shift': 'gradient-shift 6s ease infinite',
        'count-up': 'count-up 0.6s cubic-bezier(0.215,0.61,0.355,1)',
        float: 'float 4s ease-in-out infinite',
        blink: 'blink 1s step-end infinite',
        'slow-spin': 'slow-spin 20s linear infinite',
        'typing-bounce': 'typing-bounce 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
