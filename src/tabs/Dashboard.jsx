import { useMemo } from "react";
import { Badge, Card, SectionHeader, StatCard, RadarChart, ProgressBar, MaturityIndicator } from "../components/ui";
import { RATINGS, FINDING_RATINGS, COSO_LABELS, COSO_RATINGS, STATUS_MAP, DOMAIN_LABELS } from "../constants";

const MATURITY_MAP = { memadai: 4, perlu_perbaikan: 2, lemah: 1 };

export default function Dashboard({ data, setData }) {
  const { findings, observations, cosoAssessment, auditInfo } = data;
  const ratingInfo = RATINGS[auditInfo.rating] || RATINGS.cukup_efektif;

  const stats = useMemo(() => {
    const high = findings.filter(f => f.rating === "high").length;
    const med = findings.filter(f => f.rating === "medium").length;
    const low = findings.filter(f => f.rating === "low").length;
    const open = findings.filter(f => f.status === "open").length;
    const inProgress = findings.filter(f => f.status === "in_progress").length;
    const closed = findings.filter(f => f.status === "closed").length;
    const closureRate = findings.length > 0 ? Math.round((closed / findings.length) * 100) : 0;
    return { high, med, low, open, inProgress, closed, closureRate };
  }, [findings]);

  const cosoKeys = Object.keys(COSO_LABELS);
  const cosoRadarData = cosoKeys.map(k => {
    const rating = cosoAssessment[k]?.rating;
    return rating === "memadai" ? 90 : rating === "perlu_perbaikan" ? 50 : 20;
  });
  const cosoRadarLabels = cosoKeys.map(k => {
    const l = COSO_LABELS[k];
    return l.length > 14 ? l.slice(0, 12) + "..." : l;
  });
  const avgMaturity = Math.round(cosoKeys.reduce((s, k) => s + (MATURITY_MAP[cosoAssessment[k]?.rating] || 0), 0) / cosoKeys.length);

  const domainData = useMemo(() => {
    const map = {};
    findings.forEach(f => {
      const d = f.domain || "lainnya";
      if (!map[d]) map[d] = { domain: DOMAIN_LABELS[d] || d, total: 0, high: 0, medium: 0, low: 0 };
      map[d].total += 1;
      map[d][f.rating] = (map[d][f.rating] || 0) + 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [findings]);

  const maxDomainTotal = Math.max(...domainData.map(d => d.total), 1);

  const ratingDist = [
    { name: "Tinggi", value: stats.high, color: FINDING_RATINGS.high.hex },
    { name: "Sedang", value: stats.med, color: FINDING_RATINGS.medium.hex },
    { name: "Rendah", value: stats.low, color: FINDING_RATINGS.low.hex },
  ];

  const statusDist = [
    { name: "Open", value: stats.open, color: "#DC2626" },
    { name: "In Progress", value: stats.inProgress, color: "#D97706" },
    { name: "Closed", value: stats.closed, color: "#059669" },
  ];

  return (
    <div>
      <SectionHeader icon="📊" title="Executive Dashboard" subtitle="Ringkasan komprehensif hasil audit dan analytics tindak lanjut" tag="CONFIDENTIAL" />

      {/* Hero Card with Rating */}
      <div className="fade-in fade-in-1" style={{
        background: "#0F172A", color: "#fff", borderRadius: 3,
        padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 320, height: "100%", background: "linear-gradient(135deg, transparent 0%, #C9A84C10 100%)" }} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr auto", gap: 24 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: 2, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
              RATING KESELURUHAN AUDIT
            </div>
            <div style={{
              display: "inline-block", padding: "10px 24px", borderRadius: 3,
              background: ratingInfo.bg, color: ratingInfo.color,
              fontWeight: 800, fontSize: 14, fontFamily: "'Source Serif 4', Georgia, serif", marginBottom: 14,
            }}>
              {ratingInfo.label}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#F8FAFC", lineHeight: 1.4, fontFamily: "'Source Serif 4', Georgia, serif" }}>
              {auditInfo.title}
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 8 }}>
              📅 {auditInfo.period} | 🏢 {auditInfo.org} | 📄 {auditInfo.number}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
              CONTROL MATURITY
            </div>
            <MaturityIndicator level={avgMaturity} />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard value={findings.length} label="Total Temuan" accent="#0F172A" />
        <StatCard value={stats.high} label="Tinggi" accent="#DC2626" sub={`${Math.round((stats.high / findings.length) * 100) || 0}% dari total`} />
        <StatCard value={stats.med} label="Sedang" accent="#D97706" sub={`${Math.round((stats.med / findings.length) * 100) || 0}% dari total`} />
        <StatCard value={stats.low} label="Rendah" accent="#059669" sub={`${Math.round((stats.low / findings.length) * 100) || 0}% dari total`} />
        <StatCard value={`${stats.closureRate}%`} label="Closure Rate" accent="#7C3AED" sub={`${stats.closed}/${findings.length} closed`} />
        <StatCard value={observations.length} label="Observasi" accent="#64748B" />
      </div>

      {/* Distribution Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", margin: "0 0 16px", letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
            Distribusi Temuan per Rating
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ratingDist.map(d => (
              <div key={d.name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: d.color, fontFamily: "'Source Serif 4', Georgia, serif" }}>{d.value}</span>
                </div>
                <ProgressBar value={d.value} max={Math.max(...ratingDist.map(x => x.value), 1)} color={d.color} height={6} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", margin: "0 0 16px", letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
            Status Tindak Lanjut
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {statusDist.map(d => (
              <div key={d.name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: d.color, fontFamily: "'Source Serif 4', Georgia, serif" }}>{d.value}</span>
                </div>
                <ProgressBar value={d.value} max={Math.max(...statusDist.map(x => x.value), 1)} color={d.color} height={6} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* COSO Radar */}
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", margin: "0 0 16px", letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
          🏛️ COSO Internal Control Maturity
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <RadarChart data={cosoRadarData} labels={cosoRadarLabels} size={220} color="#0F172A" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            {cosoKeys.map(k => {
              const val = cosoAssessment[k] || {};
              const rInfo = COSO_RATINGS[val.rating] || {};
              const pct = val.rating === "memadai" ? 90 : val.rating === "perlu_perbaikan" ? 50 : 20;
              return (
                <div key={k}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{COSO_LABELS[k]}</span>
                    <Badge bg={rInfo.color || "#999"} color="#fff">{rInfo.label || "-"}</Badge>
                  </div>
                  <ProgressBar value={pct} max={100} color={rInfo.color || "#999"} height={4} />
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Findings by Domain */}
      {domainData.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", margin: "0 0 16px", letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
            🗂️ Temuan per Domain Audit
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {domainData.map(d => (
              <div key={d.domain}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{d.domain}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif" }}>
                    {d.total} <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>temuan</span>
                  </span>
                </div>
                <div style={{ display: "flex", height: 8, borderRadius: 2, overflow: "hidden", background: "#F1F5F9" }}>
                  {d.high > 0 && <div style={{ width: `${(d.high / maxDomainTotal) * 100}%`, background: "#DC2626" }} title={`Tinggi: ${d.high}`} />}
                  {d.medium > 0 && <div style={{ width: `${(d.medium / maxDomainTotal) * 100}%`, background: "#D97706" }} title={`Sedang: ${d.medium}`} />}
                  {d.low > 0 && <div style={{ width: `${(d.low / maxDomainTotal) * 100}%`, background: "#059669" }} title={`Rendah: ${d.low}`} />}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
                  {d.high > 0 && <span>🔴 {d.high}</span>}
                  {d.medium > 0 && <span>🟠 {d.medium}</span>}
                  {d.low > 0 && <span>🟢 {d.low}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top High-Priority Findings */}
      {stats.high > 0 && (
        <Card>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", margin: "0 0 12px", letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
            🚨 Temuan Prioritas Tinggi
          </h3>
          {findings.filter(f => f.rating === "high").map(f => {
            const sr = STATUS_MAP[f.status] || {};
            return (
              <div key={f.id}
                onClick={() => setData(d => ({ ...d, activeTab: "findings", _editId: f.id }))}
                style={{ padding: "10px 12px", borderRadius: 3, background: "#FEF2F2", borderLeft: "3px solid #DC2626", marginBottom: 8, cursor: "pointer", transition: "background 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#FEE2E2"}
                onMouseLeave={e => e.currentTarget.style.background = "#FEF2F2"}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Badge bg="#DC2626" color="#fff">HIGH</Badge>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#1F2937" }}>{f.id}: {f.title}</div>
                  <Badge bg={sr.color || "#999"} color="#fff">{sr.label || "-"}</Badge>
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4, marginLeft: 56 }}>
                  📅 Target: {f.targetDate || "-"} | 👤 {f.pic || "-"}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
