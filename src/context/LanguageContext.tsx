"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type LanguageCode = "fr" | "en" | "zh";

interface LanguageContextType {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  translateLabel: (frenchLabel: string) => string;
  getLocalizedText: (value: any, fallback?: string) => string;
}

const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  fr: {
    // Navigation & Rayons
    "nav.home": "Accueil",
    "nav.connect": "Connect",
    "nav.immo": "Immo",
    "nav.mode": "Mode",
    "nav.saveurs": "Saveurs",
    "nav.login": "Connexion",
    "nav.register": "S'inscrire",
    "nav.account": "Mon compte",
    "nav.logout": "Déconnexion",
    "nav.becomeSupplier": "Devenir Fournisseur",
    "nav.cart": "Panier",
    "nav.messages": "Messages",
    "nav.profile": "Compte",
    "nav.searchPlaceholder": "Rechercher un produit, un hôtel, une villa, une boutique...",
    "nav.language": "Langue d'affichage",

    // Homepage Hero & Sections
    "home.badge": "Marketplace Officielle · RDC & International",
    "home.heroTitle1": "Tout ce dont vous avez besoin,",
    "home.heroTitle2": "en un seul endroit.",
    "home.heroSubtitle": "Technologies, Immobilier & Hôtels, Mode et Gastronomie. Achetez directement auprès de boutiques vérifiées avec paiement sécurisé à la livraison.",
    "home.exploreRayons": "Explorer les Rayons",
    "home.openShop": "Ouvrir ma Boutique",
    "home.rayonsTitle": "Nos 4 Rayons Spécialisés",
    "home.rayonsSubtitle": "Chaque rayon regroupe des fournisseurs vérifiés et spécialisés dans leur domaine.",
    "home.discoverRayon": "Découvrir le rayon",
    "home.featuredTitle": "Nouveautés & Offres en Vedette",
    "home.featuredSubtitle": "Produits vérifiés en stock, disponibles immédiatement à la commande ou sur devis.",
    "home.seeAll": "Voir tout",
    "home.whyTitle": "Pourquoi choisir Rayons.net ?",
    "home.whySubtitle": "Une marketplace pensée pour la confiance, la transparence et la rapidité.",
    "home.testimonialsTitle": "Ils nous font confiance",
    "home.ctaTitle": "Vous êtes commerçant, restaurateur ou agence immobilière ?",
    "home.ctaSubtitle": "Rejoignez la plateforme Rayons.net et profitez de 15 jours d'essai gratuit pour digitaliser vos ventes.",
    "home.ctaButton": "Créer mon espace vendeur",
    "home.buyNow": "Acheter maintenant",
    "home.addToCart": "Ajouter au panier",
    "home.details": "Détails",
    "home.order": "Commander",
    "home.verified": "Vérifié",

    // Rayons descriptions
    "rayon.connect.tag": "Innovation & Tech",
    "rayon.connect.title": "Rayons Connect",
    "rayon.connect.desc": "Starlink, smartphones, audio haut de gamme, domotique et équipements connectés.",
    "rayon.connect.badge": "Tech & Gadgets",
    "rayon.immo.tag": "Immobilier & Hôtellerie",
    "rayon.immo.title": "Rayons Immo",
    "rayon.immo.desc": "Villas, appartements, bureaux modernes et réservations d'hôtels de standing certifiés.",
    "rayon.immo.badge": "Locations & Hôtels",
    "rayon.mode.tag": "Mode & Lifestyle",
    "rayon.mode.title": "Rayons Mode",
    "rayon.mode.desc": "Prêt-à-porter haut de gamme, maroquinerie, accessoires de luxe et collections exclusives.",
    "rayon.mode.badge": "Tendances & Luxe",
    "rayon.saveurs.tag": "Gastronomie & Cuisine",
    "rayon.saveurs.title": "Rayons Saveurs",
    "rayon.saveurs.desc": "Restaurants réputés, plats préparés par des chefs et équipements culinaires de qualité.",
    "rayon.saveurs.badge": "Plats & Équipements",

    // Storefront / Search / Empty
    "store.searchPlaceholder": "Rechercher dans ce rayon...",
    "store.noResults": "Aucun article trouvé",
    "store.resetSearch": "Réinitialiser la recherche",
    "store.loading": "Chargement des articles...",
    "store.contactSupplier": "Discuter avec le vendeur",
    "store.inStock": "En stock",
    "store.outOfStock": "Rupture de stock",
    "store.back": "Retour",
    "store.share": "Partager",
    "store.copied": "Lien copié !",
    "store.reviews": "Avis clients",
    "store.similar": "Articles similaires",

    // Cart Drawer
    "cart.title": "Mon Panier",
    "cart.empty": "Votre panier est vide",
    "cart.emptyDesc": "Parcourez nos 4 rayons et ajoutez vos articles préférés.",
    "cart.total": "Total estimé",
    "cart.checkout": "Valider la commande",
    "cart.continue": "Continuer mes achats",
    "cart.clear": "Vider le panier",

    // Dashboard Common
    "dash.profileIdentity": "Mon Profil & Identité",
    "dash.logout": "Déconnexion",
    "dash.search": "Rechercher...",
    "dash.hello": "Bonjour",
    "dash.goodEvening": "Bonsoir",
    "dash.manageProfile": "Gérer profil",
    "dash.notifications": "Notifications",
    "dash.doneTitle": "C'est fait !",
    "dash.continue": "Continuer",

    // Footer
    "footer.tagline": "La marketplace complète d'Afrique Centrale : Tech, Immobilier, Mode et Gastronomie.",
    "footer.rayons": "Nos Rayons",
    "footer.company": "Entreprise",
    "footer.support": "Support & Aide",
    "footer.rights": "Tous droits réservés.",
  },

  en: {
    // Navigation & Rayons
    "nav.home": "Home",
    "nav.connect": "Connect",
    "nav.immo": "Real Estate",
    "nav.mode": "Fashion",
    "nav.saveurs": "Flavors",
    "nav.login": "Sign In",
    "nav.register": "Sign Up",
    "nav.account": "My Account",
    "nav.logout": "Sign Out",
    "nav.becomeSupplier": "Become a Supplier",
    "nav.cart": "Cart",
    "nav.messages": "Messages",
    "nav.profile": "Account",
    "nav.searchPlaceholder": "Search for a product, hotel, villa, or store...",
    "nav.language": "Display Language",

    // Homepage Hero & Sections
    "home.badge": "Official Marketplace · DRC & International",
    "home.heroTitle1": "Everything you need,",
    "home.heroTitle2": "all in one place.",
    "home.heroSubtitle": "Technology, Real Estate & Hotels, Fashion, and Gastronomy. Buy directly from verified stores with secure payment on delivery.",
    "home.exploreRayons": "Explore Categories",
    "home.openShop": "Open My Store",
    "home.rayonsTitle": "Our 4 Specialized Departments",
    "home.rayonsSubtitle": "Each department brings together verified suppliers specialized in their field.",
    "home.discoverRayon": "Explore department",
    "home.featuredTitle": "New Arrivals & Featured Deals",
    "home.featuredSubtitle": "Verified in-stock products available for immediate order or direct quote.",
    "home.seeAll": "View all",
    "home.whyTitle": "Why choose Rayons.net?",
    "home.whySubtitle": "A marketplace designed for trust, transparency, and speed.",
    "home.testimonialsTitle": "Trusted by our users",
    "home.ctaTitle": "Are you a merchant, restaurant, or real estate agency?",
    "home.ctaSubtitle": "Join Rayons.net and enjoy a 15-day free trial to digitalize your sales.",
    "home.ctaButton": "Create my seller account",
    "home.buyNow": "Buy Now",
    "home.addToCart": "Add to Cart",
    "home.details": "Details",
    "home.order": "Order",
    "home.verified": "Verified",

    // Rayons descriptions
    "rayon.connect.tag": "Innovation & Tech",
    "rayon.connect.title": "Rayons Connect",
    "rayon.connect.desc": "Starlink kits, smartphones, premium audio, smart home, and connected devices.",
    "rayon.connect.badge": "Tech & Gadgets",
    "rayon.immo.tag": "Real Estate & Hospitality",
    "rayon.immo.title": "Rayons Immo",
    "rayon.immo.desc": "Villas, apartments, modern offices, and certified luxury hotel bookings.",
    "rayon.immo.badge": "Rentals & Hotels",
    "rayon.mode.tag": "Fashion & Lifestyle",
    "rayon.mode.title": "Rayons Mode",
    "rayon.mode.desc": "High-end apparel, leather goods, luxury accessories, and exclusive collections.",
    "rayon.mode.badge": "Trends & Luxury",
    "rayon.saveurs.tag": "Gastronomy & Kitchen",
    "rayon.saveurs.title": "Rayons Saveurs",
    "rayon.saveurs.desc": "Top restaurants, chef-prepared dishes, and quality culinary equipment.",
    "rayon.saveurs.badge": "Meals & Cookware",

    // Storefront / Search / Empty
    "store.searchPlaceholder": "Search in this department...",
    "store.noResults": "No items found",
    "store.resetSearch": "Reset search",
    "store.loading": "Loading items...",
    "store.contactSupplier": "Chat with seller",
    "store.inStock": "In Stock",
    "store.outOfStock": "Out of Stock",
    "store.back": "Back",
    "store.share": "Share",
    "store.copied": "Link copied!",
    "store.reviews": "Customer Reviews",
    "store.similar": "Similar Items",

    // Cart Drawer
    "cart.title": "My Cart",
    "cart.empty": "Your cart is empty",
    "cart.emptyDesc": "Browse our 4 departments and add your favorite items.",
    "cart.total": "Estimated Total",
    "cart.checkout": "Proceed to Checkout",
    "cart.continue": "Continue Shopping",
    "cart.clear": "Clear Cart",

    // Dashboard Common
    "dash.profileIdentity": "My Profile & Identity",
    "dash.logout": "Sign Out",
    "dash.search": "Search...",
    "dash.hello": "Hello",
    "dash.goodEvening": "Good evening",
    "dash.manageProfile": "Manage profile",
    "dash.notifications": "Notifications",
    "dash.doneTitle": "Done!",
    "dash.continue": "Continue",

    // Footer
    "footer.tagline": "The complete marketplace for Central Africa: Tech, Real Estate, Fashion & Gastronomy.",
    "footer.rayons": "Departments",
    "footer.company": "Company",
    "footer.support": "Support & Help",
    "footer.rights": "All rights reserved.",
  },

  zh: {
    // Navigation & Rayons
    "nav.home": "首页",
    "nav.connect": "科技互联",
    "nav.immo": "房产酒店",
    "nav.mode": "时尚服饰",
    "nav.saveurs": "美食餐饮",
    "nav.login": "登录",
    "nav.register": "注册",
    "nav.account": "我的账户",
    "nav.logout": "退出登录",
    "nav.becomeSupplier": "成为供应商",
    "nav.cart": "购物车",
    "nav.messages": "消息",
    "nav.profile": "我的",
    "nav.searchPlaceholder": "搜索商品、酒店、别墅或店铺...",
    "nav.language": "显示语言",

    // Homepage Hero & Sections
    "home.badge": "官方综合商城 · 刚果(金)及国际市场",
    "home.heroTitle1": "您所需的一切，",
    "home.heroTitle2": "尽在一站式平台。",
    "home.heroSubtitle": "科技数码、房产与酒店、时尚穿搭及美食餐饮。直接向认证商家下单，支持货到验收后安全放款。",
    "home.exploreRayons": "浏览分类频道",
    "home.openShop": "免费开店",
    "home.rayonsTitle": "四大专业频道",
    "home.rayonsSubtitle": "每个频道均汇聚经过实地审核与认证的专业供应商。",
    "home.discoverRayon": "进入频道",
    "home.featuredTitle": "新品上架与精选推荐",
    "home.featuredSubtitle": "现货认证商品，支持立即下单或在线议价生成形式发票。",
    "home.seeAll": "查看全部",
    "home.whyTitle": "为什么选择 Rayons.net？",
    "home.whySubtitle": "专为信任、透明与高效交易打造的综合商业平台。",
    "home.testimonialsTitle": "客户与商家评价",
    "home.ctaTitle": "您是商家、餐厅还是房产机构？",
    "home.ctaSubtitle": "立即入驻 Rayons.net，享受 15 天免费试用，轻松开启线上数字化经营。",
    "home.ctaButton": "创建商家账户",
    "home.buyNow": "立即购买",
    "home.addToCart": "加入购物车",
    "home.details": "查看详情",
    "home.order": "立即预订",
    "home.verified": "已认证",

    // Rayons descriptions
    "rayon.connect.tag": "创新科技",
    "rayon.connect.title": "科技互联 (Connect)",
    "rayon.connect.desc": "Starlink 星链设备、智能手机、高端音响、智能家居及网络硬件。",
    "rayon.connect.badge": "数码与科技",
    "rayon.immo.tag": "房产与酒店",
    "rayon.immo.title": "房产酒店 (Immo)",
    "rayon.immo.desc": "精选别墅、公寓、现代写字楼及认证高端酒店客房预订。",
    "rayon.immo.badge": "租售与酒店",
    "rayon.mode.tag": "时尚与生活",
    "rayon.mode.title": "时尚服饰 (Mode)",
    "rayon.mode.desc": "高端成衣、精品皮具、奢华配饰及独家潮流系列。",
    "rayon.mode.badge": "潮流与轻奢",
    "rayon.saveurs.tag": "美食与厨具",
    "rayon.saveurs.title": "美食餐饮 (Saveurs)",
    "rayon.saveurs.desc": "知名餐厅、大厨现做美食及高品质专业厨房设备。",
    "rayon.saveurs.badge": "美食与厨具",

    // Storefront / Search / Empty
    "store.searchPlaceholder": "在此频道中搜索...",
    "store.noResults": "未找到相关商品",
    "store.resetSearch": "重置搜索",
    "store.loading": "正在加载商品...",
    "store.contactSupplier": "联系商家",
    "store.inStock": "有现货",
    "store.outOfStock": "暂时缺货",
    "store.back": "返回",
    "store.share": "分享",
    "store.copied": "链接已复制！",
    "store.reviews": "客户评价",
    "store.similar": "相似推荐",

    // Cart Drawer
    "cart.title": "我的购物车",
    "cart.empty": "购物车是空的",
    "cart.emptyDesc": "浏览四大频道，添加您心仪的商品。",
    "cart.total": "预计总计",
    "cart.checkout": "立即结算",
    "cart.continue": "继续购物",
    "cart.clear": "清空购物车",

    // Dashboard Common
    "dash.profileIdentity": "个人资料与身份认证",
    "dash.logout": "退出登录",
    "dash.search": "搜索...",
    "dash.hello": "您好",
    "dash.goodEvening": "晚上好",
    "dash.manageProfile": "管理资料",
    "dash.notifications": "消息通知",
    "dash.doneTitle": "操作成功！",
    "dash.continue": "继续",

    // Footer
    "footer.tagline": "中非地区一站式综合商城：科技数码、房产酒店、时尚服饰与美食餐饮。",
    "footer.rayons": "核心频道",
    "footer.company": "关于平台",
    "footer.support": "帮助与支持",
    "footer.rights": "保留所有权利。",
  },
};

