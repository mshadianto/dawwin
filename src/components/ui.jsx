// ─── DAWWIN Design System ─── McKinsey × Big 4 Grade ───

export function Badge({ children, bg, color, variant = "default" }) {
  const styles = {
    default: { background: bg, color, padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, whiteSpace: "nowrap", display: "inline-block", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" },
    outline: { background: "transparent", color: bg, padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, whiteSpace: "nowrap", display: "inline-block", textTransform: "uppercase", border: `1.5px solid ${bg}`, fontFamily: "'JetBrains Mono', monospace" },
    subtle: { background: bg + "12", color: bg, padding: "4px 12px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, whiteSpace: "nowrap", display: "inline-block", fontFamily: "'JetBrains Mono', monospace" },
  };
  return <span style={styles[variant] || styles.default}>{children}</span>;
}

export function Card({ children, style, onClick, className = "" }) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: "#fff",
        borderRadius: 3,
        border: "1px solid #E2E8F0",
        padding: 24,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        ...style,
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor = "#94A3B8"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(15,23,42,0.06)"; } }}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "none"; } }}
    >
      {children}
    </div>
  );
}

export function SectionHeader({ icon, title, subtitle, tag, action }) {
  return (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid #0F172A", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {icon && <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>}
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, fontFamily: "'Source Serif 4', Georgia, serif", letterSpacing: -0.5 }}>
            {title}
          </h2>
          {tag && <Badge bg="#0F172A" color="#fff">{tag}</Badge>}
        </div>
        {subtitle && <p style={{ fontSize: 13, color: "#64748B", margin: "6px 0 0 0", fontWeight: 400, lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function StatCard({ icon, value, label, accent, delta, sublabel, sub }) {
  const subText = sublabel ?? sub;
  return (
    <div className="fade-in" style={{
      background: "#fff",
      borderRadius: 3,
      padding: "20px 24px",
      border: "1px solid #E2E8F0",
      borderTop: `3px solid ${accent}`,
      flex: 1,
      minWidth: 160,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif", lineHeight: 1, letterSpacing: -1 }}>{value}</div>
          {subText && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4, fontWeight: 500 }}>{subText}</div>}
        </div>
        {delta !== undefined && (
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: delta > 0 ? "#DC2626" : delta < 0 ? "#059669" : "#64748B",
            background: delta > 0 ? "#FEF2F2" : delta < 0 ? "#F0FDF4" : "#F8FAFC",
            padding: "3px 8px", borderRadius: 3, fontFamily: "'JetBrains Mono', monospace",
          }}>
            {delta > 0 ? "+" : ""}{delta}%
          </div>
        )}
      </div>
    </div>
  );
}

export function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 20px" }}>
      <div style={{ height: 1, flex: 1, background: "#E2E8F0" }} />
      {label && <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>}
      <div style={{ height: 1, flex: 1, background: "#E2E8F0" }} />
    </div>
  );
}

export function ProgressBar({ value, max, color = "#0F172A", height = 6, showLabel = false }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <div style={{ background: "#F1F5F9", borderRadius: 2, height, flex: 1, overflow: "hidden" }}>
        <div style={{ background: color, borderRadius: 2, height, width: `${pct}%`, transition: "width 0.6s ease", animation: "barGrow 0.8s ease-out" }} />
      </div>
      {showLabel && <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 36, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{pct}%</span>}
    </div>
  );
}

export function DonutChart({ value, total, color = "#0F172A", size = 80, strokeWidth = 8, label }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? value / total : 0;
  const offset = circumference * (1 - pct);
  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="butt"
          style={{ transition: "stroke-dashoffset 1s ease", animation: "ringFill 1.2s ease-out" }}
        />
      </svg>
      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontSize: size > 60 ? 16 : 12, fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif" }}>{Math.round(pct * 100)}%</div>
        {label && <div style={{ fontSize: 8, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>}
      </div>
    </div>
  );
}

export function RadarChart({ data, labels, size = 200, color = "#0F172A" }) {
  const cx = size / 2, cy = size / 2;
  const levels = 4;
  const angleStep = (2 * Math.PI) / labels.length;
  const maxR = size * 0.38;

  const getPoint = (i, r) => ({
    x: cx + r * Math.sin(i * angleStep),
    y: cy - r * Math.cos(i * angleStep),
  });

  const gridLines = [];
  for (let l = 1; l <= levels; l++) {
    const r = (l / levels) * maxR;
    const pts = labels.map((_, i) => getPoint(i, r));
    gridLines.push(
      <polygon key={l} points={pts.map(p => `${p.x},${p.y}`).join(" ")}
        fill="none" stroke="#E2E8F0" strokeWidth={l === levels ? 1.5 : 0.5} />
    );
  }

  const axisLines = labels.map((_, i) => {
    const p = getPoint(i, maxR);
    return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E2E8F0" strokeWidth={0.5} />;
  });

  const dataPoints = data.map((v, i) => getPoint(i, (v / 100) * maxR));
  const dataPath = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  const labelElements = labels.map((label, i) => {
    const p = getPoint(i, maxR + 18);
    return (
      <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 9, fontWeight: 600, fill: "#64748B", fontFamily: "'DM Sans', sans-serif" }}>
        {label}
      </text>
    );
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {gridLines}
      {axisLines}
      <polygon points={dataPath} fill={color + "18"} stroke={color} strokeWidth={2} />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />
      ))}
      {labelElements}
    </svg>
  );
}

