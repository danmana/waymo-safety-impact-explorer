const LOCATION_ORDER = [
  "SAN_FRANCISCO",
  "PHOENIX",
  "LOS_ANGELES",
  "AUSTIN",
];

const METRICS = [
  "airbag",
  "blincoe",
  "blincoe_any_injury",
  "ka",
  "observed_any_injury",
  "police_reported",
  "human_miles",
  "waymo_miles",
  "human_to_waymo_ratio",
];

const DEFAULT_LOCATION = "SAN_FRANCISCO";
const DEFAULT_METRIC = "police_reported";
const DATA_URL = "./cells.json";

const metricLabels = {
  airbag: "Airbag deployments",
  blincoe: "Blincoe (economic cost)",
  blincoe_any_injury: "Blincoe (any injury)",
  ka: "KA (severe injury/fatal)",
  observed_any_injury: "Observed any injury",
  police_reported: "Police reported",
  human_miles: "Human miles",
  waymo_miles: "Waymo miles",
  human_to_waymo_ratio: "Human to Waymo ratio",
};

const DEFAULT_FILL_OPACITY = 0.65;

const COLOR_STOPS = [
  { stop: 0, color: [254, 247, 231] }, // warm light sand
  { stop: 0.5, color: [251, 146, 60] }, // vivid orange
  { stop: 1, color: [127, 29, 29] }, // deep brick red
];

