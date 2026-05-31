/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: '#070714',
        surface: {
          DEFAULT: '#0E0E1F',
          card: '#12122A',
          elevated: '#181830',
          hover: '#1E1E38',
        },
        brand: {
          DEFAULT: '#7C3AED',
          light: '#A78BFA',
          dark: '#5B21B6',
          glow: 'rgba(124,58,237,0.4)',
        },
        accent: {
          DEFAULT: '#06B6D4',
          light: '#67E8F9',
          glow: 'rgba(6,182,212,0.4)',
        },
        success: { DEFAULT: '#10B981', light: '#6EE7B7', glow: 'rgba(16,185,129,0.4)' },
        warning: { DEFAULT: '#F59E0B', light: '#FCD34D', glow: 'rgba(245,158,11,0.4)' },
        danger:  { DEFAULT: '#EF4444', light: '#FCA5A5', glow: 'rgba(239,68,68,0.4)' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'mesh-dark': 'radial-gradient(at 40% 20%, #1a0533 0px, transparent 50%), radial-gradient(at 80% 0%, #0a1628 0px, transparent 50%), radial-gradient(at 0% 50%, #0d0d2e 0px, transparent 50%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow': 'spin 4s linear infinite',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        shimmer: 'shimmer 2s linear infinite',
        'bounce-light': 'bounceLight 1s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounceLight: {
          '0%, 100%': { transform: 'translateY(-2px)' },
          '50%': { transform: 'translateY(2px)' },
        },
      },
      boxShadow: {
        'glow-brand': '0 0 20px rgba(124,58,237,0.5)',
        'glow-accent': '0 0 20px rgba(6,182,212,0.5)',
        'glow-success': '0 0 20px rgba(16,185,129,0.5)',
        'glow-danger': '0 0 20px rgba(239,68,68,0.5)',
        'card': '0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04) inset',
        'card-hover': '0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06) inset',
        'phone': '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)',
      },
      borderColor: {
        subtle: 'rgba(255,255,255,0.06)',
        DEFAULT: 'rgba(255,255,255,0.06)',
      },
    },
  },
  plugins: [],
}
