import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Regras de Borda para compatibilidade com Cloudflare Workers
  {
    files: ["app/**", "components/**", "lib/**", "hooks/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "fs", message: "Módulo nativo 'fs' é proibido no Cloudflare Workers runtime." },
            { name: "fs/promises", message: "Módulo nativo 'fs/promises' é proibido no Cloudflare Workers runtime." },
            { name: "child_process", message: "Módulo nativo 'child_process' é proibido no Cloudflare Workers runtime." },
            { name: "net", message: "Módulo nativo 'net' é proibido no Cloudflare Workers runtime." },
            { name: "tls", message: "Módulo nativo 'tls' é proibido no Cloudflare Workers runtime." },
            { name: "cluster", message: "Módulo nativo 'cluster' é proibido no Cloudflare Workers runtime." },
            { name: "dgram", message: "Módulo nativo 'dgram' é proibido no Cloudflare Workers runtime." },
            { name: "dns", message: "Módulo nativo 'dns' é proibido no Cloudflare Workers runtime." },
          ],
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores
  globalIgnores([
    ".next/**",
    ".open-next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    "__tests__/**",
  ]),
]);

export default eslintConfig;
