/**
 * Registre canonique des 4 Rayons isolés de Rayons.net.
 * Chaque rayon dispose de son propre dossier autonome dans `src/modules/rayons/<slug>/`
 * afin qu'une évolution sur un rayon ne puisse jamais impacter un autre rayon.
 */
export type RayonSlug = "connect" | "immo" | "mode" | "saveurs";

export interface RayonModuleMeta {
  slug: RayonSlug;
  name: string;
  href: string;
  accentColor: string;
  modulePath: string;
}

export const RAYON_MODULES: Record<RayonSlug, RayonModuleMeta> = {
  connect: {
    slug: "connect",
    name: "Rayons Connect",
    href: "/rayon/connect",
    accentColor: "#00B5A5",
    modulePath: "src/modules/rayons/connect",
  },
  immo: {
    slug: "immo",
    name: "Rayons Immo",
    href: "/rayon/immo",
    accentColor: "#4C6EF5",
    modulePath: "src/modules/rayons/immo",
  },
  mode: {
    slug: "mode",
    name: "Rayons Mode",
    href: "/rayon/mode",
    accentColor: "#D4B08C",
    modulePath: "src/modules/rayons/mode",
  },
  saveurs: {
    slug: "saveurs",
    name: "Rayons Saveurs",
    href: "/rayon/saveurs",
    accentColor: "#FF6B35",
    modulePath: "src/modules/rayons/saveurs",
  },
};
