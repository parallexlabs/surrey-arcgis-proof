# Surrey ArcGIS proof — frozen specification

Version 1, frozen 2026-10-06. Backbone: local PLAN_A “ArcGIS proof”; PLAN_B contains the same scope. This is a public-data technical proof by ParalleX Labs Inc., not a City system or a claim of completed City work.

## Stack and boundaries

Static Vite site, TypeScript, ArcGIS Maps SDK for JavaScript (@arcgis/core ES modules), SceneView. Node.js 22 LTS. Build base path /demos/surrey-arcgis/. Use OpenStreetMap raster tiles through WebTileLayer with visible OSM attribution and retain SDK attribution. No Esri basemaps, elevation services, location services, API keys, login, City credentials, or ArcGIS Online publishing. Use a flat ground. Local SDK assets must work under the build base path.

Public snapshot files are copied unchanged from the sibling surrey-devviz-demo public/data directory: development_projects.geojson (119 application polygons), skytrain.geojson (225 OSM context features), and the relevant entries of SOURCES.json. Preserve their recorded retrieval dates and provenance. Use GeoJSONLayer for application polygons and compatible SkyTrain geometry layers. Do not imply application boundaries are building footprints. All shown application records must appear in the accessible list; any deliberate area subset must be stated visibly and documented.

## Five proofs and acceptance

| Proof | Required behavior | Evidence |
| --- | --- | --- |
| Source to model | Showcase project 19-0234-00 (OBJECTID 207), whose public description states 43 storeys, becomes a schematic extrusion. Use explicitly documented estimate: extracted storeys × 3 metres; otherwise a labelled 12-metre illustrative fallback. Popup and list show project identifier, public record link, description, status, source layer, snapshot retrieval date, height, height rule, and schematic model label. | Transform unit tests, real scene smoke, list/popup parity. |
| Detailed illustrative asset | One simple two-part podium and tower object is placed at the showcase project's recorded location, with its own provenance and conspicuous “illustrative” label. It is a schematic 3D object, not an approved building design. | Scene readiness plus object/layer evidence, visual screenshot and accessible equivalent. |
| Attribute correction | Local versioned City-style demonstration update file v2 changes one showcase value (estimated height) with a displayed before/after diff, without changing source facts or writing to a public service. | Unit and browser tests verifying value, diff, and scene update. |
| Exact rollback | Selecting previous local update file v1 restores the original modeled state exactly by applying each version to the immutable baseline. | Deep state equality and repeated update/rollback browser tests. |
| Accessibility | Keyboard-operable list includes every shown project's equivalent facts; it works if WebGL is actually unavailable. Accessible labels, visible focus, useful loading/error states, safe text/link handling. | Playwright keyboard tests, WebGL-disabled browser run, axe scan with zero violations. |

Version files are openly labelled demonstration corrections, never authentic City corrections. Source records and modeled estimates remain separate. Do not invent authoritative floor counts or change public source facts.

## Honesty, licensing, and privacy

Visible statement: public-data proof; no connection to the City's ArcGIS Online; no City credentials; schematic heights are estimates. No analytics, tracking, editing UI, routing, photorealistic models, or new features beyond these plans. Avoid leaking source HTML into DOM/popups; validate outbound links and update inputs.

Licensing check performed 2026-10-06: Esri's published SDK licensing page https://developers.arcgis.com/javascript/latest/licensing/ requires product-specific terms and attribution, and describes ArcGIS Online/Enterprise/Location Platform licensing. It does not confirm unconditional account-free production licensing. Authentication is technically unnecessary for local GeoJSON and public OSM tiles. README must distinguish no runtime key/login from unresolved production licensing entitlement; do not claim the proprietary SDK is Apache-2.0 or universally licence-free. Confirm any public deployment entitlement before publishing. Retain “Powered by Esri”, Surrey Open Government License notice, and OSM ODbL notice. Include links to Esri terms and OSM tile policy.

## Verification and deliverables

The primary author authors all application, loader, configuration, CI, and README files. The independent test author authors the test suite and handles fixes after two failed primary rounds. Each request carries this spec plus relevant existing files; continuations use the latest returned author thread. Returned full files are installed byte for byte. The coordinator integrates, records public fixture data, executes checks, and records results.

Required checks: lint, type check, unit tests, coverage at least 80% for the pure transform/update validation modules (UI/SceneView covered by browser tests), production build, Playwright scene/list/correction/rollback tests and axe zero violations, actual no-WebGL fallback, and read-only live service smoke. Frozen fixture tests must not require live public services or download OSM tiles in CI; intercept remote tiles in browser tests and distinguish deterministic checks from the live smoke. No mocked readiness may pass as an actual SceneView render.

Required repository: README including Open by design, commands, Surrey example, limitations, explicit exclusions, licensing findings and a 60-second demo script; Apache-2.0 LICENSE (ParalleX Labs Inc.) and NOTICE; CITATION.cff; Node 22 CI with permissions contents: read; docs/live-run.md; BUILD_LOG.md recording authorship and fix attempts. Record fixture hashes. Generate dependency lock via package manager. Ignore generated build/test files. STATUS.md remains untracked and records what was built, results, the private request ledger, review findings and dispositions, commit, and anything not done.

Before commit, stage intended public files, generate the full-repo pack with the brief's full_repo_pack.py, run the local confidentiality guard, and request exactly two independent full-repository reviews of the same version. Request HIGH/MEDIUM/LOW findings and patches; have the coding author apply accepted fixes, then rerun checks. Commit under the configured git identity with a plain message. Do not push or create a remote repository.
