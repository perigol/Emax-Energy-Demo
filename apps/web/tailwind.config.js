/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f3f0e8',
        ink: '#1c1915',
        pine: '#1e2a24',
        gold: '#c4a35a',
        line: '#e4dfd4',
        moss: '#1f6b4a',
        clay: '#8d3b32',
        mist: '#6b645b',
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-manrope)', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(28, 25, 21, 0.04), 0 12px 32px rgba(30, 42, 36, 0.06)',
      },
    },
  },
  plugins: [],
}
