module.exports = {
  root: true,
  extends: ['react-app', 'react-app/jest'],
  rules: {
    'no-unused-vars': 'warn',
    'no-undef': 'error'
  },
  env: {
    browser: true,
    node: true,
    es6: true
  },
  // This will suppress the deprecation warning in the console
  parserOptions: {
    ecmaVersion: 2020
  }
};
