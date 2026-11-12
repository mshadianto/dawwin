import { useMemo } from "react";
import { TABS, STORAGE_KEY } from "./constants";
import DEFAULT_STATE from "./constants/defaultState";
import { usePersistedState } from "./hooks/usePersistedState";
import { useLHAData } from "./hooks/useLHAData";
import { LHAProvider } from "./contexts/LHAContext";
import { DataSourceProvider, useActiveData } from "./contexts/DataSourceContext";
import { adaptLhaParsedToCrossLha } from "./utils/lhaAdapter";
import LHASelector from "./components/LHASelector";
import { setActiveTenant } from "./lib/tenantScope";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AccountPanel from "./auth/AccountPanel";
import Dashboard from "./tabs/Dashboard";
import AuditInfoTab from "./tabs/AuditInfoTab";
import COSOTab from "./tabs/COSOTab";
import FindingsTab from "./tabs/FindingsTab";
import ObservationsTab from "./tabs/ObservationsTab";
import ActionPlanTab from "./tabs/ActionPlanTab";
import TimelineTab from "./tabs/TimelineTab";
import ReportTab from "./tabs/ReportTab";
import AISettingsTab from "./tabs/AISettingsTab";
import CrossLhaWrapper from "./tabs/CrossLhaWrapper";
import LHACompareTab from "./tabs/LHACompareTab";
import FraudHeatmapTab from "./tabs/FraudHeatmapTab";
import DataSourceTab from "./tabs/DataSourceTab";
import AuditUniverseTab from "./tabs/AuditUniverseTab";
import AuditPlanTab from "./tabs/AuditPlanTab";
import CommitteeReportTab from "./tabs/CommitteeReportTab";
import AnalyticsTab from "./tabs/AnalyticsTab";
import RiskTab from "./tabs/RiskTab";
import FraudTab from "./tabs/FraudTab";
import ISO31000Tab from "./tabs/ISO31000Tab";
import ROITab from "./tabs/ROITab";
import XAITab from "./tabs/XAITab";
import DriftTab from "./tabs/DriftTab";
import MLPipelineTab from "./ml/components/MLPipelineTab";
import AutoFEPanel from "./ml/components/AutoFEPanel";
import DataCopilotChat from "./ml/components/DataCopilotChat";

const TAB_COMPONENTS = {
  dashboard: Dashboard,
  info: AuditInfoTab,
  coso: COSOTab,
  findings: FindingsTab,
  observations: ObservationsTab,
  actionplan: ActionPlanTab,
  timeline: TimelineTab,
  report: ReportTab,
  aisettings: AISettingsTab,
  crosslha: CrossLhaWrapper,
  compare: LHACompareTab,
  fraud_heatmap: FraudHeatmapTab,
  data_source: DataSourceTab,
  audit_universe: AuditUniverseTab,
  audit_plan: AuditPlanTab,
  committee: CommitteeReportTab,
  analytics: AnalyticsTab,
  risk: RiskTab,
  fraud: FraudTab,
  iso31000: ISO31000Tab,
  roi: ROITab,
  xai: XAITab,
  drift: DriftTab,
  mlpipeline: MLPipelineTab,
  autofe: AutoFEPanel,
  copilot: DataCopilotChat,
};

const LHA_TAB_IDS = ["committee", "crosslha", "compare", "fraud_heatmap", "data_source", "audit_universe", "audit_plan", "analytics", "risk", "fraud", "iso31000", "roi", "xai", "drift", "mlpipeline", "autofe", "copilot"];

