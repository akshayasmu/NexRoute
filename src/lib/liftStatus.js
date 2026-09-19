// liftStatus.js — shared by api/lift-status/[stationCode].js and api/journey/mdmlim.js
const lta = require("./ltaClient");
const { exits } = require("./journeyData");

async function computeLiftStatus(stationCode) {
  const stationExits = exits[stationCode];
  if (!stationExits) return null;

  const maintenance = await lta.getFacilitiesMaintenance();
  const rows = maintenance.value || [];
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);

  function maintenanceCovering(exitLabel, date) {
    return rows.find((m) => m.ExitCode && m.ExitCode.includes(exitLabel) && m.StartDate <= date && date <= m.EndDate);
  }

  const todayStatus = stationExits.map((e) => ({ ...e, brokenToday: Boolean(maintenanceCovering(e.exit, today)) }));
  const tomorrowStatus = stationExits.map((e) => ({ ...e, brokenTomorrow: Boolean(maintenanceCovering(e.exit, tomorrow)) }));

  const allOkToday = todayStatus.every((e) => !e.hasLift || !e.brokenToday);
  const allOkTomorrow = tomorrowStatus.every((e) => !e.hasLift || !e.brokenTomorrow);

  return {
    source: maintenance.source,
    stationCode,
    today: { allLiftsWorking: allOkToday, exits: todayStatus },
    tomorrow: { allLiftsWorking: allOkTomorrow, exits: tomorrowStatus },
  };
}

module.exports = { computeLiftStatus };
