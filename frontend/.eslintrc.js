module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['react', 'react-hooks'],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/demo/fakes*'],
        message: 'Import demo data only in demoGate.js, useLeads.js, or Dashboard.jsx. Use useApiWithDemo for API calls.',
        importNames: ['*']
      }]
    }],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
}
