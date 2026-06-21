#!/usr/bin/env python3
"""
Ingest the SchemeGuide M24 Playbook Creator workbook into clean JSON the bot loads.

Source (not in the repo): "Copy of M24 Playbook Creator v1.06.xlsx" (SchemeGuide / USFL Sim League).
We keep the EVERGREEN system (the 35-concept declaration taxonomy, buckets + recommended counts,
schemes/tempos/formations, defensive shells/coverages/fronts) and use the M24 play logs only as
REFERENCE example plays + concept->formation availability. Concepts map to HimkageVision engine
keys so the artifacts can render real diagrams. M24 play names are labeled reference, not canon.

Usage:  python tools/ingest-playbook-creator.py [path-to-xlsx]
Writes: data/scheme/*.json
"""
import json
import sys
import os
from collections import Counter, defaultdict
import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Himkage\Desktop\Copy of M24 Playbook Creator v1.06.xlsx"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "scheme")
os.makedirs(OUT, exist_ok=True)

# --- The 35 declaration concepts: bucket + engine concept key (for rendering) ---------------
# bucket -> (label, recommended [min,max])  (from the Scheme 101 sheet)
BUCKETS = {
    "gap_run":  ("Gap Run", [1, 3]),
    "zone_run": ("Zone Run", [1, 3]),
    "rpo":      ("Option / RPO", [0, 2]),
    "pa":       ("Play Action", [1, 2]),
    "quick":    ("Quick Pass", [0, 2]),
    "medium":   ("Medium Pass", [3, 6]),
    "deep":     ("Deep Pass", [1, 4]),
}
# concept -> (bucket, engine_concept_or_None, run_or_pass)
CONCEPTS = {
    "Power":         ("gap_run", "power", "run"),
    "Counter":       ("gap_run", "counter", "run"),
    "Trap":          ("gap_run", "trap", "run"),
    "Sweep":         ("gap_run", "toss", "run"),
    "Outside Zone":  ("zone_run", "outside-zone", "run"),
    "Inside Zone":   ("zone_run", "inside-zone", "run"),
    "Dive":          ("zone_run", "iso", "run"),
    "Draw":          ("zone_run", "draw", "run"),
    "RPO: Screens":  ("rpo", "wr-screen", "pass"),
    "RPO: Downfield": ("rpo", "rpo-slant", "pass"),
    "RPO: Option":   ("rpo", "rpo-bubble", "run"),
    "PA Boots":      ("pa", "flood", "pass"),
    "PA Shots":      ("pa", "four-verticals", "pass"),
    "Ohio":          ("quick", "curls", "pass"),
    "Omaha":         ("quick", "bench", "pass"),
    "Slant":         ("quick", "slants", "pass"),
    "Spacing":       ("quick", "spacing", "pass"),
    "Stick":         ("quick", "stick", "pass"),
    "Choice":        ("medium", "stick", "pass"),
    "Curl":          ("medium", "curls", "pass"),
    "Drive":         ("medium", "drive", "pass"),
    "Follow / Texas": ("medium", "texas", "pass"),
    "Levels":        ("medium", "levels", "pass"),
    "Mesh":          ("medium", "mesh", "pass"),
    "Salem / Pivot": ("medium", "whips", "pass"),
    "Shallow Cross": ("medium", "shallow-cross", "pass"),
    "Smash":         ("medium", "smash", "pass"),
    "Spot":          ("medium", "snag", "pass"),
    "Dagger":        ("deep", "dagger", "pass"),
    "Divide":        ("deep", "mills", "pass"),
    "Flood":         ("deep", "flood", "pass"),
    "Man Beaters":   ("deep", "post-wheel", "pass"),
    "Switch":        ("deep", "switch", "pass"),
    "Verticals":     ("deep", "four-verticals", "pass"),
    "Y Cross":       ("deep", "shallow-cross", "pass"),
}
# play-log concept label -> declaration concept (reconcile the finer 50 labels onto the 35)
PLAYLOG_MAP = {
    "PA Shot": "PA Shots", "Shot Play": "PA Shots",
    "PA Boot": "PA Boots",
    "Inside Zone": "Inside Zone", "Outside Zone": "Outside Zone",
    "Smash": "Smash", "Verticals": "Verticals", "Four Verticals": "Verticals",
    "Power": "Power", "Stick": "Stick", "Dive": "Dive", "Iso": "Dive",
    "Counter": "Counter", "Double Move": "Man Beaters", "Double MOve": "Man Beaters",
    "Curl": "Curl", "Slants": "Slant", "Slant": "Slant", "Flood": "Flood",
    "RPO: 1st Level": "RPO: Screens", "RPO: 2nd Level": "RPO: Downfield",
    "RPO: 3rd Level": "RPO: Downfield", "RPO: Read": "RPO: Option", "Option": "RPO: Option",
    "Screen": "RPO: Screens", "Jet Sweep": "Sweep", "Sweep": "Sweep",
    "Drive": "Drive", "Spot": "Spot", "Spacing": "Spacing", "Draw": "Draw",
    "Shallow Cross": "Shallow Cross", "Choice": "Choice", "Mesh": "Mesh",
    "Divide": "Divide", "Double Dig": "Divide", "Mills": "Divide",
    "Y Cross": "Y Cross", "Dagger": "Dagger", "Follow": "Follow / Texas", "Texas": "Follow / Texas",
    "Salem": "Salem / Pivot", "Levels": "Levels", "Trap": "Trap",
    "Switch": "Switch", "Portland": "Switch", "Omaha": "Omaha", "Ohio": "Ohio",
    "Man Beater": "Man Beaters",
}

