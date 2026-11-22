import type { Metadata } from "next";
import { adminDb, initFirebaseAdmin } from "@/lib/firebase-admin";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/$/, "");

async function loadProductSeoData(id: string) {
  try {
    await initFirebaseAdmin();
    const docSnap = await adminDb.collection("products").doc(id).get();
    if (!docSnap.exists) return null;
    return docSnap.data() || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await loadProductSeoData(id);

  if (data) {
    const title =
      typeof data.title === "object" && data.title !== null
        ? data.title.fr || data.title.en || data.title.zh || "Produit Rayons.net"
        : data.title || data.name || "Produit Rayons.net";

    const description =
      typeof data.description === "object" && data.description !== null
        ? data.description.fr || data.description.en || data.description.zh || "Commandez en toute sécurité sur Rayons.net"
        : data.description || "Commandez en toute sécurité sur Rayons.net avec paiement à la livraison.";

    const priceLabel = data.price ? ` — $${Number(data.price).toFixed(2)}` : "";
    const ogImageUrl = `${SITE_URL}/api/og/product/${encodeURIComponent(id)}`;
    const pageUrl = `${SITE_URL}/product/${encodeURIComponent(id)}`;

    return {
      title: `${title}${priceLabel}`,
      description: String(description).slice(0, 180),
      alternates: {
        canonical: pageUrl,
      },
      openGraph: {
        title: `${title}${priceLabel} | Rayons.net`,
        description: String(description).slice(0, 180),
        type: "website",
        url: pageUrl,
        siteName: "Rayons.net",
        locale: "fr_FR",
        alternateLocale: ["en_US", "zh_CN"],
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

  return {
    title: "Détails du produit",
    description: "Achetez en toute confiance sur Rayons.net — Livré & garanti chez vous.",
  };
}

export default async function ProductDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadProductSeoData(id);

  let jsonLd: Record<string, any> | null = null;
  if (data) {
    const title =
      typeof data.title === "object" && data.title !== null
        ? data.title.fr || data.title.en || "Produit Rayons.net"
        : data.title || data.name || "Produit Rayons.net";

    const description =
      typeof data.description === "object" && data.description !== null
        ? data.description.fr || data.description.en || ""
        : data.description || "";

    const rawCategory = String(data.category || data.rayon || "connect").toLowerCase();
    const rayonSlug = ["connect", "immo", "mode", "saveurs"].includes(rawCategory) ? rawCategory : "connect";
    const rayonNameMap: Record<string, string> = {
      connect: "Rayons Connect",
      immo: "Rayons Immo",
      mode: "Rayons Mode",
      saveurs: "Rayons Saveurs",
    };

    const pageUrl = `${SITE_URL}/product/${encodeURIComponent(id)}`;
    const ogImageUrl = `${SITE_URL}/api/og/product/${encodeURIComponent(id)}`;
    const stockNum = data.stock !== undefined ? Number(data.stock) : 1;
    const inStock = isNaN(stockNum) ? true : stockNum > 0;

    const productSchema: Record<string, any> = {
      "@type": "Product",
      "@id": `${pageUrl}#product`,
      name: String(title),
      description: String(description).slice(0, 320),
      image: [ogImageUrl],
      sku: id,
      url: pageUrl,
      brand: {
        "@type": "Brand",
        name: String(data.brand || data.supplierName || "Rayons.net"),
      },
      offers: {
        "@type": "Offer",
        url: pageUrl,
        priceCurrency: "USD",
        price: Number(data.price || 0).toFixed(2),
        availability: inStock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: {
          "@type": "Organization",
          name: String(data.supplierName || "Rayons.net"),
        },
      },
    };

    if (Number(data.reviewCount) > 0 && Number(data.rating) > 0) {
      productSchema.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: Number(data.rating).toFixed(1),
        reviewCount: Number(data.reviewCount),
      };
    }

    const breadcrumbSchema = {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: rayonNameMap[rayonSlug],
          item: `${SITE_URL}/rayon/${rayonSlug}`,
        },
        { "@type": "ListItem", position: 3, name: String(title), item: pageUrl },
      ],
    };

    jsonLd = {
      "@context": "https://schema.org",
      "@graph": [productSchema, breadcrumbSchema],
    };
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
