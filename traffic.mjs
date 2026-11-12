const minutesPerDay = 1440;
const halfWindow = 60;

function minuteOfDay(timestamp) {
  const clock = /[T ]([0-2]\d):([0-5]\d)/.exec(timestamp ?? '');
  if (!clock || Number(clock[1]) >= 24) return -1;
  return Number(clock[1]) * 60 + Number(clock[2]);
}

export function buildTraffic(stations, trips) {
  const stationIndex = new Map(stations.map((station, index) => [station.id, index]));
  const width = stations.length;
  const makeCounts = () => ({
    daily: new Uint32Array(width),
    byMinute: new Uint32Array(width * minutesPerDay),
  });
  const arrivals = makeCounts();
  const departures = makeCounts();

  function countEvent(counts, stationId, timestamp) {
    const station = stationIndex.get(stationId);
    if (station === undefined) return;
    counts.daily[station] += 1;
    const minute = minuteOfDay(timestamp);
    if (minute >= 0) counts.byMinute[minute * width + station] += 1;
  }

  for (const trip of trips) {
    countEvent(departures, trip.start_station_id, trip.started_at);
    countEvent(arrivals, trip.end_station_id, trip.ended_at);
  }

  function windowCounts(counts, minute) {
    if (minute === -1) return counts.daily;
    const totals = new Uint32Array(width);
    for (let offset = -halfWindow; offset <= halfWindow; offset += 1) {
      const start = ((minute + offset + minutesPerDay) % minutesPerDay) * width;
      for (let index = 0; index < width; index += 1) {
        totals[index] += counts.byMinute[start + index];
      }
    }
    return totals;
  }

  return function trafficAt(minute) {
    const arrivalCounts = windowCounts(arrivals, minute);
    const departureCounts = windowCounts(departures, minute);
    return stations.map((station, index) => ({
      ...station,
      arrivals: arrivalCounts[index],
      departures: departureCounts[index],
      total: arrivalCounts[index] + departureCounts[index],
    }));
  };
}

export function formatTime(minute) {
  if (minute === -1) return 'Any time';
  const hours = Math.floor(minute / 60);
  const minutes = String(minute % 60).padStart(2, '0');
  return (hours % 12 || 12) + ':' + minutes + (hours < 12 ? ' AM' : ' PM');
}
