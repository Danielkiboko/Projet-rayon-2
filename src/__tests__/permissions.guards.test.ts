import { describe, expect, it } from "vitest";
import { getAccountType, isPartner, isStaff, isSuperAdmin, isSupplier } from "@/domain/roles";
import { hasStaffPermission } from "@/domain/permissions";
import { escapeHtml, safeApiError } from "@/lib/sanitize";
import { isProtectedSuperAdminEmail } from "@/server/guards";

describe("Domain roles & staff permissions", () => {
  it("recognizes Super Admin and grants all staff permissions", () => {
    const superAdmin = { email: "danielkiboko218@gmail.com", role: "SUPER_ADMIN" };
    expect(isSuperAdmin(superAdmin)).toBe(true);
    expect(isStaff(superAdmin)).toBe(true);
    expect(isProtectedSuperAdminEmail("DANIELKIBOKO218@gmail.com")).toBe(true);
    expect(isProtectedSuperAdminEmail("admin@rayons.net")).toBe(true);
    expect(isProtectedSuperAdminEmail("random@example.com")).toBe(false);
    expect(hasStaffPermission(superAdmin, "suppliers.manage")).toBe(true);
  });

  it("isolates PARTNER, SUPPLIER, and CLIENT account types strictly", () => {
    expect(getAccountType({ role: "PARTNER" })).toBe("PARTNER");
    expect(isPartner({ role: "PARTNER" })).toBe(true);
    expect(isSupplier({ role: "PARTNER" })).toBe(false);

    expect(getAccountType({ role: "SUPPLIER_IMMO" })).toBe("SUPPLIER");
    expect(isSupplier({ role: "SUPPLIER_IMMO" })).toBe(true);

    expect(getAccountType({ role: "customer" })).toBe("CLIENT");
    expect(hasStaffPermission({ role: "customer" }, "suppliers.manage")).toBe(false);
  });
});

describe("Sanitization & safe API error handling", () => {
  it("escapes HTML entities to prevent XSS in emails", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
  });

  it("masks internal technical errors in production", () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    try {
      const msg = safeApiError(new Error("FIREBASE_PRIVATE_KEY invalid PEM"), "Erreur interne");
      expect(msg).toBe("Erreur interne");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });
});
