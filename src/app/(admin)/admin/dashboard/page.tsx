"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { 
  ShieldAlert,
  Users,
  Building,
  Package,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Mail,
  ArrowRight,
  Calendar,
  Bell,
  ChevronRight,
  Store,
  Clock,
  Sparkles
} from "lucide-react";
import { hasAdminAccess } from "@/lib/permissions";
import Link from "next/link";

export default function AdminDashboardPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const isAuthorized = hasAdminAccess(user, userData);

  const [stats, setStats] = useState({
    pendingSuppliers: 0,
    pendingProperties: 0,
    pendingProducts: 0,
    totalActiveSuppliers: 0,
    totalProperties: 0,
    totalProducts: 0,
    overdueTenantsCount: 0,
  });

  const [dataLoading, setDataLoading] = useState(true);
  const [isSendingReports, setIsSendingReports] = useState(false);

  const handleTriggerDailyReports = async () => {
    if (!confirm("Voulez-vous générer et envoyer les rapports journaliers maintenant (aux fournisseurs et par email à l'admin) ?")) {
      return;
    }

    setIsSendingReports(true);
    try {
      const res = await fetch("/api/cron/daily-reports", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(
          `✅ Rapports journaliers (Édition 07h00) envoyés avec succès !\n` +
          `• Période : ${data.date}\n` +
          `• Fournisseurs notifiés : ${data.suppliersNotified} / ${data.suppliersCount}\n` +
          `• Rapport consolidé envoyé par email à : ${data.adminEmails?.join(", ")}\n` +
          `• Volume d'affaires : ${data.metrics?.totalGlobalTurnover?.toLocaleString("fr-FR")} $`
        );
      } else {
        alert(`❌ Erreur: ${data.error || "Impossible d'envoyer les rapports"}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Erreur: ${err.message || "Erreur de connexion"}`);
    } finally {
      setIsSendingReports(false);
    }
  };

  // Protect route
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (!isAuthorized) {
        router.push("/");
      }
    }
  }, [user, userData, loading, router, isAuthorized]);

  // Fetch Validation & Regulation Data
  useEffect(() => {
    if (!user || !userData || !isAuthorized) return;

    let unsubUsers: any;
    let unsubProps: any;
    let unsubProds: any;
    let unsubTenants: any;

    const setupListeners = async () => {
      try {
        const { onSnapshot, query, collection, where, limit: fsLimit, orderBy } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");

        // 1. Pending & active suppliers
        const qUsers = query(
          collection(db, "users"), 
          where("role", "in", [
            "SUPPLIER", "supplier", "Supplier", 
            "SUPPLIER_IMMO", "supplier_immo",
            "SUB_SUPPLIER", "sub_supplier",
            "fournisseur", "Fournisseur", "FOURNISSEUR"
          ]),
          fsLimit(100)
        );
        unsubUsers = onSnapshot(qUsers, (snapUsers) => {
          let pSuppliers = 0;
          let aSuppliers = 0;
          snapUsers.forEach(doc => {
            const d = doc.data();
            if (d.status === "PENDING_APPROVAL" || d.profileUpdateStatus === "PENDING_APPROVAL") pSuppliers++;
            else aSuppliers++;
          });
          setStats(prev => ({ ...prev, pendingSuppliers: pSuppliers, totalActiveSuppliers: aSuppliers }));
        }, (err) => {
          console.warn("Dashboard users listener warning:", err.message);
        });

        // 2. Pending & active properties
        const qProps = query(collection(db, "properties"), orderBy("createdAt", "desc"), fsLimit(100));
        unsubProps = onSnapshot(qProps, (snapProps) => {
          let pProps = 0;
          let aProps = 0;
          snapProps.forEach(doc => {
            const d = doc.data();
            if (d.status === "PENDING_APPROVAL") pProps++;
            else aProps++;
          });
          setStats(prev => ({ ...prev, pendingProperties: pProps, totalProperties: aProps }));
        }, (err) => {
          console.warn("Dashboard properties listener warning:", err.message);
        });

        // 3. Pending & active products
        const qProds = query(collection(db, "products"), orderBy("createdAt", "desc"), fsLimit(100));
        unsubProds = onSnapshot(qProds, (snapProducts) => {
          let pProds = 0;
          let aProds = 0;
          snapProducts.forEach(doc => {
            const d = doc.data();
            if (d.status === "PENDING_APPROVAL" || d.status === "pending_approval") pProds++;
            else aProds++;
          });
          setStats(prev => ({ ...prev, pendingProducts: pProds, totalProducts: aProds }));
          setDataLoading(false);
        }, (err) => {
          console.warn("Dashboard products listener warning:", err.message);
          setDataLoading(false);
        });

        // 4. Overdue Tenants
        const qTenants = query(collection(db, "tenants"), fsLimit(100));
        unsubTenants = onSnapshot(qTenants, (snapTenants) => {
          let overdue = 0;
          snapTenants.forEach(doc => {
            const d = doc.data();
            if (d.status === "En retard" || d.status === "LATE") overdue++;
          });
          setStats(prev => ({ ...prev, overdueTenantsCount: overdue }));
        }, (err) => {
          console.warn("Dashboard tenants listener warning:", err.message);
        });

      } catch (err) {
        console.error("Error setting up dashboard data:", err);
        setDataLoading(false);
      }
    };

    setupListeners();

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubProps) unsubProps();
      if (unsubProds) unsubProds();
      if (unsubTenants) unsubTenants();
    };
  }, [user, userData, isAuthorized]);

  if (loading || !user || !isAuthorized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-white flex flex-col items-center">
          <ShieldAlert size={48} className="text-[#C7D300] mb-4 animate-pulse" />
          <p className="text-sm font-medium text-gray-400">Vérification des accès sécurisés au C-Panel...</p>
        </div>
      </div>
    );
  }

  const totalPending = stats.pendingSuppliers + stats.pendingProperties + stats.pendingProducts;

  return (
    <div className="space-y-8 font-sans max-w-7xl mx-auto">
      
      {/* ── EN-TÊTE ÉPURÉ (Sans doublon avec la topbar) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#C7D300]/15 text-[#C7D300] border border-[#C7D300]/20 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C7D300] animate-pulse" />
              Centre de Régulation
            </span>
            <span className="text-xs text-gray-500 font-medium">Kinshasa · Supervision en direct</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Tableau de Bord Exécutif
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Surveillance des 4 rayons, régulation des flux et validation des comptes partenaires.
          </p>
        </div>

        <Link
          href="/admin/suppliers"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold text-sm shadow-md shadow-[#C7D300]/10 transition-all shrink-0 self-start sm:self-auto hover:scale-[1.02]"
        >
          <Store size={16} />
          <span>Gérer les Partenaires</span>
        </Link>
      </div>

      {/* ── DISPOSITION 2 COLONNES (Gauche 2/3 + Droite 1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ══════ COLONNE PRINCIPALE (2/3) ══════ */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. HERO BANNER SATINÉ (Deep Navy + lueur Lime Rayons.net) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F1D27] via-[#142634] to-[#0A151D] border border-white/10 p-6 sm:p-7 shadow-xl">
            {/* Lueur d'ambiance #C7D300 */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-[#C7D300]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between gap-4 mb-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-gray-300 border border-white/10">
                <Clock size={13} className="text-[#C7D300]" />
                Rapports programmés chaque jour à 07h00 (Kinshasa)
              </span>
              <Calendar className="text-gray-500" size={18} />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2">
              {totalPending > 0
                ? `${totalPending} dossier(s) en attente d'approbation administrative`
                : "Toutes les opérations et catalogues sont à jour"}
            </h2>
            <p className="text-gray-400 text-sm max-w-xl mb-5 leading-relaxed">
              {totalPending > 0
                ? "De nouvelles demandes de fournisseurs, biens immobiliers ou articles e-commerce nécessitent votre autorisation pour être rendus visibles en ligne."
                : "La marketplace Rayons.net fonctionne normalement sur les 4 rayons (Saveurs, Mode, Connect, Immo)."}
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/suppliers"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/15 transition-colors"
              >
                <span>Examiner les {stats.pendingSuppliers} fournisseur(s)</span>
                <ArrowRight size={13} className="text-[#C7D300]" />
              </Link>
              {stats.pendingProperties > 0 && (
                <Link
                  href="/admin/properties"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/15 transition-colors"
                >
                  <span>Valider les {stats.pendingProperties} bien(s) immo</span>
                  <ArrowRight size={13} className="text-[#4C6EF5]" />
                </Link>
              )}
            </div>
          </div>

          {/* 2. GRILLE DE 4 COMPTEURS MÉTRIQUES KPIS ÉPURÉS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* KPI 1 : Fournisseurs en attente */}
            <div className="bg-[#0F1D27] rounded-2xl p-5 border border-white/10 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl -mr-4 -mt-4" />
              <p className="text-3xl font-extrabold text-blue-400">
                {dataLoading ? "-" : stats.pendingSuppliers}
              </p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">
                Fournisseurs en attente
              </p>
            </div>

            {/* KPI 2 : Biens immo en attente */}
            <div className="bg-[#0F1D27] rounded-2xl p-5 border border-white/10 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#4C6EF5]/10 rounded-full blur-xl -mr-4 -mt-4" />
              <p className="text-3xl font-extrabold text-[#4C6EF5]">
                {dataLoading ? "-" : stats.pendingProperties}
              </p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">
                Biens immo en attente
              </p>
            </div>

            {/* KPI 3 : Produits en attente */}
            <div className="bg-[#0F1D27] rounded-2xl p-5 border border-white/10 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#00B5A5]/10 rounded-full blur-xl -mr-4 -mt-4" />
              <p className="text-3xl font-extrabold text-[#00B5A5]">
                {dataLoading ? "-" : stats.pendingProducts}
              </p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">
                Produits en attente
              </p>
            </div>

            {/* KPI 4 : Partenaires Actifs */}
            <div className="bg-[#0F1D27] rounded-2xl p-5 border border-white/10 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#C7D300]/10 rounded-full blur-xl -mr-4 -mt-4" />
              <p className="text-3xl font-extrabold text-[#C7D300]">
                {dataLoading ? "-" : stats.totalActiveSuppliers}
              </p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">
                Partenaires Actifs
              </p>
            </div>
          </div>

          {/* 3. SECTION VALIDATIONS OPÉRATIONNELLES SANS SURCHARGE */}
          <div>
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertTriangle className="text-[#C7D300]" size={16} />
              Dossiers à Examiner
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Validation Fournisseurs */}
              <div className="bg-[#0F1D27] p-5 rounded-2xl border border-white/10 flex flex-col justify-between hover:border-white/20 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fournisseurs</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <Users size={16} />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">{dataLoading ? "-" : stats.pendingSuppliers}</span>
                    <span className="text-xs text-gray-500">en attente d'accord</span>
                  </div>
                </div>
                <Link href="/admin/suppliers" className="mt-5">
                  <button className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-blue-400 text-xs font-semibold border border-white/10 transition-colors flex items-center justify-center gap-1.5">
                    <span>Examiner les comptes</span>
                    <ArrowRight size={13} />
                  </button>
                </Link>
              </div>

              {/* Validation Immo */}
              <div className="bg-[#0F1D27] p-5 rounded-2xl border border-white/10 flex flex-col justify-between hover:border-white/20 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Immobilier</span>
                    <div className="w-8 h-8 rounded-lg bg-[#4C6EF5]/15 flex items-center justify-center text-[#4C6EF5]">
                      <Building size={16} />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">{dataLoading ? "-" : stats.pendingProperties}</span>
                    <span className="text-xs text-gray-500">biens soumis</span>
                  </div>
                </div>
                <Link href="/admin/properties" className="mt-5">
                  <button className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-[#4C6EF5] text-xs font-semibold border border-white/10 transition-colors flex items-center justify-center gap-1.5">
                    <span>Valider les biens</span>
                    <ArrowRight size={13} />
                  </button>
                </Link>
              </div>

              {/* Validation Produits */}
              <div className="bg-[#0F1D27] p-5 rounded-2xl border border-white/10 flex flex-col justify-between hover:border-white/20 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">E-Commerce</span>
                    <div className="w-8 h-8 rounded-lg bg-[#00B5A5]/15 flex items-center justify-center text-[#00B5A5]">
                      <Package size={16} />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">{dataLoading ? "-" : stats.pendingProducts}</span>
                    <span className="text-xs text-gray-500">articles soumis</span>
                  </div>
                </div>
                <Link href="/admin/products" className="mt-5">
                  <button className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-[#00B5A5] text-xs font-semibold border border-white/10 transition-colors flex items-center justify-center gap-1.5">
                    <span>Examiner les produits</span>
                    <ArrowRight size={13} />
                  </button>
                </Link>
              </div>
            </div>
          </div>

        </div>


        {/* ══════ COLONNE LATÉRALE DROITE (1/3) ══════ */}
        <div className="space-y-6">
          
          {/* WIDGET 1 : "À ne pas oublier" (Alertes exploitables en direct) */}
          <div className="bg-[#0F1D27] rounded-2xl p-6 border border-white/10 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400">
                <Bell size={15} />
              </div>
              <h3 className="font-bold text-white text-sm">À ne pas oublier</h3>
            </div>

            <div className="space-y-2.5">
              {stats.pendingSuppliers > 0 && (
                <Link href="/admin/suppliers" className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 transition-colors group">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-300 group-hover:text-amber-200">
                      {stats.pendingSuppliers} fournisseur(s) en attente
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Vérifier les dossiers et activer l'accès.
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-amber-400 shrink-0 self-center" />
                </Link>
              )}

              {stats.overdueTenantsCount > 0 && (
                <Link href="/admin/finance" className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 transition-colors group">
                  <div className="w-2 h-2 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-rose-300 group-hover:text-rose-200">
                      {stats.overdueTenantsCount} loyer(s) en retard
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Suivre les recouvrements et quittances.
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-rose-400 shrink-0 self-center" />
                </Link>
              )}

              {stats.pendingProperties > 0 && (
                <Link href="/admin/properties" className="flex items-start gap-3 p-3 rounded-xl bg-[#4C6EF5]/10 hover:bg-[#4C6EF5]/15 border border-[#4C6EF5]/20 transition-colors group">
                  <div className="w-2 h-2 rounded-full bg-[#4C6EF5] mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-blue-300 group-hover:text-blue-200">
                      {stats.pendingProperties} bien(s) à valider
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Vérifier les prix et l'éligibilité.
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-blue-400 shrink-0 self-center" />
                </Link>
              )}

              {stats.pendingSuppliers === 0 && stats.overdueTenantsCount === 0 && stats.pendingProperties === 0 && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                  <CheckCircle2 size={20} className="text-[#C7D300] mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-gray-300">Aucune alerte urgente</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Tous les dossiers administratifs sont traités.</p>
                </div>
              )}
            </div>
          </div>

          {/* WIDGET 2 : "Performance des 4 Rayons" (Avec les couleurs officielles du projet) */}
          <div className="bg-[#0F1D27] rounded-2xl p-6 border border-white/10 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#C7D300]/15 flex items-center justify-center text-[#C7D300]">
                  <Activity size={15} />
                </div>
                <h3 className="font-bold text-white text-sm">Les 4 Rayons</h3>
              </div>
              <span className="text-[10px] text-gray-500 font-semibold uppercase">Plateforme</span>
            </div>

            <div className="space-y-2.5">
              {/* Saveurs #FF6B35 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5">
                <span className="text-xs font-medium text-gray-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B35]" />
                  🍽️ Rayon Saveurs
                </span>
                <span className="text-xs font-bold text-[#FF6B35]">Actif</span>
              </div>

              {/* Mode #D4B08C */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5">
                <span className="text-xs font-medium text-gray-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D4B08C]" />
                  👗 Rayon Mode
                </span>
                <span className="text-xs font-bold text-[#D4B08C]">Actif</span>
              </div>

              {/* Connect #00B5A5 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5">
                <span className="text-xs font-medium text-gray-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00B5A5]" />
                  📱 Rayon Connect
                </span>
                <span className="text-xs font-bold text-[#00B5A5]">Actif</span>
              </div>

              {/* Immo #4C6EF5 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5">
                <span className="text-xs font-medium text-gray-300 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4C6EF5]" />
                  🏢 Rayon Immo
                </span>
                <span className="text-xs font-bold text-[#4C6EF5] font-mono">
                  {stats.totalProperties} biens
                </span>
              </div>
            </div>

            <Link
              href="/admin/finance"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C7D300] hover:underline mt-4 transition-colors"
            >
              <span>Consulter le livre de caisse central</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {/* WIDGET 3 : "Rapport Journalier Matinal (07h00)" (Bouton d'envoi unique) */}
          <div className="bg-gradient-to-br from-[#0F1D27] to-[#12232E] rounded-2xl p-6 border border-[#C7D300]/25 shadow-md relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-[#C7D300]/15 flex items-center justify-center text-[#C7D300]">
                <Mail size={15} />
              </div>
              <h3 className="font-bold text-white text-sm">Rapport Matinal (07h00)</h3>
            </div>
            
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Diffusion automatique programmée chaque matin à <strong>07h00</strong> à 100% des fournisseurs partenaires et à la direction.
            </p>

            <button
              onClick={handleTriggerDailyReports}
              disabled={isSendingReports}
              className="w-full py-2.5 px-4 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold rounded-xl text-xs transition-all shadow-md shadow-[#C7D300]/15 flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01]"
            >
              <Mail size={14} className={isSendingReports ? "animate-spin" : ""} />
              <span>{isSendingReports ? "Diffusion en cours..." : "Envoyer les Rapports Journaliers (07h00)"}</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
