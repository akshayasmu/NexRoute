// app.js — NexRoute frontend.
// Talks to our own backend only (server.js), which is where the real LTA /
// data.gov.sg / OneMap calls happen. Every piece of live-looking data here
// carries the `source` field the backend sends, and we show it as a badge —
// never presenting demo data as live is a hard rule for this project.

const API = "";
let currentUser = null; // { id, name, needs, favoriteRoute, familyLinkCode }
let screenStack = ["screen-home"];

// ---------------- Screen navigation ----------------

function showScreen(id, { replace = false } = {}) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
  document.getElementById(id).classList.add("is-active");
  if (replace) screenStack = [id];
  else screenStack.push(id);
  document.getElementById("backBtn").hidden = screenStack.length <= 1 || id === "screen-home";
  window.scrollTo(0, 0);
}
document.getElementById("backBtn").addEventListener("click", () => {
  screenStack.pop();
  const prev = screenStack.pop() || "screen-home";
  showScreen(prev);
});
document.getElementById("settingsBtn").addEventListener("click", () => showScreen("screen-prefs"));

// ---------------- Confirmation modal (used before ANY route/preference/report change) ----------------

function confirmAction(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirmOverlay");
    document.getElementById("confirmTitle").textContent = message;
    overlay.hidden = false;
    const cleanup = (result) => {
      overlay.hidden = true;
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      resolve(result);
    };
    const okBtn = document.getElementById("confirmOk");
    const cancelBtn = document.getElementById("confirmCancel");
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}

// ---------------- Audio narration with real controls (not just an on/off toggle) ----------------

let lastSpokenText = "";
const audioBar = document.getElementById("audioBar");

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    alert("Voice reading isn't supported in this browser.");
    return;
  }
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
  if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
    window.speechSynthesis.pause();
    btn.textContent = "▶";
  } else if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    btn.textContent = "⏸";
  }
});
document.getElementById("audioReplay").addEventListener("click", () => speakText(lastSpokenText));
document.getElementById("audioStop").addEventListener("click", () => {
  window.speechSynthesis.cancel();
  audioBar.hidden = true;
});

// ---------------- Device profile (NO login — preferences just autosave, like the bus app's favourites) ----------------
//
// There is no account and no server-side user record to sign into. Everything
// that used to require login is now a small profile kept in this browser's
// localStorage, created silently the first time the app opens. If you want a
// clean slate, "Reset my saved preferences" in More options clears it.

const DEVICE_ID_KEY = "nexroute_device_id";
const PROFILE_KEY = "nexroute_profile";

function loadOrCreateProfile() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = "D" + Date.now() + Math.random().toString(36).slice(2, 8);
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  let profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
  if (!profile) {
    profile = {
      needs: { avoidStairs: true, sheltered: true, slowWalk: true, largeText: false, highContrast: false, games: false },
      favoriteRoute: { name: "Go to Outram Park (for SGH)" },
      familyLinkCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
  return { id: deviceId, ...profile };
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({
    needs: currentUser.needs, favoriteRoute: currentUser.favoriteRoute, familyLinkCode: currentUser.familyLinkCode,
  }));
}

function initHomeScreen() {
  document.getElementById("homeGreeting").textContent = "NexRoute";
  document.getElementById("btnGoRouteLabel").textContent = currentUser.favoriteRoute?.name || "Go to my saved route";
  document.getElementById("familyCode").textContent = currentUser.familyLinkCode || "——————";
  document.getElementById("btnOptionalGame").hidden = !(currentUser.needs && currentUser.needs.games);
  applyNeedsToUI(currentUser.needs || {});
}

document.getElementById("btnResetDevice").addEventListener("click", async () => {
  const ok = await confirmAction("Reset all your saved preferences on this device?");
  if (!ok) return;
  localStorage.removeItem(PROFILE_KEY);
  currentUser = loadOrCreateProfile();
  saveProfile();
  initHomeScreen();
  showScreen("screen-home", { replace: true });
});

function applyNeedsToUI(needs) {
  document.body.classList.toggle("high-contrast", Boolean(needs.highContrast));
  document.body.classList.toggle("large-text", Boolean(needs.largeText));
  document.getElementById("prefAvoidStairs").checked = Boolean(needs.avoidStairs);
  document.getElementById("prefSheltered").checked = Boolean(needs.sheltered);
  document.getElementById("prefSlowWalk").checked = Boolean(needs.slowWalk);
  document.getElementById("prefLargeText").checked = Boolean(needs.largeText);
  document.getElementById("prefHighContrast").checked = Boolean(needs.highContrast);
  document.getElementById("prefGames").checked = Boolean(needs.games);
}

