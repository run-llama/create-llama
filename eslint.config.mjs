import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
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
    },
  },
  {
    files: ["packages/server/**"],
    // TODO: currently, we only apply tseslint recommended rules to server packages
    // we should apply the same rules for create-llama and fix errors in all files when applying create-llama
    extends: [...tseslint.configs.recommended],
    rules: {
      "no-irregular-whitespace": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": [
        "error",
        {
          ignoreRestArgs: true,
        },
      ],
    },
  },
  {
    ignores: [
      "python/**",
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
