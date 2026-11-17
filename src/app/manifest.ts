import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rayons.net — Marketplace Officielle RDC",
    short_name: "Rayons.net",
    description:
      "Marketplace unifiée en RDC : Connect, Immobilier & Hôtels, Mode et Saveurs. Commandes et notifications en temps réel.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0F1D27",
    theme_color: "#0F1D27",
    icons: [
      {
        src: "/icon.png?v=4",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png?v=4",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
