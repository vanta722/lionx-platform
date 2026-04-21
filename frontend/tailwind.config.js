/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#050508',
        bg2:     '#08080f',
        bg3:     '#0c0c18',
        card:    '#0a0a16',
        card2:   '#0e0e22',
        teal:    '#14b8a6',
        'teal-bright': '#2dd4bf',
        gold:    '#f5a623',
        'gold-bright': '#ffc142',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
