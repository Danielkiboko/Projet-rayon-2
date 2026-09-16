"use client";

import { useRouter } from "next/navigation";
import { Package, ShoppingCart, DollarSign, Truck, UtensilsCrossed, LucideIcon, AlertCircle } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { useAuth } from "@/context/AuthContext";
import { evaluateSupplierSubscription } from "@/lib/supplierSubscription";
import GenericDashboard, { KpiConfig, ActionConfig } from "./shared/GenericDashboard";
import { useSupplierDashboardStats } from "@/hooks/useSupplierDashboardStats";

export interface StoreSupplierConfig {
  moduleName: string;
  chartTitle: string;
  chartColor: string;
  productKpiTitle: string;
  productKpiIcon: LucideIcon;
  productKpiSubInfo: string;
  actionAddTitle: string;
  actionAddDesc: string;
  actionManageDesc: string;
  actionsTitle: string;
}

const RAYON_CONFIGS: Record<"mode" | "connect" | "saveurs", StoreSupplierConfig> = {
  mode: {
    moduleName: "Boutique Mode & Prêt-à-porter",
    chartTitle: "Évolution des Ventes Mode (30 j)",
    chartColor: "#3b82f6",
    productKpiTitle: "Produits en Vente",
    productKpiIcon: Package,
    productKpiSubInfo: "Gérer le catalogue",
    actionAddTitle: "Ajouter un article",
    actionAddDesc: "Mettez en vente de nouveaux articles dans votre catalogue mode.",
    actionManageDesc: "Consultez les commandes en attente d'expédition par un coursier.",
    actionsTitle: "Gérer ma boutique Mode",
  },
  connect: {
    moduleName: "Boutique High-Tech & Connect",
    chartTitle: "Évolution des Ventes Tech (30 j)",
    chartColor: "#10b981",
    productKpiTitle: "Matériels en Vente",
    productKpiIcon: Package,
    productKpiSubInfo: "Gérer le catalogue tech",
    actionAddTitle: "Ajouter du matériel",
    actionAddDesc: "Mettez en vente de nouveaux équipements (Starlink, smartphones, etc.).",
    actionManageDesc: "Consultez les commandes en attente d'expédition par un livreur.",
    actionsTitle: "Gérer ma boutique Tech",
  },
  saveurs: {
    moduleName: "Boutique Saveurs & Restaurant",
    chartTitle: "Évolution des Ventes Saveurs (30 j)",
    chartColor: "#FF6B35",
    productKpiTitle: "Plats & Articles en Vente",
    productKpiIcon: UtensilsCrossed,
    productKpiSubInfo: "Gérer la carte & catalogue",
    actionAddTitle: "Ajouter un plat ou ustensile",
    actionAddDesc: "Publiez un nouveau plat cuisiné, un menu du jour ou un accessoire culinaire.",
    actionManageDesc: "Consultez les commandes à préparer en cuisine et à confier aux coursiers.",
    actionsTitle: "Gérer mon espace Saveurs",
  },
};

interface StoreSupplierDashboardProps {
  rayon: "mode" | "connect" | "saveurs";
}

