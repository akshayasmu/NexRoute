// weatherClient.js
// data.gov.sg's real-time weather endpoints need NO key at all, so unlike
// ltaClient.js this one is live by default with no setup step.
// Docs / shapes are in PS2/references/24hourWeatherForecast.json and
// 4dayWeatherForecast.json (OpenAPI specs, not data).

const cache = require("./cache");

const BASE = "https://api-open.data.gov.sg/v2/real-time/api";

async function get24hForecast() {
  return cache.cached("weather24h", 10 * 60 * 1000, async () => {
    try {
      const res = await fetch(`${BASE}/twenty-four-hr-forecast`);
      const json = await res.json();
      return { source: "live", ...json };
    } catch {
      return {
        source: "demo",
        note: "[DEMO] data.gov.sg unreachable from this sandbox — this call is real code, wire-compatible with the live endpoint.",
        general: { forecast: "Showers", relativeHumidity: { low: 60, high: 95 }, temperature: { low: 25, high: 31 } },
      };
    }
  });
}

async function get4dayOutlook() {
  return cache.cached("weather4day", 60 * 60 * 1000, async () => {
    try {
      const res = await fetch(`${BASE}/four-day-outlook`);
      const json = await res.json();
      return { source: "live", ...json };
    } catch {
      return {
        source: "demo",
        note: "[DEMO] data.gov.sg unreachable from this sandbox.",
        forecasts: [{ day: "Tomorrow", forecast: "Heavy Showers", temperature: { low: 25, high: 30 } }],
      };
    }
  });
}

module.exports = { get24hForecast, get4dayOutlook };
