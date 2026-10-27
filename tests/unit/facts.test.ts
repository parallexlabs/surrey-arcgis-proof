// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createAssetFacts, createProjectFacts, formatHeight, ILLUSTRATIVE_ASSET, safeSourceUrl,
} from '../../src/facts';
import { applyVersion, buildBaseline, safeRecordUrl } from '../../src/model';
import type { Project, SourceEntry, UpdateVersion } from '../../src/model';

// Use real project-root fixtures independently of jsdom URL resolution.
const fixtureRoot = resolve(process.cwd(), 'public', 'data');
const read = (file: string): unknown => JSON.parse(readFileSync(
  resolve(fixtureRoot, file), 'utf8',
));
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(child => freeze(child));
    Object.freeze(value);
  }
  return value;
}
const sources = read('SOURCES.json') as SourceEntry[];
const source = sources.find(entry => entry.file === 'development_projects.geojson');
if (!source) throw new Error('Missing project provenance');
const SOURCE = freeze(source);
const projects = freeze(buildBaseline(freeze(read('development_projects.geojson')), SOURCE));
const showcase = projects.find(project => project.objectId === 207);
if (!showcase) throw new Error('Missing showcase');
const SHOWCASE = showcase;
const V1 = freeze(read('updates/v1.json') as UpdateVersion);
const V2 = freeze(read('updates/v2.json') as UpdateVersion);
const RECORD = 'https://citizenportal.surrey.ca/record/207';
const SERVICE =
  'https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/Development%20Applications/FeatureServer/0';

function value(article: HTMLElement, term: string): HTMLElement {
  const dt = Array.from(article.querySelectorAll('dt')).find(node => node.textContent === term);
  const dd = dt?.nextElementSibling;
  if (!(dd instanceof HTMLElement) || dd.tagName !== 'DD') {
    throw new Error(`Missing accessible facts row: ${term}`);
  }
  return dd;
}
function mount(article: HTMLElement): HTMLElement {
  document.body.append(article);
  return article;
}
function expectSecureLinks(article: HTMLElement): void {
  for (const anchor of article.querySelectorAll('a')) {
    expect(anchor.target).toBe('_blank');
    expect(anchor.relList.contains('noopener')).toBe(true);
    expect(anchor.relList.contains('noreferrer')).toBe(true);
    expect(anchor.textContent).toMatch(/opens in new tab/i);
    expect(new URL(anchor.href).protocol).toBe('https:');
  }
}
afterEach(() => document.body.replaceChildren());

