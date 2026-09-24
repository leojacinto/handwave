// ESLint flat config — wires up the AIUX ESLint plugins.
// See https://eslint.org/docs/latest/use/configure/configuration-files

import js from '@eslint/js';
import globals from 'globals';
import babelParser from '@babel/eslint-parser';
import aiuxStyle from '@servicenow/eslint-plugin-aiux-style';
import aiuxApp from '@servicenow/eslint-plugin-aiux-app';
import aiuxA11y from '@servicenow/eslint-plugin-aiux-a11y';
import aiuxI18n from '@servicenow/eslint-plugin-aiux-i18n';
import {rules as ssrRules} from '@servicenow/eslint-plugin-aiux-ssr';

const ssrPlugin = {rules: ssrRules};

const babelLanguageOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  parser: babelParser,
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      plugins: [['@babel/plugin-proposal-decorators', {version: '2023-05'}]]
    }
  },
  globals: {...globals.browser, ...globals.node, ...globals.es2021}
};

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-metadata/**',
      '.aix/**',
      '.now/**',
      'coverage/**',
      'target/**',
      '.types/**',
      '@types/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: babelLanguageOptions,
    rules: {
      'no-unused-vars': [
        'error',
        {argsIgnorePattern: '^_', caughtErrors: 'none'}
      ]
    }
  },
  // Fluent server-side scripts (business rules, flow actions) — Glide globals
  {
    files: ['src/fluent/**/*.js', 'components/**/server-script.js'],
    languageOptions: {
      globals: {
        GlideRecord: 'readonly',
        GlideAggregate: 'readonly',
        GlideDateTime: 'readonly',
        GlideSystem: 'readonly',
        GlideUser: 'readonly',
        gs: 'readonly',
        current: 'readonly',
        previous: 'readonly',
        action: 'readonly',
        inputs: 'readonly',
        outputs: 'readonly'
      }
    }
  },
  ...aiuxStyle.recommended,
  ...aiuxApp.recommended,
  ...aiuxA11y.recommended,
  ...aiuxI18n.flatConfigs.recommended,
  // SSR-safety rules for Lit components rendered server-side
  {
    files: ['pages/**/*.js', 'components/**/*.js'],
    ignores: ['**/__tests__/**', '**/*.test.js'],
    plugins: {'@servicenow/aiux-ssr': ssrPlugin},
    rules: {
      '@servicenow/aiux-ssr/no-browser-globals-in-render': 'error',
      '@servicenow/aiux-ssr/no-dom-reads-in-render': 'error',
      '@servicenow/aiux-ssr/no-non-deterministic-apis': 'error',
      '@servicenow/aiux-ssr/no-side-effects-in-render': 'error',
      '@servicenow/aiux-ssr/no-side-effects-in-constructor': 'error',
      '@servicenow/aiux-ssr/no-module-level-browser-access': 'error',
      '@servicenow/aiux-ssr/require-loader-for-data': 'warn',
      '@servicenow/aiux-ssr/prefer-isserver-guard': 'warn',
      '@servicenow/aiux-ssr/prefer-nothing': 'warn',
      '@servicenow/aiux-ssr/prefer-icon-directive': 'warn'
    }
  }
];
