from pathlib import Path
import pandas as pd


def load_data(csv_path: str | Path) -> pd.DataFrame:
    csv_path = Path(csv_path)

    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset not found at: {csv_path}")

    df = pd.read_csv(csv_path)

    if df.empty:
        raise ValueError("Loaded dataset is empty.")

    return df


def validate_dataset(df: pd.DataFrame, target_col: str = "Class") -> None:
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in dataset.")

    if df[target_col].nunique() != 2:
        raise ValueError(f"Target column '{target_col}' must be binary.")

    if df.isnull().sum().sum() > 0:
        raise ValueError("Dataset contains missing values. Handle them before training.")


def split_features_target(df: pd.DataFrame, target_col: str = "Class"):
    X = df.drop(columns=[target_col]).copy()
    y = df[target_col].copy()
    return X, y