/**
 * Traduction automatique des intitulés de menus Admin / Fournisseur / Partenaire / Client
 */
const MENU_LABEL_MAP: Record<string, { en: string; zh: string }> = {
  "Dashboard": { en: "Dashboard", zh: "控制面板" },
  "Tableau de Bord": { en: "Dashboard", zh: "控制面板" },
  "Administration Centrale": { en: "Central Administration", zh: "中央管理后台" },
  "Push & App Mobile": { en: "Push & Mobile App", zh: "推送与移动应用" },
  "Clients": { en: "Customers", zh: "客户管理" },
  "Partenaires": { en: "Partners", zh: "合作伙伴" },
  "Fournisseurs": { en: "Suppliers", zh: "供应商管理" },
  "Mes Ventes": { en: "My Sales", zh: "我的销售" },
  "Courses & Livraisons": { en: "Deliveries & Dispatch", zh: "配送与调度" },
  "Produits": { en: "Products", zh: "商品管理" },
  "Immobilier": { en: "Real Estate", zh: "房产酒店" },
  "Livreurs": { en: "Drivers", zh: "骑手与配送员" },
  "Flotte & Livreurs": { en: "Driver Fleet", zh: "配送车队" },
  "Finances": { en: "Finances", zh: "财务中心" },
  "Finances & Abonnements": { en: "Finances & Subscriptions", zh: "财务与订阅" },
  "Parrainages": { en: "Referrals", zh: "推荐返佣" },
  "Tickets & Support": { en: "Tickets & Support", zh: "客服工单" },
  "Requêtes & Correspondances": { en: "Customer Requests", zh: "客户咨询与工单" },
  "Santé & Bugs": { en: "System Health", zh: "系统监控" },
  "Équipe & Fonctionnaires": { en: "Staff & Team", zh: "内部团队" },
  "Paramètres": { en: "Settings", zh: "系统设置" },
  "Commandes": { en: "Orders", zh: "订单管理" },
  "Messagerie": { en: "Messages", zh: "消息中心" },
  "Messages": { en: "Messages", zh: "消息中心" },
  "Locataires": { en: "Tenants", zh: "租户管理" },
  "Réservations": { en: "Bookings", zh: "预订管理" },
  "Mon Équipe": { en: "My Team", zh: "我的团队" },
  "Boutique": { en: "Storefront", zh: "我的店铺" },
  "Direction Générale": { en: "Executive Board", zh: "总经理办公室" },
  "Direction Adjointe": { en: "Deputy Management", zh: "副总管理" },
  "Fonctionnaire Rayons": { en: "Rayons Staff", zh: "平台工作人员" },
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "fr",
  setLang: () => {},
  t: (key, fallback) => fallback || key,
  translateLabel: (label) => label,
  getLocalizedText: (val, fallback = "") => (typeof val === "string" ? val : fallback),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>("fr");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("rayons_lang") as LanguageCode | null;
      if (saved && (saved === "fr" || saved === "en" || saved === "zh")) {
        setLangState(saved);
        document.documentElement.lang = saved === "zh" ? "zh-CN" : saved;
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setLang = useCallback((newLang: LanguageCode) => {
    setLangState(newLang);
    try {
      localStorage.setItem("rayons_lang", newLang);
      document.documentElement.lang = newLang === "zh" ? "zh-CN" : newLang;
    } catch {
      // Ignore storage errors
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.fr[key] || fallback || key;
    },
    [lang]
  );

  const translateLabel = useCallback(
    (frenchLabel: string): string => {
      if (lang === "fr") return frenchLabel;
      const entry = MENU_LABEL_MAP[frenchLabel];
      if (entry) {
        return lang === "zh" ? entry.zh : entry.en;
      }
      return frenchLabel;
    },
    [lang]
  );

  const getLocalizedText = useCallback(
    (value: any, fallback = ""): string => {
      if (!value) return fallback;
      if (typeof value === "string") return value;
      if (typeof value === "object") {
        return value[lang] || value.fr || value.en || value.zh || fallback;
      }
      return String(value);
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, translateLabel, getLocalizedText }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
