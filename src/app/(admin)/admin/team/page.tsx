"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { 
  Users, 
  ShieldAlert, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Check, 
  X, 
  Plus, 
  Wallet, 
  Database, 
  ShieldCheck, 
  Sparkles, 
  Trash2, 
  UserCheck, 
  Mail, 
  Phone,
  Crown,
  Truck
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot, serverTimestamp, limit } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { isSuperAdmin, hasAdminAccess } from "@/lib/permissions";

interface TeamMember {
  id: string;
  name: string;
  displayName?: string;
  email: string;
  role: string;
  phoneNumber?: string;
  status?: string;
  createdAt?: any;
}

export default function AdminTeamPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [subSuppliers, setSubSuppliers] = useState<any[]>([]);
  const [activeTeamTab, setActiveTeamTab] = useState<"internal" | "sub_agents">("internal");
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Modal creation states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<"SUB_ADMIN" | "ADMIN_FINANCE" | "ADMIN_DB" | "ADMIN_OPS">("SUB_ADMIN");
  const [isCreating, setIsCreating] = useState(false);

  // Search & promote existing user
  const [searchEmail, setSearchEmail] = useState("");
  const [searchedUser, setSearchedUser] = useState<any>(null);
  const [selectedPromoteRole, setSelectedPromoteRole] = useState<"SUB_ADMIN" | "ADMIN_FINANCE" | "ADMIN_DB" | "ADMIN_OPS">("SUB_ADMIN");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const isSuper = isSuperAdmin(user, userData);
  const isAuthorized = hasAdminAccess(user, userData);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (!isAuthorized) {
        router.push("/");
      }
    }
  }, [user, isAuthorized, loading, router]);

  // Real-time listener for internal staff / fonctionnaires
  useEffect(() => {
    if (!user || !isAuthorized) return;

    setIsLoading(true);
    const staffRoles = [
      "SUPER_ADMIN", "superAdmin", "SUPERADMIN",
      "ADMIN_FINANCE", "admin_finance",
      "ADMIN_DB", "admin_db", "ADMIN_TECH",
      "SUB_ADMIN", "sub_admin", "ADMIN_OPS",
      "ADMIN", "admin"
    ];

    const q = query(collection(db, "users"), where("role", "in", staffRoles), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members: TeamMember[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        members.push({
          id: docSnap.id,
          name: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || "Collaborateur",
          email: data.email || "",
          role: data.role || "SUB_ADMIN",
          phoneNumber: data.phoneNumber,
          status: data.status || "active",
          createdAt: data.createdAt,
        });
      });
      // Sort: Super Admins first, then finance, then db, then sub_admins
      members.sort((a, b) => {
        const priority = (role: string) => {
          const r = role.toUpperCase();
          if (r.includes("SUPER")) return 1;
          if (r.includes("FINANCE")) return 2;
          if (r.includes("DB") || r.includes("TECH")) return 3;
          return 4;
        };
        return priority(a.role) - priority(b.role);
      });

      setTeamMembers(members);
      setIsLoading(false);
    }, (err) => {
      console.warn("Team listener warning:", err.message);
      setIsLoading(false);
    });

    // Also fetch pending driver deletion requests
    const qDrivers = query(collection(db, "drivers"), where("status", "==", "pending_deletion"), limit(50));
    const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
      const drivers: any[] = [];
      snapshot.forEach((docSnap) => {
        drivers.push({ id: docSnap.id, ...docSnap.data() });
      });
      setPendingDrivers(drivers);
    }, (err) => {
      console.warn("Pending drivers listener warning:", err.message);
    });

    // Also fetch sub-agents / agency collaborators across all suppliers
    const qSub = query(collection(db, "users"), where("role", "in", ["SUB_SUPPLIER", "sub_supplier"]), limit(100));
    const unsubSub = onSnapshot(qSub, (snapshot) => {
      const subs: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        subs.push({
          id: docSnap.id,
          name: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || "Sous-Agent",
          email: data.email || "",
          phone: data.phone || data.phoneNumber || "",
          role: data.role || "SUB_SUPPLIER",
          parentSupplierId: data.parentSupplierId || data.createdBy || "",
          permissions: Array.isArray(data.permissions) ? data.permissions : [],
          serviceAttached: data.serviceAttached || "immo",
          status: data.status || "active",
          createdAt: data.createdAt,
        });
      });
      setSubSuppliers(subs);
    }, (err) => {
      console.warn("Pending sub-agents listener warning:", err.message);
    });

    return () => {
      unsubscribe();
      unsubDrivers();
      unsubSub();
    };
  }, [user, isAuthorized]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    
    setIsSearching(true);
    setSearchError("");
    setSearchedUser(null);
    
    try {
      const q = query(collection(db, "users"), where("email", "==", searchEmail.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setSearchError("Aucun compte utilisateur trouvé avec cette adresse email.");
      } else {
        const userDoc = querySnapshot.docs[0];
        setSearchedUser({ id: userDoc.id, ...userDoc.data() });
      }
    } catch (error: any) {
      console.error("Error searching user:", error);
      setSearchError("Une erreur s'est produite lors de la recherche.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setIsCreating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) throw new Error("Vous devez être connecté.");

      const displayName = `${newFirstName} ${newLastName}`.trim() || newEmail.split("@")[0];
      const randomPassword = Math.random().toString(36).slice(-10) + "A1@";

      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          password: randomPassword,
          displayName,
          roleToCreate: newRole,
          extraData: {
            isInternalStaff: true,
            roleTitle: getRoleLabel(newRole),
            department: newRole === "ADMIN_FINANCE" ? "Finance & Caisse" : newRole === "ADMIN_DB" ? "Technique & BDD" : newRole === "ADMIN_OPS" ? "Opérations & Livreurs" : "Direction Déléguée"
          },
          notificationMethod: "email",
          phoneNumber: newPhone ? newPhone.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la création du collaborateur.");
      }

      setSuccessMessage(`Le compte fonctionnaire "${displayName}" a été créé avec le rôle ${getRoleLabel(newRole)}. Les identifiants lui ont été transmis.`);
      setIsCreateModalOpen(false);
      setNewFirstName("");
      setNewLastName("");
      setNewEmail("");
      setNewPhone("");
      setNewRole("SUB_ADMIN");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Erreur lors de la création.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleChangeRole = async (userId: string, targetRole: string) => {
    if (!isSuper) {
      alert("Seul le Super Administrateur peut modifier les attributions de l'équipe.");
      return;
    }
    const targetMember = teamMembers.find(m => m.id === userId);
    if (targetMember && (targetMember.email?.toLowerCase() === "danielkiboko218@gmail.com" || targetMember.role?.toUpperCase().includes("SUPER"))) {
      alert("Action interdite : Le Super Administrateur (Directeur Général) ne peut pas être modifié.");
      return;
    }

    setIsUpdating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateDoc(doc(db, "users", userId), {
        role: targetRole,
        isInternalStaff: true,
        updatedAt: serverTimestamp(),
      });
      setSuccessMessage(`Attribution mise à jour avec succès : ${getRoleLabel(targetRole)}.`);
    } catch (err: any) {
      console.error("Error updating role:", err);
      setErrorMessage("Erreur lors de la modification du rôle.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRevokeRole = async (userId: string, userName: string) => {
    if (!isSuper) {
      alert("Seul le Super Administrateur peut révoquer un collaborateur.");
      return;
    }
    const targetMember = teamMembers.find(m => m.id === userId);
    if (targetMember && (targetMember.email?.toLowerCase() === "danielkiboko218@gmail.com" || targetMember.role?.toUpperCase().includes("SUPER"))) {
      alert("Action interdite : Le Super Administrateur (Directeur Général) ne peut pas être révoqué.");
      return;
    }
    if (!confirm(`Voulez-vous vraiment révoquer les accès internes de "${userName}" ? Il redeviendra un utilisateur standard sans droits d'administration.`)) {
      return;
    }

    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "users", userId), {
        role: "CLIENT",
        isInternalStaff: false,
        updatedAt: serverTimestamp(),
      });
      setSuccessMessage(`Les droits d'administration de "${userName}" ont été révoqués.`);
      if (searchedUser && searchedUser.id === userId) {
        setSearchedUser({ ...searchedUser, role: "CLIENT" });
      }
    } catch (err: any) {
      console.error("Error revoking role:", err);
      setErrorMessage("Erreur lors de la révocation.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePromoteSearchedUser = async () => {
    if (!searchedUser) return;
    await handleChangeRole(searchedUser.id, selectedPromoteRole);
    setSearchedUser({ ...searchedUser, role: selectedPromoteRole });
  };

  const handleApproveDeletion = async (driverId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer définitivement ce livreur ?")) return;
    setIsUpdating(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid: driverId, collectionName: 'drivers' })
      });
      if (!res.ok) throw new Error("Erreur lors de la suppression backend");
      setSuccessMessage("Livreur supprimé avec succès.");
    } catch (error: any) {
      console.error("Error deleting driver:", error);
      setErrorMessage(error.message || "Erreur lors de la suppression.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRejectDeletion = async (driverId: string) => {
    if (!confirm("Voulez-vous annuler la demande et réactiver ce livreur ?")) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "drivers", driverId), { status: "active" });
      await updateDoc(doc(db, "users", driverId), { status: "active" });
      setSuccessMessage("Livreur réactivé avec succès.");
    } catch (error: any) {
      console.error("Error rejecting deletion:", error);
      setErrorMessage("Erreur lors de la réactivation.");
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const r = (role || "").toUpperCase();
    if (r.includes("SUPER")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
          <Crown size={14} className="text-amber-400" />
          <span>Super Administrateur</span>
        </span>
      );
    }
    if (r === "SUB_ADMIN" || r === "ADMIN" || r === "SUBADMIN") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
          <ShieldCheck size={14} className="text-indigo-400" />
          <span>Sous-Administrateur Général</span>
        </span>
      );
    }
    if (r.includes("FINANCE")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
          <Wallet size={14} className="text-emerald-400" />
          <span>Gestionnaire Finance</span>
        </span>
      );
    }
    if (r.includes("DB") || r.includes("TECH")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
          <Database size={14} className="text-cyan-400" />
          <span>Gestionnaire Données & Catalogue</span>
        </span>
      );
    }
    if (r.includes("OPS")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
          <Truck size={14} className="text-blue-400" />
          <span>Gestionnaire Opérations & Livreurs</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
        <ShieldCheck size={14} className="text-purple-400" />
        <span>Sous-Administrateur Délégué</span>
      </span>
    );
  };

  const getRoleLabel = (role: string) => {
    const r = (role || "").toUpperCase();
    if (r.includes("SUPER")) return "Super Administrateur";
    if (r === "SUB_ADMIN" || r === "ADMIN" || r === "SUBADMIN") return "Sous-Administrateur Général (Adjoint)";
    if (r.includes("FINANCE")) return "Gestionnaire Finance & Caisse";
    if (r.includes("DB") || r.includes("TECH")) return "Gestionnaire Base de Données & Catalogue";
    if (r.includes("OPS")) return "Gestionnaire Opérations & Livreurs";
    return "Sous-Administrateur";
  };

  const superAdminCount = teamMembers.filter(m => m.role?.toUpperCase().includes("SUPER")).length;
  const subAdminCount = teamMembers.filter(m => m.role === "SUB_ADMIN" || m.role === "ADMIN" || m.role === "SUBADMIN").length;
  const financeCount = teamMembers.filter(m => m.role?.toUpperCase().includes("FINANCE")).length;
  const dbCount = teamMembers.filter(m => m.role?.toUpperCase().includes("DB") || m.role?.toUpperCase().includes("TECH")).length;
  const opsCount = teamMembers.filter(m => m.role?.toUpperCase().includes("OPS")).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="text-indigo-400" /> 
            <span>Équipe Interne & Fonctionnaires</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Gérez vos collaborateurs internes (Finance, Base de données, Modération). Ces membres sont des fonctionnaires de la plateforme : <strong>ils ne paient aucun abonnement et n'apparaissent pas dans les fournisseurs</strong>.
          </p>
        </div>
        {isSuper && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-600/25 transition-all text-sm shrink-0"
          >
            <Plus size={18} />
            <span>Nouveau Collaborateur</span>
          </button>
        )}
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-400 shrink-0" />
            <span className="text-sm">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage("")} className="text-green-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle size={18} className="text-red-400 shrink-0" />
            <span className="text-sm">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage("")} className="text-red-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">Total Staff Interne</p>
            <p className="text-2xl font-bold text-white mt-1">{teamMembers.length}</p>
          </div>
          <div className="p-3 bg-white/10 text-gray-300 rounded-xl">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-300 font-medium">💼 Finance & Caisse</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{financeCount}</p>
          </div>
          <div className="p-3 bg-emerald-500/20 text-emerald-300 rounded-xl">
            <Wallet size={20} />
          </div>
        </div>

        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-cyan-300 font-medium">🗄️ Base de Données & Logs</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{dbCount}</p>
          </div>
          <div className="p-3 bg-cyan-500/20 text-cyan-300 rounded-xl">
            <Database size={20} />
          </div>
        </div>

        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-purple-300 font-medium">📦 Modération & Opérations</p>
            <p className="text-2xl font-bold text-purple-400 mt-1">{opsCount}</p>
          </div>
          <div className="p-3 bg-purple-500/20 text-purple-300 rounded-xl">
            <ShieldCheck size={20} />
          </div>
        </div>
      </div>

      {/* Navigation Tabs between Internal Staff and Sub-Agents */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTeamTab("internal")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTeamTab === "internal"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "text-gray-400 hover:text-white bg-white/5"
          }`}
        >
          <Users size={16} />
          <span>Fonctionnaires Rayons ({teamMembers.length})</span>
        </button>
        <button
          onClick={() => setActiveTeamTab("sub_agents")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTeamTab === "sub_agents"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
              : "text-gray-400 hover:text-white bg-white/5"
          }`}
        >
          <ShieldCheck size={16} />
          <span>Sous-Agents Partenaires & Immo ({subSuppliers.length})</span>
        </button>
      </div>

      {/* Main Staff Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              {activeTeamTab === "internal" ? "Fonctionnaires & Collaborateurs Internes" : "Sous-Agents & Délégués des Agences Partenaires"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeTeamTab === "internal" 
                ? "Membres ayant accès aux modules du panneau d'administration selon leur fonction." 
                : "Collaborateurs et agents créés par les fournisseurs immobiliers et partenaires pour gérer leurs opérations."}
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-gray-300">
            {activeTeamTab === "internal" ? teamMembers.length : subSuppliers.length} membre{((activeTeamTab === "internal" ? teamMembers.length : subSuppliers.length) > 1) ? "s" : ""}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs uppercase bg-black/30 text-gray-400 tracking-wider">
              {activeTeamTab === "internal" ? (
                <tr>
                  <th className="px-6 py-4 font-semibold">Collaborateur</th>
                  <th className="px-6 py-4 font-semibold">Attribution Interne</th>
                  <th className="px-6 py-4 font-semibold">Périmètre d'Accès</th>
                  <th className="px-6 py-4 font-semibold">Statut</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-4 font-semibold">Sous-Agent</th>
                  <th className="px-6 py-4 font-semibold">Rayon & Type</th>
                  <th className="px-6 py-4 font-semibold">Modules Autorisés</th>
                  <th className="px-6 py-4 font-semibold">Statut</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span>Chargement...</span>
                    </div>
                  </td>
                </tr>
              ) : activeTeamTab === "internal" ? (
                teamMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      Aucun collaborateur interne configuré.
                    </td>
                  </tr>
                ) : (
                  teamMembers.map((member) => {
                    const isMemberSuperAdmin = member.role?.toUpperCase().includes("SUPER");
                    return (
                      <tr key={member.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                              isMemberSuperAdmin
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : member.role?.toUpperCase().includes("FINANCE")
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : member.role?.toUpperCase().includes("DB")
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            }`}>
                              {isMemberSuperAdmin ? "👑" : member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-white">{member.name}</p>
                              <p className="text-xs text-gray-400">{member.email}</p>
                              {member.phoneNumber && (
                                <p className="text-[11px] text-gray-500 mt-0.5">{member.phoneNumber}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getRoleBadge(member.role)}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-300">
                          {isMemberSuperAdmin && "Directeur Général : Tous les modules, paramètres & privilèges système complets"}
                          {!isMemberSuperAdmin && (member.role === "SUB_ADMIN" || member.role === "ADMIN" || member.role === "SUBADMIN") && "Sous-Administrateur Général : Accès complet au dashboard, gestion des fournisseurs & validation"}
                          {member.role?.toUpperCase().includes("FINANCE") && "Caisse, Écritures comptables, Trésorerie, Factures & Dépôts"}
                          {member.role?.toUpperCase().includes("DB") && "Santé de l'app, Audits des collections, Erreurs système & Données"}
                          {member.role?.toUpperCase().includes("OPS") && "Flotte de livreurs, Attribution des courses & Suivi des commandes"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Actif
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {isSuper && !isMemberSuperAdmin ? (
                            <div className="inline-flex items-center gap-2">
                              {/* Role Switcher */}
                              <select
                                value={member.role}
                                onChange={(e) => handleChangeRole(member.id, e.target.value)}
                                disabled={isUpdating}
                                className="text-xs bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-gray-300 focus:outline-none focus:border-indigo-500 [&>option]:bg-[#140b2e]"
                              >
                                <option value="SUB_ADMIN">🛡️ Sous-Administrateur Général</option>
                                <option value="ADMIN_FINANCE">💼 Finance & Caisse</option>
                                <option value="ADMIN_DB">🗄️ Base de Données</option>
                                <option value="ADMIN_OPS">🚚 Opérations & Livreurs</option>
                              </select>

                              <button
                                onClick={() => handleRevokeRole(member.id, member.name)}
                                disabled={isUpdating}
                                title="Révoquer tous les droits internes"
                                className="text-xs text-red-400 hover:text-white hover:bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-500/30 transition-all font-medium"
                              >
                                Révoquer
                              </button>
                            </div>
                          ) : isMemberSuperAdmin ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-semibold px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              👑 Propriétaire Système (Intouchable)
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )
              ) : (
                /* SUB-AGENTS TAB BODY */
                subSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      Aucun sous-agent ou délégué fournisseur enregistré pour l'instant.
                    </td>
                  </tr>
                ) : (
                  subSuppliers.map((sub) => {
                    const isSubActive = sub.status === "active";
                    return (
                      <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                              {(sub.name || "A").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-white">{sub.name}</p>
                              <p className="text-xs text-gray-400">{sub.email}</p>
                              {sub.phone && (
                                <p className="text-[11px] text-gray-500 mt-0.5">{sub.phone}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20 w-max">
                              <span>🏠</span>
                              <span className="capitalize">{sub.serviceAttached || "Immobilier"}</span>
                            </span>
                            <span className="text-[11px] text-gray-500">
                              Rattaché à un fournisseur partenaire
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-300">
                          {sub.permissions && sub.permissions.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {sub.permissions.map((p: string) => (
                                <span key={p} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[11px] text-gray-300">
                                  {p.replace('/supplier/', '')}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500 italic">Accès standard délégué</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            isSubActive 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isSubActive ? "bg-emerald-400" : "bg-amber-400"}`} />
                            {isSubActive ? "Actif" : "Suspendu"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={async () => {
                                setIsUpdating(true);
                                try {
                                  await updateDoc(doc(db, "users", sub.id), {
                                    status: isSubActive ? "suspended" : "active"
                                  });
                                  setSuccessMessage("Statut du sous-agent mis à jour.");
                                } catch (err) {
                                  setErrorMessage("Erreur lors de la mise à jour.");
                                } finally {
                                  setIsUpdating(false);
                                }
                              }}
                              disabled={isUpdating}
                              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                                isSubActive
                                  ? "text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                                  : "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                              }`}
                            >
                              {isSubActive ? "Suspendre" : "Activer"}
                            </button>

                            {isSuper && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Supprimer définitivement le sous-agent "${sub.name}" ?`)) return;
                                  setIsUpdating(true);
                                  try {
                                    const token = await auth.currentUser?.getIdToken();
                                    await fetch("/api/users/delete", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                      body: JSON.stringify({ uid: sub.id })
                                    });
                                    setSuccessMessage("Sous-agent supprimé avec succès.");
                                  } catch (err: any) {
                                    setErrorMessage("Erreur lors de la suppression.");
                                  } finally {
                                    setIsUpdating(false);
                                  }
                                }}
                                disabled={isUpdating}
                                className="text-xs text-red-400 hover:text-white hover:bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-500/30 transition-all font-medium"
                              >
                                Supprimer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Promote Existing User by Search */}
      {isSuper && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UserCheck className="text-indigo-400" size={18} />
              <span>Promouvoir un utilisateur existant en fonctionnaire interne</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Recherchez un compte déjà inscrit sur Rayon par son adresse email pour lui confier une fonction administrative (Finance, BDD, etc.).
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="email"
                required
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Email de l'utilisateur (ex: collaborateur@rayons.net)"
                className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-50 shrink-0 flex items-center justify-center gap-2"
            >
              {isSearching ? "Recherche..." : "Rechercher"}
            </button>
          </form>

          {searchError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <XCircle size={14} /> {searchError}
            </p>
          )}

          {searchedUser && (
            <div className="p-4 bg-white/5 border border-white/15 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
              <div>
                <p className="font-bold text-white text-sm">{searchedUser.displayName || searchedUser.email}</p>
                <p className="text-xs text-gray-400">{searchedUser.email}</p>
                <p className="text-xs text-indigo-300 mt-1">Rôle actuel : <strong>{searchedUser.role || "CLIENT"}</strong></p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedPromoteRole}
                  onChange={(e: any) => setSelectedPromoteRole(e.target.value)}
                  className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 [&>option]:bg-[#140b2e]"
                >
                  <option value="SUB_ADMIN">🛡️ Nommer Sous-Administrateur Général (Accès complet)</option>
                  <option value="ADMIN_FINANCE">💼 Nommer Gestionnaire Finance</option>
                  <option value="ADMIN_DB">🗄️ Nommer Gestionnaire Base de Données</option>
                  <option value="ADMIN_OPS">🚚 Nommer Gestionnaire Opérations & Livreurs</option>
                </select>
                <button
                  onClick={handlePromoteSearchedUser}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shrink-0"
                >
                  {isUpdating ? "Enregistrement..." : "Attribuer la fonction"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending Drivers Deletion Requests */}
      {pendingDrivers.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-orange-500/20 border-b border-orange-500/30 flex items-center gap-2 text-orange-300">
            <AlertTriangle size={18} />
            <h3 className="font-bold text-sm text-white">Demandes de suppression de livreurs en attente ({pendingDrivers.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-xs uppercase bg-black/30 text-gray-400">
                <tr>
                  <th className="px-6 py-3 font-semibold">Livreur</th>
                  <th className="px-6 py-3 font-semibold">Demandeur</th>
                  <th className="px-6 py-3 font-semibold text-right">Décision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pendingDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3 font-medium text-white">
                      <p>{driver.displayName || "Sans nom"}</p>
                      <p className="text-xs text-gray-400">{driver.email}</p>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-400">
                      {driver.supplierId === "admin" ? "Admin" : driver.supplierId}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleRejectDeletion(driver.id)}
                        disabled={isUpdating}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg text-xs font-bold mr-2"
                      >
                        Refuser
                      </button>
                      <button
                        onClick={() => handleApproveDeletion(driver.id)}
                        disabled={isUpdating}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold"
                      >
                        Approuver la suppression
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create New Collaborator */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#140b2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#140b2e]">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users size={20} className="text-indigo-400" />
                    <span>Créer un Fonctionnaire Interne</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Ce membre intégrera votre équipe administrative sans aucun abonnement commercial.
                  </p>
                </div>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateTeamMember} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-300">Prénom</label>
                    <input
                      type="text"
                      required
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="Ex: Jean"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-300">Nom</label>
                    <input
                      type="text"
                      required
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      placeholder="Ex: Kabeya"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-300">Email professionnel</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Ex: finance@rayons.net ou collaborateur@gmail.com"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-300">Téléphone (Optionnel)</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Ex: +243 81 000 0000"
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Role selection cards */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                    Attribution / Fonction dans l'application <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-2.5">
                    {/* Sous-Admin Général */}
                    <div
                      onClick={() => setNewRole("SUB_ADMIN")}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        newRole === "SUB_ADMIN"
                          ? "bg-indigo-500/20 border-indigo-500 text-white shadow-md shadow-indigo-500/10"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                          <ShieldCheck size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">🛡️ Sous-Administrateur Général (Adjoint)</p>
                          <p className="text-xs text-gray-400">Accès complet à tous les modules : Fournisseurs, Produits, Commandes, Finances & Opérations</p>
                        </div>
                      </div>
                      {newRole === "SUB_ADMIN" && <CheckCircle2 size={18} className="text-indigo-400 shrink-0" />}
                    </div>

                    {/* Finance */}
                    <div
                      onClick={() => setNewRole("ADMIN_FINANCE")}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        newRole === "ADMIN_FINANCE"
                          ? "bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                          <Wallet size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">💼 Gestionnaire de Finance</p>
                          <p className="text-xs text-gray-400">Comptabilité, écritures de caisse, trésorerie & factures</p>
                        </div>
                      </div>
                      {newRole === "ADMIN_FINANCE" && <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
                    </div>

                    {/* DB */}
                    <div
                      onClick={() => setNewRole("ADMIN_DB")}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        newRole === "ADMIN_DB"
                          ? "bg-cyan-500/15 border-cyan-500 text-white shadow-md shadow-cyan-500/10"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                          <Database size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">🗄️ Gestionnaire de Base de Données</p>
                          <p className="text-xs text-gray-400">Santé de l'application, données utilisateurs, logs & maintenance technique</p>
                        </div>
                      </div>
                      {newRole === "ADMIN_DB" && <CheckCircle2 size={18} className="text-cyan-400 shrink-0" />}
                    </div>

                    {/* Ops / Livreurs */}
                    <div
                      onClick={() => setNewRole("ADMIN_OPS")}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        newRole === "ADMIN_OPS"
                          ? "bg-blue-500/15 border-blue-500 text-white shadow-md shadow-blue-500/10"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-400">
                          <Truck size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">🚚 Gestionnaire Opérations & Livreurs</p>
                          <p className="text-xs text-gray-400">Attribution des courses, suivi flotte de livreurs & livraisons en temps réel</p>
                        </div>
                      </div>
                      {newRole === "ADMIN_OPS" && <CheckCircle2 size={18} className="text-blue-400 shrink-0" />}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isCreating}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    {isCreating ? "Création en cours..." : "Créer le compte fonctionnaire"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
