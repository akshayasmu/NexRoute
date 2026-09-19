// server.js — NexRoute backend.
//
// Three kinds of data meet here, and the API responses always say which
// kind you're looking at via a `source` field:
//   "live"  — a real call to LTA DataMall / data.gov.sg / OneMap succeeded
//   "demo"  — no key configured yet, or the live call failed, so a
//             clearly-labelled stand-in was used instead (see data/demoFallbacks.js)
// Never remove or hide the source field — presenting demo data as live is
// exactly what PS2's judging rubric caps a submission for.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const lta = require("./services/ltaClient");
const weather = require("./services/weatherClient");
const onemap = require("./services/onemapClient");
const { journey, exits, stationCoords, journeyPoints } = require("./data/journeyData");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ---------------- In-memory "database" (resets on server restart — fine for a demo, say so in the write-up) ----------------
//
// There is no login. `reports` are tagged with whatever local device id the
// frontend generated for itself (see frontend/app.js loadOrCreateProfile) —
// good enough to let someone see "my reports", not an identity system.

let reports = []; // { id, userId, type, comment, status: 'pending'|'verified'|'rejected' }
let familyLinks = {}; // linkCode -> { lastCheckIn: {label, at} } — created lazily, no account behind it

// ---------------- Live train alerts (pass-through, cached, labelled) ----------------

app.get("/api/live/train-alerts", async (req, res) => {
  res.json(await lta.getTrainServiceAlerts());
});

app.get("/api/live/crowd/:line/:kind", async (req, res) => {
  const { line, kind } = req.params;
  const data = kind === "forecast" ? await lta.getCrowdForecast(line) : await lta.getCrowdRealTime(line);
  res.json(data);
});

app.get("/api/live/bus-arrival/:stopCode", async (req, res) => {
  res.json(await lta.getBusArrival(req.params.stopCode));
});

// ---------------- Day-ahead lift status — the "warn her the day before" requirement ----------------
// Combines: our hand-modelled exit facts for this corridor (journeyData.js)
// with LTA's FacilitiesMaintenance feed, which carries a StartDate/EndDate
// window per lift — so "tomorrow" is a real filter on real dates, not a guess.

async function computeLiftStatus(stationCode) {
  const stationExits = exits[stationCode];
  if (!stationExits) return null;

  const maintenance = await lta.getFacilitiesMaintenance();
  const rows = maintenance.value || [];
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);

  function maintenanceCovering(exitLabel, date) {
    return rows.find((m) => m.ExitCode && m.ExitCode.includes(exitLabel) && m.StartDate <= date && date <= m.EndDate);
  }

  const todayStatus = stationExits.map((e) => ({ ...e, brokenToday: Boolean(maintenanceCovering(e.exit, today)) }));
  const tomorrowStatus = stationExits.map((e) => ({ ...e, brokenTomorrow: Boolean(maintenanceCovering(e.exit, tomorrow)) }));

  const allOkToday = todayStatus.every((e) => !e.hasLift || !e.brokenToday);
  const allOkTomorrow = tomorrowStatus.every((e) => !e.hasLift || !e.brokenTomorrow);

  return {
    source: maintenance.source,
    stationCode,
    today: { allLiftsWorking: allOkToday, exits: todayStatus },
    tomorrow: { allLiftsWorking: allOkTomorrow, exits: tomorrowStatus },
  };
}

app.get("/api/lift-status/:stationCode", async (req, res) => {
  const result = await computeLiftStatus(req.params.stationCode);
  if (!result) return res.status(404).json({ error: "Unknown station code for this prototype." });
  res.json(result);
});

// ---------------- Weather ----------------

app.get("/api/weather/today", async (req, res) => res.json(await weather.get24hForecast()));
app.get("/api/weather/tomorrow", async (req, res) => res.json(await weather.get4dayOutlook()));

// ---------------- The one persona journey (Bedok -> Outram Park for SGH) ----------------
// NOTE ON SCOPE: this endpoint hand-models one corridor rather than routing
// an arbitrary origin/destination across the whole network — a full build
// needs a real routing engine (OSRM/GraphHopper self-hosted on the OSM
// Singapore extract, or OneMap's /routingsvc — see onemapClient.js) joined
// against live crowd/disruption data. Say this plainly in the write-up;
// do not claim general-purpose routing you have not built.

app.get("/api/journey/mdmlim", async (req, res) => {
  const [alerts, liftToday] = await Promise.all([
    lta.getTrainServiceAlerts(),
    computeLiftStatus(journey.toStationCode),
  ]);

  const disrupted =
    alerts.Status === 2 &&
    (alerts.AffectedSegments || []).some((seg) => seg.Line === "EWL" && seg.Stations && seg.Stations.split(",").some((s) => ["EW5", "EW23"].includes(s.trim())));

  res.json({
    journey,
    liftStatus: liftToday,
    disruption: disrupted
      ? { affected: true, message: alerts.Message?.[0]?.Content || "Service disruption on your line.", source: alerts.source }
      : { affected: false, source: alerts.source },
    // NexRoute's rule, per Mdm Lim's stated preference: never silently reroute.
    // A disruption is surfaced as a flag for her to review the day before —
    // it does not change her saved route on its own.
    rerouteSuggested: false,
  });
});

