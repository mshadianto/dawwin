import { useMemo } from "react";
import CrossLhaAnalyticsTab from "./CrossLhaAnalyticsTab";
import { useLHAData } from "../hooks/useLHAData";
import { adaptLhaParsedToCrossLha } from "../utils/lhaAdapter";

export default function CrossLhaWrapper() {
  const { data, loading, error } = useLHAData();
  const lhas = useMemo(() => adaptLhaParsedToCrossLha(data?.reports), [data]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Sans', sans-serif", color: "#6B7280" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
        <div>Loading LHA data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "'DM Sans', sans-serif", color: "#DC2626" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
        <div>Gagal memuat data LHA: {error}</div>
      </div>
    );
  }

  return <CrossLhaAnalyticsTab lhas={lhas} />;
}
