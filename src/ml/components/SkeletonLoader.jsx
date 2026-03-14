/**
 * ─── Skeleton / Shimmer Loaders ───
 * Async-like loading states for the ML pipeline.
 */

export function SkeletonBlock({ width = "100%", height = 16, radius = 3 }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
      }}
    />
  );
}

export function SkeletonCard({ lines = 3, style }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 3,
        border: "1px solid #E2E8F0",
        padding: 24,
        ...style,
      }}
    >
      <SkeletonBlock width="40%" height={12} />
      <div style={{ height: 12 }} />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <SkeletonBlock width={`${70 + Math.random() * 30}%`} height={10} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, style }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 3,
        border: "1px solid #E2E8F0",
        padding: 20,
        ...style,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #0F172A" }}>
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonBlock key={i} width={`${100 / cols}%`} height={10} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          {Array.from({ length: cols }, (_, c) => (
            <SkeletonBlock key={c} width={`${100 / cols}%`} height={10} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonMetrics({ style }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, ...style }}>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          style={{
            background: "#fff",
            borderRadius: 3,
            border: "1px solid #E2E8F0",
            borderTop: "3px solid #E2E8F0",
            padding: "20px 24px",
          }}
        >
          <SkeletonBlock width="60%" height={10} />
          <div style={{ height: 10 }} />
          <SkeletonBlock width="40%" height={28} />
          <div style={{ height: 6 }} />
          <SkeletonBlock width="50%" height={8} />
        </div>
      ))}
    </div>
  );
}

// Inject the shimmer keyframe once
if (typeof document !== "undefined") {
  const id = "dawwin-shimmer-style";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
    document.head.appendChild(style);
  }
}
