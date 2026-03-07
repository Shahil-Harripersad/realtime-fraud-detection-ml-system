let socketStatusEl;
let alertsListEl;

const state = {
  events: [],
  totalTransactions: 0,
  fraudCount: 0,
  totalAmount: 0,
  fraudAmount: 0
};

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
          pointRadius: 2,
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
          labels: {
            color: "#e8ecf8"
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#96a0c8"
          },
          grid: {
            color: "rgba(150, 160, 200, 0.08)"
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

function updateChart(event) {
  if (!probChart) return;

  probChart.data.labels.push(state.totalTransactions);
  probChart.data.datasets[0].data.push(Number(event.fraud_probability));

  if (probChart.data.labels.length > 60) {
    probChart.data.labels.shift();
    probChart.data.datasets[0].data.shift();
  }

  probChart.update();
}

function renderAlert(event) {
  if (!alertsListEl) return;

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

  const emptyState = alertsListEl.querySelector(".empty-state");
  if (emptyState) {
    alertsListEl.innerHTML = "";
  }

  alertsListEl.prepend(card);

  while (alertsListEl.children.length > 40) {
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
      const incomingEvent = payload.data;
      state.events.push(incomingEvent);

      updateMetrics(incomingEvent);
      updateChart(incomingEvent);
      renderAlert(incomingEvent);
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

  initChart();
  setSocketStatus(false);
  connectWebSocket();
});