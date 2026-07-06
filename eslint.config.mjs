import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ["**/node_modules", "**/artifacts", "**/cache", "**/coverage"],
  },
  ...compat.extends(
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
      globals: {
        ...Object.fromEntries(
          Object.entries(globals.browser).map(([key]) => [key, "off"]),
        ),
        ...globals.mocha,
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: "module",

      parserOptions: {
        project: "./tsconfig.json",
      },
    },

    rules: {
      // --- Turned-off defaults (project-specific) ---
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-unused-expressions": "off",

      // --- Matching C++ coding standards ---
      // Always use braces on if/while/for/switch even for single statements
      curly: ["error", "all"],

      // Never use == or != — always === and !==
      eqeqeq: ["error", "always"],

      // Prefer const over let (const by default)
      "prefer-const": "error",

      // No reassigning function parameters (no in/out parameters)
      "no-param-reassign": ["error", { props: true }],

      // Always throw Error objects, never string/number literals
      "no-throw-literal": "error",

      // No magic numbers — use named constants
      "no-magic-numbers": [
        "error",
        {
          ignore: [0, 1, 2, -1],
          ignoreArrayIndexes: true,
          ignoreEnums: true,
          ignoreReadonlyClassProperties: true,
        },
      ],

      // All variables must be initialized
      "init-declarations": ["error", "always"],

      // No unused variables (allow _ prefix for intentional)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // Explicit return types on exported functions (Doxygen parallel)
      "@typescript-eslint/explicit-function-return-type": "error",
    },
  },
];
