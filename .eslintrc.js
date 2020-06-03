module.exports = {
    "plugins": ["prettier"],
    "rules": {
        "prettier/prettier": "error"
    },
    "env": {
        "browser": true,
        "es6": true,
        "webextensions": true,
        "jquery": true
    },
    "extends": ["eslint:recommended", "plugin:prettier/recommended"],
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 11
    },
    "rules": {
    }
};
