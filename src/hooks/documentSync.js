// Sinkronisasi dokumen audit tenant dengan tabel audit_documents.
// Dipisah dari hook supaya aturan gabung/banding bisa diuji tanpa React.
import { resolvePersisted } from "./persistPolicy";

// Field yang hanya hidup di browser ini dan tidak pernah dikirim ke server:
// - activeTab: status tampilan, bukan isi dokumen.
// - aiConfig: memuat API key pribadi user; tidak boleh terbaca anggota lain.
export const LOCAL_ONLY_FIELDS = ["activeTab", "aiConfig"];

export function toRemote(data) {
  const out = { ...data };
  for (const f of LOCAL_ONLY_FIELDS) delete out[f];
  return out;
}

/** True bila isi yang akan dikirim ke server sama (perbedaan field lokal diabaikan). */
export function sameDocument(a, b) {
  if (!a || !b) return false;
  return JSON.stringify(toRemote(a)) === JSON.stringify(toRemote(b));
}

/** Dokumen server + field lokal milik browser ini. Null bila server belum punya dokumen. */
export function mergeRemote(defaultValue, remoteData, local) {
  const base = resolvePersisted(defaultValue, remoteData && toRemote(remoteData), { mode: "tenant" });
  if (!base) return null;
  for (const f of LOCAL_ONLY_FIELDS) {
    if (local && local[f] !== undefined) base[f] = local[f];
  }
  return base;
}

/**
 * Akses audit_documents untuk satu tenant, dengan optimistic concurrency:
 * tulis hanya berhasil bila nomor versi di server masih sama dengan yang terakhir dibaca.
 */
export function createDocumentStore(supabase, tenantId, slug) {
  const table = () => supabase.from("audit_documents");
  return {
    async load() {
      const { data, error } = await table()
        .select("data, version").eq("tenant_id", tenantId).eq("slug", slug).maybeSingle();
      if (error) throw new Error(error.message);
      return { data: data?.data ?? null, version: data?.version ?? null };
    },

    /** @returns {{status: "saved", version: number} | {status: "conflict"} | {status: "error", message: string}} */
    async save(doc, version) {
      const payload = toRemote(doc);
      if (version === null) {
        const { data, error } = await table()
          .insert({ tenant_id: tenantId, slug, data: payload }).select("version").single();
        if (error) {
          // 23505: anggota lain sudah membuat dokumen ini lebih dulu.
          return error.code === "23505" ? { status: "conflict" } : { status: "error", message: error.message };
        }
        return { status: "saved", version: data.version };
      }
      const { data, error } = await table()
        .update({ data: payload })
        .eq("tenant_id", tenantId).eq("slug", slug).eq("version", version)
        .select("version");
      if (error) return { status: "error", message: error.message };
      if (!data || data.length === 0) return { status: "conflict" };
      return { status: "saved", version: data[0].version };
    },
  };
}
