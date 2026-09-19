// ltaClient.js
//
// This is the ONLY place that talks to LTA DataMall. Every function:
//   1. Returns cached data if still fresh (see cache.js — TTLs match the
//      refresh rate documented for each endpoint in LTA_DataMall_API_User_Guide.pdf).
//   2. Otherwise calls the real endpoint with your AccountKey.
//   3. Falls back to a labelled demo fixture ONLY if LTA_ACCOUNT_KEY is unset
//      or the live call throws — and the result always carries
//      `source: "live"` or `source: "demo"` so the UI can show the truth.
//
// SETUP (do this first):
//   1. Register a free AccountKey at https://datamall.lta.gov.sg
//   2. Copy backend/.env.example to backend/.env
//   3. Paste your key into LTA_ACCOUNT_KEY=... in that .env file
//   4. Never commit .env — it's already in .gitignore
//
// Base URL and pagination: LTA pages 500 rows at a time via $skip. Only the
// list-style reference endpoints (BusServices/BusRoutes/BusStops) actually
// need paging in production; this prototype fetches the first page (500
// rows) which is enough to demo against. A production build should loop
// $skip=0,500,1000... until an empty page comes back.

const cache = require("./cache");
const { CANONICAL_LINES, toTrainServiceAlertsCode, toCrowdDensityCode } = require("./canonicalLines");
const demo = require("./demoFallbacks");

const BASE_URL = "https://datamall2.mytransport.sg/ltaodataservice";
const ACCOUNT_KEY = process.env.LTA_ACCOUNT_KEY || "";

function hasKey() {
  return Boolean(ACCOUNT_KEY);
}

async function callLta(path, params = {}) {
  if (!hasKey()) throw new Error("LTA_ACCOUNT_KEY not set");
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/${path}${qs ? "?" + qs : ""}`;
  const res = await fetch(url, {
    headers: { AccountKey: ACCOUNT_KEY, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`LTA ${path} responded ${res.status}`);
  const json = await res.json();
  return { source: "live", ...json };
}

// ---- Train Service Alerts (the single most important endpoint per the brief) ----
async function getTrainServiceAlerts() {
  return cache.cached("trainServiceAlerts", 60 * 1000, async () => {
    try {
      return await callLta("TrainServiceAlerts");
    } catch {
      return demo.demoTrainServiceAlerts;
    }
  });
}

// ---- Station Crowd Density: real-time (10 min refresh) ----
async function getCrowdRealTime(canonicalLine) {
  const code = toCrowdDensityCode(canonicalLine);
  return cache.cached(`pcdRealtime:${code}`, 10 * 60 * 1000, async () => {
    try {
      return await callLta("PCDRealTime", { TrainLine: code });
    } catch {
      return demo.demoPCDRealTime;
    }
  });
}

// ---- Station Crowd Density: forecast, 30-min buckets, published once a day ----
async function getCrowdForecast(canonicalLine) {
  const code = toCrowdDensityCode(canonicalLine);
  return cache.cached(`pcdForecast:${code}`, 24 * 60 * 60 * 1000, async () => {
    try {
      return await callLta("PCDForecast", { TrainLine: code });
    } catch {
      return demo.demoPCDForecast;
    }
  });
}

// ---- Bus arrival (real-time; carries Load + Feature=WAB (wheelchair-accessible) + Type) ----
async function getBusArrival(busStopCode) {
  return cache.cached(`busArrival:${busStopCode}`, 20 * 1000, async () => {
    try {
      return await callLta("v3/BusArrival", { BusStopCode: busStopCode });
    } catch {
      return demo.demoBusArrival;
    }
  });
}

// ---- Bus network reference data (ad hoc refresh) ----
async function getBusServices() {
  return cache.cached("busServices", 6 * 60 * 60 * 1000, async () => {
    try {
      return await callLta("BusServices");
    } catch {
      return demo.demoBusServices;
    }
  });
}
async function getBusRoutes() {
  return cache.cached("busRoutes", 6 * 60 * 60 * 1000, async () => {
    try {
      return await callLta("BusRoutes");
    } catch {
      return demo.demoBusRoutes;
    }
  });
}
async function getBusStops() {
  return cache.cached("busStops", 6 * 60 * 60 * 1000, async () => {
    try {
      return await callLta("BusStops");
    } catch {
      return demo.demoBusStops;
    }
  });
}

// ---- Lift/escalator maintenance (v2/FacilitiesMaintenance) — essential for Mdm Lim ----
// Each row has a StartDate/EndDate window, which is what makes the
// "warn her the day before" requirement possible: filter for windows that
// cover tomorrow's date rather than only "is it broken right now".
async function getFacilitiesMaintenance() {
  return cache.cached("facilitiesMaintenance", 60 * 60 * 1000, async () => {
    try {
      return await callLta("v2/FacilitiesMaintenance");
    } catch {
      return demo.demoFacilitiesMaintenance;
    }
  });
}

// ---- Planned bus routes, published ahead of their effective date ----
async function getPlannedBusRoutes() {
  return cache.cached("plannedBusRoutes", 6 * 60 * 60 * 1000, async () => {
    try {
      return await callLta("PlannedBusRoutes");
    } catch {
      return demo.demoPlannedBusRoutes;
    }
  });
}

// ---- Historical passenger volume (monthly; these return a CSV download link, not inline rows) ----
async function getPassengerVolumeTrain(date) {
  try {
    return await callLta("PV/Train", date ? { Date: date } : {});
  } catch {
    return demo.demoPassengerVolume("Passenger Volume by Train Station");
  }
}
async function getPassengerVolumeBus(date) {
  try {
    return await callLta("PV/Bus", date ? { Date: date } : {});
  } catch {
    return demo.demoPassengerVolume("Passenger Volume by Bus Stop");
  }
}
async function getODVolumeTrain(date) {
  try {
    return await callLta("PV/ODTrain", date ? { Date: date } : {});
  } catch {
    return demo.demoPassengerVolume("Origin-Destination Train Station volume");
  }
}
async function getODVolumeBus(date) {
  try {
    return await callLta("PV/ODBus", date ? { Date: date } : {});
  } catch {
    return demo.demoPassengerVolume("Origin-Destination Bus Stop volume");
  }
}

module.exports = {
  hasKey,
  CANONICAL_LINES,
  getTrainServiceAlerts,
  getCrowdRealTime,
  getCrowdForecast,
  getBusArrival,
  getBusServices,
  getBusRoutes,
  getBusStops,
  getFacilitiesMaintenance,
  getPlannedBusRoutes,
  getPassengerVolumeTrain,
  getPassengerVolumeBus,
  getODVolumeTrain,
  getODVolumeBus,
};
