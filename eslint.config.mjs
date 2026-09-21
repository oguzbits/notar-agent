import { plugin as shadcnPlugin } from '@shadcn/lint';
import pluginQuery from '@tanstack/eslint-plugin-query';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...pluginQuery.configs['flat/recommended'],
  {
    plugins: {
      'unused-imports': unusedImports,
      import: importPlugin,
      shadcn: shadcnPlugin,
    },
    settings: {
      shadcn: {
        ui: '@/components/ui',
        mergeFunctions: ['cn'],
        note: 'Befolge die AGENTS.md Design-System-Regeln: Nutze ausschließlich semantische Tokens und Primitives aus @/components/ui.',
      },
    },
    rules: {
      // Automatische Bereinigung unbenutzter Imports via eslint --fix
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Automatische Sortierung der Imports
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index'],
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'ignore',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      // Strikte Fehlerbehandlung & Type Safety aus AGENTS.md
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
        },
      ],

      // Deterministische Durchsetzung von Design-Tokens & Best Practices
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CatchClause[param=null]',
          message:
            'Zero silent error swallowing: catch clauses must declare an error parameter and provide actionable context or logging.',
        },
        {
          selector: 'Literal[value=/#(?:[0-9a-fA-F]{3,8})\\b/]',
          message:
            'Hardcoded hex colors are forbidden. Use semantic tokens defined in globals.css instead.',
        },
        {
          selector: 'Literal[value=/(?:text|bg|border|p|m|gap|w|h)-\\[[^\\]]+\\]/]',
          message:
            'Ad-hoc Tailwind bracket notation is forbidden. Use semantic tokens (text-3xs, text-2xs) or standard Tailwind utility classes.',
        },
        {
          selector:
            "CallExpression[callee.object.name='JSON'][callee.property.name='parse'] > CallExpression[callee.object.name='JSON'][callee.property.name='stringify']",
          message:
            "Forbidden poor-man's deep clone: use structuredClone(value) instead of JSON.parse(JSON.stringify(value)).",
        },
        {
          selector:
            "TSAsExpression[typeAnnotation.typeName.name!='const'][expression.type='TSAsExpression']",
          message:
            "Forbidden double type assertion ('as unknown as ...' / 'as any as ...'). Use proper domain schemas, type guards, or test factories instead.",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] > JSXExpressionContainer > TemplateLiteral",
          message:
            "Raw template literals in className are forbidden. Use cn(...) from '@/lib/utils' to merge Tailwind classes deterministically.",
        },
        {
          selector:
            "BinaryExpression[operator=/===|!==/] > Literal[value=/^(?:[A-Z][A-Z0-9_]{2,})$/]:not([value=/^(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/])",
          message:
            'Raw enum string literals in equality comparisons are forbidden. Import canonical `as const` dictionaries from `@/types/dossier` or relevant domain module.',
        },
        {
          selector:
            "CallExpression[callee.object.name='z'][callee.property.name='literal'] > Literal[value=/^[A-Z][A-Z0-9_]{2,}$/]",
          message:
            'Raw enum strings in z.literal() are forbidden. Use canonical `as const` dictionaries from `@/types/dossier`.',
        },
        {
          selector: 'ExportAllDeclaration',
          message:
            'Wildcard re-exports (`export * from ...`) are forbidden by AGENTS.md. Use explicit named exports.',
        },
        {
          selector:
            'TSTypeAliasDeclaration[typeAnnotation.type="TSTypeReference"][typeAnnotation.typeName.type="Identifier"]:not([typeAnnotation.typeArguments]):not([typeAnnotation.typeParameters]):not([typeParameters])',
          message:
            'Redundant type alias forbidden: Direct 1:1 type aliasing (`type A = B;`) is forbidden. Use the canonical type directly.',
        },
      ],

      // @shadcn/lint: Design System & Primitive-First Enforcement (AGENTS.md Section 3)
      'shadcn/require-static-classes': 'error',
      'shadcn/no-inline-styles': 'error',
      'shadcn/no-arbitrary-values': ['warn', { allow: ['[overflow-wrap:anywhere]'] }],
      'shadcn/no-raw-colors': 'warn',
      'shadcn/no-restyle': ['warn', { allow: ['layout'] }],
    },
  },
  {
    // layout.tsx setzt Browser-Root-Defaults (z.B. colorScheme)
    files: ['src/app/layout.tsx'],
    rules: {
      'shadcn/no-inline-styles': 'off',
    },
  },
  {
    // Bild- und Scan-Fixtures generieren SVG- und Canvas-Farben direkt (Hex-Codes für Tinte, Papier, Siegel)
    files: ['scripts/fixtures/**', 'src/test/fixtures/**'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', '.agents/**']),
]);

export default eslintConfig;
