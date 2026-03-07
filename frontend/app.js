let socketStatusEl;
let alertsListEl;
let fraudListEl;

const state = {
  events: [],
  totalTransactions: 0,
  fraudCount: 0,
  totalAmount: 0,
  fraudAmount: 0,

  pendingChartValue: null,
  pendingTickTransactionCount: 0,
  pendingTickFraudCount: 0,
  pendingTickTotalAmount: 0,
  pendingTickFraudAmount: 0,

  rollingTransactionCounts: [],
  rollingFraudCounts: [],
  rollingTotalAmounts: [],
  rollingFraudAmounts: [],

  chartTick: 0
};

let probChart = null;
let fraudRateChart = null;
let totalAmountChart = null;
let fraudAmountChart = null;
let chartInterval = null;

const CHART_WINDOW_SIZE = 160;
const ROLLING_WINDOW_TICKS = 40;

function createLineChart(ctx, label, borderColor, initialValue = 0, yMin = null, yMax = null) {
  if (!ctx) return null;

  const yScale = {
    ticks: {
      color: "#96a0c8"
    },
    grid: {
      color: "rgba(150, 160, 200, 0.08)"
    }
  };

  if (yMin !== null) yScale.min = yMin;
  if (yMax !== null) yScale.max = yMax;

  return new Chart(ctx, {
    type: "line",
    data: {
      labels: Array(CHART_WINDOW_SIZE).fill(""),
      datasets: [
        {
          label,
          data: Array(CHART_WINDOW_SIZE).fill(initialValue),
          borderColor,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: false
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
        y: yScale
      }
    }
  });
}

function initCharts() {
  probChart = createLineChart(
    document.getElementById("probChart"),
    "Fraud Probability",
    "#f6c453",
    0,
    0,
    1
  );

  fraudRateChart = createLineChart(
    document.getElementById("fraudRateChart"),
    "Rolling Fraud Rate",
    "#ff5d73",
    0,
    0,
    1
  );

  totalAmountChart = createLineChart(
    document.getElementById("totalAmountChart"),
    "Rolling Total Amount",
    "#6ea8fe",
    0
  );

  fraudAmountChart = createLineChart(
    document.getElementById("fraudAmountChart"),
    "Rolling Fraud Amount",
    "#ff8a5b",
    0
  );
}

function pushChartValue(chart, value) {
  if (!chart) return;

  chart.data.labels.shift();
  chart.data.labels.push("");

  chart.data.datasets[0].data.shift();
  chart.data.datasets[0].data.push(value);

  chart.update();
}

function pushRollingValue(array, value, maxSize) {
  array.push(value);
  if (array.length > maxSize) {
    array.shift();
  }
}

function sumArray(array) {
  return array.reduce((acc, value) => acc + value, 0);
}

function startChartLoop() {
  if (!probChart) return;

  if (chartInterval) {
    clearInterval(chartInterval);
  }

  chartInterval = setInterval(() => {
    state.chartTick += 1;

    let nextProbValue = 0;
    if (state.pendingChartValue !== null) {
      nextProbValue = state.pendingChartValue;
      state.pendingChartValue = null;
    }

    // Push this tick's values into rolling buffers
    pushRollingValue(state.rollingTransactionCounts, state.pendingTickTransactionCount, ROLLING_WINDOW_TICKS);
    pushRollingValue(state.rollingFraudCounts, state.pendingTickFraudCount, ROLLING_WINDOW_TICKS);
    pushRollingValue(state.rollingTotalAmounts, state.pendingTickTotalAmount, ROLLING_WINDOW_TICKS);
    pushRollingValue(state.rollingFraudAmounts, state.pendingTickFraudAmount, ROLLING_WINDOW_TICKS);

    const rollingTransactions = sumArray(state.rollingTransactionCounts);
    const rollingFrauds = sumArray(state.rollingFraudCounts);
    const rollingTotalAmount = sumArray(state.rollingTotalAmounts);
    const rollingFraudAmount = sumArray(state.rollingFraudAmounts);

    const rollingFraudRate =
      rollingTransactions === 0 ? 0 : rollingFrauds / rollingTransactions;

    pushChartValue(probChart, nextProbValue);
    pushChartValue(fraudRateChart, rollingFraudRate);
    pushChartValue(totalAmountChart, rollingTotalAmount);
    pushChartValue(fraudAmountChart, rollingFraudAmount);

    // Reset pending per-tick values after consuming them
    state.pendingTickTransactionCount = 0;
    state.pendingTickFraudCount = 0;
    state.pendingTickTotalAmount = 0;
    state.pendingTickFraudAmount = 0;
  }, 100);
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
  const amount = Number(event.amount);
  const isFraud = event.prediction === 1 ? 1 : 0;

  if (state.pendingChartValue === null) {
    state.pendingChartValue = prob;
  } else {
    state.pendingChartValue = Math.max(state.pendingChartValue, prob);
  }

  state.pendingTickTransactionCount += 1;
  state.pendingTickFraudCount += isFraud;
  state.pendingTickTotalAmount += amount;

  if (isFraud === 1) {
    state.pendingTickFraudAmount += amount;
  }
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

  initCharts();
  startChartLoop();
  setSocketStatus(false);
  connectWebSocket();
});