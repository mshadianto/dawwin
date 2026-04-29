// ═══════════════════════════════════════════════════════
// supabaseClient.js
// Lazy Supabase SDK wrapper — graceful degradation jika
// SDK tidak tersedia atau credentials kosong
// DAWWIN v4 — Session 4
// ═══════════════════════════════════════════════════════

const STORAGE_KEYS = {
  url: "dawwin-supabase-url",
  anonKey: "dawwin-supabase-anon-key",
  enabled: "dawwin-supabase-enabled",
};

// ─── Singleton state ─────
let _client = null;
let _config = null;
let _statusListeners = new Set();
let _connectionStatus = {
  state: "disconnected", // disconnected | connecting | connected | error
  latency: null,
  lastSync: null,
  error: null,
};

// ─── Status pub/sub ─────
function notifyStatus() {
  _statusListeners.forEach(cb => {
    try { cb({ ..._connectionStatus }); } catch (e) {}
  });
}

export function subscribeStatus(callback) {
  _statusListeners.add(callback);
  callback({ ..._connectionStatus });
  return () => _statusListeners.delete(callback);
}

export function getStatus() {
  return { ..._connectionStatus };
}

function setStatus(patch) {
  _connectionStatus = { ..._connectionStatus, ...patch };
  notifyStatus();
}

// ─── Config persistence ─────
export function getStoredConfig() {
  try {
    return {
      url: localStorage.getItem(STORAGE_KEYS.url) || "",
      anonKey: localStorage.getItem(STORAGE_KEYS.anonKey) || "",
      enabled: localStorage.getItem(STORAGE_KEYS.enabled) === "true",
    };
  } catch {
    return { url: "", anonKey: "", enabled: false };
  }
}

export function saveConfig({ url, anonKey, enabled }) {
  try {
    if (url !== undefined) localStorage.setItem(STORAGE_KEYS.url, url);
    if (anonKey !== undefined) localStorage.setItem(STORAGE_KEYS.anonKey, anonKey);
    if (enabled !== undefined) localStorage.setItem(STORAGE_KEYS.enabled, enabled ? "true" : "false");
  } catch {}
  _config = { ...getStoredConfig() };
}

// ─── Lazy SDK loader ─────
async function loadSupabaseSDK() {
  // Try dynamic import dari npm (supabase-js v2)
  try {
    const mod = await import("@supabase/supabase-js");
    return mod.createClient;
  } catch (e) {
    // Fallback: try ESM CDN
    try {
      const mod = await import("https://esm.sh/@supabase/supabase-js@2");
      return mod.createClient;
    } catch (e2) {
      throw new Error("Supabase SDK tidak tersedia. Install: npm install @supabase/supabase-js");
    }
  }
}

// ─── Client management ─────
export async function initClient(forceReinit = false) {
  const cfg = getStoredConfig();
  if (!cfg.url || !cfg.anonKey) {
    setStatus({ state: "disconnected", error: "URL atau Anon Key belum diisi" });
    return null;
  }

  if (_client && !forceReinit) return _client;

  setStatus({ state: "connecting", error: null });

  try {
    const createClient = await loadSupabaseSDK();
    _client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 2 } },
    });
    _config = cfg;
    setStatus({ state: "connected", error: null });
    return _client;
  } catch (e) {
    _client = null;
    setStatus({ state: "error", error: e.message });
    return null;
  }
}

export function getClient() {
  return _client;
}

export function disconnect() {
  if (_client) {
    try { _client.removeAllChannels?.(); } catch {}
    _client = null;
  }
  setStatus({ state: "disconnected", latency: null });
}

// ─── Health check (ping) ─────
export async function ping() {
  if (!_client) {
    return { ok: false, error: "Client belum terkoneksi" };
  }
  const start = performance.now();
  try {
    // Ping via simple SELECT count
    const { error } = await _client.from("lhas").select("id", { count: "exact", head: true });
    const latency = Math.round(performance.now() - start);
    if (error && error.code !== "PGRST116") {
      // PGRST116 = table not found (still means connection is OK)
      throw error;
    }
    setStatus({ state: "connected", latency, lastSync: new Date().toISOString(), error: null });
    return { ok: true, latency };
  } catch (e) {
    setStatus({ state: "error", error: e.message });
    return { ok: false, error: e.message };
  }
}

