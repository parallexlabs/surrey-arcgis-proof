import { expect, test as base } from '@playwright/test';
import type { Locator, Page, TestInfo } from '@playwright/test';
import type SceneView from '@arcgis/core/views/SceneView';
import type GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import type Layer from '@arcgis/core/layers/Layer';
import type { Project } from '../../src/model';
import type { SceneDiagnostics } from '../../src/scene';

// Injected SDK-boundary regressions, not claims of real service failures. [18]
const PATH = '/demos/surrey-arcgis/';
const TIMEOUT = 90_000;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
interface State {
  version: 'v1' | 'v2';
  busy: boolean;
  sceneMode: string;
  projects: Project[];
}
interface Api {
  getState(): State;
  getSceneState(): Promise<SceneDiagnostics | {
    available: false; status: string; reason: string;
  }>;
  openProject(id: number): Promise<boolean>;
  readonly view: SceneView | null;
}
interface Lifecycle {
  kind: string;
  hits: number;
  oldLayerId: string;
  view: SceneView;
  boundary?: { oldAttached: boolean; newLoaded: boolean; appLayers: number };
  replacementAdds?: number;
  held?: boolean;
  released?: boolean;
  settled?: boolean;
  popupResult?: boolean;
  popupError?: string;
  popupPromise?: Promise<boolean>;
  release?: () => void;
  restore?: () => void;
}
interface BrowserBoundary {
  __proof?: Api;
  __lifecycle?: Lifecycle;
}
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
      if (response.status() >= 400) audit.localFailures.push(`${response.status()} ${url.href}`);
      if (response.ok() && url.pathname.startsWith(`${PATH}arcgis-assets/`)) {
        audit.sdkAssets.push(url.href);
      }
    });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (!['http:', 'https:'].includes(url.protocol) || url.origin === origin) {
        await route.continue();
      } else if (url.protocol === 'https:' && url.hostname === 'tile.openstreetmap.org'
        && url.port === '' && url.search === '' && /^\/\d+\/\d+\/\d+\.png$/.test(url.pathname)) {
        audit.tiles.push(url.href);
        await route.fulfill({
          status: 200, contentType: 'image/png', body: PNG,
          headers: { 'access-control-allow-origin': '*' },
        });
      } else {
        audit.unexpectedRemote.push(url.href);
        await route.abort('blockedbyclient');
      }
    });
    await use(audit);
    await testInfo.attach('strict-lifecycle-network-and-browser-audit', {
      body: Buffer.from(JSON.stringify(audit, null, 2)), contentType: 'application/json',
    });
    expect(audit.unexpectedRemote, 'No unexpected remote services or analytics').toEqual([]);
    expect(audit.localFailures, 'All local production assets must load').toEqual([]);
    expect(audit.consoleErrors, 'Injected failures must not produce SDK/application console errors').toEqual([]);
    expect(audit.pageErrors, 'No unhandled browser exceptions').toEqual([]);
  }, { auto: true }],
});
const state = (page: Page) => page.evaluate(() => {
  const api = (window as unknown as BrowserBoundary).__proof;
  if (!api) throw new Error('Missing proof API');
  return api.getState();
});
const diagnostics = (page: Page) => page.evaluate(() => {
  const api = (window as unknown as BrowserBoundary).__proof;
  if (!api) throw new Error('Missing proof API');
  return api.getSceneState();
});
const list = (page: Page) => page.locator('#projects-list article[data-object-id="207"]');
const popup = (page: Page) => page.locator('.esri-popup:visible article[data-object-id="207"]');
function showcase(projects: readonly Project[]): Project {
  const project = projects.find(p => p.objectId === 207);
  if (!project) throw new Error('Missing showcase');
  return project;
}
async function receipt(testInfo: TestInfo, name: string, data: unknown): Promise<void> {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(data, null, 2)), contentType: 'application/json',
  });
}
async function expectScene(page: Page, height: number): Promise<void> {
  await expect.poll(async () => {
    const d = await diagnostics(page);
    if (!d.available) return d;
    return {
      ready: d.viewReady, updating: d.viewUpdating, projects: d.projectFeatureCount,
      height: d.showcaseHeightM, points: d.transitPointCount, lines: d.transitLineCount,
      graphics: d.assetGraphicCount, meshes: d.assetMeshCount, ground: d.groundLayerCount,
      types: d.layers.map(layer => layer.type).sort(),
      loaded: d.layers.every(layer => layer.loadStatus === 'loaded'),
    };
  }, { timeout: TIMEOUT }).toEqual({
    ready: true, updating: false, projects: 119, height, points: 17, lines: 208,
    graphics: 2, meshes: 2, ground: 0,
    types: ['geojson', 'geojson', 'geojson', 'graphics', 'web-tile'], loaded: true,
  });
  const d = await diagnostics(page);
  if (!d.available || typeof d.assetZmaxM !== 'number' || !Number.isFinite(d.assetZmaxM)) {
    throw new Error('Missing finite physical mesh extent from actual scene');
  }
  expect(Math.abs(d.assetZmaxM - 129)).toBeLessThan(0.001);
}
async function initial(page: Page, audit: Audit, testInfo: TestInfo): Promise<State> {
  await page.setViewportSize({ width: 1280, height: 960 });
  expect((await page.goto(PATH))?.status()).toBe(200);
  await expect(page).toHaveTitle(/Surrey development applications/);
  await page.waitForFunction(() => Boolean((window as unknown as BrowserBoundary).__proof));
  await expect.poll(async () => {
    const s = await state(page);
    return { mode: s.sceneMode, busy: s.busy, version: s.version, count: s.projects.length };
  }, { timeout: TIMEOUT }).toEqual({ mode: 'ready', busy: false, version: 'v1', count: 119 });
  await expectScene(page, 129);
  expect(await page.evaluate(() => {
    const api = (window as unknown as BrowserBoundary).__proof;
    const view = api?.view;
    if (!api || !view) throw new Error('Missing real initial SceneView');
    return {
      className: view.declaredClass, ready: view.ready, updating: view.updating,
      frozenApi: Object.isFrozen(api), ground: view.map.ground.layers.length,
    };
  })).toEqual({
    className: 'esri.views.SceneView', ready: true, updating: false, frozenApi: true, ground: 0,
  });
  await expect(page.locator('#map canvas').first()).toBeVisible();
  await expect(page.locator('#projects-list > li')).toHaveCount(119);
  await expect(page.locator('#projects-list button.show-in-scene')).toHaveCount(119);
  await expect.poll(() => audit.tiles.length).toBeGreaterThan(0);
  expect(audit.sdkAssets.length).toBeGreaterThan(0);
  const original = await state(page);
  expect(showcase(original.projects).heightM).toBe(129);
  expect(showcase(original.projects).heightRule).toMatch(/estimate/i);
  await receipt(testInfo, 'genuine-initial-scene-before-any-injection', await diagnostics(page));
  return original;
}
async function rows(article: Locator) {
  return article.locator('dl').evaluate(dl => Array.from(dl.querySelectorAll('dt')).map(dt => ({
    term: dt.textContent, value: dt.nextElementSibling?.textContent,
  })));
}
async function openLatest(page: Page, height: number): Promise<void> {
  expect(await page.evaluate(() => {
    const api = (window as unknown as BrowserBoundary).__proof;
    if (!api) throw new Error('Missing proof API');
    return api.openProject(207);
  })).toBe(true);
  await expect(popup(page)).toBeVisible();
  await expect(popup(page)).toContainText(`${height} m`);
  expect(await rows(popup(page))).toEqual(await rows(list(page)));
  const d = await diagnostics(page);
  expect(d.available && d.popupVisible).toBe(true);
}
async function activate(page: Page, version: 'v1' | 'v2', key: 'Enter' | 'Space'): Promise<State> {
  const control = page.locator(version === 'v2' ? '#apply-v2' : '#rollback-v1');
  await expect(control).toBeEnabled();
  await control.focus();
  await page.keyboard.press(key);
  await expect.poll(async () => {
    const s = await state(page);
    return { version: s.version, busy: s.busy };
  }, { timeout: TIMEOUT }).toEqual({ version, busy: false });
  await expect(control).toBeFocused();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#version-status')).toContainText(`Version ${version} active`);
  return state(page);
}
function expectVersion(current: State, original: State, version: 'v1' | 'v2'): void {
  expect(current.version).toBe(version);
  expect(current.projects).toHaveLength(119);
  if (version === 'v1') {
    expect(current.projects).toStrictEqual(original.projects);
  } else {
    const changed = showcase(current.projects);
    expect(changed.heightM).toBe(135);
    expect(changed.heightRule).toMatch(/local/i);
    expect(changed.heightRule).toMatch(/demonstration/i);
    expect(changed.heightRule).toMatch(/source\s+facts\s+unchanged/i);
    expect({ ...changed, heightM: 129, heightRule: showcase(original.projects).heightRule })
      .toStrictEqual(showcase(original.projects));
    expect(current.projects.filter(p => p.objectId !== 207))
      .toStrictEqual(original.projects.filter(p => p.objectId !== 207));
  }
}

