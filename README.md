# NexRoute — By its people, for its people

An accessibility-first public transport companion built around one real,
end-to-end commute: **Mdm Lim**, travelling from Bedok to Singapore General
Hospital via Outram Park. She avoids stairs, needs working lifts, prefers
sheltered walkways, and does not want an app to reroute her mid-journey
without asking first.

**Live app:** https://nexroute-407309829440.asia-southeast1.run.app
**Write-up:** see [WRITEUP.md](./WRITEUP.md)
**Demo recording:**: https://drive.google.com/file/d/1WeNzJaQdIYC2MnIz2G-BtvnQXloyBPVe/view

---

## Prerequisites

- Node.js 18 or later
- npm
- A Google Cloud project with Firestore enabled (Native mode) — see Configuration below
- `gcloud` CLI, only if testing locally (not needed to just view the live link above)

## Install and run

```bash
git clone <this-repo-url>
cd NexRoute
npm install
cp .env.example .env
```

Fill in `.env` with your own keys (see Configuration below), then:

```bash
gcloud auth application-default login   # one-time, local testing only
npm start
```

Open **http://localhost:8080**.

## Configuration

All variable names are listed in `.env.example`, with no real values committed.

| Variable | Required? | Where to get it |
|---|---|---|
| `LTA_ACCOUNT_KEY` | Optional — app runs with DEMO data if unset | Free, instant registration at https://datamall.lta.gov.sg |
| `ONEMAP_EMAIL` / `ONEMAP_PASSWORD` | Optional — walking route falls back to a straight line if unset | Free, instant registration at https://www.onemap.gov.sg/apidocs/ |
| Firestore | **No env var needed** | Authenticates automatically via the Cloud Run service account in production. For local testing only, run `gcloud auth application-default login` once. |

The app clearly labels every data point as **LIVE** or **DEMO** depending on whether a key is set — nothing demo is ever presented as live.

## What to click

1. Open the app (live link above, or `localhost:8080`).
2. On the **Journey** tab, tap **"Check my journey now"** — this plans Mdm Lim's saved Bedok → Outram Park route, shows step-free/lift/shelter info per exit, and flags any live disruption on the East-West Line without auto-rerouting.
3. Tap **"Is my route safe?"** equivalent (lift status section) to see today vs. tomorrow's lift status — this is the day-ahead accessibility check.
4. Explore **Family & Help** (direct call to station staff, family check-in code) and **Rewards** (safety stamps, Kampung Trivia) as secondary features.

## Known limitations (see WRITEUP.md for full detail)

- Models one corridor for one persona, not general-purpose routing.
- Disruptions are detected and clearly explained, but the app deliberately does not auto-reroute — this is a persona-driven design decision, not a missing feature.
- Crowd density and weather API integrations are implemented and tested but not yet surfaced in the UI.