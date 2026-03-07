import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.model_selection import train_test_split

from app.config import DATA_PATH, RANDOM_STATE, TARGET_COL, TEST_SIZE
from app.paths import FIGURES_DIR, METRICS_DIR, MODELS_DIR
from src.data_loader import load_data, split_features_target, validate_dataset
from src.evaluate import (
    calculate_metrics,
    plot_confusion_matrix_figure,
    plot_pr_curve,
    plot_roc_curve,
)
from src.model_factory import (
    build_logistic_regression_pipeline,
    build_random_forest_pipeline,
    build_xgboost_pipeline,
)
from src.thresholding import apply_threshold, find_best_f1_threshold


def save_json(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)


def main():
    print("Loading dataset...")
    df = load_data(DATA_PATH)
    validate_dataset(df, target_col=TARGET_COL)

    X, y = split_features_target(df, target_col=TARGET_COL)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=TEST_SIZE,
        stratify=y,
        random_state=RANDOM_STATE,
    )

    fraud_count = int((y_train == 1).sum())
    normal_count = int((y_train == 0).sum())
    scale_pos_weight = normal_count / fraud_count

    models = {
        "logistic_regression": build_logistic_regression_pipeline(random_state=RANDOM_STATE),
        "random_forest": build_random_forest_pipeline(random_state=RANDOM_STATE),
        "xgboost": build_xgboost_pipeline(
            random_state=RANDOM_STATE,
            scale_pos_weight=scale_pos_weight,
        ),
    }

    results = []

    for model_name, pipeline in models.items():
        print(f"\nTraining: {model_name}")
        pipeline.fit(X_train, y_train)

        y_prob = pipeline.predict_proba(X_test)[:, 1]

        best_threshold, best_f1 = find_best_f1_threshold(y_test, y_prob)
        y_pred = apply_threshold(y_prob, best_threshold)

        metrics = calculate_metrics(y_test, y_pred, y_prob)
        metrics["best_threshold"] = best_threshold
        metrics["best_f1_from_threshold_search"] = best_f1
        metrics["model_name"] = model_name

        print(f"Threshold: {best_threshold:.6f}")
        for key, value in metrics.items():
            if isinstance(value, float):
                print(f"{key}: {value:.6f}")
            else:
                print(f"{key}: {value}")

        results.append((model_name, pipeline, metrics, y_pred, y_prob))

        plot_confusion_matrix_figure(
            y_test,
            y_pred,
            FIGURES_DIR / f"{model_name}_confusion_matrix.png",
        )
        plot_pr_curve(
            y_test,
            y_prob,
            FIGURES_DIR / f"{model_name}_pr_curve.png",
        )
        plot_roc_curve(
            y_test,
            y_prob,
            FIGURES_DIR / f"{model_name}_roc_curve.png",
        )

        save_json(metrics, METRICS_DIR / f"{model_name}_metrics.json")

    results_df = pd.DataFrame([item[2] for item in results])
    results_df = results_df.sort_values(by="pr_auc", ascending=False)
    print("\n=== Model Comparison ===")
    print(results_df[["model_name", "precision", "recall", "f1_score", "roc_auc", "pr_auc", "best_threshold"]])

    best_model_name = results_df.iloc[0]["model_name"]
    best_result = next(item for item in results if item[0] == best_model_name)

    best_pipeline = best_result[1]
    best_metrics = best_result[2]

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(best_pipeline, MODELS_DIR / "best_fraud_model.joblib")
    save_json(best_metrics, MODELS_DIR / "best_model_metadata.json")
    joblib.dump(list(X.columns), MODELS_DIR / "feature_columns.joblib")

    print(f"\nBest model saved: {best_model_name}")


if __name__ == "__main__":
    main()