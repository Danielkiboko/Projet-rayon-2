"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Search, Truck, Smartphone, Copy, Check, Download, ExternalLink } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

import { PERMANENT_DRIVER_APK_PATH, getPermanentDriverApkUrl } from "@/lib/constants";
import DriverFormModal from "@/modules/shared/components/drivers/DriverFormModal";

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Livreurs</h1>
          <p className="text-sm text-gray-400">Gérez les comptes de tous les livreurs de la plateforme.</p>
        </div>
        <button
          onClick={() => {
            setIsModalOpen(true);
            setSuccessMessage("");
          }}
          className="flex items-center space-x-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Plus size={18} />
          <span>Nouveau Livreur Indépendant</span>
        </button>
      </div>
      
      {successMessage && (
        <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400">
          {successMessage}
        </div>
      )}

      {/* APK Distribution Card */}
      <div className="bg-gradient-to-r from-[#C7D300]/10 via-white/5 to-[#C7D300]/10 border border-[#C7D300]/30 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#C7D300]/15 border border-[#C7D300]/30 flex items-center justify-center text-[#C7D300] shrink-0">
            <Smartphone size={22} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-white">Application Mobile Livreur Android (.APK)</h2>
              <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-[#C7D300]/15 text-[#C7D300] rounded-full border border-[#C7D300]/30">Officielle</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Envoyée automatiquement par e-mail et SMS à chaque création de livreur. Vous pouvez aussi la télécharger ou copier le lien ici.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <button
            onClick={() => {
              navigator.clipboard.writeText(getPermanentDriverApkUrl());
              setCopiedAppUrl(true);
              setTimeout(() => setCopiedAppUrl(false), 2500);
            }}
            className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
          >
            {copiedAppUrl ? <Check size={14} className="text-[#C7D300]" /> : <Copy size={14} />}
            <span>{copiedAppUrl ? "Lien copié !" : "Copier le lien APK"}</span>
          </button>

          <a
            href={PERMANENT_DRIVER_APK_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-3.5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] rounded-xl text-xs font-bold shadow-md shadow-[#C7D300]/20 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>Télécharger APK</span>
          </a>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher un livreur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-xs sm:text-sm transition-all"
            />
          </div>
        </div>

        {/* Desktop Table (Hidden on mobile < md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs uppercase bg-black/20 text-gray-400">
              <tr>
                <th className="px-6 py-4">Nom du livreur</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Affiliation</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    Chargement des livreurs...
                  </td>
                </tr>
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    Aucun livreur trouvé.
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-white flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-[#C7D300]/15 flex items-center justify-center text-[#C7D300]">
                        <Truck size={16} />
                      </div>
                      <span>{driver.name}</span>
                    </td>
                    <td className="px-6 py-4">{driver.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${driver.supplierId === 'superAdmin' || driver.supplierId === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                        {driver.supplierId === 'superAdmin' || driver.supplierId === 'admin' ? 'Indépendant (Rayons)' : 'Fournisseur exclusif'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={driver.status === "Actif" ? "text-green-400" : "text-red-400"}>
                        {driver.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-4">
                      <button 
                        onClick={() => {
                          const firstName = driver.name.split(' ')[0];
                          const shareText = `Bonjour ${firstName} !\n\nVotre compte livreur Rayons a été créé.\n\n📲 Téléchargez votre application mobile Android officielle ici :\n${getPermanentDriverApkUrl()}\n\nIdentifiant : ${driver.email}`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
                        }}
                        className="text-green-400 hover:text-green-300 transition-colors inline-flex items-center cursor-pointer"
                        title="Envoyer l'application par WhatsApp"
                      >
                        <Smartphone size={16} className="mr-1" />
                        <span>Envoyer App</span>
                      </button>
                      <button className="text-primary-light hover:text-white transition-colors cursor-pointer">Gérer</button>
                    </td>
                  </tr>
                ))
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
