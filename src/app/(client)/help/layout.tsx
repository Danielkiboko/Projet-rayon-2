import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Centre d'Aide & Questions Fréquentes (FAQ)",
  description:
    "Comment commander sur Rayons.net, payer à la livraison (M-Pesa, Airtel Money, Orange Money, espèces), réserver un hôtel ou devenir fournisseur vérifié.",
  alternates: { canonical: `${SITE_URL}/help` },
  openGraph: {
    title: "Centre d'Aide & FAQ | Rayons.net",
    description: "Toutes les réponses sur les commandes, livraisons Kinshasa, garanties et abonnements fournisseurs.",
    url: `${SITE_URL}/help`,
    siteName: "Rayons.net",
    images: [{ url: "/supermarket-hero.jpg", width: 1200, height: 630, alt: "Aide Rayons.net" }],
  },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Comment payer ma commande sur Rayons.net en RDC ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Vous pouvez régler en toute sécurité à la livraison en espèces (USD ou Francs Congolais) ou par Mobile Money (M-Pesa Vodacom, Airtel Money, Orange Money, Afrimoney) après vérification de votre colis.",
      },
    },
    {
      "@type": "Question",
      name: "Comment devenir fournisseur sur Rayons.net ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Inscrivez votre boutique sur https://rayons.net/supplier/register et profitez de 15 jours d'essai gratuit pour publier vos produits dans Connect, Immo, Mode ou Saveurs.",
      },
    },
    {
      "@type": "Question",
      name: "Les produits et biens immobiliers sur Rayons.net sont-ils vérifiés ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui, chaque fournisseur et chaque annonce immobilière ou produit est modéré par l'équipe Rayons.net avant mise en ligne.",
      },
    },
  ],
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      {children}
    </>
  );
}
