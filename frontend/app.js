// app.js — NexRoute frontend (v3: tabbed layout, rewards, offline caching).
// Talks only to our own backend. Every live-looking value carries a
// `source` field ("live" | "demo" | "manual") shown as a badge — never
// presented as live when it isn't.

const API = "";
let currentUser = null;

// ---------------- Tabs ----------------

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});
function showTab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
  document.getElementById("panel-" + name).classList.add("is-active");
  window.scrollTo(0, 0);
}
document.getElementById("settingsBtn").addEventListener("click", () => showTab("prefs"));
document.getElementById("btnFullLiftCheck").addEventListener("click", () => {
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("is-active"));
  document.getElementById("panel-lift").classList.add("is-active");
  window.scrollTo(0, 0);
});
document.getElementById("btnBackToJourney").addEventListener("click", () => showTab("journey"));

// ---------------- Confirmation modal ----------------

function confirmAction(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirmOverlay");
    document.getElementById("confirmTitle").textContent = message;
    overlay.hidden = false;
    const okBtn = document.getElementById("confirmOk"), cancelBtn = document.getElementById("confirmCancel");
    const cleanup = (result) => { overlay.hidden = true; okBtn.removeEventListener("click", onOk); cancelBtn.removeEventListener("click", onCancel); resolve(result); };
    const onOk = () => cleanup(true), onCancel = () => cleanup(false);
    okBtn.addEventListener("click", onOk); cancelBtn.addEventListener("click", onCancel);
  });
}

// ---------------- Audio narration ----------------

let lastSpokenText = "";
const audioBar = document.getElementById("audioBar");
function speakText(text) {
  if (!("speechSynthesis" in window)) { alert("Voice reading isn't supported in this browser."); return; }
  lastSpokenText = text;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = parseFloat(document.getElementById("speechRate").value || "0.95");
  utter.onend = () => { audioBar.hidden = true; };
  window.speechSynthesis.speak(utter);
  audioBar.hidden = false;
  document.getElementById("audioPlayPause").textContent = "⏸";
}
document.getElementById("audioPlayPause").addEventListener("click", () => {
  const btn = document.getElementById("audioPlayPause");
  if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) { window.speechSynthesis.pause(); btn.textContent = "▶"; }
  else if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); btn.textContent = "⏸"; }
});
document.getElementById("audioReplay").addEventListener("click", () => speakText(lastSpokenText));
document.getElementById("audioStop").addEventListener("click", () => { window.speechSynthesis.cancel(); audioBar.hidden = true; });

// ---------------- Device profile — no login, autosaves like the bus app's favourites ----------------

const DEVICE_ID_KEY = "nexroute_device_id", PROFILE_KEY = "nexroute_profile";

function loadOrCreateProfile() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) { deviceId = "D" + Date.now() + Math.random().toString(36).slice(2, 8); localStorage.setItem(DEVICE_ID_KEY, deviceId); }
  let profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
  if (!profile) {
    profile = {
      needs: { avoidStairs: true, sheltered: true, slowWalk: true, largeText: false, highContrast: false, games: false, ageMode: "adult" },
      familyLinkCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      stamps: 0,
      voucherCode: null,
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
  return { id: deviceId, ...profile };
}
function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({
    needs: currentUser.needs, familyLinkCode: currentUser.familyLinkCode, stamps: currentUser.stamps, voucherCode: currentUser.voucherCode,
  }));
}
function applyNeedsToUI() {
  const needs = currentUser.needs;
  document.body.classList.toggle("high-contrast", Boolean(needs.highContrast));
  document.body.setAttribute("data-age", needs.ageMode || "adult");
  document.getElementById("prefAvoidStairs").checked = Boolean(needs.avoidStairs);
  document.getElementById("prefSheltered").checked = Boolean(needs.sheltered);
  document.getElementById("prefSlowWalk").checked = Boolean(needs.slowWalk);
  document.getElementById("prefLargeText").checked = Boolean(needs.largeText);
  document.getElementById("prefHighContrast").checked = Boolean(needs.highContrast);
  document.getElementById("prefGames").checked = Boolean(needs.games);
  document.querySelectorAll(".age-mode-btn").forEach((b) => b.classList.toggle("is-selected", b.dataset.age === (needs.ageMode || "adult")));
  document.getElementById("triviaGate").hidden = Boolean(needs.games);
}

