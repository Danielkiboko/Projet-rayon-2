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
    title: "Restaurants, Plats & Art Culinaire",
    tag: "Saveurs",
    add: "Commander",
    details: "Détails",
  },
  en: {
    home: "Home",
    connect: "Connect",
    immo: "Immo",
    mode: "Fashion",
    saveurs: "Flavors",
    login: "Login",
    title: "Restaurants, Gourmet & Kitchenware",
    tag: "Saveurs",
    add: "Order",
    details: "Details",
  }
};

const DUMMY_PRODUCTS = [
  {
    id: "dummy-saveurs-1",
    title: { fr: "Plateau Grillades Mixtes & Alloco", en: "Mixed Grilled Platter & Plantains" },
    description: { fr: "Brochettes de bœuf mariné, travers de porc et bananes plantains croustillantes. Préparé à la commande.", en: "Marinated beef skewers, ribs and crispy plantains. Freshly grilled." },
    price: 24.50,
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800",
    brand: "Le Grill Urbain",
    tag: { fr: "Restaurant", en: "Restaurant" }
  },
  {
    id: "dummy-saveurs-2",
    title: { fr: "Batterie de Casseroles Inox 8 Pièces", en: "8-Piece Stainless Steel Cookware Set" },
    description: { fr: "Acier inoxydable 18/10 haute durabilité, compatible tous feux dont induction.", en: "Premium 18/10 stainless steel, compatible with all stovetops including induction." },
    price: 145.00,
    image: "https://images.unsplash.com/photo-1584990347449-3998f4bb7d81?auto=format&fit=crop&q=80&w=800",
    brand: "ChefPro Deluxe",
    tag: { fr: "Ustensiles", en: "Cookware" }
  },
  {
    id: "dummy-saveurs-3",
    title: { fr: "Poulet Braisé aux Épices Douces & Riz", en: "Spiced Braised Chicken & Jasmine Rice" },
    description: { fr: "Recette traditionnelle braisée au feu de bois avec sauces au choix.", en: "Wood-fired braised chicken served with fragrant jasmine rice and house sauces." },
    price: 18.00,
    image: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&q=80&w=800",
    brand: "Chez Mama Saveurs",
    tag: { fr: "Restaurant", en: "Restaurant" }
  },
  {
    id: "dummy-saveurs-4",
    title: { fr: "Robot Culinaire Multifonction 1200W", en: "1200W Multifunction Food Processor" },
    description: { fr: "Hachoir, pétrin, mixeur et blender intégrés avec bol grande capacité de 3.5L.", en: "Integrated chopper, kneader, blender and mixer with large 3.5L bowl." },
    price: 189.90,
    image: "https://images.unsplash.com/photo-1589733955941-5eeaf752f6dd?auto=format&fit=crop&q=80&w=800",
    brand: "MasterChef Tech",
    tag: { fr: "Ustensiles", en: "Cookware" }
  },
  {
    id: "dummy-saveurs-5",
    title: { fr: "Set de 5 Couteaux Japonais Damas", en: "5-Piece Japanese Damascus Knife Set" },
    description: { fr: "Lames d'une précision chirurgicale avec manche ergonomique en bois noble.", en: "Surgical precision Damascus steel blades with ergonomic rosewood handles." },
    price: 95.00,
    image: "https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&q=80&w=800",
    brand: "Katanox Kitchen",
    tag: { fr: "Ustensiles", en: "Cookware" }
  },
  {
    id: "dummy-saveurs-6",
    title: { fr: "Menu Burger Black Angus & Frites Maison", en: "Black Angus Burger Meal & Hand-Cut Fries" },
    description: { fr: "Steak haché Black Angus 180g, cheddar affiné, oignons caramélisés et frites dorées.", en: "180g Black Angus beef patty, aged cheddar, caramelized onions and hand-cut fries." },
    price: 16.50,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800",
    brand: "Bistrot Rayons",
    tag: { fr: "Restaurant", en: "Restaurant" }
  }
];

export default function RayonSaveursPage() {
  return (
    <StoreTemplate
      category="saveurs"
      heroImage="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=2000"
      dummyProducts={DUMMY_PRODUCTS}
      dict={DICT}
    />
  );
}
