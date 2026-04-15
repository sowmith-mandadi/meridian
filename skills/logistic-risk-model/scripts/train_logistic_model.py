import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd


TARGET_COLUMN = "inpatient_hospital_visit_next_6m"
EXCLUDE_HINTS = ("member_id", "index_date", "label_window", "eligibility_", "first_inpatient", "days_until", "_count_next_6m")
TOP_DRIVER_COUNT = 3

try:
    import shap
except ImportError:  # pragma: no cover - exercised via fallback in test env.
    shap = None


def stratified_split(y: pd.Series, test_size: float, random_state: int) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(random_state)
    positive_idx = np.flatnonzero(y.to_numpy() == 1)
    negative_idx = np.flatnonzero(y.to_numpy() == 0)
    rng.shuffle(positive_idx)
    rng.shuffle(negative_idx)
    pos_test = max(1, int(round(len(positive_idx) * test_size)))
    neg_test = max(1, int(round(len(negative_idx) * test_size)))
    test_idx = np.concatenate([positive_idx[:pos_test], negative_idx[:neg_test]])
    train_mask = np.ones(len(y), dtype=bool)
    train_mask[test_idx] = False
    train_idx = np.flatnonzero(train_mask)
    return train_idx, test_idx


def sigmoid(values: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(values, -30, 30)))


def fit_logistic_regression(x: np.ndarray, y: np.ndarray, learning_rate: float = 0.05, iterations: int = 4000, l2: float = 0.01) -> np.ndarray:
    weights = np.zeros(x.shape[1], dtype=float)
    for _ in range(iterations):
        predictions = sigmoid(x @ weights)
        gradient = (x.T @ (predictions - y)) / len(y)
        gradient[1:] += l2 * weights[1:]
        weights -= learning_rate * gradient
    return weights


def roc_auc_score_manual(y_true: np.ndarray, y_score: np.ndarray) -> float:
    positive_scores = y_score[y_true == 1]
    negative_scores = y_score[y_true == 0]
    wins = 0.0
    for pos in positive_scores:
        wins += np.sum(pos > negative_scores)
        wins += 0.5 * np.sum(pos == negative_scores)
    return float(wins / (len(positive_scores) * len(negative_scores)))


def average_precision_manual(y_true: np.ndarray, y_score: np.ndarray) -> float:
    order = np.argsort(-y_score)
    y_sorted = y_true[order]
    cumulative_tp = np.cumsum(y_sorted == 1)
    precision = cumulative_tp / (np.arange(len(y_sorted)) + 1)
    recall = cumulative_tp / max(1, np.sum(y_sorted == 1))
    recall_delta = np.diff(np.concatenate(([0.0], recall)))
    return float(np.sum(precision * recall_delta))


def compute_linear_contributions(feature_frame: pd.DataFrame, coefficients: np.ndarray) -> pd.DataFrame:
    coefficient_values = np.asarray(coefficients, dtype=float)
    contribution_values = feature_frame.to_numpy(dtype=float) * coefficient_values
    return pd.DataFrame(contribution_values, columns=feature_frame.columns, index=feature_frame.index)


def resolve_explanation_method(
    X_train: pd.DataFrame,
    X_scored: pd.DataFrame,
    coefficients: np.ndarray,
    intercept: float,
) -> tuple[pd.DataFrame, str]:
    linear_contributions = compute_linear_contributions(X_scored, coefficients)
    if shap is None:
        return linear_contributions, "linear_contribution_fallback"

    try:
        explainer = shap.LinearExplainer((coefficients, intercept), X_train, feature_perturbation="interventional")
        shap_values = explainer(X_scored)
        values = getattr(shap_values, "values", shap_values)
        if values.shape == linear_contributions.shape:
            return pd.DataFrame(values, columns=X_scored.columns, index=X_scored.index), "shap_linear"
    except Exception:
        pass

    return linear_contributions, "linear_contribution_fallback"