document.querySelectorAll(".age-mode-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const ok = await confirmAction(`Switch to ${btn.textContent} mode?`);
    if (!ok) return;
    currentUser.needs.ageMode = btn.dataset.age;
    if (btn.dataset.age === "senior") currentUser.needs.largeText = true;
    saveProfile();
    applyNeedsToUI();
  });
});

document.getElementById("prefsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const ok = await confirmAction("Save these changes to your preferences?");
  if (!ok) return;
  currentUser.needs = {
    ...currentUser.needs,
    avoidStairs: document.getElementById("prefAvoidStairs").checked,
    sheltered: document.getElementById("prefSheltered").checked,
    slowWalk: document.getElementById("prefSlowWalk").checked,
    largeText: document.getElementById("prefLargeText").checked,
    highContrast: document.getElementById("prefHighContrast").checked,
    games: document.getElementById("prefGames").checked,
  };
  saveProfile();
  applyNeedsToUI();
  const msg = document.getElementById("prefsSaved");
  msg.textContent = "Saved."; setTimeout(() => (msg.textContent = ""), 2500);
});

document.getElementById("btnResetDevice").addEventListener("click", async () => {
  const ok = await confirmAction("Reset all your saved preferences, stamps and routines on this device?");
  if (!ok) return;
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem("nexroute_routines");
  currentUser = loadOrCreateProfile();
  saveProfile();
  boot();
});

// ---------------- Offline-aware fetch: cache last-good response, fall back to it when offline ----------------

async function fetchWithCache(key, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    localStorage.setItem("cache:" + key, JSON.stringify({ data, at: Date.now() }));
    document.getElementById("offlinePill").hidden = true;
    return data;
  } catch {
    const cached = JSON.parse(localStorage.getItem("cache:" + key) || "null");
    document.getElementById("offlinePill").hidden = false;
    if (cached) return { ...cached.data, __stale: true, __cachedAt: cached.at };
    throw new Error("No live data and nothing cached yet for " + key);
  }
}

// ---------------- Journey (scored against local preferences, like the first prototype) ----------------

function scoreJourney(journeyData, needs) {
  let score = 100;
  const legs = journeyData.legs;
  const hasStairs = legs.some((l) => l.stepFree === false);
  if (needs.avoidStairs && hasStairs) score -= 40;
  const shelteredMin = legs.filter((l) => l.sheltered).reduce((a, l) => a + l.minutes, 0);
  const walkMin = legs.filter((l) => l.type === "walk").reduce((a, l) => a + l.minutes, 0);
  if (needs.sheltered && walkMin > 0) score -= (1 - shelteredMin / walkMin) * 20;
  if (needs.slowWalk) score -= 5; // extra time already implied by leg minutes
  return Math.max(0, Math.round(score));
}

let lastLiftData = null;

document.getElementById("btnCheckJourney").addEventListener("click", async () => {
  const cardsEl = document.getElementById("routeCards");
  cardsEl.innerHTML = "<p>Checking your journey…</p>";
  let journeyData, liftData;
  try {
    [journeyData, liftData] = await Promise.all([
      fetchWithCache("journey", `${API}/api/journey/mdmlim`),
      fetchWithCache("lift", `${API}/api/lift-status/EW23`),
    ]);
  } catch {
    cardsEl.innerHTML = "<p>No saved data yet, and no connection. Try again once you're online.</p>";
    return;
  }
  lastLiftData = liftData;
  renderDisruption(journeyData);
  renderRouteCard(journeyData);
  renderLiftMini(liftData);
  renderExitGuide(liftData);
  renderToilets();
  renderMap();
  document.getElementById("btnNarrateRoute").hidden = false;
  document.getElementById("btnFullLiftCheck").hidden = false;
  document.getElementById("exitDisclosure").hidden = false;
  document.getElementById("toiletDisclosure").hidden = false;
});

