import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#050505',
        card: '#101010',
        primary: {
          DEFAULT: '#00D4AA',
          50: '#e6fff9',
          100: '#b3ffee',
          200: '#66ffe0',
          300: '#00ffd0',
          400: '#00e6b8',
          500: '#00D4AA',
          600: '#00b38e',
          700: '#008a6e',
          800: '#006654',
          900: '#004438',
        },
        accent: '#2A2A2A',
        muted: '#666666',
        border: '#1a1a1a',
        yes: '#00D4AA',
        no: '#FF4757',
        warning: '#FFA502',
        info: '#3B82F6',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #00D4AA 0%, #0080FF 100%)',
        'card-gradient': 'linear-gradient(145deg, #141414 0%, #0a0a0a 100%)',
        'hero-gradient':
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,212,170,0.15), transparent)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0,212,170,0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0,212,170,0.5)' },
        },
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
        'card-hover': '0 4px 24px rgba(0,212,170,0.08), 0 0 0 1px rgba(0,212,170,0.1)',
        'glow-primary': '0 0 30px rgba(0,212,170,0.3)',
        'glow-sm': '0 0 10px rgba(0,212,170,0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
