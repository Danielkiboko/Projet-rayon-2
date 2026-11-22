import type { Metadata } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Rayons Saveurs — Restaurants, Plats & Équipements Culinaires | Rayons.net",
  description:
    "Commandez des plats préparés par des chefs, traiteurs réputés et ustensiles de cuisine professionnels sur Rayons.net.",
  alternates: { canonical: `${SITE_URL}/rayon/saveurs` },
  openGraph: {
    title: "Rayons Saveurs — Gastronomie & Art Culinaire | Rayons.net",
    description:
      "Restaurants réputés, grillades, traiteurs et équipements culinaires livrés rapidement.",
    url: `${SITE_URL}/rayon/saveurs`,
    siteName: "Rayons.net",
    type: "website",
    images: [{ url: "/supermarket-hero.jpg", width: 1200, height: 630, alt: "Rayons Saveurs" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rayons Saveurs — Restaurants & Cuisine en RDC",
    description: "Plats préparés par des chefs et équipements culinaires livrés via Rayons.net.",
    images: ["/supermarket-hero.jpg"],
  },
};

export default function SaveursLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
