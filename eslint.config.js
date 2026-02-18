const browserGlobals = {
    window: 'readonly',
    document: 'readonly',
    console: 'readonly',
    bootstrap: 'readonly',
    IntersectionObserver: 'readonly',
    ResizeObserver: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly'
};

const baseRules = {
    'eqeqeq': ['error', 'always'],
    'no-unreachable': 'error',
    'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }],
    'no-var': 'error'
};

module.exports = [
    {
        ignores: ['js/vendor/**', 'node_modules/**']
    },
    {
        files: ['js/site-shell.js', 'js/services-panel.js', 'js/particles.js', 'js/section-effects.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: browserGlobals
        },
        rules: baseRules
    },
    {
        files: ['js/water-bg.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: browserGlobals
        },
        rules: baseRules
    }
];
