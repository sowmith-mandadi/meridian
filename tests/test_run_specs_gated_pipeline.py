from pathlib import Path

from helpers import load_module


pipeline_module = load_module(
    "scripts/run_specs_gated_pipeline.py",
    "run_specs_gated_pipeline",
)


def test_specs_approval_does_not_match_explanatory_text(tmp_path):
    specs_path = tmp_path / "tech_spcs.yml"
    specs_path.write_text(
        "\n".join(
            [
                "final_data_approved: false",
                "approval_flow:",
                '  step_3: "Human sets final_data_approved: true"',
            ]
        ),
        encoding="utf-8",
    )

    assert pipeline_module.is_specs_approved(specs_path) is False


def test_specs_approval_matches_top_level_true(tmp_path):
    specs_path = tmp_path / "tech_spcs.yml"
    specs_path.write_text(
        "\n".join(
            [
                "final_data_approved: true",
                'notes: "approved by reviewer"',
            ]
        ),
        encoding="utf-8",
    )

    assert pipeline_module.is_specs_approved(specs_path) is True