const failureModes = ['before-commit', 'after-current-switch', 'diagnostic-query'] as const;
for (const mode of failureModes) {
  test(`HR001 injected ${mode} failure closes uncertain scene and retains committed list`,
    async ({ page, audit }, testInfo) => {
      const original = await initial(page, audit, testInfo);
      const asset = await page.locator('#asset-facts').innerHTML();
      await page.evaluate(kind => {
        const w = window as unknown as BrowserBoundary;
        const view = w.__proof?.view;
        if (!view) throw new Error('No genuine view for injection');
        const layers = view.map.layers;
        const isProject = (layer: Layer) => layer.type === 'geojson'
          && (layer as GeoJSONLayer).fields?.some(field => field.name === 'heightM') === true;
        const old = layers.toArray().find(isProject);
        if (!old) throw new Error('No real project layer');
        const life: Lifecycle = { kind, hits: 0, oldLayerId: old.id, view };
        w.__lifecycle = life;
        const record = (next: Layer) => {
          life.hits++;
          life.boundary = {
            oldAttached: layers.includes(old), newLoaded: next.loadStatus === 'loaded',
            appLayers: layers.toArray().filter(isProject).length,
          };
        };
        if (kind === 'before-commit') {
          const originalMethod = view.whenLayerView;
          Object.defineProperty(view, 'whenLayerView', {
            configurable: true, writable: true,
            value: function (this: SceneView, ...args: Parameters<SceneView['whenLayerView']>) {
              const next = args[0];
              if (next !== old && isProject(next)) {
                Object.defineProperty(view, 'whenLayerView', {
                  configurable: true, writable: true, value: originalMethod,
                });
                record(next);
                return Promise.reject(new Error(`Injected ${kind} SDK boundary failure`));
              }
              return originalMethod.apply(this, args);
            },
          });
        } else if (kind === 'after-current-switch') {
          const originalMethod = layers.remove;
          Object.defineProperty(layers, 'remove', {
            configurable: true, writable: true,
            value: function (this: typeof layers, ...args: Parameters<typeof originalMethod>) {
              if (args[0] === old) {
                Object.defineProperty(layers, 'remove', {
                  configurable: true, writable: true, value: originalMethod,
                });
                const next = layers.toArray().find(layer => layer !== old && isProject(layer));
                if (!next) throw new Error('Expected real loaded replacement before removal');
                record(next);
                throw new Error(`Injected ${kind} SDK boundary failure`);
              }
              return originalMethod.apply(this, args);
            },
          });
        } else {
          // Identify the replacement after genuine SDK loading, not at Collection.add. [22]
          const originalMethod = view.whenLayerView;
          Object.defineProperty(view, 'whenLayerView', {
            configurable: true, writable: true,
            value: async function (this: SceneView, ...args: Parameters<SceneView['whenLayerView']>) {
              const layerView = await originalMethod.apply(this, args);
              const next = args[0];
              if (next !== old && next.loadStatus === 'loaded' && isProject(next)) {
                Object.defineProperty(view, 'whenLayerView', {
                  configurable: true, writable: true, value: originalMethod,
                });
                const projectLayer = next as GeoJSONLayer;
                const originalCount = projectLayer.queryFeatureCount;
                Object.defineProperty(projectLayer, 'queryFeatureCount', {
                  configurable: true, writable: true,
                  value: function () {
                    Object.defineProperty(projectLayer, 'queryFeatureCount', {
                      configurable: true, writable: true, value: originalCount,
                    });
                    record(next);
                    return Promise.reject(new Error(`Injected ${kind} SDK boundary failure`));
                  },
                });
              }
              return layerView;
            },
          });
        }
      }, mode);
      await page.locator('#apply-v2').focus();
      await page.keyboard.press('Enter');
      await expect.poll(async () => {
        const s = await state(page);
        return { mode: s.sceneMode, busy: s.busy, version: s.version };
      }, { timeout: TIMEOUT }).toEqual({ mode: 'failed', busy: false, version: 'v1' });
      expect((await state(page)).projects).toStrictEqual(original.projects);
      const evidence = await page.evaluate(() => {
        const w = window as unknown as BrowserBoundary;
        const life = w.__lifecycle;
        if (!life || !w.__proof) throw new Error('Missing injection evidence');
        return {
          kind: life.kind, hits: life.hits, boundary: life.boundary,
          viewNull: w.__proof.view === null, oldViewDestroyed: life.view.destroyed,
        };
      });
      expect(evidence.hits).toBe(1);
      expect(evidence.viewNull).toBe(true);
      expect(evidence.oldViewDestroyed).toBe(true);
      expect(evidence.boundary).toEqual({
        oldAttached: mode !== 'diagnostic-query', newLoaded: true,
        appLayers: mode === 'diagnostic-query' ? 1 : 2,
      });
      await receipt(testInfo, `injected-${mode}-boundary-evidence`, evidence);
      const d = await diagnostics(page);
      expect(d).toMatchObject({ available: false, status: 'failed' });
      if (d.available) throw new Error('Uncertain scene was retained');
      expect(d.reason).toContain(`Injected ${mode} SDK boundary failure`);
      await expect(page.locator('#version-status')).toContainText(/scene was closed/i);
      await expect(page.locator('#version-status')).toContainText(/last committed version v1/i);
      await expect(page.locator('#version-status')).toContainText(/list-only mode/i);
      await expect(page.locator('#scene-status')).toContainText(/failed/i);
      await expect(page.locator('#map')).toContainText(/all project facts.*remain available/i);
      await expect(page.locator('#map canvas')).toHaveCount(0);
      await expect(page.locator('#projects-list > li')).toHaveCount(119);
      await expect(page.locator('#projects-list button.show-in-scene')).toHaveCount(0);
      expect(await page.evaluate(() => {
        const api = (window as unknown as BrowserBoundary).__proof;
        if (!api) throw new Error('Missing fallback API');
        return api.openProject(207);
      })).toBe(false);
      for (const version of ['v2', 'v1'] as const) {
        const current = await activate(page, version, version === 'v2' ? 'Space' : 'Enter');
        expectVersion(current, original, version);
        expect(current.sceneMode).toBe('failed');
        expect(await diagnostics(page)).toMatchObject({ available: false, status: 'failed' });
        expect(await page.locator('#asset-facts').innerHTML()).toBe(asset);
        await expect(page.locator('#diff-list')).toContainText(
          version === 'v2' ? /129 m\s*→\s*135 m/ : /135 m\s*→\s*129 m/,
        );
      }
    });
}

