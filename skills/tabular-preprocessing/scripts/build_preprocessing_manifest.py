import argparse
import json
from pathlib import Path

import pandas as pd


EXCLUDE_HINTS = ("member_id", "index_date", "label_window", "eligibility_", "_next_6m", "birth_date")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-path", required=True)
    parser.add_argument("--output-path", required=True)
    args = parser.parse_args()

    df = pd.read_csv(args.input_path)
    manifest = {"exclude": [], "numeric": {}, "categorical": {}, "binary": []}

    for column in df.columns:
        lowered = column.lower()
        if any(hint in lowered for hint in EXCLUDE_HINTS):
            manifest["exclude"].append(column)
            continue
        series = df[column]
        if pd.api.types.is_numeric_dtype(series):
            unique_values = set(series.dropna().unique().tolist())
            if unique_values and unique_values.issubset({0, 1}):
                manifest["binary"].append(column)
            else:
                manifest["numeric"][column] = {"scaling": "standardize", "imputation": "median"}
        else:
            manifest["categorical"][column] = {"cleanup": "strip_lower", "encoding": "one_hot", "imputation": "unknown"}

    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)

    print(f"Wrote preprocessing manifest to {output_path}")


if __name__ == "__main__":
    main()
