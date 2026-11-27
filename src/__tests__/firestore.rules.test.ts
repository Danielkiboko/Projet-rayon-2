import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rulesPath = path.resolve(process.cwd(), "firestore.rules");
const rulesContent = fs.readFileSync(rulesPath, "utf8");

describe("firestore.rules security invariants", () => {
  it("uses rules_version 2 and a default deny-all catch-all", () => {
    expect(rulesContent).toContain("rules_version = '2'");
    expect(rulesContent).toMatch(/match \/\{document=\*\*\}\s*\{[\s\S]*allow read, write: if false;/);
  });

  it("never grants unrestricted public write access", () => {
    expect(rulesContent).not.toMatch(/allow\s+(write|create|update|delete)\s*:\s*if\s+true\s*;/);
  });

  it("keeps accounting_ledger and audit_logs strictly server-only for writes", () => {
    expect(rulesContent).toMatch(/match \/accounting_ledger\/\{entryId\}[\s\S]*allow write: if false;/);
    expect(rulesContent).toMatch(/match \/audit_logs\/\{logId\}[\s\S]*allow write: if false;/);
  });
});
