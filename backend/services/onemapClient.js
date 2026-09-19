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
// The "pt" routeType is used for the rail leg (see /api/route/journey in
// server.js); "walk" for the walking legs.

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

// OneMap's public-transport router needs a departure date/time (SG local).
function sgDateTime(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(now).map((p) => [p.type, p.value])
  );
  return { date: `${parts.month}-${parts.day}-${parts.year}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
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
    if (routeType === "pt") {
      const { date, time } = sgDateTime();
      url.searchParams.set("date", date);
      url.searchParams.set("time", time);
      url.searchParams.set("mode", "RAIL");
      url.searchParams.set("numItineraries", "1");
    }
    const res = await fetch(url, { headers: { Authorization: token } });
    if (!res.ok) throw new Error(`OneMap routing responded ${res.status}`);
    const json = await res.json();
    return { source: "live", ...json };
  });
}

// OneMap returns geometry as Google-encoded polylines (precision 5).
function decodePolyline(encoded) {
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    for (const axis of ["lat", "lng"]) {
      let shift = 0, result = 0, byte;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === "lat") lat += delta; else lng += delta;
    }
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

// [lat, lng] pairs for the route getRoute() returned, ready for L.polyline.
// walk -> route_geometry; pt -> legGeometry of every leg in the first itinerary.
function routeCoordinates(route, routeType = "walk") {
  if (routeType === "pt") {
    const legs = route.plan?.itineraries?.[0]?.legs || [];
    return legs.flatMap((leg) => decodePolyline(leg.legGeometry?.points || ""));
  }
  return decodePolyline(route.route_geometry || "");
}

module.exports = { getToken, getRoute, routeCoordinates };
