"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, RefreshCw, Clock, User, Activity } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string;
  actorRole: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  createdAt: string | null;
}

const ACTION_BADGE_STYLE: Record<string, string> = {
  SETTINGS_UPDATED: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  COMMISSION_CREDITED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  REFERRAL_PAYOUT: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  SUBSCRIPTION_UPDATED: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  SUBSCRIPTION_PAYMENT_RECORDED: "bg-[#C7D300]/15 text-[#C7D300] border-[#C7D300]/30",
  USER_ROLE_PROMOTED: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  USER_DELETED: "bg-red-500/15 text-red-300 border-red-500/30",
};

export default function AuditLogPanel() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/audit-logs?limit=40", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Accès non autorisé au journal d'audit.");
      }
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err?.message || "Impossible de charger le journal d'audit.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="bg-[#0F1D27] border border-white/10 rounded-3xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="text-[#C7D300]" size={22} />
            Journal d&apos;Audit &amp; Traçabilité Serveur
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Historique immuable (Admin SDK uniquement) des opérations critiques : rôles, finances, commissions, abonnements et suppressions.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-200 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-[#C7D300]" : "text-[#C7D300]"} />
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400 gap-2 text-sm">
          <RefreshCw size={16} className="animate-spin text-[#C7D300]" />
          Chargement du journal d&apos;audit...
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm flex flex-col items-center gap-2">
          <Activity size={24} className="text-gray-600" />
          <span>Aucune action critique enregistrée pour le moment.</span>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[420px] overflow-y-auto rayons-scroll pr-1">
          {logs.map((entry) => {
            const badgeClass =
              ACTION_BADGE_STYLE[entry.action] || "bg-white/10 text-gray-300 border-white/15";
            return (
              <div
                key={entry.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}>
                      {entry.action}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                      <User size={11} className="text-[#C7D300]" />
                      {entry.actorEmail || "Admin"} ({entry.actorRole || "ADMIN"})
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-200 leading-snug">{entry.summary}</p>
                </div>
                {entry.createdAt && (
                  <div className="flex items-center gap-1 text-[11px] text-gray-500 shrink-0 font-mono">
                    <Clock size={11} />
                    <span>{new Date(entry.createdAt).toLocaleString("fr-FR")}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
