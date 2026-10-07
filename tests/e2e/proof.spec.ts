import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test as base } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';
import type { Project } from '../../src/model';

const PATH = '/demos/surrey-arcgis/';
const READY_TIMEOUT = 90_000;
const RETRIEVED = '2026-10-06T11:52:07.660949+00:00';
const SOURCE_URL =
  'https://services5.arcgis.com/YRpe0VKTJytZSSIB/arcgis/rest/services/Development%20Applications/FeatureServer/0';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const readFixture = (file: string): unknown => JSON.parse(
  readFileSync(resolve(process.cwd(), 'public', 'data', file), 'utf8'),
);
interface RawFeature {
  properties: {
    OBJECTID: number;
    PROJECT_NO: string;
    DESCRIPTION: string | null;
    STATUS: string | null;
    assign_lon: number;
    assign_lat: number;
  };
  geometry: Project['geometry'];
}
const rawProjects = readFixture('development_projects.geojson') as {
  features: RawFeature[];
};
interface ProofState {
  version: 'v1' | 'v2';
  busy: boolean;
  sceneMode: 'not-started' | 'loading' | 'ready' | 'unavailable' | 'failed';
  projects: Project[];
}
interface ReadyScene {
  available: true;
  viewReady: boolean;
  viewUpdating: boolean;
  layers: { id: string; title: string | null; type: string; loadStatus: string }[];
  groundLayerCount: number;
  projectFeatureCount: number;
  showcaseHeightM: number | null;
  transitPointCount: number;
  transitLineCount: number;
  assetGraphicCount: number;
  assetMeshCount: number;
  assetZmaxM: number | null;
  popupVisible: boolean;
}
interface UnavailableScene {
  available: false;
  status: string;
  reason: string;
}
interface ViewContract {
  declaredClass: string;
  type: string;
  ready: boolean;
  updating: boolean;
  map: {
    ground: { layers: { length: number } };
    basemap: {
      baseLayers: {
        toArray(): { type: string; urlTemplate?: string; url?: string }[];
      };
    };
  };
  takeScreenshot(options: {
    format: 'png'; width: number; height: number;
  }): Promise<{
    dataUrl: string;
    data: { width: number; height: number; data: Uint8ClampedArray };
  }>;
}
interface ProofApi {
  getState(): ProofState;
  getSceneState(): Promise<ReadyScene | UnavailableScene>;
  openProject(id: number): Promise<boolean>;
  readonly view: ViewContract | null;
}
type ProofWindow = Window & {
  __proof: ProofApi;
  __webglAttempts?: number;
};
interface Audit {
  unexpectedRemote: string[];
  tiles: string[];
  sdkAssets: string[];
  localFailures: string[];
  consoleErrors: string[];
  pageErrors: string[];
}
const test = base.extend<{ audit: Audit }>({
  audit: [async ({ page, context, baseURL }, use, testInfo) => {
    if (!baseURL) throw new Error('Production baseURL is required');
    const origin = new URL(baseURL).origin;
    const audit: Audit = {
      unexpectedRemote: [], tiles: [], sdkAssets: [],
      localFailures: [], consoleErrors: [], pageErrors: [],
    };
    page.on('console', message => {
      if (message.type() === 'error') audit.consoleErrors.push(message.text());
    });
    page.on('pageerror', error => audit.pageErrors.push(error.message));
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.origin !== origin) return;
      if (response.status() >= 400) {
        audit.localFailures.push(`${response.status()} ${response.url()}`);
      }
      if (url.pathname.startsWith(`${PATH}arcgis-assets/`) && response.ok()) {
        audit.sdkAssets.push(response.url());
      }
    });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (!['http:', 'https:'].includes(url.protocol) || url.origin === origin) {
        await route.continue();
        return;
      }
      if (url.protocol === 'https:' && url.hostname === 'tile.openstreetmap.org'
        && url.port === '' && /^\/\d+\/\d+\/\d+\.png$/.test(url.pathname)
        && url.search === '') {
        audit.tiles.push(url.href);
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'access-control-allow-origin': '*' },
          body: PNG,
        });
        return;
      }
      audit.unexpectedRemote.push(url.href);
      await route.abort('blockedbyclient');
    });
    await use(audit);
    await testInfo.attach('network-and-browser-audit', {
      body: Buffer.from(JSON.stringify(audit, null, 2)),
      contentType: 'application/json',
    });
    expect(audit.unexpectedRemote, 'No remote services, authentication, or analytics').toEqual([]);
    expect(audit.localFailures, 'Production bundles, fixtures, and local SDK assets must load').toEqual([]);
    expect(audit.pageErrors, 'No unhandled browser exceptions').toEqual([]);
    expect(audit.consoleErrors, 'No application or SDK console errors').toEqual([]);
  }, { auto: true }],
});

