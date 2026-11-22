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
    images: [{ url: "/supermarket-hero.jpg", width: 1200, height: 630, alt: "Rayons Connect" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rayons Connect — Starlink & Tech en RDC",
    description: "Kits Starlink, routeurs Pro, smartphones et audio vérifiés sur Rayons.net.",
    images: ["/supermarket-hero.jpg"],
  },
};

export default function ConnectLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
