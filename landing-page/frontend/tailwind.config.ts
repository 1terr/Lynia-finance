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
          light: '#1A3550',
        },
        slate: {
          DEFAULT: '#425466',
          light: '#ADBDCC',
        },
        border: '#E0E6EB',
        success: '#1DB954',
        warning: '#F59E0B',
        error: '#df1b41',
        whatsapp: '#25D366',
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        display: ['4rem', { lineHeight: '1.15', fontWeight: '500' }],
        'display-mobile': ['2.25rem', { lineHeight: '1.2', fontWeight: '500' }],
        h1: ['3rem', { lineHeight: '1.2', fontWeight: '500' }],
        'h1-mobile': ['1.875rem', { lineHeight: '1.25', fontWeight: '500' }],
        h2: ['2.375rem', { lineHeight: '1.26', fontWeight: '500' }],
        'h2-mobile': ['1.625rem', { lineHeight: '1.3', fontWeight: '500' }],
        h3: ['1.75rem', { lineHeight: '1.35', fontWeight: '500' }],
        'h3-mobile': ['1.375rem', { lineHeight: '1.4', fontWeight: '500' }],
        h4: ['1.375rem', { lineHeight: '1.4', fontWeight: '500' }],
        h5: ['1.125rem', { lineHeight: '1.5', fontWeight: '500' }],
        'body-lg': ['1.25rem', { lineHeight: '1.6', fontWeight: '400' }],
        body: ['1.125rem', { lineHeight: '1.56', fontWeight: '300' }],
        'body-sm': ['0.9375rem', { lineHeight: '1.6', fontWeight: '400' }],
        caption: ['0.8125rem', { lineHeight: '1.5', fontWeight: '500' }],
        overline: ['0.8125rem', { lineHeight: '1.5', fontWeight: '500' }],
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
        sm: '0px 1px 1px rgba(0, 0, 0, 0.03), 0px 3px 6px rgba(18, 42, 66, 0.02)',
        md: '0px 2px 4px rgba(0, 0, 0, 0.04), 0px 6px 12px rgba(18, 42, 66, 0.04)',
        lg: '0px 4px 8px rgba(0, 0, 0, 0.04), 0px 12px 24px rgba(18, 42, 66, 0.06)',
        xl: '0px 8px 16px rgba(0, 0, 0, 0.06), 0px 24px 48px rgba(18, 42, 66, 0.08)',
        input: '0px 3px 10px rgba(18, 42, 66, 0.08)',
        fab: '0 4px 12px rgba(37, 211, 102, 0.4)',
      },
      maxWidth: {
        container: '1080px',
        narrow: '780px',
        wide: '1280px',
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
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInRight: {
          from: { opacity: '0', transform: 'translateX(40px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 600ms cubic-bezier(0, 0, 0.2, 1) forwards',
        'fade-in-right': 'fadeInRight 700ms cubic-bezier(0, 0, 0.2, 1) forwards',
        float: 'float 4s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
