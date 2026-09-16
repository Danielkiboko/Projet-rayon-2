"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Settings,
  Store,
  Tag,
  Truck,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Phone,
  Building,
  Loader2,
  AlertTriangle,
  Coins,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";

interface PlatformSettings {
  monthlySubscriptionPrice: number;
  trialDurationDays: number;
  defaultDeliveryFee: number;
  adminShopName: string;
  adminContactPhone: string;
  usdToFcRate: number;
  usdToEurRate: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt?: any;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  monthlySubscriptionPrice: 50,
  trialDurationDays: 30,
  defaultDeliveryFee: 0,
  adminShopName: "Rayons Officiel",
  adminContactPhone: "",
  usdToFcRate: 2850,
  usdToEurRate: 0.92,
};

const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Mode", slug: "mode", description: "Vêtements, chaussures et accessoires" },
  { name: "Connect", slug: "connect", description: "Équipements technologiques et télécom" },
  { name: "Immo", slug: "immo", description: "Biens immobiliers et services d'agences" },
  { name: "Général", slug: "general", description: "Produits divers et variés" },
];

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

import { isSuperAdmin } from "@/lib/permissions";

export default function AdminSettingsPage() {
  const { user, userData } = useAuth();
  const isSuper = isSuperAdmin(user, userData);

  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCats, setIsLoadingCats] = useState(true);

  // New category form
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [isAddingCat, setIsAddingCat] = useState(false);

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

  // ─── Load categories ──────────────────────────────────────────
  const loadCategories = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "categories"));
      if (snap.empty) {
        // Seed defaults on first run
        const seeded: Category[] = [];
        for (const cat of DEFAULT_CATEGORIES) {
          const ref = await addDoc(collection(db, "categories"), {
            ...cat,
            createdAt: serverTimestamp(),
          });
          seeded.push({ id: ref.id, ...cat });
        }
        setCategories(seeded);
      } else {
        const cats: Category[] = [];
        snap.forEach(d => cats.push({ id: d.id, ...d.data() } as Category));
        setCategories(cats);
      }
    } catch (err) {
      console.error("Error loading categories:", err);
    } finally {
      setIsLoadingCats(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadCategories();
  }, [loadSettings, loadCategories]);

  // ─── Save platform settings ───────────────────────────────────
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, "settings", "platform"), {
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid,
      });
      showToast("Paramètres sauvegardés avec succès !");
    } catch (err) {
      console.error("Error saving settings:", err);
      showToast("Erreur lors de la sauvegarde.", "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // ─── Add category ─────────────────────────────────────────────
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !newCatSlug.trim()) return;

    // Check for duplicate slug
    if (categories.some(c => c.slug === newCatSlug.trim().toLowerCase())) {
      showToast("Un rayon avec ce slug existe déjà.", "error");
      return;
    }

    setIsAddingCat(true);
    try {
      const ref = await addDoc(collection(db, "categories"), {
        name: newCatName.trim(),
        slug: newCatSlug.trim().toLowerCase(),
        description: newCatDesc.trim(),
        createdAt: serverTimestamp(),
      });
      setCategories(prev => [...prev, {
        id: ref.id,
        name: newCatName.trim(),
        slug: newCatSlug.trim().toLowerCase(),
        description: newCatDesc.trim(),
      }]);
      setNewCatName("");
      setNewCatSlug("");
      setNewCatDesc("");
      showToast("Rayon ajouté avec succès !");
    } catch (err) {
      console.error("Error adding category:", err);
      showToast("Erreur lors de l'ajout.", "error");
    } finally {
      setIsAddingCat(false);
    }
  };

  // ─── Delete category ──────────────────────────────────────────
  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (!confirm(`Supprimer le rayon "${catName}" ? Les produits existants dans ce rayon ne seront pas affectés, mais ce rayon ne sera plus disponible à la sélection.`)) return;
    try {
      await deleteDoc(doc(db, "categories", catId));
      setCategories(prev => prev.filter(c => c.id !== catId));
      showToast("Rayon supprimé.");
    } catch (err) {
      console.error("Error deleting category:", err);
      showToast("Erreur lors de la suppression.", "error");
    }
  };

  // Auto-generate slug from name
  const handleCatNameChange = (val: string) => {
    setNewCatName(val);
    setNewCatSlug(
      val
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
    );
  };

  const userRole = (userData?.role || "").toUpperCase();
  const canManageSettings = isSuper || userRole === "SUB_ADMIN" || userRole === "ADMIN";

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

      {/* ── Section 3: Gestionnaire de Rayons ─────────────────── */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-sm">
        <SectionTitle
          icon={Tag}
          title="Gestion des Rayons (Catégories)"
          subtitle="Ces catégories sont utilisées par les fournisseurs pour publier leurs produits. Elles alimentent directement les pages publiques du site (Mode, Connect, Immo...)."
        />

        {/* Add category form */}
        <form onSubmit={handleAddCategory} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Nom du rayon *</label>
              <input
                type="text"
                required
                value={newCatName}
                onChange={e => handleCatNameChange(e.target.value)}
                placeholder="ex: Supermarché"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Slug (ID technique) *</label>
              <input
                type="text"
                required
                value={newCatSlug}
                onChange={e => setNewCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="ex: supermarche"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Description</label>
              <input
                type="text"
                value={newCatDesc}
                onChange={e => setNewCatDesc(e.target.value)}
                placeholder="Courte description..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isAddingCat || !newCatName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {isAddingCat ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Ajouter le rayon
          </button>
        </form>

        {/* Categories list */}
        {isLoadingCats ? (
          <div className="flex items-center gap-3 text-gray-400 py-6">
            <Loader2 size={20} className="animate-spin" /> Chargement des rayons...
          </div>
        ) : (
          <div className="border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3 text-left">Nom</th>
                  <th className="px-4 py-3 text-left font-mono">Slug (clé interne)</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                      Aucun rayon configuré.
                    </td>
                  </tr>
                ) : (
                  categories.map(cat => (
                    <tr key={cat.id} className="border-t border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{cat.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-xs font-mono">
                          {cat.slug}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{cat.description || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
          <p className="text-xs text-blue-400/80">
            <strong>Note :</strong> Le slug est la valeur enregistrée dans chaque produit Firestore
            (champ <code className="font-mono bg-black/20 px-1 rounded">category</code>). Les pages publiques
            filtrent les produits en fonction de ce slug. Assurez-vous de la cohérence lors d'ajouts.
          </p>
        </div>
      </div>

      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