// ---------------- Preferences (any save is confirmed — "she strictly does not like sudden changes") ----------------

document.getElementById("prefsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const ok = await confirmAction("Are you sure you want to save these changes to your preferences?");
  if (!ok) return;
  const needs = {
    avoidStairs: document.getElementById("prefAvoidStairs").checked,
    sheltered: document.getElementById("prefSheltered").checked,
    slowWalk: document.getElementById("prefSlowWalk").checked,
    largeText: document.getElementById("prefLargeText").checked,
    highContrast: document.getElementById("prefHighContrast").checked,
    games: document.getElementById("prefGames").checked,
  };
  currentUser.needs = needs;
  saveProfile();
  applyNeedsToUI(needs);
  document.getElementById("btnOptionalGame").hidden = !needs.games;
  const msg = document.getElementById("prefsSaved");
  msg.textContent = "Saved.";
  setTimeout(() => (msg.textContent = ""), 2500);
});

// ---------------- Home screen actions ----------------

document.getElementById("btnGoRoute").addEventListener("click", () => loadRoute());
document.getElementById("btnCheckSafe").addEventListener("click", () => loadLiftStatus());
document.getElementById("btnMore").addEventListener("click", () => showScreen("screen-more"));
document.querySelectorAll(".menu-item[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => showScreen(btn.dataset.goto));
});

document.getElementById("btnCallStaff").addEventListener("click", async () => {
  const ok = await confirmAction("Call MRT station staff now?");
  if (ok) window.location.href = "tel:+6567767888"; // SMRT passenger service line — replace with the correct live number before real deployment
});

// ---------------- Route screen ----------------

let leafletMap = null;

