import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginJest from "eslint-plugin-jest";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: {
      jest: eslintPluginJest,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
    settings: {
      jest: {
        version: 29,
      },
    },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "jest/expect-expect": "error",
      "jest/no-disabled-tests": "warn",
      "jest/no-focused-tests": "error",
    },
    ignores: [
      "dist/",
      "node_modules/",
      "*.js",
      "bootstrap-5.3.3-dist/",
      "coverage/",
    ],
  }
);
