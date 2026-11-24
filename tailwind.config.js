/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#03070d',
        abyss: '#050b12',
        panel: '#07111b',
        line: '#173246',
        cyan: '#44dcff',
        forge: '#ff8a3d',
        mist: '#8fa7b5',
      },
      fontFamily: {
        tech: ['Bahnschrift', 'DIN Alternate', 'Rajdhani', 'Segoe UI', 'sans-serif'],
        mono: ['Cascadia Mono', 'JetBrains Mono', 'Consolas', 'monospace'],
        cn: ['Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
