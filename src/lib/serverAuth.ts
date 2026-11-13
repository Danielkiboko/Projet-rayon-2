import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * Helpers d'authentification pour les Route Handlers (serveur uniquement).
 * Vérifie le token Firebase envoyé dans l'en-tête `Authorization: Bearer <idToken>`.
 */

const DEFAULT_SUPER_ADMIN_EMAILS = [
  "danielkiboko218@gmail.com",
  "admin@rayons.net",
];

const envSuperAdmins = (
  process.env.SUPER_ADMIN_EMAILS || 
  process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || 
  ""
)
  .replace(/["']/g, "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const SUPER_ADMIN_EMAILS: string[] = Array.from(
  new Set([...DEFAULT_SUPER_ADMIN_EMAILS, ...envSuperAdmins])
);

export const ADMIN_ROLES = [
  "SUPER_ADMIN", "SUPERADMIN", "SUB_ADMIN", "SUBADMIN", "SOUS_ADMIN", "SOUSADMIN",
  "ADMIN", "ADMIN_FINANCE", "ADMIN_OPS", "ADMIN_DB", "ADMIN_TECH",
  "SOUS_ADMIN_GENERAL", "FONCTIONNAIRE", "STAFF"
];

export interface ServerCaller {
  uid: string;
  email: string;
  role: string;
  isAdmin: boolean;
  parentSupplierId: string | null;
  data: Record<string, any>;
}

export async function getServerCaller(req: Request): Promise<ServerCaller | null> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn("[getServerCaller] No Bearer token found in Authorization header");
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    console.warn("[getServerCaller] Empty token in Authorization header");
    return null;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    let data: Record<string, any> = {};
    try {
      const snap = await adminDb.collection("users").doc(decoded.uid).get();
      if (snap.exists) {
        data = snap.data() || {};
      }
    } catch (dbErr) {
      console.warn("[getServerCaller] Could not fetch users document:", dbErr);
    }

    const email = (decoded.email || data.email || "").toLowerCase().trim();
    const role = String(data.role || decoded.role || "").toUpperCase().trim();

    const isSuperAdminEmail = SUPER_ADMIN_EMAILS.some((e) => e === email);
    const hasAdminRole = 
      ADMIN_ROLES.includes(role) || 
      role.includes("ADMIN") || 
      role.includes("FONCTIONNAIRE") ||
      data.isAdmin === true || 
      data.isSuperAdmin === true ||
      decoded.admin === true ||
      decoded.isSuperAdmin === true;

    const isAdmin = isSuperAdminEmail || hasAdminRole;

    if (!isAdmin) {
      console.warn(`[getServerCaller] Access denied: uid=${decoded.uid}, email=${email}, role=${role}`);
    }

    return {
      uid: decoded.uid,
      email,
      role,
      isAdmin,
      parentSupplierId: data.parentSupplierId || null,
      data,
    };
  } catch (err: any) {
    console.error("[getServerCaller ERROR verifying token]:", err?.message || err);
    return null;
  }
}

/** Le caller peut-il agir pour le compte de ce fournisseur ? (lui-même, son sous-compte, ou un admin) */
export function canActForSupplier(caller: ServerCaller | null, supplierId: string): boolean {
  if (!caller || !supplierId) return false;
  return caller.isAdmin || caller.uid === supplierId || caller.parentSupplierId === supplierId;
}
