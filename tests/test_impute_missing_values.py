import pandas as pd

from helpers import load_module


impute_module = load_module(
    "skills/missing-value-imputer/scripts/impute_missing_values.py",
    "impute_missing_values",
)


def test_impute_dataframe_uses_type_aware_strategies():
    df = pd.DataFrame(
        {
            "member_id": ["M1", "M2", None],
            "event_date": ["2026-01-01", None, "2026-02-01"],
            "binary_flag": [1, None, 0],
            "numeric_feature": [10.0, None, 20.0],
            "category_feature": ["a", None, "b"],
        }
    )

    imputed, report = impute_module.impute_dataframe(df)

    assert pd.isna(imputed.loc[2, "member_id"])
    assert pd.isna(imputed.loc[1, "event_date"])
    assert imputed.loc[1, "binary_flag"] == 0
    assert imputed.loc[1, "numeric_feature"] == 15.0
    assert imputed.loc[1, "category_feature"] == "unknown"
    assert report["member_id"]["strategy"] == "left_as_missing"
    assert report["binary_flag"]["strategy"] == "fill_zero_binary"
    assert report["numeric_feature"]["strategy"] == "fill_median_numeric"
    assert report["category_feature"]["strategy"] == "fill_unknown_categorical"
