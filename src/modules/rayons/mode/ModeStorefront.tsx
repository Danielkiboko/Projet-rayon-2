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
  },
  zh: {
    home: "首页",
    connect: "科技互联",
    immo: "房产酒店",
    mode: "时尚服饰",
    saveurs: "美食餐饮",
    login: "登录",
    title: "全新时尚系列",
    subtitle: "探索我们精选的潮流服饰、鞋履与精品配饰。",
    add: "加入购物车",
    details: "详情",
  }
};

export default function ModePage() {
  return (
    <StoreTemplate 
      category="mode"
      heroImage="https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&q=80&w=2000"
      dict={DICT}
    />
  );
}