function renderDisruption(journeyData) {
  const banner = document.getElementById("disruptionBanner");
  if (journeyData.__stale) {
    banner.hidden = false; banner.className = "banner offline";
    banner.textContent = `Showing saved data from ${new Date(journeyData.__cachedAt).toLocaleString()} — you're offline right now.`;
    return;
  }
  if (journeyData.disruption && journeyData.disruption.affected) {
    banner.hidden = false; banner.className = "banner";
    banner.innerHTML = `⚠️ ${journeyData.disruption.message} <span class="badge ${journeyData.disruption.source === "live" ? "live" : "demo"}">${journeyData.disruption.source === "live" ? "LIVE" : "DEMO"}</span><br><small>Your saved route is unchanged — NexRoute never reroutes you without asking first.</small>`;
  } else {
    banner.hidden = true;
  }
}

function renderRouteCard(journeyData) {
  const j = journeyData.journey;
  const score = scoreJourney(j, currentUser.needs);
  const legsHtml = j.legs.map((leg, i) =>
    `<span class="route-leg">${leg.label}</span>` + (i < j.legs.length - 1 ? '<span class="route-arrow">→</span>' : "")
  ).join("");
  const totalMin = j.totalMinutes;
  const stairsCount = j.legs.filter((l) => l.stepFree === false).length;
  document.getElementById("routeCards").innerHTML = `
    <div class="route-card is-recommended">
      <div class="route-card-top">
        <div><span class="route-badge">Your saved route</span><h3 style="margin:0.1rem 0 0;">${j.fromName} → ${j.toName}</h3></div>
        <span class="route-score">Suitability: ${score}/100</span>
      </div>
      <div class="route-line">${legsHtml}</div>
      <div class="route-stats">
        <div class="stat"><span class="stat-value">${totalMin} min</span><span class="stat-label">Duration</span></div>
        <div class="stat"><span class="stat-value">${stairsCount}</span><span class="stat-label">Stairs legs</span></div>
        <div class="stat"><span class="stat-value">${j.legs.length}</span><span class="stat-label">Legs</span></div>
      </div>
    </div>`;
}

function renderLiftMini(liftData) {
  const el = document.getElementById("liftMini");
  const ok = liftData.today.allLiftsWorking;
  el.innerHTML = `<div class="status-banner ${ok ? "ok" : "bad"}">${ok ? "✅ ALL LIFTS WORKING TODAY" : "⚠️ A LIFT NEEDS ATTENTION TODAY"} <span class="badge ${liftData.source === "live" ? "live" : "demo"}">${liftData.source === "live" ? "LIVE" : "DEMO"}</span></div>`;
}

function renderExitGuide(liftData) {
  let html = '<table class="exit-table"><thead><tr><th>Exit</th><th>Lift</th><th>Shelter</th><th>Crowd</th></tr></thead><tbody>';
  liftData.today.exits.forEach((e) => {
    html += `<tr><td>Exit ${e.exit}</td>
      <td>${e.hasLift ? `<span class="pill ${e.brokenToday ? "no" : "yes"}">${e.brokenToday ? "Broken" : "Working"}</span>` : "—"}</td>
      <td><span class="pill ${e.sheltered ? "yes" : "no"}">${e.sheltered ? "Sheltered" : "Open"}</span></td>
      <td>${e.crowdLevel}</td></tr>`;
  });
  html += "</tbody></table>";
  document.getElementById("exitGuideBody").innerHTML = html;
}