const listProject = (page: Page) =>
  page.locator('#projects-list article[data-object-id="207"]');
const popupProject = (page: Page) =>
  page.locator('.esri-popup:visible article[data-object-id="207"]');
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as ProofWindow).__proof.getState());
const sceneState = (page: Page) =>
  page.evaluate(() => (window as unknown as ProofWindow).__proof.getSceneState());

function showcase(projects: Project[]): Project {
  const project = projects.find(p => p.objectId === 207);
  if (!project) throw new Error('Missing showcase');
  return project;
}
async function start(page: Page, mode: 'ready' | 'unavailable'): Promise<ProofState> {
  const response = await page.goto(PATH);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Surrey development applications/);
  await page.waitForFunction(() => Boolean((window as unknown as ProofWindow).__proof));
  await expect.poll(async () => {
    const current = await state(page);
    return { mode: current.sceneMode, busy: current.busy, count: current.projects.length };
  }, { timeout: READY_TIMEOUT }).toEqual({ mode, busy: false, count: 119 });
  await expect(page.locator('#apply-v2')).toBeEnabled();
  await expect(page.locator('#rollback-v1')).toBeEnabled();
  expect(await page.evaluate(() => ({
    frozen: Object.isFrozen((window as unknown as ProofWindow).__proof),
    writable: Object.getOwnPropertyDescriptor(window, '__proof')?.writable,
    optout: localStorage.getItem('vaadin.statistics.optout'),
    analytics: document.documentElement.dataset.analyticsOptout,
  }))).toEqual({ frozen: true, writable: false, optout: 'true', analytics: 'true' });
  return state(page);
}
async function expectScene(page: Page, height: number): Promise<void> {
  await expect.poll(async () => {
    const result = await sceneState(page);
    if (!result.available) return result;
    return {
      available: result.available,
      viewReady: result.viewReady,
      viewUpdating: result.viewUpdating,
      ground: result.groundLayerCount,
      projects: result.projectFeatureCount,
      height: result.showcaseHeightM,
      points: result.transitPointCount,
      lines: result.transitLineCount,
      graphics: result.assetGraphicCount,
      meshes: result.assetMeshCount,
      loaded: result.layers.length > 0 && result.layers.every(l => l.loadStatus === 'loaded'),
      types: result.layers.map(l => l.type).sort(),
    };
  }, { timeout: READY_TIMEOUT }).toEqual({
    available: true, viewReady: true, viewUpdating: false, ground: 0,
    projects: 119, height, points: 17, lines: 208, graphics: 2, meshes: 2,
    loaded: true, types: ['geojson', 'geojson', 'geojson', 'graphics', 'web-tile'],
  });

  // Only the projected physical mesh extent gets a <1 mm tolerance. [16]
  // Queried project heights above remain exactly 129 or 135, without rounding.
  const result = await sceneState(page);
  if (!result.available) {
    throw new Error(`Scene became unavailable during extent verification: ${result.reason}`);
  }
  const top = result.assetZmaxM;
  if (typeof top !== 'number' || !Number.isFinite(top)) {
    throw new Error('Actual asset mesh extent must have a finite numeric zmax');
  }
  expect(
    Math.abs(top - 129),
    `Physical asset zmax ${top} m must be within 0.001 m of 129 m`,
  ).toBeLessThan(0.001);
}
async function facts(article: Locator) {
  return article.locator('dl').evaluate(dl => Array.from(dl.querySelectorAll('dt')).map(dt => ({
    term: dt.textContent,
    value: dt.nextElementSibling?.textContent,
  })));
}
async function expectList(page: Page, current: ProofState): Promise<void> {
  await expect(page.locator('#projects-list > li')).toHaveCount(119);
  await expect(page.locator('#projects-list article')).toHaveCount(119);
  const ids = await page.locator('#projects-list article').evaluateAll(articles =>
    articles.map(article => Number((article as HTMLElement).dataset.objectId)),
  );
  expect(ids).toEqual(current.projects.map(p => p.objectId));
  for (const project of current.projects) {
    const raw = rawProjects.features.find(f => f.properties.OBJECTID === project.objectId);
    if (!raw) throw new Error('Project not present in real fixture');
    expect(project).toMatchObject({
      projectNo: raw.properties.PROJECT_NO,
      description: raw.properties.DESCRIPTION ?? '',
      status: raw.properties.STATUS ?? '',
      sourceUrl: SOURCE_URL, retrievedAt: RETRIEVED,
      longitude: raw.properties.assign_lon, latitude: raw.properties.assign_lat,
      geometry: raw.geometry, modelType: 'schematic',
    });
    expect(Object.keys(project).sort()).toEqual([
      'objectId', 'projectNo', 'description', 'status', 'recordUrl', 'sourceUrl',
      'retrievedAt', 'longitude', 'latitude', 'heightM', 'heightRule', 'modelType', 'geometry',
    ].sort());
  }
  const p = showcase(current.projects);
  await expect(listProject(page).locator('h3')).toHaveText('Project 19-0234-00');
  await expect(listProject(page)).toContainText(RETRIEVED);
  await expect(listProject(page)).toContainText(/43\s*-?\s*storeys?/i);
  await expect(listProject(page)).toContainText(`${p.heightM} m`);
  await expect(listProject(page)).toContainText(p.heightRule);
  await expect(listProject(page)).toContainText(/not a building footprint/i);
  const record = listProject(page).getByRole('link', { name: /City record/ });
  await expect(record).toHaveAttribute('href', /^https:\/\/citizenportal\.surrey\.ca\//);
  await expect(record).toHaveAttribute('target', '_blank');
}
async function openPopup(page: Page): Promise<void> {
  expect(await page.evaluate(() => (window as unknown as ProofWindow).__proof.openProject(207))).toBe(true);
  await expect(popupProject(page)).toBeVisible();
  await expect.poll(async () => {
    const result = await sceneState(page);
    return result.available && result.popupVisible;
  }).toBe(true);
  expect(await facts(popupProject(page))).toEqual(await facts(listProject(page)));
}
async function screenshot(testInfo: TestInfo, name: string, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await testInfo.attach(name, {
    body: await target.screenshot(),
    contentType: 'image/png',
  });
}
async function axe(page: Page, testInfo: TestInfo): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  await testInfo.attach('axe-results', {
    body: Buffer.from(JSON.stringify(results, null, 2)),
    contentType: 'application/json',
  });
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}
async function switchVersion(
  page: Page, original: ProofState, version: 'v1' | 'v2', key: 'Enter' | 'Space',
): Promise<void> {
  const control = page.locator(version === 'v2' ? '#apply-v2' : '#rollback-v1');
  await control.focus();
  await expect(control).toBeFocused();
  await page.keyboard.press(key);
  await expect.poll(async () => {
    const current = await state(page);
    return { version: current.version, busy: current.busy };
  }, { timeout: READY_TIMEOUT }).toEqual({ version, busy: false });
  await expect(control).toBeFocused();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#version-status')).toContainText(`Version ${version} active`);
  await expect(page.locator('#version-status')).toContainText(/demonstration/i);
  const current = await state(page);
  const changed = showcase(current.projects);
  if (version === 'v2') {
    expect(changed.heightM).toBe(135);
    expect(changed.heightRule).toMatch(/local/i);
    expect(changed.heightRule).toMatch(/demonstration/i);
    expect(changed.heightRule).toMatch(/not\b[^.;]*City/i);
    expect(changed.heightRule).toMatch(/source\s+facts\s+unchanged/i);
    expect({
      ...changed, heightM: 129, heightRule: showcase(original.projects).heightRule,
    }).toStrictEqual(showcase(original.projects));
    expect(current.projects.filter(p => p.objectId !== 207))
      .toStrictEqual(original.projects.filter(p => p.objectId !== 207));
    await expect(page.locator('#diff-list')).toContainText(/129 m\s*→\s*135 m/);
  } else {
    expect(current).toStrictEqual(original);
    await expect(page.locator('#diff-list')).toContainText(/135 m\s*→\s*129 m/);
  }
  await expect(page.locator('#diff-list > li')).toHaveCount(1);
  await expect(page.locator('#diff-list')).toContainText('19-0234-00');
  await expect(page.locator('#diff-list')).toContainText('207');
  await expect(listProject(page)).toContainText(`${changed.heightM} m`);
  await expect(listProject(page)).toContainText(changed.heightRule);
  if (original.sceneMode === 'ready') await expectScene(page, changed.heightM);
  else {
    expect(current.sceneMode).toBe('unavailable');
    expect(await sceneState(page)).toMatchObject({ available: false, status: 'unavailable' });
  }
}

