# Bikewatching

DSC 106 Lab 7 · Bluebikes rides in Boston and Cambridge, March 2024.

## Run and publish

- **Published map:** https://dangitmac.github.io/bikewatching/
- GitHub Actions builds the site on pushes to `main`. The `MAPBOX_PUBLIC_TOKEN` repository variable supplies the browser's public Mapbox token.
- For local development, serve this directory with VS Code Live Server or `python3 -m http.server 8000`. You can use the built-in MapLibre preview or replace the token placeholder in your local copy of `index.html` to use Mapbox.

## One-minute video outline

- **0–10 s.** Introduce the Bluebikes map, the two cities and March 2024 data.
- **10–45 s.** Pan and zoom. Point out the green bike routes. Hover over a station to show exact counts, then move the slider to a morning or evening time and show the change in circle size and color. Explain what the three legend colors mean.
- **45–60 s.** Share a finding you can see or something you learned. One option is to explain how counting arrivals and departures separately helps show where bikes are accumulating at different hours.

The course asks for a narrated MP4 of one minute or less. See the [Lab 7 instructions](https://dsc106.com/labs/lab07/#submission).
