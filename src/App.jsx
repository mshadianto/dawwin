import { TABS, STORAGE_KEY } from "./constants";
import DEFAULT_STATE from "./constants/defaultState";
import { usePersistedState } from "./hooks/usePersistedState";
import Dashboard from "./tabs/Dashboard";
import AuditInfoTab from "./tabs/AuditInfoTab";
import COSOTab from "./tabs/COSOTab";
import FindingsTab from "./tabs/FindingsTab";
import ObservationsTab from "./tabs/ObservationsTab";
import ActionPlanTab from "./tabs/ActionPlanTab";
import AnalyticsTab from "./tabs/AnalyticsTab";
import RiskTab from "./tabs/RiskTab";
import FraudTab from "./tabs/FraudTab";

const TAB_COMPONENTS = {
  dashboard: Dashboard,
  info: AuditInfoTab,
  coso: COSOTab,
  findings: FindingsTab,
  observations: ObservationsTab,
  actionplan: ActionPlanTab,
  analytics: AnalyticsTab,
  risk: RiskTab,
  fraud: FraudTab,
};

export default function AuditDocApp() {
  const { data, setData, saving } = usePersistedState(STORAGE_KEY, DEFAULT_STATE);

  const resetData = () => {
    if (confirm("Reset semua data ke contoh default? Data saat ini akan hilang.")) {
      setData(DEFAULT_STATE);
    }
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-doc-${data.auditInfo.number.replace(/\//g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ActiveTab = TAB_COMPONENTS[data.activeTab] || Dashboard;
  const isLHATab = ["analytics", "risk", "fraud"].includes(data.activeTab);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#F3F4F6", minHeight: "100vh", display: "flex" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: "linear-gradient(180deg, #1B365D 0%, #0F1F3D 100%)", color: "#fff", padding: "20px 0", flexShrink: 0, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "0 16px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.5 }}>{"🏛️"} AUDIT DOC</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2, letterSpacing: 0.5 }}>COSO 2013 {"×"} IIA Standards</div>
        </div>
        <div style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          {TABS.map(t => {
            if (t.divider) {
              return (
                <div key={t.id} style={{ padding: "14px 12px 6px", fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase" }}>
                  {t.label}
                </div>
              );
            }
            return (
              <button key={t.id} onClick={() => setData(d => ({ ...d, activeTab: t.id }))} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: data.activeTab === t.id ? 700 : 500, background: data.activeTab === t.id ? "rgba(255,255,255,0.15)" : "transparent", color: data.activeTab === t.id ? "#fff" : "rgba(255,255,255,0.6)", marginBottom: 2, fontFamily: "'DM Sans', sans-serif", textAlign: "left", transition: "all 0.15s" }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span> {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={exportJSON} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "6px 10px", color: "#fff", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>{"📥"} Export JSON</button>
          <button onClick={resetData} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>{"🔄"} Reset Data</button>
        </div>
        <div style={{ padding: "8px 16px", fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
          {saving ? "💾 Menyimpan..." : "✓ Tersimpan"}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {/* Branding */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", justifyContent: "flex-end", padding: "16px 28px 0" }}>
          <div style={{ textAlign: "right", lineHeight: 1.3 }}>
            <div style={{ fontFamily: "'Amiri', 'Noto Naskh Arabic', serif", fontSize: 28, fontWeight: 700, color: "#1B365D", letterSpacing: 1 }}>{"دوِّن"}</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#1B365D", letterSpacing: 2, marginTop: -2 }}>DAWWIN</div>
            <div style={{ fontSize: 10, color: "#64748B", fontWeight: 500, marginTop: 2 }}>AI-Powered Audit Documentation</div>
            <div style={{ fontSize: 9, color: "#94A3B8", fontWeight: 600, letterSpacing: 0.5 }}>COSO 2013 {"×"} IIA Standards</div>
            <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>by <span style={{ fontWeight: 700, color: "#1B365D" }}>MSHadianto</span></div>
          </div>
        </div>
        <div style={{ padding: "12px 28px 24px", maxWidth: isLHATab ? 1100 : 900 }}>
          {isLHATab ? <ActiveTab /> : <ActiveTab data={data} setData={setData} />}
        </div>
      </div>
    </div>
  );
}
