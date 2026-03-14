export const STORAGE_KEY = "audit-doc-data";

export const TABS = [
  { id: "dashboard", icon: "\u{1F4CA}", label: "Dashboard" },
  { id: "info", icon: "\u{1F4D1}", label: "Info Audit" },
  { id: "coso", icon: "\u{1F3DB}\uFE0F", label: "COSO" },
  { id: "findings", icon: "\u{1F50D}", label: "Temuan" },
  { id: "observations", icon: "\u{1F4DD}", label: "Observasi" },
  { id: "actionplan", icon: "\u{1F3AF}", label: "Tindak Lanjut" },
  { id: "divider-lha", divider: true, label: "LHA Analytics" },
  { id: "analytics", icon: "\u{1F4C8}", label: "Analytics" },
  { id: "risk", icon: "\u{1F6E1}\uFE0F", label: "Risk Mgmt" },
  { id: "fraud", icon: "\u{1F575}\uFE0F", label: "Fraud Detection" },
  { id: "iso31000", icon: "\u{1F4CB}", label: "ISO 31000" },
  { id: "roi", icon: "\u{1F4B0}", label: "ROI & Value" },
  { id: "xai", icon: "\u{1F9E0}", label: "Explainability" },
  { id: "drift", icon: "\u{1F4E1}", label: "Drift Monitor" },
];

export const RATINGS = {
  efektif: { label: "Efektif", color: "#059669", bg: "#D1FAE5" },
  cukup_efektif: { label: "Cukup Efektif, Namun Perlu Perbaikan", color: "#D97706", bg: "#FEF3C7" },
  kurang_efektif: { label: "Kurang Efektif, Perlu Perbaikan Signifikan", color: "#DC2626", bg: "#FEE2E2" },
  tidak_efektif: { label: "Tidak Efektif, Perlu Perbaikan Segera", color: "#7F1D1D", bg: "#FCA5A5" },
};

export const FINDING_RATINGS = {
  high: { label: "Tinggi", color: "#fff", bg: "#DC2626" },
  medium: { label: "Sedang", color: "#fff", bg: "#D97706" },
  low: { label: "Rendah", color: "#fff", bg: "#059669" },
};

export const COSO_LABELS = {
  control_environment: "Lingkungan Pengendalian",
  risk_assessment: "Penilaian Risiko",
  control_activities: "Aktivitas Pengendalian",
  info_communication: "Informasi & Komunikasi",
  monitoring: "Pemantauan",
};

export const COSO_RATINGS = {
  memadai: { label: "Memadai", color: "#059669" },
  perlu_perbaikan: { label: "Perlu Perbaikan", color: "#D97706" },
  lemah: { label: "Lemah", color: "#DC2626" },
};

export const STATUS_MAP = {
  open: { label: "Open", color: "#DC2626", bg: "#FEE2E2" },
  in_progress: { label: "In Progress", color: "#D97706", bg: "#FEF3C7" },
  closed: { label: "Closed", color: "#059669", bg: "#D1FAE5" },
};

export const RISK_LABELS = {
  strategis: "Strategis",
  operasional: "Operasional",
  kepatuhan: "Kepatuhan",
  reputasi: "Reputasi",
  hukum: "Hukum",
};
