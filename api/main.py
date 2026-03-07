from contextlib import asynccontextmanager
from pathlib import Path
import asyncio

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.paths import MODELS_DIR
from app.schemas import (
    BatchPredictionRequest,
    BatchPredictionResponse,
    MetadataResponse,
    PredictionResponse,
)
from src.predict import FraudPredictor
from api.websocket_manager import ConnectionManager


predictor: FraudPredictor | None = None
ws_manager = ConnectionManager()

FRONTEND_DIR = Path("frontend")


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def serve_frontend():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/style.css")
def serve_css():
    return FileResponse(FRONTEND_DIR / "style.css")


@app.get("/app.js")
def serve_js():
    return FileResponse(FRONTEND_DIR / "app.js")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": predictor is not None,
        "connected_clients": len(ws_manager.active_connections),
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
async def predict(record: dict[str, float]):
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    try:
        result = predictor.predict_one(record)

        event_payload = {
            "type": "prediction_event",
            "data": {
                **result,
                "amount": float(record.get("Amount", 0.0)),
                "event_time": float(record.get("Time", 0.0)),
            },
        }

        await ws_manager.broadcast_json(event_payload)

        return PredictionResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}") from e


@app.post("/predict-batch", response_model=BatchPredictionResponse)
async def predict_batch(request: BatchPredictionRequest):
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    try:
        results = predictor.predict_batch(request.records)

        for record, result in zip(request.records, results):
            event_payload = {
                "type": "prediction_event",
                "data": {
                    **result,
                    "amount": float(record.get("Amount", 0.0)),
                    "event_time": float(record.get("Time", 0.0)),
                },
            }
            await ws_manager.broadcast_json(event_payload)

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


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    print("WebSocket connection attempt")

    await ws_manager.connect(websocket)

    try:
        await websocket.send_json(
            {
                "type": "system",
                "data": {
                    "message": "WebSocket connected",
                    "connected_clients": len(ws_manager.active_connections),
                },
            }
        )

        while True:
            # Keep connection alive without expecting client messages
            await asyncio.sleep(30)

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)