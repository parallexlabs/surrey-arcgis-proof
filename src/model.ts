export const SHOWCASE_OBJECT_ID = 207;
export const SHOWCASE_PROJECT_NO = '19-0234-00';
export const METRES_PER_STOREY = 3;
export const FALLBACK_HEIGHT_M = 12;
export const MAX_PLAUSIBLE_STOREYS = 200;
export const MODEL_TYPE = 'schematic' as const;
export const RECORD_HOST = 'citizenportal.surrey.ca';
export const LEGACY_RECORD_PATH = '/citizenportal/integration/publicProjectForward.html';
export const VERSION_IDS = ['v1', 'v2'] as const;

export type Position = number[];
export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Position[][];
}
export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Position[][][];
}
export type ProjectGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface SourceEntry {
  file?: string;
  source_url: string;
  layer: string;
  query?: string;
  retrieved_at: string;
  feature_count?: number;
  licence?: string;
  licence_url?: string;
}

export interface HeightEstimate {
  heightM: number;
  heightRule: string;
}

export interface Project {
  objectId: number;
  projectNo: string;
  description: string;
  status: string;
  recordUrl: string | null;
  sourceUrl: string;
  retrievedAt: string;
  longitude: number;
  latitude: number;
  heightM: number;
  heightRule: string;
  modelType: typeof MODEL_TYPE;
  geometry: ProjectGeometry;
}

export type VersionId = (typeof VERSION_IDS)[number];

export interface HeightChange {
  objectId: number;
  estimatedHeightM: number;
}

export interface UpdateVersion {
  version: VersionId;
  label: string;
  changes: HeightChange[];
}

export interface DiffEntry {
  objectId: number;
  projectNo: string;
  field: 'heightM';
  before: number;
  after: number;
}

export class ModelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelValidationError';
  }
}

function fail(message: string): never {
  throw new ModelValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`${path}: unexpected key "${key}"`);
  }
}

const STOREY_PATTERN = /(?<![\d.])(\d{1,3})\s*-?\s*(?:storeys?|stor(?:y|ies))\b/gi;

export function heightFromDescription(description: unknown): HeightEstimate {
  const text = typeof description === 'string' ? description : '';
  let storeys = 0;
  for (const match of text.matchAll(STOREY_PATTERN)) {
    const n = Number.parseInt(match[1] ?? '', 10);
    if (Number.isInteger(n) && n >= 1 && n <= MAX_PLAUSIBLE_STOREYS && n > storeys) storeys = n;
  }
  if (storeys > 0) {
    const heightM = storeys * METRES_PER_STOREY;
    return {
      heightM,
      heightRule: `Estimate: ${storeys} storeys (largest storey count stated in public description) × ${METRES_PER_STOREY} m = ${heightM} m; schematic, not a surveyed or approved height`
    };
  }
  return {
    heightM: FALLBACK_HEIGHT_M,
    heightRule: `Illustrative fallback: no storey count in public description; fixed ${FALLBACK_HEIGHT_M} m schematic height`
  };
}

const LEGACY_YEAR_VALUE = /^(\d{2}) seq=(\d{4})$/;

function canonicalLegacyRecordUrl(url: URL): string | null {
  if (url.pathname !== LEGACY_RECORD_PATH || url.hash !== '') return null;
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 1 || keys[0] !== 'year') return null;
  const match = LEGACY_YEAR_VALUE.exec(url.searchParams.get('year') ?? '');
  if (!match) return null;
  const [, year, seq] = match;
  if (year === undefined || seq === undefined) return null;
  return `${url.origin}${LEGACY_RECORD_PATH}?year=${year}&seq=${seq}`;
}

export function safeRecordUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname.toLowerCase() !== RECORD_HOST) return null;
  if (url.username !== '' || url.password !== '') return null;
  if (url.port !== '' && url.port !== '443') return null;
  return canonicalLegacyRecordUrl(url) ?? url.href;
}

function validateCoordinate(value: unknown, min: number, max: number, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(`${path}: expected finite number in [${min}, ${max}]`);
  }
  return value;
}

function validatePosition(value: unknown, path: string): Position {
  if (!Array.isArray(value) || (value.length !== 2 && value.length !== 3)) fail(`${path}: invalid position`);
  const lon = validateCoordinate(value[0], -180, 180, `${path}[0]`);
  const lat = validateCoordinate(value[1], -90, 90, `${path}[1]`);
  if (value.length === 3) {
    const z: unknown = value[2];
    if (typeof z !== 'number' || !Number.isFinite(z)) fail(`${path}[2]: expected finite number`);
    return [lon, lat, z];
  }
  return [lon, lat];
}

