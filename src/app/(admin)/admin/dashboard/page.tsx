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
  CheckCircle,
  AlertTriangle,
  Mail,
  ShoppingCart,
  Truck,
  Plus,
  ArrowRight,
  Calendar,
  Bell,
  Heart,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Store
} from "lucide-react";
import { db } from "@/lib/firebase";
import { hasAdminAccess } from "@/lib/permissions";
import Link from "next/link";
import { motion } from "framer-motion";

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
    todayOrdersCount: 0,
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
    let unsubOrders: any;

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

        // 5. Orders Count
        const qOrders = query(collection(db, "orders"), fsLimit(50));
        unsubOrders = onSnapshot(qOrders, (snapOrders) => {
          setStats(prev => ({ ...prev, todayOrdersCount: snapOrders.size }));
        }, (err) => {
          console.warn("Dashboard orders listener warning:", err.message);
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
      if (unsubOrders) unsubOrders();
    };
  }, [user, userData, isAuthorized]);

  if (loading || !user || !isAuthorized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-slate-600 flex flex-col items-center">
          <ShieldAlert size={48} className="text-blue-600 mb-4 animate-pulse" />
          <p className="font-semibold text-sm">Vérification des accès sécurisés au C-Panel...</p>
        </div>
      </div>
    );
  }

  const totalPending = stats.pendingSuppliers + stats.pendingProperties + stats.pendingProducts;

  const NAV_TABS = [
    { label: "Tableau de bord", href: "/admin/dashboard", active: true },
    { label: "Clients", href: "/admin/clients", active: false },
    { label: "Mes Ventes", href: "/admin/orders", active: false },
    { label: "Produits", href: "/admin/products", active: false, badge: stats.pendingProducts },
    { label: "Immobilier", href: "/admin/properties", active: false, badge: stats.pendingProperties },
    { label: "Fournisseurs", href: "/admin/suppliers", active: false, badge: stats.pendingSuppliers },
    { label: "Livreurs", href: "/admin/drivers", active: false },
    { label: "Finances", href: "/admin/finance", active: false },
    { label: "Équipe & Rôles", href: "/admin/team", active: false },
    { label: "Santé & Logs", href: "/admin/health", active: false },
    { label: "Paramètres", href: "/admin/settings", active: false },
  ];

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 bg-[#f8fafc] text-slate-800 min-h-full font-sans">
      
      {/* ── TOP HEADER SECTION (Style Sango Health) ── */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[11px] font-bold px-3 py-1 bg-blue-100/80 text-blue-700 rounded-full tracking-wider uppercase border border-blue-200/50">
            ESPACE CONTRÔLE • ADMINISTRATION CENTRALE
          </span>
          <span className="text-xs text-slate-400 font-medium">
            Kinshasa · Console Sécurisée Rayons.net
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Mon C-Panel Rayons
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Gérez les accès, validez les comptes partenaires, suivez l'activité journalière et régulez la plateforme.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleTriggerDailyReports}
              disabled={isSendingReports}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-all shadow-xs disabled:opacity-50"
            >
              <Mail size={16} className={`text-slate-500 ${isSendingReports ? "animate-spin" : ""}`} />
              <span>{isSendingReports ? "Envoi en cours..." : "Rapport Journalier (7h00)"}</span>
            </button>

            <Link
              href="/admin/suppliers"
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-bold shadow-md shadow-blue-600/25 transition-all hover:scale-[1.02]"
            >
              <Plus size={16} />
              <span>Nouveau Partenaire</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── HORIZONTAL NAVIGATION TABS (Style Sango Health) ── */}
      <div className="flex items-center space-x-1 border-b border-slate-200 mb-8 overflow-x-auto scrollbar-none pb-px">
        {NAV_TABS.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors relative ${
              tab.active
                ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                : "text-slate-500 hover:text-slate-800 hover:border-b-2 hover:border-slate-300"
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge && tab.badge > 0 ? (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-600">
                {tab.badge}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      {/* ── MAIN 2-COLUMN LAYOUT (Gauche 2/3 + Droite 1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ══════ COLONNE PRINCIPALE (2/3) ══════ */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. HERO BANNER CARD (Bleu Roi comme Sango Health) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-6 sm:p-8 text-white shadow-lg shadow-blue-900/10">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between gap-4 mb-4">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md text-white border border-white/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Plateforme Active • Kinshasa RDC
              </span>
              <Calendar className="text-white/70" size={20} />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
              {totalPending > 0
                ? `${totalPending} dossier(s) en attente de validation administrative`
                : "Toutes les validations sont à jour sur la plateforme"}
            </h2>
            <p className="text-blue-100 text-sm max-w-xl mb-6 leading-relaxed">
              {totalPending > 0
                ? "De nouvelles demandes de fournisseurs, biens immobiliers ou produits e-commerce ont été soumises. Examinez-les pour autoriser leur mise en ligne."
                : "Le système est opérationnel. Les rapports d'activité matinale sont programmés pour 07h00 chaque matin."}
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/suppliers"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-blue-900 font-bold text-sm hover:bg-blue-50 transition-colors shadow-sm"
              >
                Examiner les Partenaires
              </Link>
              <button
                onClick={handleTriggerDailyReports}
                disabled={isSendingReports}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold text-sm transition-colors backdrop-blur-xs border border-white/20"
              >
                <Mail size={15} />
                <span>Envoyer Bilan (07h00)</span>
              </button>
            </div>
          </div>

          {/* 2. LES 5 TUILES D'ACTIONS RAPIDES PASTEL (Copie Conforme Sango Health) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* A. Commandes */}
            <Link
              href="/admin/orders"
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-blue-50/90 hover:bg-blue-100/90 border border-blue-100 text-blue-700 transition-all group shadow-2xs hover:-translate-y-0.5 text-center"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-100/80 group-hover:bg-blue-200/80 flex items-center justify-center mb-2 transition-colors">
                <ShoppingCart size={20} className="text-blue-600" />
              </div>
              <span className="text-xs font-bold text-slate-800">Commandes</span>
              <span className="text-[10px] text-blue-600 font-semibold mt-0.5">Mes Ventes</span>
            </Link>

            {/* B. Produits */}
            <Link
              href="/admin/products"
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-purple-50/90 hover:bg-purple-100/90 border border-purple-100 text-purple-700 transition-all group shadow-2xs hover:-translate-y-0.5 text-center"
            >
              <div className="w-11 h-11 rounded-xl bg-purple-100/80 group-hover:bg-purple-200/80 flex items-center justify-center mb-2 transition-colors">
                <Package size={20} className="text-purple-600" />
              </div>
              <span className="text-xs font-bold text-slate-800">Produits</span>
              <span className="text-[10px] text-purple-600 font-semibold mt-0.5">
                {stats.pendingProducts > 0 ? `${stats.pendingProducts} en attente` : "Catalogue"}
              </span>
            </Link>

            {/* C. Immobilier */}
            <Link
              href="/admin/properties"
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-50/90 hover:bg-emerald-100/90 border border-emerald-100 text-emerald-700 transition-all group shadow-2xs hover:-translate-y-0.5 text-center"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-100/80 group-hover:bg-emerald-200/80 flex items-center justify-center mb-2 transition-colors">
                <Building size={20} className="text-emerald-600" />
              </div>
              <span className="text-xs font-bold text-slate-800">Immobilier</span>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                {stats.pendingProperties > 0 ? `${stats.pendingProperties} en attente` : "Biens & Baux"}
              </span>
            </Link>

            {/* D. Fournisseurs */}
            <Link
              href="/admin/suppliers"
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-sky-50/90 hover:bg-sky-100/90 border border-sky-100 text-sky-700 transition-all group shadow-2xs hover:-translate-y-0.5 text-center"
            >
              <div className="w-11 h-11 rounded-xl bg-sky-100/80 group-hover:bg-sky-200/80 flex items-center justify-center mb-2 transition-colors">
                <Store size={20} className="text-sky-600" />
              </div>
              <span className="text-xs font-bold text-slate-800">Fournisseurs</span>
              <span className="text-[10px] text-sky-600 font-semibold mt-0.5">
                {stats.pendingSuppliers > 0 ? `${stats.pendingSuppliers} en attente` : "Partenaires"}
              </span>
            </Link>

            {/* E. Livreurs */}
            <Link
              href="/admin/drivers"
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-amber-50/90 hover:bg-amber-100/90 border border-amber-100 text-amber-700 transition-all group shadow-2xs hover:-translate-y-0.5 text-center"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-100/80 group-hover:bg-amber-200/80 flex items-center justify-center mb-2 transition-colors">
                <Truck size={20} className="text-amber-600" />
              </div>
              <span className="text-xs font-bold text-slate-800">Livreurs</span>
              <span className="text-[10px] text-amber-600 font-semibold mt-0.5">Courses & Flotte</span>
            </Link>
          </div>

          {/* 3. GRILLE DE 4 COMPTEURS MÉTRIQUES ÉPURÉS (Style Sango Health) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
              <p className="text-3xl font-extrabold text-blue-600">
                {dataLoading ? "-" : stats.pendingSuppliers}
              </p>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1.5">
                Fournisseurs en attente
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
              <p className="text-3xl font-extrabold text-emerald-600">
                {dataLoading ? "-" : stats.pendingProperties}
              </p>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1.5">
                Biens immo en attente
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
              <p className="text-3xl font-extrabold text-purple-600">
                {dataLoading ? "-" : stats.pendingProducts}
              </p>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1.5">
                Produits en attente
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
              <p className="text-3xl font-extrabold text-amber-600">
                {dataLoading ? "-" : stats.totalActiveSuppliers}
              </p>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1.5">
                Partenaires Actifs
              </p>
            </div>
          </div>

          {/* 4. CARTES DE VALIDATION DÉTAILLÉES */}
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} />
              Dossiers & Validations Prioritaires
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Validation Fournisseurs */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fournisseurs</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                      <Users size={16} />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900">{dataLoading ? "-" : stats.pendingSuppliers}</span>
                    <span className="text-xs text-slate-500 font-medium">en attente d'accord</span>
                  </div>
                </div>
                <Link href="/admin/suppliers" className="mt-5">
                  <button className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 text-blue-700 text-xs font-bold border border-slate-200/80 hover:border-blue-200 transition-colors flex items-center justify-center gap-1.5">
                    <span>Examiner les comptes</span>
                    <ArrowRight size={13} />
                  </button>
                </Link>
              </div>

              {/* Validation Immo */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Immobilier</span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Building size={16} />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900">{dataLoading ? "-" : stats.pendingProperties}</span>
                    <span className="text-xs text-slate-500 font-medium">biens soumis</span>
                  </div>
                </div>
                <Link href="/admin/properties" className="mt-5">
                  <button className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-emerald-50 text-emerald-700 text-xs font-bold border border-slate-200/80 hover:border-emerald-200 transition-colors flex items-center justify-center gap-1.5">
                    <span>Valider les biens</span>
                    <ArrowRight size={13} />
                  </button>
                </Link>
              </div>

              {/* Validation Produits */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">E-Commerce</span>
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                      <Package size={16} />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-900">{dataLoading ? "-" : stats.pendingProducts}</span>
                    <span className="text-xs text-slate-500 font-medium">articles soumis</span>
                  </div>
                </div>
                <Link href="/admin/products" className="mt-5">
                  <button className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-purple-50 text-purple-700 text-xs font-bold border border-slate-200/80 hover:border-purple-200 transition-colors flex items-center justify-center gap-1.5">
                    <span>Examiner les produits</span>
                    <ArrowRight size={13} />
                  </button>
                </Link>
              </div>
            </div>
          </div>

        </div>


        {/* ══════ COLONNE LATÉRALE DROITE (1/3) (Style Sango Health) ══════ */}
        <div className="space-y-6">
          
          {/* CARTE 1 : "À ne pas oublier" (Style Sango Health avec cloche orange) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
                <Bell size={16} />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">À ne pas oublier</h3>
            </div>

            <div className="space-y-3">
              {stats.pendingSuppliers > 0 && (
                <Link href="/admin/suppliers" className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/60 hover:bg-amber-50 border border-amber-200/60 transition-colors group">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-900 group-hover:text-amber-950">
                      {stats.pendingSuppliers} fournisseur(s) en attente
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Vérifier les pièces d'identité et valider l'accès.
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-amber-500 shrink-0 self-center" />
                </Link>
              )}

              {stats.overdueTenantsCount > 0 && (
                <Link href="/admin/finance" className="flex items-start gap-3 p-3 rounded-xl bg-rose-50/60 hover:bg-rose-50 border border-rose-200/60 transition-colors group">
                  <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-rose-900 group-hover:text-rose-950">
                      {stats.overdueTenantsCount} loyer(s) en retard
                    </p>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      Suivre les recouvrements et notifications locataires.
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-rose-500 shrink-0 self-center" />
                </Link>
              )}

              {stats.pendingProperties > 0 && (
                <Link href="/admin/properties" className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/60 hover:bg-blue-50 border border-blue-200/60 transition-colors group">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-blue-900 group-hover:text-blue-950">
                      {stats.pendingProperties} bien(s) à publier
                    </p>
                    <p className="text-[11px] text-blue-700 mt-0.5">
                      Vérifier les prix et l'éligibilité des logements.
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-blue-500 shrink-0 self-center" />
                </Link>
              )}

              {stats.pendingSuppliers === 0 && stats.overdueTenantsCount === 0 && stats.pendingProperties === 0 && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <CheckCircle size={22} className="text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Aucune alerte urgente</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Tous les dossiers administratifs sont à jour.</p>
                </div>
              )}
            </div>
          </div>

          {/* CARTE 2 : "Performance par Rayon" (Style "Constantes" Sango Health avec coeur rose) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                  <Heart size={16} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Performance par Rayon</h3>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <span className="text-xs font-medium text-slate-700 flex items-center gap-2">
                  <span>🍽️</span> Rayon Saveurs
                </span>
                <span className="text-xs font-bold text-slate-900">Actif</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <span className="text-xs font-medium text-slate-700 flex items-center gap-2">
                  <span>👗</span> Rayon Mode
                </span>
                <span className="text-xs font-bold text-slate-900">Actif</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <span className="text-xs font-medium text-slate-700 flex items-center gap-2">
                  <span>📱</span> Rayon Connect
                </span>
                <span className="text-xs font-bold text-slate-900">Actif</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                <span className="text-xs font-medium text-slate-700 flex items-center gap-2">
                  <span>🏢</span> Rayon Immo
                </span>
                <span className="text-xs font-bold text-emerald-600 font-mono">
                  {stats.totalProperties} biens
                </span>
              </div>
            </div>

            <Link
              href="/admin/finance"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 mt-4 transition-colors"
            >
              <span>Voir toute la comptabilité</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          {/* CARTE 3 : "Rapports & Audit (07h00)" (Style "Carnet de Santé" vert de Sango Health) */}
          <div className="bg-emerald-50/50 rounded-2xl p-6 border border-emerald-200/80 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                <ShieldCheck size={17} />
              </div>
              <h3 className="font-bold text-emerald-950 text-sm">Rapport Journalier Matinal</h3>
            </div>
            
            <p className="text-xs text-emerald-800/80 leading-relaxed mb-4">
              Génération et diffusion automatique programmée chaque matin à <strong>07h00 (heure de Kinshasa)</strong> à tous les fournisseurs et à l'administration.
            </p>

            <button
              onClick={handleTriggerDailyReports}
              disabled={isSendingReports}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
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
