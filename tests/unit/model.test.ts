import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyVersion, buildBaseline, diffStates, heightFromDescription,
  safeRecordUrl, validateVersion,
} from '../../src/model';
import type { Project, SourceEntry, UpdateVersion } from '../../src/model';

// Rules describe provenance, not fixed literals. Only heightM and its rule
// change under corrections; rollback restores every field from the baseline.
interface Feature {
  type: string;
  properties: Record<string, unknown>;
  geometry: unknown;
}
interface Collection {
  type: string;
  features: Feature[];
}
const load = (name: string): unknown => JSON.parse(readFileSync(
  new URL(`../../public/data/${name}`, import.meta.url), 'utf8',
));
const clone = <T>(value: T): T => structuredClone(value);
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(child => freeze(child));
    Object.freeze(value);
  }
  return value;
}
const fixture = freeze(load('development_projects.geojson') as Collection);
const sources = load('SOURCES.json');
if (!Array.isArray(sources)) throw new Error('SOURCES.json must be an array');
const source = sources.find((entry: SourceEntry) =>
  entry.file === 'development_projects.geojson',
) as SourceEntry | undefined;
if (!source) throw new Error('Missing development fixture provenance');
const SOURCE = freeze(source);
const showcase = fixture.features.find(f => f.properties.OBJECTID === 207);
if (!showcase) throw new Error('Missing showcase OBJECTID 207');
const SHOWCASE = showcase;
const v1 = freeze(load('updates/v1.json') as UpdateVersion);
const v2 = freeze(load('updates/v2.json') as UpdateVersion);
const baseline = () => buildBaseline(fixture, SOURCE);
const single = (): Collection => ({
  type: 'FeatureCollection', features: [clone(SHOWCASE)],
});
function first(c: Collection): Feature {
  const feature = c.features[0];
  if (!feature) throw new Error('Test collection needs one feature');
  return feature;
}
function project207(projects: readonly Project[]): Project {
  const project = projects.find(p => p.objectId === 207);
  if (!project) throw new Error('Model omitted OBJECTID 207');
  return project;
}
const ring = [[-123, 49], [-122, 49], [-122, 50], [-123, 49]];
const ring3D = [[-123, 49, 10], [-122, 49, 20], [-122, 50, 30], [-123, 49, 10]];
const keys = [
  'objectId', 'projectNo', 'description', 'status', 'recordUrl', 'sourceUrl',
  'retrievedAt', 'longitude', 'latitude', 'heightM', 'heightRule', 'modelType', 'geometry',
].sort();
function expectEstimate(rule: string, storeys: number): void {
  expect(rule).toMatch(/estimate/i);
  expect(rule).toMatch(new RegExp(`\\b${storeys}\\s*(?:storeys?|stor(?:y|ies))\\b`, 'i'));
  expect(rule).toMatch(/(?:×|x|\*)\s*3\s*m\b/i);
  expect(rule).toMatch(new RegExp(`\\b${storeys * 3}\\s*m\\b`, 'i'));
  expect(rule).toMatch(/schematic/i);
  expect(rule).toMatch(/not\b[^.;]*\bapproved\b/i);
}
function expectFallback(rule: string): void {
  expect(rule).toMatch(/fallback/i);
  expect(rule).toMatch(/illustrative|schematic/i);
  expect(rule).toMatch(/\b12\s*m\b/i);
}
function expectCorrection(rule: string, height: number): void {
  expect(rule).toMatch(/demonstration/i);
  expect(rule).toMatch(/local/i);
  expect(rule).toMatch(/correction/i);
  expect(rule).toMatch(/estimate|schematic/i);
  expect(rule).toMatch(new RegExp(`\\b${height}\\s*m\\b`, 'i'));
  expect(rule).toMatch(/not\b[^.;]*\bCity\b/i);
  expect(rule).toMatch(/source\s+facts\s+(?:remain\s+)?unchanged/i);
}
function withoutHeight(project: Project) {
  const { heightM: _heightM, heightRule: _heightRule, ...facts } = project;
  return facts;
}