test('real production SceneView, popup parity, correction, asset, and exact rollback',
  async ({ page, audit }, testInfo) => {
    const original = await start(page, 'ready');
    await expectList(page, original);
    expect(showcase(original.projects).heightM).toBe(129);
    expect(showcase(original.projects).heightRule).toMatch(/estimate/i);
    expect(showcase(original.projects).heightRule).toMatch(/not\b[^.;]*approved/i);
    await expectScene(page, 129);
    await expect(page.locator('#map canvas').first()).toBeVisible();
    expect(await page.evaluate(() => {
      const view = (window as unknown as ProofWindow).__proof.view;
      if (!view) throw new Error('Missing real SceneView');
      return {
        className: view.declaredClass, type: view.type,
        ready: view.ready, updating: view.updating,
        ground: view.map.ground.layers.length,
        basemap: view.map.basemap.baseLayers.toArray().map(layer => ({
          type: layer.type, url: layer.url ?? null, template: layer.urlTemplate,
        })),
      };
    })).toEqual({
      className: 'esri.views.SceneView', type: '3d', ready: true, updating: false,
      ground: 0,
      basemap: [{
        type: 'web-tile', url: null,
        template: 'https://tile.openstreetmap.org/{level}/{col}/{row}.png',
      }],
    });
    await expect.poll(() => audit.tiles.length).toBeGreaterThan(0);
    expect(audit.sdkAssets.length, 'SDK assets must come from the built subpath').toBeGreaterThan(0);
    const rendered = await page.evaluate(async () => {
      const view = (window as unknown as ProofWindow).__proof.view;
      if (!view) throw new Error('No view to capture');
      const capture = await view.takeScreenshot({ format: 'png', width: 640, height: 400 });
      const pixels = capture.data.data;
      const colors = new Set<string>();
      let opaque = 0;
      for (let i = 0; i < pixels.length; i += 4 * 17) {
        colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
        if ((pixels[i + 3] ?? 0) > 0) opaque++;
      }
      return {
        dataUrl: capture.dataUrl, width: capture.data.width, height: capture.data.height,
        pixelCount: pixels.length, colors: colors.size, opaque,
      };
    });
    expect(rendered.width).toBe(640);
    expect(rendered.height).toBe(400);
    expect(rendered.pixelCount).toBe(640 * 400 * 4);
    expect(rendered.colors, 'Real scene capture must not be a uniform blank image').toBeGreaterThan(1);
    expect(rendered.opaque).toBeGreaterThan(0);
    const encoded = rendered.dataUrl.split(',')[1];
    if (!encoded) throw new Error('SceneView returned no image data');
    await testInfo.attach('actual-sceneview-render', {
      body: Buffer.from(encoded, 'base64'), contentType: 'image/png',
    });
    await screenshot(testInfo, 'production-scene', page.locator('#map'));
    await screenshot(testInfo, 'illustrative-asset-facts', page.locator('#asset-facts'));
    const assetBefore = await page.locator('#asset-facts').innerHTML();
    await page.getByRole('button', { name: 'Show 19-0234-00 in 3D scene', exact: true }).click();
    await expect(popupProject(page)).toBeVisible();
    expect(await facts(popupProject(page))).toEqual(await facts(listProject(page)));
    await screenshot(testInfo, 'actual-project-popup', popupProject(page));

    await page.evaluate(() => {
      const api = (window as unknown as ProofWindow).__proof;
      const copy = api.getState();
      const first = copy.projects[0];
      if (!first) throw new Error('Missing state clone');
      first.heightM = -4242;
      copy.projects.pop();
    });
    expect(await state(page)).toStrictEqual(original);
    for (let cycle = 0; cycle < 2; cycle++) {
      await switchVersion(page, original, 'v2', 'Enter');
      await openPopup(page);
      await expect(popupProject(page)).toContainText('135 m');
      await expect(popupProject(page)).toContainText(/demonstration correction/i);
      expect(await page.locator('#asset-facts').innerHTML()).toBe(assetBefore);
      await switchVersion(page, original, 'v1', 'Space');
      await openPopup(page);
      await expect(popupProject(page)).toContainText('129 m');
      expect(await page.locator('#asset-facts').innerHTML()).toBe(assetBefore);
    }
  });

