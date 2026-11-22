import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Rayons Connect — Starlink, Smartphones & Tech en RDC | Rayons.net",
  description:
    "Kits Starlink, routeurs Pro, smartphones, audio et équipements connectés vérifiés en RDC avec paiement sécurisé à la livraison.",
  alternates: { canonical: `${SITE_URL}/rayon/connect` },
  openGraph: {
    title: "Rayons Connect — Innovation & Tech | Rayons.net",
    description:
      "Starlink, smartphones, audio haut de gamme et équipements connectés livrés et garantis sur Rayons.net.",
    url: `${SITE_URL}/rayon/connect`,
    siteName: "Rayons.net",
    type: "website",
  },
};

export default function ConnectLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