test('HR002 injected held real popup queries serialize correction and rollback without stale features',
  async ({ page, audit }, testInfo) => {
    const original = await initial(page, audit, testInfo);
    const asset = await page.locator('#asset-facts').innerHTML();
    for (const target of ['v2', 'v1'] as const) {
      const prior = await state(page);
      await page.evaluate(() => {
        const w = window as unknown as BrowserBoundary;
        w.__lifecycle?.restore?.();
        const api = w.__proof, view = api?.view;
        if (!api || !view) throw new Error('No real view for popup-query gate');
        const layers = view.map.layers;
        const isProject = (layer: Layer) => layer.type === 'geojson'
          && (layer as GeoJSONLayer).fields?.some(field => field.name === 'heightM') === true;
        const layer = layers.toArray().find(isProject) as GeoJSONLayer | undefined;
        if (!layer) throw new Error('Missing current real project layer');
        const life: Lifecycle = {
          kind: 'held-real-popup-query', hits: 0, oldLayerId: layer.id, view,
          replacementAdds: 0, held: false, released: false, settled: false, popupError: '',
        };
        w.__lifecycle = life;
        const gate = new Promise<void>(resolveGate => { life.release = resolveGate; });
        const originalQuery = layer.queryFeatures;
        Object.defineProperty(layer, 'queryFeatures', {
          configurable: true, writable: true,
          value: async function (this: GeoJSONLayer, ...args: Parameters<GeoJSONLayer['queryFeatures']>) {
            const query = args[0];
            if (query?.returnGeometry === true && /^\s*OBJECTID\s*=\s*207\s*$/i.test(query.where ?? '')) {
              Object.defineProperty(layer, 'queryFeatures', {
                configurable: true, writable: true, value: originalQuery,
              });
              life.hits++;
              life.held = true;
              await gate;
            }
            return originalQuery.apply(this, args);
          },
        });
        const originalAdd = layers.add;
        Object.defineProperty(layers, 'add', {
          configurable: true, writable: true,
          value: function (this: typeof layers, ...args: Parameters<typeof originalAdd>) {
            if (isProject(args[0])) life.replacementAdds = (life.replacementAdds ?? 0) + 1;
            return originalAdd.apply(this, args);
          },
        });
        life.restore = () => {
          Object.defineProperty(layers, 'add', {
            configurable: true, writable: true, value: originalAdd,
          });
        };
        life.popupPromise = api.openProject(207).then(result => {
          life.settled = true;
          life.popupResult = result;
          return result;
        }, error => {
          life.settled = true;
          life.popupError = error instanceof Error ? error.message : String(error);
          return false;
        });
      });
      await page.waitForFunction(() =>
        (window as unknown as BrowserBoundary).__lifecycle?.held === true);
      const control = page.locator(target === 'v2' ? '#apply-v2' : '#rollback-v1');
      await control.focus();
      await page.keyboard.press(target === 'v2' ? 'Enter' : 'Space');
      await expect.poll(async () => (await state(page)).busy).toBe(true);
      await page.evaluate(() => new Promise<void>(resolveFrames =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolveFrames()))));
      const paused = await state(page);
      expect(paused.version).toBe(prior.version);
      expect(paused.projects).toStrictEqual(prior.projects);
      await expect(page.locator('#projects-list button.show-in-scene')).toHaveCount(119);
      expect(await page.locator('#projects-list button.show-in-scene').evaluateAll(buttons =>
        buttons.every(button => (button as HTMLButtonElement).disabled))).toBe(true);
      expect(await page.evaluate(() => {
        const w = window as unknown as BrowserBoundary;
        const life = w.__lifecycle, view = w.__proof?.view;
        if (!life || !view) throw new Error('Missing held-query scene');
        return {
          adds: life.replacementAdds, settled: life.settled, sameView: view === life.view,
          appIds: view.map.layers.toArray().filter(layer => layer.type === 'geojson'
            && (layer as GeoJSONLayer).fields?.some(field => field.name === 'heightM'))
            .map(layer => layer.id),
          oldId: life.oldLayerId,
        };
      })).toEqual({
        adds: 0, settled: false, sameView: true,
        appIds: [await page.evaluate(() =>
          (window as unknown as BrowserBoundary).__lifecycle?.oldLayerId)],
        oldId: await page.evaluate(() =>
          (window as unknown as BrowserBoundary).__lifecycle?.oldLayerId),
      });
      expect(await page.evaluate(async () => {
        const life = (window as unknown as BrowserBoundary).__lifecycle;
        if (!life?.release || !life.popupPromise) throw new Error('Missing held real query');
        life.released = true;
        life.release();
        return life.popupPromise;
      })).toBe(true);
      await expect.poll(async () => {
        const s = await state(page);
        return { version: s.version, busy: s.busy };
      }, { timeout: TIMEOUT }).toEqual({ version: target, busy: false });
      await expect(control).toBeFocused();
      const current = await state(page);
      expectVersion(current, original, target);
      expect(current.sceneMode).toBe('ready');
      await expectScene(page, target === 'v2' ? 135 : 129);
      const evidence = await page.evaluate(() => {
        const life = (window as unknown as BrowserBoundary).__lifecycle;
        if (!life) throw new Error('Missing serialized-operation evidence');
        return {
          hits: life.hits, released: life.released, settled: life.settled,
          result: life.popupResult, error: life.popupError, adds: life.replacementAdds,
        };
      });
      expect(evidence).toEqual({
        hits: 1, released: true, settled: true, result: true, error: '', adds: 1,
      });
      await receipt(testInfo, `injected-real-query-gate-${target}`, evidence);
      await openLatest(page, target === 'v2' ? 135 : 129);
      expect(await page.locator('#asset-facts').innerHTML()).toBe(asset);
    }
    expect((await state(page)).projects).toStrictEqual(original.projects);
  });

