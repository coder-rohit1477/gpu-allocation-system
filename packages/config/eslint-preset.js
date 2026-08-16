// @ts-check
const tseslint = require("typescript-eslint");
const eslintConfigPrettier = require("eslint-config-prettier");

/**
 * Shared base ESLint flat-config array for TypeScript packages/apps.
 * Consumers spread this into their own eslint.config.js and append
 * project-specific overrides (e.g. React rules).
 * @param {{ tsconfigRootDir: string }} options
 */
function base({ tsconfigRootDir }) {
  return [
    ...tseslint.configs.recommended,
    {
      languageOptions: {
        parserOptions: {
          tsconfigRootDir,
        },
      },
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
      },
    },
    eslintConfigPrettier,
    {
      ignores: ["dist/**", "build/**", "node_modules/**", "coverage/**", "generated/**"],
    },
  ];
}

module.exports = { base };
