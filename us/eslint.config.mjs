import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // This project's data-fetching pattern is a plain fetch-on-mount:
      // `useCallback` a `load()` keyed on stable props, call it from a
      // `useEffect`, and set state with the result (see VisitadosTab,
      // PendientesTab). That's exactly what this rule flags, but the
      // callback identity is stable (no infinite loop) and there's no
      // data-fetching library in this project to route through instead.
      // Every future module page will use the same idiom, so this is a
      // project-wide decision, not a per-file suppression.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