async function renderToilets() {
  try {
    const res = await fetch(`${API}/api/toilets/EW23`);
    const data = await res.json();
    document.getElementById("toiletBody").innerHTML = data.list.map((t) =>
      `<div class="toilet-item"><span>${t.name}</span><span class="pill ${t.accessible ? "yes" : "no"}">${t.accessible ? "Accessible" : "Standard"} · ${t.distanceM}m</span></div>`
    ).join("") + `<p class="lede small" style="margin-top:0.6rem;">Manually compiled for this prototype <span class="badge manual">MANUAL</span></p>`;
  } catch { document.getElementById("toiletBody").innerHTML = "<p>Couldn't load toilet info.</p>"; }
}

let leafletMap = null;
function renderMap() {
  const mapEl = document.getElementById("routeMap");
  mapEl.hidden = false;
  document.getElementById("mapAttribution").hidden = false;
  if (!leafletMap) {
    leafletMap = L.map("routeMap", { zoomControl: false, attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(leafletMap);
  }
  fetch(`${API}/api/stations`).then((r) => r.json()).then((stations) => {
    const from = stations.EW5, to = stations.EW23;
    leafletMap.eachLayer((l) => { if (l instanceof L.Marker || l instanceof L.Polyline) leafletMap.removeLayer(l); });
    leafletMap.fitBounds(L.latLngBounds([from.lat, from.lng], [to.lat, to.lng]), { padding: [24, 24] });
    L.marker([from.lat, from.lng]).addTo(leafletMap).bindPopup(from.name);
    L.marker([to.lat, to.lng]).addTo(leafletMap).bindPopup(to.name);
    L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: "#0E7C7B", weight: 4, dashArray: "6 6" }).addTo(leafletMap);
  });
}

document.getElementById("btnNarrateRoute").addEventListener("click", () => {
  const text = Array.from(document.querySelectorAll(".route-leg")).map((el) => el.textContent).join(". ");
  speakText(text || "No route loaded yet.");
});

// ---------------- Full lift-check screen ----------------

document.getElementById("btnFullLiftCheck").addEventListener("click", () => {
  if (!lastLiftData) return;
  renderFullLift(lastLiftData);
});

function renderFullLift(data) {
  const badge = `<span class="badge ${data.source === "live" ? "live" : "demo"}">${data.source === "live" ? "LIVE" : "DEMO"}</span>`;
  const todayEl = document.getElementById("liftBannerToday");
  todayEl.className = "status-banner " + (data.today.allLiftsWorking ? "ok" : "bad");
  todayEl.innerHTML = (data.today.allLiftsWorking ? "✅ ALL LIFTS WORKING" : "⚠️ A LIFT NEEDS ATTENTION") + " " + badge;
  const tomEl = document.getElementById("liftBannerTomorrow");
  tomEl.className = "status-banner " + (data.tomorrow.allLiftsWorking ? "ok" : "warn");
  tomEl.innerHTML = (data.tomorrow.allLiftsWorking ? "✅ ALL LIFTS EXPECTED WORKING" : "⚠️ WARNING: A LIFT WILL BE UNDER MAINTENANCE") + " " + badge;
  let html = '<table class="exit-table"><thead><tr><th>Exit</th><th>Lift?</th><th>Today</th><th>Tomorrow</th></tr></thead><tbody>';
  data.today.exits.forEach((e, i) => {
    const tmr = data.tomorrow.exits[i];
    html += `<tr><td>Exit ${e.exit}</td><td>${e.hasLift ? "Yes" : "No lift"}</td>
      <td>${e.hasLift ? (e.brokenToday ? "Out of service" : "Working") : "—"}</td>
      <td>${e.hasLift ? (tmr.brokenTomorrow ? "Will be out" : "Working") : "—"}</td></tr>`;
  });
  html += "</tbody></table>";
  document.getElementById("liftDetailToday").innerHTML = html;
}

document.getElementById("btnNarrateLift").addEventListener("click", () => {
  if (!lastLiftData) return;
  speakText(`Today: ${lastLiftData.today.allLiftsWorking ? "all lifts are working." : "a lift needs attention."} Tomorrow: ${lastLiftData.tomorrow.allLiftsWorking ? "all lifts are expected working." : "a lift will be under maintenance."}`);
});

