# Surrey ArcGIS public-data proof

A public-data technical proof by ParalleX Labs Inc. It shows City of Surrey development applications as schematic 3D extrusions using the ArcGIS Maps SDK for JavaScript (`@arcgis/core`, SceneView), OpenStreetMap tiles and local snapshot files.

This is **not** a City of Surrey system. It has no connection to the City's ArcGIS Online, uses no City credentials, and does not claim any completed City work. All heights are schematic estimates, never approved heights.

## What the proof shows

1. **Source to model:** Project 19-0234-00 (OBJECTID 207) has a public description stating 43 storeys. The estimate rule is extracted storeys × 3 m, giving 129 m. Records with no storey count get a labelled 12 m illustrative fallback.
2. **Illustrative asset:** One schematic podium-and-tower object sits at the showcase project's snapshot assigned representative point (see below): 15 m podium plus 114 m tower, 129 m overall. Its height is fixed and is not changed by the demonstration corrections. It is conspicuously labelled illustrative, is not an approved building design, and its placement is not a City design location.
3. **Attribute correction:** The local demonstration file `updates/v2.json` sets the showcase estimate to 135 m. The page shows a before/after diff (129 m → 135 m) and updates the 3D scene. Source facts are not changed and nothing is written to any service.
4. **Exact rollback:** `updates/v1.json` replays the unchanged baseline exactly, showing 135 m → 129 m. Every version is applied to the immutable baseline.
5. **Accessibility:** A keyboard-operable list holds the same facts as the popups for all 119 projects. It still works when WebGL is unavailable.

## Data and provenance

Snapshot files are copied unchanged into `public/data/`, and their provenance is recorded in `public/data/SOURCES.json`:

- `development_projects.geojson` holds 119 development **application boundaries**. These are not building footprints. They come from the City of Surrey "Development Applications" FeatureServer (`https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/Development%20Applications/FeatureServer/0`) and were retrieved `2026-10-06T11:52:07.660949+00:00`. The set is limited to the City Centre, Fleetwood and Campbell Heights pilot areas: a deliberate subset, not the whole city.
- `skytrain.geojson` holds 225 OpenStreetMap SkyTrain context features (17 points and 208 lines). They come from the Overpass API and were retrieved `2026-10-06T05:58:23.972485+00:00`.
- `updates/v1.json` and `updates/v2.json` are openly labelled demonstration corrections, not authentic City corrections.

Fixture hashes are recorded in [SHA256SUMS](public/data/SHA256SUMS).

### Locally derived assignment attributes

Each raw project feature also carries `assign_lon`, `assign_lat` and `pilot_area`. These are **not** City layer fields and **not** City-surveyed building coordinates. They were derived locally by the upstream sibling snapshot script (`surrey-devviz-prototype`, `scripts/fetch_data.py`, function `assignment_point`):

- The assignment point is the Shapely `representative_point()` of the application geometry, recorded as rounded `assign_lon`/`assign_lat`.
- `pilot_area` is assigned by point-in-polygon of that point against the official pilot plan polygons. The source query recorded in `SOURCES.json` ("assigned by point-in-polygon on official pilot polygons") describes this step.
- The area labels shown in the app (City Centre, Fleetwood, Campbell Heights) are names for these derived `pilot_area` values. The frozen 119 raw features count 89 `city_centre`, 3 `fleetwood` and 27 `campbell_heights`.

The geometry and file bytes remain unchanged from the snapshot. The model reads `assign_lon`/`assign_lat` as the recorded location; the illustrative asset and popup location use that representative point.

### Public record links

The raw fixtures keep each source `WEBLINK` exactly as published. Every one of the 119 raw links uses the official HTTPS CitizenPortal forwarder `/citizenportal/integration/publicProjectForward.html` with a malformed legacy query of the form `?year=19 seq=0234`, where the space-separated `seq` sits inside the `year` value.

The app shows a **derived** link, not the raw value. After the existing checks (HTTPS only, approved host `citizenportal.surrey.ca`, no credentials, default port, length limit), the model rewrites only this exact path with a single `year` parameter holding a two-digit year, one space and `seq=` plus four digits. It becomes the canonical `?year=19&seq=0234`, keeping the values and leading zeroes. The percent-encoded (`%20`) and plus-encoded (`+`) space forms are handled the same way. Already-canonical links are unchanged, and no other path, parameter or ambiguous query is guessed or repaired.

