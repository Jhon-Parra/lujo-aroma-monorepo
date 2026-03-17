/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Premium Perfumissimo
        cream: '#F9F9F6',
        sage: '#9CA389',
        gold: '#D4AF37', // Dorado más vibrante y premium
        charcoal: '#333333',
        'soft-charcoal': '#4A4A4A',
        'primary-green': '#2D4C3B',
        'dark-green': '#1B3326',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['Montserrat', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        }
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      }
    },
  },
  plugins: [],
}