wb = openpyxl.load_workbook(SRC, data_only=True)


def named(name):
    d = wb.defined_names[name]
    vals = []
    for sh, ref in d.destinations:
        for row in wb[sh][ref.replace("$", "")]:
            for c in row:
                if c.value not in (None, ""):
                    vals.append(str(c.value).strip())
    return vals


# --- aggregate the OFF play log: declaration concept -> formations + example plays ----------
ws = wb["OFF Play Log"]
agg = defaultdict(lambda: {"formations": Counter(), "examples": []})
seen_ex = defaultdict(set)
for r in ws.iter_rows(min_row=2):
    form, _set, _pers, play, concept = (r[1].value, r[2].value, r[3].value, r[4].value, r[5].value)
    if not concept or not play:
        continue
    decl = PLAYLOG_MAP.get(str(concept).strip())
    if not decl or decl not in CONCEPTS:
        continue
    if form:
        agg[decl]["formations"][str(form).strip()] += 1
    pl = str(play).strip()
    if pl.lower() not in seen_ex[decl] and "patreon" not in pl.lower() and "youtube" not in pl.lower():
        seen_ex[decl].add(pl.lower())
        agg[decl]["examples"].append({"play": pl, "formation": str(form).strip() if form else None})

# --- build concepts.json --------------------------------------------------------------------
concepts = []
for name, (bucket, eng, side) in CONCEPTS.items():
    a = agg.get(name, {"formations": Counter(), "examples": []})
    concepts.append({
        "id": name.lower().replace(" / ", "-").replace(": ", "-").replace(" ", "-"),
        "name": name,
        "bucket": bucket,
        "bucketLabel": BUCKETS[bucket][0],
        "side": side,
        "engineConcept": eng,
        "formations": dict(a["formations"].most_common()),
        "examples": a["examples"][:14],  # M24 reference plays
    })

buckets = [{"id": k, "label": v[0], "recommended": v[1]} for k, v in BUCKETS.items()]

schemes = [{"id": s.lower().replace(": ", "").replace(" ", "-"), "name": s.rstrip(":")} for s in named("Offensive_Schemes")]
tempos = [{"id": t.lower().replace(" - ", "-").replace(" ", "-"), "name": t} for t in named("Offensive_Tempo")]
off_formations = named("Offensive_Formations")
defense = {
    "shells": named("Defensive_Shells"),
    "coverages": [c for c in named("Defensive_Coverages")],
    "coverageTypes": named("Defensive_Coverage_Type"),
    "base": named("Defensive_Base"),
    "schemes": named("Defensive_Schemes"),
    "fronts": named("Defensive_Fronts"),
    "formations": named("Defensive_Formations"),
}


def write(fn, obj):
    with open(os.path.join(OUT, fn), "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
    print("wrote", fn, "-", len(obj) if isinstance(obj, list) else len(obj.keys()), "entries")


write("concepts.json", concepts)
write("buckets.json", buckets)
write("schemes.json", schemes)
write("tempos.json", tempos)
write("formations.json", off_formations)
write("defense.json", defense)

print("\nconcepts:", len(concepts), "| schemes:", len(schemes), "| tempos:", len(tempos),
      "| off formations:", len(off_formations), "| def coverages:", len(defense["coverages"]))
print("source:", SRC)
