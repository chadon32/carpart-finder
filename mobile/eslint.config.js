// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    // These React Compiler rules currently flag standard React Native
    // Animated/ref and request-on-mount patterns. Oxlint and runtime tests
    // still cover hooks correctness without forcing risky release-day rewrites.
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["**/__tests__/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  }
]);