describe('createProjectFacts', () => {
  it('provides every project’s equivalent source and schematic-model facts', () => {
    const savedProjects = structuredClone(projects), savedSource = structuredClone(SOURCE);
    expect(projects).toHaveLength(119);
    for (const project of projects) {
      const article = createProjectFacts(project, SOURCE.layer);
      expect(article.tagName).toBe('ARTICLE');
      expect(article.getAttribute('aria-label')).toBe(`Project ${project.projectNo}`);
      expect(article.querySelector('h3')?.textContent).toContain(project.projectNo);
      expect(article.dataset.objectId).toBe(String(project.objectId));
      expect(value(article, 'Project number').textContent).toBe(project.projectNo);
      expect(value(article, 'OBJECTID').textContent).toBe(String(project.objectId));
      expect(value(article, 'Description').textContent)
        .toBe(project.description.trim() || 'No description in public record');
      expect(value(article, 'Status').textContent)
        .toBe(project.status.trim() || 'Not stated in public record');
      expect(value(article, 'Source layer').textContent).toBe(SOURCE.layer);
      expect(value(article, 'Snapshot retrieved').textContent).toBe(SOURCE.retrieved_at);
      expect(value(article, 'Location').textContent).toContain(project.latitude.toFixed(6));
      expect(value(article, 'Location').textContent).toContain(project.longitude.toFixed(6));
      expect(value(article, 'Estimated height').textContent).toContain(formatHeight(project.heightM));
      expect(value(article, 'Estimated height').textContent).toMatch(/never an approved height/i);
      expect(value(article, 'Height rule').textContent).toBe(project.heightRule);
      expect(value(article, 'Model type').textContent).toMatch(/schematic/i);
      expect(value(article, 'Model type').textContent).toMatch(/not a building footprint/i);
      const record = value(article, 'Public record').querySelector('a');
      expect(record?.href ?? null).toBe(safeRecordUrl(project.recordUrl));
      expect(value(article, 'Source service').querySelector('a')?.href).toBe(SERVICE);
      expectSecureLinks(article);
    }
    expect(projects).toStrictEqual(savedProjects);
    expect(SOURCE).toStrictEqual(savedSource);
  });

  it('exposes usable, secure record and provenance links with new-tab warnings', () => {
    const article = mount(createProjectFacts(freeze({ ...SHOWCASE, recordUrl: RECORD }), SOURCE.layer));
    const record = value(article, 'Public record').querySelector('a');
    const service = value(article, 'Source service').querySelector('a');
    expect(record?.href).toBe(RECORD);
    expect(record?.textContent).toContain('19-0234-00');
    expect(service?.href).toBe(SERVICE);
    expect(article.querySelectorAll('a')).toHaveLength(2);
    expectSecureLinks(article);
  });

  it('renders literal hostile text without creating executable or injected elements', () => {
    const payload = '<img src=x onerror=alert(1)><script>alert(2)</script><a href="javascript:alert(3)">x</a>';
    const project = freeze({
      ...SHOWCASE, projectNo: payload, description: payload, status: payload,
      retrievedAt: payload, heightRule: payload,
      recordUrl: 'javascript:alert(1)', sourceUrl: 'data:text/html,<script>alert(1)</script>',
    });
    const saved = structuredClone(project);
    const article = mount(createProjectFacts(project, payload));
    for (const term of [
      'Project number', 'Description', 'Status', 'Snapshot retrieved', 'Height rule', 'Source layer',
    ]) {
      expect(value(article, term).textContent).toBe(payload);
    }
    expect(article.querySelector('h3')?.textContent).toBe(`Project ${payload}`);
    expect(article.querySelectorAll('script,img,iframe,svg,a')).toHaveLength(0);
    expect(article.querySelectorAll('[onerror],[onclick],[onload]')).toHaveLength(0);
    expect(project).toStrictEqual(saved);
  });

  it.each(['', ' \n\t '])('labels absent description and status %j', text => {
    const article = createProjectFacts(freeze({ ...SHOWCASE, description: text, status: text }), SOURCE.layer);
    expect(value(article, 'Description').textContent).toMatch(/no description.*public record/i);
    expect(value(article, 'Status').textContent).toMatch(/not stated.*public record/i);
  });

  it('shows correction provenance and restores the exact baseline facts on rollback', () => {
    const updated = freeze(applyVersion(projects, V2));
    const changed = updated.find(project => project.objectId === 207);
    if (!changed) throw new Error('Missing corrected showcase');
    const originalFacts = createProjectFacts(SHOWCASE, SOURCE.layer);
    const changedFacts = createProjectFacts(changed, SOURCE.layer);
    expect(value(originalFacts, 'Estimated height').textContent).toMatch(/\b129 m\b/);
    expect(value(changedFacts, 'Estimated height').textContent).toMatch(/\b135 m\b/);
    expect(value(changedFacts, 'Height rule').textContent).toMatch(/local/i);
    expect(value(changedFacts, 'Height rule').textContent).toMatch(/demonstration/i);
    expect(value(changedFacts, 'Height rule').textContent).toMatch(/not\b[^.;]*City/i);
    for (const term of [
      'Project number', 'OBJECTID', 'Description', 'Status', 'Public record',
      'Source layer', 'Source service', 'Snapshot retrieved', 'Location', 'Model type',
    ]) {
      expect(value(changedFacts, term).textContent).toBe(value(originalFacts, term).textContent);
    }
    const restored = applyVersion(projects, V1).find(project => project.objectId === 207);
    if (!restored) throw new Error('Missing rolled-back showcase');
    expect(createProjectFacts(restored, SOURCE.layer).outerHTML).toBe(originalFacts.outerHTML);
  });
});

