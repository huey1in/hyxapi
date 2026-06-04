export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,html}', './.storybook/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Kefaiii'", "'Gilroy'", "'MiSans'", '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
        mono: ["'Menlo'", "'Consolas'", "'SF Mono'", "'JetBrains Mono'", 'ui-monospace', 'monospace'],
      },
      colors: {
        'ui-bg':           'var(--ui-bg)',
        'ui-bg-elevated':  'var(--ui-bg-elevated)',
        'ui-bg-subtle':    'var(--ui-bg-subtle)',
        'ui-border':       'var(--ui-border)',
        'ui-divider':      'var(--ui-divider)',
        'ui-text':         'var(--ui-text)',
        'ui-text-2':       'var(--ui-text-2)',
        'ui-text-3':       'var(--ui-text-3)',
        'ui-accent':       'var(--ui-accent)',
        'ui-accent-fg':    'var(--ui-accent-fg)',
        'ui-accent-hover': 'var(--ui-accent-hover)',
        'ui-danger':       'var(--ui-danger)',
        'ui-danger-bg':    'var(--ui-danger-bg)',
        'ui-brand':        'var(--ui-brand)',
      },
    },
  },
  plugins: [],
};