document.getElementById("btnSaveImage").addEventListener("click", () => {
  if (!lastLiftData) return;
  const canvas = document.getElementById("snapshotCanvas");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#F5F4EF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#142A3D"; ctx.font = "bold 26px sans-serif"; ctx.fillText("NexRoute — Outram Park lift status", 24, 46);
  ctx.font = "bold 22px sans-serif";
  ctx.fillStyle = lastLiftData.today.allLiftsWorking ? "#2E7D5B" : "#C1442D";
  ctx.fillText(lastLiftData.today.allLiftsWorking ? "TODAY: ALL LIFTS WORKING" : "TODAY: A LIFT NEEDS ATTENTION", 24, 100);
  ctx.fillStyle = lastLiftData.tomorrow.allLiftsWorking ? "#2E7D5B" : "#B9791F";
  ctx.fillText(lastLiftData.tomorrow.allLiftsWorking ? "TOMORROW: ALL LIFTS OK" : "TOMORROW: LIFT MAINTENANCE WARNING", 24, 140);
  ctx.fillStyle = "#1B1F23"; ctx.font = "18px sans-serif";
  let y = 190;
  lastLiftData.today.exits.forEach((e, i) => {
    const tmr = lastLiftData.tomorrow.exits[i];
    ctx.fillText(`Exit ${e.exit}: ${e.hasLift ? (e.brokenToday ? "out today" : "working today") + (tmr.brokenTomorrow ? ", out tomorrow" : ", working tomorrow") : "no lift"}`, 24, y);
    y += 30;
  });
  ctx.font = "italic 15px sans-serif"; ctx.fillStyle = "#4B5259";
  ctx.fillText(`Saved ${new Date().toLocaleString()} · ${lastLiftData.source === "live" ? "Live LTA data" : "Demo data"}`, 24, y + 20);
  const link = document.createElement("a");
  link.download = "nexroute-lift-status.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// ---------------- Routines (offline, localStorage only) ----------------

const ROUTINES_KEY = "nexroute_routines";
function loadRoutines() {
  let list = JSON.parse(localStorage.getItem(ROUTINES_KEY) || "null");
  if (!list) {
    list = [{ id: "R1", name: "SGH check-up", from: "Bedok", to: "Outram Park", time: "09:00" }];
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(list));
  }
  return list;
}
function renderRoutines() {
  const list = loadRoutines();
  document.getElementById("routineList").innerHTML = list.map((r) => `
    <div class="routine-item">
      <div><strong>${r.name}</strong><div class="meta">${r.from} → ${r.to} · ${r.time}</div></div>
      <button class="remove-btn" data-id="${r.id}">Remove</button>
    </div>`).join("") || "<p>No routines yet.</p>";
  document.querySelectorAll("#routineList .remove-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await confirmAction("Remove this saved routine?");
      if (!ok) return;
      const updated = loadRoutines().filter((r) => r.id !== btn.dataset.id);
      localStorage.setItem(ROUTINES_KEY, JSON.stringify(updated));
      renderRoutines();
    });
  });
}
document.getElementById("routineForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const list = loadRoutines();
  list.push({
    id: "R" + Date.now(),
    name: document.getElementById("rtName").value,
    from: document.getElementById("rtFrom").value,
    to: document.getElementById("rtTo").value,
    time: document.getElementById("rtTime").value,
  });
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(list));
  e.target.reset();
  renderRoutines();
});

// ---------------- Rewards: stamps, orchids, trivia ----------------

