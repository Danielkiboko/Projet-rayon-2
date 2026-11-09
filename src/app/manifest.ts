import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rayons.net — Marketplace Officielle RDC",
    short_name: "Rayons",
    description:
      "Achetez en toute confiance : Tech, Mode, Gastronomie & Immobilier livrés et garantis avec séquestre sécurisé.",
    start_url: "/",
    display: "standalone",
    background_color: "#0F1D27",
    theme_color: "#0F1D27",
    icons: [
      {
        src: "/icon.png?v=3",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png?v=3",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.png?v=3",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
