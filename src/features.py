import pandas as pd
from sklearn.preprocessing import StandardScaler


def get_feature_columns(df: pd.DataFrame, target_col: str = "Class") -> list[str]:
    return [col for col in df.columns if col != target_col]


def fit_scaler(X_train: pd.DataFrame) -> StandardScaler:
    scaler = StandardScaler()
    scaler.fit(X_train)
    return scaler


def transform_features(scaler: StandardScaler, X: pd.DataFrame) -> pd.DataFrame:
    X_scaled = scaler.transform(X)
    return pd.DataFrame(X_scaled, columns=X.columns, index=X.index)