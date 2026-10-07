import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataLoadError, loadProofData } from '../../src/data';
import type { Fetcher, ProofData } from '../../src/data';
import { applyVersion, diffStates } from '../../src/model';

// Public loader contracts and supplied modules: [4].
const BASE = '/demos/surrey-arcgis/';
const FILES = [
  'development_projects.geojson', 'SOURCES.json', 'skytrain.geojson',
  'updates/v1.json', 'updates/v2.json',
] as const;
type File = (typeof FILES)[number];
type Documents = Record<File, unknown>;
type Mutation = (documents: Documents) => void;
interface RawCollection {
  type: string;
  features: unknown[];
}
interface RawFeature {
  type: string;
  properties: Record<string, unknown>;
  geometry: unknown;
}
const clone = <T>(value: T): T => structuredClone(value);
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(child => freeze(child));
    Object.freeze(value);
  }
  return value;
}
function expectFrozen(value: unknown): void {
  if (value !== null && typeof value === 'object') {
    expect(Object.isFrozen(value)).toBe(true);
    Object.values(value).forEach(expectFrozen);
  }
}
function readDocuments(): Documents {
  return Object.fromEntries(FILES.map(file => [
    file, JSON.parse(readFileSync(
      new URL(`../../public/data/${file}`, import.meta.url), 'utf8',
    )) as unknown,
  ])) as Documents;
}
const FIXTURES = freeze(readDocuments());
function collection(documents: Documents, file: File): RawCollection {
  return documents[file] as RawCollection;
}
function feature(documents: Documents, file: File, index = 0): RawFeature {
  const value = collection(documents, file).features[index];
  if (!value) throw new Error(`Missing test feature in ${file}`);
  return value as RawFeature;
}
function source(documents: Documents, file: string): Record<string, unknown> {
  const entries = documents['SOURCES.json'] as Record<string, unknown>[];
  const entry = entries.find(item => item.file === file);
  if (!entry) throw new Error(`Missing test source for ${file}`);
  return entry;
}
function harness(documents = clone(FIXTURES), base = BASE) {
  const responses = new Map(FILES.map(file => [`${base}data/${file}`, documents[file]]));
  const fetcher = vi.fn<Fetcher>(async url => {
    if (!responses.has(url)) throw new Error(`Unexpected fixture request: ${url}`);
    return { ok: true, status: 200, json: async () => responses.get(url) };
  });
  return { documents, fetcher };
}
async function rejectMutation(mutate: Mutation): Promise<void> {
  const documents = clone(FIXTURES);
  mutate(documents);
  const saved = clone(documents);
  const { fetcher } = harness(freeze(documents));
  await expect(loadProofData(fetcher)).rejects.toBeInstanceOf(DataLoadError);
  expect(documents).toStrictEqual(saved);
}
function showcase(data: ProofData) {
  const project = data.baseline.find(p => p.objectId === 207);
  if (!project) throw new Error('Missing loaded showcase');
  return project;
}
afterEach(() => vi.unstubAllGlobals());

