"""
Parse docling-extracted LHA JSON files into structured audit data.
Outputs a single combined JSON for the DAWWIN frontend.

Usage: python scripts/parse-lha.py <input_dir> <output_file>
"""

import json
import re
import sys
import os
from pathlib import Path


def load_docling(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_texts(doc):
    """Extract texts with page numbers, preserving order."""
    result = []
    for t in doc.get("texts", []):
        text = t.get("text", "").strip()
        if not text:
            continue
        page = t.get("prov", [{}])[0].get("page_no", 0)
        result.append({"text": text, "page": page, "idx": len(result)})
    return result


def extract_metadata(texts):
    """Extract document metadata from first ~50 texts."""
    meta = {"title": "", "number": "", "date": "", "unit": "", "org": "BPKH"}
    joined = " ".join(t["text"] for t in texts[:50])

    # Number pattern: XX/LHA/AI/MM/YYYY
    m = re.search(r"(\d+/LHA/AI/\d+/\d{4})", joined)
    if m:
        meta["number"] = m.group(1)

    # Date pattern
    m = re.search(r"Tanggal\s*:?\s*(.+?)(?:\d{2,}\.|\n|$)", joined)
    if m:
        meta["date"] = m.group(1).strip().rstrip(".")

    # Title - look for LAPORAN HASIL AUDIT ... ATAS ...
    title_parts = []
    capture = False
    for t in texts[:30]:
        txt = t["text"].upper()
        if "LAPORAN HASIL AUDIT" in txt:
            capture = True
            continue
        if capture:
            if any(kw in txt for kw in ["NOMOR", "TANGGAL", "DAFTAR ISI", "RAHASIA"]):
                break
            if len(t["text"]) > 2:
                title_parts.append(t["text"])
    meta["title"] = " ".join(title_parts).strip()

    return meta


def find_section_ranges(texts):
    """Identify major section boundaries."""
    sections = {}
    for i, t in enumerate(texts):
        txt = t["text"].strip()
        lower = txt.lower()
        if "ikhtisar eksekutif" in lower and len(txt) < 80:
            sections["ikhtisar"] = i
        elif "hasil evaluasi" in lower and "pengendalian" in lower:
            sections["spi"] = i
        elif ("penilaian risiko" in lower or "profil risiko" in lower) and len(txt) < 80:
            sections.setdefault("risk", i)
        elif ("catatan audit" in lower or "temuan audit" in lower) and len(txt) < 80:
            sections.setdefault("findings", i)
        elif "simpulan" in lower and len(txt) < 80:
            sections.setdefault("conclusion", i)
    return sections


def extract_findings(texts, start_idx, end_idx):
    """Parse findings using C4R pattern markers."""
    findings = []
    current = None
    section_texts = texts[start_idx:end_idx]

    # Merge consecutive small texts into paragraphs
    paragraphs = []
    buf = ""
    page = 0
    for t in section_texts:
        if len(t["text"]) > 100 or (buf and t["page"] != page):
            if buf:
                paragraphs.append({"text": buf.strip(), "page": page})
            buf = t["text"]
            page = t["page"]
        else:
            buf += " " + t["text"] if buf else t["text"]
            page = t["page"]
    if buf:
        paragraphs.append({"text": buf.strip(), "page": page})

    # Scan for C4R markers
    for p in paragraphs:
        txt = p["text"]
        lower = txt.lower()

        # New finding: numbered title after "Catatan Audit" or long capitalized header
        if re.match(r"^\d+\.\s+[A-Z]", txt) and len(txt) > 30:
            if current:
                findings.append(current)
            current = {
                "title": re.sub(r"^\d+\.\s+", "", txt).strip(),
                "page": p["page"],
                "condition": "",
                "criteria": "",
                "cause": "",
                "effect": "",
                "recommendation": "",
                "risk_types": [],
                "raw_paragraphs": [],
            }
            continue

        if not current:
            # Check if it's a title-like paragraph
            if len(txt) > 40 and not any(kw in lower for kw in ["kondisi", "berdasarkan", "tabel", "sumber:"]):
                if re.match(r"^[A-Z]", txt) and "." not in txt[:5]:
                    if current:
                        findings.append(current)
                    current = {
                        "title": txt[:200],
                        "page": p["page"],
                        "condition": "",
                        "criteria": "",
                        "cause": "",
                        "effect": "",
                        "recommendation": "",
                        "risk_types": [],
                        "raw_paragraphs": [],
                    }
            continue

        current["raw_paragraphs"].append(txt)

        # C4R markers
        if "kondisi tersebut belum sepenuhnya" in lower or "kondisi tersebut belum" in lower:
            current["criteria"] += txt + "\n"
        elif "kondisi tersebut disebabkan" in lower:
            current["cause"] += txt + "\n"
        elif ("kondisi tersebut mengakibatkan" in lower or
              "kondisi tersebut berpotensi mengakibatkan" in lower):
            current["effect"] += txt + "\n"
        elif "merekomendasikan" in lower:
            current["recommendation"] += txt + "\n"
        elif "risiko" in lower:
            # Extract risk types
            for rtype in ["operasional", "strategis", "strategi", "kepatuhan", "reputasi", "hukum"]:
                if rtype in lower and rtype not in [r.lower() for r in current["risk_types"]]:
                    current["risk_types"].append(rtype.replace("strategi", "strategis"))
        else:
            # Accumulate as condition by default in the finding context
            if not current["criteria"] and not current["cause"]:
                current["condition"] += txt + "\n"

    if current:
        findings.append(current)

    return findings


def extract_risk_profile(texts):
    """Extract risk profile data from risk assessment sections."""
    risks = []
    risk_types = ["operasional", "reputasi", "hukum", "kepatuhan", "strategis", "stratejik", "strategi"]

    for i, t in enumerate(texts):
        lower = t["text"].lower()
        for rt in risk_types:
            if f"risiko {rt}" in lower and len(t["text"]) < 100:
                norm = rt.replace("stratejik", "strategis").replace("strategi", "strategis")
                if norm not in [r["type"] for r in risks]:
                    risks.append({"type": norm, "mentioned_page": t["page"]})

    return risks


def detect_fraud_indicators(texts):
    """Scan for fraud red flags and indicators."""
    fraud_keywords = {
        "double klaim": "Duplikasi klaim/pembayaran",
        "kelebihan pembayaran": "Kelebihan pembayaran",
        "kekurangan volume": "Volume pekerjaan tidak sesuai",
        "tanpa dokumentasi": "Kurang dokumentasi",
        "tidak tercatat": "Transaksi tidak tercatat",
        "sponsorship": "Penerimaan tidak terdokumentasi",
        "manual input": "Risiko manipulasi data manual",
        "input manual": "Risiko manipulasi data manual",
        "data integrity": "Risiko integritas data",
        "tidak sesuai": "Ketidaksesuaian",
        "selisih": "Selisih/perbedaan nilai",
        "penyimpangan": "Penyimpangan prosedur",
        "tanpa persetujuan": "Tanpa otorisasi",
        "tanpa approval": "Tanpa otorisasi",
        "di luar sistem": "Proses di luar sistem",
        "diluar sistem": "Proses di luar sistem",
        "tidak transparan": "Kurang transparansi",
        "konflik kepentingan": "Konflik kepentingan",
        "mark up": "Potensi mark-up",
        "markup": "Potensi mark-up",
        "fiktif": "Transaksi fiktif",
    }

    indicators = []
    for i, t in enumerate(texts):
        lower = t["text"].lower()
        for keyword, category in fraud_keywords.items():
            if keyword in lower:
                # Get surrounding context
                context_parts = []
                for j in range(max(0, i - 1), min(len(texts), i + 3)):
                    context_parts.append(texts[j]["text"])
                context = " ".join(context_parts)[:300]

                indicators.append({
                    "keyword": keyword,
                    "category": category,
                    "page": t["page"],
                    "context": context,
                    "text": t["text"][:200],
                    "severity": "high" if keyword in ["double klaim", "kelebihan pembayaran", "fiktif", "mark up", "markup"] else "medium",
                })
                break  # one indicator per text element

    # Deduplicate by category + page
    seen = set()
    unique = []
    for ind in indicators:
        key = (ind["category"], ind["page"])
        if key not in seen:
            seen.add(key)
            unique.append(ind)

    return unique


def parse_document(filepath):
    """Parse a single docling document into structured audit data."""
    doc = load_docling(filepath)
    texts = extract_texts(doc)
    meta = extract_metadata(texts)
    sections = find_section_ranges(texts)

    # Determine finding boundaries
    findings_start = sections.get("findings", 0)
    findings_end = sections.get("conclusion", len(texts))
    findings = extract_findings(texts, findings_start, findings_end)

    risks = extract_risk_profile(texts)
    fraud = detect_fraud_indicators(texts)

    return {
        "source_file": Path(filepath).name,
        "metadata": meta,
        "total_pages": max((t["page"] for t in texts), default=0),
        "total_texts": len(texts),
        "sections": {k: v for k, v in sections.items()},
        "findings": findings,
        "risk_profile": risks,
        "fraud_indicators": fraud,
    }


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <input_dir> <output_file>")
        sys.exit(1)

    input_dir = sys.argv[1]
    output_file = sys.argv[2]

    results = []
    for fname in sorted(os.listdir(input_dir)):
        if not fname.endswith(".json"):
            continue
        filepath = os.path.join(input_dir, fname)
        print(f"Parsing: {fname}...")
        try:
            result = parse_document(filepath)
            results.append(result)
            print(f"  -> {len(result['findings'])} findings, {len(result['fraud_indicators'])} fraud indicators")
        except Exception as e:
            print(f"  ERROR: {e}")

    output = {
        "generated_at": __import__("datetime").datetime.now().isoformat(),
        "total_reports": len(results),
        "reports": results,
    }

    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nOutput: {output_file}")
    print(f"Total: {len(results)} reports, "
          f"{sum(len(r['findings']) for r in results)} findings, "
          f"{sum(len(r['fraud_indicators']) for r in results)} fraud indicators")


if __name__ == "__main__":
    main()
