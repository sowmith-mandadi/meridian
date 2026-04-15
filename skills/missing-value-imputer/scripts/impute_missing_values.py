import argparse
import json
from pathlib import Path

import pandas as pd


def impute_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    report = {}
    result = df.copy()
    for column in result.columns:
        lowered = column.lower()
        missing_count = int(result[column].isna().sum())
        if missing_count == 0:
            continue
        if lowered.endswith("_id") or lowered == "member_id" or "date" in lowered:
            report[column] = {"missing": missing_count, "strategy": "left_as_missing"}
            continue
        non_null = result[column].dropna()
        if pd.api.types.is_numeric_dtype(result[column]):
            unique_values = set(non_null.unique().tolist())
            if unique_values.issubset({0, 1}) and unique_values:
                fill_value = 0
                strategy = "fill_zero_binary"
            else:
                fill_value = float(non_null.median()) if not non_null.empty else 0.0
                strategy = "fill_median_numeric"
            result[column] = result[column].fillna(fill_value)
        else:
            fill_value = "unknown"
            strategy = "fill_unknown_categorical"
            result[column] = result[column].fillna(fill_value)
        report[column] = {"missing": missing_count, "strategy": strategy, "fill_value": fill_value}
    return result, report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-path", required=True)
    parser.add_argument("--output-path", required=True)
    parser.add_argument("--report-path", required=True)
    args = parser.parse_args()

    df = pd.read_csv(args.input_path)
    imputed, report = impute_dataframe(df)

    output_path = Path(args.output_path)
    report_path = Path(args.report_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)

    imputed.to_csv(output_path, index=False)
    with report_path.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)

    print(f"Wrote imputed table to {output_path}")
    print(f"Wrote imputation report to {report_path}")


if __name__ == "__main__":
    main()