// ─── Table operations ─────
export async function fetchAllLhas() {
  if (!_client) throw new Error("Not connected");
  const { data: lhas, error: lhaErr } = await _client.from("lhas").select("*").order("date", { ascending: false });
  if (lhaErr) throw lhaErr;

  const { data: findings, error: findErr } = await _client.from("findings").select("*");
  if (findErr) throw findErr;

  const { data: fraud, error: fraudErr } = await _client.from("fraud_indicators").select("*");
  if (fraudErr) throw fraudErr;

  // Group findings & fraud by lha_number
  const findingsByLha = {};
  const fraudByLha = {};
  (findings || []).forEach(f => {
    const num = f.lha_number || f.lhaNumber;
    if (!findingsByLha[num]) findingsByLha[num] = [];
    findingsByLha[num].push(f);
  });
  (fraud || []).forEach(f => {
    const num = f.lha_number || f.lhaNumber;
    if (!fraudByLha[num]) fraudByLha[num] = [];
    fraudByLha[num].push(f);
  });

  return (lhas || []).map(l => ({
    ...l,
    findings: findingsByLha[l.number] || [],
    fraudIndicators: fraudByLha[l.number] || [],
  }));
}

export async function upsertLha(lha) {
  if (!_client) throw new Error("Not connected");
  const { findings, fraudIndicators, ...lhaCore } = lha;
  const { error } = await _client.from("lhas").upsert(lhaCore, { onConflict: "number" });
  if (error) throw error;
  setStatus({ lastSync: new Date().toISOString() });
  return { ok: true };
}

export async function upsertFinding(finding) {
  if (!_client) throw new Error("Not connected");
  const { error } = await _client.from("findings").upsert(finding, { onConflict: "id" });
  if (error) throw error;
  setStatus({ lastSync: new Date().toISOString() });
  return { ok: true };
}

export async function deleteFinding(id) {
  if (!_client) throw new Error("Not connected");
  const { error } = await _client.from("findings").delete().eq("id", id);
  if (error) throw error;
  setStatus({ lastSync: new Date().toISOString() });
  return { ok: true };
}

// ─── Bulk push: JSON → Supabase (seed) ─────
export async function pushAllLhas(lhas) {
  if (!_client) throw new Error("Not connected");
  if (!Array.isArray(lhas)) throw new Error("lhas must be array");

  const stats = { lhas: 0, findings: 0, fraud: 0, errors: [] };

  for (const lha of lhas) {
    try {
      const { findings = [], fraudIndicators = [], ...lhaCore } = lha;
      // Upsert LHA
      const { error: lhaErr } = await _client.from("lhas").upsert(lhaCore, { onConflict: "number" });
      if (lhaErr) { stats.errors.push(`LHA ${lha.number}: ${lhaErr.message}`); continue; }
      stats.lhas += 1;

      // Upsert findings (with lha_number FK)
      if (findings.length > 0) {
        const findingsWithFK = findings.map(f => ({ ...f, lha_number: lha.number }));
        const { error: fErr } = await _client.from("findings").upsert(findingsWithFK, { onConflict: "id" });
        if (fErr) stats.errors.push(`Findings ${lha.number}: ${fErr.message}`);
        else stats.findings += findings.length;
      }

      // Upsert fraud indicators
      if (fraudIndicators.length > 0) {
        const fraudWithFK = fraudIndicators.map(fi => ({ ...fi, lha_number: lha.number }));
        const { error: frErr } = await _client.from("fraud_indicators").upsert(fraudWithFK, { onConflict: "id" });
        if (frErr) stats.errors.push(`Fraud ${lha.number}: ${frErr.message}`);
        else stats.fraud += fraudIndicators.length;
      }
    } catch (e) {
      stats.errors.push(`${lha.number}: ${e.message}`);
    }
  }

  setStatus({ lastSync: new Date().toISOString() });
  return stats;
}

// ─── Real-time subscription ─────
export function subscribeChanges(table, callback) {
  if (!_client) {
    console.warn("[Supabase] Not connected — subscription skipped");
    return () => {};
  }
  const channel = _client
    .channel(`dawwin-${table}-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
      try { callback(payload); } catch (e) { console.error(e); }
    })
    .subscribe();
  return () => {
    try { _client.removeChannel(channel); } catch {}
  };
}

// ─── Audit trail (changelog) ─────
export async function logActivity({ action, entity, entityId, details, userId = "anonymous" }) {
  if (!_client) return { ok: false };
  try {
    const { error } = await _client.from("activity_log").insert({
      action, entity, entity_id: entityId,
      details: details ? JSON.stringify(details) : null,
      user_id: userId,
      created_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function fetchActivityLog(limit = 50) {
  if (!_client) return [];
  const { data, error } = await _client
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[Supabase] fetchActivityLog:", error);
    return [];
  }
  return data || [];
}
