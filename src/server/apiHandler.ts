import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { ServerCaller } from "@/lib/serverAuth";
import { enforceRateLimit } from "@/lib/rateLimit";
import { safeApiError } from "@/lib/sanitize";
import { StaffPermission } from "@/domain/permissions";
import {
  requireAuthenticatedCaller,
  requireAdminCaller,
  requireFullAdminCaller,
  requireSuperAdminCaller,
  requireSupplierOrAdminCaller,
  requireAnyStaffPermission,
  requireCronOrAdminCaller,
} from "@/server/guards";

export type ApiAuthMode =
  | "public"
  | "authenticated"
  | "admin"
  | "fullAdmin"
  | "superAdmin"
  | "supplierOrAdmin"
  | "cron";

export interface ApiRouteOptions<TBody = unknown> {
  auth?: ApiAuthMode;
  permissions?: StaffPermission[];
  rateLimit?: {
    scope: string;
    max: number;
    windowSec?: number;
  };
  schema?: ZodType<TBody>;
  errorFallback?: string;
}

export interface ApiContext<TBody = unknown> {
  req: NextRequest;
  caller: ServerCaller | null;
  body: TBody;
}

/**
 * Wrapper API unifié Rayons.net :
 * 1. Rate-limit distribué Redis (Upstash + fallback L1)
 * 2. Authentification & autorisation centralisées (`src/server/guards.ts`)
 * 3. Validation stricte Zod sur le corps JSON (si `schema` fourni)
 * 4. Capture centralisée des erreurs avec `safeApiError` (zéro fuite de stack / message interne en prod)
 */
export function createApiHandler<TBody = unknown>(
  options: ApiRouteOptions<TBody>,
  handler: (ctx: ApiContext<TBody>) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // 1. Rate-limiting distribué Redis
      if (options.rateLimit) {
        const rl = await enforceRateLimit(
          req,
          options.rateLimit.scope,
          options.rateLimit.max,
          options.rateLimit.windowSec ?? 60
        );
        if (rl) return rl;
      }

      // 2. Authentification & Autorisation
      let caller: ServerCaller | null = null;
      if (options.permissions && options.permissions.length > 0) {
        const guard = await requireAnyStaffPermission(req, options.permissions);
        if (!guard.ok) return guard.errorResponse!;
        caller = guard.caller;
      } else {
        const mode = options.auth || "public";
        if (mode === "authenticated") {
          const guard = await requireAuthenticatedCaller(req);
          if (!guard.ok) return guard.errorResponse!;
          caller = guard.caller;
        } else if (mode === "admin") {
          const guard = await requireAdminCaller(req);
          if (!guard.ok) return guard.errorResponse!;
          caller = guard.caller;
        } else if (mode === "fullAdmin") {
          const guard = await requireFullAdminCaller(req);
          if (!guard.ok) return guard.errorResponse!;
          caller = guard.caller;
        } else if (mode === "superAdmin") {
          const guard = await requireSuperAdminCaller(req);
          if (!guard.ok) return guard.errorResponse!;
          caller = guard.caller;
        } else if (mode === "supplierOrAdmin") {
          const guard = await requireSupplierOrAdminCaller(req);
          if (!guard.ok) return guard.errorResponse!;
          caller = guard.caller;
        } else if (mode === "cron") {
          const guard = await requireCronOrAdminCaller(req);
          if (!guard.ok) return guard.errorResponse!;
          caller = guard.caller;
        }
      }

      // 3. Parsing & Validation Zod optionnelle
      let parsedBody = undefined as unknown as TBody;
      if (options.schema) {
        const rawJson = await req.json().catch(() => null);
        if (!rawJson || typeof rawJson !== "object") {
          return NextResponse.json(
            { success: false, error: "Corps de requête JSON invalide." },
            { status: 400 }
          );
        }
        const validated = options.schema.safeParse(rawJson);
        if (!validated.success) {
          const firstIssue = validated.error.issues[0];
          const fieldHint = firstIssue?.path?.length ? `${firstIssue.path.join(".")}: ` : "";
          return NextResponse.json(
            {
              success: false,
              error: `${fieldHint}${firstIssue?.message || "Données invalides."}`,
            },
            { status: 400 }
          );
        }
        parsedBody = validated.data;
      }

      return await handler({ req, caller, body: parsedBody });
    } catch (error: unknown) {
      console.error(`[API ${options.rateLimit?.scope || req.nextUrl.pathname} ERROR]:`, error);
      return NextResponse.json(
        {
          success: false,
          error: safeApiError(error, options.errorFallback || "Une erreur interne est survenue."),
        },
        { status: 500 }
      );
    }
  };
}
