"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShieldAlert, Bug, RefreshCw, CheckCircle, Activity, BrainCircuit } from "lucide-react";
import ActionCard from "@/modules/supplier/components/dashboards/shared/ActionCard";
import KpiGrid from "@/modules/supplier/components/dashboards/shared/KpiGrid";

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
      const res = await fetch("/api/ai/analyze-bug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      if (!res.ok) throw new Error("Failed to analyze");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'analyse avec l'IA.");
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
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-500 flex items-center gap-3">
            <ShieldAlert size={32} className="text-red-500" />
            Agent Détecteur de Bugs
          </h1>
          <p className="text-gray-400 mt-1">Surveillance de la santé de l'application et analyse IA des erreurs.</p>
        </div>
      </div>

      <KpiGrid kpis={kpiData} />

      <div className="bg-[#0F1D27] border border-white/10 rounded-3xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Bug className="text-[#C7D300]" /> Journal des Erreurs (Runtime)
        </h2>
        
        {loading ? (
          <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-[#C7D300]" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center p-8 text-gray-400">Aucune erreur enregistrée. Le système est sain !</div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className={`border rounded-xl p-4 transition-colors ${log.status === "RESOLVED" ? "bg-green-900/10 border-green-500/20" : "bg-red-900/10 border-red-500/30"}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${log.severity === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-orange-500/20 text-orange-400'}`}>
                      {log.severity || "MEDIUM"}
                    </span>
                    <span className="text-xs text-gray-500 ml-3">Source: {log.source}</span>
                    <h3 className="text-lg font-medium text-white mt-2">{log.message}</h3>
                  </div>
                  <div className="flex gap-2">
                    {log.status !== "RESOLVED" && (
                      <button 
                        onClick={() => markResolved(log.id)}
                        className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
                      >
                        Résoudre
                      </button>
                    )}
                  </div>
                </div>
                
                {log.stack && (
                  <pre className="mt-2 text-xs text-red-300 bg-black/40 p-3 rounded-lg overflow-x-auto max-h-32">
                    {log.stack}
                  </pre>
                )}

                {/* Section Analyse IA */}
                <div className="mt-4 border-t border-white/5 pt-4">
                  {log.aiAnalysis ? (
                    <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2 mb-2">
                        <BrainCircuit size={16} /> Diagnostic de l'Agent IA
                      </h4>
                      <div className="text-sm text-gray-300 whitespace-pre-wrap">{log.aiAnalysis}</div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => analyzeBug(log.id)}
                      disabled={analyzing === log.id}
                      className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {analyzing === log.id ? <RefreshCw size={16} className="animate-spin" /> : <BrainCircuit size={16} />}
                      {analyzing === log.id ? "Analyse en cours..." : "Demander une analyse à l'IA"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
