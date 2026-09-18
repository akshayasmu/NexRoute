// onemapClient.js
//
// OneMap (onemap.gov.sg) is Singapore's official map + routing service and
// sits on top of OpenStreetMap-derived data. This is the easiest path to a
// real "door to door, walking legs included" route (PS2 spec 3.2.1) without
// standing up your own OSRM/GraphHopper server.
//
// SETUP:
//   1. Register at https://www.onemap.gov.sg/apidocs/ (free)
//   2. You'll get an email + password; POST them to their /auth/post/getToken
//      endpoint to receive a bearer token (tokens expire — refresh periodically)
//   3. Put ONEMAP_EMAIL / ONEMAP_PASSWORD in backend/.env
//
// This client is intentionally small: it gets you a walking route (an array
// of [lat, lng] points) between two coordinates, which is exactly what the
// frontend's Leaflet map needs to draw the route on the required OSM base.
// The public transport routing mode (rail + bus) is the next thing to wire
// in once this is working — same auth, different `routeType`.

const cache = require("./cache");

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;
  if (!email || !password) throw new Error("ONEMAP_EMAIL / ONEMAP_PASSWORD not set");

  const res = await fetch("https://www.onemap.gov.sg/api/auth/post/getToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`OneMap auth responded ${res.status}`);
  const json = await res.json();
  cachedToken = json.access_token;
  // OneMap tokens are typically valid for 3 days; refresh a little early.
  tokenExpiresAt = Date.now() + 2.5 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

// routeType: "walk" | "pt" (public transport) | "drive" | "cycle"
async function getRoute(startLatLng, endLatLng, routeType = "walk") {
  const key = `onemapRoute:${routeType}:${startLatLng}:${endLatLng}`;
  return cache.cached(key, 5 * 60 * 1000, async () => {
    const token = await getToken();
    const url = new URL("https://www.onemap.gov.sg/api/public/routingsvc/route");
    url.searchParams.set("start", startLatLng);
    url.searchParams.set("end", endLatLng);
    url.searchParams.set("routeType", routeType);
    const res = await fetch(url, { headers: { Authorization: token } });
    if (!res.ok) throw new Error(`OneMap routing responded ${res.status}`);
    const json = await res.json();
    return { source: "live", ...json };
  });
}

module.exports = { getToken, getRoute };
