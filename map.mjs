import { buildTraffic, formatTime } from './traffic.mjs';

const labData = 'https://dsc106.com/labs/lab07/data/';
const archivedData = 'https://dsc-courses.github.io/dsc106-2025-sp/labs/lab07/data/';
const routes = [
  {
    id: 'boston',
    url: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
    fallback: 'https://services.arcgis.com/sFnw0xNflSi8J0uh/arcgis/rest/services/Existing_Bike_Network_2022/FeatureServer/2/query?where=1%3D1&outFields=OBJECTID&outSR=4326&f=geojson',
  },
  {
    id: 'cambridge',
    url: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  },
];
const d3 = window.d3;
const time = document.querySelector('#time');
const selectedTime = document.querySelector('#selected-time');
const status = document.querySelector('#status');
const tooltip = document.querySelector('#tooltip');
const frame = document.querySelector('.map-frame');
const publicToken = document.querySelector('meta[name="mapbox-token"]').content.trim();

async function loadMap() {
  const useMapbox = publicToken.startsWith('pk.');
  const files = useMapbox
    ? 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl'
    : 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl';
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = files + '.css';
  document.head.append(css);
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = files + '.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('The map library could not load.'));
    document.head.append(script);
  });
  const engine = useMapbox ? window.mapboxgl : window.maplibregl;
  const map = new engine.Map({
    container: 'map',
    style: useMapbox ? 'mapbox://styles/mapbox/light-v11' : 'https://tiles.openfreemap.org/styles/positron',
    ...(useMapbox ? { accessToken: publicToken } : {}),
    center: [-71.09415, 42.36027],
    zoom: 12,
    minZoom: 5,
    maxZoom: 18,
  });
  map.addControl(new engine.NavigationControl(), 'top-right');
  return map;
}

function labFile(loader, filename) {
  return loader(labData + filename).catch(() => loader(archivedData + filename));
}

async function addRoute(map, route) {
  const data = await d3.json(route.url).catch((error) => {
    if (!route.fallback) throw error;
    return d3.json(route.fallback);
  });
  if (data.type !== 'FeatureCollection') throw new Error('Invalid route data');
  map.addSource(route.id, { type: 'geojson', data });
  map.addLayer({
    id: route.id + '-routes',
    type: 'line',
    source: route.id,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#23865d', 'line-width': 2.4, 'line-opacity': 0.62 },
  });
}

function showTooltip(station, x, y) {
  const title = document.createElement('strong');
  title.textContent = station.name;
  const count = new Intl.NumberFormat();
  const description = count.format(station.total) + ' total · ' +
    count.format(station.departures) + ' departures · ' + count.format(station.arrivals) + ' arrivals';
  tooltip.replaceChildren(title, document.createTextNode(description));
  tooltip.hidden = false;
  tooltip.style.left = Math.max(6, Math.min(x + 14, frame.clientWidth - tooltip.offsetWidth - 8)) + 'px';
  tooltip.style.top = Math.max(6, Math.min(y + 14, frame.clientHeight - tooltip.offsetHeight - 8)) + 'px';
}

function renderStations(map, stations, trips) {
  const trafficAt = buildTraffic(stations, trips);
  const svg = d3.select('#stations');
  const flow = d3.scaleQuantize([0, 1], ['var(--arrivals)', 'var(--balanced)', 'var(--departures)']);
  let circles = svg.selectAll('circle');

  function positionCircles() {
    circles.each(function (station) {
      const { x, y } = map.project([station.longitude, station.latitude]);
      this.setAttribute('cx', x);
      this.setAttribute('cy', y);
    });
  }

  function update() {
    const minute = Number(time.value);
    selectedTime.value = formatTime(minute);
    time.setAttribute('aria-valuetext', selectedTime.value);
    const traffic = trafficAt(minute).filter((station) => station.total > 0);
    traffic.sort((a, b) => b.total - a.total);
    const radius = d3.scaleSqrt([0, d3.max(traffic, (station) => station.total) || 1], [0, minute === -1 ? 21 : 15]);
    tooltip.hidden = true;
    circles = svg.selectAll('circle').data(traffic, (station) => station.id).join('circle')
      .attr('r', (station) => radius(station.total))
      .attr('fill', (station) => flow(station.departures / station.total))
      .attr('tabindex', 0)
      .attr('aria-label', (station) =>
        station.name + ': ' + station.departures + ' departures and ' + station.arrivals + ' arrivals')
      .on('pointermove', (event, station) => {
        const bounds = frame.getBoundingClientRect();
        showTooltip(station, event.clientX - bounds.left, event.clientY - bounds.top);
      })
      .on('pointerleave blur', () => { tooltip.hidden = true; })
      .on('focus', function (event, station) {
        showTooltip(station, Number(this.getAttribute('cx')), Number(this.getAttribute('cy')));
      })
      .on('click', function (event, station) {
        showTooltip(station, Number(this.getAttribute('cx')), Number(this.getAttribute('cy')));
      });
    positionCircles();
  }

  let pendingFrame;
  time.addEventListener('input', () => {
    cancelAnimationFrame(pendingFrame);
    pendingFrame = requestAnimationFrame(update);
  });
  map.on('move', () => {
    tooltip.hidden = true;
    positionCircles();
  });
  map.on('resize', positionCircles);
  update();
  time.disabled = false;
}

async function start() {
  if (!d3) throw new Error('D3 could not load.');
  const dataPromise = Promise.all([
    labFile(d3.json, 'bluebikes-stations.json'),
    labFile(d3.csv, 'bluebikes-traffic-2024-03.csv'),
  ]);
  const map = await loadMap();
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('The basemap could not load.')), 20000);
    map.once('load', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  const routeResultsPromise = ready.then(() => Promise.allSettled(routes.map((route) => addRoute(map, route))));
  const [[stationsFile, trips]] = await Promise.all([dataPromise, ready]);
  const stations = (stationsFile.data?.stations ?? stationsFile)
    .map((station) => ({
      id: station.short_name ?? station.Number,
      name: station.name ?? station.NAME,
      longitude: Number(station.lon ?? station.Long),
      latitude: Number(station.lat ?? station.Lat),
    }))
    .filter((station) => station.id && Number.isFinite(station.longitude) && Number.isFinite(station.latitude));
  if (!stations.length || !trips.length) throw new Error('The Bluebikes files contained no usable data.');
  renderStations(map, stations, trips);
  status.hidden = true;
  const routeResults = await routeResultsPromise;
  const unavailable = routes.filter((route, index) => routeResults[index].status === 'rejected');
  if (unavailable.length) {
    status.textContent = 'Bike route data unavailable for ' + unavailable.map((route) => route.id).join(' and ') + '.';
    status.hidden = false;
  }
}

start().catch((error) => {
  status.textContent = 'Unable to load the visualization. ' + error.message;
  status.hidden = false;
});
