import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Rayons Mode — Prêt-à-Porter, Luxe & Accessoires | Rayons.net",
  description:
    "Découvrez les collections mode, chaussures, maroquinerie et accessoires de boutiques vérifiées avec livraison rapide.",
  alternates: { canonical: `${SITE_URL}/rayon/mode` },
  openGraph: {
    title: "Rayons Mode — Tendances & Luxe | Rayons.net",
    description:
      "Prêt-à-porter haut de gamme, chaussures et accessoires livrés chez vous avec paiement à la livraison.",
    url: `${SITE_URL}/rayon/mode`,
    siteName: "Rayons.net",
    type: "website",
    images: [{ url: "/supermarket-hero.jpg", width: 1200, height: 630, alt: "Rayons Mode" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rayons Mode — Prêt-à-Porter & Luxe en RDC",
    description: "Collections mode, chaussures et accessoires de boutiques vérifiées sur Rayons.net.",
    images: ["/supermarket-hero.jpg"],
  },
};

export default function ModeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
