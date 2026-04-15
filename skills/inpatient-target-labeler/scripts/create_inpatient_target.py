from pathlib import Path

import pandas as pd


STAGING_DIR = Path("data/staging")
OUTPUT_DIR = Path("data/processed")
OUTPUT_PATH = OUTPUT_DIR / "member_inpatient_target_next_6m.csv"


def main() -> None:
    enrollment = pd.read_csv(STAGING_DIR / "enrollment.csv", parse_dates=["eligibility_start", "eligibility_end"])
    utilization = pd.read_csv(STAGING_DIR / "utilization.csv", parse_dates=["event_date"])

    last_observed_date = utilization["event_date"].max().normalize()
    index_date = last_observed_date - pd.DateOffset(months=6)
    window_start = index_date + pd.Timedelta(days=1)
    window_end = last_observed_date

    inpatient_events = utilization.loc[
        utilization["visit_type"].eq("INPATIENT")
        & utilization["event_date"].between(window_start, window_end),
        ["member_id", "event_date"],
    ]
    summary = inpatient_events.groupby("member_id", as_index=False).agg(
        inpatient_hospital_visit_count_next_6m=("event_date", "size"),
        first_inpatient_hospital_visit_dt_next_6m=("event_date", "min"),
    )

    target = enrollment[["member_id", "eligibility_start", "eligibility_end"]].drop_duplicates()
    target["index_date"] = index_date
    target["label_window_start"] = window_start
    target["label_window_end"] = window_end
    target = target.merge(summary, on="member_id", how="left")
    target["inpatient_hospital_visit_count_next_6m"] = target["inpatient_hospital_visit_count_next_6m"].fillna(0).astype(int)
    target["inpatient_hospital_visit_next_6m"] = (target["inpatient_hospital_visit_count_next_6m"] > 0).astype(int)
    target["days_until_first_inpatient_hospital_visit_next_6m"] = (
        target["first_inpatient_hospital_visit_dt_next_6m"] - target["index_date"]
    ).dt.days
    target["eligible_for_full_lookforward_window"] = (target["eligibility_end"] >= target["label_window_end"]).astype(int)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    target.sort_values("member_id").to_csv(OUTPUT_PATH, index=False, date_format="%Y-%m-%d")
    print(f"Wrote {len(target)} target rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
