"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Settings,
  Store,
  Tag,
  Truck,
  Save,
  CheckCircle,
  Phone,
  Building,
  Loader2,
  AlertTriangle,
  Coins,
  Globe,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useLanguage, LanguageCode } from "@/context/LanguageContext";

interface PlatformSettings {
  monthlySubscriptionPrice: number;
  trialDurationDays: number;
  defaultDeliveryFee: number;
  adminShopName: string;
  adminContactPhone: string;
  usdToFcRate: number;
  usdToEurRate: number;
  defaultLanguage: LanguageCode;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  monthlySubscriptionPrice: 50,
  trialDurationDays: 15,
  defaultDeliveryFee: 0,
  adminShopName: "Rayons Officiel",
  adminContactPhone: "",
  usdToFcRate: 2850,
  usdToEurRate: 0.92,
  defaultLanguage: "fr",
};

const OFFICIAL_RAYONS = [
  {
    name: "Rayon Immo",
    slug: "immo",
    href: "/immo",
    description: "Appartements, villas, résidences, hôtels & gestion locative",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  },
  {
    name: "Rayon Mode",
    slug: "mode",
    href: "/mode",
    description: "Prêt-à-porter, chaussures, sacs, bijoux & accessoires",
    badgeClass: "bg-pink-500/15 text-pink-300 border-pink-500/25",
  },
  {
    name: "Rayon Connect",
    slug: "connect",
    href: "/connect",
    description: "Smartphones, informatique, électronique & équipements télécom",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  },
  {
    name: "Rayon Saveurs",
    slug: "saveurs",
    href: "/saveurs",
    description: "Restaurants, plats cuisinés, traiteurs & gastronomie",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  },
] as const;

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-1">
        <Icon className="text-blue-400" size={22} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-medium animate-in slide-in-from-bottom-4 duration-300
        ${type === "success" ? "bg-green-500/20 border border-green-500/30 text-green-400" : "bg-red-500/20 border border-red-500/30 text-red-400"}`}
    >
      {type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
      {message}
    </div>
  );
}

import { isSuperAdmin, hasAdminAccess } from "@/lib/permissions";
import ValidationSuccessView from "@/modules/shared/components/ui/ValidationSuccessView";

export default function AdminSettingsPage() {
  const { user, userData } = useAuth();
  const { lang: accountLang, setLang: setAccountLang } = useLanguage();
  const isSuper = isSuperAdmin(user, userData);

  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Load settings ───────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    try {
      const docRef = doc(db, "settings", "platform");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...snap.data() } as PlatformSettings);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ─── Save platform settings ───────────────────────────────────
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const dataToSave: Record<string, any> = {
        monthlySubscriptionPrice: Number(settings.monthlySubscriptionPrice) || 50,
        trialDurationDays: Number(settings.trialDurationDays) || 15,
        defaultDeliveryFee: Number(settings.defaultDeliveryFee) || 0,
        adminShopName: settings.adminShopName || "Rayons Officiel",
        adminContactPhone: settings.adminContactPhone || "",
        usdToFcRate: Number(settings.usdToFcRate) || 2850,
        usdToEurRate: Number(settings.usdToEurRate) || 0.92,
        defaultLanguage: settings.defaultLanguage || "fr",
      };

      // 1. Try saving directly via client Firestore
      try {
        const clientData = {
          ...dataToSave,
          updatedAt: serverTimestamp(),
          ...(user?.uid ? { updatedBy: user.uid } : {}),
        };
        await setDoc(doc(db, "settings", "platform"), clientData, { merge: true });
        showToast("Taux de change et paramètres enregistrés avec succès !");
        return;
      } catch (firestoreErr) {
        console.warn("Client Firestore setDoc failed, trying server API fallback:", firestoreErr);
      }

      // 2. Server API fallback (bypasses any client auth token latency)
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ settings: dataToSave, userId: user?.uid }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Impossible d'enregistrer les paramètres.");
      }

      showToast("Taux de change et paramètres enregistrés avec succès !");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      showToast(err?.message || "Erreur lors de la sauvegarde.", "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const userRole = (userData?.role || "").toUpperCase();
  const canManageSettings = isSuper || hasAdminAccess(user, userData) || userRole === "SUB_ADMIN" || userRole === "ADMIN";

  if (!canManageSettings) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-red-500/50" />
          <h2 className="text-white font-bold text-xl">Accès Restreint</h2>
          <p className="text-gray-400 mt-2 text-sm">Seuls la direction et les administrateurs délégués peuvent gérer ces paramètres.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
          <Settings size={26} className="text-blue-400" />
          Paramètres de la Plateforme
        </h2>
        <p className="text-gray-400 mt-1 text-sm">
          Configurez les règles globales de la marketplace Rayons.
        </p>
      </div>

      {toast?.type === "success" ? (
        <ValidationSuccessView
          title="C'est fait !"
          message={toast.message}
          badgeLabel="Paramètres Plateforme Mis à Jour"
          onDone={() => setToast(null)}
        />
      ) : (
        <>
          {/* ── Section 1: Identité Boutique Admin ────────────────── */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-sm">
            <SectionTitle
              icon={Building}
              title="Boutique Officielle Rayons"
              subtitle="Ces informations identifient vos propres produits publiés en tant qu'Admin, distincts des fournisseurs tiers."
            />

            {isLoadingSettings ? (
              <div className="flex items-center gap-3 text-gray-400 py-6">
                <Loader2 size={20} className="animate-spin" /> Chargement...
              </div>
            ) : (
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      <Store size={14} className="inline mr-1.5" />Nom de la boutique Admin
                    </label>
                    <input
                      type="text"
                      required
                      value={settings.adminShopName}
                      onChange={e => setSettings(s => ({ ...s, adminShopName: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="ex: Rayons Officiel"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      <Phone size={14} className="inline mr-1.5" />Téléphone du support
                    </label>
                    <input
                      type="tel"
                      value={settings.adminContactPhone}
                      onChange={e => setSettings(s => ({ ...s, adminContactPhone: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="ex: +243 XXX XXX XXX"
                    />
                  </div>
                </div>

                {/* ── Section 2: Plans d'Abonnement ──────────── */}
                <div className="pt-6 mt-2 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-4">
                    <Tag size={18} className="text-blue-400" />
                    <span className="text-base font-bold text-white">Plans d'Abonnement Fournisseur</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-5">
                    Les fournisseurs paient un abonnement mensuel fixe pour accéder à la plateforme. Ils sont ensuite totalement libres de gérer leurs produits, commandes et activités.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Tarif abonnement mensuel (FC)
                      </label>
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        value={settings.monthlySubscriptionPrice}
                        onChange={e => setSettings(s => ({ ...s, monthlySubscriptionPrice: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-1.5">Visible par l'admin lors du renouvellement.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Durée de la période d'essai (jours)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="365"
                        value={settings.trialDurationDays}
                        onChange={e => setSettings(s => ({ ...s, trialDurationDays: parseInt(e.target.value) || 0 }))}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-1.5">Attribué automatiquement aux nouveaux fournisseurs.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        <Truck size={14} className="inline mr-1.5" />Frais de livraison par défaut (FC)
                      </label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={settings.defaultDeliveryFee}
                        onChange={e => setSettings(s => ({ ...s, defaultDeliveryFee: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-1.5">Appliqué si le fournisseur ne définit pas ses propres frais.</p>
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Taux de Change & Devises (USD, FC, EUR) ── */}
                <div className="pt-6 mt-2 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins size={18} className="text-amber-400" />
                    <span className="text-base font-bold text-white">Taux de Change & Multi-Devises</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-5">
                    La devise de référence du catalogue est le Dollar US ($ USD). Définissez ici les taux de conversion appliqués automatiquement aux clients qui basculent en Francs Congolais (FC) ou en Euros (€).
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Taux 1 $ USD = ... Francs Congolais (FC)
                      </label>
                      <input
                        type="number"
                        step="10"
                        min="100"
                        required
                        value={settings.usdToFcRate || 2850}
                        onChange={e => setSettings(s => ({ ...s, usdToFcRate: parseFloat(e.target.value) || 2850 }))}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                        placeholder="2850"
                      />
                      <p className="text-xs text-gray-500 mt-1.5">Ex: 2 850 FC pour 1 $ USD (Marché RDC).</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Taux 1 $ USD = ... Euro (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.1"
                        required
                        value={settings.usdToEurRate || 0.92}
                        onChange={e => setSettings(s => ({ ...s, usdToEurRate: parseFloat(e.target.value) || 0.92 }))}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                        placeholder="0.92"
                      />
                      <p className="text-xs text-gray-500 mt-1.5">Ex: 0.92 € pour 1 $ USD (soit 1 € ≈ 1.08 $ USD).</p>
                    </div>
                  </div>
                </div>

                {/* ── Section 4: Langues & Traduction Automatique (FR / EN / 中文) ── */}
                <div className="pt-6 mt-2 border-t border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe size={18} className="text-[#C7D300]" />
                    <span className="text-base font-bold text-white">Langue du Compte &amp; Langue par Défaut (FR / EN / 中文)</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-5">
                    Définissez la langue de préférence de votre compte (pour recevoir tous les messages, alertes et emails traduits automatiquement) ainsi que la langue par défaut des nouveaux comptes.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Langue de préférence de votre compte Admin
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { code: "fr", flag: "🇫🇷", label: "Français" },
                            { code: "en", flag: "🇬🇧", label: "English" },
                            { code: "zh", flag: "🇨🇳", label: "中文" },
                          ] as { code: LanguageCode; flag: string; label: string }[]
                        ).map((opt) => (
                          <button
                            key={opt.code}
                            type="button"
                            onClick={() => setAccountLang(opt.code)}
                            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${accountLang === opt.code
                                ? "bg-[#C7D300] text-[#0F1D27] border-[#C7D300]"
                                : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                              }`}
                          >
                            <span>{opt.flag}</span>
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">Appliqué immédiatement à votre tableau de bord et vos messages reçus.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Langue par défaut de la plateforme
                      </label>
                      <select
                        value={settings.defaultLanguage || "fr"}
                        onChange={(e) => setSettings((s) => ({ ...s, defaultLanguage: e.target.value as LanguageCode }))}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all [&>option]:bg-[#0F1D27]"
                      >
                        <option value="fr">🇫🇷 Français (FR)</option>
                        <option value="en">🇬🇧 English (EN)</option>
                        <option value="zh">🇨🇳 中文 — Chinois Simplifié (ZH)</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1.5">Utilisée par défaut pour les nouveaux comptes sans préférence définie.</p>
                    </div>
                  </div>
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-4 border-t border-white/5">
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors shadow-sm"
                  >
                    {isSavingSettings ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                    {isSavingSettings ? "Sauvegarde..." : "Sauvegarder les paramètres"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ── Section 3: Les 4 Rayons Officiels Actifs ─────────────────── */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-sm">
            <SectionTitle
              icon={Tag}
              title="Rayons Officiels Actifs (4 univers)"
              subtitle="Les 4 rayons commerciaux structurant Rayons.net. Chaque rayon dispose de sa propre page publique dédiée et de ses règles d'isolation."
            />

            <div className="border border-white/5 rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3 text-left">Rayon</th>
                    <th className="px-4 py-3 text-left font-mono">Slug</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-right">Page publique</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  {OFFICIAL_RAYONS.map((r) => (
                    <tr key={r.slug} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{r.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-mono border ${r.badgeClass}`}>
                          {r.slug}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{r.description}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={r.href}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C7D300] hover:underline"
                        >
                          <span>{r.href}</span>
                          <ExternalLink size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
              <p className="text-xs text-blue-300/80">
                <strong>Architecture SaaS :</strong> les rayons sont attribués aux fournisseurs par l&apos;administration lors de la validation du dossier dans <code className="font-mono bg-black/30 px-1 rounded">/admin/suppliers</code>.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Toast notification for errors */}
      {toast && toast.type === "error" && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