describe('heightFromDescription', () => {
  it.each([
    ['43-storey tower', 43], ['A 7 storey residential building', 7],
    ['12-storeys', 12], ['9 STOREYS', 9], ['18-story tower', 18],
    ['22 stories', 22], ['6-storey podium and 43-storey tower', 43],
    ['43 storeys plus a 6 storey podium', 43], ['8 storeys and 8 storeys', 8],
    ['201 storeys and 5 storeys', 5], ['3.5 storeys and 9 storeys', 9],
  ])('estimates %s', (description, storeys) => {
    const result = heightFromDescription(description);
    expect(result.heightM).toBe(storeys * 3);
    expectEstimate(result.heightRule, storeys);
  });

  it('accepts every integer count from 1 through 200 and selects the largest', () => {
    for (let count = 1; count <= 200; count++) {
      const result = heightFromDescription(`1-storey podium; ${count}-storey tower`);
      expect(result.heightM).toBe(count * 3);
      expectEstimate(result.heightRule, count);
    }
  });

  it.each([
    '', 'Project 19-0234-00', 'Residential development', '3.5-storey building',
    '0 storeys', '201 storeys', '1000 storeys', '43 storeybuilding',
    null, undefined, 43, {}, [],
  ])('uses a labelled 12 m fallback for %j', description => {
    const result = heightFromDescription(description);
    expect(result.heightM).toBe(12);
    expectFallback(result.heightRule);
  });
});

describe('safeRecordUrl', () => {
  const host = 'https://citizenportal.surrey.ca';
  const prefix = `${host}/`;
  it.each([
    [`${host}/record/207`, `${host}/record/207`],
    [`  ${host}/record/207  `, `${host}/record/207`],
    ['https://CITIZENPORTAL.SURREY.CA:443/207', `${host}/207`],
    [`${host}/207?project=19-0234-00#details`, `${host}/207?project=19-0234-00#details`],
    [prefix + 'a'.repeat(2048 - prefix.length), prefix + 'a'.repeat(2048 - prefix.length)],
    ['javascript:alert(1)', null], ['data:text/html,test', null],
    ['http://citizenportal.surrey.ca/207', null],
    ['https://citizenportal.surrey.ca.evil.example/207', null],
    ['https://citizenportal.surrey.ca@evil.example/207', null],
    ['https://user@citizenportal.surrey.ca/207', null],
    ['https://user:password@citizenportal.surrey.ca/207', null],
    ['https://:password@citizenportal.surrey.ca/207', null],
    ['https://citizenportal.surrey.ca:444/207', null],
    ['https://citizenportal.surrey.ca:80/207', null],
    ['//citizenportal.surrey.ca/207', null], ['/207', null],
    ['not a URL', null], ['', null], ['   ', null],
    [prefix + 'a'.repeat(2049 - prefix.length), null],
    [null, null], [undefined, null], [207, null], [{}, null],
  ])('checks and normalizes %j', (value, expected) => {
    expect(safeRecordUrl(value)).toBe(expected);
    const c = single();
    first(c).properties.WEBLINK = value;
    expect(buildBaseline(freeze(c), SOURCE)[0]?.recordUrl).toBe(expected);
  });
});

