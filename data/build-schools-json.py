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
# v2 (28 Oct 2026): v1 plus each university's LMS School UUID, which the form sends as lms_school_id so the sign-up links the
# student to their university (a university has a CRICOS code, which the number field acara_id cannot hold). ACARA schools keep
# linking by acara_id and carry no UUID here, which keeps the file the size of v1 (with a UUID on every school it would be 2.7
# times as big for every visitor). The UUIDs are the HubSpot companies' lms_school_uuid, matched by Source ID (acara_id_code).
OUTPUT_V2 = ROOT / "schools-v2.json"
UNIVERSITY_UUIDS = ROOT / "source" / "university-lms-uuids.csv"

# acara_id carries the CRICOS code for universities. The name stays because
# it is the HubSpot property the form writes into — one hidden field, two id
# schemes, distinguished by `type`.
FIELDS = ("name", "acara_id", "school_code", "state", "suburb", "type")


def build():
    with SOURCE.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    codes = overrides["codes"]
    # "replace" wins over the CSV's own code: two different schools the
    # CSV gives one code to must carry distinct codes, or class matching
    # cannot tell them apart. A CSV refresh cannot undo it.
    replace = overrides.get("replace", {})

    entries = []
    for row in rows:
        entries.append({
            "name": row["school_name"].strip(),
            "acara_id": row["source_id"].strip(),
            "school_code": replace.get(row["source_id"].strip())
                           or row["school_code"].strip()
                           or codes.get(row["source_id"].strip(), ""),
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
    OUTPUT.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")

    with UNIVERSITY_UUIDS.open(newline="", encoding="utf-8") as handle:
        uuids = {row["source_id"].strip(): row["lms_school_uuid"].strip() for row in csv.DictReader(handle)}
    v2 = [dict(e, lms_school_uuid=uuids[e["acara_id"]]) if e["acara_id"] in uuids else e for e in entries]
    OUTPUT_V2.write_text(json.dumps(v2, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    print("%s: %d entries, %d with an LMS School UUID, %.1f KB"
          % (OUTPUT_V2.name, len(v2), sum(1 for e in v2 if "lms_school_uuid" in e), OUTPUT_V2.stat().st_size / 1024))

    universities = sum(1 for e in entries if e["type"] == "University")
    print("%s: %d entries (%d universities, %d schools), %.1f KB"
          % (OUTPUT.name, len(entries), universities, len(entries) - universities,
             OUTPUT.stat().st_size / 1024))


if __name__ == "__main__":
    build()
