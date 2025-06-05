import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-assign-module-variable": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "prettier.config.mjs",
      "eslint.config.mjs",
      "postcss.config.js",
    ],
  },
];

export default eslintConfig;
