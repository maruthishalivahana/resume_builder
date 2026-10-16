"""Read-only PDF verification for a completed synthetic local-review report."""
import argparse
import json
import re
from pathlib import Path

import pdfplumber
from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument("report", type=Path)
args = parser.parse_args()
report = json.loads(args.report.read_text(encoding="utf-8"))
assert report["completed"], "API workflow must complete first"
assert len(report["pdfs"]) == 2
results = []
for index, artifact in enumerate(report["pdfs"]):
    reader = PdfReader(artifact["pdfPath"])
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    compact = re.sub(r"\s+", "", text)
    assert "LOCALMODELBASE731" in compact
    assert "SQLite" in compact
    assert ("LOCALMODELACCEPTED842" in compact) == (index == 1)
    with pdfplumber.open(artifact["pdfPath"]) as pdf:
        bold_text = "".join(
            char["text"]
            for page in pdf.pages
            for char in page.chars
            if re.search(r"cmbx|bold", char.get("fontname", ""), re.I)
        )
    assert ("SQLite" in bold_text) == (index == 1)
    results.append({"compilationId": artifact["compilationId"], "pages": len(reader.pages),
                    "text": text, "boldText": bold_text, "acceptedMarkerPresent": index == 1,
                    "sqliteBold": index == 1})
output = args.report.parent / "pdf-verification.json"
output.write_text(json.dumps({"passed": True, "pdfs": results}, indent=2), encoding="utf-8")
print(json.dumps({"passed": True, "output": str(output), "pdfs": results}, indent=2))
