export function StructuredData() {
  const schemaGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://rayons.net/#organization",
        "name": "Rayons",
        "legalName": "Rayons RDC",
        "url": "https://rayons.net",
        "logo": {
          "@type": "ImageObject",
          "url": "https://rayons.net/icon-512.png",
          "width": 512,
          "height": 512,
          "caption": "Rayons.net Logo"
        },
        "image": "https://rayons.net/supermarket-hero.jpg",
        "description": "La marketplace unifiée de référence en République Démocratique du Congo : High-Tech & Connectivité, Immobilier & Hôtels, Mode & Créateurs, et Gastronomie avec paiement consigné sécurisé.",
        "telephone": "+243859180031",
        "email": "contact@rayons.net",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Boulevard du 30 Juin, Gombe",
          "addressLocality": "Kinshasa",
          "addressRegion": "Kinshasa",
          "addressCountry": "CD"
        },
        "contactPoint": [
          {
            "@type": "ContactPoint",
            "telephone": "+243859180031",
            "contactType": "customer service",
            "email": "contact@rayons.net",
            "areaServed": "CD",
            "availableLanguage": ["French", "English", "Lingala", "Swahili"],
            "hoursAvailable": "Mo-Su 08:00-21:00"
          }
        ],
        "sameAs": [
          "https://facebook.com/rayons.cd",
          "https://instagram.com/rayons_rdc"
        ]
      },
      {
        "@type": "WebSite",
        "@id": "https://rayons.net/#website",
        "url": "https://rayons.net",
        "name": "Rayons.net",
        "description": "Tout ce dont vous avez besoin, en un seul endroit en RDC.",
        "publisher": {
          "@id": "https://rayons.net/#organization"
        },
        "inLanguage": "fr-FR",
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": "https://rayons.net/?search={search_term_string}"
          },
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "OnlineStore",
        "@id": "https://rayons.net/#store",
        "name": "Rayons Marketplace",
        "url": "https://rayons.net",
        "parentOrganization": {
          "@id": "https://rayons.net/#organization"
        },
        "description": "Place de marché en ligne proposant produits électroniques, biens immobiliers, mode et gastronomie en RDC.",
        "currenciesAccepted": "USD, CDF",
        "paymentAccepted": "Mobile Money, M-Pesa, Airtel Money, Orange Money, Carte Bancaire, Paiement Consigné",
        "priceRange": "$$",
        "hasOfferCatalog": {
          "@id": "https://rayons.net/#catalog"
        }
      },
      {
        "@type": "OfferCatalog",
        "@id": "https://rayons.net/#catalog",
        "name": "Rayons de la Marketplace",
        "itemListElement": [
          {
            "@type": "OfferCatalog",
            "name": "Rayons Connect",
            "url": "https://rayons.net/rayon/connect",
            "description": "Starlink, smartphones, audio haut de gamme, domotique et équipements connectés certifiés."
          },
          {
            "@type": "OfferCatalog",
            "name": "Rayons Immo",
            "url": "https://rayons.net/rayon/immo",
            "description": "Villas, appartements, bureaux et hôtels avec baux et cautions sécurisées."
          },
          {
            "@type": "OfferCatalog",
            "name": "Rayons Mode",
            "url": "https://rayons.net/rayon/mode",
            "description": "Prêt-à-porter, créateurs congolais, accessoires et maroquinerie de prestige."
          },
          {
            "@type": "OfferCatalog",
            "name": "Rayons Saveurs",
            "url": "https://rayons.net/rayon/saveurs",
            "description": "Gastronomie, traiteurs, caves et produits d'exception livrés dans votre ville."
          }
        ]
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaGraph) }}
    />
  );
}