describe('buildBaseline', () => {
  it('preserves all 119 records, geometry, assigned coordinates, and provenance', () => {
    const savedFixture = clone(fixture), savedSource = clone(SOURCE);
    const projects = baseline();
    expect(fixture.type).toBe('FeatureCollection');
    expect(fixture.features).toHaveLength(119);
    expect(SOURCE.feature_count).toBe(119);
    expect(projects).toHaveLength(119);
    expect(projects.map(p => p.objectId)).toEqual(
      fixture.features.map(f => f.properties.OBJECTID as number).sort((a, b) => a - b),
    );
    for (const project of projects) {
      const raw = fixture.features.find(f => f.properties.OBJECTID === project.objectId);
      if (!raw) throw new Error('Unexpected model objectId');
      expect(Object.keys(project).sort()).toEqual(keys);
      expect(project.projectNo).toBe(raw.properties.PROJECT_NO);
      expect(project.description).toBe(raw.properties.DESCRIPTION ?? '');
      expect(project.status).toBe(raw.properties.STATUS ?? '');
      expect(project.recordUrl).toBe(safeRecordUrl(raw.properties.WEBLINK));
      expect(project.geometry).toEqual(raw.geometry);
      expect(project.geometry).not.toBe(raw.geometry);
      expect(project.longitude).toBe(raw.properties.assign_lon);
      expect(project.latitude).toBe(raw.properties.assign_lat);
      expect(project.sourceUrl).toBe(SOURCE.source_url);
      expect(project.retrievedAt).toBe(SOURCE.retrieved_at);
      expect(project.modelType).toBe('schematic');
      expect({ heightM: project.heightM, heightRule: project.heightRule })
        .toEqual(heightFromDescription(project.description));
    }
    expect(fixture).toEqual(savedFixture);
    expect(SOURCE).toEqual(savedSource);
  });

  it('models 43 storeys × 3 = 129 m, explicitly not an approved height', () => {
    const project = project207(baseline());
    expect(project).toMatchObject({
      objectId: 207, projectNo: '19-0234-00', longitude: -122.852676,
      latitude: 49.190975, heightM: 129, modelType: 'schematic',
    });
    expect(project.description).toMatch(/43\s*-?\s*storeys?/i);
    expectEstimate(project.heightRule, 43);
  });

  it('accepts an empty FeatureCollection', () => {
    expect(buildBaseline({ type: 'FeatureCollection', features: [] }, SOURCE)).toEqual([]);
  });

  it('sorts and deeply clones 3D polygons, holes, and multiple polygons', () => {
    const a = clone(SHOWCASE), b = clone(SHOWCASE);
    a.properties.OBJECTID = 2;
    b.properties.OBJECTID = 1;
    a.geometry = { type: 'Polygon', coordinates: [clone(ring3D), clone(ring)] };
    b.geometry = { type: 'MultiPolygon', coordinates: [[clone(ring3D)], [clone(ring)]] };
    const c = freeze({ type: 'FeatureCollection', features: [a, b] });
    const saved = clone(c);
    const projects = buildBaseline(c, SOURCE);
    expect(projects.map(p => p.objectId)).toEqual([1, 2]);
    expect(projects.map(p => p.geometry)).toEqual([b.geometry, a.geometry]);
    for (const version of [v1, { ...v2, changes: [{ objectId: 1, estimatedHeightM: 135 }] }]) {
      const copied = applyVersion(freeze(clone(projects)), freeze(version));
      expect(copied.map(p => p.geometry)).toEqual(projects.map(p => p.geometry));
      for (const p of copied) {
        const position = p.geometry.type === 'Polygon'
          ? p.geometry.coordinates[0]?.[0] : p.geometry.coordinates[0]?.[0]?.[0];
        if (!position) throw new Error('Missing cloned position');
        position[0] = 0;
        position[2] = 999;
      }
      expect(projects.map(p => p.geometry)).toEqual([b.geometry, a.geometry]);
    }
    const geometry = projects[0]?.geometry;
    if (!geometry || geometry.type !== 'MultiPolygon') throw new Error('Missing MultiPolygon');
    const position = geometry.coordinates[0]?.[0]?.[0];
    if (!position) throw new Error('Missing 3D position');
    position[2] = 777;
    expect(c).toEqual(saved);
  });

  it.each([
    null, [], {}, { type: 'Feature', features: [] },
    { type: 'FeatureCollection' }, { type: 'FeatureCollection', features: null },
    { type: 'FeatureCollection', features: {} },
  ])('rejects malformed collections %j', value => {
    expect(() => buildBaseline(value, SOURCE)).toThrow();
  });

  it.each([null, [], {}, { type: 'Point' }, { type: 'Feature', properties: null },
    { type: 'Feature', properties: [] }])('rejects malformed features %j', feature => {
    expect(() => buildBaseline({ type: 'FeatureCollection', features: [feature] }, SOURCE)).toThrow();
  });

  it.each([undefined, null, '207', 0, -1, 1.5, NaN, Infinity])(
    'rejects malformed OBJECTID %j', value => {
      const c = single();
      first(c).properties.OBJECTID = value;
      expect(() => buildBaseline(c, SOURCE)).toThrow();
    },
  );

  it('rejects missing and duplicate OBJECTID', () => {
    const missing = single();
    delete first(missing).properties.OBJECTID;
    expect(() => buildBaseline(missing, SOURCE)).toThrow();
    const duplicate = single();
    duplicate.features.push(clone(first(duplicate)));
    expect(() => buildBaseline(duplicate, SOURCE)).toThrow();
  });

  it.each([undefined, null, '', '   ', 207])('rejects invalid PROJECT_NO %j', value => {
    const c = single();
    first(c).properties.PROJECT_NO = value;
    expect(() => buildBaseline(c, SOURCE)).toThrow();
  });

  it.each(['DESCRIPTION', 'STATUS'])('validates optional text %s without rewriting it', field => {
    for (const value of [null, undefined, '', '<script>alert(1)</script>']) {
      const c = single();
      first(c).properties[field] = value;
      const project = buildBaseline(freeze(c), SOURCE)[0];
      expect(project?.[field === 'DESCRIPTION' ? 'description' : 'status']).toBe(value ?? '');
    }
    for (const value of [1, false, {}, []]) {
      const c = single();
      first(c).properties[field] = value;
      expect(() => buildBaseline(c, SOURCE)).toThrow();
    }
  });

  it.each([
    null, [], {}, { ...SOURCE, source_url: undefined }, { ...SOURCE, source_url: 1 },
    { ...SOURCE, source_url: 'invalid' }, { ...SOURCE, source_url: 'http://example.com' },
    { ...SOURCE, layer: undefined }, { ...SOURCE, layer: 1 }, { ...SOURCE, layer: ' ' },
    { ...SOURCE, retrieved_at: undefined }, { ...SOURCE, retrieved_at: 1 },
    { ...SOURCE, retrieved_at: 'not a date' },
  ])('rejects malformed provenance %j', invalidSource => {
    expect(() => buildBaseline(single(), freeze(invalidSource))).toThrow();
  });

  it.each([
    ['assign_lon', NaN], ['assign_lon', Infinity], ['assign_lon', -Infinity],
    ['assign_lon', 181], ['assign_lon', -181], ['assign_lon', '-123'],
    ['assign_lat', NaN], ['assign_lat', Infinity], ['assign_lat', -Infinity],
    ['assign_lat', 91], ['assign_lat', -91], ['assign_lat', null],
  ])('rejects assigned coordinate %s=%j', (field, value) => {
    const c = single();
    first(c).properties[field] = value;
    expect(() => buildBaseline(c, SOURCE)).toThrow();
  });

  it.each([
    null, [], { type: 'Point', coordinates: [0, 0] },
    { type: 'Polygon' }, { type: 'Polygon', coordinates: [] },
    { type: 'MultiPolygon', coordinates: null }, { type: 'MultiPolygon', coordinates: [] },
    { type: 'MultiPolygon', coordinates: [[]] },
    { type: 'Polygon', coordinates: [null] },
    { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] },
    { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [2, 2]]] },
    { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [2, 2]]]] },
  ])('rejects malformed or unclosed geometry %j', geometry => {
    const c = single();
    first(c).geometry = geometry;
    expect(() => buildBaseline(c, SOURCE)).toThrow();
  });

  it.each([
    null, [], [0], [0, 0, 0, 0], ['0', 0], [0, null],
    [181, 49], [-181, 49], [-123, 91], [-123, -91],
    [NaN, 49], [Infinity, 49], [-123, -Infinity],
    [-123, 49, NaN], [-123, 49, Infinity], [-123, 49, '10'],
  ])('rejects invalid positions %j in either geometry type', position => {
    for (const type of ['Polygon', 'MultiPolygon']) {
      const c = single();
      const invalidRing = [position, [-122, 49], [-122, 50], position];
      first(c).geometry = {
        type, coordinates: type === 'Polygon' ? [invalidRing] : [[invalidRing]],
      };
      expect(() => buildBaseline(c, SOURCE)).toThrow();
    }
  });

  it('accepts coordinate boundaries and finite negative altitude', () => {
    const c = single();
    Object.assign(first(c).properties, { assign_lon: -180, assign_lat: 90 });
    first(c).geometry = {
      type: 'Polygon', coordinates: [[[-180, -90, -10], [180, -90, 0],
        [180, 90, 10], [-180, -90, -10]]],
    };
    expect(buildBaseline(freeze(c), SOURCE)[0]).toMatchObject({
      longitude: -180, latitude: 90, geometry: first(c).geometry,
    });
  });
});

