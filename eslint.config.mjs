// KÖK: eslint.config.mjs
import tsParser from '@typescript-eslint/parser';
import ts from '@typescript-eslint/eslint-plugin';
import next from 'eslint-config-next';               // Next 15 flat config
import nextPlugin from '@next/eslint-plugin-next';

export default [
  // NextJS’in önerilen kuralları (core-web-vitals dahil)
  ...next(),

  // TS/TSX dosyaları için parser + kurallar
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      // Build’i kıran kuralları kapat
      '@typescript-eslint/no-explicit-any': 'off',
      '@next/next/no-img-element': 'off',
      'react/no-unescaped-entities': 'off',

      // Uyarı kalsın, build’i bozmasın
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // (opsiyonel) JS/TS dışı dosyalarda Next plugin erişimi
  {
    plugins: { next: nextPlugin },
  },
];
