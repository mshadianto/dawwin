import { describe, it, expect } from "vitest";
import { toRemote, sameDocument, mergeRemote, LOCAL_ONLY_FIELDS } from "../src/hooks/documentSync.js";
import { SCHEMA_VERSION } from "../src/hooks/persistPolicy.js";

const DEFAULTS = { activeTab: "dashboard", aiConfig: { provider: "groq", apiKey: "" }, findings: [] };

describe("dokumen yang dikirim ke server", () => {
  it("tidak pernah memuat API key pribadi atau status tampilan", () => {
    const sent = toRemote({ activeTab: "coso", aiConfig: { provider: "groq", apiKey: "gsk_rahasia" }, findings: [1] });
    expect(sent).toEqual({ findings: [1] });
    expect(JSON.stringify(sent)).not.toContain("gsk_rahasia");
    expect(LOCAL_ONLY_FIELDS).toEqual(expect.arrayContaining(["aiConfig", "activeTab"]));
  });

  it("berpindah tab atau mengubah AI Settings tidak dihitung sebagai perubahan dokumen", () => {
    const a = { activeTab: "dashboard", aiConfig: { apiKey: "" }, findings: [1] };
    expect(sameDocument(a, { ...a, activeTab: "findings", aiConfig: { apiKey: "x" } })).toBe(true);
    expect(sameDocument(a, { ...a, findings: [1, 2] })).toBe(false);
    expect(sameDocument(a, null)).toBe(false);
  });
});

describe("mergeRemote", () => {
  it("isi dari server menang, field lokal browser ini dipertahankan", () => {
    const local = { activeTab: "coso", aiConfig: { provider: "groq", apiKey: "gsk_saya" }, findings: ["lokal basi"] };
    const out = mergeRemote(DEFAULTS, { findings: ["dari server"] }, local);
    expect(out).toEqual({ activeTab: "coso", aiConfig: local.aiConfig, findings: ["dari server"], _schemaVersion: SCHEMA_VERSION });
  });

  it("API key yang tersimpan di server oleh versi lama diabaikan", () => {
    const out = mergeRemote(DEFAULTS, { findings: [], aiConfig: { apiKey: "gsk_orang_lain" } }, { aiConfig: { apiKey: "" } });
    expect(out.aiConfig.apiKey).toBe("");
    const fresh = mergeRemote(DEFAULTS, { findings: [], aiConfig: { apiKey: "gsk_orang_lain" } }, null);
    expect(fresh.aiConfig).toEqual(DEFAULTS.aiConfig);
  });

  it("null bila server belum punya dokumen", () => {
    expect(mergeRemote(DEFAULTS, null, DEFAULTS)).toBeNull();
  });
});