describe('validateVersion', () => {
  it('validates and independently clones both real demonstration files', () => {
    expect(v1.version).toBe('v1');
    expect(v1.changes).toEqual([]);
    expect(v2.version).toBe('v2');
    expect(v2.changes).toEqual([{ objectId: 207, estimatedHeightM: 135 }]);
    for (const version of [v1, v2]) {
      expect(version.label).toMatch(/demonstration/i);
      expect(version.label).toMatch(/not\b[^.;]*\bCity\b/i);
      const saved = clone(version);
      const validated = validateVersion(version);
      expect(validated).toEqual(version);
      expect(validated).not.toBe(version);
      expect(validated.changes).not.toBe(version.changes);
      if (validated.changes[0]) validated.changes[0].estimatedHeightM = 999;
      validated.changes.push({ objectId: 1, estimatedHeightM: 0 });
      expect(version).toEqual(saved);
    }
  });

  const invalidVersions: unknown[] = [
    null, [], 'v2', {}, { ...v2, extra: true },
    { ...v2, version: undefined }, { ...v2, version: 'v3' }, { ...v2, version: 2 },
    ...[undefined, null, 1, '', '   ', 'a'.repeat(301)].map(label => ({ ...v2, label })),
    ...[undefined, null, {}].map(changes => ({ ...v2, changes })),
    ...[null, [], 207, {}, { objectId: 207, estimatedHeightM: 135, extra: true }]
      .map(change => ({ ...v2, changes: [change] })),
    ...[undefined, null, '207', 0, -999, 1.5, NaN, Infinity].map(objectId =>
      ({ ...v2, changes: [{ objectId, estimatedHeightM: 135 }] })),
    ...[undefined, null, '135', -1, NaN, Infinity, -Infinity].map(estimatedHeightM =>
      ({ ...v2, changes: [{ objectId: 207, estimatedHeightM }] })),
    { ...v2, changes: [{ objectId: 207, estimatedHeightM: 135 },
      { objectId: 207, estimatedHeightM: 140 }] },
  ];
  it.each(invalidVersions)('rejects invalid update %# without mutating inputs', input => {
    const base = freeze(baseline()), saved = clone(base), savedInput = clone(input);
    freeze(input);
    expect(() => validateVersion(input)).toThrow();
    expect(() => applyVersion(base, input)).toThrow();
    expect(base).toEqual(saved);
    expect(input).toEqual(savedInput);
  });

  it('accepts a 300-character label and finite zero or fractional estimates', () => {
    for (const height of [0, 135.5]) {
      const input = freeze({ ...v2, label: 'a'.repeat(300),
        changes: [{ objectId: 207, estimatedHeightM: height }] });
      expect(validateVersion(input)).toEqual(input);
      const project = project207(applyVersion(freeze(baseline()), input));
      expect(project.heightM).toBe(height);
      expectCorrection(project.heightRule, height);
    }
  });

  it('rejects a valid but unknown ID when resolving against the baseline', () => {
    const input = freeze({ ...v2, changes: [{ objectId: 999999, estimatedHeightM: 135 }] });
    expect(validateVersion(input)).toEqual(input);
    const base = freeze(baseline()), saved = clone(base);
    expect(() => applyVersion(base, input)).toThrow();
    expect(base).toEqual(saved);
  });
});