describe('outbound URL security', () => {
  it.each([
    [SERVICE, SERVICE],
    [` ${SERVICE} `, SERVICE],
    [SERVICE.replace('services5.arcgis.com', 'SERVICES5.ARCGIS.COM:443'), SERVICE],
    [`${SERVICE}?f=pjson#layer`, `${SERVICE}?f=pjson#layer`],
    [null, null], [undefined, null], [1, null], [{}, null],
    ['', null], ['invalid URL', null], ['javascript:alert(1)', null],
    ['data:text/html,test', null], [SERVICE.replace('https:', 'http:'), null],
    [SERVICE.replace('services5.arcgis.com', 'services5.arcgis.com.evil.example'), null],
    [SERVICE.replace('services5.arcgis.com', 'services5.arcgis.com@evil.example'), null],
    [SERVICE.replace('services5.arcgis.com', 'user@services5.arcgis.com'), null],
    [SERVICE.replace('services5.arcgis.com', 'user:password@services5.arcgis.com'), null],
    [SERVICE.replace('services5.arcgis.com', ':password@services5.arcgis.com'), null],
    [SERVICE.replace('services5.arcgis.com', 'services5.arcgis.com:444'), null],
    [SERVICE.replace('YRpe0VKTJytZSSIB', 'another-tenant'), null],
    [SERVICE.replace('/services/', '/services-evil/'), null],
    ['https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/../evil', null],
    ['//services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/test', null],
  ])('validates source URL %j and prevents unsafe DOM links', (input, expected) => {
    expect(safeSourceUrl(input)).toBe(expected);
    if (typeof input !== 'string') return;
    const article = createProjectFacts(freeze({ ...SHOWCASE, sourceUrl: input }), SOURCE.layer);
    const row = value(article, 'Source service');
    expect(row.querySelector('a')?.href ?? null).toBe(expected);
    if (expected === null) expect(row.textContent).toMatch(/not validated/i);
    expectSecureLinks(article);
  });

  const prefix = 'https://citizenportal.surrey.ca/';
  it.each([
    [RECORD, RECORD], [` ${RECORD} `, RECORD],
    [RECORD.replace('surrey.ca', 'surrey.ca:443'), RECORD],
    [null, null], ['', null], ['javascript:alert(1)', null],
    ['data:text/html,test', null], [RECORD.replace('https:', 'http:'), null],
    [RECORD.replace('surrey.ca', 'surrey.ca.evil.example'), null],
    [RECORD.replace('citizenportal.surrey.ca', 'user@citizenportal.surrey.ca'), null],
    [RECORD.replace('citizenportal.surrey.ca', 'user:pass@citizenportal.surrey.ca'), null],
    [RECORD.replace('citizenportal.surrey.ca', ':pass@citizenportal.surrey.ca'), null],
    [RECORD.replace('surrey.ca', 'surrey.ca:444'), null],
    [RECORD.replace('citizenportal.surrey.ca', 'citizenportal.surrey.ca@evil.example'), null],
    ['//citizenportal.surrey.ca/207', null],
    [prefix + 'a'.repeat(2048 - prefix.length), prefix + 'a'.repeat(2048 - prefix.length)],
    [prefix + 'a'.repeat(2049 - prefix.length), null],
  ])('revalidates record URL %j at the DOM boundary', (input, expected) => {
    expect(safeRecordUrl(input)).toBe(expected);
    const article = createProjectFacts(freeze({ ...SHOWCASE, recordUrl: input }), SOURCE.layer);
    const row = value(article, 'Public record');
    expect(row.querySelector('a')?.href ?? null).toBe(expected);
    if (expected === null) expect(row.textContent).toMatch(/no validated public record link/i);
    expectSecureLinks(article);
  });
});

describe('illustrative asset facts', () => {
  it('keeps fixed 129 m dimensions and authorship independent of project corrections', () => {
    const savedAsset = structuredClone(ILLUSTRATIVE_ASSET);
    const savedProjects = structuredClone(projects);
    const baselineArticle = createAssetFacts(SHOWCASE);
    expect(ILLUSTRATIVE_ASSET.podium.heightM + ILLUSTRATIVE_ASSET.tower.heightM).toBe(129);
    for (const version of [V2, V1, V2, V1]) {
      const state = freeze(applyVersion(projects, version));
      const project = state.find(p => p.objectId === 207);
      if (!project) throw new Error('Missing asset placement project');
      const article = mount(createAssetFacts(project));
      expect(article.getAttribute('aria-label')).toMatch(/illustrative/i);
      expect(article.querySelector('h3')?.textContent).toMatch(/illustrative.*podium.*tower/i);
      expect(value(article, 'What it is').textContent).toMatch(/not an approved building design/i);
      expect(value(article, 'Placed at').textContent).toContain('19-0234-00');
      expect(value(article, 'Placed at').textContent).toContain('207');
      expect(value(article, 'Placed at').textContent).toContain('49.190975');
      expect(value(article, 'Placed at').textContent).toContain('-122.852676');
      expect(value(article, 'Podium').textContent).toMatch(/40 m.*30 m.*15 m/);
      expect(value(article, 'Tower').textContent).toMatch(/20 m.*20 m.*114 m/);
      expect(value(article, 'Overall height').textContent).toMatch(/\b129 m\b.*illustrative/i);
      expect(value(article, 'Overall height').textContent).toMatch(/unchanged.*demonstration/i);
      expect(value(article, 'Provenance').textContent).toBe(ILLUSTRATIVE_ASSET.provenance);
      expect(value(article, 'Provenance').textContent).toMatch(/ParalleX Labs Inc\./);
      expect(value(article, 'Provenance').textContent).toMatch(/not derived.*City.*approved design/i);
      expect(article.outerHTML).toBe(baselineArticle.outerHTML);
      expect(ILLUSTRATIVE_ASSET).toStrictEqual(savedAsset);
      expect(projects).toStrictEqual(savedProjects);
    }
  });

  it('treats hostile placement identifiers as literal text', () => {
    const payload = '<svg onload=alert(1)><script>alert(2)</script>';
    const project: Project = freeze({ ...SHOWCASE, projectNo: payload });
    const article = mount(createAssetFacts(project));
    expect(value(article, 'Placed at').textContent).toContain(payload);
    expect(article.querySelectorAll('svg,script,img,iframe,a,[onload]')).toHaveLength(0);
    expect(project.projectNo).toBe(payload);
  });
});

describe('formatHeight', () => {
  it.each([[0, '0 m'], [129, '129 m'], [135, '135 m'], [135.25, '135.3 m']])(
    'formats %s as %s', (height, expected) => {
      expect(formatHeight(height)).toBe(expected);
    },
  );
});
