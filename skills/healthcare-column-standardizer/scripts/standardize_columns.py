import argparse
import json
import re
from pathlib import Path

import pandas as pd


FILE_SPECIFIC_RENAMES = {
    "enrollment.csv": {"memberid": "member_id", "dob": "birth_date", "zip": "zip_code"},
    "claims.csv": {"member_key": "member_id", "fname": "first_name", "lname": "last_name", "zip_cd": "zip_code", "svc_dt": "service_date"},
    "utilization.csv": {"member_number": "member_id", "zip_cd": "zip_code", "event_dt": "event_date"},
    "pharmacy.csv": {"member_identifier": "member_id", "zip_cd": "zip_code", "fill_dt": "fill_date"},
    "call_center.csv": {"member_ref": "member_id", "zip_cd": "zip_code", "contact_dt": "contact_date"},
    "sdoh.csv": {"assess_dt": "assessment_date"},
}

GLOBAL_RENAMES = {
    "first_nm": "first_name",
    "last_nm": "last_name",
    "birth_dt": "birth_date",
    "birthdate": "birth_date",
    "zip_cd": "zip_code",
}

DATE_COLUMNS = {
    "birth_date",
    "service_date",
    "event_date",
    "fill_date",
    "contact_date",
    "assessment_date",
    "eligibility_start",
    "eligibility_end",
}


def to_snake_case(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_")
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", value)
    return value.lower()


def standardize_file(path: Path, output_dir: Path) -> dict:
    df = pd.read_csv(path)
    original_columns = list(df.columns)
    df.columns = [to_snake_case(column) for column in df.columns]
    rename_map = {**GLOBAL_RENAMES, **FILE_SPECIFIC_RENAMES.get(path.name, {})}
    df = df.rename(columns=rename_map)

    for column in DATE_COLUMNS.intersection(df.columns):
        df[column] = pd.to_datetime(df[column], errors="coerce").dt.strftime("%Y-%m-%d")

    df = df.drop_duplicates()
    output_path = output_dir / path.name
    output_dir.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)

    return {
        "file_name": path.name,
        "original_columns": original_columns,
        "standardized_columns": list(df.columns),
        "rows_written": int(len(df)),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", default="data/raw")
    parser.add_argument("--output-dir", default="data/staging")
    parser.add_argument("--manifest-path", default="data/staging/column_standardization_manifest.json")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    manifest_path = Path(args.manifest_path)

    manifest = [standardize_file(path, output_dir) for path in sorted(input_dir.glob("*.csv"))]
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with manifest_path.open("w", encoding="utf-8") as handle:
        json.dump({"files": manifest}, handle, indent=2)

    print(f"Standardized {len(manifest)} files into {output_dir}")


if __name__ == "__main__":
    main()
