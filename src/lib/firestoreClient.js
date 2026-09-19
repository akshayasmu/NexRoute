// firestoreClient.js
//
// Replaces Supabase. On Cloud Run, this needs ZERO environment variables —
// the Firestore SDK automatically authenticates using the service account
// Cloud Run already runs as (Application Default Credentials). That
// service account needs the "Cloud Datastore User" (or "Firestore User")
// IAM role — most default Cloud Run service accounts already have this via
// the project's default Editor role, but check if you hit permission errors.
//
// For LOCAL testing only, you need to authenticate your own machine once:
//   gcloud auth application-default login
// (or set GOOGLE_APPLICATION_CREDENTIALS to a downloaded service account
// JSON key — the login command above is simpler for a laptop.)

const { Firestore } = require("@google-cloud/firestore");

let db = null;
function getDb() {
  if (!db) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
    // On Cloud Run, projectId resolves automatically with no env var needed.
    // Locally, `gcloud auth application-default login` gives credentials but
    // not a project, so GOOGLE_CLOUD_PROJECT in .env fills that gap.
    db = projectId ? new Firestore({ projectId }) : new Firestore();
  }
  return db;
}

module.exports = { getDb };