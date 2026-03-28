/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Premium Lujo & Aroma (Mediterranean Blue & Gold)
        cream: '#F4F4F4', // Ligeramente más blanco perlado
        gold: '#D4AF37', // Dorado puro brillante
        'gold-muted': '#B59A68', // Dorado sutil
        navy: '#0A192F', // Azul Mediterráneo profundo
        'navy-light': '#1A365D', // Azul acento
        'navy-dark': '#061121', // Fondo naval oscuro
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
