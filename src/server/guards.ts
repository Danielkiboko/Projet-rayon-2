import { NextRequest, NextResponse } from "next/server";
import { getServerCaller, ServerCaller } from "@/lib/serverAuth";
import { hasStaffPermission, StaffPermission } from "@/domain/permissions";
import { isSuperAdmin, isSupplier, isDriver } from "@/domain/roles";

export interface GuardResult {
  ok: boolean;
  caller: ServerCaller | null;
  errorResponse?: NextResponse;
}

function buildSubject(caller: ServerCaller) {
  return {
    ...(caller.data || {}),
    email: caller.email,
    role: caller.role,
  };
}

/**
 * Exige uniquement que l'appelant soit authentifié avec un token Firebase valide.
 */
export async function requireAuthenticatedCaller(req: NextRequest | Request): Promise<GuardResult> {
  const caller = await getServerCaller(req);
  if (!caller) {
    return {
      ok: false,
      caller: null,
      errorResponse: NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 }
      ),
    };
  }
  return { ok: true, caller };
}

/**
 * Exige que l'appelant soit authentifié et soit un administrateur (Staff ou SuperAdmin).
 */
export async function requireAdminCaller(req: NextRequest | Request): Promise<GuardResult> {
  const caller = await getServerCaller(req);
  if (!caller || !caller.isAdmin) {
    return {
      ok: false,
      caller: null,
      errorResponse: NextResponse.json(
        { success: false, error: "Accès réservé aux administrateurs." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, caller };
}

/**
 * Exige que l'appelant possède au moins UNE des permissions listées (cloisonnement strict des fonctionnaires).
 * Le SuperAdmin a toujours toutes les permissions.
 */
export async function requireAnyStaffPermission(
  req: NextRequest | Request,
  permissions: StaffPermission[]
): Promise<GuardResult> {
  const caller = await getServerCaller(req);
  if (!caller) {
    return {
      ok: false,
      caller: null,
      errorResponse: NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 }
      ),
    };
  }

  const subject = buildSubject(caller);
  if (isSuperAdmin(subject) || permissions.some((p) => hasStaffPermission(subject, p))) {
    return { ok: true, caller };
  }

  return {
    ok: false,
    caller,
    errorResponse: NextResponse.json(
      { success: false, error: `Permission refusée : poste non autorisé (${permissions.join(" ou ")}).` },
      { status: 403 }
    ),
  };
}

/**
 * Exige que l'appelant possède une permission spécifique.
 * Le SuperAdmin a toujours toutes les permissions.
 */
export async function requireStaffPermission(
  req: NextRequest | Request,
  permission: StaffPermission
): Promise<GuardResult> {
  return requireAnyStaffPermission(req, [permission]);
}

/**
 * Exige que l'appelant soit Super Admin ou Sous-Administrateur Général (Direction).
 */
export async function requireFullAdminCaller(req: NextRequest | Request): Promise<GuardResult> {
  const caller = await getServerCaller(req);
  if (!caller) {
    return {
      ok: false,
      caller: null,
      errorResponse: NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 }
      ),
    };
  }
  const subject = buildSubject(caller);
  const role = String(caller.role || "").toUpperCase();
  const positions: string[] = Array.isArray(caller.data?.staffProfile?.positions)
    ? caller.data.staffProfile.positions
    : [];
  const isFull =
    isSuperAdmin(subject) ||
    role === "SUB_ADMIN" ||
    role === "SUBADMIN" ||
    role === "ADMIN" ||
    positions.includes("SUB_ADMIN");
  if (!isFull) {
    return {
      ok: false,
      caller,
      errorResponse: NextResponse.json(
        { success: false, error: "Action réservée à la Direction Générale / Sous-Administration." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, caller };
}

/**
 * Exige que l'appelant soit le Super Administrateur (Directeur Général).
 */
export async function requireSuperAdminCaller(req: NextRequest | Request): Promise<GuardResult> {
  const caller = await getServerCaller(req);
  if (!caller || !isSuperAdmin(buildSubject(caller))) {
    return {
      ok: false,
      caller: null,
      errorResponse: NextResponse.json(
        { success: false, error: "Action strictement réservée au Super Administrateur." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, caller };
}

/**
 * Exige que l'appelant soit un Fournisseur (ou Sous-Fournisseur) ou un Administrateur.
 */
export async function requireSupplierOrAdminCaller(req: NextRequest | Request): Promise<GuardResult> {
  const caller = await getServerCaller(req);
  if (!caller) {
    return {
      ok: false,
      caller: null,
      errorResponse: NextResponse.json(
        { success: false, error: "Authentification requise." },
        { status: 401 }
      ),
    };
  }
  const subject = buildSubject(caller);
  if (caller.isAdmin || isSupplier(subject)) {
    return { ok: true, caller };
  }
  return {
    ok: false,
    caller,
    errorResponse: NextResponse.json(
      { success: false, error: "Action réservée aux fournisseurs ou à l'administration." },
      { status: 403 }
    ),
  };
}

/**
 * Helper interne : indique si l'appelant est un livreur, fournisseur ou admin.
 */
export function isOperationalCaller(caller: ServerCaller): boolean {
  const subject = buildSubject(caller);
  return caller.isAdmin || isSupplier(subject) || isDriver(subject);
}
