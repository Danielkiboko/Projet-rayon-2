"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Bell,
  Smartphone,
  Send,
  Megaphone,
  Gift,
  Briefcase,
  UserCheck,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  Layers,
  Tag,
  ExternalLink,
  Download,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

type CampaignType = "COMMUNIQUE" | "PROMO_CLIENT" | "PROMO_PRO_ADMIN" | "PERSONALIZED";

type AudienceType =
  | "ALL"
  | "CLIENTS"
  | "SUPPLIERS_ALL"
  | "SUPPLIERS_IMMO"
  | "SUPPLIERS_MODE"
  | "SUPPLIERS_CONNECT"
  | "SUPPLIERS_SAVEURS"
  | "PARTNERS"
  | "DRIVERS"
  | "ADMINS"
  | "SINGLE_USER";

interface TelemetryData {
  installedAppsCount: number;
  totalDevicesCount: number;
  pushEnabledDevicesCount: number;
  byPlatform: { android: number; ios: number; desktop: number };
  byAudience: {
    clients: number;
    suppliers: number;
    partners: number;
    drivers: number;
    admins: number;
  };
}

interface DeviceItem {
  deviceId: string;
  boundUid: string | null;
  boundName: string;
  boundEmail: string;
  boundRole: string;
  osPlatform: string;
  isInstalledApp: boolean;
  pushEnabled: boolean;
  hasFcmToken: boolean;
  updatedAt: string;
}

interface DirectoryUser {
  uid: string;
  name: string;
  email: string;
  role: string;
  rayon: string;
  hasInstalledApp: boolean;
}

interface CampaignRecord {
  id: string;
  campaignType: CampaignType;
  audience: AudienceType;
  title: string;
  message: string;
  promoCode: string | null;
  discountLabel: string | null;
  link: string;
  notifiedUsersCount: number;
  pushedDevicesCount: number;
  sentBy: string;
  sentAt: string;
}

