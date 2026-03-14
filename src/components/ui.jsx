export function Badge({ children, bg, color }) {
  return (
    <span style={{ background: bg, color, padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap", display: "inline-block" }}>
      {children}
    </span>
  );
}

export function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: 20, ...style, cursor: onClick ? "pointer" : "default", transition: "box-shadow 0.2s" }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)")}
      onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = "none")}
    >
      {children}
    </div>
  );
}

export function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1B365D", margin: 0, display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Sans', sans-serif" }}>
        <span style={{ fontSize: 22 }}>{icon}</span> {title}
      </h2>
      {subtitle && <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0 30px" }}>{subtitle}</p>}
    </div>
  );
}

export function StatCard({ icon, value, label, accent }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${accent}15, ${accent}08)`, borderRadius: 12, padding: "16px 20px", borderLeft: `4px solid ${accent}`, flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 24, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent, fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

export function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", background: "#FAFAFA" }}
    />
  );
}

export function Input({ value, onChange, placeholder, type = "text", style: s }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", background: "#FAFAFA", ...s }}
    />
  );
}

export function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: "#FAFAFA", boxSizing: "border-box" }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function FieldGroup({ label, children, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4, display: "block", letterSpacing: 0.3 }}>
        {label} {required && <span style={{ color: "#DC2626" }}>*</span>}
      </label>
      {children}
    </div>
  );
}
