import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "unused-imports": unusedImports,
      import: importPlugin,
    },
    rules: {
      // Automatische Bereinigung unbenutzter Imports via eslint --fix
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      // Automatische Sortierung der Imports
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling"],
            "index",
          ],
          pathGroups: [
            {
              pattern: "@/**",
              group: "internal",
              position: "before",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "ignore",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],

      // Deterministische Durchsetzung von Design-Tokens & Best Practices
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#(?:[0-9a-fA-F]{3,8})\\b/]",
          message:
            "Hardcoded hex colors are forbidden. Use semantic tokens defined in globals.css instead.",
        },
        {
          selector: "Literal[value=/(?:text|bg|border|p|m|gap|w|h)-\\[[^\\]]+\\]/]",
          message:
            "Ad-hoc Tailwind bracket notation (e.g. text-[10px]) is forbidden. Use semantic tokens (text-3xs, text-2xs) or standard Tailwind utility classes.",
        },
        {
          selector:
            "CallExpression[callee.object.name='JSON'][callee.property.name='parse'] > CallExpression[callee.object.name='JSON'][callee.property.name='stringify']",
          message:
            "Forbidden poor-man's deep clone: use structuredClone(value) instead of JSON.parse(JSON.stringify(value)).",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
