import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig([
  {
    // The `ignores` property is for file exclusion
    ignores: ["**/*-bundle.js", "docs/"],
    //files: ["**/*.{js,mjs,cjs}"],
    files: ["**/*.{js}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: globals.browser
    },
    // The `rules` property is for rule modification
    rules: {
      // Turns off the 'no-case-declarations' rule
      "no-case-declarations": "off",
      // You can also add other rules and their levels
      "no-unused-vars": "warn"
    }
  },
  eslintConfigPrettier, // Add this line at the end of the array

]);