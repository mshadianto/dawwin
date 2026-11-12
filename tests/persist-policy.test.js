import { describe, it, expect } from "vitest";
import { resolvePersisted, storageKeyFor, SCHEMA_VERSION } from "../src/hooks/persistPolicy.js";

const DEFAULTS = { activeTab: "dashboard", findings: [] };

describe("resolvePersisted", () => {
  it("mode tenant: data klien yang menyebut BPKH tetap dipakai", () => {
    const stored = { _schemaVersion: SCHEMA_VERSION, findings: [{ title: "Audit Keuangan Haji BPKH" }] };
    expect(resolvePersisted(DEFAULTS, stored, { mode: "tenant" }).findings).toEqual(stored.findings);
  });

  it("mode tenant: data dengan versi skema lama tetap dipakai dan distempel ulang", () => {
    const out = resolvePersisted(DEFAULTS, { _schemaVersion: "2025-01-01", findings: [{ title: "T1" }] }, { mode: "tenant" });
    expect(out).toEqual({ activeTab: "dashboard", findings: [{ title: "T1" }], _schemaVersion: SCHEMA_VERSION });
  });

  it("mode demo: data contoh lama dibuang", () => {
    expect(resolvePersisted(DEFAULTS, { _schemaVersion: "2025-01-01" }, { mode: "demo" })).toBeNull();
    expect(resolvePersisted(DEFAULTS, { _schemaVersion: SCHEMA_VERSION, org: "BPKH" }, { mode: "demo" })).toBeNull();
  });

  it("mode demo: data versi sekarang digabung di atas default", () => {
    expect(resolvePersisted(DEFAULTS, { _schemaVersion: SCHEMA_VERSION, activeTab: "coso" }, { mode: "demo" }))
      .toEqual({ activeTab: "coso", findings: [], _schemaVersion: SCHEMA_VERSION });
  });

  it("nilai rusak diabaikan", () => {
    for (const bad of [null, undefined, "x", 3, []]) expect(resolvePersisted(DEFAULTS, bad, { mode: "tenant" })).toBeNull();
  });
});

describe("storageKeyFor", () => {
  it("memisahkan penyimpanan lokal demo dan tiap tenant", () => {
    expect(storageKeyFor("audit-doc-data", null)).toBe("audit-doc-data");
    expect(storageKeyFor("audit-doc-data", "t-1")).toBe("audit-doc-data:t-1");
    expect(storageKeyFor("audit-doc-data", "t-1")).not.toBe(storageKeyFor("audit-doc-data", "t-2"));
  });
});
