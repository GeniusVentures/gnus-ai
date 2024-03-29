module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint"],
  extends: ["standard", "plugin:node/recommended", "plugin:import/typescript"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "node/no-unsupported-features/es-syntax": [
      "error",
      { ignores: ["modules"] },
    ],
    quotes: "off",
    indent: ["warn", 2],
    semi: "off",
    "comma-dangle": 0,
    "space-before-function-paren": 0,
    "import/no-extraneous-dependencies": ["error", { ignores: ["devDependencies", "optionalDependencies", "peerDependencies"] }]
  },
};
