import argparse
import json
import time
from pathlib import Path
import random

import pandas as pd
import requests

from app.config import DATA_PATH


OUTPUT_PATH = Path("outputs/predictions/stream_predictions.jsonl")
API_URL = "http://127.0.0.1:8000/predict"


def load_transactions(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)

    if "Class" not in df.columns:
        raise ValueError("Dataset must contain 'Class' column.")

    if "Time" not in df.columns:
        raise ValueError("Dataset must contain 'Time' column.")

    df = df.sort_values("Time").reset_index(drop=True)
    return df


def ensure_output_dir(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)


def ping_health(base_url: str = "http://127.0.0.1:8000/health") -> None:
    response = requests.get(base_url, timeout=5)
    response.raise_for_status()


def send_transaction(record: dict, api_url: str) -> dict:
    response = requests.post(api_url, json=record, timeout=10)
    response.raise_for_status()
    return response.json()


def append_prediction(output_path: Path, payload: dict) -> None:
    with open(output_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload) + "\n")


def clear_output_file(output_path: Path) -> None:
    if output_path.exists():
        output_path.unlink()


def main():
    parser = argparse.ArgumentParser(description="Simulate streaming credit card transactions.")
    parser.add_argument("--speed", type=float, default=0.2, help="Delay in seconds between transactions.")
    parser.add_argument("--limit", type=int, default=100, help="Number of rows to stream.")
    parser.add_argument("--fraud-only", action="store_true", help="Stream only fraud transactions.")
    parser.add_argument("--api-url", type=str, default=API_URL, help="Prediction API endpoint.")
    args = parser.parse_args()

    print("Checking API health...")
    ping_health()

    print("Loading transactions...")
    df = load_transactions(DATA_PATH)

    if args.fraud_only:
        df = df[df["Class"] == 1].reset_index(drop=True)

    df = df.head(args.limit)

    if df.empty:
        raise ValueError("No transactions available after filters were applied.")

    ensure_output_dir(OUTPUT_PATH)
    clear_output_file(OUTPUT_PATH)

    print(f"Streaming {len(df)} transactions...")
    print(f"Speed: {args.speed} sec/tx")
    print(f"Output file: {OUTPUT_PATH}")

    for idx, row in df.iterrows():
        record = row.drop(labels=["Class"]).to_dict()
        actual_class = int(row["Class"])

        try:
            prediction_result = send_transaction(record, args.api_url)

            payload = {
                "stream_index": int(idx),
                "event_time": float(row["Time"]),
                "actual_class": actual_class,
                "amount": float(row["Amount"]),
                "prediction": prediction_result["prediction"],
                "prediction_label": prediction_result["prediction_label"],
                "fraud_probability": float(prediction_result["fraud_probability"]),
                "threshold": float(prediction_result["threshold"]),
                "model_name": prediction_result["model_name"],
            }

            append_prediction(OUTPUT_PATH, payload)

            print(
                f"[{idx}] time={payload['event_time']:.1f} "
                f"amount={payload['amount']:.2f} "
                f"actual={payload['actual_class']} "
                f"pred={payload['prediction']} "
                f"prob={payload['fraud_probability']:.6f}"
            )

        except requests.RequestException as e:
            print(f"[{idx}] API request failed: {e}")
        except Exception as e:
            print(f"[{idx}] Unexpected error: {e}")

        base_delay = random.uniform(0.05, 1.5)  # random base interval
        sleep_time = base_delay * args.speed

        time.sleep(sleep_time)

    print("Streaming complete.")


if __name__ == "__main__":
    main()