describe('immutable correction and exact rollback', () => {
  it('repeatedly changes only showcase height/provenance and restores the entire baseline', () => {
    const base = freeze(baseline()), saved = clone(base);
    const savedFixture = clone(fixture), savedSource = clone(SOURCE);
    const savedV1 = clone(v1), savedV2 = clone(v2);
    let priorUpdate: Project[] | undefined;
    for (let cycle = 0; cycle < 6; cycle++) {
      const updated = freeze(applyVersion(base, v2));
      const original = project207(base), changed = project207(updated);
      expect(changed.heightM).toBe(135);
      expect(changed.heightRule).not.toBe(original.heightRule);
      expectCorrection(changed.heightRule, 135);
      expect(withoutHeight(changed)).toStrictEqual(withoutHeight(original));
      expect(updated.map(p => p.objectId)).toEqual(base.map(p => p.objectId));
      expect(updated.filter(p => p.objectId !== 207))
        .toStrictEqual(base.filter(p => p.objectId !== 207));
      if (priorUpdate) expect(updated).toStrictEqual(priorUpdate);
      expect(diffStates(base, updated)).toEqual([
        { objectId: 207, projectNo: '19-0234-00', field: 'heightM', before: 129, after: 135 },
      ]);
      const restored = freeze(applyVersion(base, v1));
      expect(restored).toStrictEqual(base);
      expectEstimate(project207(restored).heightRule, 43);
      expect(diffStates(updated, restored)).toEqual([
        { objectId: 207, projectNo: '19-0234-00', field: 'heightM', before: 135, after: 129 },
      ]);
      expect(diffStates(base, restored)).toEqual([]);
      expect(base).toStrictEqual(saved);
      expect(fixture).toStrictEqual(savedFixture);
      expect(SOURCE).toStrictEqual(savedSource);
      expect(v1).toStrictEqual(savedV1);
      expect(v2).toStrictEqual(savedV2);
      priorUpdate = updated;
    }
  });

  it.each([null, {}, [null], [{ objectId: '207' }]])(
    'rejects malformed baseline %j', value => {
      expect(() => applyVersion(value as never, v1)).toThrow();
    },
  );

  it('rejects duplicate baseline IDs', () => {
    const p = project207(baseline());
    expect(() => applyVersion(freeze([p, clone(p)]), v1)).toThrow();
  });
});

