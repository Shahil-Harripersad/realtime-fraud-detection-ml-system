let socketStatusEl;
let alertsListEl;
let fraudListEl;

const CHART_WINDOW_SIZE = 60;

const state = {
  events: [],
  totalTransactions: 0,
  fraudCount: 0,
  totalAmount: 0,
  fraudAmount: 0,
  pendingChartValue: null,
  chartTick: 0
};

let probChart = null;
let chartInterval = null;

function initChart() {
  const ctx = document.getElementById("probChart");

  if (!ctx) {
    console.warn("Chart canvas not found");
    return;
  }

  probChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array(CHART_WINDOW_SIZE).fill(""),
      datasets: [
        {
          label: "Fraud Probability",
          data: Array(CHART_WINDOW_SIZE).fill(0),
          borderColor: "#f6c453",
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 250,
        easing: "linear"
      },
      plugins: {
        legend: {
          labels: {
            color: "#e8ecf8"
          }
        }
      },
      scales: {
        x: {
          ticks: {
            display: false
          },
          grid: {
            display: false
          }
        },
        y: {
          min: 0,
          max: 1,
          ticks: {
            color: "#96a0c8"
          },
          grid: {
            color: "rgba(150, 160, 200, 0.08)"
          }
        }
      }
    }
  });
}

function startChartLoop() {
  if (!probChart) return;

  if (chartInterval) {
    clearInterval(chartInterval);
  }

  chartInterval = setInterval(() => {
    state.chartTick += 1;

    let nextValue = 0;

    if (state.pendingChartValue !== null) {
      nextValue = state.pendingChartValue;
      state.pendingChartValue = null;
    }

    probChart.data.labels.shift();
    probChart.data.labels.push("");

    probChart.data.datasets[0].data.shift();
    probChart.data.datasets[0].data.push(nextValue);

    probChart.update();
  }, 250);
}

function setSocketStatus(connected) {
  if (!socketStatusEl) return;

  socketStatusEl.textContent = connected ? "Connected" : "Disconnected";
  socketStatusEl.classList.toggle("online", connected);
  socketStatusEl.classList.toggle("offline", !connected);
}

function updateMetrics(event) {
  state.totalTransactions += 1;
  state.totalAmount += Number(event.amount);

  if (event.prediction === 1) {
    state.fraudCount += 1;
    state.fraudAmount += Number(event.amount);
  }

  const totalTxEl = document.getElementById("totalTx");
  const fraudTxEl = document.getElementById("fraudTx");
  const totalAmountEl = document.getElementById("totalAmount");
  const fraudAmountEl = document.getElementById("fraudAmount");
  const fraudRateEl = document.getElementById("fraudRate");

  if (totalTxEl) totalTxEl.textContent = String(state.totalTransactions);
  if (fraudTxEl) fraudTxEl.textContent = String(state.fraudCount);
  if (totalAmountEl) totalAmountEl.textContent = "$" + state.totalAmount.toFixed(2);
  if (fraudAmountEl) fraudAmountEl.textContent = "$" + state.fraudAmount.toFixed(2);

  const fraudRate =
    state.totalTransactions === 0
      ? 0
      : (state.fraudCount / state.totalTransactions) * 100;

  if (fraudRateEl) fraudRateEl.textContent = fraudRate.toFixed(2) + "%";
}

function queueChartEvent(event) {
  const prob = Number(event.fraud_probability);

  if (state.pendingChartValue === null) {
    state.pendingChartValue = prob;
    return;
  }

  state.pendingChartValue = Math.max(state.pendingChartValue, prob);
}

function createAlertCard(event) {
  const card = document.createElement("div");
  card.className = `alert-card ${event.prediction_label}`;

  card.innerHTML = `
    <div class="alert-top">
      <span class="alert-label ${event.prediction_label}">
        ${event.prediction_label.toUpperCase()}
      </span>
      <span class="alert-prob">
        p=${Number(event.fraud_probability).toFixed(4)}
      </span>
    </div>
    <div class="alert-meta">
      <div>Amount: $${Number(event.amount).toFixed(2)}</div>
    </div>
  `;

  return card;
}

function prependCard(container, card, maxItems, emptyMessage) {
  if (!container) return;

  const emptyState = container.querySelector(".empty-state");
  if (emptyState) {
    container.innerHTML = "";
  }

  container.prepend(card);

  while (container.children.length > maxItems) {
    container.removeChild(container.lastChild);
  }

  if (container.children.length === 0) {
    container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
  }
}

function renderAllEvent(event) {
  const card = createAlertCard(event);
  prependCard(alertsListEl, card, 60, "Waiting for transactions...");
}

function renderFraudEvent(event) {
  if (event.prediction !== 1) return;

  const card = createAlertCard(event);
  prependCard(fraudListEl, card, 20, "No fraud events yet.");
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
    const payload = JSON.parse(event.data);

    if (payload.type === "prediction_event") {
      const incomingEvent = payload.data;

      state.events.push(incomingEvent);

      updateMetrics(incomingEvent);
      queueChartEvent(incomingEvent);
      renderFraudEvent(incomingEvent);
      renderAllEvent(incomingEvent);
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

document.addEventListener("DOMContentLoaded", () => {
  socketStatusEl = document.getElementById("socketStatus");
  alertsListEl = document.getElementById("alertsList");
  fraudListEl = document.getElementById("fraudList");

  initChart();
  startChartLoop();
  setSocketStatus(false);
  connectWebSocket();
});