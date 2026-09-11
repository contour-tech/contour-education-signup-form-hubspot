#!/usr/bin/env python3
"""Build the school/university list the form's search reads.

Source of truth is data/source/lms-schools-comprehensive.csv (ACARA schools +
CRICOS universities). The form only ever needs six columns, so everything else
is dropped here rather than shipped to every visitor.

    python3 data/build-schools-json.py

Output is data/schools-v1.json, served from GitHub Pages. The filename carries
a version because production and staging run different builds of form1.js:
a shape change ships as -v2 so the older production script keeps working
against the file it was written for.
"""

import csv
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "lms-schools-comprehensive.csv"
OVERRIDES = ROOT / "school-code-overrides.json"
OUTPUT = ROOT / "schools-v1.json"

# acara_id carries the CRICOS code for universities. The name stays because
# it is the HubSpot property the form writes into — one hidden field, two id
# schemes, distinguished by `type`.
FIELDS = ("name", "acara_id", "school_code", "state", "suburb", "type")


def build():
    with SOURCE.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    codes = overrides["codes"]

    entries = []
    for row in rows:
        entries.append({
            "name": row["school_name"].strip(),
            "acara_id": row["source_id"].strip(),
            "school_code": row["school_code"].strip() or codes.get(row["source_id"].strip(), ""),
            "state": row["state"].strip(),
            "suburb": row["suburb"].strip(),
            "type": row["type"].strip(),
        })

    known = {e["acara_id"] for e in entries}
    for extra in overrides["extra"]:
        if extra["acara_id"] not in known:
            entries.append(extra)

    # Sorted so a regenerated file diffs by content, not by row order.
    entries.sort(key=lambda e: (e["name"].lower(), e["state"], e["acara_id"]))
    OUTPUT.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    universities = sum(1 for e in entries if e["type"] == "University")
    print("%s: %d entries (%d universities, %d schools), %.1f KB"
          % (OUTPUT.name, len(entries), universities, len(entries) - universities,
             OUTPUT.stat().st_size / 1024))


if __name__ == "__main__":
    build()
