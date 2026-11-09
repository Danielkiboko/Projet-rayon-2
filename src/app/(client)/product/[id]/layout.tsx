import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const docSnap = await adminDb.collection("products").doc(id).get();
    if (docSnap.exists) {
      const data = docSnap.data() || {};
      const title =
        typeof data.title === "object" && data.title !== null
          ? data.title.fr || data.title.en || "Produit Rayons.net"
          : data.title || data.name || "Produit Rayons.net";

      const description =
        typeof data.description === "object" && data.description !== null
          ? data.description.fr || data.description.en || "Commandez en toute sécurité sur Rayons.net"
          : data.description || "Commandez en toute sécurité sur Rayons.net avec garantie séquestre.";

      const priceLabel = data.price ? ` — $${Number(data.price).toFixed(2)}` : "";
      const ogImageUrl = `/api/og/product/${encodeURIComponent(id)}`;

      return {
        title: `${title}${priceLabel} | Rayons.net`,
        description: String(description).slice(0, 180),
        openGraph: {
          title: `${title}${priceLabel} | Rayons.net`,
          description: String(description).slice(0, 180),
          type: "website",
          images: [
            {
              url: ogImageUrl,
              width: 800,
              height: 800,
              alt: String(title),
            },
          ],
        },
        twitter: {
          card: "summary_large_image",
          title: `${title}${priceLabel} | Rayons.net`,
          description: String(description).slice(0, 180),
          images: [ogImageUrl],
        },
      };
    }
  } catch (err) {
    console.warn("Erreur generateMetadata product:", err);
  }

  return {
    title: "Détails du produit | Rayons.net",
    description: "Achetez en toute confiance sur Rayons.net — Livré & garanti chez vous.",
  };
}

export default function ProductDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

