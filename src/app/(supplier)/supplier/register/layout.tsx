import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Devenir Fournisseur — Ouvrez votre Boutique en Ligne (15 jours gratuits)",
  description:
    "Vendez en ligne à Kinshasa et en RDC sur Rayons.net : Tech, Immobilier & Hôtels, Mode ou Restaurants. 15 jours d'essai gratuit, livraisons gérées et messagerie multilingue FR/EN/中文.",
  alternates: { canonical: `${SITE_URL}/supplier/register` },
  openGraph: {
    title: "Ouvrez votre Boutique sur Rayons.net — 15 Jours Gratuits",
    description:
      "Digitalisez vos ventes en RDC : catalogue, commandes, livreurs et messagerie traduite automatiquement FR/EN/中文.",
    url: `${SITE_URL}/supplier/register`,
    siteName: "Rayons.net",
    images: [{ url: "/supermarket-hero.jpg", width: 1200, height: 630, alt: "Devenir Fournisseur Rayons.net" }],
  },
};

export default function SupplierRegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
