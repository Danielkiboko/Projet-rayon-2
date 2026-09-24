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
  Send
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
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
          `✅ Rapports journaliers envoyés avec succès !\n` +
          `• Fournisseurs notifiés : ${data.suppliersNotified}\n` +
          `• Rapport consolidé envoyé par email à : ${data.adminEmails?.join(", ")}\n` +
          `• Volume d'affaires du jour : ${data.metrics?.totalGlobalTurnover?.toLocaleString("fr-FR")} $`
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

        // 2. Pending & active properties (limited to 100 most recent)
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

        // 3. Pending & active products (limited to 100 most recent)
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
    };
  }, [user, userData, isAuthorized]);

  if (loading || !user || !isAuthorized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-white flex flex-col items-center">
          <ShieldAlert size={48} className="text-gray-500 mb-4 animate-pulse" />
          <p>Vérification des accès sécurisés...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Centre de Régulation</h2>
          <p className="text-gray-400 mt-1 text-sm">Gérez les accès, validez les comptes et suivez l'activité journalière.</p>
        </div>
        <button
          onClick={handleTriggerDailyReports}
          disabled={isSendingReports}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg transition-all disabled:opacity-50 shrink-0"
        >
          <Mail size={16} className={isSendingReports ? "animate-spin" : ""} />
          <span>{isSendingReports ? "Envoi des rapports en cours..." : "Envoyer les Rapports Journaliers (17h)"}</span>
        </button>
      </div>

      {/* SECTION VALIDATION */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <AlertTriangle className="text-blue-500 mr-2" size={20} />
          En attente de validation
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Validation Fournisseurs */}
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-blue-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
            <h4 className="text-sm font-semibold text-gray-300 flex justify-between">
              Comptes Fournisseurs
              <Users size={16} className="text-blue-500" />
            </h4>
            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-white">{dataLoading ? "-" : stats.pendingSuppliers}</span>
              <span className="text-sm text-gray-500">en attente</span>
            </div>
            <Link href="/admin/suppliers">
              <button className="mt-6 w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-medium rounded-lg text-sm transition-colors border border-blue-500/20">
                Examiner les comptes
              </button>
            </Link>
          </div>

          {/* Validation Immo — géré par les agents SUPPLIER_IMMO */}
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-blue-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
            <h4 className="text-sm font-semibold text-gray-300 flex justify-between">
              Agents Immo
              <Building size={16} className="text-blue-500" />
            </h4>
            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-white">{dataLoading ? "-" : stats.pendingProperties}</span>
              <span className="text-sm text-gray-500">biens en attente</span>
            </div>
            <Link href="/admin/suppliers">
              <button className="mt-6 w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-medium rounded-lg text-sm transition-colors border border-blue-500/20">
                Gérer les agents
              </button>
            </Link>
          </div>

          {/* Validation Mode */}
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-blue-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
            <h4 className="text-sm font-semibold text-gray-300 flex justify-between">
              Produits E-commerce
              <Package size={16} className="text-blue-500" />
            </h4>
            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-4xl font-bold text-white">{dataLoading ? "-" : stats.pendingProducts}</span>
              <span className="text-sm text-gray-500">en attente</span>
            </div>
            <Link href="/admin/products">
              <button className="mt-6 w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 font-medium rounded-lg text-sm transition-colors border border-blue-500/20">
                Examiner les produits
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION VUE GLOBALE MULTI-RAYONS */}
      <div className="pt-8 border-t border-white/5">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Activity className="text-blue-500 mr-2" size={20} />
          Activité sur la Plateforme
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-[#1a1a1a] p-5 rounded-2xl shadow-sm border border-white/5 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <CheckCircle className="text-blue-500" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{dataLoading ? "-" : stats.totalActiveSuppliers}</p>
              <p className="text-sm text-gray-400">Fournisseurs Actifs</p>
            </div>
          </div>
          
          <div className="bg-[#1a1a1a] p-5 rounded-2xl shadow-sm border border-white/5 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Building className="text-blue-500" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{dataLoading ? "-" : stats.totalProperties}</p>
              <p className="text-sm text-gray-400">Biens en Ligne</p>
            </div>
          </div>

          <div className="bg-[#1a1a1a] p-5 rounded-2xl shadow-sm border border-white/5 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Package className="text-blue-500" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{dataLoading ? "-" : stats.totalProducts}</p>
              <p className="text-sm text-gray-400">Produits en Ligne</p>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