function renderStamps() {
  const row = document.getElementById("stampRow");
  row.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const s = document.createElement("div");
    s.className = "stamp" + (i < currentUser.stamps ? " filled" : "");
    s.textContent = i < currentUser.stamps ? "☕" : "";
    row.appendChild(s);
  }
  const voucherArea = document.getElementById("voucherArea");
  voucherArea.innerHTML = currentUser.voucherCode
    ? `<p style="margin-top:0.7rem;">🎉 Free Kopi-O-Kosong unlocked! Show this at any participating stall:</p><div class="voucher-code">${currentUser.voucherCode}</div>`
    : "";
}
document.getElementById("btnAddStamp").addEventListener("click", async () => {
  if (currentUser.stamps >= 10) { alert("You've already earned this reward — redeem it, then start a new set of stamps."); return; }
  const ok = await confirmAction("Add a safety stamp for this journey?");
  if (!ok) return;
  currentUser.stamps += 1;
  if (currentUser.stamps >= 10) currentUser.voucherCode = "KOPI-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  saveProfile();
  renderStamps();
});

document.getElementById("btnSendOrchid").addEventListener("click", async () => {
  const code = document.getElementById("orchidToCode").value.trim().toUpperCase();
  if (!code) return;
  const ok = await confirmAction(`Send a thank-you orchid to ${code}?`);
  if (!ok) return;
  const msg = document.getElementById("orchidMsg").value.trim() || "Thank you! 🌸";
  await fetch(`${API}/api/orchids/${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg }) });
  document.getElementById("orchidToCode").value = ""; document.getElementById("orchidMsg").value = "";
  alert("Orchid sent!");
});
async function loadOrchidInbox() {
  const res = await fetch(`${API}/api/orchids/${currentUser.familyLinkCode}`);
  const list = await res.json();
  document.getElementById("orchidInbox").innerHTML = list.length
    ? list.map((o) => `<div class="orchid-msg">🌸 ${o.message} <span class="lede small">— ${new Date(o.at).toLocaleString()}</span></div>`).join("")
    : "<p class=\"lede small\">None yet — share your family code (in Family & Help) so others can thank you.</p>";
}

const KAMPUNG_TRIVIA = [
  { q: "Outram Park's name comes from Sir James Low's estate, named after a Governor of which colonial territory?", options: ["Bombay", "Madras", "Penang"], correct: 2 },
  { q: "Before MRT stations, what did most Singaporeans use to get around Bedok in the 1960s?", options: ["Trishaws and buses", "Personal cars", "Ferries"], correct: 0 },
  { q: "Bedok was once known for its coastal kampungs and this seaside activity, since the coast used to be much closer:", options: ["Fishing", "Skiing", "Surfing competitions"], correct: 0 },
  { q: "\"Kopi-O-Kosong\" means coffee that is:", options: ["Iced and sweet", "Black, no sugar, no milk", "With extra condensed milk"], correct: 1 },
  { q: "Outram Park is named after a historical figure — 'Outram Road' also gives its name to a famous former:", options: ["Prison", "Racecourse", "Airport"], correct: 0 },
];

document.getElementById("btnPlayTrivia").addEventListener("click", () => {
  if (!currentUser.needs.games) { document.getElementById("triviaGate").hidden = false; return; }
  playTrivia();
});
function playTrivia() {
  let i = 0, score = 0;
  const overlay = document.getElementById("triviaOverlay");
  const card = document.getElementById("triviaCard");
  overlay.hidden = false;
  function renderQ() {
    if (i >= KAMPUNG_TRIVIA.length) {
      card.innerHTML = `<p class="trivia-q">You scored ${score} / ${KAMPUNG_TRIVIA.length}! 🏘️</p>`;
      return;
    }
    const q = KAMPUNG_TRIVIA[i];
    card.innerHTML = `<p class="trivia-q">${q.q}</p>` + q.options.map((opt, idx) => `<button class="trivia-opt" data-idx="${idx}">${opt}</button>`).join("");
    card.querySelectorAll(".trivia-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        card.querySelectorAll(".trivia-opt").forEach((b, bi) => {
          b.disabled = true;
          if (bi === q.correct) b.classList.add("correct");
          else if (bi === idx) b.classList.add("wrong");
        });
        if (idx === q.correct) score++;
        setTimeout(() => { i++; renderQ(); }, 900);
      });
    });
  }
  renderQ();
}
document.getElementById("triviaClose").addEventListener("click", () => { document.getElementById("triviaOverlay").hidden = true; });

// ---------------- Family & help ----------------

document.getElementById("btnCallStaff").addEventListener("click", async () => {
  const ok = await confirmAction("Call MRT station staff now?");
  if (ok) window.location.href = "tel:+6567767888";
});
document.getElementById("btnCheckIn").addEventListener("click", async () => {
  const ok = await confirmAction("Check in now to let your family know you've arrived?");
  if (!ok) return;
  await fetch(`${API}/api/checkin/${currentUser.familyLinkCode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "Arrived safely" }) });
  alert("Checked in.");
});
document.getElementById("btnFamilyLookup").addEventListener("click", async () => {
  const code = document.getElementById("familyLookupCode").value.trim().toUpperCase();
  const res = await fetch(`${API}/api/family/${code}`);
  const el = document.getElementById("familyStatus");
  el.hidden = false;
  if (!res.ok) { el.className = "status-banner bad"; el.textContent = "Code not recognised."; return; }
  const data = await res.json();
  el.className = "status-banner " + (data.lastCheckIn ? "ok" : "warn");
  el.textContent = data.lastCheckIn ? `Last check-in: ${data.lastCheckIn.label} at ${new Date(data.lastCheckIn.at).toLocaleTimeString()}` : "No check-in yet.";
});