describe('loadProofData real fixtures', () => {
  it('requests exactly five local files and preserves the complete frozen snapshot', async () => {
    const { documents, fetcher } = harness();
    const saved = clone(documents);
    freeze(documents);
    const data = await loadProofData(fetcher);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(
      FILES.map(file => `${BASE}data/${file}`),
    );
    expect(data.baseline).toHaveLength(119);
    expect(data.skytrain.features).toHaveLength(225);
    expect(data.skytrain.features.filter(f => f.geometry.type === 'Point')).toHaveLength(17);
    expect(data.skytrain.features.filter(f => f.geometry.type !== 'Point')).toHaveLength(208);
    expect(data.sources).toStrictEqual(documents['SOURCES.json']);
    expect(data.projectSource).toStrictEqual(source(documents, FILES[0]));
    expect(data.transitSource).toStrictEqual(source(documents, FILES[2]));
    expect(data.sources).toContain(data.projectSource);
    expect(data.sources).toContain(data.transitSource);
    expect(data.projectSource.retrieved_at).toBe('2026-10-06T11:52:07.660949+00:00');
    expect(data.transitSource.retrieved_at).toBe('2026-10-06T05:58:23.972485+00:00');
    expect(data.versions.v1).toStrictEqual(documents['updates/v1.json']);
    expect(data.versions.v2).toStrictEqual(documents['updates/v2.json']);
    expect(data.versions.v1.changes).toEqual([]);
    expect(data.versions.v2.changes).toEqual([{ objectId: 207, estimatedHeightM: 135 }]);

    const rawProjects = collection(documents, FILES[0]).features as RawFeature[];
    expect(data.baseline.map(p => p.objectId)).toEqual(
      rawProjects.map(f => f.properties.OBJECTID as number).sort((a, b) => a - b),
    );
    for (const project of data.baseline) {
      const raw = rawProjects.find(f => f.properties.OBJECTID === project.objectId);
      if (!raw) throw new Error('Unexpected loaded project');
      expect(project.geometry).toStrictEqual(raw.geometry);
      expect(project.geometry).not.toBe(raw.geometry);
      expect(project.projectNo).toBe(raw.properties.PROJECT_NO);
      expect(project.description).toBe(raw.properties.DESCRIPTION ?? '');
      expect(project.status).toBe(raw.properties.STATUS ?? '');
      expect(project.longitude).toBe(raw.properties.assign_lon);
      expect(project.latitude).toBe(raw.properties.assign_lat);
      expect(project.sourceUrl).toBe(data.projectSource.source_url);
      expect(project.retrievedAt).toBe(data.projectSource.retrieved_at);
    }
    const rawTransit = collection(documents, FILES[2]).features as RawFeature[];
    data.skytrain.features.forEach((loaded, index) => {
      const raw = rawTransit[index];
      if (!raw) throw new Error('Missing transit fixture feature');
      expect(loaded.geometry).toStrictEqual(raw.geometry);
      expect(loaded.geometry).not.toBe(raw.geometry);
      expect(loaded.properties.name).toBe(
        typeof raw.properties?.name === 'string' ? raw.properties.name : null,
      );
    });
    expectFrozen(data);
    expect(documents).toStrictEqual(saved);
    expect(() => { data.baseline.push(showcase(data)); }).toThrow(TypeError);
    expect(() => { data.projectSource.layer = 'Rewritten source'; }).toThrow(TypeError);
  });

  it('supports repeated 129 → 135 corrections and exact rollback without changing sources', async () => {
    const { documents, fetcher } = harness(freeze(clone(FIXTURES)));
    const savedDocuments = clone(documents);
    const data = await loadProofData(fetcher);
    const saved = clone(data);
    expect(showcase(data)).toMatchObject({
      projectNo: '19-0234-00', heightM: 129,
      longitude: -122.852676, latitude: 49.190975,
    });
    expect(showcase(data).heightRule).toMatch(/estimate/i);
    expect(showcase(data).heightRule).toMatch(/not\b[^.;]*approved/i);
    for (let cycle = 0; cycle < 4; cycle++) {
      const updated = freeze(applyVersion(data.baseline, data.versions.v2));
      const changed = updated.find(p => p.objectId === 207);
      if (!changed) throw new Error('Correction removed showcase');
      expect(changed.heightM).toBe(135);
      expect(changed.heightRule).toMatch(/local/i);
      expect(changed.heightRule).toMatch(/demonstration/i);
      expect(changed.heightRule).toMatch(/not\b[^.;]*City/i);
      expect(changed.heightRule).toMatch(/source\s+facts\s+unchanged/i);
      expect({ ...changed, heightM: 129, heightRule: showcase(data).heightRule })
        .toStrictEqual(showcase(data));
      expect(updated.filter(p => p.objectId !== 207))
        .toStrictEqual(data.baseline.filter(p => p.objectId !== 207));
      expect(diffStates(data.baseline, updated)).toEqual([
        { objectId: 207, projectNo: '19-0234-00', field: 'heightM', before: 129, after: 135 },
      ]);
      const restored = applyVersion(data.baseline, data.versions.v1);
      expect(restored).toStrictEqual(data.baseline);
      expect(diffStates(updated, restored)).toEqual([
        { objectId: 207, projectNo: '19-0234-00', field: 'heightM', before: 135, after: 129 },
      ]);
      expect(data).toStrictEqual(saved);
      expect(documents).toStrictEqual(savedDocuments);
    }
  });

  it.each(['/local-proof', '/local-proof/', 'local-proof', '/'])(
    'resolves a local base path %s', async base => {
      const resolved = base.endsWith('/') ? base : `${base}/`;
      const { fetcher } = harness(clone(FIXTURES), resolved);
      expect((await loadProofData(fetcher, base)).baseline).toHaveLength(119);
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual(
        FILES.map(file => `${resolved}data/${file}`),
      );
    },
  );

  it('uses the default fetch boundary without contacting a network', async () => {
    const { fetcher } = harness();
    vi.stubGlobal('fetch', fetcher);
    expect((await loadProofData()).baseline).toHaveLength(119);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it.each([
    '', '   ', null, 5, 'https://example.com/', 'http://example.com/',
    '//example.com/', 'data:text/plain,test', '../proof/', '/proof/../other/',
  ])('rejects unsafe base paths before fetching %j', async base => {
    const { fetcher } = harness();
    await expect(loadProofData(fetcher, base as never)).rejects.toBeInstanceOf(DataLoadError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('fetch failures', () => {
  it.each(FILES)('rejects HTTP and JSON failures for %s', async file => {
    for (const mode of ['http', 'json'] as const) {
      const valid = harness();
      const fetcher: Fetcher = async url => {
        if (url === `${BASE}data/${file}`) {
          return {
            ok: mode !== 'http', status: mode === 'http' ? 503 : 200,
            json: async () => { throw new SyntaxError('Broken JSON'); },
          };
        }
        return valid.fetcher(url);
      };
      const error: unknown = await loadProofData(fetcher).catch(value => value);
      expect(error).toBeInstanceOf(DataLoadError);
      expect((error as Error).message).toContain(file);
      expect((error as Error).message).toMatch(mode === 'http' ? /HTTP 503/ : /invalid JSON/i);
    }
  });

  it.each([new Error('offline boundary'), 'offline boundary'])(
    'normalizes rejected fetch values %j', async reason => {
      const fetcher: Fetcher = async () => { throw reason; };
      const error: unknown = await loadProofData(fetcher).catch(value => value);
      expect(error).toBeInstanceOf(DataLoadError);
      expect((error as Error).message).toMatch(/network error/i);
      expect((error as Error).message).toContain('offline boundary');
    },
  );

  it('rejects a missing response', async () => {
    const fetcher: Fetcher = async () => null as never;
    await expect(loadProofData(fetcher)).rejects.toBeInstanceOf(DataLoadError);
  });
});

describe('SOURCES.json validation', () => {
  it.each([null, {}, 'sources'])('rejects non-array metadata %j', async value => {
    await rejectMutation(documents => { documents['SOURCES.json'] = value; });
  });

  it.each([FILES[0], FILES[2]])('requires one source entry for %s', async file => {
    await rejectMutation(documents => {
      documents['SOURCES.json'] = (documents['SOURCES.json'] as Record<string, unknown>[])
        .filter(entry => entry.file !== file);
    });
    await rejectMutation(documents => {
      (documents['SOURCES.json'] as unknown[]).push(clone(source(documents, file)));
    });
  });

  const badMetadata: [string, unknown][] = [
    ['source_url', undefined], ['source_url', 1], ['source_url', 'https://example.com/'],
    ['layer', undefined], ['layer', 1], ['layer', ' '],
    ['retrieved_at', undefined], ['retrieved_at', 1],
    ['retrieved_at', '2026-10-06'], ['retrieved_at', '2026-99-99T00:00:00Z'],
    ['feature_count', undefined], ['feature_count', 0], ['feature_count', '119'],
    ['licence', undefined], ['licence', 1], ['licence', ' '],
    ['licence_url', 1], ['licence_url', 'invalid'],
    ['licence_url', 'http://example.com/licence'], ['query', 1],
  ];
  it.each(badMetadata)('rejects source field %s=%j for either dataset', async (key, value) => {
    for (const file of [FILES[0], FILES[2]]) {
      await rejectMutation(documents => { source(documents, file)[key] = value; });
    }
  });

  it('allows absent optional provenance fields without inventing them', async () => {
    const documents = clone(FIXTURES);
    for (const file of [FILES[0], FILES[2]]) {
      delete source(documents, file).query;
      delete source(documents, file).licence_url;
    }
    const data = await loadProofData(harness(freeze(documents)).fetcher);
    expect(data.sources).toStrictEqual(documents['SOURCES.json']);
    for (const entry of data.sources) {
      expect(entry).not.toHaveProperty('query');
      expect(entry).not.toHaveProperty('licence_url');
    }
  });
});

describe('project snapshot validation', () => {
  const badProjects: [string, Mutation][] = [
    ['malformed collection', d => { d[FILES[0]] = null; }],
    ['wrong collection type', d => { collection(d, FILES[0]).type = 'Feature'; }],
    ['invalid feature', d => { collection(d, FILES[0]).features[0] = null; }],
    ['wrong feature type', d => { feature(d, FILES[0]).type = 'Point'; }],
    ['missing OBJECTID', d => { delete feature(d, FILES[0]).properties.OBJECTID; }],
    ['duplicate OBJECTID', d => {
      feature(d, FILES[0], 1).properties.OBJECTID = feature(d, FILES[0]).properties.OBJECTID;
    }],
    ['invalid text', d => { feature(d, FILES[0]).properties.DESCRIPTION = {}; }],
    ['invalid assigned coordinate', d => { feature(d, FILES[0]).properties.assign_lon = Infinity; }],
    ['invalid polygon', d => {
      feature(d, FILES[0]).geometry = { type: 'Polygon', coordinates: [] };
    }],
    ['invalid project count', d => { collection(d, FILES[0]).features.pop(); }],
    ['missing showcase', d => {
      const raw = (collection(d, FILES[0]).features as RawFeature[])
        .find(f => f.properties.OBJECTID === 207);
      if (!raw) throw new Error('Missing test showcase');
      raw.properties.OBJECTID = 999999;
    }],
  ];
  it.each(badProjects)('rejects %s', async (_name, mutate) => {
    await rejectMutation(mutate);
  });
});

describe('SkyTrain validation', () => {
  it.each([
    null, [], {}, { type: 'Feature', features: [] },
    { type: 'FeatureCollection', features: null },
  ])('rejects malformed transit collection %j', async value => {
    await rejectMutation(d => { d[FILES[2]] = value; });
  });

  it.each([null, {}, { type: 'Point' }])('rejects malformed transit feature %j', async value => {
    await rejectMutation(d => { collection(d, FILES[2]).features[0] = value; });
  });

  it.each([
    null, [], { type: 'Polygon', coordinates: [] },
    { type: 'Point', coordinates: null }, { type: 'Point', coordinates: [0] },
    { type: 'Point', coordinates: [0, 0, 0, 0] },
    { type: 'Point', coordinates: [NaN, 49] },
    { type: 'Point', coordinates: [-123, Infinity] },
    { type: 'Point', coordinates: [-123, 49, -Infinity] },
    { type: 'Point', coordinates: ['-123', 49] },
    { type: 'Point', coordinates: [181, 49] },
    { type: 'Point', coordinates: [-181, 49] },
    { type: 'Point', coordinates: [-123, 91] },
    { type: 'Point', coordinates: [-123, -91] },
    { type: 'LineString', coordinates: null },
    { type: 'LineString', coordinates: [[-123, 49]] },
    { type: 'MultiLineString', coordinates: null },
    { type: 'MultiLineString', coordinates: [] },
    { type: 'MultiLineString', coordinates: [[]] },
    { type: 'MultiLineString', coordinates: [[[-123, 49], [181, 49]]] },
  ])('rejects invalid geometry %j before accepting a dataset', async geometry => {
    await rejectMutation(d => { feature(d, FILES[2]).geometry = geometry; });
  });

  it('rejects count and point/line distribution mismatches', async () => {
    await rejectMutation(d => { collection(d, FILES[2]).features.pop(); });
    await rejectMutation(d => {
      const point = (collection(d, FILES[2]).features as RawFeature[])
        .find(f => (f.geometry as { type: string }).type === 'Point');
      if (!point) throw new Error('Missing test transit point');
      point.geometry = { type: 'LineString', coordinates: [[-123, 49], [-122, 50]] };
    });
  });

  it('accepts and clones multi-lines, 3D positions, boundaries, and missing names', async () => {
    const documents = clone(FIXTURES);
    const features = collection(documents, FILES[2]).features as RawFeature[];
    const line = features.find(f => (f.geometry as { type: string }).type !== 'Point');
    const point = features.find(f => (f.geometry as { type: string }).type === 'Point');
    if (!line || !point) throw new Error('Missing test transit geometry');
    line.geometry = {
      type: 'MultiLineString',
      coordinates: [
        [[-180, -90, -5], [180, 90, 10]],
        [[-123, 49], [-122, 50]],
      ],
    };
    line.properties = { name: '<img src=x onerror=alert(1)>' };
    point.geometry = { type: 'Point', coordinates: [-180, 90, 0] };
    point.properties = { name: 123 };
    const saved = clone(documents);
    const data = await loadProofData(harness(freeze(documents)).fetcher);
    const loadedLine = data.skytrain.features[features.indexOf(line)];
    const loadedPoint = data.skytrain.features[features.indexOf(point)];
    expect(loadedLine?.geometry).toStrictEqual(line.geometry);
    expect(loadedLine?.properties.name).toBe(line.properties.name);
    expect(loadedPoint?.geometry).toStrictEqual(point.geometry);
    expect(loadedPoint?.properties.name).toBeNull();
    expectFrozen(data);
    expect(documents).toStrictEqual(saved);
  });

  it('accepts absent or non-object name metadata as an unnamed context feature', async () => {
    for (const properties of [null, [], {}, { name: null }]) {
      const documents = clone(FIXTURES);
      const raw = feature(documents, FILES[2]) as unknown as Record<string, unknown>;
      raw.properties = properties;
      const data = await loadProofData(harness(freeze(documents)).fetcher);
      expect(data.skytrain.features[0]?.properties.name).toBeNull();
    }
  });
});

describe('update validation and guarded failures', () => {
  const badUpdates: [string, Mutation][] = [
    ['malformed v1', d => { d['updates/v1.json'] = null; }],
    ['malformed v2', d => { d['updates/v2.json'] = {}; }],
    ['extra key', d => {
      (d['updates/v2.json'] as Record<string, unknown>).extra = true;
    }],
    ['blank label', d => {
      (d['updates/v2.json'] as Record<string, unknown>).label = ' ';
    }],
    ['unknown version', d => {
      (d['updates/v2.json'] as Record<string, unknown>).version = 'v3';
    }],
    ['v1 file with wrong version', d => {
      (d['updates/v1.json'] as Record<string, unknown>).version = 'v2';
    }],
    ['v1 file with changes', d => {
      (d['updates/v1.json'] as Record<string, unknown>).changes =
        [{ objectId: 207, estimatedHeightM: 135 }];
    }],
    ['v2 file with wrong version', d => {
      (d['updates/v2.json'] as Record<string, unknown>).version = 'v1';
    }],
    ['v2 file with no changes', d => {
      (d['updates/v2.json'] as Record<string, unknown>).changes = [];
    }],
    ['unknown project', d => {
      (d['updates/v2.json'] as Record<string, unknown>).changes =
        [{ objectId: 999999, estimatedHeightM: 135 }];
    }],
    ['negative height', d => {
      (d['updates/v2.json'] as Record<string, unknown>).changes =
        [{ objectId: 207, estimatedHeightM: -1 }];
    }],
    ['nonfinite height', d => {
      (d['updates/v2.json'] as Record<string, unknown>).changes =
        [{ objectId: 207, estimatedHeightM: NaN }];
    }],
    ['duplicate changes', d => {
      (d['updates/v2.json'] as Record<string, unknown>).changes =
        [{ objectId: 207, estimatedHeightM: 135 }, { objectId: 207, estimatedHeightM: 140 }];
    }],
  ];
  it.each(badUpdates)('rejects %s', async (_name, mutate) => {
    await rejectMutation(mutate);
  });

  it.each([new Error('guard boundary failure'), 'guard boundary failure'])(
    'normalizes exceptions from validation without mocking validators %j', async reason => {
      const documents = clone(FIXTURES);
      Object.defineProperty(feature(documents, FILES[0]).properties, 'DESCRIPTION', {
        configurable: true,
        get() { throw reason; },
      });
      const error: unknown = await loadProofData(harness(documents).fetcher).catch(value => value);
      expect(error).toBeInstanceOf(DataLoadError);
      expect((error as Error).message).toContain('development_projects.geojson');
      expect((error as Error).message).toContain('guard boundary failure');
    },
  );
});