describe('height-only diffs', () => {
  it('ignores every non-height field, including provenance rules and geometry', () => {
    const base = freeze(baseline()), edited = clone(base);
    const p = project207(edited);
    Object.assign(p, {
      projectNo: 'Other number', description: 'Other text', status: 'Other status',
      recordUrl: null, sourceUrl: 'https://example.com', retrievedAt: 'Other date',
      longitude: 0, latitude: 0, heightRule: 'Other provenance',
      geometry: { type: 'Polygon', coordinates: [clone(ring)] },
    });
    expect(diffStates(base, freeze(edited))).toEqual([]);
    expect(diffStates(base, base)).toEqual([]);
    expect(diffStates([], [])).toEqual([]);
  });

  it('matches by ID regardless of ordering and sorts multiple diffs by ID', () => {
    const base = freeze(baseline());
    const firstProject = base[0];
    if (!firstProject) throw new Error('Empty baseline');
    const selected = [firstProject, project207(base)];
    const changes = selected.map(p => ({
      objectId: p.objectId, estimatedHeightM: p.heightM + 1,
    }));
    const after = freeze(applyVersion(base, { ...v2, changes }).reverse());
    expect(diffStates(base, after)).toEqual(selected.map(p => ({
      objectId: p.objectId, projectNo: p.projectNo, field: 'heightM',
      before: p.heightM, after: p.heightM + 1,
    })).sort((a, b) => a.objectId - b.objectId));
  });

  it('rejects missing, substituted, duplicate, or malformed state entries in either input', () => {
    const base = freeze(baseline()), saved = clone(base);
    const substituted = clone(base);
    project207(substituted).objectId = 999999;
    const p = project207(base);
    const invalid: unknown[] = [
      null, {}, [null], [{ objectId: '207' }],
      base.slice(1), substituted, [...base, clone(p)],
      base.map(item => item.objectId === 207 ? clone(base[0]) : item),
    ];
    for (const state of invalid) {
      freeze(state);
      expect(() => diffStates(base, state as never)).toThrow();
      expect(() => diffStates(state as never, base)).toThrow();
    }
    expect(base).toStrictEqual(saved);
  });
});
