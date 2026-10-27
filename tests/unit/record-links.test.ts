import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyVersion, buildBaseline, safeRecordUrl } from '../../src/model';
import type { Project, SourceEntry, UpdateVersion } from '../../src/model';

// Derived links may repair the verified legacy delimiter, never source facts.
// These are offline contracts; no portal requests or downstream login assertions.
const HOST = 'https://citizenportal.surrey.ca';
const FORWARD_PATH = '/citizenportal/integration/publicProjectForward.html';
const FORWARD = `${HOST}${FORWARD_PATH}`;
const DATA_ROOT = resolve(process.cwd(), 'public', 'data');
const fixturePath = resolve(DATA_ROOT, 'development_projects.geojson');
const sourcesPath = resolve(DATA_ROOT, 'SOURCES.json');
const fixtureBytes = readFileSync(fixturePath);
const sourcesBytes = readFileSync(sourcesPath);
const clone = <T>(value: T): T => structuredClone(value);
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(child => freeze(child));
    Object.freeze(value);
  }
  return value;
}
interface Feature {
  type: string;
  properties: {
    OBJECTID: number;
    PROJECT_NO: string;
    DESCRIPTION: string | null;
    STATUS: string | null;
    WEBLINK: string;
    assign_lon: number;
    assign_lat: number;
  };
  geometry: Project['geometry'];
}
interface Collection {
  type: string;
  features: Feature[];
}
const FIXTURE = freeze(JSON.parse(fixtureBytes.toString('utf8')) as Collection);
const rawSources: unknown = JSON.parse(sourcesBytes.toString('utf8'));
if (!Array.isArray(rawSources)) throw new Error('SOURCES.json must be an array');
const SOURCES = freeze(rawSources as SourceEntry[]);
const matches = SOURCES.filter(entry => entry.file === 'development_projects.geojson');
if (matches.length !== 1 || !matches[0]) {
  throw new Error('Expected exactly one development-project source entry');
}
const SOURCE = matches[0];
const readVersion = (file: string): UpdateVersion => JSON.parse(
  readFileSync(resolve(DATA_ROOT, 'updates', file), 'utf8'),
) as UpdateVersion;
const V1 = freeze(readVersion('v1.json'));
const V2 = freeze(readVersion('v2.json'));

function requiredUrl(value: string | null): URL {
  expect(value).not.toBeNull();
  if (value === null) throw new Error('Expected a validated derived record URL');
  return new URL(value);
}
function legacyParts(raw: string): { year: string; seq: string } {
  const url = new URL(raw);
  expect(url.origin).toBe(HOST);
  expect(url.pathname).toBe(FORWARD_PATH);
  expect(Array.from(url.searchParams.keys())).toEqual(['year']);
  const match = /^(\d{2}) seq=(\d{4})$/.exec(url.searchParams.get('year') ?? '');
  if (!match?.[1] || !match[2]) throw new Error(`Unexpected legacy fixture link: ${raw}`);
  return { year: match[1], seq: match[2] };
}
function sourceFacts(project: Project) {
  const { heightM: _heightM, heightRule: _heightRule, ...facts } = project;
  return facts;
}
function showcase(projects: readonly Project[]): Project {
  const project = projects.find(p => p.objectId === 207);
  if (!project) throw new Error('Missing showcase OBJECTID 207');
  return project;
}

