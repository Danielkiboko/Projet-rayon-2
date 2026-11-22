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
  },
  zh: {
    home: "首页",
    connect: "科技互联",
    immo: "房产酒店",
    mode: "时尚服饰",
    saveurs: "美食餐饮",
    login: "登录",
    title: "科技与智能设备",
    add: "加入购物车",
    details: "详情",
  }
};

export default function ConnectPage() {
  return (
    <StoreTemplate 
      category="connect"
      heroImage="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=2000"
      dict={DICT}
    />
  );
}