const map = L.map("map", {
  zoomControl: true,
  minZoom: 5,
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

const polygonLayer = L.layerGroup().addTo(map);

const header = document.querySelector("header");
const headerToggle = document.getElementById("header-toggle");
const headerSummary = document.getElementById("header-summary");
const locationSelect = document.getElementById("location-select");
const metricSelect = document.getElementById("metric-select");
const legendContainer = document.getElementById("legend");
const legendMin = document.getElementById("legend-min");
const legendMid = document.getElementById("legend-mid");
const legendMax = document.getElementById("legend-max");

const HEADER_COLLAPSED_CLASS = "collapsed";

let dataset = null;
let metricMaxLookup = {};
let currentLocation = DEFAULT_LOCATION;
let currentMetric = DEFAULT_METRIC;

function populateControls() {
  LOCATION_ORDER.forEach((location) => {
    if (!dataset[location]) return;
    const option = document.createElement("option");
    option.value = location;
    option.textContent = location.replace("_", " ");
    if (location === DEFAULT_LOCATION) {
      option.selected = true;
    }
    locationSelect.appendChild(option);
  });

  METRICS.forEach((metric) => {
    const option = document.createElement("option");
    option.value = metric;
    option.textContent = metricLabels[metric] ?? metric;
    if (metric === DEFAULT_METRIC) {
      option.selected = true;
    }
    metricSelect.appendChild(option);
  });
}

function formatLocationLabel(value) {
  if (!value) return "—";
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function computeMetricMax() {
  metricMaxLookup = {};
  Object.entries(dataset).forEach(([location, payload]) => {
    const maxPerMetric = {};
    payload.cells.forEach((cell) => {
      METRICS.forEach((metric) => {
        let value;
        if (metric === "human_miles") {
          value = cell.hpms_vehicle_miles_traveled;
        } else if (metric === "waymo_miles") {
          value = cell.waymo_ro_miles;
        } else if (metric === "human_to_waymo_ratio") {
          const humanMiles = cell.hpms_vehicle_miles_traveled;
          const waymoMiles = cell.waymo_ro_miles;
          value = waymoMiles > 0 ? humanMiles / waymoMiles : 0;
        } else {
          value = cell.metrics?.[metric];
        }
        if (value == null) return;
        const current = maxPerMetric[metric] ?? 0;
        if (value > current) {
          maxPerMetric[metric] = value;
        }
      });
    });
    metricMaxLookup[location] = maxPerMetric;
  });
}

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value % 1 === 0 ? value.toString() : value.toFixed(2);
}

function buildPopupHtml(cell) {
  const rows = METRICS.map((metric) => {
    let value;
    if (metric === "human_miles") {
      value = cell.hpms_vehicle_miles_traveled;
    } else if (metric === "waymo_miles") {
      value = cell.waymo_ro_miles;
    } else if (metric === "human_to_waymo_ratio") {
      const humanMiles = cell.hpms_vehicle_miles_traveled ?? 0;
      const waymoMiles = cell.waymo_ro_miles ?? 0;
      value = waymoMiles > 0 ? humanMiles / waymoMiles : 0;
    } else {
      value = cell.metrics?.[metric];
    }
    return `<tr><th>${metricLabels[metric] ?? metric}</th><td>${formatNumber(
      value
    )}</td></tr>`;
  }).join("");

  return `
    <div class="cell-popup">
      <h3>S2 Cell ${cell.token}</h3>
      <table>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function interpolateColorComponent(start, end, ratio) {
  return Math.round(start + (end - start) * ratio);
}

function getFillColor(intensity) {
  if (!Number.isFinite(intensity) || intensity <= 0) {
    return "rgb(253, 253, 253)";
  }

  const clamped = Math.min(1, Math.max(0, intensity));

  for (let idx = 1; idx < COLOR_STOPS.length; idx += 1) {
    const current = COLOR_STOPS[idx];
    const previous = COLOR_STOPS[idx - 1];
    if (clamped <= current.stop) {
      const localRatio =
        (clamped - previous.stop) / (current.stop - previous.stop || 1);
      const [r1, g1, b1] = previous.color;
      const [r2, g2, b2] = current.color;
      const r = interpolateColorComponent(r1, r2, localRatio);
      const g = interpolateColorComponent(g1, g2, localRatio);
      const b = interpolateColorComponent(b1, b2, localRatio);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  const [r, g, b] = COLOR_STOPS[COLOR_STOPS.length - 1].color;
  return `rgb(${r}, ${g}, ${b})`;
}

function stylePolygon(intensity) {
  return {
    color: "#ea580c",
    weight: 0.7,
    fillColor: getFillColor(intensity),
    fillOpacity: intensity > 0 ? DEFAULT_FILL_OPACITY : 0,
    opacity: 0.8,
  };
}

function highlightPolygon(layer) {
  layer.setStyle({
    weight: 2,
    color: "#9a3412",
    fillOpacity: Math.min(1, (layer.options.fillOpacity ?? DEFAULT_FILL_OPACITY) + 0.2),
  });
}

function resetPolygon(layer) {
  layer.setStyle(stylePolygon(layer.intensity ?? 0));
}

function updateHeaderSummary() {
  if (!headerSummary) return;
  const locationLabel = formatLocationLabel(currentLocation);
  const metricLabel = metricLabels[currentMetric] ?? currentMetric;
  headerSummary.textContent = `Waymo: ${locationLabel} - ${metricLabel}`;
}

function setHeaderCollapsed(collapsed) {
  if (!header) return;
  header.classList.toggle(HEADER_COLLAPSED_CLASS, collapsed);
  if (headerToggle) {
    headerToggle.setAttribute("aria-expanded", (!collapsed).toString());
  }
  if (legendContainer) {
    legendContainer.setAttribute("aria-hidden", collapsed ? "true" : "false");
  }
}

function updateMapView(locationPayload) {
  const bounds = [];
  locationPayload.cells.forEach((cell) => {
    cell.vertices.forEach((vertex) => {
      bounds.push(vertex);
    });
  });
  if (!bounds.length) return;
  const leafletBounds = L.latLngBounds(bounds.map(([lat, lng]) => [lat, lng]));
  map.fitBounds(leafletBounds, { padding: [24, 24] });
}

function refreshLayers({ fitView = false } = {}) {
  const locationPayload = dataset[currentLocation];
  if (!locationPayload) return;

  polygonLayer.clearLayers();

  const maxValue = metricMaxLookup[currentLocation]?.[currentMetric] || 0;

  locationPayload.cells.forEach((cell) => {
    let intensityRaw;
    if (currentMetric === "human_miles") {
      intensityRaw = cell.hpms_vehicle_miles_traveled ?? 0;
    } else if (currentMetric === "waymo_miles") {
      intensityRaw = cell.waymo_ro_miles ?? 0;
    } else if (currentMetric === "human_to_waymo_ratio") {
      const humanMiles = cell.hpms_vehicle_miles_traveled ?? 0;
      const waymoMiles = cell.waymo_ro_miles ?? 0;
      intensityRaw = waymoMiles > 0 ? humanMiles / waymoMiles : 0;
    } else {
      intensityRaw = cell.metrics?.[currentMetric] ?? 0;
    }
    const intensity = maxValue > 0 ? intensityRaw / maxValue : 0;

    const polygon = L.polygon(
      cell.vertices.map(([lat, lng]) => [lat, lng]),
      stylePolygon(intensity)
    );

    polygon.intensity = intensity;
    polygon.bindPopup(buildPopupHtml(cell), { maxWidth: 320 });
    polygon.on("mouseover", () => highlightPolygon(polygon));
    polygon.on("mouseout", () => resetPolygon(polygon));
    polygon.on("click", () => polygon.openPopup());
    polygon.on("popupopen", () => highlightPolygon(polygon));
    polygon.on("popupclose", () => resetPolygon(polygon));

    polygonLayer.addLayer(polygon);
  });

  if (fitView) {
    updateMapView(locationPayload);
  }

  updateHeaderSummary();
  updateLegend(maxValue);
}

function updateLegend(maxValue) {
  if (!legendMin || !legendMid || !legendMax) return;
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    legendMin.textContent = "0";
    legendMid.textContent = "—";
    legendMax.textContent = "—";
    return;
  }

  legendMin.textContent = formatNumber(0);
  legendMid.textContent = formatNumber(maxValue / 2);
  legendMax.textContent = formatNumber(maxValue);
}

async function bootstrap() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load ${DATA_URL}: ${response.statusText}`);
  }
  dataset = await response.json();

  populateControls();
  computeMetricMax();
  refreshLayers({ fitView: true });
}

locationSelect.addEventListener("change", (event) => {
  currentLocation = event.target.value;
  refreshLayers({ fitView: true });
});

metricSelect.addEventListener("change", (event) => {
  currentMetric = event.target.value;
  refreshLayers();
});

if (headerToggle) {
  headerToggle.addEventListener("click", () => {
    const isCollapsed = header?.classList.contains(HEADER_COLLAPSED_CLASS);
    setHeaderCollapsed(!isCollapsed);
  });
}

const collapseOnMobile = window.matchMedia("(max-width: 768px)").matches;
setHeaderCollapsed(collapseOnMobile);
updateHeaderSummary();
updateLegend(0);

bootstrap().catch((error) => {
  console.error(error);
  const mapContainer = document.getElementById("map");
  mapContainer.innerHTML = `<div class="error">${error.message}</div>`;
});
