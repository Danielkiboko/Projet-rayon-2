import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // ── Frontières strictes entre compartiments (Anti-fuites & Respect d'Autorité) ──
  {
    files: ["src/app/(client)/**/*.{ts,tsx}", "src/modules/client/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/admin/*", "@/modules/supplier/*", "@/modules/partner/*", "@/modules/driver/*", "@/server/*"],
              message: "Violation de compartiment : l'espace Client ne peut importer que domain/, lib/, context/, modules/client/, modules/shared/ ou modules/tickets/.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/(supplier)/**/*.{ts,tsx}", "src/modules/supplier/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/admin/*", "@/modules/client/*", "@/modules/partner/*", "@/modules/driver/*", "@/server/*"],
              message: "Violation de compartiment : l'espace Fournisseur ne peut pas importer depuis Admin, Client, Partenaire, Livreur ou Server.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/(partner)/**/*.{ts,tsx}", "src/modules/partner/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/admin/*", "@/modules/supplier/*", "@/modules/client/*", "@/modules/driver/*", "@/server/*"],
              message: "Violation de compartiment : l'espace Partenaire est isolé (sans rayon) et ne peut importer que modules/shared/ ou domain/.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/(driver)/**/*.{ts,tsx}", "src/modules/driver/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/admin/*", "@/modules/supplier/*", "@/modules/client/*", "@/modules/partner/*", "@/server/*"],
              message: "Violation de compartiment : l'espace Livreur ne peut pas importer depuis Admin, Fournisseur, Client, Partenaire ou Server.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/(admin)/**/*.{ts,tsx}", "src/modules/admin/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/supplier/*", "@/modules/client/*", "@/server/*"],
              message: "Violation de compartiment : l'interface Admin doit utiliser modules/admin/, modules/shared/ ou modules/tickets/ (pas les composants internes Fournisseur/Client).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "livreur_app/**",
    "rayons_app/**",
    "scratch/**",
    "report/**",
    "*.js",
  ]),
]);

export default eslintConfig;