// ---------------- Report a barrier (verification workflow) ----------------

document.getElementById("reportForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const type = document.getElementById("reportType").value;
  const comment = document.getElementById("reportComment").value;
  const ok = await confirmAction(`Report "${type}"? Staff will verify before other commuters are alerted.`);
  if (!ok) return;
  await fetch(`${API}/api/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: currentUser.id, type, comment }) });
  document.getElementById("reportForm").reset();
  loadMyReports();
});
async function loadMyReports() {
  const res = await fetch(`${API}/api/reports`);
  const all = await res.json();
  const mine = all.filter((r) => r.userId === currentUser.id);
  document.getElementById("myReports").innerHTML = mine.length
    ? mine.map((r) => `<div class="menu-item" style="cursor:default;">${r.type} — <strong>${r.status}</strong><br><small>${r.comment || ""}</small></div>`).join("")
    : "<p class=\"lede small\">No reports yet.</p>";
}
document.getElementById("btnStaffDemo").addEventListener("click", () => {
  const panel = document.getElementById("staffPanel");
  panel.hidden = !panel.hidden;
  if (!panel.hidden) refreshStaffPanel();
});
async function refreshStaffPanel() {
  const panel = document.getElementById("staffPanel");
  const res = await fetch(`${API}/api/reports`);
  const all = await res.json();
  const pending = all.filter((r) => r.status === "pending");
  panel.innerHTML = pending.length
    ? pending.map((r) => `<div class="menu-item" style="cursor:default;">${r.type} — ${r.comment || ""}
        <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
          <button class="secondary-btn" data-verify="${r.id}" data-approve="true">Verify &amp; alert</button>
          <button class="secondary-btn" data-verify="${r.id}" data-approve="false">Reject</button>
        </div></div>`).join("")
    : "<p class=\"lede small\">No pending reports. (Simulates an LTA staff queue — production needs its own authenticated login.)</p>";
  panel.querySelectorAll("[data-verify]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await fetch(`${API}/api/reports/${btn.dataset.verify}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve: btn.dataset.approve === "true" }) });
      refreshStaffPanel(); loadMyReports();
    });
  });
}

// ---------------- Boot ----------------

function boot() {
  currentUser = loadOrCreateProfile();
  applyNeedsToUI();
  document.getElementById("familyCode").textContent = currentUser.familyLinkCode;
  renderStamps();
  renderRoutines();
  loadOrchidInbox();
  loadMyReports();
  showTab("journey");
}
boot();