function validateRing(value: unknown, path: string): Position[] {
  if (!Array.isArray(value) || value.length < 4) fail(`${path}: ring needs at least 4 positions`);
  const ring = value.map((p: unknown, i) => validatePosition(p, `${path}[${i}]`));
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) fail(`${path}: ring is not closed`);
  return ring;
}

function validatePolygonCoords(value: unknown, path: string): Position[][] {
  if (!Array.isArray(value) || value.length < 1) fail(`${path}: polygon needs at least one ring`);
  return value.map((r: unknown, i) => validateRing(r, `${path}[${i}]`));
}

function validateGeometry(value: unknown, path: string): ProjectGeometry {
  if (!isRecord(value)) fail(`${path}: geometry missing`);
  if (value.type === 'Polygon') {
    return { type: 'Polygon', coordinates: validatePolygonCoords(value.coordinates, `${path}.coordinates`) };
  }
  if (value.type === 'MultiPolygon') {
    const coords = value.coordinates;
    if (!Array.isArray(coords) || coords.length < 1) fail(`${path}: MultiPolygon needs at least one polygon`);
    return {
      type: 'MultiPolygon',
      coordinates: coords.map((p: unknown, i) => validatePolygonCoords(p, `${path}.coordinates[${i}]`))
    };
  }
  return fail(`${path}: geometry type must be Polygon or MultiPolygon`);
}

function cloneGeometry(geometry: ProjectGeometry): ProjectGeometry {
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.coordinates.map((r) => r.map((p) => [...p])) };
  }
  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates.map((poly) => poly.map((r) => r.map((p) => [...p])))
  };
}

function cloneProject(project: Project): Project {
  return { ...project, geometry: cloneGeometry(project.geometry) };
}

function optionalText(value: unknown, path: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') fail(`${path}: expected string`);
  return value;
}

function validateSource(source: unknown): { sourceUrl: string; retrievedAt: string } {
  if (!isRecord(source)) fail('source: expected SOURCES.json entry object');
  const { source_url: sourceUrl, layer, retrieved_at: retrievedAt } = source;
  if (typeof sourceUrl !== 'string') fail('source.source_url: expected string');
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return fail('source.source_url: invalid URL');
  }
  if (parsed.protocol !== 'https:') fail('source.source_url: must be https');
  if (typeof layer !== 'string' || layer.trim() === '') fail('source.layer: expected non-empty string');
  if (typeof retrievedAt !== 'string' || !Number.isFinite(Date.parse(retrievedAt))) {
    fail('source.retrieved_at: expected ISO date string');
  }
  return { sourceUrl, retrievedAt };
}

export function buildBaseline(featureCollection: unknown, source: unknown): Project[] {
  const { sourceUrl, retrievedAt } = validateSource(source);
  if (!isRecord(featureCollection) || featureCollection.type !== 'FeatureCollection') {
    fail('featureCollection: expected GeoJSON FeatureCollection');
  }
  const features = featureCollection.features;
  if (!Array.isArray(features)) fail('featureCollection.features: expected array');
  const seen = new Set<number>();
  const projects = features.map((feature: unknown, i): Project => {
    const path = `features[${i}]`;
    if (!isRecord(feature) || feature.type !== 'Feature') fail(`${path}: expected Feature`);
    const props = feature.properties;
    if (!isRecord(props)) fail(`${path}.properties: expected object`);
    const objectId = props.OBJECTID;
    if (typeof objectId !== 'number' || !Number.isInteger(objectId) || objectId <= 0) {
      fail(`${path}.properties.OBJECTID: expected positive integer`);
    }
    if (seen.has(objectId)) fail(`${path}.properties.OBJECTID: duplicate ${objectId}`);
    seen.add(objectId);
    const projectNo = props.PROJECT_NO;
    if (typeof projectNo !== 'string' || projectNo.trim() === '') {
      fail(`${path}.properties.PROJECT_NO: expected non-empty string`);
    }
    const description = optionalText(props.DESCRIPTION, `${path}.properties.DESCRIPTION`);
    const status = optionalText(props.STATUS, `${path}.properties.STATUS`);
    const longitude = validateCoordinate(props.assign_lon, -180, 180, `${path}.properties.assign_lon`);
    const latitude = validateCoordinate(props.assign_lat, -90, 90, `${path}.properties.assign_lat`);
    const geometry = validateGeometry(feature.geometry, `${path}.geometry`);
    const { heightM, heightRule } = heightFromDescription(description);
    return {
      objectId,
      projectNo,
      description,
      status,
      recordUrl: safeRecordUrl(props.WEBLINK),
      sourceUrl,
      retrievedAt,
      longitude,
      latitude,
      heightM,
      heightRule,
      modelType: MODEL_TYPE,
      geometry
    };
  });
  return projects.sort((a, b) => a.objectId - b.objectId);
}

