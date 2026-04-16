import subprocess
import sys
from pathlib import Path

import pandas as pd


REQUIRED_FILES = {
    "enrollment.csv": {"member_id": ["M1"], "eligibility_start": ["2025-01-01"], "eligibility_end": ["2026-12-31"]},
    "claims.csv": {"member_id": ["M1"], "service_date": ["2025-12-01"]},
    "utilization.csv": {"member_id": ["M1"], "event_date": ["2025-12-10"]},
    "pharmacy.csv": {"member_id": ["M1"], "fill_date": ["2025-12-15"]},
    "call_center.csv": {"member_id": ["M1"], "contact_date": ["2025-12-20"]},
    "sdoh.csv": {"member_id": ["M1"], "assessment_date": ["2025-12-25"]},
}


def write_valid_staging_dir(base_dir: Path) -> None:
    for file_name, payload in REQUIRED_FILES.items():
        pd.DataFrame(payload).to_csv(base_dir / file_name, index=False)


def test_validate_staging_tables_passes_for_valid_inputs(tmp_path):
    write_valid_staging_dir(tmp_path)
    result = subprocess.run(
        [
            sys.executable,
            "skills/data-cleaning-tests/scripts/validate_staging_tables.py",
            "--input-dir",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    assert "Validated 6 staged tables successfully" in result.stdout


def test_validate_staging_tables_fails_for_unparseable_dates(tmp_path):
    write_valid_staging_dir(tmp_path)
    pd.DataFrame({"member_id": ["M1"], "event_date": ["not-a-date"]}).to_csv(tmp_path / "utilization.csv", index=False)

    result = subprocess.run(
        [
            sys.executable,
            "skills/data-cleaning-tests/scripts/validate_staging_tables.py",
            "--input-dir",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 1
    assert "utilization.csv: unparsable values in event_date" in result.stdout
