import argparse
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AGENTS_PATH = ROOT / "AGENTS.md"
SPECS_PATH = ROOT / "tech_spcs.yml"
STAGING_DIR = ROOT / "data" / "staging"
PROCESSED_DIR = ROOT / "data" / "processed"
FINAL_DATA_PATH = PROCESSED_DIR / "final_member_dataset.csv"
RAW_DIR = ROOT / "data" / "raw"
MODEL_ARTIFACTS_DIR = PROCESSED_DIR / "model_artifacts"
REPORTS_DIR = PROCESSED_DIR / "reports"
DICTIONARIES_DIR = PROCESSED_DIR / "data_dictionaries"
CONFIG_PATH = ROOT / "config" / "spec_defaults.toml"
AGENT_DIR = ROOT / "agents"
SKILL_DIR = ROOT / "skills"


def parse_agents_markdown(path: Path) -> dict:
    lines = path.read_text(encoding="utf-8").splitlines()
    sections: dict[str, list[str]] = {}
    current = "preamble"
    sections[current] = []

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if line.endswith(":") and not line.startswith("- "):
            current = line[:-1].strip().lower().replace(" ", "_")
            sections[current] = []
            continue
        sections.setdefault(current, []).append(line)
    return sections


def load_spec_defaults(path: Path) -> dict:
    with path.open("rb") as handle:
        return tomllib.load(handle)


def discover_source_tables() -> list[str]:
    return sorted(path.name for path in RAW_DIR.glob("*.csv") if not path.name.startswith("member_inpatient_target"))


def discover_agent_names() -> list[str]:
    return sorted(path.stem for path in AGENT_DIR.glob("*.toml"))


def discover_skill_names() -> list[str]:
    return sorted(path.name for path in SKILL_DIR.iterdir() if path.is_dir())


def to_yaml_lines(value, indent: int = 0) -> list[str]:
    prefix = " " * indent
    if isinstance(value, dict):
        lines = []
        for key, item in value.items():
            if isinstance(item, (dict, list)):
                lines.append(f"{prefix}{key}:")
                lines.extend(to_yaml_lines(item, indent + 2))
            else:
                lines.append(f"{prefix}{key}: {format_yaml_scalar(item)}")
        return lines
    if isinstance(value, list):
        lines = []
        for item in value:
            if isinstance(item, (dict, list)):
                lines.append(f"{prefix}-")
                lines.extend(to_yaml_lines(item, indent + 2))
            else:
                lines.append(f"{prefix}- {format_yaml_scalar(item)}")
        return lines
    return [f"{prefix}{format_yaml_scalar(value)}"]


