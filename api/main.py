from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from app.paths import MODELS_DIR
from app.schemas import (
    BatchPredictionRequest,
    BatchPredictionResponse,
    MetadataResponse,
    PredictionResponse,
)
from src.predict import FraudPredictor


predictor: FraudPredictor | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global predictor

    predictor = FraudPredictor(
        model_path=MODELS_DIR / "best_fraud_model.joblib",
        metadata_path=MODELS_DIR / "best_model_metadata.json",
        feature_columns_path=MODELS_DIR / "feature_columns.joblib",
    )

    yield

    predictor = None


app = FastAPI(
    title="Real-Time Fraud Detection API",
    description="Inference API for credit card fraud detection",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": predictor is not None,
    }


@app.get("/metadata", response_model=MetadataResponse)
def metadata():
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    return MetadataResponse(
        model_name=predictor.model_name,
        threshold=predictor.threshold,
        feature_count=len(predictor.feature_columns),
        feature_columns=predictor.feature_columns,
    )


@app.post("/predict", response_model=PredictionResponse)
def predict(record: dict[str, float]):
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    try:
        result = predictor.predict_one(record)
        return PredictionResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}") from e


@app.post("/predict-batch", response_model=BatchPredictionResponse)
def predict_batch(request: BatchPredictionRequest):
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    try:
        results = predictor.predict_batch(request.records)
        return BatchPredictionResponse(
            predictions=[PredictionResponse(**item) for item in results]
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Batch prediction failed: {str(e)}",
        ) from e