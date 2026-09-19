import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    // Compiler-owned Convex bindings and generated/build/dependency artifacts.
    ignores: ["**/node_modules/**", "**/dist/**", "**/out/**", "**/coverage/**", "**/.expo/**", "convex/_generated/**"],
  },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.bun } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
);
