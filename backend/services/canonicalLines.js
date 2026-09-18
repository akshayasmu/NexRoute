// canonicalLines.js
// LTA exposes the same physical MRT/LRT line under different codes depending
// on which endpoint you call (see LTA_DataMall_API_User_Guide.pdf + PS2 brief,
// section 2.4, "A trap: line codes are not consistent across endpoints").
//
// Build one canonical table and map everything through it, rather than
// hard-coding a line code per feature.

const CANONICAL_LINES = [
  { canonical: "NSL", name: "North South Line", trainServiceAlerts: "NSL", crowdDensity: "NSL" },
  { canonical: "EWL", name: "East West Line", trainServiceAlerts: "EWL", crowdDensity: "EWL" },
  { canonical: "CGL", name: "Changi Extension", trainServiceAlerts: "EWL", crowdDensity: "CGL" }, // folded into EWL in TrainServiceAlerts
  { canonical: "CCL", name: "Circle Line", trainServiceAlerts: "CCL", crowdDensity: "CCL" },
  { canonical: "CEL", name: "Circle Line Extension", trainServiceAlerts: "CCL", crowdDensity: "CEL" }, // folded into CCL in TrainServiceAlerts
  { canonical: "NEL", name: "North East Line", trainServiceAlerts: "NEL", crowdDensity: "NEL" },
  { canonical: "DTL", name: "Downtown Line", trainServiceAlerts: "DTL", crowdDensity: "DTL" },
  { canonical: "TEL", name: "Thomson-East Coast Line", trainServiceAlerts: "TEL", crowdDensity: "TEL" },
  { canonical: "BPLRT", name: "Bukit Panjang LRT", trainServiceAlerts: "BPL", crowdDensity: "BPL" },
  { canonical: "SLRT", name: "Sengkang LRT", trainServiceAlerts: "STL", crowdDensity: "SLRT" },
  { canonical: "PLRT", name: "Punggol LRT", trainServiceAlerts: "PTL", crowdDensity: "PLRT" },
];

function toTrainServiceAlertsCode(canonical) {
  const row = CANONICAL_LINES.find((l) => l.canonical === canonical);
  return row ? row.trainServiceAlerts : canonical;
}

function toCrowdDensityCode(canonical) {
  const row = CANONICAL_LINES.find((l) => l.canonical === canonical);
  return row ? row.crowdDensity : canonical;
}

module.exports = { CANONICAL_LINES, toTrainServiceAlertsCode, toCrowdDensityCode };
