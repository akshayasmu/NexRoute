# NexRoute — now on Firestore (no external database)

Swapped Supabase (AWS-hosted) for Firestore (Google's own database), so the
entire stack — app and database both — runs on Google Cloud, per the rule:
"All project submissions must be hosted and running on Google Cloud."

## What changed from the Supabase version

| Before | Now |
|---|---|
| `lib/supabaseClient.js` | `lib/firestoreClient.js` |
| 3 Postgres tables (`reports`, `family_links`, `orchids`) | 3 Firestore collections, same names, same fields |
| Needed `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` env vars | **Needs no env vars at all** on Cloud Run — Firestore authenticates automatically using the service account Cloud Run already runs as |

Nothing else changed — same frontend, same LTA/OneMap/weather clients, same routes and URLs the app calls.

## One-time setup in Google Cloud Console

1. Search "Firestore" in the console → if you haven't used it in this project yet, click **Create Database** → choose **Native mode** → pick a region (e.g. `asia-southeast1`).
2. That's it — no connection string, no password, nothing to copy into an env var.

## IAM — only worth checking if you hit a permissions error

Cloud Run's default service account usually already has enough access (most fresh GCP projects grant it Editor). If a request to `/api/reports` etc. fails with a permissions error instead of working:
- Go to IAM & Admin → find the service account Cloud Run is using (shown on your Cloud Run service's "Security" tab)
- Grant it the **Cloud Datastore User** role (this covers Firestore)

## Local testing

Firestore itself needs no `.env` entry, but your own laptop isn't automatically authenticated the way Cloud Run is. Run this once:

```bash
gcloud auth application-default login
```

Then:
```bash
cp .env.example .env    # fill in LTA/OneMap values if you have them — Firestore needs nothing here
npm install
npm start                # http://localhost:8080
```

## Deploying

Same as before — push to GitHub, Cloud Run → Create Service → deploy from repo, Node.js buildpack, build context `/`, region `asia-southeast1`, allow unauthenticated invocations. The only difference from the Supabase deploy: you no longer need to add `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` to the environment variables — just `LTA_ACCOUNT_KEY` / `ONEMAP_EMAIL` / `ONEMAP_PASSWORD` if you have them.

## Your old Supabase data

Whatever test reports/check-ins/orchids you created in Supabase during testing don't carry over automatically — Firestore starts empty. That's fine; re-run the same curl tests from before to confirm it's working, they'll just create fresh rows in Firestore instead.
