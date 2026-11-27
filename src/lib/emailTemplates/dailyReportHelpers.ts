export type RayonType = "immo" | "mode" | "connect" | "saveurs" | "store";

export function parseReportDate(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === "object" && val !== null) {
    const record = val as { toDate?: () => Date; _seconds?: number };
    if (typeof record.toDate === "function") return record.toDate();
    if (typeof record._seconds === "number") return new Date(record._seconds * 1000);
  }
  if (typeof val === "number") return new Date(val);
  if (typeof val === "string") {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function getRayonType(d: Record<string, unknown>): RayonType {
  const role = String(d.role || "").toLowerCase();
  if (role.includes("immo")) return "immo";
  if (role.includes("mode")) return "mode";
  if (role.includes("connect") || role.includes("tech")) return "connect";
  if (role.includes("food") || role.includes("saveur")) return "saveurs";

  if (Array.isArray(d.rayons) && d.rayons.length > 0) {
    const r = String(d.rayons[0] || "").toLowerCase();
    if (r === "immo") return "immo";
    if (r === "mode") return "mode";
    if (r === "connect") return "connect";
    if (r === "saveurs" || r === "food") return "saveurs";
  }

  const rayon = String(d.rayon || "").toLowerCase();
  if (rayon === "immo") return "immo";
  if (rayon === "mode") return "mode";
  if (rayon === "connect") return "connect";
  if (rayon === "saveurs" || rayon === "food") return "saveurs";

  return "store";
}

export function extractSubAdminRayons(d: Record<string, unknown>): string[] {
  const set = new Set<string>();
  const addIfValid = (val: unknown) => {
    if (typeof val !== "string") return;
    const lower = val.trim().toLowerCase();
    if (!lower || lower === "non assigné" || lower === "tous" || lower === "all" || lower === "general") return;
    if (lower.includes("immo") || lower.includes("estate") || lower.includes("logement")) set.add("immo");
    else if (lower.includes("mode") || lower.includes("fashion") || lower.includes("vetement")) set.add("mode");
    else if (lower.includes("connect") || lower.includes("tech") || lower.includes("electr")) set.add("connect");
    else if (lower.includes("saveur") || lower.includes("resto") || lower.includes("food") || lower.includes("cuisine")) set.add("saveurs");
  };

  if (Array.isArray(d.assignedRayons)) {
    d.assignedRayons.forEach(addIfValid);
  } else if (typeof d.assignedRayons === "string") {
    addIfValid(d.assignedRayons);
  }
  if (Array.isArray(d.rayons)) {
    d.rayons.forEach(addIfValid);
  }
  addIfValid(d.rayon);
  addIfValid(d.serviceAttached);
  addIfValid(d.department);

  return Array.from(set);
}

export function getSubAdminRoleTitle(role?: string): string {
  const r = (role || "").toUpperCase();
  if (r.includes("FINANCE")) return "Gestionnaire Financier & Comptabilité";
  if (r.includes("DB") || r.includes("TECH")) return "Gestionnaire Base de Données & Catalogue";
  if (r.includes("OPS")) return "Gestionnaire des Opérations & Logistique";
  return "Sous-Administrateur";
}