All 119 records receive this canonicalisation in the model. On 2026-10-07 UTC, one forwarder pair was checked by hand with a read-only request: the original malformed form returned HTTP 500 and the canonical form returned HTTP 200, forwarding to the portal application. The downstream portal pages (including any login behaviour) were not verified, and not every one of the 119 portal pages was checked live.

This is a derived link repair. It is separate from the v2 local height demonstration and is not an edit to any City record.

## Open by design

- The site is static: local public data with recorded provenance, plus OSM raster tiles.
- No API keys, no login, no Esri basemap, elevation or location services, and no ArcGIS Online publishing.
- Versions are immutable and replayed against the baseline, which itself is never modified.
- Facts are rendered as DOM text. Links go only to approved HTTPS hosts, and no source HTML is injected.
- There is no analytics or tracking. Before any SDK code loads, a bootstrap script opts out of the SDK's transitive Vaadin development-mode usage statistics.

## Commands

You need Node.js 22.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npx playwright install chromium
npm run test:e2e
```

- `npm run typecheck` checks both the application (`tsconfig.json`) and the tests and test configs (`tsconfig.tests.json`) with the same strict settings.
- `npm run dev` serves the site at `http://localhost:5173/demos/surrey-arcgis/`.
- `npm run preview` serves the production build at `http://localhost:4173/demos/surrey-arcgis/`.
- `npm run build` writes `dist/` with base path `/demos/surrey-arcgis/` and copies the SDK assets locally to `dist/arcgis-assets/`.
- Browser tests intercept OSM tile requests, so no headless run loads live OSM tiles.
- `npm run smoke:live` is optional. It is a separate read-only check of the City service and a bounded Overpass query, using `scripts/live-smoke.mjs`. It does not touch the frozen app fixtures or app tests, and it is not run in CI. See [docs/live-run.md](docs/live-run.md).

Use the commands above to rerun the checks in your own environment.

## 60-second demo script

- **0 to 15 s:** The 3D scene loads. Open the popup for 19-0234-00 and show that the list entry carries the same facts.
- **15 to 25 s:** Show the illustrative podium and tower, with its "Illustrative" label and provenance.
- **25 to 40 s:** Click "Apply demonstration update v2". The diff shows 129 m → 135 m and the extrusion rises.
- **40 to 50 s:** Click "Roll back to v1". The diff shows 135 m → 129 m and the baseline is restored exactly.
- **50 to 60 s:** Tab through the project list and links. Then show the no-WebGL fallback, where the list and versions still work.

To show the fallback, launch Chromium with the `--disable-webgl` flag and open the preview URL. With the locally installed Chromium 153.0.8010.12 and this flag, `getContext('webgl2')` returned `null`. The scene panel then reports that WebGL is unavailable, while the list and version controls keep working. To reproduce the automated evidence after `npm run build`:

```sh
npm run test:e2e -- --grep 'actual WebGL denial'
npx playwright show-report
```

## Limitations and explicit exclusions

- No ArcGIS Online publishing, access or editing; no routing; no photorealistic models.
- No live City synchronization. The data is a frozen snapshot.
- Heights are schematic estimates, not approved heights. The asset is not a building design.
- No claim of past performance or of work for the City.
- Back/forward cache: a persisted `pagehide` keeps the 3D scene controller. Its regression test dispatches a synthetic persisted `pagehide`; it does not prove actual browser back/forward-cache eligibility.

## Licensing

- **This project's source code:** Apache-2.0, © ParalleX Labs Inc. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
- **ArcGIS Maps SDK for JavaScript:** proprietary Esri software under Esri's own terms. See [SDK licensing](https://developers.arcgis.com/javascript/latest/licensing/) and [Esri E300 product-specific terms](https://www.esri.com/content/dam/esrisites/en-us/media/legal/product-specific-terms-of-use/e300.pdf).
- **Production deployment is not settled.** The app needs no runtime key or login, but that does **not** establish a production deployment entitlement. E300 footnotes 63 and 64 (dated 2025-11-13) require web deployment to be in conjunction with other Esri products. Public deployment of the application is therefore pending entitlement verification. Publishing the source code is a separate matter.
- **City data:** Contains information licensed under the [Open Government License - City of Surrey](https://opendata-surrey.hub.arcgis.com/pages/55089a19491a4fe59a41e059fd8af708).
- **OpenStreetMap:** © OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). See also the [copyright page](https://www.openstreetmap.org/copyright) and [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
- **Attribution:** "Powered by Esri" and the SDK attribution are kept in the page footer and on the map.

To cite this project, see [CITATION.cff](CITATION.cff).
