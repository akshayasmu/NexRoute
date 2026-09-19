# NexRoute — By its people, for its people

A commuter companion built around **one real journey for one real persona**:
**Mdm Lim**, Bedok → Singapore General Hospital, fortnightly appointment. She
walks slowly, avoids stairs, needs lifts and shelter, will not improvise a
reroute on the platform, and needs to know the day before if a lift is going
to be out.

## Running it

```bash
cd backend
npm install
cp .env.example .env      # then read the next section before filling it in
npm start
```

Open **http://localhost:3000** on your phone (same wifi) or in a mobile
browser's device-emulation mode. The backend serves the frontend too.

**The app runs with zero keys filled in.** Every screen that depends on a
live feed shows a small **DEMO** badge instead of **LIVE** when a key is
missing, and falls back to a labelled stand-in value — it never pretends
demo data is live. Filling in a key flips that screen to LIVE with no other
code changes.

---

## Steps to actually get live data (do these in order)

1. **Register for an LTA DataMall AccountKey** — https://datamall.lta.gov.sg
   → sign up → verify your email → the account key lands in your inbox.
   This is instant and free. Paste it into `backend/.env` as
   `LTA_ACCOUNT_KEY=...`. This alone lights up: train service alerts,
   station crowding (real-time + forecast), bus arrival, lift/escalator
   maintenance, planned bus routes.
2. **Register for OneMap** — https://www.onemap.gov.sg/apidocs/ → sign up
   with an email + password (not an API key — you POST those credentials to
   get a token, which `backend/services/onemapClient.js` already does for
   you). Put the email/password into `.env`. This lights up the walking
   route drawn on the map.
3. **Weather needs nothing** — `backend/services/weatherClient.js` calls
   data.gov.sg directly, no registration at all. It's only showing DEMO in
   this sandbox because outbound network here is restricted to a fixed
   domain allowlist that doesn't include `api-open.data.gov.sg`; it will
   call live the moment you run this on a normal machine with internet.
4. **Test each endpoint yourself before wiring up UI for it** — e.g.
   `curl -H "AccountKey: YOUR_KEY" https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts`
   — so you know what a *real* response looks like (the shapes in
   `LTA_DataMall_API_User_Guide.pdf` are correct but seeing a live payload
   catches surprises early, e.g. `AffectedSegments` being empty on a normal
   day).
5. **Everything funnels through `backend/services/*Client.js`.** If you add
   another endpoint (e.g. `v3/BusArrival` for a specific stop your route
   uses), add one function there, following the pattern already used —
   cache with a TTL matching the documented refresh rate, try the live
   call, fall back to a `data/demoFallbacks.js` fixture on failure, always
   keep the `source` field.

### What's already wired to real endpoints vs. what's a scaffold

| Endpoint | Status in this build |
|---|---|
| `TrainServiceAlerts` | Real client written and called (`ltaClient.getTrainServiceAlerts`) — goes live the moment `LTA_ACCOUNT_KEY` is set |
| `v2/FacilitiesMaintenance` | Real client written, drives the day-ahead lift warning |
| `PCDRealTime` / `PCDForecast` | Real client written (`getCrowdRealTime`/`getCrowdForecast`), not yet surfaced in a UI screen — next thing to add |
| `v3/BusArrival` | Real client written, not yet surfaced in UI |
| `BusServices` / `BusRoutes` / `BusStops` | Real client written, unused so far — needed once routing covers more than one corridor |
| `PlannedBusRoutes` | Real client written, unused so far |
| `PV/Train`, `PV/Bus`, `PV/ODTrain`, `PV/ODBus` | Real client written; these return a **CSV download link**, not inline rows — you'll need to fetch and parse the CSV, not just JSON.parse the response |
| data.gov.sg weather | Real client, live given normal internet access |
| OneMap routing | Real client written and wired into `/api/route/walk`; needs your OneMap credentials to stop showing a straight-line demo path |
| **Full multimodal, whole-network routing (OSRM/GraphHopper on the OSM Singapore extract)** | **Not built.** This prototype hand-models the one Bedok↔Outram Park corridor (`backend/data/journeyData.js`). PS2's rubric treats general route planning as mandatory — this is the biggest remaining piece of work. See "What's missing before this is submission-ready" below. |

---

## What's missing before this is submission-ready for PS2

Be honest about this in your write-up — the rubric explicitly caps a
criterion for "a feature shown in the pitch but absent from the running
system":

- **A real routing engine.** Right now there's one hard-coded corridor.
  Fastest realistic path: use OneMap's `/api/public/routingsvc/route` with
  `routeType=pt` for the rail/bus legs (already partly wired for `walk`),
  rather than standing up your own OSRM. Good enough to satisfy "door to
  door, multi-modal" without a weekend spent on routing-engine ops.
- **The OSM map is a straight line + two markers right now**, not an actual
  street/rail-aligned route. Once OneMap's `pt` routing is wired in, feed
  its returned geometry into the existing Leaflet polyline instead of the
  two-point line in `renderMap()` in `app.js`.
- **Crowd density (PCDRealTime/PCDForecast) has a working backend client
  but no screen.** Given Mdm Lim's persona, the highest-value place to add
  it is the lift-status screen: show forecast crowding at Outram Park
  alongside lift status, since a working lift in a packed corridor is still
  a bad ride for her.
- **Only one persona/corridor is modelled.** That's a legitimate scope
  choice per the brief ("you do not need to serve all three personas") —
  just say so plainly rather than implying broader coverage.

---

## What changed from the first draft, and why

Everything below came from direct feedback:

