import { useMemo } from "react";
import { TABS, STORAGE_KEY } from "./constants";
import DEFAULT_STATE from "./constants/defaultState";
import { usePersistedState } from "./hooks/usePersistedState";
import { useLHAData } from "./hooks/useLHAData";
import { LHAProvider } from "./contexts/LHAContext";
import { DataSourceProvider, useActiveData } from "./contexts/DataSourceContext";
import { adaptLhaParsedToCrossLha } from "./utils/lhaAdapter";
import LHASelector from "./components/LHASelector";
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
  const isLHATab = LHA_TAB_IDS.includes(data.activeTab);

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
          {TABS.map(t => {
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
            const isActive = data.activeTab === t.id;
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
            {saving ? "SYNCING..." : "SYNCED"}
            <span style={{
              display: "inline-block", width: 6, height: 6, borderRadius: "50%",
              background: saving ? "#F59E0B" : "#059669", marginLeft: 6, verticalAlign: "middle",
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

export default function AuditDocApp() {
  const { data: lhaRaw } = useLHAData();
  const jsonLhas = useMemo(() => adaptLhaParsedToCrossLha(lhaRaw), [lhaRaw]);

  return (
    <DataSourceProvider jsonLhas={jsonLhas}>
      <SourceAwareLHALayer />
    </DataSourceProvider>
  );
}