def build_member_driver_outputs(
    entity_frame: pd.DataFrame,
    feature_values: pd.DataFrame,
    contributions: pd.DataFrame,
    explanation_method: str,
    top_k: int = TOP_DRIVER_COUNT,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    summary = entity_frame.reset_index(drop=True).copy()
    feature_values = feature_values.reset_index(drop=True)
    contributions = contributions.reset_index(drop=True)
    long_rows: list[dict] = []

    for row_idx in range(len(summary)):
        member_contrib = contributions.iloc[row_idx]
        ranked_features = member_contrib.abs().sort_values(ascending=False)
        top_features = ranked_features.head(top_k).index.tolist()

        for rank, feature_name in enumerate(top_features, start=1):
            contribution = float(member_contrib[feature_name])
            feature_value = feature_values.iloc[row_idx][feature_name]
            direction = "increase_risk" if contribution > 0 else "decrease_risk" if contribution < 0 else "neutral"

            summary.loc[row_idx, f"top_driver_{rank}_feature"] = feature_name
            summary.loc[row_idx, f"top_driver_{rank}_value"] = feature_value
            summary.loc[row_idx, f"top_driver_{rank}_contribution"] = contribution
            summary.loc[row_idx, f"top_driver_{rank}_direction"] = direction

            long_rows.append(
                {
                    **summary.loc[row_idx, entity_frame.columns].to_dict(),
                    "rank": rank,
                    "feature": feature_name,
                    "feature_value": feature_value,
                    "contribution": contribution,
                    "direction": direction,
                    "abs_contribution": abs(contribution),
                    "explanation_method": explanation_method,
                }
            )

    summary["explanation_method"] = explanation_method
    long_output = pd.DataFrame(long_rows)
    return summary, long_output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--features-path", required=True)
    parser.add_argument("--target-path", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    features = pd.read_csv(args.features_path)
    target = pd.read_csv(args.target_path)
    df = features.merge(target[["member_id", TARGET_COLUMN]], on="member_id", how="inner")
    entity_frame = df[["member_id"]].copy()
    if "index_date" in df.columns:
        entity_frame["index_date"] = df["index_date"]

    feature_columns = [
        column for column in df.columns
        if column != TARGET_COLUMN and not any(hint in column.lower() for hint in EXCLUDE_HINTS)
    ]
    X = df[feature_columns].copy()
    y = df[TARGET_COLUMN]

    for column in X.select_dtypes(include=["object", "string"]).columns:
        X[column] = X[column].fillna("unknown").astype(str).str.strip().str.lower()
    for column in X.select_dtypes(exclude="object").columns:
        X[column] = X[column].fillna(X[column].median())

    X = pd.get_dummies(X, drop_first=False).astype(float)
    train_idx, test_idx = stratified_split(y, test_size=0.25, random_state=42)
    X_train, X_test = X.iloc[train_idx].copy(), X.iloc[test_idx].copy()
    y_train, y_test = y.iloc[train_idx].copy(), y.iloc[test_idx].copy()
    entity_test = entity_frame.iloc[test_idx].reset_index(drop=True)

    numeric_columns = list(X_train.select_dtypes(include=["number"]).columns)
    train_means = X_train[numeric_columns].mean()
    train_stds = X_train[numeric_columns].std().replace(0, 1)
    X_train = X_train.astype(float)
    X_test = X_test.astype(float)
    X_train.loc[:, numeric_columns] = ((X_train[numeric_columns] - train_means) / train_stds).astype(float)
    X_test.loc[:, numeric_columns] = ((X_test[numeric_columns] - train_means) / train_stds).astype(float)

    X_train_matrix = np.column_stack([np.ones(len(X_train)), X_train.to_numpy(dtype=float)])
    X_test_matrix = np.column_stack([np.ones(len(X_test)), X_test.to_numpy(dtype=float)])
    weights = fit_logistic_regression(X_train_matrix, y_train.to_numpy(dtype=float))
    intercept = float(weights[0])
    coefficients_array = weights[1:]
    probabilities = sigmoid(X_test_matrix @ weights)
    predictions = (probabilities >= 0.5).astype(int)
    y_test_array = y_test.to_numpy(dtype=int)

    metrics = {
        "roc_auc": roc_auc_score_manual(y_test_array, probabilities),
        "average_precision": average_precision_manual(y_test_array, probabilities),
        "accuracy": float(np.mean(predictions == y_test_array)),
        "brier_score": float(np.mean((probabilities - y_test_array) ** 2)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "test_positive_rate": float(y_test.mean()),
    }

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / "metrics.json").open("w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2)

    coefficients = pd.DataFrame({"feature": X_train.columns, "coefficient": coefficients_array}).sort_values("coefficient", ascending=False)
    coefficients.to_csv(output_dir / "coefficients.csv", index=False)

    holdout_contributions, explanation_method = resolve_explanation_method(
        X_train=X_train,
        X_scored=X_test,
        coefficients=coefficients_array,
        intercept=intercept,
    )
    holdout_driver_summary, holdout_driver_long = build_member_driver_outputs(
        entity_frame=entity_test,
        feature_values=X.iloc[test_idx].reset_index(drop=True),
        contributions=holdout_contributions,
        explanation_method=explanation_method,
    )

    scored = X_test.copy()
    scored = pd.concat([entity_test, scored.reset_index(drop=True)], axis=1)
    scored["actual"] = y_test.to_numpy()
    scored["predicted_probability"] = probabilities
    scored["predicted_class"] = predictions
    scored = scored.merge(holdout_driver_summary, on=list(entity_test.columns), how="left")
    scored.to_csv(output_dir / "holdout_scores.csv", index=False)
    holdout_driver_long.to_csv(output_dir / "holdout_member_top_drivers.csv", index=False)

    X_all = X.astype(float).copy()
    X_all.loc[:, numeric_columns] = ((X_all[numeric_columns] - train_means) / train_stds).astype(float)
    X_all_matrix = np.column_stack([np.ones(len(X_all)), X_all.to_numpy(dtype=float)])
    all_probabilities = sigmoid(X_all_matrix @ weights)
    all_contributions, explanation_method = resolve_explanation_method(
        X_train=X_train,
        X_scored=X_all,
        coefficients=coefficients_array,
        intercept=intercept,
    )
    full_driver_summary, full_driver_long = build_member_driver_outputs(
        entity_frame=entity_frame.reset_index(drop=True),
        feature_values=X.reset_index(drop=True),
        contributions=all_contributions,
        explanation_method=explanation_method,
    )
    full_scores = entity_frame.reset_index(drop=True).copy()
    full_scores["predicted_probability"] = all_probabilities
    full_scores["actual"] = y.reset_index(drop=True)
    full_scores = full_scores.merge(full_driver_summary, on=list(entity_frame.columns), how="left")
    full_scores.to_csv(output_dir / "full_dataset_scores.csv", index=False)
    full_driver_long.to_csv(output_dir / "member_top_drivers.csv", index=False)

    print(f"Wrote model outputs to {output_dir}")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
