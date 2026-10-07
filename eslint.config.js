import eslint from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";

export default [
  {
    ignores: ["coverage/**", "dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "no-constant-condition": "error",
      "no-continue": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "BreakStatement",
          message: "Do not use break statements.",
        },
        {
          selector: "WhileStatement[test.value=true]",
          message: "Do not use while (true).",
        },
        {
          selector:
            "FunctionDeclaration[returnType.typeAnnotation.type='TSVoidKeyword'] ReturnStatement[argument]",
          message: "Do not return early from void functions.",
        },
      ],
    },
  },
];