// ---------------- OneMap walking route for the map (real OSM-based routing call) ----------------

app.get("/api/route/walk", async (req, res) => {
  const { from, to } = req.query; // "lat,lng"
  try {
    const data = await onemap.getRoute(from, to, "walk");
    res.json(data);
  } catch (err) {
    // Straight-line fallback so the map still draws something while you
    // wait for a OneMap account, clearly marked as such.
    res.json({ source: "demo", note: "[DEMO straight line — set ONEMAP_EMAIL/PASSWORD for a real walking path]", from, to });
  }
});

// The whole door-to-door path: walk -> rail ("pt") -> walk. Each segment is
// routed separately so one OneMap failure only degrades that segment, which
// is then a straight line explicitly marked source:"demo".
app.get("/api/route/journey", async (req, res) => {
  const { home, sgh } = journeyPoints;
  const bedok = stationCoords.EW5, outram = stationCoords.EW23;
  const ll = (p) => `${p.lat},${p.lng}`;
  const plan = [
    { type: "walk", label: "Home to Bedok MRT", from: home, to: bedok, routeType: "walk" },
    { type: "rail", label: "Bedok to Outram Park", from: bedok, to: outram, routeType: "pt" },
    { type: "walk", label: "Outram Park to SGH", from: outram, to: sgh, routeType: "walk" },
  ];
  const segments = await Promise.all(
    plan.map(async ({ type, label, from, to, routeType }) => {
      try {
        const route = await onemap.getRoute(ll(from), ll(to), routeType);
        const coordinates = onemap.routeCoordinates(route, routeType);
        if (coordinates.length < 2) throw new Error("OneMap returned no geometry");
        return { type, label, source: "live", coordinates };
      } catch (err) {
        return { type, label, source: "demo", coordinates: [[from.lat, from.lng], [to.lat, to.lng]] };
      }
    })
  );
  res.json({ source: segments.every((s) => s.source === "live") ? "live" : "demo", segments });
});

app.get("/api/stations", (req, res) => res.json(stationCoords));

// ---------------- Reports — with a required verification step ----------------
// Mdm Lim's family flagged that an unverified "report a barrier" button can
// spread misinformation if pressed by mistake. So a report never triggers a
// public alert by itself: it sits as "pending" until a staff account verifies it.
// (This is an app-internal moderation flow we built ourselves — it is not a
// claim that LTA staff use this app; say that plainly in your write-up.)

app.post("/api/reports", (req, res) => {
  const { userId, type, comment, location } = req.body;
  const report = {
    id: "R" + Date.now(),
    userId,
    type,
    comment,
    location,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  reports.push(report);
  res.status(201).json(report);
});

app.get("/api/reports", (req, res) => res.json(reports));

// Demo-only staff action. In production this endpoint would sit behind real
// LTA-staff authentication, not be reachable from the commuter's own app.
app.post("/api/reports/:id/verify", (req, res) => {
  const report = reports.find((r) => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found." });
  report.status = req.body.approve ? "verified" : "rejected";
  res.json(report);
});

// ---------------- Family mode ----------------
// Opt-in, self-contained check-in status — no location tracking without an
// explicit "I've arrived" tap from the user. See write-up for what is
// stored, where, and for how long (PS2 ground rule 2.5 on personal data).

app.post("/api/checkin/:linkCode", (req, res) => {
  const code = req.params.linkCode;
  if (!familyLinks[code]) familyLinks[code] = { lastCheckIn: null };
  familyLinks[code].lastCheckIn = { label: req.body.label || "Checked in", at: new Date().toISOString() };
  res.json(familyLinks[code]);
});

app.get("/api/family/:linkCode", (req, res) => {
  const link = familyLinks[req.params.linkCode];
  if (!link) return res.status(404).json({ error: "Code not recognised — ask them to check in at least once first." });
  res.json({ lastCheckIn: link.lastCheckIn });
});

// ---------------- Health ----------------

app.get("/api/health", (req, res) =>
  res.json({ ok: true, ltaKeyConfigured: lta.hasKey(), time: new Date().toISOString() })
);

app.listen(PORT, () => {
  console.log(`NexRoute backend running at http://localhost:${PORT}`);
  console.log(`LTA_ACCOUNT_KEY configured: ${lta.hasKey() ? "yes — using LIVE data" : "no — using DEMO data, see backend/.env.example"}`);
});
