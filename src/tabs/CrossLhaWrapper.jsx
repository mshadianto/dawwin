import CrossLhaAnalyticsTab from "./CrossLhaAnalyticsTab";
import { useActiveLHA } from "../contexts/LHAContext";

export default function CrossLhaWrapper() {
  const { lhas } = useActiveLHA();
  return <CrossLhaAnalyticsTab lhas={lhas} />;
}
