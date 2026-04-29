export const STORAGE_KEY = "audit-doc-data";

export const TABS = [
  { id: "dashboard", icon: "\u{1F4CA}", label: "Dashboard" },
  { id: "info", icon: "\u{1F4D1}", label: "Info Audit" },
  { id: "coso", icon: "\u{1F3DB}️", label: "COSO" },
  { id: "findings", icon: "\u{1F50D}", label: "Temuan" },
  { id: "observations", icon: "\u{1F4DD}", label: "Observasi" },
  { id: "actionplan", icon: "\u{1F3AF}", label: "Tindak Lanjut" },
  { id: "timeline", icon: "\u{1F4C5}", label: "Timeline" },
  { id: "report", icon: "\u{1F4C4}", label: "Report" },
  { id: "aisettings", icon: "⚙️", label: "AI Settings" },
  { id: "divider-lha", divider: true, label: "LHA Analytics" },
  { id: "analytics", icon: "\u{1F4C8}", label: "Analytics" },
  { id: "risk", icon: "\u{1F6E1}️", label: "Risk Mgmt" },
  { id: "fraud", icon: "\u{1F575}️", label: "Fraud Detection" },
  { id: "iso31000", icon: "\u{1F4CB}", label: "ISO 31000" },
  { id: "roi", icon: "\u{1F4B0}", label: "ROI & Value" },
  { id: "xai", icon: "\u{1F9E0}", label: "Explainability" },
  { id: "drift", icon: "\u{1F4E1}", label: "Drift Monitor" },
  { id: "divider-ml", divider: true, label: "ML Platform" },
  { id: "mlpipeline", icon: "⚡", label: "ML Pipeline" },
  { id: "autofe", icon: "\u{1F527}", label: "Auto-FE" },
  { id: "copilot", icon: "\u{1F4AC}", label: "Data Copilot" },
];

export const RATINGS = {
  efektif: { label: "Efektif", color: "#059669", bg: "#D1FAE5", score: 4 },
  cukup_efektif: { label: "Cukup Efektif, Namun Perlu Perbaikan", color: "#D97706", bg: "#FEF3C7", score: 3 },
  kurang_efektif: { label: "Kurang Efektif, Perlu Perbaikan Signifikan", color: "#DC2626", bg: "#FEE2E2", score: 2 },
  tidak_efektif: { label: "Tidak Efektif, Perlu Perbaikan Segera", color: "#7F1D1D", bg: "#FCA5A5", score: 1 },
};

export const FINDING_RATINGS = {
  high: { label: "Tinggi", color: "#fff", bg: "#DC2626", score: 3, hex: "#DC2626" },
  medium: { label: "Sedang", color: "#fff", bg: "#D97706", score: 2, hex: "#D97706" },
  low: { label: "Rendah", color: "#fff", bg: "#059669", score: 1, hex: "#059669" },
};

export const COSO_LABELS = {
  control_environment: "Lingkungan Pengendalian",
  risk_assessment: "Penilaian Risiko",
  control_activities: "Aktivitas Pengendalian",
  info_communication: "Informasi & Komunikasi",
  monitoring: "Pemantauan",
};

export const COSO_RATINGS = {
  memadai: { label: "Memadai", color: "#059669", score: 3 },
  perlu_perbaikan: { label: "Perlu Perbaikan", color: "#D97706", score: 2 },
  lemah: { label: "Lemah", color: "#DC2626", score: 1 },
};

export const STATUS_MAP = {
  open: { label: "Open", color: "#DC2626", bg: "#FEE2E2", icon: "⏳" },
  in_progress: { label: "In Progress", color: "#D97706", bg: "#FEF3C7", icon: "\u{1F504}" },
  closed: { label: "Closed", color: "#059669", bg: "#D1FAE5", icon: "✅" },
};

export const RISK_LABELS = {
  strategis: "Strategis",
  operasional: "Operasional",
  kepatuhan: "Kepatuhan",
  reputasi: "Reputasi",
  hukum: "Hukum",
  keuangan: "Keuangan",
};

export const DOMAIN_LABELS = {
  procurement: "Pengadaan",
  it_security: "Keamanan TI",
  finance: "Keuangan",
  compliance: "Kepatuhan",
  bcp_drm: "BCP/DRM",
  asset_management: "Manajemen Aset",
  aml_compliance: "AML/CFT",
  governance: "Tata Kelola",
};

export const TIMELINE_TYPES = {
  milestone: { icon: "\u{1F3AF}", color: "#7C3AED", label: "Milestone" },
  meeting: { icon: "\u{1F91D}", color: "#2563EB", label: "Meeting" },
  fieldwork: { icon: "\u{1F50D}", color: "#059669", label: "Fieldwork" },
  draft: { icon: "\u{1F4C4}", color: "#D97706", label: "Draft" },
  response: { icon: "\u{1F4AC}", color: "#0891B2", label: "Response" },
};

export const AI_PROVIDERS = {
  groq: { name: "Groq", endpoint: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", format: "openai" },
  zai: { name: "z.ai (GLM-4 Plus)", endpoint: "https://open.z.ai/api/anthropic/v1/chat/completions", model: "glm-4-plus", format: "openai" },
  claude: { name: "Claude Sonnet", endpoint: "https://api.anthropic.com/v1/messages", model: "claude-sonnet-4-20250514", format: "anthropic" },
  custom: { name: "Custom", endpoint: "", model: "", format: "openai" },
};
