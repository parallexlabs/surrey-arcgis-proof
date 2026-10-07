import {
  applyVersion,
  buildBaseline,
  SHOWCASE_OBJECT_ID,
  validateVersion,
  type Project,
  type SourceEntry,
  type UpdateVersion
} from './model';

export const DEFAULT_BASE_URL = '/demos/surrey-arcgis/';
export const DATA_FILES = {
  projects: 'development_projects.geojson',
  sources: 'SOURCES.json',
  skytrain: 'skytrain.geojson',
  v1: 'updates/v1.json',
  v2: 'updates/v2.json'
} as const;
export const PROJECT_SOURCE_URL =
  'https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/Development%20Applications/FeatureServer/0';
export const TRANSIT_SOURCE_URL = 'https://overpass-api.de/api/interpreter';
export const EXPECTED_PROJECT_COUNT = 119;
export const EXPECTED_TRANSIT = { total: 225, points: 17, lines: 208 } as const;

export type TransitGeometry =
  | { type: 'Point'; coordinates: number[] }
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'MultiLineString'; coordinates: number[][][] };
export interface TransitFeature {
  type: 'Feature';
  properties: { name: string | null };
  geometry: TransitGeometry;
}
export interface TransitCollection {
  type: 'FeatureCollection';
  features: TransitFeature[];
}
export interface ProofData {
  baseline: Project[];
  sources: SourceEntry[];
  projectSource: SourceEntry;
  transitSource: SourceEntry;
  skytrain: TransitCollection;
  versions: { v1: UpdateVersion; v2: UpdateVersion };
}
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
export type Fetcher = (url: string) => Promise<FetchResponseLike>;

export class DataLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataLoadError';
  }
}

function fail(message: string): never {
  throw new DataLoadError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function guard<T>(name: string, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof DataLoadError) throw error;
    return fail(`${name}: ${message(error)}`);
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function resolveBase(baseUrl: unknown): string {
  if (typeof baseUrl !== 'string' || baseUrl.trim() === '') fail('baseUrl: expected non-empty string');
  if (/^[a-z][a-z\d+.-]*:/i.test(baseUrl) || baseUrl.startsWith('//') || baseUrl.includes('..')) {
    fail('baseUrl: must be a local relative path');
  }
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

async function fetchJson(fetcher: Fetcher, url: string, name: string): Promise<unknown> {
  let response: FetchResponseLike;
  try {
    response = await fetcher(url);
  } catch (error) {
    return fail(`${name}: network error (${message(error)})`);
  }
  if (!response || !response.ok) fail(`${name}: HTTP ${response ? response.status : 'error'}`);
  try {
    return await response.json();
  } catch {
    return fail(`${name}: invalid JSON`);
  }
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validateSourceEntry(list: unknown[], file: string, expectedUrl: string, expectedCount: number): SourceEntry {
  const matches = list.filter((entry) => isRecord(entry) && entry.file === file);
  if (matches.length !== 1) fail(`SOURCES.json: expected exactly one entry for ${file}`);
  const raw = matches[0];
  if (!isRecord(raw)) return fail(`SOURCES.json: invalid entry for ${file}`);
  const { source_url: url, layer, retrieved_at: retrievedAt, feature_count: count, licence, licence_url: licenceUrl, query } = raw;
  if (typeof url !== 'string' || url !== expectedUrl) fail(`SOURCES.json ${file}: unexpected source_url`);
  if (typeof layer !== 'string' || layer.trim() === '') fail(`SOURCES.json ${file}: missing layer`);
  if (typeof retrievedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(retrievedAt) || !Number.isFinite(Date.parse(retrievedAt))) {
    fail(`SOURCES.json ${file}: invalid retrieved_at`);
  }
  if (count !== expectedCount) fail(`SOURCES.json ${file}: expected feature_count ${expectedCount}`);
  if (typeof licence !== 'string' || licence.trim() === '') fail(`SOURCES.json ${file}: missing licence`);
  if (licenceUrl !== undefined && !isHttpsUrl(licenceUrl)) fail(`SOURCES.json ${file}: invalid licence_url`);
  if (query !== undefined && typeof query !== 'string') fail(`SOURCES.json ${file}: invalid query`);
  const entry: SourceEntry = { file, source_url: url, layer, retrieved_at: retrievedAt, feature_count: expectedCount, licence };
  if (typeof query === 'string') entry.query = query;
  if (typeof licenceUrl === 'string') entry.licence_url = licenceUrl;
  return entry;
}

function position(value: unknown, path: string): number[] {
  if (!Array.isArray(value) || (value.length !== 2 && value.length !== 3)) fail(`${path}: invalid position`);
  const out = value.map((n: unknown) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) fail(`${path}: non-finite coordinate`);
    return n;
  });
  const [lon = NaN, lat = NaN] = out;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) fail(`${path}: outside WGS84 range`);
  return out;
}

