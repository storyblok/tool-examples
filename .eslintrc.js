module.exports = {
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:vue/essential"
    ],
    "parserOptions": {
        "ecmaVersion": 12,
        "sourceType": "module"
    },
    "plugins": [
        "vue"
    ],
    "rules": {
        "strict": "off",
        "no-console": "off",
        "no-unused-vars": "off",
        "no-undef": "off",
        "import/no-unresolved": "off"
    }
};