| Feedback | What changed |
|---|---|
| Rename to NexRoute | Done throughout |
| Bigger font, less clutter | Baseline font size raised app-wide (not an opt-in mode); the home screen is now 3 buttons, not a 6-tab bar |
| "Find a way to insert API" | `backend/services/ltaClient.js`, `weatherClient.js`, `onemapClient.js` — real integration layer, see steps above |
| "Ask it to do first" | Home screen leads with the three highest-value actions (go to saved route / check lift safety / call staff) instead of a menu of everything |
| Login + registered needs profile | **Removed on feedback** — there's no sign-in at all now. Preferences autosave to this browser's `localStorage` the moment you change them, the same pattern as the SG bus app's saved favourites. "Reset my saved preferences" in More options clears it. Reports and family check-ins use a random local device id generated once, never a name/password |
| Audio control, not just on/off | Bottom audio bar with play/pause/replay/stop, plus a speaking-speed slider in Preferences |
| Day-before lift warning + save as image | `/api/lift-status/:stationCode` filters `FacilitiesMaintenance` by date window for **today vs. tomorrow**; "Save as image" renders a canvas snapshot and downloads a PNG |
| Games optional, battery warning | Off by default; toggled in Preferences with a battery note; only then does a "Play while you wait" button appear |
| Voice input de-prioritised | No mic button on the main flow; everything is button-first. (Removed entirely rather than kept "for the brave" — self-consciousness in public was the stated reason, and a hidden feature nobody uses isn't worth the complexity) |
| Verified reporting | Reports start as `pending` and only a (clearly labelled, demo-only) staff panel can flip them to `verified`/`rejected`; nothing alerts other commuters until that happens |
| Chatbot → direct line to staff | Typing chat was removed from the main flow; "Call station staff" is a one-tap `tel:` link with a confirmation step |
| Never reroute without asking | `/api/journey/mdmlim` always returns `rerouteSuggested: false` — a disruption is shown as a flag to review, never an automatic change |
| No pop-up ads | None exist; the only overlay in the whole app is the confirmation dialog, and it only ever appears after the person taps something that changes state |
| Confirm before any state change | A shared `confirmAction()` modal gates: logging out, saving preferences, submitting a report, calling staff, checking in for family mode |
| Family mode | Each account gets a share code; a family member enters it to see only a last-check-in label and time — never live location, and only after the user explicitly taps "I've arrived" |

## Second round of changes (UI restyle + Improvements II)

| Feedback | What changed |
|---|---|
| "UI looks 100% AI generated, want the earlier look back" | Restyled around the metro-line route cards, teal/navy palette, and tabbed navigation from the first prototype — the flat giant-button layout is gone |
| Safety stamps → free Kopi-O-Kosong | Rewards tab: 10 stamps (tapped after a safe journey) unlocks a mock voucher code. Entirely local (localStorage) — not a real loyalty backend |
| Virtual orchid to thank another commuter | A tiny peer-to-peer feature: `/api/orchids/:code` lets anyone with a NexRoute code receive a thank-you note. No accounts involved, just codes |
| Kampung Trivia game | Replaces the memory-match game; five questions about old Bedok/Outram Park history and kopitiam culture, still gated behind the "optional games" toggle (battery note kept) |
| "Keep the Plan Your Journey interface, it looked good" | Restored as the Journey tab: route card with a suitability score, leg pills, stats grid, disruption banner |
| Exit/crowd guide overwhelming | Now a collapsed `<details>` panel that only appears (and only loads) after "Check my journey now" is pressed |
| Saved trips without login, available offline | Routines tab is pure `localStorage`, no server round-trip at all. Journey/lift-status responses are also cached client-side; if a fetch fails, the last-known data is shown with an "Offline — showing saved data" banner instead of a blank screen |
| Chatbot → family mode + direct number | No chatbot anywhere now. "Family & Help" tab has the call-staff button front and center, plus family check-in |
| "Can we do a feature without APIs for now?" | EZ-Link is shown as a labelled concept card with a fake balance — there's no public EZ-Link developer API today, so this is honestly a mock-up, not a real integration. Toilets are "manual" data (badge says so) since no LTA/OneMap layer covers this |
| Nearest accessible toilets | Small manually-compiled list near Outram Park, shown in the same progressive-disclosure panel as the exit guide |
| "A mode for each age group" | Preferences now has Youth / Adult / Senior as a single tap that sets sensible defaults (Senior turns on large text), with the individual toggles (stairs, shelter, contrast, etc.) still available underneath for fine-tuning |



- Accounts are `name + 4-digit PIN`, held in memory only — this resets on
  every server restart. That's fine for a hackathon demo; say plainly in
  your write-up that production needs real auth and a real database.
- Family check-ins store a short text label and a timestamp, keyed to a
  random share code — no GPS, no continuous tracking, and nothing is
  recorded unless the user taps "check in" themselves.
- No credentials are committed — `.env` is git-ignored; only
  `.env.example` (with blank values) is in the repo.

## Project structure

```
nexroute/
├── backend/
│   ├── server.js                # routes: auth, live data pass-through, lift-status, journey, reports, family
│   ├── .env.example
│   └── services/
│       ├── ltaClient.js         # every LTA DataMall endpoint asked for, cached, demo-fallback
│       ├── weatherClient.js     # data.gov.sg, live with zero setup
│       ├── onemapClient.js      # OSM-based walking route for the map
│       ├── canonicalLines.js    # the line-code mapping table the brief warns you'll need
│       └── cache.js
│   └── data/
│       ├── journeyData.js       # the one modelled corridor (Bedok ↔ Outram Park)
│       └── demoFallbacks.js     # every stand-in value, all labelled `source: "demo"`
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```
