#!/usr/bin/env node
// Optional, read-only live smoke check. Exactly three bounded public HTTPS GET requests.
// Never modifies fixtures. Not run in CI. Does not prove that any SceneView rendered.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_FIXTURE = join(ROOT, 'public', 'data', 'development_projects.geojson');
const TRANSIT_FIXTURE = join(ROOT, 'public', 'data', 'skytrain.geojson');
const RECEIPT_DIR = join(ROOT, '_build', 'live');
const WRITE_RECEIPTS = process.argv.includes('--receipts');
const TIMEOUT_MS = 35_000;
const USER_AGENT = 'surrey-arcgis-proof-live-smoke/1.0 (read-only; ParalleX Labs Inc.)';

const LAYER_URL =
  'https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/Development%20Applications/FeatureServer/0';
const OBJECT_ID = 207;
const PROJECT_NO = '19-0234-00';
const FIELDS = ['OBJECTID', 'PROJECT_NO', 'DESCRIPTION', 'STATUS', 'WEBLINK'];
const OSM_NODE_ID = 5324415604;
const OSM_NAME = 'Gateway';
const TRANSIT_KEYS = ['railway', 'public_transport', 'station', 'subway', 'light_rail', 'train'];
const OVERPASS_TIMEOUT_KEY = 'timeout';
const OVERPASS_TIMEOUT_SECONDS = '20';
const OVERPASS_SETTING_PARTS = [['out', 'json'], [OVERPASS_TIMEOUT_KEY, OVERPASS_TIMEOUT_SECONDS]];
const OVERPASS_SETTINGS = OVERPASS_SETTING_PARTS.map(([key, value]) => `[${key}:${value}]`).join('');
const OVERPASS_QUERY = `${OVERPASS_SETTINGS};node(${OSM_NODE_ID});out tags;`;

class SmokeError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'SmokeError';
    this.meta = meta;
  }
}

const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function overpassQueryIsWellFormed(query) {
  if (!query.startsWith(`${OVERPASS_SETTINGS};`)) return false;
  const settings = [...OVERPASS_SETTINGS.matchAll(/\[([a-z]+):([a-z0-9]+)\]/g)].map((m) => [m[1], m[2]]);
  return (
    settings.length === 2 &&
    settings[0]?.[0] === 'out' &&
    settings[0]?.[1] === 'json' &&
    settings[1]?.[0] === OVERPASS_TIMEOUT_KEY &&
    settings[1]?.[1] === OVERPASS_TIMEOUT_SECONDS
  );
}

async function getJson(url) {
  const meta = { url, requestedAt: new Date().toISOString(), httpStatus: null, contentType: null };
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (error) {
    throw new SmokeError(`Network error or timeout (${TIMEOUT_MS} ms): ${error?.name ?? 'Error'}: ${error?.message ?? error}`, meta);
  }
  meta.httpStatus = response.status;
  meta.contentType = response.headers.get('content-type');
  let text;
  try {
    text = await response.text();
  } catch (error) {
    throw new SmokeError(`Failed reading response body: ${error?.message ?? error}`, meta);
  }
  if (!response.ok) throw new SmokeError(`HTTP ${response.status}`, meta);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new SmokeError('Response was not valid JSON', meta);
  }
  if (isRecord(json) && isRecord(json.error)) {
    throw new SmokeError(`API error ${json.error.code ?? ''}: ${json.error.message ?? 'unknown'}`.trim(), meta);
  }
  return { meta, json };
}

function writeReceipt(name, meta, body) {
  if (!WRITE_RECEIPTS) return null;
  mkdirSync(RECEIPT_DIR, { recursive: true });
  const file = join(RECEIPT_DIR, `${meta.requestedAt.replace(/[:.]/g, '-')}-${name}.json`);
  writeFileSync(file, `${JSON.stringify({ url: meta.url, requestedAt: meta.requestedAt, httpStatus: meta.httpStatus, contentType: meta.contentType, body }, null, 2)}\n`);
  return file.slice(ROOT.length + 1);
}

