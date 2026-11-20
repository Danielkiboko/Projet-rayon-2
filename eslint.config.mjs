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
              message: "Violation de compartiment : l'espace Client ne peut importer que domain/, lib/, context/, modules/client/, modules/rayons/, modules/shared/ ou modules/tickets/.",
            },
          ],
        },
      ],
    },
  },
  // ── Isolation stricte entre les 4 Rayons (Connect / Immo / Mode / Saveurs) ──
  {
    files: ["src/modules/rayons/connect/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/rayons/immo/*", "@/modules/rayons/mode/*", "@/modules/rayons/saveurs/*", "@/modules/admin/*", "@/modules/supplier/*", "@/modules/partner/*", "@/modules/driver/*", "@/server/*"],
              message: "Violation d'isolation Rayon : Connect ne peut pas importer un autre rayon ou un module interne.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/rayons/immo/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/rayons/connect/*", "@/modules/rayons/mode/*", "@/modules/rayons/saveurs/*", "@/modules/admin/*", "@/modules/supplier/*", "@/modules/partner/*", "@/modules/driver/*", "@/server/*"],
              message: "Violation d'isolation Rayon : Immo ne peut pas importer un autre rayon ou un module interne.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/rayons/mode/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/rayons/connect/*", "@/modules/rayons/immo/*", "@/modules/rayons/saveurs/*", "@/modules/admin/*", "@/modules/supplier/*", "@/modules/partner/*", "@/modules/driver/*", "@/server/*"],
              message: "Violation d'isolation Rayon : Mode ne peut pas importer un autre rayon ou un module interne.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/rayons/saveurs/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/rayons/connect/*", "@/modules/rayons/immo/*", "@/modules/rayons/mode/*", "@/modules/admin/*", "@/modules/supplier/*", "@/modules/partner/*", "@/modules/driver/*", "@/server/*"],
              message: "Violation d'isolation Rayon : Saveurs ne peut pas importer un autre rayon ou un module interne.",
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
              group: ["@/modules/admin/*", "@/modules/supplier/*", "@/modules/client/*", "@/modules/rayons/*", "@/modules/driver/*", "@/server/*"],
              message: "Violation de compartiment : l'espace Partenaire est isolé (sans rayon) et ne peut importer que modules/partner/, modules/shared/ ou domain/.",
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
              group: ["@/modules/admin/*", "@/modules/supplier/*", "@/modules/client/*", "@/modules/rayons/*", "@/modules/partner/*", "@/server/*"],
              message: "Violation de compartiment : l'espace Livreur ne peut pas importer depuis Admin, Fournisseur, Client, Rayons, Partenaire ou Server.",
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
              group: ["@/modules/supplier/*", "@/modules/client/*", "@/modules/partner/*", "@/modules/driver/*", "@/server/*"],
              message: "Violation de compartiment : l'interface Admin doit utiliser modules/admin/, modules/shared/ ou modules/tickets/ (pas les composants internes Fournisseur/Client/Partenaire/Livreur).",
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
