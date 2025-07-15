import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["packages/create-llama/**"],
    rules: {
      "max-params": ["error", 4],
      "prefer-const": "error",
      "no-empty": "off",
      "no-extra-boolean-cast": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-wrapper-object-types": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  {
    ignores: [
      "python/**",
      "**/*.mypy_cache/**",
      "**/*.venv/**",
      "**/*.ruff_cache/**",
      "**/dist/**",
      "**/e2e/cache/**",
      "**/lib/*",
      "**/.next/**",
      "**/out/**",
      "**/node_modules/**",
      "**/build/**",
    ],
  },
);
