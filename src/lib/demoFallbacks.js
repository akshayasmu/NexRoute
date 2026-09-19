// demoFallbacks.js
//
// IMPORTANT — read this before you demo the app:
// Every value here is a small, hand-written STAND-IN, used only when
// LTA_ACCOUNT_KEY is missing from .env or a live call fails (e.g. no network
// during development). It exists so the app is runnable and presentable
// before you've registered for a key, per PS2_README section 2.6:
// "do not build a demo that depends on a real disruption occurring during
// judging... you may demonstrate the major-disruption path by replay or
// injected test data provided it is labelled as such."
//
// Every object below carries `source: "demo"` for this reason, and
// ltaClient.js / server.js must never strip that field before it reaches
// the UI. The UI shows a visible "DEMO DATA" badge whenever source is
// "demo" rather than "live" — do not remove that badge for a submission.

const demoTrainServiceAlerts = {
  source: "demo",
  Status: 2,
  AffectedSegments: [
    {
      Line: "EWL",
      Direction: "Towards Pasir Ris",
      Stations: "EW23,EW24,EW25",
      FreePublicBus: "Outram Park, Tiong Bahru",
      FreeMRTShuttle: "NA",
      MRTShuttleDirection: "NA",
    },
  ],
  Message: [
    {
      Content: "[DEMO] EWL: Train service between Outram Park and Tiong Bahru is disrupted. Free bus service is available.",
      CreatedDate: new Date().toISOString(),
    },
  ],
};

const demoPCDRealTime = {
  source: "demo",
  value: [
    { Station: "EW16", StartTime: new Date().toISOString(), EndTime: new Date().toISOString(), CrowdLevel: "l" },
    { Station: "EW23", StartTime: new Date().toISOString(), EndTime: new Date().toISOString(), CrowdLevel: "h" },
  ],
};

const demoPCDForecast = {
  source: "demo",
  value: [
    { Station: "EW16", StartTime: "07:30", EndTime: "08:00", CrowdLevel: "m" },
    { Station: "EW16", StartTime: "08:00", EndTime: "08:30", CrowdLevel: "h" },
    { Station: "EW23", StartTime: "08:00", EndTime: "08:30", CrowdLevel: "l" },
  ],
};

const demoBusArrival = {
  source: "demo",
  BusStopCode: "83139",
  Services: [
    {
      ServiceNo: "858",
      NextBus: { EstimatedArrival: new Date(Date.now() + 5 * 60000).toISOString(), Load: "SEA", Feature: "WAB", Type: "SD" },
      NextBus2: { EstimatedArrival: new Date(Date.now() + 14 * 60000).toISOString(), Load: "LSD", Feature: "", Type: "DD" },
    },
  ],
};

const demoFacilitiesMaintenance = {
  source: "demo",
  value: [
    {
      // Deliberately scheduled for TOMORROW, not today — this is the
      // fixture that demonstrates the "warn the day before" requirement:
      // today's status is clean, tomorrow's isn't.
      StationCode: "EW23",
      StationName: "Outram Park",
      LiftID: "L03",
      ExitCode: "Exit 6",
      Description: "[DEMO] Scheduled lift maintenance at Exit 6, Outram Park.",
      StartDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10),
      EndDate: new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 10),
    },
  ],
};

const demoPlannedBusRoutes = {
  source: "demo",
  value: [
    { ServiceNo: "858", Operator: "SBST", EffectiveDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10), Description: "[DEMO] Minor routing change near Bedok Interchange." },
  ],
};

const demoBusServices = {
  source: "demo",
  value: [{ ServiceNo: "858", Operator: "SBST", Direction: 1, Category: "TRUNK", OriginCode: "83139", DestinationCode: "84009" }],
};

const demoBusRoutes = {
  source: "demo",
  value: [{ ServiceNo: "858", Direction: 1, StopSequence: 1, BusStopCode: "83139", Distance: 0.0 }],
};

const demoBusStops = {
  source: "demo",
  value: [{ BusStopCode: "83139", RoadName: "Bedok Nth St 3", Description: "Bedok Int", Latitude: 1.3238, Longitude: 103.9301 }],
};

const demoPassengerVolume = (label) => ({
  source: "demo",
  note: `[DEMO] ${label} — real endpoint returns a monthly CSV download link, not inline JSON.`,
  value: [],
});

module.exports = {
  demoTrainServiceAlerts,
  demoPCDRealTime,
  demoPCDForecast,
  demoBusArrival,
  demoFacilitiesMaintenance,
  demoPlannedBusRoutes,
  demoBusServices,
  demoBusRoutes,
  demoBusStops,
  demoPassengerVolume,
};
