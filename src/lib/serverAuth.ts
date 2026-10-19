import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * Helpers d'authentification pour les Route Handlers (serveur uniquement).
 * Vérifie le token Firebase envoyé dans l'en-tête `Authorization: Bearer <idToken>`.
 */

export const SUPER_ADMIN_EMAILS = ["danielkiboko218@gmail.com", "admin@rayons.net"];
export const ADMIN_ROLES = [
  "SUPER_ADMIN", "SUPERADMIN", "SUB_ADMIN", "ADMIN", "ADMIN_FINANCE",
  "ADMIN_OPS", "ADMIN_DB", "ADMIN_TECH", "SOUS_ADMIN_GENERAL",
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
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    const snap = await adminDb.collection("users").doc(decoded.uid).get();
    const data = snap.exists ? snap.data() || {} : {};
    const email = (decoded.email || data.email || "").toLowerCase().trim();
    const role = String(data.role || decoded.role || "").toUpperCase();
    return {
      uid: decoded.uid,
      email,
      role,
      isAdmin: SUPER_ADMIN_EMAILS.includes(email) || ADMIN_ROLES.includes(role),
      parentSupplierId: data.parentSupplierId || null,
      data,
    };
  } catch {
    return null;
  }
}

/** Le caller peut-il agir pour le compte de ce fournisseur ? (lui-même, son sous-compte, ou un admin) */
export function canActForSupplier(caller: ServerCaller | null, supplierId: string): boolean {
  if (!caller || !supplierId) return false;
  return caller.isAdmin || caller.uid === supplierId || caller.parentSupplierId === supplierId;
}
