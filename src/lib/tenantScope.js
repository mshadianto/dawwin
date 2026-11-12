// Tenant aktif untuk kode di luar React tree (kunci localStorage, cache).
// Disetel oleh TenantScopedApp sebelum subtree tenant dirender.

let activeTenantId = null;

export function setActiveTenant(tenantId) {
  activeTenantId = tenantId || null;
}

export function getActiveTenant() {
  return activeTenantId;
}

/** Kunci localStorage yang terpisah per tenant; mode demo memakai kunci polos. */
export function scopedKey(base, tenantId = activeTenantId) {
  return tenantId ? `${base}:${tenantId}` : base;
}
