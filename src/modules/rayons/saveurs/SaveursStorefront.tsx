"use client";

import { StoreTemplate } from "@/modules/rayons/shared/StoreTemplate";

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
  },
  zh: {
    home: "首页",
    connect: "科技互联",
    immo: "房产酒店",
    mode: "时尚服饰",
    saveurs: "美食餐饮",
    login: "登录",
    title: "餐厅美食与专业厨具",
    tag: "美食餐饮",
    add: "立即预订",
    details: "详情",
  }
};

export default function RayonSaveursPage() {
  return (
    <StoreTemplate
      category="saveurs"
      heroImage="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=2000"
      dict={DICT}
    />
  );
}
