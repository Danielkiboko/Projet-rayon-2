import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Contact & Service Client Kinshasa",
  description:
    "Contactez l'équipe Rayons.net à Kinshasa (Gombe) par téléphone, WhatsApp ou email pour toute question commande, immobilier ou partenariat fournisseur.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: "Contact & Service Client | Rayons.net",
    description: "Assistance 7j/7 pour acheteurs, fournisseurs et partenaires Rayons.net en RDC.",
    url: `${SITE_URL}/contact`,
    siteName: "Rayons.net",
    images: [{ url: "/supermarket-hero.jpg", width: 1200, height: 630, alt: "Contact Rayons.net" }],
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
