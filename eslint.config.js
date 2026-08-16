// @ts-check
const { base } = require("./packages/config/eslint-preset.js");

module.exports = [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/generated/**",
      "backend/**",
      "frontend/**",
    ],
  },
  ...base({ tsconfigRootDir: __dirname }),
  {
    // Root-level and packages/config tooling files are plain CommonJS (no "type": "module"),
    // so require() is the idiomatic, correct form here rather than a lint violation.
    files: ["*.js", "packages/config/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
