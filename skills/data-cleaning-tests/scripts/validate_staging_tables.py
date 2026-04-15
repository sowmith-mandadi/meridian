import argparse
import sys
from pathlib import Path

import pandas as pd


REQUIRED_COLUMNS = {
    "enrollment.csv": {"member_id", "eligibility_start", "eligibility_end"},
    "claims.csv": {"member_id", "service_date"},
    "utilization.csv": {"member_id", "event_date"},
    "pharmacy.csv": {"member_id", "fill_date"},
    "call_center.csv": {"member_id", "contact_date"},
    "sdoh.csv": {"member_id", "assessment_date"},
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", default="data/staging")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    failures = []

    for file_name, required in REQUIRED_COLUMNS.items():
        path = input_dir / file_name
        if not path.exists():
            failures.append(f"Missing file: {file_name}")
            continue
        df = pd.read_csv(path)
        missing_columns = sorted(required.difference(df.columns))
        if missing_columns:
            failures.append(f"{file_name}: missing columns {missing_columns}")
        bad_columns = [column for column in df.columns if column != column.lower() or " " in column]
        if bad_columns:
            failures.append(f"{file_name}: non-standard columns {bad_columns}")
        if df.duplicated().any():
            failures.append(f"{file_name}: contains duplicate rows")
        for column in [c for c in df.columns if "date" in c or c.endswith("_start") or c.endswith("_end")]:
            parsed = pd.to_datetime(df[column], errors="coerce")
            non_null = df[column].notna().sum()
            if parsed.notna().sum() != non_null:
                failures.append(f"{file_name}: unparsable values in {column}")

    if failures:
        for failure in failures:
            print(failure)
        sys.exit(1)

    print(f"Validated {len(REQUIRED_COLUMNS)} staged tables successfully")


if __name__ == "__main__":
    main()
