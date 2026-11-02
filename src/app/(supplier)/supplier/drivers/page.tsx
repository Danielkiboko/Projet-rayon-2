"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Search, Truck, Clock, UserX, Smartphone, Copy, Check, Download } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, deleteDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";

import { PERMANENT_DRIVER_APK_PATH, getPermanentDriverApkUrl } from "@/lib/constants";
import DriverFormModal from "@/modules/shared/components/drivers/DriverFormModal";

type Driver = {
  id: string;
  displayName: string;
  email: string;
  status: string;
};

export default function SupplierDriversPage() {
  const { user, userData } = useAuth();
  const activeSupplierId = userData?.parentSupplierId || user?.uid;
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);
  
  // Add Driver State
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [success, setSuccess] = useState("");

  const fetchDrivers = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const driversMap = new Map<string, Driver>();

      // 1. Récupération prioritaire depuis la collection "drivers" dédiée aux livreurs du fournisseur
      try {
        const qDrivers = query(
          collection(db, "drivers"),
          where("supplierId", "==", activeSupplierId)
        );
        const snapDrivers = await getDocs(qDrivers);
        snapDrivers.docs.forEach(d => {
          const data = d.data();
          driversMap.set(d.id, {
            id: d.id,
            displayName: data.displayName || "Livreur",
            email: data.email || "",
            status: data.status || "active",
            ...data
          } as Driver);
        });
      } catch (dErr) {
        console.warn("Drivers collection fetch warning:", dErr);
      }

      // 2. Récupération complémentaire depuis la collection "users"
      try {
        const qUsers = query(
          collection(db, "users"),
          where("role", "==", "driver"),
          where("createdBy", "==", activeSupplierId)
        );
        const snapUsers = await getDocs(qUsers);
        snapUsers.docs.forEach(u => {
          const data = u.data();
          if (!driversMap.has(u.id)) {
            driversMap.set(u.id, {
              id: u.id,
              displayName: data.displayName || "Livreur",
              email: data.email || "",
              status: data.status || "active",
              ...data
            } as Driver);
          }
        });
      } catch (uErr) {
        console.warn("Users collection fetch warning:", uErr);
      }

      setDrivers(Array.from(driversMap.values()));
    } catch (err) {
      console.error("Error fetching drivers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [user]);

  const handleRequestDeleteDriver = async (driverId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce livreur ?")) return;
    try {
      // Hard delete from firestore users collection (real app would use Cloud Functions for Auth)
      await deleteDoc(doc(db, "users", driverId));
      setSuccess("Livreur supprimé.");
      fetchDrivers();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Mes Livreurs</h1>
          <p className="text-sm text-gray-400">Gérez vos livreurs affiliés.</p>
        </div>
        <button
          onClick={() => {
            setIsAddingDriver(true);
            setSuccess("");
          }}
          className="flex items-center space-x-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-[#C7D300]/15 active:scale-95"
        >
          <Plus size={20} />
          <span>Ajouter un livreur</span>
        </button>
      </div>

      {success && (
        <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400">
          {success}
        </div>
      )}

      {/* APK Distribution Card */}
      <div className="bg-gradient-to-r from-[#C7D300]/10 via-[#0F1D27] to-[#C7D300]/10 border border-[#C7D300]/30 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-[#C7D300]/15 border border-[#C7D300]/30 flex items-center justify-center text-[#C7D300] shrink-0">
            <Smartphone size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-semibold text-white">Application Mobile Livreur Android (.APK)</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#C7D300]/20 text-[#C7D300] rounded-full border border-[#C7D300]/30">Officielle</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Le lien de téléchargement est envoyé automatiquement par e-mail et SMS lors de l'ajout. Vous pouvez aussi le copier ou l'envoyer via WhatsApp.
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
            className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg text-xs font-medium border border-white/10 transition-colors"
          >
            {copiedAppUrl ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            <span>{copiedAppUrl ? "Lien copié !" : "Copier le lien APK"}</span>
          </button>

          <a
            href={PERMANENT_DRIVER_APK_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-3 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] rounded-lg text-xs font-bold shadow-md shadow-[#C7D300]/20 transition-all active:scale-95"
          >
            <Download size={14} />
            <span>Télécharger APK</span>
          </a>
        </div>
      </div>

      {drivers.length === 0 && !isLoading ? (
        <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck size={32} className="text-gray-400" />
          </div>
          <p className="text-gray-300 font-medium mb-4">Vous n'avez pas encore de livreurs affiliés.</p>
          <button 
            onClick={() => setIsAddingDriver(true)}
            className="text-[#C7D300] hover:underline font-medium transition-colors"
          >
            Ajouter mon premier livreur
          </button>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          {/* Desktop Table (Hidden on mobile < md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-black/40 text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Nom du livreur</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Statut</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                      Chargement des livreurs...
                    </td>
                  </tr>
                ) : (
                  drivers.map(driver => (
                    <tr key={driver.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-[#C7D300]/15 flex items-center justify-center text-[#C7D300] font-bold border border-[#C7D300]/20">
                            {driver.displayName?.charAt(0) || "L"}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">{driver.displayName || "Sans nom"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400">{driver.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {driver.status === "pending_deletion" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            <Clock size={12} className="mr-1.5" /> En suppression
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                            Actif
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        <button 
                          onClick={() => {
                            const firstName = (driver.displayName || "").split(' ')[0] || "Livreur";
                            const shareText = `Bonjour ${firstName} !\n\nVotre compte livreur Rayons a été créé.\n\n📲 Téléchargez votre application mobile Android officielle ici :\n${getPermanentDriverApkUrl()}\n\nIdentifiant : ${driver.email}`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
                          }}
                          className="px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg text-xs font-medium transition-colors inline-flex items-center"
                          title="Envoyer l'application par WhatsApp"
                        >
                          <Smartphone size={14} className="mr-1" />
                          <span>WhatsApp</span>
                        </button>
                        <button 
                          onClick={() => handleRequestDeleteDriver(driver.id)}
                          disabled={driver.status === "pending_deletion"}
                          className="p-2 text-red-400 bg-red-400/10 rounded-lg hover:bg-red-400/20 transition-colors disabled:opacity-50 inline-flex items-center"
                          title="Supprimer"
                        >
                          <UserX size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (Visible only on mobile < md) */}
          <div className="md:hidden divide-y divide-white/5">
            {isLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Chargement des livreurs...</div>
            ) : (
              drivers.map(driver => (
                <div key={driver.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-[#C7D300]/15 flex items-center justify-center text-[#C7D300] font-bold border border-[#C7D300]/20 shrink-0">
                        {driver.displayName?.charAt(0) || "L"}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{driver.displayName || "Sans nom"}</div>
                        <div className="text-xs text-gray-400">{driver.email}</div>
                      </div>
                    </div>
                    <div>
                      {driver.status === "pending_deletion" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          <Clock size={10} className="mr-1" /> En suppression
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          Actif
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                    <button 
                      onClick={() => {
                        const firstName = (driver.displayName || "").split(' ')[0] || "Livreur";
                        const shareText = `Bonjour ${firstName} !\n\nVotre compte livreur Rayons a été créé.\n\n📲 Téléchargez votre application mobile Android officielle ici :\n${getPermanentDriverApkUrl()}\n\nIdentifiant : ${driver.email}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
                      }}
                      className="px-3 py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-xl text-xs font-semibold transition-colors inline-flex items-center"
                    >
                      <Smartphone size={13} className="mr-1" />
                      <span>WhatsApp</span>
                    </button>
                    <button 
                      onClick={() => handleRequestDeleteDriver(driver.id)}
                      disabled={driver.status === "pending_deletion"}
                      className="p-1.5 text-red-400 bg-red-400/10 rounded-xl hover:bg-red-400/20 transition-colors disabled:opacity-50 inline-flex items-center"
                    >
                      <UserX size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add Driver Modal */}
      <DriverFormModal
        isOpen={isAddingDriver}
        onClose={() => setIsAddingDriver(false)}
        onDriverCreated={() => {
          setSuccess("Livreur ajouté avec succès !");
          fetchDrivers();
        }}
        targetSupplierId={activeSupplierId}
      />
    </div>
  );
}