function readFixture(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function normalizeUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    return new URL(value.trim()).href;
  } catch {
    return value.trim();
  }
}

async function runCheck(name, fn) {
  const record = { name, url: null, requestedAt: null, httpStatus: null, passed: false, details: {}, error: null };
  try {
    const result = await fn(record);
    record.details = result.details;
    record.passed = result.passed;
    if (!result.passed && result.reason) record.error = result.reason;
  } catch (error) {
    if (error instanceof SmokeError) Object.assign(record, { url: error.meta.url ?? record.url, requestedAt: error.meta.requestedAt ?? record.requestedAt, httpStatus: error.meta.httpStatus ?? record.httpStatus });
    record.error = error?.message ?? String(error);
    record.passed = false;
  }
  return record;
}

async function checkLayerMetadata(record) {
  const url = `${LAYER_URL}?f=pjson`;
  record.url = url;
  const { meta, json } = await getJson(url);
  Object.assign(record, { requestedAt: meta.requestedAt, httpStatus: meta.httpStatus });
  const fieldNames = Array.isArray(json.fields) ? json.fields.map((f) => f?.name).filter((n) => typeof n === 'string') : [];
  const missingFields = FIELDS.filter((f) => !fieldNames.includes(f));
  const details = {
    name: json.name ?? null,
    type: json.type ?? null,
    geometryType: json.geometryType ?? null,
    currentVersion: json.currentVersion ?? null,
    fieldCount: fieldNames.length,
    missingFields
  };
  details.receipt = writeReceipt('layer-metadata', meta, { ...details, fieldNames });
  const nameOk = typeof json.name === 'string' && /^Development[_ ]Applications$/.test(json.name);
  const passed = nameOk && json.type === 'Feature Layer' && json.geometryType === 'esriGeometryPolygon' && missingFields.length === 0;
  return { passed, details, reason: passed ? null : 'Layer metadata did not match the expected Development_Applications polygon feature layer' };
}

async function checkShowcaseRecord(record) {
  const params = new URLSearchParams({
    f: 'geojson',
    where: `OBJECTID=${OBJECT_ID}`,
    outFields: FIELDS.join(','),
    outSR: '4326',
    returnGeometry: 'true'
  });
  const url = `${LAYER_URL}/query?${params.toString()}`;
  record.url = url;
  const { meta, json } = await getJson(url);
  Object.assign(record, { requestedAt: meta.requestedAt, httpStatus: meta.httpStatus });
  if (!isRecord(json) || json.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
    throw new SmokeError('Query response is not a GeoJSON FeatureCollection', meta);
  }
  const liveCount = json.features.length;
  const live = json.features[0];
  const liveProps = isRecord(live?.properties) ? live.properties : {};
  const fixture = readFixture(PROJECT_FIXTURE);
  const frozen = Array.isArray(fixture.features) ? fixture.features.find((f) => f?.properties?.OBJECTID === OBJECT_ID) : undefined;
  const frozenProps = isRecord(frozen?.properties) ? frozen.properties : null;
  const drift = {};
  let weblinkNote = null;
  for (const field of FIELDS) {
    const a = frozenProps ? frozenProps[field] ?? null : null;
    const b = liveProps[field] ?? null;
    let equal = a === b;
    if (!equal && field === 'WEBLINK' && normalizeUrl(a) !== null && normalizeUrl(a) === normalizeUrl(b)) {
      equal = true;
      weblinkNote = 'WEBLINK differs only by URL normalization';
    }
    drift[field] = { matches: equal, fixture: a, live: b };
  }
  const driftFields = FIELDS.filter((f) => !drift[f].matches);
  const details = {
    liveFeatureCount: liveCount,
    liveObjectId: liveProps.OBJECTID ?? null,
    liveProjectNo: liveProps.PROJECT_NO ?? null,
    liveGeometryType: live?.geometry?.type ?? null,
    fixtureRecordFound: frozenProps !== null,
    driftFields,
    weblinkNote,
    drift
  };
  details.receipt = writeReceipt('showcase-record', meta, json);
  const recordOk = liveCount === 1 && liveProps.OBJECTID === OBJECT_ID && liveProps.PROJECT_NO === PROJECT_NO && details.liveGeometryType !== null;
  const passed = recordOk && frozenProps !== null && driftFields.length === 0;
  const reason = !recordOk
    ? `Expected exactly one live record OBJECTID ${OBJECT_ID} / ${PROJECT_NO}`
    : frozenProps === null
      ? 'Frozen fixture is missing the showcase record'
      : driftFields.length > 0
        ? `Live record drifted from frozen fixture in: ${driftFields.join(', ')} (fixtures not modified)`
        : null;
  return { passed, details, reason };
}