export default function StoreSupplierDashboard({ rayon }: StoreSupplierDashboardProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const { userData } = useAuth();
  const { stats, loading, revenueData, recentOrders } = useSupplierDashboardStats();

  const subscriptionInfo = evaluateSupplierSubscription(userData);
  const isBlocked = subscriptionInfo.isBlocked;

  const cfg = RAYON_CONFIGS[rayon] || RAYON_CONFIGS.mode;

  const KPIS: KpiConfig[] = [
    {
      title: cfg.productKpiTitle,
      value: stats.totalProducts.toString(),
      subtitle: "Catalogue",
      subInfo: stats.lowStockProducts > 0 
        ? `⚠️ ${stats.lowStockProducts} en rupture / critique (<10)` 
        : cfg.productKpiSubInfo,
      icon: cfg.productKpiIcon,
      alertCondition: stats.lowStockProducts > 0,
      onClick: isBlocked ? undefined : () => router.push("/supplier/products"),
    },
    {
      title: "Commandes Actives",
      value: stats.activeOrders.toString(),
      subtitle: "En cours",
      subInfo: "À traiter / En préparation",
      icon: ShoppingCart,
      onClick: isBlocked ? undefined : () => router.push("/supplier/orders"),
    },
    {
      title: "Chiffre d'affaires",
      value: formatPrice(stats.totalRevenue),
      subtitle: "Total",
      subInfo: "Revenus bruts",
      icon: DollarSign,
    },
    {
      title: "À Expédier",
      value: stats.pendingDeliveries.toString(),
      subtitle: "Action requise",
      subInfo: stats.pendingDeliveries > 0 ? "Préparer les colis" : "Tout est expédié",
      icon: Truck,
      alertCondition: stats.pendingDeliveries > 0,
      onClick: isBlocked ? undefined : () => router.push("/supplier/orders"),
    },
  ];

  const actions: ActionConfig[] = [
    {
      title: cfg.actionAddTitle,
      description: cfg.actionAddDesc,
      buttonText: "Créer un produit",
      onClick: () => router.push("/supplier/products"),
      isPrimary: true,
    },
    {
      title: "Voir les expéditions",
      description: cfg.actionManageDesc,
      buttonText: "Gérer les commandes",
      onClick: () => router.push("/supplier/orders"),
      isPrimary: false,
    },
  ];

  const lowStockAlert = stats.lowStockProducts > 0 ? (
    <div className="bg-red-500/15 border border-red-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 shadow-lg">
      <div className="flex items-center gap-3.5">
        <div className="p-3 bg-red-500/20 text-red-400 rounded-xl shrink-0 animate-pulse">
          <AlertCircle size={24} />
        </div>
        <div>
          <h4 className="font-bold text-sm text-red-200 flex items-center gap-2">
            <span>Signal Logistique : {stats.lowStockProducts} produit(s) en rupture / stock critique</span>
            <span className="bg-red-500/30 text-red-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-red-500/40">
              Moins de 10 pièces
            </span>
          </h4>
          <p className="text-xs text-red-300/80 mt-0.5">
            Ces articles ont un stock inférieur à 10 pièces. Réapprovisionnez-les rapidement pour éviter l'indisponibilité sur vos rayons.
          </p>
        </div>
      </div>
      <button
        onClick={() => router.push("/supplier/products")}
        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shrink-0 self-start sm:self-center"
      >
        Gérer les stocks
      </button>
    </div>
  ) : null;

  return (
    <GenericDashboard
      loading={loading}
      moduleName={cfg.moduleName}
      kpis={KPIS}
      chartData={revenueData}
      chartTitle={cfg.chartTitle}
      chartColor={cfg.chartColor}
      recentItemsTitle="Commandes Récentes"
      recentItemsHeaders={["ID", "Date", "Client", "Montant", "Statut"]}
      recentItemsData={recentOrders}
      emptyStateMessage="Aucune commande récente."
      actionsTitle={cfg.actionsTitle}
      actions={actions}
      isBlocked={isBlocked}
      bottomExtra={lowStockAlert}
      renderRecentRow={(order: any) => (
        <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
          <td className="p-4 font-semibold text-white">#{order.id.slice(0, 6).toUpperCase()}</td>
          <td className="p-4">
            {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : "-"}
          </td>
          <td className="p-4">{order.clientName || order.clientPhone || "Client"}</td>
          <td className="p-4 font-bold" style={{ color: cfg.chartColor }}>
            {formatPrice(order.myTotal || order.itemsTotal || 0)}
          </td>
          <td className="p-4">
            <span
              className={`inline-flex px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider ${
                order.status === "COMPLETED"
                  ? "bg-green-500/10 text-green-400"
                  : order.status === "CANCELLED"
                  ? "bg-red-500/10 text-red-400"
                  : "bg-orange-500/10 text-orange-400"
              }`}
            >
              {order.status || "EN COURS"}
            </span>
          </td>
        </tr>
      )}
    />
  );
}
