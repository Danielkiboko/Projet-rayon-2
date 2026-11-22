import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Rayons Immo — Villas, Appartements & Hôtels Certifiés en RDC | Rayons.net",
  description:
    "Louez ou achetez des villas, appartements modernes, bureaux et réservez des hôtels de standing vérifiés à Kinshasa et en RDC.",
  alternates: { canonical: `${SITE_URL}/rayon/immo` },
  openGraph: {
    title: "Rayons Immo — Immobilier & Hôtellerie Premium | Rayons.net",
    description:
      "Villas, appartements, terrains et hôtels certifiés avec visite directe et contrat sécurisé sur Rayons.net.",
    url: `${SITE_URL}/rayon/immo`,
    siteName: "Rayons.net",
    type: "website",
  },
};

export default function ImmoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
