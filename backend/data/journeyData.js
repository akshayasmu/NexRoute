// journeyData.js
//
// This models the ONE persona journey the app is built and demoed around,
// per PS2's instruction to "show a real journey working end to end for
// [one] person" rather than a generic router:
//
//   Mdm Lim — Bedok to Singapore General Hospital, fortnightly appointment.
//   Walks slowly, avoids stairs, needs lifts and sheltered walkways, will
//   not improvise a reroute on the platform, needs a day-before warning
//   about lifts/exits.
//
// Station/exit facts below (which exit has a lift, distance to the bus
// stop, shelter) are the kind of thing that in production comes from LTA's
// GeospatialWholeIsland layers (CoveredLinkWay, TrainStationExit) joined
// against v2/FacilitiesMaintenance for live lift status — see ltaClient.js.
// Hand-modelling one corridor here keeps the prototype runnable without
// that full GIS join being built yet; say so plainly in the write-up.

const journey = {
  personaName: "Mdm Lim",
  fromName: "Bedok",
  fromStationCode: "EW5",
  toName: "Outram Park (for SGH)",
  toStationCode: "EW23",
  legs: [
    { type: "walk", label: "Walk from home to Bedok MRT (Exit B)", minutes: 6, stepFree: true },
    { type: "rail", label: "EWL towards Tuas Link, board at Bedok", minutes: 24, line: "EWL" },
    { type: "walk", label: "Alight Outram Park, use Exit 4 lift to street level", minutes: 3, stepFree: true },
    { type: "walk", label: "Sheltered walkway to SGH main entrance", minutes: 8, stepFree: true, sheltered: true },
  ],
  totalMinutes: 41,
};

// Exit-level facts for the two stations in this corridor.
const exits = {
  EW5: [
    // Bedok
    { exit: "A", hasLift: true, distanceToPlatformM: 60, sheltered: true, crowdLevel: "medium" },
    { exit: "B", hasLift: true, distanceToPlatformM: 40, sheltered: true, crowdLevel: "low" },
  ],
  EW23: [
    // Outram Park
    { exit: "3", hasLift: false, distanceToPlatformM: 90, sheltered: false, crowdLevel: "high" },
    { exit: "4", hasLift: true, distanceToPlatformM: 70, sheltered: true, crowdLevel: "medium" },
    { exit: "6", hasLift: true, distanceToPlatformM: 130, sheltered: true, crowdLevel: "low" },
  ],
};

const stationCoords = {
  EW5: { name: "Bedok MRT", lat: 1.3239, lng: 103.9301 },
  EW23: { name: "Outram Park MRT", lat: 1.28, lng: 103.8395 },
};

// Endpoints of the two walking legs. HOME IS A PLACEHOLDER point a few
// hundred metres from Bedok MRT, not a real address; SGH is approximate.
const journeyPoints = {
  home: { name: "Home (placeholder)", lat: 1.3265, lng: 103.933 },
  sgh: { name: "Singapore General Hospital", lat: 1.2794, lng: 103.8357 },
};

module.exports = { journey, exits, stationCoords, journeyPoints };
