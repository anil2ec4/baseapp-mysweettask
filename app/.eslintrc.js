/* eslint-env node */
module.exports = {
  root: true,
  extends: [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    // Build'i bozan kurallar
    "@typescript-eslint/no-explicit-any": "off",
    "@next/next/no-img-element": "off",
    "react/no-unescaped-entities": "off",

    // Uyarı kalsın ama build'i bozmasın
    "react-hooks/exhaustive-deps": "warn",
  },
};