export function validateVersion(input: unknown): UpdateVersion {
  if (!isRecord(input)) fail('version: expected object');
  assertOnlyKeys(input, ['version', 'label', 'changes'], 'version');
  const { version, label, changes } = input;
  if (typeof version !== 'string' || !(VERSION_IDS as readonly string[]).includes(version)) {
    fail('version.version: expected "v1" or "v2"');
  }
  if (typeof label !== 'string' || label.trim() === '' || label.length > 300) {
    fail('version.label: expected non-empty string up to 300 characters');
  }
  if (!Array.isArray(changes)) fail('version.changes: expected array');
  const seen = new Set<number>();
  const validated = changes.map((change: unknown, i): HeightChange => {
    const path = `version.changes[${i}]`;
    if (!isRecord(change)) fail(`${path}: expected object`);
    assertOnlyKeys(change, ['objectId', 'estimatedHeightM'], path);
    const { objectId, estimatedHeightM } = change;
    if (typeof objectId !== 'number' || !Number.isInteger(objectId) || objectId <= 0) {
      fail(`${path}.objectId: expected positive integer`);
    }
    if (seen.has(objectId)) fail(`${path}.objectId: duplicate ${objectId}`);
    seen.add(objectId);
    if (typeof estimatedHeightM !== 'number' || !Number.isFinite(estimatedHeightM) || estimatedHeightM < 0) {
      fail(`${path}.estimatedHeightM: expected finite non-negative number`);
    }
    return { objectId, estimatedHeightM };
  });
  return { version: version as VersionId, label, changes: validated };
}

function demonstrationRule(version: VersionId, heightM: number): string {
  return `Demonstration correction estimate (${version}): ${heightM} m set by local demonstration update file; not an authentic City correction; public source facts unchanged`;
}

function isProjectEntry(value: unknown): value is Project {
  if (!isRecord(value)) return false;
  const geometry = value.geometry;
  return (
    typeof value.objectId === 'number' &&
    Number.isFinite(value.objectId) &&
    typeof value.projectNo === 'string' &&
    typeof value.heightM === 'number' &&
    isRecord(geometry) &&
    (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') &&
    Array.isArray(geometry.coordinates)
  );
}

function indexById(projects: readonly Project[], name: string): Map<number, Project> {
  if (!Array.isArray(projects)) fail(`${name}: expected array of projects`);
  const map = new Map<number, Project>();
  for (const entry of projects as readonly unknown[]) {
    if (!isProjectEntry(entry)) fail(`${name}: invalid project entry`);
    if (map.has(entry.objectId)) fail(`${name}: duplicate objectId ${entry.objectId}`);
    map.set(entry.objectId, entry);
  }
  return map;
}

export function applyVersion(baseline: readonly Project[], version: unknown): Project[] {
  const index = indexById(baseline, 'baseline');
  const validated = validateVersion(version);
  const overrides = new Map<number, number>();
  for (const change of validated.changes) {
    if (!index.has(change.objectId)) fail(`version.changes: unknown objectId ${change.objectId}`);
    overrides.set(change.objectId, change.estimatedHeightM);
  }
  return baseline.map((project) => {
    const clone = cloneProject(project);
    const heightM = overrides.get(project.objectId);
    if (heightM === undefined) return clone;
    return { ...clone, heightM, heightRule: demonstrationRule(validated.version, heightM) };
  });
}

export function diffStates(before: readonly Project[], after: readonly Project[]): DiffEntry[] {
  const beforeIndex = indexById(before, 'before');
  const afterIndex = indexById(after, 'after');
  if (beforeIndex.size !== afterIndex.size) fail('diffStates: states contain different projects');
  const diffs: DiffEntry[] = [];
  for (const [objectId, b] of beforeIndex) {
    const a = afterIndex.get(objectId);
    if (!a) fail(`diffStates: objectId ${objectId} missing from after state`);
    if (!Object.is(b.heightM, a.heightM)) {
      diffs.push({ objectId, projectNo: a.projectNo, field: 'heightM', before: b.heightM, after: a.heightM });
    }
  }
  return diffs.sort((x, y) => x.objectId - y.objectId);
}
