"use client";

import { StoreTemplate } from "@/modules/client/components/rayon/StoreTemplate";

const DICT = {
  fr: {
    home: "Accueil",
    connect: "Connect",
    immo: "Immo",
    mode: "Mode",
    saveurs: "Saveurs",
    login: "Se connecter",
    title: "La Nouvelle Collection",
    subtitle: "Découvrez notre sélection de vêtements, chaussures et accessoires tendance.",
    add: "Ajouter au panier",
    details: "Détails",
  },
  en: {
    home: "Home",
    connect: "Connect",
    immo: "Immo",
    mode: "Fashion",
    saveurs: "Flavors",
    login: "Login",
    title: "New Collection",
    subtitle: "Discover our selection of trendy clothes, shoes and accessories.",
    add: "Add to cart",
    details: "Details",
  }
};

const DUMMY_PRODUCTS = [
  {
    id: "dummy-mode-1",
    title: { fr: "Veste en Cuir Biker", en: "Biker Leather Jacket" },
    description: { fr: "Veste en cuir véritable avec détails zippés. Parfaite pour un look rock et urbain.", en: "Genuine leather jacket with zip details. Perfect for a rock and urban look." },
    price: 129.99,
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=800",
    brand: "Urban Style",
    tag: { fr: "Nouveau", en: "New" }
  },
  {
    id: "dummy-mode-2",
    title: { fr: "Robe d'Été Fleurie", en: "Floral Summer Dress" },
    description: { fr: "Robe légère et fluide avec imprimé floral. Idéale pour les journées ensoleillées.", en: "Light and flowing dress with floral print. Ideal for sunny days." },
    price: 45.00,
    image: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&q=80&w=800",
    brand: "Chic Bohème",
    tag: { fr: "Tendance", en: "Trendy" }
  },
  {
    id: "dummy-mode-3",
    title: { fr: "Sneakers Classiques", en: "Classic Sneakers" },
    description: { fr: "Baskets blanches indémodables, confortables pour tous les jours.", en: "Timeless white sneakers, comfortable for everyday wear." },
    price: 89.90,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=800",
    brand: "RunFoot",
    tag: { fr: "Basique", en: "Basic" }
  },
  {
    id: "dummy-mode-4",
    title: { fr: "Chemise en Lin", en: "Linen Shirt" },
    description: { fr: "Chemise légère 100% lin, coupe ajustée, couleur beige naturel.", en: "Lightweight 100% linen shirt, slim fit, natural beige color." },
    price: 55.00,
    image: "https://images.unsplash.com/photo-1596755094514-f87e32f85e2c?auto=format&fit=crop&q=80&w=800",
    brand: "Elegance",
    tag: { fr: "Premium", en: "Premium" }
  },
  {
    id: "dummy-mode-5",
    title: { fr: "Jeans Denim Brut", en: "Raw Denim Jeans" },
    description: { fr: "Jeans coupe droite en toile denim épaisse. Résistant et stylé.", en: "Straight-cut jeans in thick denim canvas. Durable and stylish." },
    price: 69.99,
    image: "https://images.unsplash.com/photo-1542272604-780c8d52a5ce?auto=format&fit=crop&q=80&w=800",
    brand: "Denim Co.",
    tag: { fr: "Populaire", en: "Popular" }
  },
  {
    id: "dummy-mode-6",
    title: { fr: "Sac à Main Élégant", en: "Elegant Handbag" },
    description: { fr: "Sac à main en simili cuir avec finitions dorées. Spacieux et pratique.", en: "Faux leather handbag with gold finishes. Spacious and practical." },
    price: 79.50,
    image: "https://images.unsplash.com/photo-1584916201218-f4242ceb4809?auto=format&fit=crop&q=80&w=800",
    brand: "LuxeAccess",
    tag: { fr: "Accessoire", en: "Accessory" }
  },
  {
    id: "dummy-mode-7",
    title: { fr: "T-Shirt Oversize", en: "Oversized T-Shirt" },
    description: { fr: "T-shirt en coton bio coupe oversize. Impression minimaliste.", en: "Organic cotton t-shirt, oversized fit. Minimalist print." },
    price: 25.00,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800",
    brand: "StreetWear",
    tag: { fr: "Essentiel", en: "Essential" }
  },
  {
    id: "dummy-mode-8",
    title: { fr: "Montre Minimaliste", en: "Minimalist Watch" },
    description: { fr: "Montre bracelet en maille milanaise noire, cadran épuré.", en: "Watch with black Milanese mesh strap, sleek dial." },
    price: 110.00,
    image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&q=80&w=800",
    brand: "TimePiece",
    tag: { fr: "Élégant", en: "Elegant" }
  },
  {
    id: "dummy-mode-9",
    title: { fr: "Manteau d'Hiver", en: "Winter Coat" },
    description: { fr: "Manteau long en laine mélangée. Parfait pour affronter le froid avec style.", en: "Long wool-blend coat. Perfect to face the cold in style." },
    price: 189.00,
    image: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&q=80&w=800",
    brand: "Nordic Wear",
    tag: { fr: "Hiver", en: "Winter" }
  },
  {
    id: "dummy-mode-10",
    title: { fr: "Lunettes de Soleil Vintage", en: "Vintage Sunglasses" },
    description: { fr: "Lunettes de soleil polarisées style rétro avec monture écaille de tortue.", en: "Retro style polarized sunglasses with tortoiseshell frame." },
    price: 49.90,
    image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=800",
    brand: "SunVision",
    tag: { fr: "Vintage", en: "Vintage" }
  }
];

export default function ModePage() {
  return (
    <StoreTemplate 
      category="mode"
      heroImage="https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&q=80&w=2000"
      dummyProducts={DUMMY_PRODUCTS}
      dict={DICT}
    />
  );
}
