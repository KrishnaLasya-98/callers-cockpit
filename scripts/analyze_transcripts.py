"""Reproduce aggregate research without exporting source dialogue or identities."""
import argparse
from collections import Counter
import csv
import json
from pathlib import Path
import statistics


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="Private extracted archive directory")
    parser.add_argument("--annotations", type=Path, help="Optional private per-call stage annotations")
    args = parser.parse_args()
    with (args.source / "index.csv").open(encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    ids = {row["id"] for row in rows}
    if len(rows) != 100 or len(ids) != 100:
        raise SystemExit("Expected 100 unique indexed calls")
    transcript_ids = {path.stem for path in (args.source / "transcripts").glob("T*.txt")}
    if ids != transcript_ids:
        raise SystemExit("Transcript files and index do not match")
    durations = [int(row["duration_seconds"]) for row in rows]
    result = {"calls": len(rows), "duration_seconds": {
        "mean": statistics.mean(durations), "median": statistics.median(durations),
        "minimum": min(durations), "maximum": max(durations)},
        "logged_outcomes": dict(sorted(Counter(row["outcome"] for row in rows).items()))}
    if args.annotations:
        annotations = json.loads(args.annotations.read_text(encoding="utf-8"))
        if set(annotations) != ids:
            raise SystemExit("Annotations must cover exactly the indexed calls")
        stages = [entry["stage"] for entry in annotations.values()]
        if any(type(stage) is not int or stage < 1 or stage > 8 for stage in stages):
            raise SystemExit("Stages must be integers in 1..8")
        result["human_annotated_stages"] = dict(sorted(Counter(stages).items()))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
