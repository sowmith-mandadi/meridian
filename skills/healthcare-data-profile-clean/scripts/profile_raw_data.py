import argparse
import json
from pathlib import Path

import pandas as pd


DATE_HINTS = ("date", "_dt", "_start", "_end")
MEMBER_HINTS = {"memberid", "member_id", "member_key", "member_number", "member_ref", "member_identifier"}


def summarize_file(path: Path) -> dict:
    df = pd.read_csv(path)
    summary = {
        "file_name": path.name,
        "rows": int(len(df)),
        "columns": list(df.columns),
        "duplicate_rows": int(df.duplicated().sum()),
        "missing_by_column": {k: int(v) for k, v in df.isna().sum().items() if int(v) > 0},
        "candidate_member_columns": [c for c in df.columns if c.lower() in MEMBER_HINTS],
        "date_columns": {},
    }
    for column in df.columns:
        lowered = column.lower()
        if any(hint in lowered for hint in DATE_HINTS):
            parsed = pd.to_datetime(df[column], errors="coerce")
            non_null = df[column].notna().sum()
            summary["date_columns"][column] = {
                "non_null_values": int(non_null),
                "parseable_values": int(parsed.notna().sum()),
            }
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", default="data/raw")
    parser.add_argument("--output-path", default="data/staging/profile_summary.json")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    summaries = [summarize_file(path) for path in sorted(input_dir.glob("*.csv"))]
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump({"files": summaries}, handle, indent=2)

    print(f"Wrote profiling summary for {len(summaries)} files to {output_path}")


if __name__ == "__main__":
    main()