describe('verified official forwarder normalization', () => {
  it.each([
    [`${FORWARD}?year=19 seq=0234`, `${FORWARD}?year=19&seq=0234`],
    [`${FORWARD}?year=19%20seq=0234`, `${FORWARD}?year=19&seq=0234`],
    [`${FORWARD}?year=19+seq=0234`, `${FORWARD}?year=19&seq=0234`],
    [`${FORWARD}?year=01 seq=0007`, `${FORWARD}?year=01&seq=0007`],
    [`${FORWARD}?year=00 seq=0000`, `${FORWARD}?year=00&seq=0000`],
    [`${FORWARD}?year=99 seq=9999`, `${FORWARD}?year=99&seq=9999`],
  ])('repairs only the missing delimiter in %s', (raw, expected) => {
    const normalized = safeRecordUrl(raw);
    expect(normalized).toBe(expected);
    expect(safeRecordUrl(normalized)).toBe(expected);
    const url = requiredUrl(normalized);
    expect(url.origin).toBe(HOST);
    expect(url.pathname).toBe(FORWARD_PATH);
    expect(Array.from(url.searchParams.keys())).toEqual(['year', 'seq']);
    expect(url.searchParams.getAll('year')).toHaveLength(1);
    expect(url.searchParams.getAll('seq')).toHaveLength(1);
  });

  it.each([
    `${FORWARD}?year=19&seq=0234`,
    `${FORWARD}?year=01&seq=0007`,
    `${FORWARD}?seq=0234&year=19`,
    `${FORWARD}?year=19&seq=0234#details`,
  ])('leaves already-canonical field pairs unchanged and idempotent %s', canonical => {
    expect(safeRecordUrl(canonical)).toBe(canonical);
    expect(safeRecordUrl(safeRecordUrl(canonical))).toBe(canonical);
  });

  it.each([
    `${HOST}/record/207`,
    `${HOST}/record/207?year=19 seq=0234`,
    `${FORWARD.replace('publicProjectForward.html', 'publicProjectForward.htm')}?year=19 seq=0234`,
    `${FORWARD}/?year=19 seq=0234`,
    `${FORWARD.replace('/integration/', '/other/')}?year=19 seq=0234`,
    `${FORWARD.replace('publicProjectForward', 'PublicProjectForward')}?year=19 seq=0234`,
    `${FORWARD}?year=19 seq=0234&extra=1`,
    `${FORWARD}?extra=1&year=19 seq=0234`,
    `${FORWARD}?year=19 seq=0234&year=20`,
    `${FORWARD}?year=19&year=20 seq=0234`,
    `${FORWARD}?year=19 seq=0234&seq=9999`,
    `${FORWARD}?year=19&seq=0234&seq=9999`,
    `${FORWARD}?year=19&seq=0234&year=20`,
    `${FORWARD}?Year=19 seq=0234`,
    `${FORWARD}?year=19 sequence=0234`,
    `${FORWARD}?year=1 seq=0234`,
    `${FORWARD}?year=019 seq=0234`,
    `${FORWARD}?year=19 seq=234`,
    `${FORWARD}?year=19 seq=00234`,
    `${FORWARD}?year=ab seq=0234`,
    `${FORWARD}?year=19 seq=abcd`,
    `${FORWARD}?year=19%2520seq=0234`,
    `${FORWARD}?year=19%20seq=0234%20suffix`,
    `${FORWARD}?year=19`,
    `${FORWARD}?seq=0234`,
  ])('does not invent fields for a safe unrecognized query or path %s', raw => {
    const expected = new URL(raw).href;
    const normalized = safeRecordUrl(raw);
    expect(normalized).toBe(expected);
    expect(safeRecordUrl(normalized)).toBe(expected);
    expect(Array.from(requiredUrl(normalized).searchParams.entries()))
      .toEqual(Array.from(new URL(raw).searchParams.entries()));
  });
});

describe('outbound security remains enforced before legacy repair', () => {
  it.each([
    `http://citizenportal.surrey.ca${FORWARD_PATH}?year=19 seq=0234`,
    `https://citizenportal.surrey.ca.evil.example${FORWARD_PATH}?year=19 seq=0234`,
    `https://citizenportal.surrey.ca@evil.example${FORWARD_PATH}?year=19 seq=0234`,
    `https://user@citizenportal.surrey.ca${FORWARD_PATH}?year=19 seq=0234`,
    `https://user:password@citizenportal.surrey.ca${FORWARD_PATH}?year=19 seq=0234`,
    `https://:password@citizenportal.surrey.ca${FORWARD_PATH}?year=19 seq=0234`,
    `https://citizenportal.surrey.ca:444${FORWARD_PATH}?year=19 seq=0234`,
    `https://citizenportal.surrey.ca:80${FORWARD_PATH}?year=19 seq=0234`,
    `//citizenportal.surrey.ca${FORWARD_PATH}?year=19 seq=0234`,
    `${FORWARD_PATH}?year=19 seq=0234`,
    `javascript:${FORWARD}?year=19 seq=0234`,
    `data:text/html,${FORWARD}?year=19 seq=0234`,
    'javascript:alert(1)',
    'not a URL',
    '',
    '   ',
    `${FORWARD}?year=19 seq=0234${'x'.repeat(2049)}`,
    null,
    undefined,
    207,
    {},
    [],
  ])('rejects unsafe input instead of repairing it %j', raw => {
    expect(safeRecordUrl(raw)).toBeNull();
  });

  it('retains trimming, default HTTPS port, host normalization, and length boundaries', () => {
    expect(safeRecordUrl(`  ${FORWARD}?year=19 seq=0234  `))
      .toBe(`${FORWARD}?year=19&seq=0234`);
    expect(safeRecordUrl(
      `https://CITIZENPORTAL.SURREY.CA:443${FORWARD_PATH}?year=19 seq=0234`,
    )).toBe(`${FORWARD}?year=19&seq=0234`);
    const prefix = `${HOST}/record/`;
    const atLimit = prefix + 'a'.repeat(2048 - prefix.length);
    expect(atLimit).toHaveLength(2048);
    expect(safeRecordUrl(atLimit)).toBe(atLimit);
    expect(safeRecordUrl(`${atLimit}a`)).toBeNull();
  });
});

