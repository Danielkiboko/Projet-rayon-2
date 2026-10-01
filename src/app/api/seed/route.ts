import { NextResponse } from 'next/server';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── Security ────────────────────────────────────────────────────────────────
// Cet endpoint est réservé au Super Admin et ne doit JAMAIS être appelé
// publiquement. Il est protégé par le même CRON_SECRET que les jobs cron.
// Usage : curl -H "x-cron-secret: <votre_secret>" https://.../api/seed
const CRON_SECRET = process.env.CRON_SECRET;

const PRODUCTS = [
  // --- RAYONS CONNECT (Tech) ---
  {
    id: "connect-1",
    category: "connect",
    brand: "STARLINK",
    title: { fr: "Kit Starlink Standard V4 (Motorisé)", en: "Starlink Standard V4 Kit (Motorized)" },
    description: { 
      fr: "Connexion internet haut débit par satellite jusqu'à 250 Mbps. Ce kit de dernière génération inclut l'antenne motorisée pour un alignement optimal, le routeur Wi-Fi 6, et tous les câbles nécessaires. Idéal pour les entreprises, les zones rurales ou comme connexion de secours.", 
      en: "High-speed satellite internet connection up to 250 Mbps. This latest generation kit includes the motorized antenna for optimal alignment, Wi-Fi 6 router, and all necessary cables. Ideal for businesses, rural areas, or as a backup connection." 
    },
    price: 581.67,
    tag: { fr: "TOP VENTE B2B", en: "B2B BESTSELLER" },
    image: "https://images.unsplash.com/photo-1620288627228-569d67568571?auto=format&fit=crop&q=80&w=800&h=600",
    features: [
      { fr: "Jusqu'à 250 Mbps de débit descendant", en: "Up to 250 Mbps download speed" },
      { fr: "Routeur Wi-Fi 6 inclus", en: "Wi-Fi 6 router included" },
      { fr: "Antenne motorisée auto-orientable", en: "Self-orienting motorized antenna" },
      { fr: "Résistance aux intempéries (IP54)", en: "Weather resistance (IP54)" }
    ],
    bulkPricing: [
      { qty: "1-4", price: 581.67 },
      { qty: "5-19", price: 550.00 },
      { qty: "20+", price: 520.00 }
    ]
  },
  {
    id: "connect-2",
    category: "connect",
    brand: "STARLINK",
    title: { fr: "Kit Starlink Mini Nomade (Ultra-Compact)", en: "Starlink Mini Nomad Kit (Ultra-Compact)" },
    description: { 
      fr: "Antenne de poche tout-en-un avec routeur Wi-Fi intégré. Conçue pour la mobilité extrême, cette antenne se glisse dans un sac à dos et peut être alimentée par une batterie externe USB-C. Parfaite pour les voyageurs, les équipes de terrain et les explorateurs.", 
      en: "All-in-one pocket antenna with built-in Wi-Fi router. Designed for extreme mobility, this antenna fits in a backpack and can be powered by a USB-C power bank. Perfect for travelers, field teams, and explorers." 
    },
    price: 491.67,
    tag: { fr: "NOUVEAUTÉ NOMADE", en: "NEW NOMAD" },
    image: "https://images.unsplash.com/photo-1541882194602-0e9273c52e46?auto=format&fit=crop&q=80&w=800&h=600",
    features: [
      { fr: "Format ultra-compact", en: "Ultra-compact format" },
      { fr: "Routeur Wi-Fi intégré", en: "Built-in Wi-Fi router" },
      { fr: "Alimentation USB-C possible", en: "USB-C power compatible" },
      { fr: "Faible consommation d'énergie", en: "Low power consumption" }
    ],
    bulkPricing: [
      { qty: "1-9", price: 491.67 },
      { qty: "10+", price: 460.00 }
    ]
  },
  {
    id: "connect-3",
    category: "connect",
    brand: "MIKROTIK",
    title: { fr: "Routeur MikroTik RB5009UG+S+IN (Pro)", en: "MikroTik RB5009UG+S+IN Router (Pro)" },
    description: { 
      fr: "Routeur Gigabit lourd pour gestion multi-WAN (Starlink + Fibre). La solution ultime pour les entreprises exigeantes. Offre une puissance de traitement exceptionnelle avec 9 ports Gigabit, un port SFP+ 10G et un port USB 3.0. Idéal pour le failover et l'agrégation de liens.", 
      en: "Heavy-duty Gigabit router for multi-WAN management (Starlink + Fiber). The ultimate solution for demanding businesses. Offers exceptional processing power with 9 Gigabit ports, a 10G SFP+ port, and a USB 3.0 port. Ideal for failover and link aggregation." 
    },
    price: 308.33,
    tag: { fr: "RECOMMANDÉ ENTREPRISE", en: "ENTERPRISE RECOMMENDED" },
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&q=80&w=800&h=600",
    features: [
      { fr: "Architecture ARM 64-bit Quad-Core", en: "64-bit Quad-Core ARM Architecture" },
      { fr: "7x Gigabit Ethernet, 1x 2.5G Ethernet", en: "7x Gigabit Ethernet, 1x 2.5G Ethernet" },
      { fr: "1x SFP+ 10G", en: "1x SFP+ 10G" },
      { fr: "Boîtier métallique robuste (rackable)", en: "Robust metal casing (rack-mountable)" }
    ],
    bulkPricing: [
      { qty: "1-4", price: 308.33 },
      { qty: "5-10", price: 295.00 },
      { qty: "11+", price: 275.00 }
    ]
  },
  // --- RAYONS IMMO (Real Estate) ---
  {
    id: "immo-1",
    category: "immo",
    brand: "IMMOBILIER PREMIUM",
    typeTransaction: "Vente",
    title: { fr: "Villa Moderne avec Piscine", en: "Modern Villa with Pool" },
    description: {
      fr: "Magnifique villa de 4 chambres située dans le quartier prisé de Gombe. Finitions luxueuses, grande piscine, et jardin paysager. Idéal pour une famille ou un investissement locatif.",
      en: "Magnificent 4-bedroom villa located in the sought-after Gombe district. Luxurious finishes, large pool, and landscaped garden. Ideal for a family or rental investment."
    },
    location: "Quartier Gombe, Kinshasa",
    price: 450000,
    tag: { fr: "COUP DE COEUR", en: "FAVORITE" },
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=600&h=400",
    features: [
      { fr: "Surface de 350 m²", en: "350 sqm area" },
      { fr: "4 Chambres, 3 Salles de bain", en: "4 Bedrooms, 3 Bathrooms" },
      { fr: "Piscine privée", en: "Private pool" },
      { fr: "Sécurité 24/7", en: "24/7 Security" }
    ],
    immoDetails: {
      area: 350,
      beds: 4,
      baths: 3
    }
  },
  {
    id: "immo-2",
    category: "immo",
    brand: "IMMOBILIER PREMIUM",
    typeTransaction: "Location",
    title: { fr: "Appartement Haut Standing vue Fleuve", en: "High-end Apartment River View" },
    description: {
      fr: "Superbe appartement de 2 chambres avec une vue imprenable sur le fleuve Congo. Sécurisé, équipé et meublé avec goût.",
      en: "Superb 2-bedroom apartment with a breathtaking view of the Congo River. Secured, equipped, and tastefully furnished."
    },
    location: "Macampagne, Kinshasa",
    price: 2500, // Monthly
    tag: { fr: "EXCLUSIVITÉ", en: "EXCLUSIVE" },
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=600&h=400",
    features: [
      { fr: "Surface de 120 m²", en: "120 sqm area" },
      { fr: "2 Chambres, 2 Salles de bain", en: "2 Bedrooms, 2 Bathrooms" },
      { fr: "Vue fleuve", en: "River view" },
      { fr: "Entièrement meublé", en: "Fully furnished" }
    ],
    immoDetails: {
      area: 120,
      beds: 2,
      baths: 2
    }
  },
  {
    id: "immo-3",
    category: "immo",
    brand: "IMMOBILIER COMMERCIAL",
    typeTransaction: "Vente",
    title: { fr: "Terrain Commercial", en: "Commercial Plot" },
    description: {
      fr: "Terrain idéalement situé sur le Boulevard du 30 Juin, parfait pour un projet de construction commerciale ou résidentielle.",
      en: "Plot ideally located on Boulevard du 30 Juin, perfect for a commercial or residential construction project."
    },
    location: "Boulevard du 30 Juin, Kinshasa",
    price: 1200000,
    tag: { fr: "OPPORTUNITÉ", en: "OPPORTUNITY" },
    image: "https://images.unsplash.com/photo-1531971589569-0d9370cbe1e5?auto=format&fit=crop&q=80&w=600&h=400",
    features: [
      { fr: "Surface de 1000 m²", en: "1000 sqm area" },
      { fr: "Emplacement central", en: "Central location" },
      { fr: "Accès facile", en: "Easy access" },
      { fr: "Zone commerciale", en: "Commercial zone" }
    ],
    immoDetails: {
      area: 1000,
      beds: 0,
      baths: 0
    }
  }
];

export async function GET(request: Request) {
  // ─── Vérification du secret ───────────────────────────────────────────────
  const secret = request.headers.get('x-cron-secret');
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json(
      { error: 'Accès refusé. Ce endpoint est réservé au Super Admin.' },
      { status: 401 }
    );
  }

  try {
    for (const product of PRODUCTS) {
      await setDoc(doc(db, "products", product.id), product);
    }
    return NextResponse.json({ message: "Seed successful!" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
