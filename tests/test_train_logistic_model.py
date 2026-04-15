import pandas as pd

from helpers import load_module


model_module = load_module(
    "skills/logistic-risk-model/scripts/train_logistic_model.py",
    "train_logistic_model",
)


def test_build_member_driver_outputs_returns_ranked_member_drivers():
    entity_frame = pd.DataFrame(
        [
            {"member_id": "M1", "index_date": "2026-01-01"},
            {"member_id": "M2", "index_date": "2026-01-01"},
        ]
    )
    feature_values = pd.DataFrame(
        [
            {"feature_a": 10.0, "feature_b": 1.0, "feature_c": 0.0},
            {"feature_a": 0.0, "feature_b": 3.0, "feature_c": 1.0},
        ]
    )
    contributions = pd.DataFrame(
        [
            {"feature_a": 1.2, "feature_b": -0.3, "feature_c": 0.1},
            {"feature_a": 0.0, "feature_b": -0.8, "feature_c": 0.5},
        ]
    )

    summary, long_output = model_module.build_member_driver_outputs(
        entity_frame=entity_frame,
        feature_values=feature_values,
        contributions=contributions,
        explanation_method="linear_contribution_fallback",
        top_k=2,
    )

    assert summary.loc[0, "top_driver_1_feature"] == "feature_a"
    assert summary.loc[0, "top_driver_1_direction"] == "increase_risk"
    assert summary.loc[1, "top_driver_1_feature"] == "feature_b"
    assert summary.loc[1, "top_driver_1_direction"] == "decrease_risk"
    assert len(long_output) == 4
    assert set(long_output["rank"]) == {1, 2}
    assert set(long_output["explanation_method"]) == {"linear_contribution_fallback"}


def test_compute_linear_contributions_multiplies_feature_values_by_coefficients():
    feature_frame = pd.DataFrame([{"a": 2.0, "b": -1.0}])
    coefficients = pd.Series({"a": 0.5, "b": 2.0})

    contributions = model_module.compute_linear_contributions(feature_frame, coefficients)

    assert contributions.loc[0, "a"] == 1.0
    assert contributions.loc[0, "b"] == -2.0
