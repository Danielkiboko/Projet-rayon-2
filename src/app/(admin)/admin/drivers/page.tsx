"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Search, Truck, Smartphone, Copy, Check, Download, ExternalLink } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

import { PERMANENT_DRIVER_APK_PATH, getPermanentDriverApkUrl } from "@/lib/constants";
import DriverFormModal from "@/modules/shared/components/drivers/DriverFormModal";
import ValidationSuccessView from "@/modules/shared/components/ui/ValidationSuccessView";

interface Driver {
  id: string;
  name: string;
  email: string;
  supplierId: string;
  status: string;
}

export default function DriversPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);

  const fetchDrivers = async () => {
    setIsLoading(true);
    try {
      const { limit } = await import("firebase/firestore");
      const q = query(collection(db, "users"), where("role", "==", "driver"), limit(100));
      const querySnapshot = await getDocs(q);
      const driversData: Driver[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const effectiveSupplierId = data.supplierId || data.parentSupplierId || data.createdBy || "admin";
        driversData.push({
          id: doc.id,
          name: data.displayName || "Sans nom",
          email: data.email || "",
          supplierId: effectiveSupplierId,
          status: data.status === "active" ? "Actif" : "Inactif",
        });
      });
      setDrivers(driversData);
    } catch (err) {
      console.error("Error fetching drivers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const filteredDrivers = drivers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-16">
      {/* Header Exécutif */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">Livreurs &amp; Flotte</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-white/[0.06] text-gray-300 border border-white/10">
              {drivers.length} compte(s)
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Supervision des livreurs indépendants Rayons et des livreurs rattachés aux boutiques.
          </p>
        </div>
        <button
          onClick={() => {
            setIsModalOpen(true);
            setSuccessMessage("");
          }}
          className="inline-flex items-center gap-1.5 bg-[#C7D300] hover:bg-[#b8c400] text-[#0F1D27] font-bold px-3.5 py-2 rounded-lg text-xs transition-colors whitespace-nowrap cursor-pointer self-start sm:self-auto"
        >
          <Plus size={14} />
          <span>Nouveau Livreur</span>
        </button>
      </div>

      {/* 3 Cartes KPI Exécutives */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Flotte</span>
            <span className="p-1.5 rounded-lg bg-white/[0.05] text-gray-300"><Truck size={14} /></span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{drivers.length}</p>
          <p className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">Livreurs enregistrés</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Actifs</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400"><Check size={14} /></span>
          </div>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">
            {drivers.filter((d) => d.status === "Actif").length}
          </p>
          <p className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">Prêts pour les courses</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Indépendants Rayons</span>
            <span className="p-1.5 rounded-lg bg-white/[0.05] text-gray-300"><Smartphone size={14} /></span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">
            {drivers.filter((d) => d.supplierId === "superAdmin" || d.supplierId === "admin").length}
          </p>
          <p className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">Flotte centrale plateforme</p>
        </div>
      </div>

      {successMessage ? (
        <ValidationSuccessView
          title="C'est fait !"
          message={successMessage}
          badgeLabel="Flotte & Livreurs Mis à Jour"
          onDone={() => setSuccessMessage("")}
        />
      ) : (
        <>
      {/* Bandeau APK sobre */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3.5 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#C7D300]/10 border border-[#C7D300]/20 flex items-center justify-center text-[#C7D300] shrink-0">
            <Smartphone size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-white">Application Mobile Livreur Android (.APK)</h2>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/20">
                Officielle
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              Envoyée par e-mail/SMS à chaque création de livreur · Lien permanent de téléchargement.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
          <button
            onClick={() => {
              navigator.clipboard.writeText(getPermanentDriverApkUrl());
              setCopiedAppUrl(true);
              setTimeout(() => setCopiedAppUrl(false), 2500);
            }}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-gray-200 rounded-lg text-xs font-semibold border border-white/10 transition-colors whitespace-nowrap cursor-pointer"
          >
            {copiedAppUrl ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedAppUrl ? "Lien copié" : "Copier lien APK"}</span>
          </button>

          <a
            href={PERMANENT_DRIVER_APK_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#C7D300] hover:bg-[#b8c400] text-[#0F1D27] rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download size={13} />
            <span>Télécharger APK</span>
          </a>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">Répertoire des Livreurs</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{filteredDrivers.length} livreur(s) affiché(s)</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
            <input
              type="text"
              placeholder="Rechercher un livreur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg focus:outline-none focus:border-white/25 text-white text-[11px] placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="text-[10px] uppercase bg-white/[0.01] text-gray-500 font-semibold border-b border-white/[0.08] tracking-wider">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Livreur</th>
                <th className="px-4 py-3 whitespace-nowrap">Email</th>
                <th className="px-4 py-3 whitespace-nowrap">Affiliation</th>
                <th className="px-4 py-3 whitespace-nowrap">Statut</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    Chargement des livreurs...
                  </td>
                </tr>
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    Aucun livreur trouvé.
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => {
                  const isIndep = driver.supplierId === "superAdmin" || driver.supplierId === "admin";
                  return (
                    <tr key={driver.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-[#C7D300] shrink-0">
                            <Truck size={14} />
                          </div>
                          <span className="truncate max-w-[180px]">{driver.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{driver.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap ${
                          isIndep
                            ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                            : "bg-sky-500/10 text-sky-300 border-sky-500/20"
                        }`}>
                          {isIndep ? "Indépendant Rayons" : "Boutique"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap ${
                          driver.status === "Actif"
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-300 border-rose-500/20"
                        }`}>
                          {driver.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              const firstName = driver.name.split(" ")[0];
                              const shareText = `Bonjour ${firstName} !\n\nVotre compte livreur Rayons a été créé.\n\n📲 Téléchargez votre application mobile Android officielle ici :\n${getPermanentDriverApkUrl()}\n\nIdentifiant : ${driver.email}`;
                              window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
                            title="Envoyer l'application par WhatsApp"
                          >
                            <Smartphone size={12} />
                            <span>Envoyer App</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards (Visible on mobile < md) */}
        <div className="md:hidden divide-y divide-white/5">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-xs">Chargement des livreurs...</div>
          ) : filteredDrivers.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">Aucun livreur trouvé.</div>
          ) : (
            filteredDrivers.map((driver) => {
              const firstName = driver.name.split(' ')[0];
              const shareText = `Bonjour ${firstName} !\n\nVotre compte livreur Rayons a été créé.\n\n📲 Téléchargez votre application mobile Android officielle ici :\n${getPermanentDriverApkUrl()}\n\nIdentifiant : ${driver.email}`;
              const isIndep = driver.supplierId === 'superAdmin' || driver.supplierId === 'admin';

              return (
                <div key={driver.id} className="p-4 space-y-3">
                  {/* Header: Driver Name, Icon & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#C7D300]/15 flex items-center justify-center text-[#C7D300] shrink-0">
                        <Truck size={17} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight">{driver.name}</h4>
                        <p className="text-[11px] text-gray-400 truncate max-w-[190px]">{driver.email}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      driver.status === "Actif"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>
                      {driver.status}
                    </span>
                  </div>

                  {/* Affiliation & WhatsApp Action Button */}
                  <div className="flex items-center justify-between pt-1">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                      isIndep ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20' : 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
                    }`}>
                      {isIndep ? 'Indépendant' : 'Fournisseur'}
                    </span>

                    <button
                      onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank")}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      title="Envoyer l'APK par WhatsApp"
                    >
                      <Smartphone size={13} />
                      <span>WhatsApp APK</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
        </>
      )}

      {/* Create Driver Modal */}
      <DriverFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDriverCreated={() => {
          setSuccessMessage("Le compte livreur a été créé avec succès.");
          fetchDrivers();
        }}
        targetSupplierId={null}
      />
    </div>
  );
}