async function checkOverpassNode(record) {
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(OVERPASS_QUERY)}`;
  record.url = url;
  if (!overpassQueryIsWellFormed(OVERPASS_QUERY)) {
    throw new SmokeError(`Refusing malformed Overpass QL settings: ${OVERPASS_QUERY}`, { url });
  }
  const { meta, json } = await getJson(url);
  Object.assign(record, { requestedAt: meta.requestedAt, httpStatus: meta.httpStatus });
  if (!isRecord(json) || !Array.isArray(json.elements)) throw new SmokeError('Overpass response has no elements array', meta);
  const node = json.elements.find((e) => e?.type === 'node' && e?.id === OSM_NODE_ID);
  const tags = isRecord(node?.tags) ? node.tags : {};
  const transitTags = Object.fromEntries(TRANSIT_KEYS.filter((k) => k in tags).map((k) => [k, tags[k]]));
  let fixtureGatewayCount = null;
  try {
    const transit = readFixture(TRANSIT_FIXTURE);
    fixtureGatewayCount = Array.isArray(transit.features) ? transit.features.filter((f) => f?.properties?.name === OSM_NAME).length : 0;
  } catch {
    fixtureGatewayCount = null;
  }
  const details = {
    query: OVERPASS_QUERY,
    elementCount: json.elements.length,
    nodeFound: Boolean(node),
    name: tags.name ?? null,
    transitTags,
    fixtureGatewayCount,
    osmBase: typeof json.osm3s?.timestamp_osm_base === 'string' ? json.osm3s.timestamp_osm_base : null
  };
  details.receipt = writeReceipt('overpass-node', meta, { elements: json.elements, osm3s: json.osm3s ?? null });
  const passed = Boolean(node) && tags.name === OSM_NAME && Object.keys(transitTags).length > 0 && (fixtureGatewayCount ?? 0) > 0;
  return { passed, details, reason: passed ? null : `Expected OSM node ${OSM_NODE_ID} named ${OSM_NAME} with transit tags, present in the frozen fixture` };
}

const startedAt = new Date().toISOString();
const checks = [];
checks.push(await runCheck('city-layer-metadata', checkLayerMetadata));
checks.push(await runCheck('city-showcase-record-207', checkShowcaseRecord));
checks.push(await runCheck('osm-overpass-gateway-node', checkOverpassNode));
const passedCount = checks.filter((c) => c.passed).length;
const report = {
  tool: 'surrey-arcgis-proof live smoke (read-only)',
  scope: 'Public City metadata/query and one bounded OSM Overpass node lookup. Does not test or prove SceneView rendering.',
  node: process.version,
  startedAt,
  finishedAt: new Date().toISOString(),
  requestCount: checks.length,
  checks,
  summary: { checks: checks.length, passed: passedCount },
  overallPassed: passedCount === checks.length
};
console.log(JSON.stringify(report, null, 2));
for (const c of checks) if (!c.passed) console.error(`[live-smoke] ${c.name} FAILED: ${c.error ?? 'unknown error'}`);
process.exitCode = report.overallPassed ? 0 : 1;
