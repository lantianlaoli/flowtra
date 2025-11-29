import next from "eslint-config-next";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "pnpm-lock.yaml",
      "tsconfig.tsbuildinfo",
    ],
  },
  ...next,
  {
    rules: {
      // React 19 enables new experimental lint rules that are too strict for our existing UI patterns.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
    },
  },
];

export default config;
