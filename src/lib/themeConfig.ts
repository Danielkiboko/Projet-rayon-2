import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Building, 
  Users, 
  FileText,
  Settings,
  Wallet,
  Truck,
  MessageSquare,
  BarChart3
} from "lucide-react";

export type ServiceType = "mode" | "immo" | "connect" | "saveurs" | "default";

export interface MenuItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  locked?: boolean;
}

export interface ServiceTheme {
  name: string;
  colors: {
    sidebarBg: string;
    sidebarText: string;
    primaryBtn: string;
    primaryBtnHover: string;
    accentText: string;
    activeMenuBg: string;
    activeMenuText: string;
  };
  menu: MenuItem[];
}

const standardProductMenu: MenuItem[] = [
  { title: "Dashboard",          href: "/supplier",          icon: LayoutDashboard },
  { title: "Mes Produits",       href: "/supplier/products", icon: Package },
  { title: "Commandes",          href: "/supplier/orders",   icon: ShoppingCart },
  { title: "Messages",           href: "/supplier/messages", icon: MessageSquare },
  { title: "Proformas & Factures", href: "/supplier/invoices", icon: FileText },
  { title: "Livre de caisse",    href: "/supplier/finance",  icon: Wallet },
  { title: "Rapports",           href: "/supplier/reports",  icon: BarChart3 },
  { title: "Livreurs",           href: "/supplier/drivers",  icon: Truck },
  { title: "Paramètres",         href: "/supplier/settings", icon: Settings },
];

export const themeConfig: Record<ServiceType, ServiceTheme> = {
  default: {
    name: "Rayons.net",
    colors: {
      sidebarBg: "bg-[#0F1D27]",
      sidebarText: "text-white",
      primaryBtn: "bg-[#C7D300] text-[#0F1D27] hover:bg-[#b5c000] font-bold",
      primaryBtnHover: "hover:bg-[#b5c000]",
      accentText: "text-[#C7D300]",
      activeMenuBg: "bg-[#C7D300]/15",
      activeMenuText: "text-[#C7D300]",
    },
    menu: [
      { title: "Dashboard",       href: "/supplier",          icon: LayoutDashboard },
      { title: "Livre de caisse", href: "/supplier/finance",  icon: Wallet },
      { title: "Paramètres",      href: "/supplier/settings", icon: Settings },
    ]
  },
  mode: {
    name: "Rayon Mode",
    colors: {
      sidebarBg: "bg-[#0F1D27]",
      sidebarText: "text-white",
      primaryBtn: "bg-[#D4B08C] text-[#0F1D27] hover:bg-[#c49f7b] font-bold",
      primaryBtnHover: "hover:bg-[#c49f7b]",
      accentText: "text-[#D4B08C]",
      activeMenuBg: "bg-[#D4B08C]/15",
      activeMenuText: "text-[#D4B08C]",
    },
    menu: standardProductMenu
  },
  immo: {
    name: "Rayon Immo",
    colors: {
      sidebarBg: "bg-[#0F1D27]",
      sidebarText: "text-white",
      primaryBtn: "bg-[#4C6EF5] text-white hover:bg-[#3b5bdb] font-bold",
      primaryBtnHover: "hover:bg-[#3b5bdb]",
      accentText: "text-[#4C6EF5]",
      activeMenuBg: "bg-[#4C6EF5]/15",
      activeMenuText: "text-[#4C6EF5]",
    },
    menu: [
      { title: "Dashboard",          href: "/supplier",          icon: LayoutDashboard },
      { title: "Mes Biens",          href: "/supplier/properties", icon: Building },
      { title: "Locataires",         href: "/supplier/tenants",  icon: Users },
      { title: "Messages",           href: "/supplier/messages", icon: MessageSquare },
      { title: "Proformas & Factures", href: "/supplier/invoices", icon: FileText },
      { title: "Livre de caisse",    href: "/supplier/finance",  icon: Wallet },
      { title: "Rapports",           href: "/supplier/reports",  icon: BarChart3 },
      { title: "Paramètres",         href: "/supplier/settings", icon: Settings },
    ]
  },
  connect: {
    name: "Rayon Connect",
    colors: {
      sidebarBg: "bg-[#0F1D27]", 
      sidebarText: "text-white",
      primaryBtn: "bg-[#00B5A5] text-white hover:bg-[#009e90] font-bold",
      primaryBtnHover: "hover:bg-[#009e90]",
      accentText: "text-[#00B5A5]",
      activeMenuBg: "bg-[#00B5A5]/15",
      activeMenuText: "text-[#00B5A5]",
    },
    menu: standardProductMenu
  },
  saveurs: {
    name: "Rayon Saveurs",
    colors: {
      sidebarBg: "bg-[#0F1D27]",
      sidebarText: "text-white",
      primaryBtn: "bg-[#FF6B35] text-white hover:bg-[#e85d04] font-bold",
      primaryBtnHover: "hover:bg-[#e85d04]",
      accentText: "text-[#FF6B35]",
      activeMenuBg: "bg-[#FF6B35]/15",
      activeMenuText: "text-[#FF6B35]",
    },
    menu: standardProductMenu
  }
};
