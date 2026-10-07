import './style.css';
import '@arcgis/core/assets/esri/themes/light/main.css';
import { loadProofData, type ProofData } from './data';
import { createAssetFacts, createProjectFacts, formatHeight } from './facts';
import { applyVersion, diffStates, SHOWCASE_OBJECT_ID, type DiffEntry, type Project, type VersionId } from './model';
import type { SceneController, SceneDiagnostics } from './scene';

type SceneMode = 'not-started' | 'loading' | 'ready' | 'unavailable' | 'failed';

interface SceneUnavailableState {
  available: false;
  status: Exclude<SceneMode, 'ready'>;
  reason: string;
}

interface ProofState {
  version: VersionId;
  busy: boolean;
  sceneMode: SceneMode;
  projects: Project[];
}

interface ProofApi {
  getState(): ProofState;
  getSceneState(): Promise<SceneDiagnostics | SceneUnavailableState>;
  openProject(objectId: number): Promise<boolean>;
  readonly view: SceneController['view'] | null;
}

declare global {
  interface Window {
    __proof?: ProofApi;
  }
}

function byId<T extends HTMLElement>(id: string, ctor: { new (): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) throw new Error(`Missing required element #${id}`);
  return element;
}

const ui = {
  sceneStatus: byId('scene-status', HTMLParagraphElement),
  map: byId('map', HTMLDivElement),
  applyV2: byId('apply-v2', HTMLButtonElement),
  rollbackV1: byId('rollback-v1', HTMLButtonElement),
  versionStatus: byId('version-status', HTMLParagraphElement),
  diffList: byId('diff-list', HTMLUListElement),
  assetFacts: byId('asset-facts', HTMLDivElement),
  summary: byId('projects-summary', HTMLParagraphElement),
  list: byId('projects-list', HTMLOListElement)
};

let data: ProofData | null = null;
let current: Project[] = [];
let version: VersionId = 'v1';
let busy = true;
let sceneMode: SceneMode = 'not-started';
let sceneReason = 'Scene not started.';
let scene: SceneController | null = null;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setStatus(element: HTMLElement, text: string, isError = false): void {
  element.textContent = text;
  element.classList.toggle('error', isError);
}

function updateButtons(): void {
  const disabled = data === null || busy;
  ui.applyV2.disabled = disabled;
  ui.rollbackV1.disabled = disabled;
  ui.applyV2.setAttribute('aria-pressed', String(version === 'v2'));
  ui.rollbackV1.setAttribute('aria-pressed', String(version === 'v1'));
  for (const button of ui.list.querySelectorAll<HTMLButtonElement>('button.show-in-scene')) button.disabled = busy;
}

function renderList(): void {
  if (!data) return;
  const sourceLayer = data.projectSource.layer;
  ui.list.replaceChildren(
    ...current.map((project) => {
      const li = document.createElement('li');
      li.append(createProjectFacts(project, sourceLayer));
      if (scene && sceneMode === 'ready') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'show-in-scene';
        button.textContent = `Show ${project.projectNo} in 3D scene`;
        button.disabled = busy;
        button.addEventListener('click', () => void showInScene(project));
        li.append(button);
      }
      return li;
    })
  );
}

function renderDiff(diffs: DiffEntry[]): void {
  const items = diffs.map((d) => {
    const li = document.createElement('li');
    li.textContent = `${d.projectNo} (OBJECTID ${d.objectId}): estimated height ${formatHeight(d.before)} → ${formatHeight(d.after)}`;
    return li;
  });
  if (items.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No height differences from the previous state.';
    items.push(li);
  }
  ui.diffList.replaceChildren(...items);
}

function checkDiagnostics(s: SceneDiagnostics, projects: readonly Project[]): void {
  const expected = projects.find((p) => p.objectId === SHOWCASE_OBJECT_ID)?.heightM ?? null;
  if (!s.viewReady || s.projectFeatureCount !== projects.length || s.showcaseHeightM !== expected) {
    throw new Error(
      `Scene diagnostics disagree with the model (features ${s.projectFeatureCount}/${projects.length}, ` +
        `showcase ${String(s.showcaseHeightM)} m vs ${String(expected)} m, view ready ${String(s.viewReady)}).`
    );
  }
}

