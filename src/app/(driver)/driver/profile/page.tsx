"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, orderBy,
  doc, getDoc, updateDoc, serverTimestamp
} from "firebase/firestore";
import { motion } from "framer-motion";
import {
  User, Phone, Mail, Car, MapPin, Star, CheckCircle,
  Package, TrendingUp, Edit2, Save, X, Camera
} from "lucide-react";

export default function DriverProfilePage() {
  const { user, userData } = useAuth();
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, today: 0, earnings: 0, todayEarnings: 0, rating: 5.0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({ displayName: "", phone: "", vehicle: "", vehiclePlate: "", zone: "" });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        // 1. Charger infos livreur
        let info: any = { ...userData };
        try {
          const driverSnap = await getDoc(doc(db, "drivers", user.uid));
          if (driverSnap.exists()) info = { ...info, ...driverSnap.data() };
        } catch {}
        setDriverInfo(info);
        setForm({
          displayName: info.displayName || info.name || "",
          phone: info.phone || "",
          vehicle: info.vehicle || "",
          vehiclePlate: info.vehiclePlate || "",
          zone: info.zone || "",
        });

        // 2. Calculer les stats depuis Firestore
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const q = query(
          collection(db, "orders"),
          where("driverId", "==", user.uid),
          where("status", "in", ["COMPLETED", "completed", "delivered", "DELIVERED", "LIVRE"])
        );
        const snap = await getDocs(q);

        let total = 0, todayCount = 0, earnings = 0, todayEarnings = 0;
        snap.forEach(d => {
          const data = d.data();
          total++;
          const amt = Number(data.deliveryFee || data.driverFee || (data.totalAmount || 0) * 0.1 || 0);
          earnings += amt;

          const deliveredAt = data.deliveredAt?.toDate?.() || data.completedAt?.toDate?.() || null;
          if (deliveredAt && deliveredAt >= today) {
            todayCount++;
            todayEarnings += amt;
          }
        });

        setStats({ total, today: todayCount, earnings, todayEarnings, rating: info.rating || 5.0 });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updateData = { ...form, updatedAt: serverTimestamp() };
      // Update dans users et drivers (best-effort)
      await updateDoc(doc(db, "users", user.uid), updateData).catch(() => {});
      try { await updateDoc(doc(db, "drivers", user.uid), updateData); } catch {}
      setDriverInfo((prev: any) => ({ ...prev, ...form }));
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0b061c]">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const initials = (form.displayName || "L").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="p-4 bg-[#0b061c] min-h-screen pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 mt-2">
        <h1 className="text-xl font-bold text-white">Mon Profil</h1>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-all"
          >
            <Edit2 size={14} /> Modifier
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="p-2 bg-white/10 hover:bg-white/20 text-gray-400 rounded-xl transition-all">
              <X size={16} />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary-light text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            >
              <Save size={14} /> {saving ? "..." : "Enregistrer"}
            </button>
          </div>
        )}
      </div>

      {/* Avatar + Identité */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#140b2e] border border-white/10 rounded-2xl p-6 mb-5 flex items-center gap-4"
      >
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center text-2xl font-black text-primary-light">
            {initials}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-[#0b061c]" title="En ligne" />
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={form.displayName}
              onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              className="w-full px-3 py-1.5 bg-black/30 border border-white/20 rounded-lg text-white font-bold text-lg focus:outline-none focus:ring-1 focus:ring-primary mb-1"
            />
          ) : (
            <h2 className="text-xl font-bold text-white truncate">{form.displayName || "Livreur"}</h2>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {driverInfo?.supplierId && driverInfo.supplierId !== "admin"
              ? "🔒 Livreur Exclusif"
              : "🌐 Livreur Indépendant"}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={12} className={i < Math.round(stats.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-600"} />
            ))}
            <span className="text-xs text-gray-400 ml-1">{stats.rating.toFixed(1)}</span>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { label: "Livraisons totales", value: stats.total, icon: Package, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          { label: "Aujourd'hui", value: stats.today, icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          { label: "Gains totaux", value: `$${stats.earnings.toFixed(2)}`, icon: TrendingUp, color: "text-primary-light", bg: "bg-primary/10 border-primary/20" },
          { label: "Gains du jour", value: `$${stats.todayEarnings.toFixed(2)}`, icon: TrendingUp, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            className={`p-4 rounded-2xl border ${s.bg} flex flex-col gap-1`}
          >
            <s.icon size={16} className={s.color} />
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-gray-400 font-medium">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Infos du profil */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#140b2e] border border-white/10 rounded-2xl p-5 space-y-4"
      >
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Informations</h3>

        {[
          { label: "Téléphone", field: "phone", icon: Phone, placeholder: "+243 8XX XXX XXX", type: "tel" },
          { label: "Véhicule", field: "vehicle", icon: Car, placeholder: "Moto, Voiture, Vélo...", type: "text" },
          { label: "Plaque d'immatriculation", field: "vehiclePlate", icon: Car, placeholder: "AB 1234 CD", type: "text" },
          { label: "Zone de livraison", field: "zone", icon: MapPin, placeholder: "Ex: Gombe, Limete...", type: "text" },
        ].map(({ label, field, icon: Icon, placeholder, type }) => (
          <div key={field} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <Icon size={16} className="text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
              {editing ? (
                <input
                  type={type}
                  value={(form as any)[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full px-3 py-1.5 bg-black/30 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ) : (
                <p className="text-sm font-medium text-white truncate">
                  {(form as any)[field] || <span className="text-gray-500 italic">Non renseigné</span>}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Email (readonly) */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <Mail size={16} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-500 mb-0.5">Email</p>
            <p className="text-sm font-medium text-gray-300 truncate">{user?.email || "—"}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