def format_yaml_scalar(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace('"', '\\"')
    return f'"{text}"'


def build_specs_text(agent_sections: dict, defaults: dict) -> str:
    objective_lines = [line[2:].strip() for line in agent_sections.get("objective", []) if line.startswith("- ")]
    workflow = [line[2:].strip() for line in agent_sections.get("core_workflow", []) if line.startswith("- ")]
    if not workflow:
        workflow = [line[2:].strip() for line in agent_sections.get("workflow", []) if line.startswith("- ")]
    data_locations = [line[2:].strip() for line in agent_sections.get("data_locations", []) if line.startswith("- ")]
    guardrails = [line[2:].strip() for line in agent_sections.get("guardrails", []) if line.startswith("- ")]
    objective = " ".join(objective_lines).strip() or defaults.get(
        "objective",
        "Clean raw data, engineer member-level features, and build inpatient visit risk outputs.",
    )
    spec = {
        "project_name": defaults["project_name"],
        "generated_from": AGENTS_PATH.name,
        "final_data_approved": False,
        "human_review_required": defaults.get("human_review_required", True),
        "objective": objective,
        "approval_flow": defaults["approval_flow"],
        "workflow": workflow or defaults.get("workflow", ["Clean raw data", "Build staged member-level data"]),
        "data_contract": defaults["data_contract"],
        "source_tables": discover_source_tables(),
        "agents": discover_agent_names(),
        "skills": discover_skill_names(),
        "entity_contract": defaults["entity_contract"],
        "target_definition": defaults["target_definition"],
        "feature_policy": defaults["feature_policy"],
        "model_policy": defaults["model_policy"],
        "validation": defaults["validation"],
        "deliverables": defaults["pipeline_outputs"]["deliverables"],
        "notes": data_locations + guardrails + defaults.get("notes", []),
    }
    yaml_lines = []
    yaml_lines.extend(to_yaml_lines({"project_name": spec["project_name"]}))
    yaml_lines.extend(to_yaml_lines({"generated_from": spec["generated_from"]}))
    yaml_lines.extend(to_yaml_lines({"final_data_approved": spec["final_data_approved"]}))
    yaml_lines.extend(to_yaml_lines({"human_review_required": spec["human_review_required"]}))
    yaml_lines.append("objective: |")
    yaml_lines.append(f'  {spec["objective"]}')
    for section_name in [
        "approval_flow",
        "workflow",
        "data_contract",
        "source_tables",
        "agents",
        "skills",
        "entity_contract",
        "target_definition",
        "feature_policy",
        "model_policy",
        "validation",
        "deliverables",
        "notes",
    ]:
        yaml_lines.append(f"{section_name}:")
        yaml_lines.extend(to_yaml_lines(spec[section_name], indent=2))
    return "\n".join(yaml_lines) + "\n"


def ensure_specs_file(force: bool) -> bool:
    if SPECS_PATH.exists() and not force:
        return False
    specs_text = build_specs_text(parse_agents_markdown(AGENTS_PATH), load_spec_defaults(CONFIG_PATH))
    SPECS_PATH.write_text(specs_text, encoding="utf-8")
    return True


def is_specs_approved(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"(?m)^final_data_approved:\s*(.+?)\s*$", text)
    if not match:
        return False
    value = match.group(1).strip().strip('"').strip("'").lower()
    return value in {"true", "yes"}


def mark_specs_approved(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    updated_text, replacements = re.subn(
        r"(?m)^final_data_approved:\s*.+?\s*$",
        "final_data_approved: true",
        text,
        count=1,
    )
    if replacements == 0:
        raise ValueError(f"Could not find top-level final_data_approved in {path}")
    if updated_text != text:
        path.write_text(updated_text, encoding="utf-8")
        return True
    return False


def run_step(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def require_pandas():
    try:
        import pandas as pd
    except ImportError as exc:  # pragma: no cover - environment dependent.
        raise RuntimeError(
            "This pipeline requires pandas. Install Python dependencies with "
            "`python3 -m pip install -r requirements.txt` before running the approved data steps."
        ) from exc
    return pd


def describe_column(series) -> dict:
    pd = require_pandas()
    non_null = int(series.notna().sum())
    missing = int(series.isna().sum())
    unique = int(series.nunique(dropna=True))
    sample_values = [str(value) for value in series.dropna().head(3).tolist()]
    description = {
        "column_name": series.name,
        "dtype": str(series.dtype),
        "non_null_count": non_null,
        "missing_count": missing,
        "unique_count": unique,
        "sample_values": sample_values,
    }
    if pd.api.types.is_numeric_dtype(series):
        description["min"] = None if non_null == 0 else float(series.min())
        description["max"] = None if non_null == 0 else float(series.max())
    return description


def write_dataset_metadata(csv_path: Path) -> None:
    pd = require_pandas()
    df = pd.read_csv(csv_path)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    DICTIONARIES_DIR.mkdir(parents=True, exist_ok=True)

    report = {
        "dataset_name": csv_path.name,
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "duplicate_rows": int(df.duplicated().sum()),
        "missing_cells": int(df.isna().sum().sum()),
        "column_names": list(df.columns),
    }
    report_path = REPORTS_DIR / f"{csv_path.stem}_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    dictionary_rows = [describe_column(df[column]) for column in df.columns]
    dictionary_df = pd.DataFrame(dictionary_rows)
    dictionary_df["sample_values"] = dictionary_df["sample_values"].apply(lambda values: " | ".join(values))
    dictionary_df.to_csv(DICTIONARIES_DIR / f"{csv_path.stem}_data_dictionary.csv", index=False)


def create_final_data() -> None:
    pd = require_pandas()
    STAGING_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    python_cmd = sys.executable or "python3"
    run_step([python_cmd, "skills/healthcare-data-profile-clean/scripts/profile_raw_data.py", "--input-dir", "data/raw", "--output-path", "data/staging/profile_summary.json"])
    run_step([python_cmd, "skills/healthcare-column-standardizer/scripts/standardize_columns.py", "--input-dir", "data/raw", "--output-dir", "data/staging", "--manifest-path", "data/staging/column_standardization_manifest.json"])
    run_step([python_cmd, "skills/data-cleaning-tests/scripts/validate_staging_tables.py", "--input-dir", "data/staging"])
    run_step([python_cmd, "skills/inpatient-target-labeler/scripts/create_inpatient_target.py"])
    run_step([python_cmd, "skills/member-lookback-features/scripts/build_member_lookback_features.py", "--staging-dir", "data/staging", "--target-path", "data/processed/member_inpatient_target_next_6m.csv", "--output-path", "data/processed/member_lookback_features.csv"])
    run_step([python_cmd, "skills/tabular-preprocessing/scripts/build_preprocessing_manifest.py", "--input-path", "data/processed/member_lookback_features.csv", "--output-path", "data/processed/preprocessing_manifest.json"])
    run_step([python_cmd, "skills/logistic-risk-model/scripts/train_logistic_model.py", "--features-path", "data/processed/member_lookback_features.csv", "--target-path", "data/processed/member_inpatient_target_next_6m.csv", "--output-dir", "data/processed/model_artifacts"])

    features = pd.read_csv(PROCESSED_DIR / "member_lookback_features.csv")
    target = pd.read_csv(PROCESSED_DIR / "member_inpatient_target_next_6m.csv")
    scores = pd.read_csv(MODEL_ARTIFACTS_DIR / "full_dataset_scores.csv")
    scores = scores.rename(columns={"predicted_probability": "inpatient_hospitalization_risk_probability"})
    driver_columns = [
        "explanation_method",
        "top_driver_1_feature",
        "top_driver_1_value",
        "top_driver_1_contribution",
        "top_driver_1_direction",
        "top_driver_2_feature",
        "top_driver_2_value",
        "top_driver_2_contribution",
        "top_driver_2_direction",
        "top_driver_3_feature",
        "top_driver_3_value",
        "top_driver_3_contribution",
        "top_driver_3_direction",
    ]
    final_df = features.merge(target, on=["member_id", "index_date"], how="left")
    final_df = final_df.merge(
        scores[["member_id", "index_date", "inpatient_hospitalization_risk_probability", *driver_columns]],
        on=["member_id", "index_date"],
        how="left",
    )
    final_df.sort_values("member_id").to_csv(FINAL_DATA_PATH, index=False)

    generated_csvs = sorted(STAGING_DIR.glob("*.csv")) + [
        PROCESSED_DIR / "member_inpatient_target_next_6m.csv",
        PROCESSED_DIR / "member_lookback_features.csv",
        FINAL_DATA_PATH,
        MODEL_ARTIFACTS_DIR / "full_dataset_scores.csv",
        MODEL_ARTIFACTS_DIR / "holdout_scores.csv",
        MODEL_ARTIFACTS_DIR / "member_top_drivers.csv",
        MODEL_ARTIFACTS_DIR / "holdout_member_top_drivers.csv",
        MODEL_ARTIFACTS_DIR / "coefficients.csv",
    ]
    for csv_path in generated_csvs:
        if csv_path.exists():
            write_dataset_metadata(csv_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force-regenerate-specs", action="store_true")
    parser.add_argument(
        "--approve-final-data",
        action="store_true",
        help="Set top-level final_data_approved: true in tech_spcs.yml, then exit.",
    )
    args = parser.parse_args()

    if args.approve_final_data:
        if not SPECS_PATH.exists():
            print(f"Specs file not found at {SPECS_PATH}. Generate it first with --force-regenerate-specs.")
            return
        changed = mark_specs_approved(SPECS_PATH)
        if changed:
            print(f"Updated {SPECS_PATH} to set final_data_approved: true")
        else:
            print(f"{SPECS_PATH} already has final_data_approved: true")
        return

    created = ensure_specs_file(force=args.force_regenerate_specs)
    if created:
        print(f"Created specs draft at {SPECS_PATH}")
        print("Human review required. Review tech_spcs.yml, set final_data_approved: true if acceptable, then rerun this script.")
        return

    if not is_specs_approved(SPECS_PATH):
        print(f"Specs file found at {SPECS_PATH}, but approval is still blocked.")
        print("Please review tech_spcs.yml and set final_data_approved: true before final data creation.")
        return

    create_final_data()
    print(f"Final data created at {FINAL_DATA_PATH}")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        print(f"Pipeline step failed with exit code {exc.returncode}: {exc.cmd}", file=sys.stderr)
        sys.exit(exc.returncode)