function line(value: unknown, path: string): number[][] {
  if (!Array.isArray(value) || value.length < 2) fail(`${path}: line needs at least 2 positions`);
  return value.map((p: unknown, i) => position(p, `${path}[${i}]`));
}

function transitGeometry(value: unknown, path: string): TransitGeometry {
  if (!isRecord(value)) fail(`${path}: geometry missing`);
  if (value.type === 'Point') return { type: 'Point', coordinates: position(value.coordinates, path) };
  if (value.type === 'LineString') return { type: 'LineString', coordinates: line(value.coordinates, path) };
  if (value.type === 'MultiLineString') {
    const lines = value.coordinates;
    if (!Array.isArray(lines) || lines.length < 1) fail(`${path}: MultiLineString needs lines`);
    return { type: 'MultiLineString', coordinates: lines.map((l: unknown, i) => line(l, `${path}[${i}]`)) };
  }
  return fail(`${path}: geometry must be Point, LineString or MultiLineString`);
}

function validateTransit(raw: unknown): TransitCollection {
  if (!isRecord(raw) || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
    fail('expected GeoJSON FeatureCollection');
  }
  const features = raw.features.map((feature: unknown, i): TransitFeature => {
    if (!isRecord(feature) || feature.type !== 'Feature') fail(`features[${i}]: expected Feature`);
    const props = feature.properties;
    const name = isRecord(props) && typeof props.name === 'string' ? props.name : null;
    return { type: 'Feature', properties: { name }, geometry: transitGeometry(feature.geometry, `features[${i}].geometry`) };
  });
  const points = features.filter((f) => f.geometry.type === 'Point').length;
  const lines = features.length - points;
  if (features.length !== EXPECTED_TRANSIT.total || points !== EXPECTED_TRANSIT.points || lines !== EXPECTED_TRANSIT.lines) {
    fail(`expected ${EXPECTED_TRANSIT.total} features (${EXPECTED_TRANSIT.points} points, ${EXPECTED_TRANSIT.lines} lines); got ${features.length} (${points}, ${lines})`);
  }
  return { type: 'FeatureCollection', features };
}

export async function loadProofData(
  fetcher: Fetcher = (url) => globalThis.fetch(url),
  baseUrl: string = DEFAULT_BASE_URL
): Promise<ProofData> {
  const base = resolveBase(baseUrl);
  const names = [DATA_FILES.projects, DATA_FILES.sources, DATA_FILES.skytrain, DATA_FILES.v1, DATA_FILES.v2];
  const [rawProjects, rawSources, rawSkytrain, rawV1, rawV2] = await Promise.all(
    names.map((name) => fetchJson(fetcher, `${base}data/${name}`, name))
  );
  if (!Array.isArray(rawSources)) fail('SOURCES.json: expected array');
  const projectSource = validateSourceEntry(rawSources, DATA_FILES.projects, PROJECT_SOURCE_URL, EXPECTED_PROJECT_COUNT);
  const transitSource = validateSourceEntry(rawSources, DATA_FILES.skytrain, TRANSIT_SOURCE_URL, EXPECTED_TRANSIT.total);
  const baseline = guard(DATA_FILES.projects, () => buildBaseline(rawProjects, projectSource));
  if (baseline.length !== EXPECTED_PROJECT_COUNT) fail(`${DATA_FILES.projects}: expected ${EXPECTED_PROJECT_COUNT} projects`);
  if (!baseline.some((p) => p.objectId === SHOWCASE_OBJECT_ID)) fail(`${DATA_FILES.projects}: showcase ${SHOWCASE_OBJECT_ID} missing`);
  const skytrain = guard(DATA_FILES.skytrain, () => validateTransit(rawSkytrain));
  const v1 = guard(DATA_FILES.v1, () => validateVersion(rawV1));
  const v2 = guard(DATA_FILES.v2, () => validateVersion(rawV2));
  if (v1.version !== 'v1' || v1.changes.length !== 0) fail(`${DATA_FILES.v1}: must be version v1 with no changes`);
  if (v2.version !== 'v2' || v2.changes.length < 1) fail(`${DATA_FILES.v2}: must be version v2 with changes`);
  guard(DATA_FILES.v1, () => applyVersion(baseline, v1));
  guard(DATA_FILES.v2, () => applyVersion(baseline, v2));
  return deepFreeze({
    baseline,
    sources: [projectSource, transitSource],
    projectSource,
    transitSource,
    skytrain,
    versions: { v1, v2 }
  });
}
