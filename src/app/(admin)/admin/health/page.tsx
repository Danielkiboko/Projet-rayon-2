"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShieldAlert, Bug, RefreshCw, CheckCircle, Activity, BrainCircuit } from "lucide-react";
import ActionCard from "@/modules/shared/components/dashboard/ActionCard";
import KpiGrid from "@/modules/shared/components/dashboard/KpiGrid";
import AuditLogPanel from "@/modules/admin/components/AuditLogPanel";

export default function HealthDashboard() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "error_logs"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLogs(data);
      setLoading(false);
    }, (err) => {
      console.warn("Health error_logs listener warning:", err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const analyzeBug = async (logId: string) => {
    setAnalyzing(logId);
    try {
      const { auth } = await import("@/lib/firebase");
      const token = await auth?.currentUser?.getIdToken().catch(() => null);
      const res = await fetch("/api/ai/analyze-bug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ logId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Erreur serveur (${res.status})`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Erreur lors de l'analyse avec l'IA.\n\n${err.message}`);
    } finally {
      setAnalyzing(null);
    }
  };

  const markResolved = async (logId: string) => {
    try {
      await updateDoc(doc(db, "error_logs", logId), {
        status: "RESOLVED",
        resolvedAt: new Date(),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const activeBugs = logs.filter((l) => l.status !== "RESOLVED").length;
  const kpiData = [
    { title: "Taux de Doublons", value: "5.4%", subtitle: "Qualité", subInfo: "Attention", icon: Activity },
    { title: "Bugs Actifs", value: activeBugs.toString(), subtitle: "Logs", subInfo: "À corriger", icon: Bug },
    { title: "Bugs Résolus", value: logs.filter(l => l.status === "RESOLVED").length.toString(), subtitle: "Logs", subInfo: "Total", icon: CheckCircle },
  ];

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Santé Système &amp; Audit
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <ShieldAlert size={11} /> Monitoring IA
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Surveillance en temps réel des erreurs runtime, diagnostic IA et journal d&apos;audit.</p>
        </div>
      </div>

      <KpiGrid kpis={kpiData} />

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Bug size={15} className="text-[#C7D300]" />
            <span>Journal des Erreurs Runtime</span>
          </h2>
          <span className="text-[11px] text-gray-400">{logs.length} entrée(s)</span>
        </div>

        <div className="p-4">
        {loading ? (
          <div className="flex justify-center p-8"><RefreshCw size={18} className="animate-spin text-[#C7D300]" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-400">Aucune erreur enregistrée. Le système est sain.</div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className={`border rounded-xl p-4 transition-colors ${log.status === "RESOLVED" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase border ${log.severity === "CRITICAL" ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : "bg-amber-500/15 text-amber-300 border-amber-500/25"}`}>
                        {log.severity || "MEDIUM"}
                      </span>
                      <span className="text-[11px] text-gray-500">Source : {log.source}</span>
                    </div>
                    <h3 className="text-xs font-semibold text-white mt-2">{log.message}</h3>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {log.status !== "RESOLVED" && (
                      <button
                        onClick={() => markResolved(log.id)}
                        className="px-2.5 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 rounded-lg text-[11px] font-semibold hover:bg-emerald-500/25 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Résoudre
                      </button>
                    )}
                  </div>
                </div>

                {log.stack && (
                  <pre className="mt-2 text-[11px] text-rose-300 bg-black/40 p-3 rounded-lg overflow-x-auto max-h-32 font-mono">
                    {log.stack}
                  </pre>
                )}

                {/* Section Analyse IA */}
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  {log.aiAnalysis ? (
                    <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-sky-300 flex items-center gap-1.5 mb-1.5">
                        <BrainCircuit size={14} /> Diagnostic IA
                      </h4>
                      <div className="text-xs text-gray-300 whitespace-pre-wrap">{log.aiAnalysis}</div>
                    </div>
                  ) : (
                    <button
                      onClick={() => analyzeBug(log.id)}
                      disabled={analyzing === log.id}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                    >
                      {analyzing === log.id ? <RefreshCw size={13} className="animate-spin" /> : <BrainCircuit size={13} />}
                      {analyzing === log.id ? "Analyse en cours..." : "Analyser avec l'IA"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      <AuditLogPanel />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
         <ActionCard 
          title="Testeur" 
          actions={[
            {
              title: "Générer une erreur de test",
              description: "Crée un log d'erreur fictif pour tester le tableau de bord.",
              buttonText: "Déclencher l'erreur",
              buttonColor: "bg-red-600 hover:bg-red-700",
              onClick: async () => {
                const { logError } = await import("@/lib/logger");
                logError(new Error("Erreur de test générée manuellement par l'admin."), { severity: "LOW", source: "Dashboard Test" });
              }
            }
          ]}
        />
      </div>
    </div>
  );
}
