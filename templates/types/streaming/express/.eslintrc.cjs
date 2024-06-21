export default [
  {
    extends: ["eslint:recommended", "prettier"],
    rules: {
      "max-params": ["error", 4],
      "prefer-const": "error",
    },
  },
];
