import argparse
from pathlib import Path

import pandas as pd


def aggregate_window(df: pd.DataFrame, member_index: pd.DataFrame, date_column: str, days: int, prefix: str) -> pd.DataFrame:
    window_start = member_index["index_date"] - pd.to_timedelta(days, unit="D")
    keyed = member_index[["member_id", "index_date"]].copy()
    keyed[f"{prefix}_window_start"] = window_start
    merged = keyed.merge(df, on="member_id", how="left")
    filtered = merged.loc[
        merged[date_column].notna()
        & (merged[date_column] > merged[f"{prefix}_window_start"])
        & (merged[date_column] <= merged["index_date"])
    ].copy()
    return filtered


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--staging-dir", default="data/staging")
    parser.add_argument("--target-path", default="data/processed/member_inpatient_target_next_6m.csv")
    parser.add_argument("--output-path", default="data/processed/member_lookback_features.csv")
    args = parser.parse_args()

    staging_dir = Path(args.staging_dir)
    target = pd.read_csv(args.target_path, parse_dates=["index_date"])
    enrollment = pd.read_csv(staging_dir / "enrollment.csv", parse_dates=["birth_date"])
    claims = pd.read_csv(staging_dir / "claims.csv", parse_dates=["service_date"])
    utilization = pd.read_csv(staging_dir / "utilization.csv", parse_dates=["event_date"])
    pharmacy = pd.read_csv(staging_dir / "pharmacy.csv", parse_dates=["fill_date"])
    call_center = pd.read_csv(staging_dir / "call_center.csv", parse_dates=["contact_date"])
    sdoh = pd.read_csv(staging_dir / "sdoh.csv", parse_dates=["assessment_date"])

    features = target[["member_id", "index_date"]].drop_duplicates().copy()
    features = features.merge(
        enrollment[["member_id", "sex", "plan_type", "lob", "metro_region", "diabetes_flag", "birth_date"]],
        on="member_id",
        how="left",
    )
    features["age_at_index"] = ((features["index_date"] - features["birth_date"]).dt.days / 365.25).round(1)
    features = features.drop(columns=["birth_date"])

    for days, label in [(90, "lb_3m"), (180, "lb_6m")]:
        claim_window = aggregate_window(claims, features, "service_date", days, label)
        claim_agg = claim_window.groupby("member_id", as_index=False).agg(
            **{
                f"{label}_claim_count": ("claim_num", "size"),
                f"{label}_paid_amt_sum": ("paid_amt", "sum"),
                f"{label}_er_claim_count": ("er_visit", "sum"),
                f"{label}_pcp_visit_count": ("pcp_visit", "sum"),
                f"{label}_inpatient_claim_flag_sum": ("inpatient_stay", "sum"),
            }
        )

        util_window = aggregate_window(utilization, features, "event_date", days, label)
        util_agg = util_window.groupby("member_id", as_index=False).agg(
            **{
                f"{label}_er_visit_count": ("visit_type", lambda s: int((s == "ER").sum())),
                f"{label}_inpatient_visit_count": ("visit_type", lambda s: int((s == "INPATIENT").sum())),
                f"{label}_observation_visit_count": ("visit_type", lambda s: int((s == "OBSERVATION").sum())),
                f"{label}_los_sum": ("los", "sum"),
                f"{label}_avoidable_visit_count": ("avoidable", "sum"),
            }
        )

        pharm_window = aggregate_window(pharmacy, features, "fill_date", days, label)
        pharm_agg = pharm_window.groupby("member_id", as_index=False).agg(
            **{
                f"{label}_rx_fill_count": ("rx_id", "size"),
                f"{label}_chronic_med_fill_count": ("chronic_med", "sum"),
                f"{label}_avg_pdc": ("pdc", "mean"),
                f"{label}_unique_drug_class_count": ("drug_cls", pd.Series.nunique),
            }
        )

        call_window = aggregate_window(call_center, features, "contact_date", days, label)
        call_agg = call_window.groupby("member_id", as_index=False).agg(
            **{
                f"{label}_call_count": ("call_id", "size"),
                f"{label}_escalated_count": ("escalated", "sum"),
                f"{label}_open_issue_count": ("issue_open", "sum"),
                f"{label}_negative_sentiment_count": ("sentiment", lambda s: int((s == "negative").sum())),
            }
        )

        features = features.merge(claim_agg, on="member_id", how="left")
        features = features.merge(util_agg, on="member_id", how="left")
        features = features.merge(pharm_agg, on="member_id", how="left")
        features = features.merge(call_agg, on="member_id", how="left")

    sdoh_latest = (
        features[["member_id", "index_date"]]
        .merge(sdoh, on="member_id", how="left")
        .loc[lambda df: df["assessment_date"].notna() & (df["assessment_date"] <= df["index_date"])]
        .sort_values(["member_id", "assessment_date"])
        .groupby("member_id", as_index=False)
        .tail(1)
    )
    sdoh_columns = [
        "member_id",
        "transport_issue",
        "food_issue",
        "housing_issue",
        "financial_issue",
        "social_isolation",
        "digital_access",
    ]
    features = features.merge(sdoh_latest[sdoh_columns], on="member_id", how="left")

    value_columns = [c for c in features.columns if c not in {"member_id", "index_date", "sex", "plan_type", "lob", "metro_region"}]
    features[value_columns] = features[value_columns].fillna(0)

    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    features.sort_values("member_id").to_csv(output_path, index=False, date_format="%Y-%m-%d")
    print(f"Wrote {len(features)} member feature rows to {output_path}")


if __name__ == "__main__":
    main()
