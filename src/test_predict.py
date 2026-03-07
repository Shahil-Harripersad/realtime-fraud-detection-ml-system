import pandas as pd

from app.paths import MODELS_DIR
from src.data_loader import load_data
from app.config import DATA_PATH
from src.predict import FraudPredictor


def main():
    predictor = FraudPredictor(
        model_path=MODELS_DIR / "best_fraud_model.joblib",
        metadata_path=MODELS_DIR / "best_model_metadata.json",
        feature_columns_path=MODELS_DIR / "feature_columns.joblib",
    )

    df = load_data(DATA_PATH)

    sample_row = df.drop(columns=["Class"]).iloc[0].to_dict()

    result = predictor.predict_one(sample_row)

    print("Single prediction result:")
    print(result)

    sample_batch = df.drop(columns=["Class"]).iloc[:5].to_dict(orient="records")
    batch_results = predictor.predict_batch(sample_batch)

    print("\nBatch prediction results:")
    for i, item in enumerate(batch_results):
        print(f"Row {i}: {item}")


if __name__ == "__main__":
    main()