// server.js — NexRoute backend for Google Cloud Run.
//
// Storage is Firestore (Google's own database) rather than Supabase, so
// the entire stack — app, and now database — runs on Google Cloud, per
// the submission rule requiring everything hosted on GCP.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const lta = require("./lib/ltaClient");
const weather = require("./lib/weatherClient");
const onemap = require("./lib/onemapClient");
const { computeLiftStatus } = require("./lib/liftStatus");
const { journey, stationCoords, toilets } = require("./lib/journeyData");
const { getDb } = require("./lib/firestoreClient");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "frontend")));

function dbOr500(res) {
  try {
    return getDb();
  } catch (e) {
    res.status(500).json({ error: "Firestore isn't reachable — check IAM permissions / local auth.", detail: e.message });
    return null;
  }
}

// ---------------- Health ----------------

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ltaKeyConfigured: lta.hasKey(), time: new Date().toISOString() });
});

// ---------------- Live data pass-through (unchanged from before) ----------------

app.get("/api/stations", (req, res) => res.json(stationCoords));
app.get("/api/weather/today", async (req, res) => res.json(await weather.get24hForecast()));
app.get("/api/weather/tomorrow", async (req, res) => res.json(await weather.get4dayOutlook()));

app.get("/api/toilets/:stationCode", (req, res) => {
  const list = toilets[req.params.stationCode];
  if (!list) return res.status(404).json({ error: "No toilet data for this station in the prototype." });
  res.json({ source: "manual", list });
});

app.get("/api/lift-status/:stationCode", async (req, res) => {
  const result = await computeLiftStatus(req.params.stationCode);
  if (!result) return res.status(404).json({ error: "Unknown station code for this prototype." });
  res.json(result);
});

app.get("/api/journey/mdmlim", async (req, res) => {
  const [alerts, liftToday] = await Promise.all([lta.getTrainServiceAlerts(), computeLiftStatus(journey.toStationCode)]);
  const disrupted =
    alerts.Status === 2 &&
    (alerts.AffectedSegments || []).some(
      (seg) => seg.Line === "EWL" && seg.Stations && seg.Stations.split(",").some((s) => ["EW5", "EW23"].includes(s.trim()))
    );
  res.json({
    journey,
    liftStatus: liftToday,
    disruption: disrupted
      ? { affected: true, message: alerts.Message?.[0]?.Content || "Service disruption on your line.", source: alerts.source }
      : { affected: false, source: alerts.source },
    rerouteSuggested: false,
  });
});

app.get("/api/route/walk", async (req, res) => {
  const { from, to } = req.query;
  try {
    res.json(await onemap.getRoute(from, to, "walk"));
  } catch {
    res.json({ source: "demo", note: "[DEMO straight line — set ONEMAP_EMAIL/PASSWORD for a real walking path]", from, to });
  }
});

// ---------------- Reports (Firestore) ----------------

app.get("/api/reports", async (req, res) => {
  const db = dbOr500(res);
  if (!db) return;
  try {
    const snap = await db.collection("reports").orderBy("created_at", "desc").get();
    res.json(snap.docs.map((d) => {
      const r = d.data();
      return { id: d.id, userId: r.user_id, type: r.type, comment: r.comment, status: r.status, createdAt: r.created_at };
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/reports", async (req, res) => {
  const db = dbOr500(res);
  if (!db) return;
  try {
    const { userId, type, comment } = req.body || {};
    const id = "R" + Date.now();
    const createdAt = new Date().toISOString();
    await db.collection("reports").doc(id).set({ user_id: userId, type, comment, status: "pending", created_at: createdAt });
    res.status(201).json({ id, userId, type, comment, status: "pending", createdAt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/reports/:id/verify", async (req, res) => {
  const db = dbOr500(res);
  if (!db) return;
  try {
    const status = req.body && req.body.approve ? "verified" : "rejected";
    const ref = db.collection("reports").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Report not found." });
    await ref.update({ status });
    const r = doc.data();
    res.json({ id: req.params.id, userId: r.user_id, type: r.type, comment: r.comment, status, createdAt: r.created_at });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------------- Family check-ins (Firestore) ----------------

app.post("/api/checkin/:code", async (req, res) => {
  const db = dbOr500(res);
  if (!db) return;
  try {
    const label = (req.body && req.body.label) || "Checked in";
    const at = new Date().toISOString();
    await db.collection("family_links").doc(req.params.code).set({ last_checkin_label: label, last_checkin_at: at }, { merge: true });
    res.json({ lastCheckIn: { label, at } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/family/:code", async (req, res) => {
  const db = dbOr500(res);
  if (!db) return;
  try {
    const doc = await db.collection("family_links").doc(req.params.code).get();
    if (!doc.exists) return res.status(404).json({ error: "Code not recognised — ask them to check in at least once first." });
    const d = doc.data();
    res.json({ lastCheckIn: d.last_checkin_at ? { label: d.last_checkin_label, at: d.last_checkin_at } : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------------- Orchids (Firestore) ----------------
// Sorted in JS rather than Firestore orderBy, deliberately — a where() +
// orderBy() on different fields needs a composite index that Firestore
// won't create until you click a link in an error message the first time
// it runs. Sorting client-side avoids that entirely for a dataset this small.

app.post("/api/orchids/:code", async (req, res) => {
  const db = dbOr500(res);
  if (!db) return;
  try {
    const message = ((req.body && req.body.message) || "Thank you! 🌸").slice(0, 120);
    await db.collection("orchids").add({ code: req.params.code, message, created_at: new Date().toISOString() });
    res.status(201).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/orchids/:code", async (req, res) => {
  const db = dbOr500(res);
  if (!db) return;
  try {
    const snap = await db.collection("orchids").where("code", "==", req.params.code).get();
    const list = snap.docs.map((d) => ({ message: d.data().message, at: d.data().created_at }));
    list.sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`NexRoute running on port ${PORT}`);
  console.log(`LTA_ACCOUNT_KEY configured: ${lta.hasKey() ? "yes — LIVE data" : "no — DEMO data"}`);
});
