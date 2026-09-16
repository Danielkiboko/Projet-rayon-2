"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Search, Truck, Smartphone } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";

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

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notificationMethod, setNotificationMethod] = useState<'email' | 'sms'>("email");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) {
        throw new Error("Vous devez être connecté pour effectuer cette action.");
      }

      // Generate a strong random password since the user will reset it anyway
      const randomPassword = Math.random().toString(36).slice(-10) + "A1@";

      // 1. Create the user account via API
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password: randomPassword,
          displayName: name,
          roleToCreate: "driver",
          notificationMethod,
          phoneNumber: notificationMethod === 'sms' ? phoneNumber : undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la création du livreur.");
      }

      if (notificationMethod === 'email') {
        // 2. Send the password reset email so they can choose their own password
        await sendPasswordResetEmail(auth, email);
      }

      // Reset form and close modal
      setName("");
      setEmail("");
      setPhoneNumber("");
      setIsModalOpen(false);
      const methodMsg = notificationMethod === 'email' 
        ? `Un e-mail a été envoyé à ${email} pour qu'il configure son mot de passe.` 
        : `Un SMS a été envoyé au ${phoneNumber} avec le mot de passe.`;
      setSuccessMessage(`Le compte livreur a été créé. ${methodMsg}`);
      
      // Refresh list
      fetchDrivers();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            setError("");
          }}
          className="flex items-center space-x-2 bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          <span>Nouveau Livreur Indépendant</span>
        </button>
      </div>
      
      {successMessage && (
        <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400">
          {successMessage}
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher un livreur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white text-sm transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
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
                      <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary-light">
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
                          const shareText = `Bonjour ${firstName} !\n\nVotre compte livreur Rayons a été créé.\n\n📱 Cliquez sur ce lien pour installer l'application :\nhttps://rayons.net/livreur-app/\n\n(Ouvrez le lien et choisissez "Ajouter à l'écran d'accueil")`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
                        }}
                        className="text-green-400 hover:text-green-300 transition-colors inline-flex items-center"
                        title="Envoyer l'application par WhatsApp"
                      >
                        <Smartphone size={16} className="mr-1" />
                        <span>Envoyer App</span>
                      </button>
                      <button className="text-primary-light hover:text-white transition-colors">Gérer</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Driver Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#140b2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-semibold text-white">Créer un Livreur Indépendant</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateDriver} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
                
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm mb-2">
                  Choisissez comment notifier le livreur. Ce livreur pourra recevoir des missions de tous les fournisseurs.
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Méthode de notification</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2 text-white cursor-pointer">
                      <input 
                        type="radio" 
                        name="notificationMethod" 
                        value="email" 
                        checked={notificationMethod === 'email'} 
                        onChange={() => setNotificationMethod('email')}
                        className="text-primary focus:ring-primary bg-black/20 border-white/10"
                      />
                      <span>Email</span>
                    </label>
                    <label className="flex items-center space-x-2 text-white cursor-pointer">
                      <input 
                        type="radio" 
                        name="notificationMethod" 
                        value="sms" 
                        checked={notificationMethod === 'sms'} 
                        onChange={() => setNotificationMethod('sms')}
                        className="text-primary focus:ring-primary bg-black/20 border-white/10"
                      />
                      <span>SMS</span>
                    </label>
                  </div>
                </div>

                {notificationMethod === 'sms' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Numéro de téléphone</label>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+243..."
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Nom du livreur</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Email (identifiant de connexion)</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                  />
                </div>

                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-primary hover:bg-primary-light text-white font-semibold rounded-lg transition-colors flex items-center disabled:opacity-50"
                  >
                    {isSubmitting ? "Création en cours..." : "Créer le compte"}
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
