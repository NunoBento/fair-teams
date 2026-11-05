import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
	{
		files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
		plugins: { '@stylistic': stylistic },
		rules: {
			'@typescript-eslint/interface-name-prefix': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@stylistic/no-extra-semi': 'error',
			'@stylistic/semi': ['error', 'always', {omitLastInOneLineClassBody: true,omitLastInOneLineBlock: true}],
			'@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
			'@typescript-eslint/object-curly-newline': [0],
			'quote-props': ['error', 'as-needed'],
			'prefer-destructuring': ['warn', { object: true, array: false }],
			'prefer-template': 'error',
			'spaced-comment': ['error'],
			'comma-dangle': ['error', 'always-multiline'],
		},
	},
	eslint.configs.recommended,
	tseslint.configs.recommended,
);