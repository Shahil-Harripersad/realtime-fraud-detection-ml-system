const socketStatus = document.getElementById("socketStatus");
const totalEventsEl = document.getElementById("totalEvents");
const predictedFraudEl = document.getElementById("predictedFraud");
const predictedNormalEl = document.getElementById("predictedNormal");
const maxProbabilityEl = document.getElementById("maxProbability");
const alertsListEl = document.getElementById("alertsList");
const latestEventEl = document.getElementById("latestEvent");

let totalEvents = 0;
let predictedFraud = 0;
let predictedNormal = 0;
let maxProbability = 0;

const state = {
  events: [],
  totalTransactions: 0,
  fraudCount: 0,
  totalAmount: 0,
  fraudAmount: 0
};

const ctx = document.getElementById("probChart");

let probChart = null;

function initChart() {
  const ctx = document.getElementById("probChart");

  if (!ctx) {
    console.warn("Chart canvas not found");
    return;
  }

  probChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Fraud Probability",
          data: [],
          borderColor: "#f6c453",
          tension: 0.25,
          pointRadius: 2
        }
      ]
    },
    options: {
      animation: false,
      scales: {
        y: {
          min: 0,
          max: 1
        }
      }
    }
  });
}

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

function updateMetrics(event) {

  state.totalTransactions += 1;
  state.totalAmount += event.amount;

  if (event.prediction === 1) {
    state.fraudCount += 1;
    state.fraudAmount += event.amount;
  }

  document.getElementById("totalTx").textContent = state.totalTransactions;
  document.getElementById("fraudTx").textContent = state.fraudCount;

  document.getElementById("totalAmount").textContent =
    "$" + state.totalAmount.toFixed(2);

  document.getElementById("fraudAmount").textContent =
    "$" + state.fraudAmount.toFixed(2);

  const fraudRate =
    state.totalTransactions === 0
      ? 0
      : (state.fraudCount / state.totalTransactions) * 100;

  document.getElementById("fraudRate").textContent =
    fraudRate.toFixed(2) + "%";
}

function updateChart(event) {

  if (!probChart) return;

  probChart.data.labels.push(state.totalTransactions);

  probChart.data.datasets[0].data.push(event.fraud_probability);

  if (probChart.data.labels.length > 60) {
    probChart.data.labels.shift();
    probChart.data.datasets[0].data.shift();
  }

  probChart.update();
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

function renderAlert(event) {

  const card = document.createElement("div");

  card.className = `alert-card ${event.prediction_label}`;

  card.innerHTML = `
    <div class="alert-top">
      <span class="alert-label ${event.prediction_label}">
        ${event.prediction_label.toUpperCase()}
      </span>
      <span class="alert-prob">
        p=${event.fraud_probability.toFixed(4)}
      </span>
    </div>

    <div class="alert-meta">
      <div>Amount: $${event.amount.toFixed(2)}</div>
    </div>
  `;

  if (alertsListEl.querySelector(".empty-state")) {
    alertsListEl.innerHTML = "";
  }

  alertsListEl.prepend(card);

  if (alertsListEl.children.length > 40) {
    alertsListEl.removeChild(alertsListEl.lastChild);
  }
}

function connectWebSocket() {
  console.log("Opening WebSocket connection...");

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${protocol}://${window.location.host}/ws`;

  console.log("WS URL:", wsUrl);

  const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
    console.log("WebSocket connected");
    setSocketStatus(true);
    };

    socket.onmessage = (event) => {
    console.log("WebSocket message:", event.data);
    const payload = JSON.parse(event.data);

    if (payload.type === "prediction_event") {

      const event = payload.data;

      state.events.push(event);

      updateMetrics(event);
      updateChart(event);
      renderAlert(event);
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

setSocketStatus(false);

document.addEventListener("DOMContentLoaded", () => {
  initChart();
  connectWebSocket();
});