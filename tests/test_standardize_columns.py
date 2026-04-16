from pathlib import Path

import pandas as pd

from helpers import load_module


standardize_module = load_module(
    "skills/healthcare-column-standardizer/scripts/standardize_columns.py",
    "standardize_columns",
)


def test_standardize_file_applies_canonical_names_and_deduplicates(tmp_path):
    raw_path = tmp_path / "claims.csv"
    pd.DataFrame(
        [
            {
                "member_key": "M1",
                "fname": "Ann",
                "lname": "Lee",
                "zip_cd": "10001",
                "svc_dt": "2026/01/05",
                "paid_amt": 12.5,
            },
            {
                "member_key": "M1",
                "fname": "Ann",
                "lname": "Lee",
                "zip_cd": "10001",
                "svc_dt": "2026/01/05",
                "paid_amt": 12.5,
            },
        ]
    ).to_csv(raw_path, index=False)

    output_dir = tmp_path / "staging"
    manifest = standardize_module.standardize_file(raw_path, output_dir)
    standardized = pd.read_csv(output_dir / "claims.csv")

    assert manifest["file_name"] == "claims.csv"
    assert "member_id" in standardized.columns
    assert "first_name" in standardized.columns
    assert "last_name" in standardized.columns
    assert "service_date" in standardized.columns
    assert standardized.loc[0, "service_date"] == "2026-01-05"
    assert len(standardized) == 1


def test_to_snake_case_handles_mixed_case_and_symbols():
    assert standardize_module.to_snake_case("MemberID") == "member_id"
    assert standardize_module.to_snake_case("Eligibility Start") == "eligibility_start"
    assert standardize_module.to_snake_case("ZIP-CD") == "zip_cd"