describe('real snapshot derived record links', () => {
  it('repairs all 119 links while preserving raw legacy strings, IDs, facts, and fixture bytes', () => {
    const fixture = freeze(clone(FIXTURE));
    const sources = freeze(clone(SOURCES));
    const source = sources.find(entry => entry.file === 'development_projects.geojson');
    if (!source) throw new Error('Missing cloned provenance');
    const savedFixture = clone(fixture), savedSources = clone(sources);
    const baseline = freeze(buildBaseline(fixture, source));
    const savedBaseline = clone(baseline);
    const savedV1 = clone(V1), savedV2 = clone(V2);

    expect(fixture.type).toBe('FeatureCollection');
    expect(fixture.features).toHaveLength(119);
    expect(source.feature_count).toBe(119);
    expect(baseline).toHaveLength(119);
    expect(baseline.map(p => p.objectId)).toEqual(
      fixture.features.map(f => f.properties.OBJECTID).sort((a, b) => a - b),
    );
    let legacyCount = 0;
    for (const raw of fixture.features) {
      const { year, seq } = legacyParts(raw.properties.WEBLINK);
      legacyCount++;
      expect(raw.properties.WEBLINK).toBe(`${FORWARD}?year=${year} seq=${seq}`);
      const numberParts = /^(\d{2})-(\d{4})-/.exec(raw.properties.PROJECT_NO);
      expect(numberParts?.[1]).toBe(year);
      expect(numberParts?.[2]).toBe(seq);
      const project = baseline.find(p => p.objectId === raw.properties.OBJECTID);
      if (!project) throw new Error('Missing modeled fixture record');
      expect(project.recordUrl).toBe(`${FORWARD}?year=${year}&seq=${seq}`);
      const derived = requiredUrl(project.recordUrl);
      expect(derived.origin).toBe(HOST);
      expect(derived.pathname).toBe(FORWARD_PATH);
      expect(Array.from(derived.searchParams.entries())).toEqual([['year', year], ['seq', seq]]);
      expect(derived.username).toBe('');
      expect(derived.password).toBe('');
      expect(derived.port).toBe('');
      expect(safeRecordUrl(project.recordUrl)).toBe(project.recordUrl);
      expect(project).toMatchObject({
        projectNo: raw.properties.PROJECT_NO,
        description: raw.properties.DESCRIPTION ?? '',
        status: raw.properties.STATUS ?? '',
        longitude: raw.properties.assign_lon,
        latitude: raw.properties.assign_lat,
        geometry: raw.geometry,
        sourceUrl: source.source_url,
        retrievedAt: source.retrieved_at,
      });
    }
    expect(legacyCount).toBe(119);
    expect(showcase(baseline).recordUrl).toBe(`${FORWARD}?year=19&seq=0234`);
    expect(showcase(baseline).heightM).toBe(129);
    expect(V1.changes).toEqual([]);
    expect(V2.changes).toEqual([{ objectId: 207, estimatedHeightM: 135 }]);

    for (let cycle = 0; cycle < 3; cycle++) {
      const updated = freeze(applyVersion(baseline, V2));
      expect(showcase(updated).heightM).toBe(135);
      expect(updated.map(p => p.recordUrl)).toEqual(baseline.map(p => p.recordUrl));
      expect(updated.map(sourceFacts)).toStrictEqual(baseline.map(sourceFacts));
      expect(updated.filter(p => p.objectId !== 207))
        .toStrictEqual(baseline.filter(p => p.objectId !== 207));
      const restored = freeze(applyVersion(baseline, V1));
      expect(showcase(restored).heightM).toBe(129);
      expect(restored).toStrictEqual(baseline);
      expect(baseline).toStrictEqual(savedBaseline);
      expect(fixture).toStrictEqual(savedFixture);
      expect(sources).toStrictEqual(savedSources);
      expect(V1).toStrictEqual(savedV1);
      expect(V2).toStrictEqual(savedV2);
    }
    expect(fixture.features.filter(f =>
      /^(\d{2}) seq=(\d{4})$/.test(new URL(f.properties.WEBLINK).searchParams.get('year') ?? ''),
    )).toHaveLength(119);
    expect(readFileSync(fixturePath)).toEqual(fixtureBytes);
    expect(readFileSync(sourcesPath)).toEqual(sourcesBytes);
    expect(SOURCE).toStrictEqual(source);
  });
});
