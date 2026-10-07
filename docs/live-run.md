# Read-only live service run

Executed on the local Mac with Node 22.15.1, without authentication, by `node scripts/live-smoke.mjs --receipts`. Final run after all review and regression repairs started 2026-10-07T03:52:59.215Z; finished 2026-10-07T03:53:00.341Z. Exit 0; three checks passed. Exactly three bounded public HTTPS GET requests; no write operations or City credentials. This service check is separate from application rendering.

| Request | HTTP | Verified result |
| --- | --- | --- |
| Official Development Applications layer metadata, f=pjson | 200 | Development_Applications, Feature Layer, polygon geometry; all five expected public fields present |
| Same layer /query, OBJECTID 207, WGS84 GeoJSON | 200 | Exactly one Polygon record, project 19-0234-00; OBJECTID, PROJECT_NO, DESCRIPTION, STATUS and WEBLINK match the frozen source values with no drift |
| Bounded Overpass lookup of OSM node 5324415604 | 200 | Exactly one Gateway station; railway/public_transport station and subway tags; matching named station is present in frozen transit data |

City endpoint: [Development Applications FeatureServer layer 0](https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/Development%20Applications/FeatureServer/0). The query selected OBJECTID, PROJECT_NO, DESCRIPTION, STATUS and WEBLINK with geometry, outSR 4326.

Overpass endpoint: [public interpreter](https://overpass-api.de/api/interpreter). Query: `[out:json][timeout:20];node(5324415604);out tags;`. The returned OSM base timestamp was 2026-10-07T03:51:12Z. This is a one-node service smoke check, not a refresh or validation of every transit feature.

Exact timestamped request/response receipts and the final JSON report are retained in ignored `_build/live/`. The earlier successful runs (02:18:37–02:18:42 and 03:30:36–03:30:38 UTC) and failed live-script runs are retained there as well. The first failed Overpass request used malformed unnamed timeout syntax and returned 400; the next guard rejected a correct query before sending it. Both were repaired by the primary author before the successful run above.

The frozen application files retain their original retrieval dates: development snapshot 2026-10-06T11:52:07.660949+00:00; transit snapshot 2026-10-06T05:58:23.972485+00:00. All three original SHA256SUMS entries still match. This smoke run did not change any fixture or source fact.

## Derived record-link verification

On 2026-10-07 UTC, a separate read-only forwarder check for showcase 207 returned HTTP500 for the source legacy query `?year=19 seq=0234` encoded by URL normalization, and HTTP200 for `?year=19&seq=0234`. The latter response forwards to the portal application. Its downstream pages and login behavior were not tested. All 119 source links retain their original bytes; the model narrowly repairs their derived links, independently tested offline. This link repair is separate from the v2 height demonstration and is not a City record edit.

## Application verification scope

Production browser tests run the real ArcGIS SceneView with local SDK assets and software WebGL. Their evidence checks actual loaded layers, queried application heights, two physical meshes, popup/list facts, repeated correction and exact rollback. A separate case denies WebGL contexts and exercises the full accessible list and version controls. Automated OSM requests are intercepted with a local valid image to comply with the tile policy; no live OSM tile delivery is claimed. Final browser and accessibility results are recorded in BUILD_LOG.md: all nine cases pass, with zero full-page axe violations in both the real scene and actual WebGL-denied cases. Three additional cases inject SDK-boundary failures after genuine initial scene readiness; the uncertain scene is closed and the last committed list is retained, with exact list-only update/rollback. A held genuine popup query tests serialization across correction and rollback. A synthetic persisted pagehide/pageshow test retains the same usable controller; it does not test actual browser back/forward-cache eligibility. A normal regression verifies correction and exact rollback before the first popup opens. No actual public-service outage is claimed by injected failures.

A no-key runtime does not settle production deployment licensing. Application deployment remains pending the entitlement verification stated in README and NOTICE. No ArcGIS Online publishing or public deployment was performed.
