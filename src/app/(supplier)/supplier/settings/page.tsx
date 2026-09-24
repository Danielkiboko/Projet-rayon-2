"use client";

import { useState, useEffect } from "react";
import { Save, Phone, Palette, Image as ImageIcon, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function SupplierSettingsPage() {
  const { user, userData } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#8b5cf6");
  const [logoUrl, setLogoUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [rccm, setRccm] = useState("");
  const [idNat, setIdNat] = useState("");
  const [nif, setNif] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const isImmo = userData?.role === "SUPPLIER_IMMO" || userData?.businessType === "IMMOBILIER" || userData?.rayon?.type === "REAL_ESTATE" || userData?.rayon === "immo";

  useEffect(() => {
    if (userData) {
      if (userData.phone) setPhoneNumber(userData.phone);
      if (userData.primaryColor) setPrimaryColor(userData.primaryColor);
      if (userData.logoUrl) setLogoUrl(userData.logoUrl);
      if (userData.companyName || userData.company) setCompanyName(userData.companyName || userData.company);
      if (userData.rccm) setRccm(userData.rccm);
      if (userData.idNat) setIdNat(userData.idNat);
      if (userData.nif) setNif(userData.nif);
    }
  }, [userData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);
    setSuccess("");
    setError("");

    try {
      const userRef = doc(db, "users", user.uid);
      
      const pendingProfile: any = {
        phone: phoneNumber
      };

      if (isImmo) {
        pendingProfile.primaryColor = primaryColor;
        pendingProfile.logoUrl = logoUrl;
        pendingProfile.companyName = companyName;
        pendingProfile.rccm = rccm;
        pendingProfile.idNat = idNat;
        pendingProfile.nif = nif;
      }

      const updateData = {
        pendingProfile,
        profileUpdateStatus: "PENDING_APPROVAL"
      };

      await updateDoc(userRef, updateData);
      setSuccess("Vos paramètres ont été mis à jour avec succès.");
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de la mise à jour : " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Paramètres</h1>
        <p className="text-sm text-gray-400">Gérez les informations de votre compte fournisseur.</p>
      </div>

      <div className="max-w-xl space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6"
        >
          {userData?.profileUpdateStatus === "PENDING_APPROVAL" && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm rounded-lg flex items-start space-x-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Modifications en attente</p>
                <p>Vos modifications de profil sont en attente d'approbation par un administrateur.</p>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-4">Profil</h2>
            
            {success && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg">
                {success}
              </div>
            )}
            
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Numéro de téléphone</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone size={18} className="text-gray-400" />
                  </div>
                  <input 
                    type="text" 
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Ex: +243 81 234 5678" 
                    className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white" 
                  />
                </div>
              </div>

              {isImmo && (
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <h3 className="text-lg font-medium text-white mb-2">Profil Entreprise & Facturation</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Nom de l'entreprise</label>
                    <input 
                      type="text" 
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex: Agence Immo XYZ" 
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/5">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">RCCM <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        value={rccm}
                        onChange={(e) => setRccm(e.target.value)}
                        placeholder="CD/KNG/RCCM/..." 
                        className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">ID Nat <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        value={idNat}
                        onChange={(e) => setIdNat(e.target.value)}
                        placeholder="01-..." 
                        className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Numéro d'Impôt (NIF) <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        value={nif}
                        onChange={(e) => setNif(e.target.value)}
                        placeholder="A..." 
                        className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                      />
                    </div>
                  </div>

                  <h3 className="text-lg font-medium text-white mb-2 mt-6">Marque Blanche (Apparence)</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Couleur Principale</label>
                    <div className="flex items-center space-x-3">
                      <input 
                        type="color" 
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-10 w-10 rounded cursor-pointer bg-transparent border-0" 
                      />
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Palette size={18} className="text-gray-400" />
                        </div>
                        <input 
                          type="text" 
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          placeholder="#8b5cf6" 
                          className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white uppercase" 
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Logo URL <span className="text-red-500">*</span> <span className="text-xs text-gray-400 font-normal">(Requis pour les factures)</span></label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <ImageIcon size={18} className="text-gray-400" />
                      </div>
                      <input 
                        type="url" 
                        required
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://votre-site.com/logo.png" 
                        className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white" 
                      />
                    </div>
                    {logoUrl && (
                      <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10 flex justify-center">
                        <img src={logoUrl} alt="Logo Preview" className="max-h-16 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center space-x-2 px-6 py-2 bg-primary hover:bg-primary-light text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                  style={isImmo && primaryColor ? { backgroundColor: primaryColor } : {}}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save size={18} />
                      <span>Enregistrer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