function MainShell() {
  const { tenant, canWrite, registerBeforeSignOut } = useAuth();
  const inTenant = Boolean(tenant);
  const { data, setData, saving, remote, syncFailed, conflict, flush, reload } =
    usePersistedState(STORAGE_KEY, DEFAULT_STATE, { tenantId: tenant?.id ?? null, canWrite });
  useEffect(() => registerBeforeSignOut(flush), [registerBeforeSignOut, flush]);

  const syncLabel = remote === "local" ? "LOKAL"
    : remote === "readonly" ? "HANYA BACA"
    : syncFailed ? "GAGAL SYNC"
    : saving ? "SYNCING..." : "SYNCED";
  const syncColor = syncFailed ? "#DC2626" : saving ? "#F59E0B" : remote === "readonly" ? "#94A3B8" : "#059669";
  const notice = remote === "readonly" ? "Peran Anda viewer: perubahan di layar ini tidak disimpan."
    : conflict ? "Dokumen ini baru saja diubah pengguna lain dan sudah dimuat ulang. Perubahan Anda yang belum tersimpan tidak diterapkan."
    : syncFailed ? "Perubahan belum tersimpan ke server. Aplikasi akan mencoba lagi pada perubahan berikutnya."
    : null;
  // Tab Data Source menyambung ke project Supabase lain tanpa isolasi tenant.
  const visibleTabs = inTenant ? TABS.filter(t => t.id !== "data_source") : TABS;

  const resetData = () => {
    const message = inTenant
      ? `Reset akan mengganti dokumen "${tenant.name}" di server dengan data contoh, untuk semua anggota. Lanjutkan?`
      : "Reset semua data ke contoh default? Data saat ini akan hilang.";
    if (confirm(message)) {
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

  const activeTabId = visibleTabs.some(t => t.id === data.activeTab) ? data.activeTab : "dashboard";
  const ActiveTab = TAB_COMPONENTS[activeTabId] || Dashboard;
  const isLHATab = LHA_TAB_IDS.includes(activeTabId);

  // Dokumen tenant tidak boleh diedit sebelum versi server termuat: suntingan
  // di atas salinan lama akan tertimpa, atau menimpa.
  if (remote === "loading" || remote === "error") {
    return (
      <FullScreenMessage
        text={remote === "loading" ? "MEMUAT DOKUMEN ORGANISASI..." : "Dokumen organisasi gagal dimuat. Tidak ada yang diubah."}
        action={remote === "error" ? { label: "COBA LAGI", onClick: reload } : null}
      />
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#F8F9FB", minHeight: "100vh", display: "flex" }}>
      {/* Sidebar — Professional Dark */}
      <div style={{
        width: 240, background: "#0F172A", color: "#fff", flexShrink: 0,
        display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh",
        borderRight: "1px solid #1E293B",
      }}>
        {/* Brand Header */}
        <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid #1E293B" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 3,
              background: "linear-gradient(135deg, #C9A84C 0%, #D4AF37 50%, #E8C84A 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Amiri', serif", fontSize: 18, fontWeight: 700, color: "#0F172A",
            }}>{"د"}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 2.5, fontFamily: "'DM Sans', sans-serif" }}>DAWWIN</div>
              <div style={{ fontSize: 8, color: "#64748B", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                Audit Intelligence
              </div>
            </div>
          </div>
        </div>

        {/* LHA Selector */}
        <div style={{ padding: "12px 0", borderBottom: "1px solid #1E293B" }}>
          <LHASelector />
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
          {visibleTabs.map(t => {
            if (t.divider) {
              return (
                <div key={t.id} style={{
                  padding: "20px 8px 8px", fontSize: 9, fontWeight: 700, letterSpacing: 2,
                  textTransform: "uppercase", color: "#475569",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {t.label}
                </div>
              );
            }
            const isActive = activeTabId === t.id;
            return (
              <button key={t.id} onClick={() => setData(d => ({ ...d, activeTab: t.id }))}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "9px 12px", borderRadius: 3, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  background: isActive ? "#1E293B" : "transparent",
                  color: isActive ? "#F8FAFC" : "#94A3B8",
                  marginBottom: 1, fontFamily: "'DM Sans', sans-serif", textAlign: "left",
                  transition: "all 0.15s",
                  borderLeft: isActive ? "2px solid #C9A84C" : "2px solid transparent",
                }}>
                <span style={{ fontSize: 14, width: 20, textAlign: "center", opacity: isActive ? 1 : 0.6 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div style={{ padding: "16px", borderTop: "1px solid #1E293B" }}>
          <AccountPanel />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={exportJSON} style={{
              flex: 1, background: "#1E293B", border: "1px solid #334155", borderRadius: 3,
              padding: "7px 10px", color: "#CBD5E1", fontSize: 10, cursor: "pointer", fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5,
            }}>EXPORT</button>
            <button onClick={resetData} style={{
              background: "transparent", border: "1px solid #334155", borderRadius: 3,
              padding: "7px 10px", color: "#64748B", fontSize: 10, cursor: "pointer", fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5,
            }}>RESET</button>
          </div>
          <div style={{
            padding: "8px 0 0", fontSize: 9, color: "#475569", textAlign: "center",
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5,
          }}>
            {syncLabel}
            <span style={{
              display: "inline-block", width: 6, height: 6, borderRadius: "50%",
              background: syncColor, marginLeft: 6, verticalAlign: "middle",
              animation: saving ? "pulse 1s infinite" : "none",
            }} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        {/* Top Bar */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "rgba(248,249,251,0.92)", backdropFilter: "blur(12px)",
          borderBottom: "1px solid #E2E8F0",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 32px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
              COSO 2013 Framework
            </span>
            <span style={{ color: "#CBD5E1" }}>{"/"}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
              IIA Global Standards
            </span>
          </div>
          <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <span style={{ fontFamily: "'Amiri', serif", fontSize: 20, fontWeight: 700, color: "#0F172A" }}>{"دوِّن"}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#0F172A", letterSpacing: 2, marginLeft: 6 }}>DAWWIN</span>
            </div>
            <div style={{ width: 1, height: 20, background: "#E2E8F0" }} />
            <div style={{ fontSize: 9, color: "#94A3B8", lineHeight: 1.4 }}>
              <div style={{ fontWeight: 700, color: "#64748B" }}>MSHadianto</div>
              <div>AI-Powered Audit</div>
            </div>
          </div>
        </div>

        {notice && (
          <div role="status" style={{
            margin: "16px 32px 0", padding: "10px 14px", borderRadius: 3, fontSize: 12,
            background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E",
          }}>{notice}</div>
        )}

        {/* Page Content */}
        <div style={{ padding: "28px 32px 40px", maxWidth: isLHATab ? 1200 : 960 }}>
          {isLHATab ? <ActiveTab /> : <ActiveTab data={data} setData={setData} />}
        </div>
      </div>
    </div>
  );
}

function SourceAwareLHALayer() {
  const { lhas } = useActiveData();
  return (
    <LHAProvider lhas={lhas}>
      <MainShell />
    </LHAProvider>
  );
}

function FullScreenMessage({ text, action, secondary }) {
  const button = {
    background: "transparent", border: "1px solid #334155", borderRadius: 3, padding: "8px 16px",
    color: "#CBD5E1", fontSize: 10, cursor: "pointer", fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1,
  };
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", gap: 16,
      alignItems: "center", justifyContent: "center", background: "#0F172A", color: "#94A3B8",
      fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 1.5, textAlign: "center", padding: 24,
    }}>
      <div>{text}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {action && <button onClick={action.onClick} style={button}>{action.label}</button>}
        {secondary && <button onClick={secondary.onClick} style={button}>{secondary.label}</button>}
      </div>
    </div>
  );
}

function TenantScopedApp() {
  const { status, tenant, retry, signOut } = useAuth();
  const tenantId = tenant?.id ?? null;
  // Disetel saat render, sebelum subtree di bawah membaca kunci localStorage-nya.
  setActiveTenant(tenantId);
  const { data: lhaRaw } = useLHAData();
  const jsonLhas = useMemo(() => adaptLhaParsedToCrossLha(lhaRaw), [lhaRaw]);

  if (status === "loading") return <FullScreenMessage text="MEMUAT..." />;
  if (status === "error") {
    return (
      <FullScreenMessage
        text="Data organisasi Anda gagal dimuat. Periksa koneksi, lalu coba lagi."
        action={{ label: "COBA LAGI", onClick: retry }}
        secondary={{ label: "KELUAR", onClick: signOut }}
      />
    );
  }

  // key: seluruh state di bawahnya dibuat ulang ketika berpindah tenant / keluar,
  // sehingga data satu tenant tidak pernah terbawa ke sesi lain.
  return (
    <DataSourceProvider key={tenantId || "demo"} jsonLhas={jsonLhas}>
      <SourceAwareLHALayer />
    </DataSourceProvider>
  );
}

export default function AuditDocApp() {
  return (
    <AuthProvider>
      <TenantScopedApp />
    </AuthProvider>
  );
}