test('ready scene has a keyboard-operable equivalent list and zero full-page axe violations',
  async ({ page }, testInfo) => {
    const original = await start(page, 'ready');
    await expectScene(page, 129);
    await expectList(page, original);
    await page.locator('#skip-link').focus();
    await expect(page.locator('#skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#projects-heading')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#projects-list a').first()).toBeFocused();

    const linkProblems = await page.locator('#projects-list article').evaluateAll(articles => {
      const problems: string[] = [];
      for (const article of articles) {
        const record = Array.from(article.querySelectorAll('dt'))
          .find(dt => dt.textContent === 'Public record')?.nextElementSibling?.querySelector('a');
        if (!record) {
          problems.push(`Missing record link: ${(article as HTMLElement).dataset.objectId}`);
          continue;
        }
        const url = new URL(record.href);
        if (url.protocol !== 'https:' || url.hostname !== 'citizenportal.surrey.ca'
          || url.username || url.password || url.port
          || record.target !== '_blank'
          || !record.relList.contains('noopener') || !record.relList.contains('noreferrer')) {
          problems.push(`Unsafe record link: ${record.href}`);
        }
        record.focus();
        if (document.activeElement !== record) problems.push(`Not focusable: ${record.href}`);
      }
      return problems;
    });
    expect(linkProblems).toEqual([]);
    await expect(page.locator('#projects-list button')).toHaveCount(119);
    await page.locator('#apply-v2').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#rollback-v1')).toBeFocused();
    await expect(page.locator('footer')).toContainText('Powered by');
    await expect(page.locator('footer')).toContainText('Esri');
    await expect(page.locator('footer')).toContainText('OpenStreetMap contributors');
    await expect(page.locator('footer')).toContainText('ODbL');
    await expect(page.locator('footer')).toContainText(/Open Government License.*City of Surrey/);
    await page.locator('#map').scrollIntoViewIfNeeded();
    await axe(page, testInfo);
  });

test('actual WebGL denial preserves the list, keyboard corrections, rollback, and accessibility',
  async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const diagnostic = window as unknown as ProofWindow;
      diagnostic.__webglAttempts = 0;
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        writable: true,
        value: function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
          if (['webgl', 'experimental-webgl', 'webgl2'].includes(contextId)) {
            diagnostic.__webglAttempts = (diagnostic.__webglAttempts ?? 0) + 1;
            return null;
          }
          return Reflect.apply(original, this, [contextId, ...args]);
        },
      });
    });
    const original = await start(page, 'unavailable');
    expect(await page.evaluate(() => (window as unknown as ProofWindow).__webglAttempts ?? 0)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.createElement('canvas').getContext('2d') !== null)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as ProofWindow).__proof.view)).toBeNull();
    expect(await sceneState(page)).toMatchObject({ available: false, status: 'unavailable' });
    expect(await page.evaluate(() => (window as unknown as ProofWindow).__proof.openProject(207))).toBe(false);
    await expect(page.locator('#scene-status')).toBeVisible();
    await expect(page.locator('#scene-status')).toContainText(/unavailable.*WebGL/i);
    await expect(page.locator('#map')).toContainText(/all project facts.*remain available/i);
    await expect(page.locator('#projects-list button')).toHaveCount(0);
    await expectList(page, original);
    await page.locator('#skip-link').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#projects-heading')).toBeFocused();
    const assetBefore = await page.locator('#asset-facts').innerHTML();
    for (let cycle = 0; cycle < 2; cycle++) {
      await switchVersion(page, original, 'v2', 'Space');
      await switchVersion(page, original, 'v1', 'Enter');
      expect(await page.locator('#asset-facts').innerHTML()).toBe(assetBefore);
      expect(await page.evaluate(() => (window as unknown as ProofWindow).__proof.view)).toBeNull();
    }
    await axe(page, testInfo);
    await screenshot(testInfo, 'actual-no-webgl-fallback', page.locator('#map'));
  });
