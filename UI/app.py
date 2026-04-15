from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
import streamlit as st


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
STAGING_DIR = DATA_DIR / "staging"
PROCESSED_DIR = DATA_DIR / "processed"
MODEL_ARTIFACTS_DIR = PROCESSED_DIR / "model_artifacts"
REPORTS_DIR = PROCESSED_DIR / "reports"
DICTIONARIES_DIR = PROCESSED_DIR / "data_dictionaries"

RISK_COLUMN = "inpatient_hospitalization_risk_probability"
TARGET_COLUMN = "inpatient_hospital_visit_next_6m"


st.set_page_config(
    page_title="Inpatient Risk Analytics Hub",
    page_icon=":material/monitoring:",
    layout="wide",
    initial_sidebar_state="expanded",
)


st.markdown(
    """
    <style>
    .stApp {
        background:
            radial-gradient(circle at top left, rgba(244, 191, 105, 0.18), transparent 30%),
            radial-gradient(circle at top right, rgba(80, 147, 140, 0.16), transparent 28%),
            linear-gradient(180deg, #f7f5ef 0%, #f2efe5 100%);
    }
    .block-container {
        padding-top: 1.5rem;
        padding-bottom: 2rem;
        max-width: 1400px;
    }
    .hero-card {
        padding: 1.2rem 1.4rem;
        border-radius: 20px;
        background: linear-gradient(135deg, rgba(19, 43, 53, 0.97), rgba(52, 92, 103, 0.93));
        color: #f7f5ef;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 18px 48px rgba(19, 43, 53, 0.18);
    }
    .soft-card {
        padding: 1rem 1.1rem;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(19, 43, 53, 0.08);
        box-shadow: 0 10px 26px rgba(19, 43, 53, 0.06);
    }
    .section-label {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #6d7f84;
        margin-bottom: 0.2rem;
    }
    .metric-big {
        font-size: 1.8rem;
        font-weight: 700;
        color: #132b35;
        line-height: 1.1;
    }
    .small-note {
        color: #54686f;
        font-size: 0.92rem;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


def nice_name(name: str) -> str:
    return name.replace("_", " ").strip().title()


def format_number(value: float | int | None, digits: int = 2) -> str:
    if value is None or pd.isna(value):
        return "-"
    if isinstance(value, (int, np.integer)):
        return f"{int(value):,}"
    return f"{float(value):,.{digits}f}"


@st.cache_data(show_spinner=False)
def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path)


@st.cache_data(show_spinner=False)
def read_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def list_files(folder: Path, pattern: str) -> list[Path]:
    if not folder.exists():
        return []
    return sorted(folder.glob(pattern))


def collect_tables() -> dict[str, dict[str, Path]]:
    return {
        "Raw": {path.name: path for path in list_files(RAW_DIR, "*.csv")},
        "Staging": {path.name: path for path in list_files(STAGING_DIR, "*.csv")},
        "Processed": {path.name: path for path in list_files(PROCESSED_DIR, "*.csv")},
        "Artifacts": {path.name: path for path in list_files(MODEL_ARTIFACTS_DIR, "*.csv")},
        "Data Dictionaries": {path.name: path for path in list_files(DICTIONARIES_DIR, "*.csv")},
        "Reports": {path.name: path for path in list_files(REPORTS_DIR, "*.json")},
    }


@st.cache_data(show_spinner=False)
def load_all_core_data() -> dict[str, pd.DataFrame | dict]:
    datasets: dict[str, pd.DataFrame | dict] = {}
    for group, files in collect_tables().items():
        for name, path in files.items():
            key = f"{group}/{name}"
            if path.suffix.lower() == ".csv":
                datasets[key] = read_csv(path)
            elif path.suffix.lower() == ".json":
                datasets[key] = read_json(path)
    return datasets


def get_frame(key: str) -> pd.DataFrame:
    data = load_all_core_data().get(key)
    if isinstance(data, pd.DataFrame):
        return data.copy()
    return pd.DataFrame()


def get_json(key: str) -> dict:
    data = load_all_core_data().get(key)
    if isinstance(data, dict):
        return data
    return {}


def score_band(series: pd.Series) -> pd.Series:
    bins = [-0.001, 0.05, 0.1, 0.2, 0.4, 1.0]
    labels = ["Very Low", "Low", "Emerging", "Moderate", "High"]
    return pd.cut(series.clip(0, 1), bins=bins, labels=labels)


def render_card(title: str, value: str, subtitle: str) -> None:
    st.markdown(
        f"""
        <div class="soft-card">
            <div class="section-label">{title}</div>
            <div class="metric-big">{value}</div>
            <div class="small-note">{subtitle}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_hero() -> None:
    st.markdown(
        """
        <div class="hero-card">
            <div class="section-label" style="color:#c7d5d8;">Inpatient Hospitalization Risk</div>
            <div style="font-size:2.2rem;font-weight:800;line-height:1.05;">Analytics Hub</div>
            <div style="max-width:900px;margin-top:0.7rem;color:#e8efef;font-size:1rem;">
                Explore raw source data, cleaned staging outputs, final member-level features, model performance,
                and per-member risk drivers in one place.
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def profile_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["column", "dtype", "missing_pct", "unique_values"])
    profile = pd.DataFrame(
        {
            "column": df.columns,
            "dtype": [str(df[column].dtype) for column in df.columns],
            "missing_pct": [float(df[column].isna().mean() * 100) for column in df.columns],
            "unique_values": [int(df[column].nunique(dropna=True)) for column in df.columns],
        }
    )
    return profile.sort_values(["missing_pct", "unique_values"], ascending=[False, False]).reset_index(drop=True)


def filtered_dataframe(df: pd.DataFrame, query: str) -> pd.DataFrame:
    if not query:
        return df
    lowered = query.lower().strip()
    mask = df.astype(str).apply(lambda col: col.str.lower().str.contains(lowered, na=False))
    return df.loc[mask.any(axis=1)]


def render_overview(final_df: pd.DataFrame, full_scores: pd.DataFrame, metrics: dict, coefficients: pd.DataFrame) -> None:
    left, right = st.columns([1.3, 1.0], gap="large")
    with left:
        st.subheader("Portfolio Snapshot")
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            render_card("Members Scored", format_number(len(full_scores), 0), "Distinct rows in the full scoring output")
        with col2:
            high_risk = int((full_scores.get("predicted_probability", pd.Series(dtype=float)) >= 0.2).sum())
            render_card("High-Risk Members", format_number(high_risk, 0), "Probability >= 0.20")
        with col3:
            observed_rate = final_df[TARGET_COLUMN].mean() if TARGET_COLUMN in final_df else np.nan
            render_card("Observed Event Rate", format_number(observed_rate * 100 if pd.notna(observed_rate) else None), "Percent with inpatient event")
        with col4:
            mean_risk = full_scores["predicted_probability"].mean() if "predicted_probability" in full_scores else np.nan
            render_card("Average Risk", format_number(mean_risk * 100 if pd.notna(mean_risk) else None), "Mean predicted probability")

        st.markdown("")
        band_counts = (
            full_scores.assign(risk_band=score_band(full_scores["predicted_probability"]))
            .groupby("risk_band", observed=False)
            .size()
            .reindex(["Very Low", "Low", "Emerging", "Moderate", "High"], fill_value=0)
            .rename("members")
            .reset_index()
        )
        st.markdown('<div class="soft-card">', unsafe_allow_html=True)
        st.markdown("##### Risk Segmentation")
        st.bar_chart(band_counts.set_index("risk_band"))
        st.caption("Risk bands help a manager quickly identify how concentrated the portfolio is in moderate and high-risk cohorts.")
        st.markdown("</div>", unsafe_allow_html=True)

    with right:
        st.subheader("Model Health")
        m1, m2 = st.columns(2)
        with m1:
            render_card("ROC AUC", format_number(metrics.get("roc_auc")), "Holdout discrimination")
        with m2:
            render_card("Average Precision", format_number(metrics.get("average_precision")), "Holdout ranking quality")
        m3, m4 = st.columns(2)
        with m3:
            render_card("Accuracy", format_number(metrics.get("accuracy")), "Thresholded at 0.50")
        with m4:
            render_card("Brier Score", format_number(metrics.get("brier_score")), "Lower is better")

        if not coefficients.empty:
            top_positive = coefficients.sort_values("coefficient", ascending=False).head(8).set_index("feature")
            st.markdown('<div class="soft-card">', unsafe_allow_html=True)
            st.markdown("##### Strongest Positive Global Predictors")
            st.bar_chart(top_positive[["coefficient"]])
            st.markdown("</div>", unsafe_allow_html=True)

    st.subheader("Signals Worth Attention")
    alerts = []
    if "predicted_probability" in full_scores:
        high_share = float((full_scores["predicted_probability"] >= 0.2).mean())
        alerts.append(f"{format_number(high_share * 100)}% of scored members fall into the moderate-or-higher risk segment.")
    if "top_driver_1_feature" in final_df:
        common_top = final_df["top_driver_1_feature"].value_counts().head(5)
        if not common_top.empty:
            alerts.append("Most common top driver features: " + ", ".join(common_top.index.tolist()))
    if "actual" in full_scores and "predicted_probability" in full_scores:
        positive_mean = full_scores.loc[full_scores["actual"] == 1, "predicted_probability"].mean()
        negative_mean = full_scores.loc[full_scores["actual"] == 0, "predicted_probability"].mean()
        if pd.notna(positive_mean) and pd.notna(negative_mean):
            alerts.append(
                f"Members with observed inpatient visits average {format_number(positive_mean * 100)}% predicted risk versus {format_number(negative_mean * 100)}% for non-events."
            )
    for note in alerts:
        st.info(note)


def render_dataset_explorer(tables: dict[str, dict[str, Path]]) -> None:
    st.subheader("Dataset Explorer")
    group = st.selectbox("Data Group", list(tables.keys()))
    names = list(tables[group].keys())
    if not names:
        st.warning("No files found for this section.")
        return
    selected = st.selectbox("Dataset", names)
    path = tables[group][selected]
    st.caption(f"Source: `{path.relative_to(ROOT)}`")

    if path.suffix.lower() == ".json":
        payload = read_json(path)
        st.json(payload)
        return

    df = read_csv(path)
    q1, q2, q3 = st.columns([1.4, 1, 1])
    with q1:
        search = st.text_input("Search Rows", placeholder="Filter rows by keyword")
    with q2:
        max_rows = st.slider("Rows to Preview", 10, min(500, max(len(df), 10)), min(100, max(len(df), 10)), step=10)
    with q3:
        show_profile = st.toggle("Show Column Profile", value=True)

    filtered = filtered_dataframe(df, search)
    c1, c2, c3 = st.columns(3)
    c1.metric("Rows", format_number(len(filtered), 0))
    c2.metric("Columns", format_number(len(df.columns), 0))
    c3.metric("Missing Cells", format_number(int(filtered.isna().sum().sum()), 0))

    st.dataframe(filtered.head(max_rows), use_container_width=True, hide_index=True)
    if show_profile:
        st.markdown("##### Column Profile")
        st.dataframe(profile_dataframe(filtered), use_container_width=True, hide_index=True)


def render_member_explorer(final_df: pd.DataFrame, long_drivers: pd.DataFrame) -> None:
    st.subheader("Member Explorer")
    if final_df.empty:
        st.warning("Final member dataset not found.")
        return

    search_id = st.text_input("Member ID", value=str(final_df["member_id"].iloc[0]))
    matched = final_df.loc[final_df["member_id"].astype(str) == search_id.strip()]
    if matched.empty:
        st.warning("No member found for that ID.")
        return

    member_row = matched.iloc[0]
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Predicted Risk", f"{member_row.get(RISK_COLUMN, np.nan) * 100:.1f}%" if pd.notna(member_row.get(RISK_COLUMN, np.nan)) else "-")
    m2.metric("Observed Event", str(int(member_row.get(TARGET_COLUMN, 0))) if pd.notna(member_row.get(TARGET_COLUMN, np.nan)) else "-")
    m3.metric("Age", format_number(member_row.get("age_at_index"), 1))
    m4.metric("Top Driver", str(member_row.get("top_driver_1_feature", "-")))

    left, right = st.columns([1.1, 1.2], gap="large")
    with left:
        st.markdown("##### Member Context")
        summary_columns = [
            "member_id",
            "index_date",
            "sex",
            "plan_type",
            "lob",
            "metro_region",
            "diabetes_flag",
            RISK_COLUMN,
            TARGET_COLUMN,
        ]
        available = [column for column in summary_columns if column in final_df.columns]
        summary_df = pd.DataFrame({"field": available, "value": [member_row[column] for column in available]})
        st.dataframe(summary_df, use_container_width=True, hide_index=True)

        st.markdown("##### Driver Narrative")
        for rank in range(1, 4):
            feature = member_row.get(f"top_driver_{rank}_feature")
            if pd.isna(feature):
                continue
            direction = member_row.get(f"top_driver_{rank}_direction", "neutral")
            value = member_row.get(f"top_driver_{rank}_value")
            contribution = member_row.get(f"top_driver_{rank}_contribution")
            badge = "raised" if direction == "increase_risk" else "lowered" if direction == "decrease_risk" else "did not change"
            st.markdown(
                f"- `{feature}` had value `{value}` and {badge} risk with contribution `{format_number(contribution)}`."
            )

    with right:
        st.markdown("##### Lookback Feature Snapshot")
        feature_columns = [column for column in final_df.columns if column.startswith(("lb_3m_", "lb_6m_"))]
        feature_subset = pd.DataFrame(
            {
                "feature": feature_columns,
                "value": [member_row[column] for column in feature_columns],
            }
        )
        feature_subset = feature_subset.loc[feature_subset["value"].astype(str) != "0.0"].head(20)
        st.dataframe(feature_subset, use_container_width=True, hide_index=True)

    if not long_drivers.empty:
        member_drivers = long_drivers.loc[long_drivers["member_id"].astype(str) == search_id.strip()].sort_values("rank")
        if not member_drivers.empty:
            st.markdown("##### Long-Form Top Drivers")
            st.dataframe(member_drivers, use_container_width=True, hide_index=True)

    if RISK_COLUMN in final_df:
        cohort = final_df[[RISK_COLUMN]].dropna().copy()
        cohort["member"] = "Cohort"
        cohort.loc[len(cohort)] = [member_row[RISK_COLUMN], "Selected Member"]
        st.markdown("##### Member vs Portfolio Risk")
        st.bar_chart(cohort.groupby("member").mean())


def render_model_artifacts(full_scores: pd.DataFrame, holdout_scores: pd.DataFrame, coefficients: pd.DataFrame, metrics: dict) -> None:
    st.subheader("Model Artifacts")
    tab1, tab2, tab3 = st.tabs(["Performance", "Scores", "Drivers"])

    with tab1:
        metric_frame = pd.DataFrame(
            {"metric": list(metrics.keys()), "value": list(metrics.values())}
        )
        left, right = st.columns([0.9, 1.1], gap="large")
        with left:
            st.dataframe(metric_frame, use_container_width=True, hide_index=True)
        with right:
            if not coefficients.empty:
                top_pos = coefficients.sort_values("coefficient", ascending=False).head(10)
                top_neg = coefficients.sort_values("coefficient", ascending=True).head(10)
                st.markdown("##### Most Positive Coefficients")
                st.bar_chart(top_pos.set_index("feature"))
                st.markdown("##### Most Negative Coefficients")
                st.bar_chart(top_neg.set_index("feature"))

    with tab2:
        for title, df in [("Full Dataset Scores", full_scores), ("Holdout Scores", holdout_scores)]:
            if df.empty or "predicted_probability" not in df:
                continue
            st.markdown(f"##### {title}")
            histogram = (
                pd.DataFrame({"score_band": pd.cut(df["predicted_probability"], bins=np.linspace(0, 1, 11), include_lowest=True)})
                .value_counts()
                .rename("members")
                .reset_index()
            )
            st.bar_chart(histogram.set_index("score_band"))
            st.dataframe(df.head(50), use_container_width=True, hide_index=True)

    with tab3:
        if "top_driver_1_feature" in full_scores:
            driver_counts = pd.concat(
                [
                    full_scores["top_driver_1_feature"],
                    full_scores["top_driver_2_feature"],
                    full_scores["top_driver_3_feature"],
                ],
                ignore_index=True,
            ).dropna()
            summary = driver_counts.value_counts().head(15).rename_axis("feature").reset_index(name="count")
            st.markdown("##### Most Frequent Member-Level Drivers")
            st.bar_chart(summary.set_index("feature"))
        else:
            st.info("Top driver columns were not found in the score artifacts.")


def render_data_quality() -> None:
    st.subheader("Reports and Data Dictionaries")
    reports = list_files(REPORTS_DIR, "*.json")
    dictionaries = list_files(DICTIONARIES_DIR, "*.csv")

    left, right = st.columns([0.95, 1.05], gap="large")
    with left:
        st.markdown("##### Dataset Reports")
        if not reports:
            st.info("No report files found.")
        else:
            report_name = st.selectbox("Report", [path.name for path in reports])
            st.json(read_json(REPORTS_DIR / report_name))

    with right:
        st.markdown("##### Data Dictionary")
        if not dictionaries:
            st.info("No data dictionaries found.")
        else:
            dict_name = st.selectbox("Dictionary", [path.name for path in dictionaries])
            st.dataframe(read_csv(DICTIONARIES_DIR / dict_name), use_container_width=True, hide_index=True)


def render_questions_panel(final_df: pd.DataFrame, full_scores: pd.DataFrame) -> None:
    st.subheader("Manager Quick Answers")
    q1, q2 = st.columns(2)
    with q1:
        st.markdown("##### Who should we review first?")
        if not final_df.empty and RISK_COLUMN in final_df:
            cols = [column for column in ["member_id", "index_date", RISK_COLUMN, "top_driver_1_feature", "top_driver_1_direction"] if column in final_df.columns]
            queue = final_df.sort_values(RISK_COLUMN, ascending=False)[cols].head(15)
            st.dataframe(queue, use_container_width=True, hide_index=True)
    with q2:
        st.markdown("##### Which features dominate the high-risk cohort?")
        if not full_scores.empty and "top_driver_1_feature" in full_scores:
            high = full_scores.loc[full_scores["predicted_probability"] >= 0.2]
            top = high["top_driver_1_feature"].value_counts().head(10).rename_axis("feature").reset_index(name="members")
            if not top.empty:
                st.bar_chart(top.set_index("feature"))
            else:
                st.info("No high-risk cohort under the current threshold.")


def simple_metric_card(title: str, value: str, note: str) -> None:
    st.markdown(
        f"""
        <div class="soft-card">
            <div class="section-label">{title}</div>
            <div class="metric-big">{value}</div>
            <div class="small-note">{note}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def simple_risk_band(probability: float) -> str:
    if pd.isna(probability):
        return "Unknown"
    if probability >= 0.40:
        return "Very High"
    if probability >= 0.20:
        return "High"
    if probability >= 0.10:
        return "Moderate"
    if probability >= 0.05:
        return "Low"
    return "Very Low"


def render_simple_header(final_df: pd.DataFrame) -> None:
    st.markdown(
        """
        <div class="hero-card">
            <div class="section-label" style="color:#c7d5d8;">Inpatient Hospitalization Prediction</div>
            <div style="font-size:2rem;font-weight:800;line-height:1.05;">Member Risk Review</div>
            <div style="max-width:820px;margin-top:0.7rem;color:#e8efef;font-size:1rem;">
                A simple, elegant workspace for reviewing raw source data, the final dataset, and high-risk members with their top drivers.
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if final_df.empty or RISK_COLUMN not in final_df:
        return

    high_risk = final_df.loc[final_df[RISK_COLUMN] >= 0.20]
    avg_risk = final_df[RISK_COLUMN].mean() * 100
    event_rate = final_df[TARGET_COLUMN].mean() * 100 if TARGET_COLUMN in final_df else None

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        simple_metric_card("Members", f"{len(final_df):,}", "Rows in final dataset")
    with c2:
        simple_metric_card("High Risk", f"{len(high_risk):,}", "Probability >= 20%")
    with c3:
        simple_metric_card("Average Risk", f"{avg_risk:.1f}%", "Mean predicted probability")
    with c4:
        simple_metric_card("Observed Event Rate", "-" if event_rate is None else f"{event_rate:.1f}%", "From final dataset")


def render_raw_data_simple() -> None:
    st.subheader("Raw Data")
    raw_tables = collect_tables()["Raw"]
    if not raw_tables:
        st.warning("No raw tables were found.")
        return

    selected = st.selectbox("Raw Table", list(raw_tables.keys()))
    raw_df = read_csv(raw_tables[selected])
    search = st.text_input("Search Raw Data", placeholder="Find a member, code, or keyword")
    max_rows = st.slider("Rows to Preview", 10, min(300, max(10, len(raw_df))), min(50, max(10, len(raw_df))), step=10)

    filtered = filtered_dataframe(raw_df, search)
    c1, c2, c3 = st.columns(3)
    c1.metric("Rows", f"{len(filtered):,}")
    c2.metric("Columns", f"{len(raw_df.columns):,}")
    c3.metric("Missing Cells", f"{int(filtered.isna().sum().sum()):,}")
    st.dataframe(filtered.head(max_rows), use_container_width=True, hide_index=True)


def render_final_dataset_simple(final_df: pd.DataFrame) -> None:
    st.subheader("Final Dataset")
    if final_df.empty:
        st.warning("`data/processed/final_member_dataset.csv` was not found.")
        return

    left, right = st.columns([1.2, 0.8])
    with left:
        search = st.text_input("Search Final Dataset", placeholder="Search across all columns")
    with right:
        columns = st.multiselect(
            "Columns",
            options=list(final_df.columns),
            default=[column for column in ["member_id", "index_date", RISK_COLUMN, TARGET_COLUMN, "top_driver_1_feature"] if column in final_df.columns],
        )

    filtered = filtered_dataframe(final_df, search)
    display_df = filtered[columns] if columns else filtered
    st.dataframe(display_df.head(200), use_container_width=True, hide_index=True)


def render_member_detail_simple(final_df: pd.DataFrame) -> None:
    st.subheader("Member Detail")
    if final_df.empty:
        st.warning("Final dataset is not available.")
        return

    member_id = st.selectbox("Member", final_df["member_id"].astype(str).tolist())
    member_row = final_df.loc[final_df["member_id"].astype(str) == member_id].iloc[0]

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Predicted Risk", f"{member_row.get(RISK_COLUMN, 0) * 100:.1f}%" if pd.notna(member_row.get(RISK_COLUMN)) else "-")
    c2.metric("Risk Band", simple_risk_band(member_row.get(RISK_COLUMN)))
    c3.metric("Observed Event", str(int(member_row[TARGET_COLUMN])) if TARGET_COLUMN in final_df and pd.notna(member_row.get(TARGET_COLUMN)) else "-")
    c4.metric("Primary Driver", str(member_row.get("top_driver_1_feature", "-")))

    left, right = st.columns([0.9, 1.1], gap="large")
    with left:
        fields = [
            "member_id",
            "index_date",
            "sex",
            "plan_type",
            "lob",
            "metro_region",
            "diabetes_flag",
            RISK_COLUMN,
            TARGET_COLUMN,
        ]
        fields = [field for field in fields if field in final_df.columns]
        st.markdown("##### Member Summary")
        st.dataframe(
            pd.DataFrame({"field": fields, "value": [member_row[field] for field in fields]}),
            use_container_width=True,
            hide_index=True,
        )

    with right:
        st.markdown("##### Top Drivers")
        driver_rows = []
        for rank in range(1, 4):
            feature = member_row.get(f"top_driver_{rank}_feature")
            if pd.isna(feature):
                continue
            driver_rows.append(
                {
                    "rank": rank,
                    "feature": feature,
                    "value": member_row.get(f"top_driver_{rank}_value"),
                    "contribution": member_row.get(f"top_driver_{rank}_contribution"),
                    "direction": member_row.get(f"top_driver_{rank}_direction"),
                }
            )
        st.dataframe(pd.DataFrame(driver_rows), use_container_width=True, hide_index=True)

    feature_columns = [column for column in final_df.columns if column.startswith(("lb_3m_", "lb_6m_"))]
    if feature_columns:
        feature_df = pd.DataFrame({"feature": feature_columns, "value": [member_row[column] for column in feature_columns]})
        feature_df = feature_df.loc[feature_df["value"].astype(str) != "0.0"].head(25)
        st.markdown("##### Feature Snapshot")
        st.dataframe(feature_df, use_container_width=True, hide_index=True)


def render_high_risk_review_simple(final_df: pd.DataFrame) -> None:
    st.subheader("High-Risk Review")
    if final_df.empty or RISK_COLUMN not in final_df:
        st.warning("Risk scores are not available in the final dataset.")
        return

    threshold = st.slider("High-Risk Threshold", min_value=0.05, max_value=0.60, value=0.20, step=0.01)
    high_risk_df = final_df.loc[final_df[RISK_COLUMN] >= threshold].copy().sort_values(RISK_COLUMN, ascending=False)

    c1, c2, c3 = st.columns(3)
    c1.metric("Members Above Threshold", f"{len(high_risk_df):,}")
    c2.metric("Threshold", f"{threshold:.0%}")
    c3.metric("Mean Risk", "-" if high_risk_df.empty else f"{high_risk_df[RISK_COLUMN].mean() * 100:.1f}%")

    if high_risk_df.empty:
        st.info("No members meet the selected threshold.")
        return

    queue_columns = [
        "member_id",
        "index_date",
        RISK_COLUMN,
        TARGET_COLUMN,
        "top_driver_1_feature",
        "top_driver_1_direction",
        "top_driver_2_feature",
        "top_driver_3_feature",
    ]
    queue_columns = [column for column in queue_columns if column in high_risk_df.columns]
    st.markdown("##### Review Queue")
    st.dataframe(high_risk_df[queue_columns].head(200), use_container_width=True, hide_index=True)

    selected_member = st.selectbox("High-Risk Member", high_risk_df["member_id"].astype(str).tolist(), key="simple_high_risk_member")
    member_row = high_risk_df.loc[high_risk_df["member_id"].astype(str) == selected_member].iloc[0]

    left, right = st.columns([0.95, 1.05], gap="large")
    with left:
        fields = [
            "member_id",
            "index_date",
            "sex",
            "plan_type",
            "lob",
            "metro_region",
            RISK_COLUMN,
            TARGET_COLUMN,
            "explanation_method",
        ]
        fields = [field for field in fields if field in high_risk_df.columns]
        st.markdown("##### Member Context")
        st.dataframe(
            pd.DataFrame({"field": fields, "value": [member_row[field] for field in fields]}),
            use_container_width=True,
            hide_index=True,
        )

    with right:
        driver_rows = []
        for rank in range(1, 4):
            feature = member_row.get(f"top_driver_{rank}_feature")
            if pd.isna(feature):
                continue
            driver_rows.append(
                {
                    "rank": rank,
                    "feature": feature,
                    "value": member_row.get(f"top_driver_{rank}_value"),
                    "contribution": member_row.get(f"top_driver_{rank}_contribution"),
                    "direction": member_row.get(f"top_driver_{rank}_direction"),
                }
            )
        st.markdown("##### Top Drivers")
        st.dataframe(pd.DataFrame(driver_rows), use_container_width=True, hide_index=True)


def main() -> None:
    final_df = get_frame("Processed/final_member_dataset.csv")
    raw_tables = collect_tables()["Raw"]
    render_simple_header(final_df)

    with st.sidebar:
        st.markdown("### Sections")
        section = st.radio(
            "Navigate",
            ["High-Risk Review", "Member Detail", "Final Dataset", "Raw Data"],
        )
        st.markdown("---")
        st.caption(f"Raw tables: {len(raw_tables)}")
        st.caption(f"Final dataset rows: {len(final_df):,}" if not final_df.empty else "Final dataset not found")
        if st.button("Refresh Cached Data"):
            st.cache_data.clear()
            st.rerun()

    if section == "High-Risk Review":
        render_high_risk_review_simple(final_df)
    elif section == "Member Detail":
        render_member_detail_simple(final_df)
    elif section == "Final Dataset":
        render_final_dataset_simple(final_df)
    elif section == "Raw Data":
        render_raw_data_simple()


if __name__ == "__main__":
    main()
