# Real-Time Credit Card Fraud Detection System

End-to-end machine learning system that detects credit card fraud in
**real time** using a trained model, simulated transaction streaming, a
FastAPI inference service, WebSocket event broadcasting, and a live
monitoring dashboard.

------------------------------------------------------------------------

## Table of Contents

-   [Overview](#overview)
-   [Key Features](#key-features)
-   [Dashboard](#dashboard)
-   [Machine Learning Pipeline](#machine-learning-pipeline)
-   [Inference API](#inference-api)
-   [Streaming Simulator](#streaming-simulator)
-   [Running the Project](#running-the-project)
-   [Example Output](#example-output)
-   [Tech Stack](#tech-stack)
-   [License](#license)

------------------------------------------------------------------------

## Overview

This project implements a full **real-time machine learning system** for credit card fraud detection.

It includes model training, a FastAPI inference service, simulated transaction streaming, and a live monitoring dashboard.

The system demonstrates how financial institutions can detect suspicious transactions as they occur.

------------------------------------------------------------------------

## Key Features

-   End-to-end ML pipeline (data → model → inference → monitoring)
-   Handles a **highly imbalanced fraud dataset**
-   Real-time transaction simulation
-   FastAPI inference service
-   WebSocket-based event broadcasting
-   Interactive monitoring dashboard
-   Rolling fraud analytics and probability tracking

------------------------------------------------------------------------

## 📊 Dashboard

The system includes a **real-time monitoring dashboard** that visualizes incoming transactions and model predictions.

It displays live metrics, transaction streams, and rolling fraud analytics while the simulator feeds transactions through the inference API.


https://github.com/user-attachments/assets/42e6ef90-56c7-4375-a60a-f7b0aeaceda0


------------------------------------------------------------------------

## Machine Learning Pipeline

The training pipeline performs:

1. Data loading and preprocessing  
2. Model training and evaluation  
3. Fraud-focused metric analysis  
4. Threshold tuning  
5. Model persistence for inference

### Models Evaluated

-   Logistic Regression
-   Random Forest
-   XGBoost

The best-performing model is saved and used by the inference API.

------------------------------------------------------------------------

## Inference API

A **FastAPI service** loads the trained model and provides prediction
endpoints.

### Endpoints

| Endpoint | Description |
|---------|-------------|
| `GET /health` | Service health check |
| `GET /metadata` | Model metadata |
| `POST /predict` | Single transaction prediction |
| `POST /predict-batch` | Batch predictions |
| `WS /ws` | Real-time prediction events |

Whenever a transaction is scored, the API broadcasts the result via
**WebSocket** so the dashboard updates instantly.

------------------------------------------------------------------------

## Streaming Simulator

Since the dataset is static, a simulator generates **real-time transaction streams**.

Transactions are sent sequentially to the API, scored by the model, and broadcast to the dashboard.

Example:

```bash
python simulator/stream_transactions.py --mode mixed --speed 0.3 --limit 1000
```

------------------------------------------------------------------------

## Running the Project

### 1 Install dependencies

    pip install -r requirements.txt

------------------------------------------------------------------------

### 2 Train the model

    python training/train_model.py

This saves the trained model and metadata.

------------------------------------------------------------------------

### 3 Start the inference API

    uvicorn api.main:app --reload

------------------------------------------------------------------------

### 4 Open the dashboard

Navigate to:

    http://127.0.0.1:8000

------------------------------------------------------------------------

### 5 Run the transaction simulator

    python simulator/stream_transactions.py --mode mixed --speed 0.3

The dashboard will begin updating in real time.

------------------------------------------------------------------------

## Tech Stack

### Machine Learning

-   Python
-   scikit-learn
-   XGBoost
-   pandas
-   numpy

### Backend

-   FastAPI
-   WebSockets
-   Uvicorn

### Frontend

-   HTML
-   CSS
-   JavaScript
-   Chart.js

------------------------------------------------------------------------

## License

MIT License