export default function AdminPushCenterPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"compose" | "devices" | "history">("compose");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const [telemetry, setTelemetry] = useState<TelemetryData>({
    installedAppsCount: 0,
    totalDevicesCount: 0,
    pushEnabledDevicesCount: 0,
    byPlatform: { android: 0, ios: 0, desktop: 0 },
    byAudience: { clients: 0, suppliers: 0, partners: 0, drivers: 0, admins: 0 },
  });
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [usersDirectory, setUsersDirectory] = useState<DirectoryUser[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);

  // Compose Form State
  const [campaignType, setCampaignType] = useState<CampaignType>("COMMUNIQUE");
  const [audience, setAudience] = useState<AudienceType>("ALL");
  const [targetUid, setTargetUid] = useState<string>("");
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [discountLabel, setDiscountLabel] = useState<string>("");
  const [promoCode, setPromoCode] = useState<string>("");
  const [link, setLink] = useState<string>("/");

  // Devices filter state
  const [devicePlatformFilter, setDevicePlatformFilter] = useState<string>("all");
  const [deviceRoleFilter, setDeviceRoleFilter] = useState<string>("all");
  const [deviceSearch, setDeviceSearch] = useState<string>("");

  const fetchPushCenterData = async (silent = false) => {
    if (!user) return;
    if (!silent) setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/push-campaigns", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTelemetry(data.telemetry);
        setDevices(data.devices || []);
        setUsersDirectory(data.usersDirectory || []);
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error("Error loading Push Center data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPushCenterData();
  }, [user?.uid]);

  // Adapter automatiquement l'audience et le lien par défaut quand on change le type de Push
  const handleSelectCampaignType = (type: CampaignType) => {
    setCampaignType(type);
    if (type === "PROMO_CLIENT") {
      setAudience("CLIENTS");
      setLink("/");
    } else if (type === "PROMO_PRO_ADMIN") {
      setAudience("SUPPLIERS_ALL");
      setLink("/supplier/finance");
    } else if (type === "PERSONALIZED") {
      setAudience("SINGLE_USER");
      setLink("/dashboard");
    } else {
      setAudience("ALL");
      setLink("/dashboard");
    }
  };

  const filteredDirectoryUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return usersDirectory;
    const q = userSearchQuery.toLowerCase();
    return usersDirectory.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [usersDirectory, userSearchQuery]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (devicePlatformFilter !== "all" && d.osPlatform !== devicePlatformFilter) return false;
      if (deviceRoleFilter !== "all" && d.boundRole !== deviceRoleFilter) return false;
      if (!deviceSearch.trim()) return true;
      const q = deviceSearch.toLowerCase();
      return (
        d.boundName.toLowerCase().includes(q) ||
        d.boundEmail.toLowerCase().includes(q) ||
        d.deviceId.toLowerCase().includes(q)
      );
    });
  }, [devices, devicePlatformFilter, deviceRoleFilter, deviceSearch]);

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Veuillez renseigner un titre et un message.");
      return;
    }
    if (audience === "SINGLE_USER" && !targetUid) {
      toast.error("Veuillez sélectionner le compte destinataire.");
      return;
    }

    setIsSending(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/push-campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignType,
          audience,
          targetUid: audience === "SINGLE_USER" ? targetUid : undefined,
          title: title.trim(),
          message: message.trim(),
          discountLabel:
            campaignType === "PROMO_CLIENT" || campaignType === "PROMO_PRO_ADMIN"
              ? discountLabel.trim() || undefined
              : undefined,
          promoCode:
            campaignType === "PROMO_CLIENT" || campaignType === "PROMO_PRO_ADMIN"
              ? promoCode.trim().toUpperCase() || undefined
              : undefined,
          link: link.trim() || "/",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de l'envoi du Push.");
      }

      toast.success(data.message || "Notification Push diffusée avec succès !");
      setTitle("");
      setMessage("");
      setDiscountLabel("");
      setPromoCode("");
      fetchPushCenterData(true);
    } catch (err: any) {
      toast.error(err.message || "Impossible d'envoyer la notification.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSelfTestPush = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/push/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventType: "TEST_PUSH",
          title: title.trim() || "🔔 Test Push Admin — Rayons.net",
          text:
            message.trim() ||
            "Ce test confirme que votre appareil reçoit les notifications Push en direct.",
          link: link.trim() || "/admin/push",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Push Test envoyé sur votre appareil !");
      } else {
        toast.error(data.error || "Erreur lors du test Push.");
      }
    } catch {
      toast.error("Erreur réseau lors du test Push.");
    }
  };

  const audienceLabel = (aud: AudienceType) => {
    switch (aud) {
      case "ALL":
        return "Tous les comptes & appareils";
      case "CLIENTS":
        return "Clients acheteurs uniquement";
      case "SUPPLIERS_ALL":
        return "Tous les Fournisseurs";
      case "SUPPLIERS_IMMO":
        return "Fournisseurs Immobilier & Hôtels";
      case "SUPPLIERS_MODE":
        return "Fournisseurs Mode & Vêtements";
      case "SUPPLIERS_CONNECT":
        return "Fournisseurs Matériel & Connect";
      case "SUPPLIERS_SAVEURS":
        return "Fournisseurs Saveurs & Resto";
      case "PARTNERS":
        return "Partenaires & Apporteurs d'affaires";
      case "DRIVERS":
        return "Livreurs (Application Livreur)";
      case "ADMINS":
        return "Administration & Staff Interne";
      case "SINGLE_USER":
        return "Compte individuel ciblé";
      default:
        return aud;
    }
  };

  const campaignTypeBadge = (type: CampaignType) => {
    switch (type) {
      case "COMMUNIQUE":
        return "Communiqué Officiel";
      case "PROMO_CLIENT":
        return "Promo Clients";
      case "PROMO_PRO_ADMIN":
        return "Promo Pro / Admin";
      case "PERSONALIZED":
        return "Push Personnalisé";
    }
  };

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Centre de Notifications Push &amp; Téléchargements App
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Suivez le nombre d&apos;appareils ayant installé l&apos;application et diffusez vos communiqués, promotions clients, offres partenaires et push personnalisés.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchPushCenterData()}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            <span>Actualiser</span>
          </button>

          <button
            type="button"
            onClick={handleSendSelfTestPush}
            className="px-4 py-2 rounded-xl bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-extrabold flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Bell size={14} />
            <span>Tester un Push sur mon appareil</span>
          </button>
        </div>
      </div>

      {/* KPI Cards — Téléchargements & Audiences Push */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Applications Téléchargées / Installées */}
        <div className="bg-[#0F1D27] border border-white/10 rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Applications Téléchargées</span>
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] text-[#C7D300] flex items-center justify-center">
              <Download size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {telemetry.installedAppsCount}
          </div>
          <p className="text-[11px] text-gray-400">
            Android : <strong className="text-gray-200">{telemetry.byPlatform.android}</strong> · iOS :{" "}
            <strong className="text-gray-200">{telemetry.byPlatform.ios}</strong> · Web :{" "}
            <strong className="text-gray-200">{telemetry.byPlatform.desktop}</strong>
          </p>
        </div>

        {/* 2. Appareils Joignables par Push */}
        <div className="bg-[#0F1D27] border border-white/10 rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Appareils Push Actifs</span>
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] text-gray-200 flex items-center justify-center">
              <Smartphone size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {telemetry.pushEnabledDevicesCount}
          </div>
          <p className="text-[11px] text-gray-400">
            Téléphones liés recevant les alertes même déconnectés
          </p>
        </div>

        {/* 3. Répartition des Comptes (Clients vs Pros) */}
        <div className="bg-[#0F1D27] border border-white/10 rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Audiences Enregistrées</span>
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] text-gray-200 flex items-center justify-center">
              <UserCheck size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {telemetry.byAudience.clients +
              telemetry.byAudience.suppliers +
              telemetry.byAudience.partners +
              telemetry.byAudience.drivers}
          </div>
          <p className="text-[11px] text-gray-400">
            {telemetry.byAudience.clients} Clients · {telemetry.byAudience.suppliers} Fournisseurs ·{" "}
            {telemetry.byAudience.partners} Partenaires
          </p>
        </div>

        {/* 4. Campagnes Diffusées */}
        <div className="bg-[#0F1D27] border border-white/10 rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Campagnes Push Envoyées</span>
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] text-gray-200 flex items-center justify-center">
              <Megaphone size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {campaigns.length}
          </div>
          <p className="text-[11px] text-gray-400">
            Communiqués, promotions clients et offres pro
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("compose")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === "compose"
              ? "bg-white/15 text-white border border-white/20"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Send size={14} />
          <span>Envoyer un Push (Communiqué / Promo / Personnalisé)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("devices")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === "devices"
              ? "bg-white/15 text-white border border-white/20"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Smartphone size={14} />
          <span>Appareils &amp; Téléchargements ({devices.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === "history"
              ? "bg-white/15 text-white border border-white/20"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Clock size={14} />
          <span>Historique des Push ({campaigns.length})</span>
        </button>
      </div>

      {/* TAB 1: STUDIO D'ENVOI PUSH */}
      {activeTab === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulaire de configuration (8 colonnes) */}
          <form
            onSubmit={handleSendCampaign}
            className="lg:col-span-8 bg-[#0F1D27] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5"
          >
            {/* Étape 1 : Catégorie du Push */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2.5">
                1. Catégorie de la notification Push
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSelectCampaignType("COMMUNIQUE")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    campaignType === "COMMUNIQUE"
                      ? "bg-white/10 border-[#C7D300] text-white"
                      : "bg-[#142430] border-white/10 text-gray-300 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-white">
                    <Megaphone size={15} className="text-[#C7D300]" />
                    <span>Communiqué Officiel (Central)</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Annonce générale, consigne ou information officielle de la Direction.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectCampaignType("PROMO_CLIENT")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    campaignType === "PROMO_CLIENT"
                      ? "bg-white/10 border-[#C7D300] text-white"
                      : "bg-[#142430] border-white/10 text-gray-300 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-white">
                    <Gift size={15} className="text-[#C7D300]" />
                    <span>Promotion Clients (Acheteurs)</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Remise, code promo, arrivage ou vente flash destinée aux clients.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectCampaignType("PROMO_PRO_ADMIN")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    campaignType === "PROMO_PRO_ADMIN"
                      ? "bg-white/10 border-[#C7D300] text-white"
                      : "bg-[#142430] border-white/10 text-gray-300 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-white">
                    <Briefcase size={15} className="text-[#C7D300]" />
                    <span>Promotion Administration / Pro</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Offre sur l&apos;abonnement fournisseur, bonus partenaire ou prime interne.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectCampaignType("PERSONALIZED")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    campaignType === "PERSONALIZED"
                      ? "bg-white/10 border-[#C7D300] text-white"
                      : "bg-[#142430] border-white/10 text-gray-300 hover:border-white/25"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs text-white">
                    <UserCheck size={15} className="text-[#C7D300]" />
                    <span>Push Personnalisé (Individuel)</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Notification directe envoyée sur le téléphone d&apos;une personne précise.
                  </p>
                </button>
              </div>
            </div>

            {/* Étape 2 : Sélection de l'Audience par liste déroulante */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                  2. Audience destinataire
                </label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as AudienceType)}
                  className="w-full px-3.5 py-2.5 bg-[#142430] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-white/30 cursor-pointer"
                >
                  {campaignType === "PROMO_CLIENT" && (
                    <>
                      <option value="CLIENTS">
                        Clients acheteurs uniquement ({telemetry.byAudience.clients})
                      </option>
                      <option value="ALL">
                        Tous les appareils &amp; visiteurs ({telemetry.totalDevicesCount})
                      </option>
                    </>
                  )}

                  {campaignType === "PROMO_PRO_ADMIN" && (
                    <>
                      <option value="SUPPLIERS_ALL">
                        Tous les Fournisseurs ({telemetry.byAudience.suppliers})
                      </option>
                      <option value="SUPPLIERS_IMMO">Fournisseurs — Rayon Immobilier &amp; Hôtels</option>
                      <option value="SUPPLIERS_MODE">Fournisseurs — Rayon Mode &amp; Vêtements</option>
                      <option value="SUPPLIERS_CONNECT">Fournisseurs — Rayon Matériel &amp; Connect</option>
                      <option value="SUPPLIERS_SAVEURS">Fournisseurs — Rayon Saveurs &amp; Resto</option>
                      <option value="PARTNERS">
                        Partenaires &amp; Apporteurs d&apos;affaires ({telemetry.byAudience.partners})
                      </option>
                      <option value="ADMINS">
                        Administration &amp; Fonctionnaires ({telemetry.byAudience.admins})
                      </option>
                    </>
                  )}

                  {campaignType === "COMMUNIQUE" && (
                    <>
                      <option value="ALL">Tout le monde (Tous les comptes)</option>
                      <option value="CLIENTS">Clients acheteurs ({telemetry.byAudience.clients})</option>
                      <option value="SUPPLIERS_ALL">
                        Tous les Fournisseurs ({telemetry.byAudience.suppliers})
                      </option>
                      <option value="SUPPLIERS_IMMO">Fournisseurs — Immobilier &amp; Hôtels</option>
                      <option value="SUPPLIERS_MODE">Fournisseurs — Mode &amp; Vêtements</option>
                      <option value="SUPPLIERS_CONNECT">Fournisseurs — Matériel &amp; Connect</option>
                      <option value="SUPPLIERS_SAVEURS">Fournisseurs — Saveurs &amp; Resto</option>
                      <option value="PARTNERS">Partenaires ({telemetry.byAudience.partners})</option>
                      <option value="DRIVERS">Livreurs ({telemetry.byAudience.drivers})</option>
                      <option value="ADMINS">Administration &amp; Staff ({telemetry.byAudience.admins})</option>
                      <option value="SINGLE_USER">Un compte précis...</option>
                    </>
                  )}

                  {campaignType === "PERSONALIZED" && (
                    <option value="SINGLE_USER">Compte individuel ciblé</option>
                  )}
                </select>
              </div>

              {/* Lien de redirection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                  Page d&apos;ouverture au clic
                </label>
                <select
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#142430] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-white/30 cursor-pointer"
                >
                  <option value="/">Accueil Marketplace (/)</option>
                  <option value="/rayon/connect">Rayon Connect (/rayon/connect)</option>
                  <option value="/rayon/immo">Rayon Immobilier &amp; Hôtels (/rayon/immo)</option>
                  <option value="/rayon/mode">Rayon Mode (/rayon/mode)</option>
                  <option value="/rayon/saveurs">Rayon Saveurs (/rayon/saveurs)</option>
                  <option value="/dashboard">Espace Client (/dashboard)</option>
                  <option value="/supplier">Console Fournisseur (/supplier)</option>
                  <option value="/supplier/finance">Abonnement &amp; Finance Fournisseur (/supplier/finance)</option>
                  <option value="/partner">Portail Partenaire (/partner)</option>
                </select>
              </div>
            </div>

            {/* Sélecteur d'utilisateur précis si SINGLE_USER */}
            {audience === "SINGLE_USER" && (
              <div className="p-4 rounded-xl bg-[#142430] border border-white/10 space-y-2.5">
                <label className="block text-xs font-semibold text-gray-200">
                  Sélectionner la personne destinataire
                </label>
                <input
                  type="text"
                  placeholder="Filtrer par nom, boutique ou email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0F1D27] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30"
                />
                <select
                  value={targetUid}
                  onChange={(e) => setTargetUid(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0F1D27] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30 cursor-pointer"
                >
                  <option value="">— Choisir un compte ({filteredDirectoryUsers.length}) —</option>
                  {filteredDirectoryUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      [{u.role}] {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Champs spécifiques aux Promotions (Clients ou Pro/Admin) */}
            {(campaignType === "PROMO_CLIENT" || campaignType === "PROMO_PRO_ADMIN") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#142430] border border-white/10">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                    Avantage / Remise affichée
                  </label>
                  <input
                    type="text"
                    placeholder={
                      campaignType === "PROMO_CLIENT"
                        ? "Ex: -20%, Livraison Gratuite..."
                        : "Ex: -10$ sur l'abonnement, Bonus +5$..."
                    }
                    value={discountLabel}
                    onChange={(e) => setDiscountLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0F1D27] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                    Code Promo associé (optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: RAYON20, SAVEUR15..."
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-[#0F1D27] border border-white/10 rounded-lg text-xs font-mono text-[#C7D300] focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
            )}

            {/* Étape 3 : Titre et Message */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                  3. Titre de la notification Push
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    campaignType === "PROMO_CLIENT"
                      ? "Ex: 🎁 Offre Flash Rayons Saveurs : -15% aujourd'hui !"
                      : campaignType === "PROMO_PRO_ADMIN"
                      ? "Ex: 🏢 Offre Spéciale Fournisseurs & Partenaires"
                      : "Ex: 📢 Communiqué officiel Rayons.net"
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#142430] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                  Message détaillé
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Rédigez le message qui s'affichera sur l'écran verrouillé et dans la cloche de notifications..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#142430] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-white/30 resize-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={isSending}
                className="px-6 py-3 rounded-xl bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-heading font-extrabold text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Send size={15} />
                <span>{isSending ? "Diffusion en cours..." : "Envoyer le Push maintenant"}</span>
              </button>
            </div>
          </form>

          {/* Aperçu Mobile en Temps Réel (4 colonnes) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#0F1D27] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Aperçu sur Téléphone
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300">
                  {campaignTypeBadge(campaignType)}
                </span>
              </div>

              {/* Maquette Notification Mobile */}
              <div className="bg-[#091218] border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span className="font-bold text-gray-300">RAYONS.NET</span>
                  <span>À l&apos;instant</span>
                </div>

                <div className="bg-[#142430] border border-white/15 rounded-xl p-3.5 flex items-start gap-3 shadow-lg">
                  <div className="w-9 h-9 rounded-xl bg-[#C7D300]/15 border border-[#C7D300]/30 text-[#C7D300] flex items-center justify-center shrink-0 mt-0.5">
                    <Bell size={17} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-bold text-white leading-snug">
                      {title.trim() || "Titre de votre notification Push"}
                    </p>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      {discountLabel ? `[Offre ${discountLabel}] ` : ""}
                      {message.trim() ||
                        "Le texte de votre communiqué ou de votre promotion apparaîtra ici sur le téléphone du destinataire."}
                      {promoCode ? ` (Code : ${promoCode})` : ""}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 space-y-1 pt-1">
                  <div className="flex justify-between">
                    <span>Cible :</span>
                    <strong className="text-gray-200">{audienceLabel(audience)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Redirection :</span>
                    <span className="font-mono text-gray-300">{link}</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-gray-400 leading-relaxed">
                <strong className="text-gray-200 block mb-1">Fonctionnement automatique :</strong>
                Les messages du chat, les factures proforma, les nouvelles ventes et les livraisons envoient déjà un Push automatique aux comptes concernés sans aucune action manuelle.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: APPAREILS & TÉLÉCHARGEMENTS */}
      {activeTab === "devices" && (
        <div className="bg-[#0F1D27] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/10 bg-black/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un appareil ou utilisateur..."
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#142430] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={devicePlatformFilter}
                onChange={(e) => setDevicePlatformFilter(e.target.value)}
                className="px-3 py-2 bg-[#142430] border border-white/10 rounded-xl text-xs text-gray-200 focus:outline-none cursor-pointer"
              >
                <option value="all">Tous les systèmes ({devices.length})</option>
                <option value="android">Android ({telemetry.byPlatform.android})</option>
                <option value="ios">iOS / iPhone ({telemetry.byPlatform.ios})</option>
                <option value="desktop">Web / Desktop ({telemetry.byPlatform.desktop})</option>
              </select>

              <select
                value={deviceRoleFilter}
                onChange={(e) => setDeviceRoleFilter(e.target.value)}
                className="px-3 py-2 bg-[#142430] border border-white/10 rounded-xl text-xs text-gray-200 focus:outline-none cursor-pointer"
              >
                <option value="all">Tous les rôles</option>
                <option value="CLIENT">Clients</option>
                <option value="SUPPLIER">Fournisseurs</option>
                <option value="PARTNER">Partenaires</option>
                <option value="DRIVER">Livreurs</option>
                <option value="ADMIN">Administration</option>
              </select>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-black/30 text-[11px] uppercase text-gray-400 border-b border-white/10">
                <tr>
                  <th className="px-5 py-3.5">Compte Lié (Interne)</th>
                  <th className="px-5 py-3.5">Profil</th>
                  <th className="px-5 py-3.5">Système</th>
                  <th className="px-5 py-3.5">Statut Application</th>
                  <th className="px-5 py-3.5">Dernière activité</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Aucun appareil enregistré pour ces critères.
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((d) => (
                    <tr key={d.deviceId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white">{d.boundName}</div>
                        <div className="text-[11px] text-gray-400">{d.boundEmail || d.deviceId}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-gray-200 text-[11px]">
                          {d.boundRole}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 capitalize text-gray-300">{d.osPlatform}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              d.pushEnabled ? "bg-emerald-400" : "bg-gray-500"
                            }`}
                          />
                          <span>
                            {d.isInstalledApp ? "App installée · Push actif" : "Navigateur · Push actif"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400">
                        {new Date(d.updatedAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {d.boundUid && (
                          <button
                            type="button"
                            onClick={() => {
                              setCampaignType("PERSONALIZED");
                              setAudience("SINGLE_USER");
                              setTargetUid(d.boundUid!);
                              setActiveTab("compose");
                            }}
                            className="text-xs text-[#C7D300] hover:underline font-semibold cursor-pointer"
                          >
                            Notifier
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-white/[0.06]">
            {filteredDevices.map((d) => (
              <div key={d.deviceId} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">{d.boundName}</p>
                    <p className="text-[11px] text-gray-400">{d.boundEmail || d.deviceId}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-200">
                    {d.osPlatform.toUpperCase()} · {d.boundRole}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                  <span>{d.isInstalledApp ? "📲 App installée" : "🌐 Navigateur"}</span>
                  {d.boundUid && (
                    <button
                      type="button"
                      onClick={() => {
                        setCampaignType("PERSONALIZED");
                        setAudience("SINGLE_USER");
                        setTargetUid(d.boundUid!);
                        setActiveTab("compose");
                      }}
                      className="text-[#C7D300] font-semibold underline"
                    >
                      Envoyer un Push
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORIQUE DES CAMPAGNES PUSH */}
      {activeTab === "history" && (
        <div className="bg-[#0F1D27] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-black/30 text-[11px] uppercase text-gray-400 border-b border-white/10">
                <tr>
                  <th className="px-5 py-3.5">Campagne / Message</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Audience Ciblée</th>
                  <th className="px-5 py-3.5">Portée</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Aucune campagne Push enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 max-w-md">
                        <div className="font-semibold text-white">{c.title}</div>
                        <div className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{c.message}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-gray-200 text-[11px]">
                          {campaignTypeBadge(c.campaignType)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-300">{audienceLabel(c.audience)}</td>
                      <td className="px-5 py-3.5 font-semibold text-white">
                        {c.notifiedUsersCount} compte(s)
                      </td>
                      <td className="px-5 py-3.5 text-gray-400">
                        {new Date(c.sentAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setCampaignType(c.campaignType);
                            setAudience(c.audience);
                            setTitle(c.title);
                            setMessage(c.message);
                            setPromoCode(c.promoCode || "");
                            setDiscountLabel(c.discountLabel || "");
                            setLink(c.link || "/");
                            setActiveTab("compose");
                          }}
                          className="text-xs text-gray-300 hover:text-white underline cursor-pointer"
                        >
                          Réutiliser
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile History Cards */}
          <div className="md:hidden divide-y divide-white/[0.06]">
            {campaigns.map((c) => (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-200">
                    {campaignTypeBadge(c.campaignType)}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {c.notifiedUsersCount} compte(s)
                  </span>
                </div>
                <p className="text-xs font-bold text-white">{c.title}</p>
                <p className="text-[11px] text-gray-400">{c.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