async function loadRoute() {
  showScreen("screen-route");
  const res = await fetch(`${API}/api/journey/mdmlim`);
  const data = await res.json();

  const banner = document.getElementById("disruptionBanner");
  if (data.disruption.affected) {
    banner.hidden = false;
    banner.innerHTML = `⚠️ ${data.disruption.message} <span class="badge ${data.disruption.source === "live" ? "live" : "demo"}">${data.disruption.source === "live" ? "LIVE" : "DEMO"}</span><br><small>Your saved route is unchanged — NexRoute never reroutes you without asking first.</small>`;
  } else {
    banner.hidden = true;
  }

  const legList = document.getElementById("legList");
  legList.innerHTML = "";
  data.journey.legs.forEach((leg, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="leg-num">${i + 1}.</span> <span>${leg.label} <em>(${leg.minutes} min)</em></span>`;
    legList.appendChild(li);
  });

  renderMap();
}

function renderMap() {
  if (!leafletMap) {
    leafletMap = L.map("routeMap", { zoomControl: false, attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(leafletMap);
  }
  fetch(`${API}/api/route/journey`)
    .then((r) => r.json())
    .then(({ source, segments }) => {
      leafletMap.eachLayer((l) => { if (l instanceof L.Marker || l instanceof L.Polyline) leafletMap.removeLayer(l); });
      const badge = document.getElementById("mapSource");
      badge.className = `badge ${source === "live" ? "live" : "demo"}`;
      badge.textContent = source === "live" ? "LIVE" : "DEMO";

      const all = [];
      segments.forEach((seg) => {
        const isRail = seg.type === "rail";
        // A straight-line fallback (OneMap unavailable) stays dashed so it is never mistaken for a real path.
        L.polyline(seg.coordinates, {
          color: isRail ? "#0E7C7B" : "#0F2A3D", weight: isRail ? 5 : 4,
          dashArray: seg.source === "live" ? (isRail ? null : "2 8") : "6 6",
        }).addTo(leafletMap).bindPopup(seg.label);
        all.push(...seg.coordinates);
      });
      const first = segments[0], last = segments[segments.length - 1];
      L.marker(first.coordinates[0]).addTo(leafletMap).bindPopup(first.label.split(" to ")[0]);
      L.marker(last.coordinates[last.coordinates.length - 1]).addTo(leafletMap).bindPopup(last.label.split(" to ")[1]);
      leafletMap.fitBounds(L.latLngBounds(all), { padding: [30, 30] });
    });
}

document.getElementById("btnNarrateRoute").addEventListener("click", () => {
  const text = Array.from(document.querySelectorAll("#legList li span:last-child")).map((el) => el.textContent).join(". ");
  speakText(text || "No route loaded yet.");
});

// ---------------- Optional game (opt-in, warns about battery in Preferences) ----------------

document.getElementById("btnOptionalGame").addEventListener("click", () => startMemoryGame());

function startMemoryGame() {
  const emojis = ["🚌", "🚇", "☂️", "🛗", "🚶", "🏥", "🚌", "🚇", "☂️", "🛗", "🚶", "🏥"];
  const cards = emojis.sort(() => Math.random() - 0.5);
  const win = document.createElement("div");
  win.className = "modal-overlay";
  win.innerHTML = `<div class="modal-card" style="max-width:340px;">
    <p>Memory match — find the pairs</p>
    <div id="gameGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;margin-bottom:1rem;"></div>
    <button class="secondary-btn" id="gameClose" type="button" style="width:100%;">Close game</button>
  </div>`;
  document.body.appendChild(win);
  const grid = win.querySelector("#gameGrid");
  let first = null, lock = false, matched = 0;
  cards.forEach((emoji, i) => {
    const cell = document.createElement("button");
    cell.textContent = "❓";
    cell.style.cssText = "font-size:1.6rem;padding:0.6rem 0;border-radius:8px;border:1px solid var(--line);background:#fff;";
    cell.addEventListener("click", () => {
      if (lock || cell.dataset.open) return;
      cell.textContent = emoji;
      cell.dataset.open = "1";
      if (!first) { first = { cell, emoji }; return; }
      lock = true;
      setTimeout(() => {
        if (first.emoji === emoji && first.cell !== cell) {
          matched += 2;
          if (matched === cards.length) win.querySelector("p").textContent = "You matched them all! 🎉";
        } else {
          first.cell.textContent = "❓"; first.cell.removeAttribute("data-open");
          cell.textContent = "❓"; cell.removeAttribute("data-open");
        }
        first = null; lock = false;
      }, 600);
    });
    grid.appendChild(cell);
  });
  win.querySelector("#gameClose").addEventListener("click", () => win.remove());
}

// ---------------- Lift status screen (today + tomorrow) ----------------

let lastLiftData = null;

async function loadLiftStatus() {
  showScreen("screen-lift");
  const res = await fetch(`${API}/api/lift-status/EW23`); // Outram Park — the destination that matters for this journey
  const data = await res.json();
  lastLiftData = data;

  const badge = `<span class="badge ${data.source === "live" ? "live" : "demo"}">${data.source === "live" ? "LIVE" : "DEMO"}</span>`;

  const todayEl = document.getElementById("liftBannerToday");
  todayEl.className = "status-banner " + (data.today.allLiftsWorking ? "ok" : "bad");
  todayEl.innerHTML = (data.today.allLiftsWorking ? "✅ ALL LIFTS WORKING" : "⚠️ A LIFT NEEDS ATTENTION") + " " + badge;

  const tomEl = document.getElementById("liftBannerTomorrow");
  tomEl.className = "status-banner " + (data.tomorrow.allLiftsWorking ? "ok" : "warn");
  tomEl.innerHTML = (data.tomorrow.allLiftsWorking ? "✅ ALL LIFTS EXPECTED WORKING" : "⚠️ WARNING: A LIFT WILL BE UNDER MAINTENANCE") + " " + badge;

  const detail = document.getElementById("liftDetailToday");
  let html = "<table><thead><tr><th>Exit</th><th>Lift?</th><th>Today</th><th>Tomorrow</th></tr></thead><tbody>";
  data.today.exits.forEach((e, i) => {
    const tmr = data.tomorrow.exits[i];
    html += `<tr><td>Exit ${e.exit}</td><td>${e.hasLift ? "Yes" : "No lift"}</td>
      <td>${e.hasLift ? (e.brokenToday ? "Out of service" : "Working") : "—"}</td>
      <td>${e.hasLift ? (tmr.brokenTomorrow ? "Will be out" : "Working") : "—"}</td></tr>`;
  });
  html += "</tbody></table>";
  detail.innerHTML = html;
}

document.getElementById("btnNarrateLift").addEventListener("click", () => {
  if (!lastLiftData) return;
  const text = `Today: ${lastLiftData.today.allLiftsWorking ? "all lifts are working." : "a lift needs attention."} Tomorrow: ${lastLiftData.tomorrow.allLiftsWorking ? "all lifts are expected to be working." : "a lift will be under maintenance."}`;
  speakText(text);
});

document.getElementById("btnSaveImage").addEventListener("click", () => {
  if (!lastLiftData) return;
  const canvas = document.getElementById("snapshotCanvas");
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#F6F5F0"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0F2A3D"; ctx.font = "bold 26px sans-serif"; ctx.fillText("NexRoute — Outram Park lift status", 24, 46);

  ctx.font = "bold 22px sans-serif";
  ctx.fillStyle = lastLiftData.today.allLiftsWorking ? "#1F7A4D" : "#B23B2A";
  ctx.fillText(lastLiftData.today.allLiftsWorking ? "TODAY: ALL LIFTS WORKING" : "TODAY: A LIFT NEEDS ATTENTION", 24, 100);

  ctx.fillStyle = lastLiftData.tomorrow.allLiftsWorking ? "#1F7A4D" : "#B9791F";
  ctx.fillText(lastLiftData.tomorrow.allLiftsWorking ? "TOMORROW: ALL LIFTS OK" : "TOMORROW: LIFT MAINTENANCE WARNING", 24, 140);

  ctx.fillStyle = "#191D1F"; ctx.font = "18px sans-serif";
  let y = 190;
  lastLiftData.today.exits.forEach((e, i) => {
    const tmr = lastLiftData.tomorrow.exits[i];
    ctx.fillText(`Exit ${e.exit}: ${e.hasLift ? (e.brokenToday ? "out of service today" : "working today") + (tmr.brokenTomorrow ? ", will be out tomorrow" : ", working tomorrow") : "no lift"}`, 24, y);
    y += 30;
  });
  ctx.font = "italic 15px sans-serif"; ctx.fillStyle = "#4B5259";
  ctx.fillText(`Saved ${new Date().toLocaleString()} · ${lastLiftData.source === "live" ? "Live LTA data" : "Demo data"}`, 24, y + 20);

  const link = document.createElement("a");
  link.download = "nexroute-lift-status.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// ---------------- Report a barrier (with verification workflow) ----------------

document.getElementById("reportForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const type = document.getElementById("reportType").value;
  const comment = document.getElementById("reportComment").value;
  const ok = await confirmAction(`Are you sure you want to report "${type}"? Staff will verify before other commuters are alerted.`);
  if (!ok) return;
  await fetch(`${API}/api/reports`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: currentUser.id, type, comment }),
  });
  document.getElementById("reportForm").reset();
  loadMyReports();
});

async function loadMyReports() {
  const res = await fetch(`${API}/api/reports`);
  const all = await res.json();
  const mine = all.filter((r) => r.userId === currentUser.id);
  const el = document.getElementById("myReports");
  el.innerHTML = mine.length
    ? mine.map((r) => `<div class="menu-item">${r.type} — <strong>${r.status}</strong><br><small>${r.comment || ""}</small></div>`).join("")
    : "<p>No reports yet.</p>";
}

async function refreshStaffPanel() {
  const panel = document.getElementById("staffPanel");
  const res = await fetch(`${API}/api/reports`);
  const all = await res.json();
  const pending = all.filter((r) => r.status === "pending");
  panel.innerHTML = pending.length
    ? pending.map((r) => `
        <div class="menu-item">
          ${r.type} — ${r.comment || ""}
          <div class="action-row">
            <button class="secondary-btn" data-verify="${r.id}" data-approve="true">Verify &amp; alert commuters</button>
            <button class="secondary-btn" data-verify="${r.id}" data-approve="false">Reject</button>
          </div>
        </div>`).join("")
    : "<p>No pending reports. (This panel simulates an LTA staff review queue — in production it would need its own authenticated login, not sit inside the commuter app.)</p>";
  panel.querySelectorAll("[data-verify]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await fetch(`${API}/api/reports/${btn.dataset.verify}/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve: btn.dataset.approve === "true" }),
      });
      refreshStaffPanel();
      loadMyReports();
    });
  });
}

document.getElementById("btnStaffDemo").addEventListener("click", () => {
  const panel = document.getElementById("staffPanel");
  panel.hidden = !panel.hidden;
  if (!panel.hidden) refreshStaffPanel();
});

// ---------------- Family mode ----------------

document.getElementById("btnCheckIn").addEventListener("click", async () => {
  const ok = await confirmAction("Check in now to let your family know you've arrived?");
  if (!ok) return;
  await fetch(`${API}/api/checkin/${currentUser.familyLinkCode}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "Arrived safely" }),
  });
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

// ---------------- Screen ↔ "More" list side effects ----------------

document.querySelector('[data-goto="screen-report"]').addEventListener("click", loadMyReports);

// ---------------- Boot: no login, no PIN — open straight into the app ----------------

currentUser = loadOrCreateProfile();
initHomeScreen();
showScreen("screen-home", { replace: true });