function describeScene(prefix: string, s: SceneDiagnostics): void {
  const height = s.showcaseHeightM === null ? 'unknown' : formatHeight(s.showcaseHeightM);
  setStatus(
    ui.sceneStatus,
    `${prefix} ${s.projectFeatureCount} schematic extrusions, ${s.transitPointCount} SkyTrain station points, ` +
      `${s.transitLineCount} SkyTrain line features and ${s.assetGraphicCount} illustrative asset parts rendered; ` +
      `showcase extrusion ${height}. View ready: ${String(s.viewReady)}.`
  );
}

function showSceneFallback(mode: 'unavailable' | 'failed', reason: string): void {
  sceneMode = mode;
  sceneReason = reason;
  ui.map.classList.add('is-unavailable');
  ui.map.setAttribute('aria-label', '3D map unavailable');
  const p = document.createElement('p');
  p.textContent =
    (mode === 'unavailable' ? `3D view unavailable: ${reason}` : `3D view failed to load: ${reason}`) +
    ' All project facts, demonstration versions and the illustrative asset description remain available below.';
  ui.map.replaceChildren(p);
  setStatus(ui.sceneStatus, mode === 'unavailable' ? `3D scene unavailable (WebGL): ${reason}` : `3D scene failed: ${reason}`, true);
}

function failScene(controller: SceneController, reason: string): void {
  if (scene === controller) scene = null;
  controller.destroy();
  showSceneFallback('failed', reason);
  renderList();
}

async function showInScene(project: Project): Promise<void> {
  const controller = scene;
  if (!controller || busy || sceneMode !== 'ready') return;
  setStatus(ui.sceneStatus, `Opening popup for project ${project.projectNo}…`);
  try {
    const ok = await controller.openProject(project.objectId);
    if (scene !== controller) return;
    setStatus(
      ui.sceneStatus,
      ok ? `Popup open in the 3D scene for project ${project.projectNo}.` : `Could not open the popup for ${project.projectNo}.`,
      !ok
    );
    if (ok) ui.map.scrollIntoView({ block: 'nearest' });
  } catch (error) {
    if (scene !== controller) return;
    setStatus(ui.sceneStatus, `Could not open the popup: ${message(error)}`, true);
  }
}

async function setVersion(target: VersionId): Promise<void> {
  if (!data || busy) return;
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (target === version) {
    setStatus(ui.versionStatus, `Version ${target} is already active; values unchanged.`);
    return;
  }
  const committed = version;
  const next = applyVersion(data.baseline, data.versions[target]);
  const diffs = diffStates(current, next);
  const controller = scene;
  busy = true;
  updateButtons();
  setStatus(ui.versionStatus, `Applying ${target}${controller ? ' and updating the 3D scene' : ''}…`);
  try {
    let diagnostics: SceneDiagnostics | null = null;
    if (controller) {
      try {
        await controller.setProjects(next);
        diagnostics = await controller.getSceneState();
        checkDiagnostics(diagnostics, next);
      } catch (error) {
        failScene(controller, `Update to ${target} could not be confirmed in the 3D scene (${message(error)}).`);
        setStatus(
          ui.versionStatus,
          `Could not apply ${target} to the 3D scene, so the scene was closed. The last committed version ${committed} ` +
            'remains active in the project list; versions can still be changed in list-only mode.',
          true
        );
        return;
      }
    }
    current = next;
    version = target;
    renderList();
    renderDiff(diffs);
    setStatus(
      ui.versionStatus,
      `Version ${target} active: ${data.versions[target].label}. ` +
        (diagnostics ? 'The 3D scene was updated and verified.' : 'List updated; the 3D scene is unavailable.')
    );
    if (diagnostics) describeScene('3D scene updated:', diagnostics);
  } finally {
    busy = false;
    updateButtons();
    if (trigger?.isConnected && !(trigger instanceof HTMLButtonElement && trigger.disabled)) trigger.focus();
  }
}

