export const RAYON_META: Record<string, { label: string; badgeClass: string }> = {
  immo: { label: "Immo", badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/20" },
  mode: { label: "Mode", badgeClass: "bg-pink-500/10 text-pink-300 border-pink-500/20" },
  connect: { label: "Connect", badgeClass: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" },
  saveurs: { label: "Saveurs", badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  all: { label: "Multi-Rayons", badgeClass: "bg-white/10 text-gray-200 border-white/15" },
};

export const PAYMENT_CHANNELS = [
  "M-Pesa",
  "Airtel Money",
  "Orange Money",
  "Virement Bancaire",
  "Espèces (Caisse Centrale)",
  "Carte Visa / Mastercard",
];

export function formatRayonBadge(rayon?: string) {
  const key = String(rayon || "connect").toLowerCase().trim();
  if (key.includes("immo")) return RAYON_META.immo;
  if (key.includes("mode")) return RAYON_META.mode;
  if (key.includes("saveur")) return RAYON_META.saveurs;
  return RAYON_META.connect;
}

export function formatEntryDate(raw: any): string {
  if (!raw) return "—";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}
