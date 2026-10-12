"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  Loader2, UserPlus, Shield, Check, Users, Trash2, 
  Mail, Phone, Clock, AlertCircle, Sparkles, CheckCircle2, UserCheck
} from "lucide-react";
import { themeConfig } from "@/lib/themeConfig";
import { getSupplierType } from "@/lib/permissions";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, limit } from "firebase/firestore";
import toast from "react-hot-toast";

interface SubAgentMember {
  id: string;
  uid?: string;
  displayName?: string;
  name?: string;
  email: string;
  phone?: string;
  phoneNumber?: string;
  role?: string;
  permissions?: string[];
  serviceAttached?: string;
  status?: string;
  createdAt?: any;
}

export default function SupplierTeamPage() {
  const { user, userData } = useAuth();
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [teamMembers, setTeamMembers] = useState<SubAgentMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    notificationMethod: "email" as "email" | "sms",
    phoneNumber: "",
  });

  const [permissions, setPermissions] = useState<string[]>([]);

  const service = userData ? getSupplierType(userData) : "default";
  const theme = themeConfig[service] || themeConfig["default"];

  // Filter out Dashboard and Settings/Billing to only show assignable permissions
  const assignableMenus = theme.menu.filter(
    (item) => !["/supplier", "/supplier/billing", "/supplier/settings", "/supplier/team"].includes(item.href)
  );

  // Real-time listener for sub-agents
  useEffect(() => {
    if (!user) return;
    setLoadingTeam(true);

    const q = query(
      collection(db, "users"),
      where("parentSupplierId", "==", user.uid),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members: SubAgentMember[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        members.push({
          id: docSnap.id,
          uid: data.uid || docSnap.id,
          displayName: data.displayName || data.name || "Collaborateur",
          name: data.displayName || data.name || "Collaborateur",
          email: data.email || "",
          phone: data.phone || data.phoneNumber || "",
          role: data.role || "SUB_SUPPLIER",
          permissions: Array.isArray(data.permissions) ? data.permissions : [],
          serviceAttached: data.serviceAttached || service,
          status: data.status || "active",
          createdAt: data.createdAt,
        });
      });

      members.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });

      setTeamMembers(members);
      setLoadingTeam(false);
    }, (err) => {
      console.warn("Erreur écoute sous-agents :", err);
      setLoadingTeam(false);
    });

    return () => unsubscribe();
  }, [user, service]);

  if (!userData) return null;

  const togglePermission = (href: string) => {
    setPermissions((prev) =>
      prev.includes(href) ? prev.filter((p) => p !== href) : [...prev, href]
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleToggleStatus = async (member: SubAgentMember) => {
    const newStatus = member.status === "active" ? "suspended" : "active";
    setLoadingAction(member.id);
    try {
      const memberRef = doc(db, "users", member.id);
      await updateDoc(memberRef, { status: newStatus });
      toast.success(newStatus === "active" ? "Accès réactivé avec succès" : "Accès suspendu");
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur lors de la modification du statut");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteMember = async (member: SubAgentMember) => {
    if (!confirm(`Confirmez-vous la révocation et suppression de ${member.displayName || member.email} ?`)) {
      return;
    }

    setLoadingAction(member.id);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: member.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la suppression");

      toast.success("Collaborateur révoqué avec succès");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors de la suppression");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          displayName: formData.name.trim(),
          roleToCreate: "SUB_SUPPLIER",
          extraData: {
            parentSupplierId: user?.uid,
            permissions,
            serviceAttached: service,
            phone: formData.notificationMethod === "sms" ? formData.phoneNumber.trim() : undefined,
          },
          notificationMethod: formData.notificationMethod,
          phoneNumber: formData.notificationMethod === "sms" ? formData.phoneNumber.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la création");

      if (formData.notificationMethod === "email") {
        const { getAuth, sendPasswordResetEmail } = await import("firebase/auth");
        const auth = getAuth();
        await sendPasswordResetEmail(auth, formData.email).catch(console.error);
      }

      toast.success(`Collaborateur créé avec succès. ${formData.notificationMethod === "email" ? "Un e-mail d'activation a été envoyé." : "Un SMS avec les accès a été envoyé."}`);
      setFormData({ name: "", email: "", password: "", notificationMethod: "email", phoneNumber: "" });
      setPermissions([]);
      setActiveTab("list");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getMenuTitleByHref = (href: string) => {
    const item = theme.menu.find((m) => m.href === href);
    return item?.title || href.replace("/supplier/", "");
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Users size={24} />
            </div>
            <span>Équipe & Sous-Agents</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-gray-300">
              {teamMembers.length} {teamMembers.length > 1 ? "collaborateurs" : "collaborateur"}
            </span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Gérez vos agents délégués, courtiers, gestionnaires et collaborateurs autorisés à opérer pour votre agence.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-white/5 border border-white/10 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "list"
                ? "bg-primary text-white shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Users size={16} />
            <span>Membres ({teamMembers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === "create"
                ? "bg-primary text-white shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <UserPlus size={16} />
            <span>Ajouter un agent</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: LISTE DES SOUS-AGENTS ── */}
      {activeTab === "list" && (
        <div className="space-y-6">
          {loadingTeam ? (
            <div className="p-12 text-center bg-[#142430] border border-white/10 rounded-2xl">
              <Loader2 size={32} className="animate-spin text-[#C7D300] mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Chargement des sous-agents de votre agence...</p>
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="p-12 text-center bg-[#142430] border border-white/10 rounded-2xl">
              <div className="w-16 h-16 bg-[#C7D300]/10 text-[#C7D300] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#C7D300]/20">
                <Users size={32} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Aucun sous-agent pour le moment</h3>
              <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
                Déléguez la gestion de vos biens immobiliers, la prise de rendez-vous de visites ou les commandes à vos collaborateurs avec des accès personnalisés.
              </p>
              <button
                onClick={() => setActiveTab("create")}
                className="inline-flex items-center gap-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] px-5 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-[#C7D300]/20 cursor-pointer"
              >
                <UserPlus size={18} />
                <span>Créer un premier sous-agent</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teamMembers.map((member) => {
                const isActive = member.status === "active";
                const isOperating = loadingAction === member.id;

                return (
                  <div
                    key={member.id}
                    className="bg-[#142430] border border-white/10 hover:border-white/20 transition-all rounded-2xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top row: Name, Avatar, Status */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/30 to-purple-600/30 border border-primary/40 flex items-center justify-center text-white font-bold text-base uppercase">
                            {(member.displayName || member.name || "A").slice(0, 2)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-white text-base leading-tight">
                              {member.displayName || member.name}
                            </h3>
                            <span className="inline-block mt-0.5 text-xs text-blue-400 font-medium">
                              Sous-Agent Délégué
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium border flex items-center gap-1.5 ${
                            isActive
                              ? "bg-green-500/10 border-green-500/30 text-green-400"
                              : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-green-400" : "bg-amber-400"
                            }`}
                          />
                          {isActive ? "Actif" : "Suspendu"}
                        </span>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-1.5 mb-4 text-xs text-gray-300">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-gray-500 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                        {member.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-gray-500 shrink-0" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                        {member.createdAt && (
                          <div className="flex items-center gap-2 text-gray-500">
                            <Clock size={14} className="shrink-0" />
                            <span>
                              Ajouté le{" "}
                              {new Date(
                                member.createdAt?.seconds
                                  ? member.createdAt.seconds * 1000
                                  : member.createdAt
                              ).toLocaleDateString("fr-FR")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Permissions Assigned */}
                      <div className="pt-3 border-t border-gray-800/80 mb-4">
                        <p className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1.5">
                          <Shield size={13} className="text-amber-400" />
                          <span>Modules autorisés :</span>
                        </p>
                        {member.permissions && member.permissions.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {member.permissions.map((perm) => (
                              <span
                                key={perm}
                                className="text-[11px] px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-gray-300 font-medium"
                              >
                                {getMenuTitleByHref(perm)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500 italic">
                            Accès complet par défaut à l'espace agence
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="pt-3 border-t border-gray-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleToggleStatus(member)}
                        disabled={isOperating}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50 ${
                          isActive
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                            : "bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20"
                        }`}
                      >
                        {isOperating ? "Action..." : isActive ? "Suspendre l'accès" : "Réactiver l'accès"}
                      </button>

                      <button
                        onClick={() => handleDeleteMember(member)}
                        disabled={isOperating}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        title="Révoquer définitivement ce collaborateur"
                      >
                        <Trash2 size={13} />
                        <span>Révoquer</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: FORMULAIRE D'AJOUT D'UN SOUS-AGENT ── */}
      {activeTab === "create" && (
        <div className="bg-[#142430] border border-white/10 p-6 rounded-2xl shadow-xl">
          <div className="border-b border-white/10 pb-4 mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <UserPlus size={18} className="text-[#C7D300]" />
              <span>Nouveau Collaborateur / Sous-Agent</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Renseignez les informations de connexion et cochez les sections auxquelles ce collaborateur aura accès.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Nom complet</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full bg-black border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                  placeholder="Ex: David Mukendi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Adresse Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-black border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                  placeholder="agent@agence.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Mot de passe provisoire</label>
                <input
                  type="text"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full bg-black border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                  placeholder="••••••••"
                  minLength={6}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Le collaborateur pourra modifier son mot de passe lors de sa première connexion.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Numéro de téléphone (Contact direct)</label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="+243 81 000 0000"
                  className="w-full bg-black border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>
            </div>

            {/* Notification Method */}
            <div className="space-y-3 pt-4 border-t border-gray-800">
              <h3 className="text-sm font-semibold text-white">Mode de transmission des accès</h3>
              <div className="flex gap-6">
                <label className="flex items-center space-x-2 text-white cursor-pointer">
                  <input
                    type="radio"
                    name="notificationMethod"
                    value="email"
                    checked={formData.notificationMethod === "email"}
                    onChange={() => setFormData({ ...formData, notificationMethod: "email" })}
                    className="text-primary focus:ring-primary bg-black border-gray-800"
                  />
                  <span className="text-sm">Par Email (Lien de réinitialisation sécurisé)</span>
                </label>
                <label className="flex items-center space-x-2 text-white cursor-pointer">
                  <input
                    type="radio"
                    name="notificationMethod"
                    value="sms"
                    checked={formData.notificationMethod === "sms"}
                    onChange={() => setFormData({ ...formData, notificationMethod: "sms" })}
                    className="text-primary focus:ring-primary bg-black border-gray-800"
                  />
                  <span className="text-sm">Par SMS (Identifiant et mot de passe par SMS)</span>
                </label>
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-3 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Shield size={16} className="text-amber-400" />
                  <span>Modules & Permissions accordées</span>
                </h3>
                <span className="text-xs text-gray-400">
                  {permissions.length} sélectionné(s)
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Sélectionnez les pages auxquelles votre sous-agent aura accès. S'il n'y a aucune sélection, l'accès sera limité à la consultation standard.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {assignableMenus.map((item) => {
                  const isSelected = permissions.includes(item.href);
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.href}
                      onClick={() => togglePermission(item.href)}
                      className={`cursor-pointer p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 text-white shadow-sm"
                          : "border-gray-800 bg-black/40 text-gray-400 hover:border-gray-700"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                          isSelected ? "border-primary bg-primary text-white" : "border-gray-700"
                        }`}
                      >
                        {isSelected && <Check size={13} className="text-white" />}
                      </div>
                      <Icon size={18} className={isSelected ? "text-primary-light" : "text-gray-500"} />
                      <span className="font-medium text-xs">{item.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className="px-5 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-primary-light text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-primary/25 text-sm"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                <span>Créer le sous-agent</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
