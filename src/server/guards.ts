import { NextRequest, NextResponse } from "next/server";
import { getServerCaller, ServerCaller } from "@/lib/serverAuth";
import { hasStaffPermission, StaffPermission } from "@/domain/permissions";
import { AccountType, getAccountType, isSuperAdmin } from "@/domain/roles";

export interface GuardResult {
  ok: boolean;
  caller: ServerCaller | null;
  errorResponse?: NextResponse;
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
 * Exige que l'appelant possède une permission spécifique.
 * Le SuperAdmin a toujours toutes les permissions.
 */
export async function requireStaffPermission(
  req: NextRequest | Request,
  permission: StaffPermission
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

  if (isSuperAdmin(caller) || hasStaffPermission(caller.data || caller, permission)) {
    return { ok: true, caller };
  }

  return {
    ok: false,
    caller,
    errorResponse: NextResponse.json(
      { success: false, error: `Permission refusée : action requiert [${permission}].` },
      { status: 403 }
    ),
  };
}

/**
 * Exige que l'appelant soit le Super Administrateur (Directeur Général).
 */
export async function requireSuperAdminCaller(req: NextRequest | Request): Promise<GuardResult> {
  const caller = await getServerCaller(req);
  if (!caller || !isSuperAdmin(caller)) {
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

