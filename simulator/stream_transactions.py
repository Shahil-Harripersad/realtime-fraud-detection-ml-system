import argparse
import json
import random
import time
from pathlib import Path

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


def build_mixed_stream(df: pd.DataFrame, limit: int, sparsity: float) -> pd.DataFrame:
    if sparsity <= 0:
        raise ValueError("sparsity must be > 0")

    normal_df = df[df["Class"] == 0].sample(frac=1).reset_index(drop=True)
    fraud_df = df[df["Class"] == 1].sample(frac=1).reset_index(drop=True)

    normal_idx = 0
    fraud_idx = 0
    rows = []

    # Base fraud interval range; sparsity stretches or compresses it
    base_min_gap = 4
    base_max_gap = 12

    min_gap = max(1, int(base_min_gap * sparsity))
    max_gap = max(min_gap, int(base_max_gap * sparsity))

    next_fraud_in = random.randint(min_gap, max_gap)

    while len(rows) < limit:
        if next_fraud_in <= 0 and fraud_idx < len(fraud_df):
            rows.append(fraud_df.iloc[fraud_idx])
            fraud_idx += 1
            next_fraud_in = random.randint(min_gap, max_gap)
        elif normal_idx < len(normal_df):
            rows.append(normal_df.iloc[normal_idx])
            normal_idx += 1
            next_fraud_in -= 1
        elif fraud_idx < len(fraud_df):
            rows.append(fraud_df.iloc[fraud_idx])
            fraud_idx += 1
        else:
            break

    return pd.DataFrame(rows).reset_index(drop=True)


def get_stream_dataframe(
    df: pd.DataFrame,
    mode: str,
    limit: int,
    sparsity: float,
) -> pd.DataFrame:
    if mode == "chronological":
        return df.head(limit).reset_index(drop=True)

    if mode == "fraud_only":
        return df[df["Class"] == 1].sample(frac=1).head(limit).reset_index(drop=True)

    if mode == "mixed":
        return build_mixed_stream(df, limit=limit, sparsity=sparsity)

    raise ValueError(f"Unsupported mode: {mode}")


def main():
    parser = argparse.ArgumentParser(description="Simulate streaming credit card transactions.")
    parser.add_argument("--speed", type=float, default=0.2, help="Global delay multiplier between transactions.")
    parser.add_argument("--limit", type=int, default=200, help="Number of rows to stream.")
    parser.add_argument(
        "--mode",
        type=str,
        default="mixed",
        choices=["chronological", "fraud_only", "mixed"],
        help="Streaming mode.",
    )
    parser.add_argument(
        "--sparsity",
        type=float,
        default=1,
        help="Fraud sparsity multiplier for mixed mode. Higher = fewer fraud injections.",
    )
    parser.add_argument("--api-url", type=str, default=API_URL, help="Prediction API endpoint.")
    args = parser.parse_args()

    print("Checking API health...")
    ping_health()

    print("Loading transactions...")
    df = load_transactions(DATA_PATH)

    stream_df = get_stream_dataframe(
        df=df,
        mode=args.mode,
        limit=args.limit,
        sparsity=args.sparsity,
    )

    if stream_df.empty:
        raise ValueError("No transactions available after filters were applied.")

    ensure_output_dir(OUTPUT_PATH)
    clear_output_file(OUTPUT_PATH)

    print(f"Streaming {len(stream_df)} transactions...")
    print(f"Mode: {args.mode}")
    print(f"Speed multiplier: {args.speed}")
    if args.mode == "mixed":
        print(f"Sparsity multiplier: {args.sparsity}")
    print(f"Output file: {OUTPUT_PATH}")

    for idx, row in stream_df.iterrows():
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

        base_delay = random.uniform(0.05, 1.5)
        sleep_time = base_delay * args.speed
        time.sleep(sleep_time)

    print("Streaming complete.")


if __name__ == "__main__":
    main()