function isUnavailable(error: unknown): boolean {
  return error instanceof Error && error.name === 'SceneError' && 'kind' in error && error.kind === 'unavailable';
}

async function startScene(): Promise<void> {
  if (!data) return;
  const showcase = data.baseline.find((p) => p.objectId === SHOWCASE_OBJECT_ID);
  if (!showcase) {
    showSceneFallback('failed', 'Showcase project is missing from the snapshot.');
    return;
  }
  sceneMode = 'loading';
  sceneReason = 'Scene loading.';
  setStatus(ui.sceneStatus, 'Loading 3D scene…');
  let controller: SceneController | null = null;
  try {
    const mod = await import('./scene');
    controller = await mod.createScene({
      container: ui.map,
      projects: current,
      skytrain: data.skytrain,
      showcase,
      sourceLayer: data.projectSource.layer
    });
    const diagnostics = await controller.getSceneState();
    checkDiagnostics(diagnostics, current);
    scene = controller;
    sceneMode = 'ready';
    sceneReason = '';
    renderList();
    describeScene('3D scene ready:', diagnostics);
  } catch (error) {
    controller?.destroy();
    scene = null;
    showSceneFallback(isUnavailable(error) ? 'unavailable' : 'failed', message(error));
    renderList();
  }
}

function unavailableState(): SceneUnavailableState {
  return { available: false, status: sceneMode === 'ready' ? 'failed' : sceneMode, reason: sceneReason };
}

function exposeApi(): void {
  const api: ProofApi = {
    getState: () => JSON.parse(JSON.stringify({ version, busy, sceneMode, projects: current })) as ProofState,
    getSceneState: () => (scene && sceneMode === 'ready' ? scene.getSceneState() : Promise.resolve(unavailableState())),
    openProject: (objectId: number) => (scene && sceneMode === 'ready' ? scene.openProject(objectId) : Promise.resolve(false)),
    get view() {
      return scene ? scene.view : null;
    }
  };
  Object.defineProperty(window, '__proof', { value: Object.freeze(api), writable: false, configurable: false });
}

async function init(): Promise<void> {
  exposeApi();
  updateButtons();
  setStatus(ui.versionStatus, 'Loading local public-data snapshot…');
  try {
    data = await loadProofData(undefined, import.meta.env.BASE_URL);
  } catch (error) {
    const text = `Local data could not be loaded: ${message(error)}`;
    setStatus(ui.versionStatus, text, true);
    setStatus(ui.summary, text, true);
    sceneMode = 'failed';
    sceneReason = 'Data load failed; scene not started.';
    setStatus(ui.sceneStatus, '3D scene not started because local data failed to load.', true);
    return;
  }
  current = applyVersion(data.baseline, data.versions.v1);
  const showcase = data.baseline.find((p) => p.objectId === SHOWCASE_OBJECT_ID);
  if (showcase) ui.assetFacts.replaceChildren(createAssetFacts(showcase));
  ui.summary.textContent =
    `${current.length} development applications from the City of Surrey public snapshot retrieved ${data.projectSource.retrieved_at}, ` +
    'limited to the City Centre, Fleetwood and Campbell Heights pilot areas. This is a deliberate area subset, not the complete city. ' +
    `All ${current.length} are shown in the 3D scene (when available) and listed here. Shapes are application boundaries, not building footprints.`;
  renderList();
  renderDiff([]);
  setStatus(ui.versionStatus, `Version v1 active: ${data.versions.v1.label}.`);
  ui.applyV2.addEventListener('click', () => void setVersion('v2'));
  ui.rollbackV1.addEventListener('click', () => void setVersion('v1'));
  window.addEventListener('pagehide', (event: PageTransitionEvent) => {
    if (!event.persisted) scene?.destroy();
  });
  await startScene();
  busy = false;
  updateButtons();
}

init().catch((error: unknown) => {
  busy = false;
  updateButtons();
  setStatus(ui.versionStatus, `Unexpected error: ${message(error)}`, true);
});
