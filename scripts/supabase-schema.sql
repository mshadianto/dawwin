-- DAWWIN Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Audit workspace documents (replaces localStorage)
CREATE TABLE IF NOT EXISTS audit_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL DEFAULT 'default',
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. LHA Reports (parsed audit report metadata)
CREATE TABLE IF NOT EXISTS lha_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_file TEXT NOT NULL,
  title TEXT,
  number TEXT,
  date TEXT,
  unit TEXT,
  org TEXT DEFAULT 'BPKH',
  total_pages INTEGER DEFAULT 0,
  total_texts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lha_reports_source ON lha_reports(source_file);

-- 3. LHA Findings
CREATE TABLE IF NOT EXISTS lha_findings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES lha_reports(id) ON DELETE CASCADE,
  title TEXT,
  page INTEGER,
  condition TEXT,
  criteria TEXT,
  cause TEXT,
  effect TEXT,
  recommendation TEXT,
  risk_types TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. LHA Fraud Indicators
CREATE TABLE IF NOT EXISTS lha_fraud_indicators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES lha_reports(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  page INTEGER,
  context TEXT,
  text_excerpt TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. LHA Risk Profile
CREATE TABLE IF NOT EXISTS lha_risk_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES lha_reports(id) ON DELETE CASCADE,
  risk_type TEXT NOT NULL,
  mentioned_page INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) with public read/write for anon
-- (since this is a personal tool, allow anon full access)
ALTER TABLE audit_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lha_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE lha_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lha_fraud_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE lha_risk_profiles ENABLE ROW LEVEL SECURITY;

-- Policies: allow anon full access
CREATE POLICY "anon_all_audit_documents" ON audit_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_lha_reports" ON lha_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_lha_findings" ON lha_findings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_lha_fraud_indicators" ON lha_fraud_indicators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_lha_risk_profiles" ON lha_risk_profiles FOR ALL USING (true) WITH CHECK (true);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_documents_updated
  BEFORE UPDATE ON audit_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
