// Aturan kapan data tersimpan dipakai atau dibuang. Dipisah dari hook supaya bisa diuji.

export const SCHEMA_VERSION = "2026-04-30-renstra";

export function storageKeyFor(key, tenantId) {
  return tenantId ? `${key}:${tenantId}` : key;
}

function isLegacyBpkhData(data) {
  try {
    return /BPKH|Pengelola Keuangan Haji|PBPKH|Keuangan Haji/i.test(JSON.stringify(data));
  } catch { return false; }
}

/**
 * Mengembalikan state gabungan, atau null bila data tersimpan harus diabaikan.
 * - mode "demo": data contoh versi lama dibuang supaya demo selalu segar.
 * - mode "tenant": data klien tidak pernah dibuang karena isi atau versi skemanya.
 */
export function resolvePersisted(defaultValue, stored, { mode }) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  if (mode !== "tenant") {
    if (stored._schemaVersion !== SCHEMA_VERSION || isLegacyBpkhData(stored)) return null;
  }
  return { ...defaultValue, ...stored, _schemaVersion: SCHEMA_VERSION };
}
