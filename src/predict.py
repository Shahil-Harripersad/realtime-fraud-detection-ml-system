import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd


class FraudPredictor:
    def __init__(
        self,
        model_path: str | Path,
        metadata_path: str | Path,
        feature_columns_path: str | Path,
    ):
        self.model_path = Path(model_path)
        self.metadata_path = Path(metadata_path)
        self.feature_columns_path = Path(feature_columns_path)

        self.model = None
        self.metadata = None
        self.feature_columns = None
        self.threshold = None
        self.model_name = None

        self._load_artifacts()

    def _load_artifacts(self) -> None:
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model file not found: {self.model_path}")

        if not self.metadata_path.exists():
            raise FileNotFoundError(f"Metadata file not found: {self.metadata_path}")

        if not self.feature_columns_path.exists():
            raise FileNotFoundError(
                f"Feature columns file not found: {self.feature_columns_path}"
            )

        self.model = joblib.load(self.model_path)

        with open(self.metadata_path, "r", encoding="utf-8") as f:
            self.metadata = json.load(f)

        self.feature_columns = joblib.load(self.feature_columns_path)
        self.threshold = float(self.metadata["best_threshold"])
        self.model_name = self.metadata["model_name"]

    def _validate_input_dict(self, record: dict[str, Any]) -> None:
        missing_cols = [col for col in self.feature_columns if col not in record]
        extra_cols = [col for col in record if col not in self.feature_columns]

        if missing_cols:
            raise ValueError(f"Missing required features: {missing_cols}")

        if extra_cols:
            raise ValueError(f"Unexpected extra features: {extra_cols}")

    def _prepare_single_record(self, record: dict[str, Any]) -> pd.DataFrame:
        self._validate_input_dict(record)

        row_df = pd.DataFrame([record], columns=self.feature_columns)
        row_df = row_df[self.feature_columns]

        return row_df

    def _prepare_batch_records(self, records: list[dict[str, Any]]) -> pd.DataFrame:
        if not records:
            raise ValueError("Input batch is empty.")

        for idx, record in enumerate(records):
            try:
                self._validate_input_dict(record)
            except ValueError as e:
                raise ValueError(f"Error in batch record at index {idx}: {e}") from e

        batch_df = pd.DataFrame(records)
        batch_df = batch_df[self.feature_columns]

        return batch_df

    def predict_one(self, record: dict[str, Any]) -> dict[str, Any]:
        row_df = self._prepare_single_record(record)

        fraud_probability = float(self.model.predict_proba(row_df)[0, 1])
        prediction = int(fraud_probability >= self.threshold)

        return {
            "model_name": self.model_name,
            "threshold": self.threshold,
            "fraud_probability": fraud_probability,
            "prediction": prediction,
            "prediction_label": "fraud" if prediction == 1 else "normal",
        }

    def predict_batch(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        batch_df = self._prepare_batch_records(records)

        fraud_probabilities = self.model.predict_proba(batch_df)[:, 1]
        predictions = (fraud_probabilities >= self.threshold).astype(int)

        results = []
        for prob, pred in zip(fraud_probabilities, predictions):
            results.append(
                {
                    "model_name": self.model_name,
                    "threshold": self.threshold,
                    "fraud_probability": float(prob),
                    "prediction": int(pred),
                    "prediction_label": "fraud" if int(pred) == 1 else "normal",
                }
            )

        return results