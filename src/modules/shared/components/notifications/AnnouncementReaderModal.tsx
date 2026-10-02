"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Megaphone, Calendar, User, ShieldCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  time?: number;
  sentBy?: string;
  read?: boolean;
}

interface AnnouncementReaderModalProps {
  isOpen: boolean;
  announcement: AnnouncementItem | null;
  onClose: () => void;
  onMarkAsRead?: (id: string) => void;
}

export default function AnnouncementReaderModal({
  isOpen,
  announcement,
  onClose,
  onMarkAsRead,
}: AnnouncementReaderModalProps) {
  if (!isOpen || !announcement) return null;

  const handleAcknowledge = async () => {
    try {
      if (announcement.id) {
        await updateDoc(doc(db, "inapp_notifications", announcement.id), {
          read: true,
        });
      }
      if (onMarkAsRead) {
        onMarkAsRead(announcement.id);
      }
    } catch (err) {
      console.warn("Could not mark announcement as read:", err);
    }
    onClose();
  };

  const formattedDate = announcement.time
    ? new Date(announcement.time).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Récemment";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[#0D151D] border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-6"
        >
          {/* Header Officiel Rayons.net */}
          <div className="relative p-6 border-b border-white/10 bg-gradient-to-r from-[#0F1D27] via-[#152a38] to-[#0F1D27]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#C7D300]/15 border border-[#C7D300]/30 flex items-center justify-center text-[#C7D300] shrink-0">
                  <Megaphone size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#C7D300]/20 text-[#C7D300] border border-[#C7D300]/30">
                      Message Officiel
                    </span>
                    <span className="text-[11px] text-gray-400">Direction Rayons.net</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-white mt-1">
                    Communiqué de l'Administration
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Corps du communiqué */}
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Boîte Objet & Métadonnées */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#C7D300]" />
                  <span>{formattedDate}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User size={13} className="text-gray-400" />
                  <span>Par : {announcement.sentBy || "Direction Générale"}</span>
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white pt-1">
                {announcement.title}
              </h3>
            </div>

            {/* Contenu du message */}
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-sm text-gray-200 leading-relaxed whitespace-pre-line space-y-3">
              {announcement.message}
            </div>

            {/* Note de pied de page */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
              <ShieldCheck size={16} className="shrink-0 mt-0.5" />
              <p>
                Ce communiqué a été notifié dans votre application et transmis à votre adresse email officielle.
              </p>
            </div>
          </div>

          {/* Footer Action */}
          <div className="p-5 border-t border-white/10 bg-[#0F1D27]/80 flex items-center justify-end gap-3">
            <button
              onClick={handleAcknowledge}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#C7D300] to-[#b5c000] text-[#0F1D27] font-bold text-sm shadow-lg shadow-[#C7D300]/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <CheckCircle2 size={16} />
              <span>J'ai pris connaissance</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
