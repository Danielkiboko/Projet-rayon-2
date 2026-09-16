"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Search, Truck, Clock, UserX } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, deleteDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";

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
  
  // Add Driver State
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverEmail, setNewDriverEmail] = useState("");
  const [notificationMethod, setNotificationMethod] = useState<'email' | 'sms'>("email");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isProcessingDriver, setIsProcessingDriver] = useState(false);
  const [error, setError] = useState("");
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

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName || !newDriverEmail || !user) return;

    setIsProcessingDriver(true);
    setError("");
    setSuccess("");

    try {
      const token = await user.getIdToken();
      // Generate a temporary random password
      const tempPassword = Math.random().toString(36).slice(-10) + "A1@";

      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newDriverEmail,
          password: tempPassword,
          displayName: newDriverName,
          roleToCreate: "driver",
          notificationMethod,
          phoneNumber: notificationMethod === 'sms' ? phoneNumber : undefined,
          extraData: {
            parentSupplierId: activeSupplierId,
            supplierId: activeSupplierId,
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la création.");
      }

      if (notificationMethod === 'email') {
        // Send password reset email
        await sendPasswordResetEmail(auth, newDriverEmail);
      }

      setSuccess(`Livreur ajouté. ${notificationMethod === 'email' ? 'Un email a été envoyé à ' + newDriverEmail + ' pour configurer son mot de passe.' : 'Un SMS a été envoyé au ' + phoneNumber + ' avec le mot de passe.'}`);
      setNewDriverName("");
      setNewDriverEmail("");
      setPhoneNumber("");
      setIsAddingDriver(false);
      fetchDrivers();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur s'est produite.");
    } finally {
      setIsProcessingDriver(false);
    }
  };

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
            setError("");
          }}
          className="flex items-center space-x-2 bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-primary/20"
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

      {drivers.length === 0 && !isLoading ? (
        <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck size={32} className="text-gray-400" />
          </div>
          <p className="text-gray-300 font-medium mb-4">Vous n'avez pas encore de livreurs affiliés.</p>
          <button 
            onClick={() => setIsAddingDriver(true)}
            className="text-primary-light hover:text-white font-medium transition-colors"
          >
            Ajouter mon premier livreur
          </button>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
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
                          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary-light font-bold">
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
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => handleRequestDeleteDriver(driver.id)}
                          disabled={driver.status === "pending_deletion"}
                          className="p-2 text-red-400 bg-red-400/10 rounded-lg hover:bg-red-400/20 transition-colors disabled:opacity-50"
                          title="Supprimer"
                        >
                          <UserX size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Driver Modal */}
      <AnimatePresence>
        {isAddingDriver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#140b2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-semibold text-white">Ajouter un livreur</h2>
                <button onClick={() => setIsAddingDriver(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddDriver} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
                
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm mb-2">
                  Choisissez comment notifier le livreur de son nouveau mot de passe.
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
                      className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Nom du livreur</label>
                  <input 
                    type="text" 
                    required 
                    value={newDriverName} 
                    onChange={(e) => setNewDriverName(e.target.value)} 
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-white" 
                    placeholder="Ex: Jean Dupont" 
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Email</label>
                  <input 
                    type="email" 
                    required 
                    value={newDriverEmail} 
                    onChange={(e) => setNewDriverEmail(e.target.value)} 
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-white" 
                    placeholder="jean.dupont@email.com" 
                  />
                </div>

                <div className="pt-4 flex justify-end space-x-3 border-t border-white/10 mt-6">
                  <button 
                    type="button" 
                    onClick={() => setIsAddingDriver(false)} 
                    className="px-4 py-2 text-gray-400 hover:text-white font-medium transition-colors"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    disabled={isProcessingDriver} 
                    className="px-6 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors disabled:opacity-50 flex items-center"
                  >
                    {isProcessingDriver ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Création...</>
                    ) : "Ajouter"}
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