export function HeatCell({ value, max, size = 40 }) {
  const intensity = max > 0 ? value / max : 0;
  const bg = value === 0 ? "#F8FAFC" :
    intensity > 0.7 ? "#991B1B" :
    intensity > 0.4 ? "#DC2626" :
    intensity > 0.2 ? "#F59E0B" : "#059669";
  const color = value === 0 ? "#CBD5E1" : "#fff";
  return (
    <td style={{
      width: size, height: size, textAlign: "center", verticalAlign: "middle",
      background: value === 0 ? bg : bg + "15",
      border: "1px solid #F1F5F9",
    }}>
      <span style={{ fontWeight: 700, color: value === 0 ? color : bg, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
    </td>
  );
}

export function MaturityIndicator({ level, maxLevel = 5 }) {
  const labels = ["Initial", "Developing", "Defined", "Managed", "Optimized"];
  const colors = ["#DC2626", "#F59E0B", "#3B82F6", "#059669", "#0F172A"];
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
      {Array.from({ length: maxLevel }, (_, i) => (
        <div key={i} style={{
          width: 18, height: 8 + i * 4, borderRadius: 2,
          background: i < level ? colors[Math.min(level - 1, 4)] : "#E2E8F0",
          transition: "background 0.3s",
        }} />
      ))}
      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: colors[Math.min(level - 1, 4)], fontFamily: "'JetBrains Mono', monospace" }}>
        L{level} — {labels[level - 1] || "N/A"}
      </span>
    </div>
  );
}

export function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: "100%", padding: "10px 12px", borderRadius: 3, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", background: "#FAFBFC" }} />
  );
}

export function Input({ value, onChange, placeholder, type = "text", style: s }) {
  return (
    <input type={type} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", padding: "8px 12px", borderRadius: 3, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", background: "#FAFBFC", ...s }} />
  );
}

export function Select({ value, onChange, options }) {
  return (
    <select value={value || ""} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "8px 12px", borderRadius: 3, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: "#FAFBFC", boxSizing: "border-box" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function FieldGroup({ label, children, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block", letterSpacing: 0.5, textTransform: "uppercase" }}>
        {label} {required && <span style={{ color: "#DC2626" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export function ExhibitHeader({ number, title, subtitle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>
        EXHIBIT {number}
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", fontFamily: "'Source Serif 4', Georgia, serif", lineHeight: 1.3 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: "#64748B", marginTop: 3, fontWeight: 400 }}>{subtitle}</div>}
    </div>
  );
}

export function ThreeDotsMenu() {
  return (
    <div style={{ cursor: "pointer", padding: "4px 8px", borderRadius: 3, color: "#94A3B8", fontSize: 16, lineHeight: 1 }}>
      {"⋯"}
    </div>
  );
}

export function ScatterPlot({ points, width = 400, height = 240, xLabel = "X", yLabel = "Y" }) {
  const pad = { top: 20, right: 30, bottom: 36, left: 44 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const maxX = Math.max(...points.map(p => p.x), 1);
  const maxY = Math.max(...points.map(p => p.y), 1);
  const maxR = Math.max(...points.map(p => p.r || 1), 1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <line key={`h${t}`} x1={pad.left} y1={pad.top + h * (1 - t)} x2={pad.left + w} y2={pad.top + h * (1 - t)} stroke="#F1F5F9" strokeWidth={0.5} />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <line key={`v${t}`} x1={pad.left + w * t} y1={pad.top} x2={pad.left + w * t} y2={pad.top + h} stroke="#F1F5F9" strokeWidth={0.5} />
      ))}
      {/* Axes */}
      <line x1={pad.left} y1={pad.top + h} x2={pad.left + w} y2={pad.top + h} stroke="#94A3B8" strokeWidth={1} />
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + h} stroke="#94A3B8" strokeWidth={1} />
      <text x={pad.left + w / 2} y={height - 4} textAnchor="middle" style={{ fontSize: 9, fill: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>{xLabel}</text>
      <text x={10} y={pad.top + h / 2} textAnchor="middle" transform={`rotate(-90,10,${pad.top + h / 2})`} style={{ fontSize: 9, fill: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>{yLabel}</text>
      {/* Points */}
      {points.map((p, i) => {
        const cx = pad.left + (p.x / maxX) * w;
        const cy = pad.top + h - (p.y / maxY) * h;
        const r = 6 + ((p.r || 1) / maxR) * 14;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill={p.color || "#3B82F6"} opacity={0.25} />
            <circle cx={cx} cy={cy} r={4} fill={p.color || "#3B82F6"} stroke="#fff" strokeWidth={1.5} />
            {p.label && <text x={cx} y={cy - r - 4} textAnchor="middle" style={{ fontSize: 8, fill: "#64748B", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{p.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function RiskLevelBadge({ level }) {
  const config = {
    extreme: { label: "EXTREME", bg: "#7F1D1D", color: "#fff" },
    high: { label: "HIGH", bg: "#DC2626", color: "#fff" },
    medium: { label: "MEDIUM", bg: "#F59E0B", color: "#fff" },
    low: { label: "LOW", bg: "#059669", color: "#fff" },
  };
  const c = config[level] || config.low;
  return <Badge bg={c.bg} color={c.color}>{c.label}</Badge>;
}
