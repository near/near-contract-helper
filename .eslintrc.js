module.exports = {
    env: {
        es6: true,
        node: true
    },
    extends: 'eslint:recommended',
    parser: 'babel-eslint',
    parserOptions: {
        ecmaVersion: 2018
    },
    rules: {
        indent: ['error', 4, { SwitchCase: 1 }],
        'linebreak-style': ['error', 'unix'],
        quotes: ['error', 'single'],
        semi: ['error', 'always'],
        'no-console': 'off',
        'require-atomic-updates': 'off',
        'no-useless-escape': 'off',
    },
};