test('HR003 synthetic persisted pagehide/pageshow retains the same usable real SceneView',
  async ({ page, audit }, testInfo) => {
    const original = await initial(page, audit, testInfo);
    const asset = await page.locator('#asset-facts').innerHTML();
    expect(await page.evaluate(() => {
      const w = window as unknown as BrowserBoundary;
      const view = w.__proof?.view;
      if (!view) throw new Error('Missing real view before synthetic lifecycle events');
      w.__lifecycle = { kind: 'synthetic-persisted-events', hits: 0, oldLayerId: '', view };
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      return { sameView: w.__proof?.view === view, destroyed: view.destroyed };
    })).toEqual({ sameView: true, destroyed: false });
    expect(await state(page)).toStrictEqual(original);
    await expectScene(page, 129);
    await openLatest(page, 129);
    for (const version of ['v2', 'v1'] as const) {
      const current = await activate(page, version, version === 'v2' ? 'Enter' : 'Space');
      expectVersion(current, original, version);
      expect(current.sceneMode).toBe('ready');
      await expectScene(page, version === 'v2' ? 135 : 129);
      await openLatest(page, version === 'v2' ? 135 : 129);
      expect(await page.evaluate(() => {
        const w = window as unknown as BrowserBoundary;
        return w.__proof?.view === w.__lifecycle?.view && w.__lifecycle?.view.destroyed === false;
      })).toBe(true);
      expect(await page.locator('#asset-facts').innerHTML()).toBe(asset);
    }
    expect(await state(page)).toStrictEqual(original);
    await receipt(testInfo, 'synthetic-persisted-events-not-a-real-bfcache-navigation', {
      scope: 'Synthetic persisted PageTransitionEvents only; browser BFCache eligibility not tested',
      finalState: await state(page), actualScene: await diagnostics(page),
    });
  });

