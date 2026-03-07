const socketStatus = document.getElementById("socketStatus");
const totalEventsEl = document.getElementById("totalEvents");
const predictedFraudEl = document.getElementById("predictedFraud");
const predictedNormalEl = document.getElementById("predictedNormal");
const maxProbabilityEl = document.getElementById("maxProbability");
const alertsListEl = document.getElementById("alertsList");
const latestEventEl = document.getElementById("latestEvent");
const clearAlertsBtn = document.getElementById("clearAlertsBtn");

let totalEvents = 0;
let predictedFraud = 0;
let predictedNormal = 0;
let maxProbability = 0;

function setSocketStatus(connected) {
  socketStatus.textContent = connected ? "Connected" : "Disconnected";
  socketStatus.classList.toggle("online", connected);
  socketStatus.classList.toggle("offline", !connected);
}

function formatProbability(value) {
  return Number(value).toFixed(6);
}

function formatAmount(value) {
  return Number(value).toFixed(2);
}

function updateMetrics(eventData) {
  totalEvents += 1;

  if (eventData.prediction === 1) {
    predictedFraud += 1;
  } else {
    predictedNormal += 1;
  }

  if (eventData.fraud_probability > maxProbability) {
    maxProbability = eventData.fraud_probability;
  }

  totalEventsEl.textContent = String(totalEvents);
  predictedFraudEl.textContent = String(predictedFraud);
  predictedNormalEl.textContent = String(predictedNormal);
  maxProbabilityEl.textContent = formatProbability(maxProbability);
}

function renderLatestEvent(eventData) {
  latestEventEl.innerHTML = `
    <div class="latest-event-card">
      <div class="latest-grid">
        <div class="latest-item">
          <span class="latest-item-label">Prediction</span>
          <span class="latest-item-value">${eventData.prediction_label.toUpperCase()}</span>
        </div>
        <div class="latest-item">
          <span class="latest-item-label">Fraud Probability</span>
          <span class="latest-item-value">${formatProbability(eventData.fraud_probability)}</span>
        </div>
        <div class="latest-item">
          <span class="latest-item-label">Amount</span>
          <span class="latest-item-value">${formatAmount(eventData.amount)}</span>
        </div>
        <div class="latest-item">
          <span class="latest-item-label">Event Time</span>
          <span class="latest-item-value">${Number(eventData.event_time).toFixed(1)}</span>
        </div>
        <div class="latest-item">
          <span class="latest-item-label">Model</span>
          <span class="latest-item-value">${eventData.model_name}</span>
        </div>
        <div class="latest-item">
          <span class="latest-item-label">Threshold</span>
          <span class="latest-item-value">${formatProbability(eventData.threshold)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderAlertCard(eventData) {
  const card = document.createElement("div");
  card.className = `alert-card ${eventData.prediction_label}`;

  card.innerHTML = `
    <div class="alert-top">
      <span class="alert-label ${eventData.prediction_label}">
        ${eventData.prediction_label.toUpperCase()}
      </span>
      <span class="alert-prob">
        p=${formatProbability(eventData.fraud_probability)}
      </span>
    </div>
    <div class="alert-meta">
      <div>Amount: ${formatAmount(eventData.amount)}</div>
      <div>Time: ${Number(eventData.event_time).toFixed(1)}</div>
      <div>Threshold: ${formatProbability(eventData.threshold)}</div>
    </div>
  `;

  if (alertsListEl.querySelector(".empty-state")) {
    alertsListEl.innerHTML = "";
  }

  alertsListEl.prepend(card);

  const maxCards = 50;
  while (alertsListEl.children.length > maxCards) {
    alertsListEl.removeChild(alertsListEl.lastChild);
  }
}

function handlePredictionEvent(eventData) {
  updateMetrics(eventData);
  renderLatestEvent(eventData);
  renderAlertCard(eventData);
}

function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${protocol}://${window.location.host}/ws`;

  const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
    console.log("WebSocket connected");
    setSocketStatus(true);
    };

    socket.onmessage = (event) => {
    console.log("WebSocket message:", event.data);
    const payload = JSON.parse(event.data);

    if (payload.type === "prediction_event") {
        handlePredictionEvent(payload.data);
    }
    };

    socket.onclose = (event) => {
    console.log("WebSocket closed", event);
    setSocketStatus(false);
    setTimeout(connectWebSocket, 2000);
    };

    socket.onerror = (error) => {
    console.error("WebSocket error", error);
    setSocketStatus(false);
    };
}

clearAlertsBtn.addEventListener("click", () => {
  alertsListEl.innerHTML = `<div class="empty-state">No live events yet.</div>`;
});

setSocketStatus(false);
connectWebSocket();