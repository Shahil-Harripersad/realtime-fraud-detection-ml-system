from typing import Dict, List, Literal

from pydantic import BaseModel


class PredictionResponse(BaseModel):
    model_name: str
    threshold: float
    fraud_probability: float
    prediction: int
    prediction_label: Literal["fraud", "normal"]


class BatchPredictionRequest(BaseModel):
    records: List[Dict[str, float]]


class BatchPredictionResponse(BaseModel):
    predictions: List[PredictionResponse]


class MetadataResponse(BaseModel):
    model_name: str
    threshold: float
    feature_count: int
    feature_columns: List[str]