// Normal unmodified SDK path: no popup initialization or fault hooks. [21]
test('normal correction and exact rollback before the first popup',
  async ({ page, audit }, testInfo) => {
    const original = await initial(page, audit, testInfo);
    const asset = await page.locator('#asset-facts').innerHTML();
    const sourceRows = () => page.locator('#projects-list article').evaluateAll(articles =>
      articles.map(article => ({
        id: (article as HTMLElement).dataset.objectId,
        rows: Array.from(article.querySelectorAll('dt'))
          .filter(dt => !['Estimated height', 'Height rule'].includes(dt.textContent ?? ''))
          .map(dt => ({ term: dt.textContent, value: dt.nextElementSibling?.textContent })),
      })),
    );
    const originalSourceRows = await sourceRows();
    expect(originalSourceRows).toHaveLength(119);
    const initialDiagnostics = await diagnostics(page);
    if (!initialDiagnostics.available) throw new Error('Initial real scene unavailable');
    expect(initialDiagnostics.popupVisible).toBe(false);
    await expect(popup(page)).toHaveCount(0);

    for (const version of ['v2', 'v1'] as const) {
      const current = await activate(page, version, version === 'v2' ? 'Enter' : 'Space');
      expectVersion(current, original, version);
      expect(current.sceneMode).toBe('ready');
      await expectScene(page, version === 'v2' ? 135 : 129);
      const d = await diagnostics(page);
      if (!d.available) throw new Error('Normal pre-popup update closed the actual scene');
      expect(d.popupVisible).toBe(false);
      await expect(popup(page)).toHaveCount(0);
      await expect(page.locator('#projects-list > li')).toHaveCount(119);
      await expect(page.locator('#projects-list button.show-in-scene')).toHaveCount(119);
      expect(await sourceRows()).toStrictEqual(originalSourceRows);
      await expect(list(page)).toContainText(`${showcase(current.projects).heightM} m`);
      await expect(list(page)).toContainText(showcase(current.projects).heightRule);
      await expect(page.locator('#version-status')).not.toHaveClass(/\berror\b/);
      await expect(page.locator('#diff-list')).toContainText(
        version === 'v2' ? /129 m\s*→\s*135 m/ : /135 m\s*→\s*129 m/,
      );
      expect(await page.locator('#asset-facts').innerHTML()).toBe(asset);
      await expect(page.locator('#asset-facts')).toContainText(/129 m.*illustrative/i);
    }

    expect(await state(page)).toStrictEqual(original);
    await openLatest(page, 129);
    await expectScene(page, 129);
    expect(await state(page)).toStrictEqual(original);
    expect(await sourceRows()).toStrictEqual(originalSourceRows);
    expect(await page.locator('#asset-facts').innerHTML()).toBe(asset);
    await receipt(testInfo, 'normal-pre-first-popup-correction-and-exact-rollback', {
      scope: 'Real SDK correction and rollback completed before the first popup; no fault injection',
      baseline: original,
      finalState: await state(page),
      actualSceneAfterFirstPopup: await diagnostics(page),
    });
  });
