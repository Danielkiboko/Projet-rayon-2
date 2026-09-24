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
    title: "Équipements Technologiques",
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
    title: "Technological Equipment",
    add: "Add to cart",
    details: "Details",
  }
};

const DUMMY_PRODUCTS = [
  {
    id: "dummy-connect-1",
    title: { fr: "Starlink Kit Standard", en: "Starlink Standard Kit" },
    description: { fr: "Internet haut débit à faible latence partout dans le monde.", en: "High-speed, low-latency broadband internet across the globe." },
    price: 499.00,
    image: "https://images.unsplash.com/photo-1623821035216-9538dc903fb5?auto=format&fit=crop&q=80&w=800",
    brand: "SpaceX",
    tag: { fr: "Populaire", en: "Popular" }
  },
  {
    id: "dummy-connect-2",
    title: { fr: "Routeur Pro Wi-Fi 6", en: "Pro Wi-Fi 6 Router" },
    description: { fr: "Connectivité ultra-rapide pour toute la maison.", en: "Ultra-fast connectivity for the whole house." },
    price: 199.99,
    image: "https://images.unsplash.com/photo-1544228833-289b4e135f60?auto=format&fit=crop&q=80&w=800",
    brand: "NetTech",
    tag: { fr: "Nouveau", en: "New" }
  },
  {
    id: "dummy-connect-3",
    title: { fr: "Caméra de Sécurité 4K", en: "4K Security Camera" },
    description: { fr: "Surveillance intelligente avec vision nocturne avancée.", en: "Smart surveillance with advanced night vision." },
    price: 129.50,
    image: "https://images.unsplash.com/photo-1557825835-b4597f7663db?auto=format&fit=crop&q=80&w=800",
    brand: "SecureVision",
    tag: { fr: "Essentiel", en: "Essential" }
  },
  {
    id: "dummy-connect-4",
    title: { fr: "Onduleur UPS 1500VA", en: "UPS 1500VA" },
    description: { fr: "Protection de l'alimentation avec batterie de secours.", en: "Power protection with battery backup." },
    price: 249.00,
    image: "https://images.unsplash.com/photo-1587840171670-8b850147754e?auto=format&fit=crop&q=80&w=800",
    brand: "PowerSafe",
    tag: { fr: "Pro", en: "Pro" }
  },
  {
    id: "dummy-connect-5",
    title: { fr: "Casque Réduction de Bruit", en: "Noise Cancelling Headphones" },
    description: { fr: "Audio premium pour la concentration au travail.", en: "Premium audio for work concentration." },
    price: 349.99,
    image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=800",
    brand: "AuraSound",
    tag: { fr: "Premium", en: "Premium" }
  },
  {
    id: "dummy-connect-6",
    title: { fr: "Hub USB-C 10-en-1", en: "10-in-1 USB-C Hub" },
    description: { fr: "Station d'accueil multifonction pour ordinateur portable.", en: "Multifunction docking station for laptop." },
    price: 79.90,
    image: "https://images.unsplash.com/photo-1596756627684-257aedfb2559?auto=format&fit=crop&q=80&w=800",
    brand: "TechConnect",
    tag: { fr: "Accessoire", en: "Accessory" }
  }
];

export default function ConnectPage() {
  return (
    <StoreTemplate 
      category="connect"
      heroImage="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=2000"
      dummyProducts={DUMMY_PRODUCTS}
      dict={DICT}
    />
  );
}
