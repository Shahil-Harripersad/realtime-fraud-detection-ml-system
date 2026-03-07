from app.paths import MODELS_DIR, FIGURES_DIR, METRICS_DIR

DATA_PATH = "../datasets/creditcard.csv"
TARGET_COL = "Class"

RANDOM_STATE = 42
TEST_SIZE = 0.2

DEFAULT_THRESHOLD = 0.5

LOGISTIC_REGRESSION_PARAMS = {
    "class_weight": "balanced",
    "max_iter": 1000,
    "random_state": RANDOM_STATE,
    "solver": "liblinear"
}

MODEL_FILENAME = MODELS_DIR / "logistic_regression_fraud.joblib"
SCALER_FILENAME = MODELS_DIR / "standard_scaler.joblib"
FEATURES_FILENAME = MODELS_DIR / "feature_columns.joblib"
METRICS_FILENAME = METRICS_DIR / "logistic_regression_metrics.json"
CONFUSION_MATRIX_FILENAME = FIGURES_DIR / "logistic_regression_confusion_matrix.png"
PR_CURVE_FILENAME = FIGURES_DIR / "logistic_regression_pr_curve.png"
ROC_CURVE_FILENAME = FIGURES_DIR / "logistic_regression_roc_curve.png"