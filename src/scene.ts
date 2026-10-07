import esriConfig from '@arcgis/core/config';
import Basemap from '@arcgis/core/Basemap';
import Graphic from '@arcgis/core/Graphic';
import Ground from '@arcgis/core/Ground';
import ArcGISMap from '@arcgis/core/Map';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';
import Mesh from '@arcgis/core/geometry/Mesh';
import Point from '@arcgis/core/geometry/Point';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import type Layer from '@arcgis/core/layers/Layer';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SizeVariable from '@arcgis/core/renderers/visualVariables/SizeVariable';
import ExtrudeSymbol3DLayer from '@arcgis/core/symbols/ExtrudeSymbol3DLayer';
import FillSymbol3DLayer from '@arcgis/core/symbols/FillSymbol3DLayer';
import MeshSymbol3D from '@arcgis/core/symbols/MeshSymbol3D';
import PolygonSymbol3D from '@arcgis/core/symbols/PolygonSymbol3D';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol';
import SolidEdges3D from '@arcgis/core/symbols/edges/SolidEdges3D';
import SceneView from '@arcgis/core/views/SceneView';
import type LayerView from '@arcgis/core/views/layers/LayerView';
import Popup from '@arcgis/core/widgets/Popup';
import type { TransitCollection } from './data';
import { createAssetFacts, createProjectFacts, ILLUSTRATIVE_ASSET } from './facts';
import { SHOWCASE_OBJECT_ID, type Project } from './model';

const ASSETS_PATH: unknown = import.meta.env.VITE_ARCGIS_ASSETS_PATH;
if (typeof ASSETS_PATH === 'string' && ASSETS_PATH !== '') esriConfig.assetsPath = ASSETS_PATH;
esriConfig.request.useIdentity = false;

const OSM_URL = 'https://tile.openstreetmap.org/{level}/{col}/{row}.png';
const OSM_COPYRIGHT = '© OpenStreetMap contributors (ODbL)';
const CITY_COPYRIGHT = 'Contains information licensed under the Open Government License – City of Surrey';
const PROJECT_POPUP_TITLE = 'Development application (schematic)';
const DEFAULT_TIMEOUT_MS = 90_000;
const CLOSE_UP_ZOOM = 16;
const CLOSE_UP_TILT = 62;
const CLOSE_UP_HEADING = 20;

export class SceneError extends Error {
  readonly kind: 'unavailable' | 'failed';
  constructor(kind: 'unavailable' | 'failed', message: string) {
    super(message);
    this.name = 'SceneError';
    this.kind = kind;
  }
}

export interface SceneOptions {
  container: HTMLDivElement;
  projects: readonly Project[];
  skytrain: TransitCollection;
  showcase: Project;
  sourceLayer: string;
  timeoutMs?: number;
}

export interface SceneDiagnostics {
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

export interface SceneController {
  readonly view: SceneView;
  setProjects(projects: readonly Project[]): Promise<void>;
  openProject(objectId: number): Promise<boolean>;
  getSceneState(): Promise<SceneDiagnostics>;
  destroy(): void;
}

interface ProjectLayerEntry {
  layer: GeoJSONLayer;
  url: string;
  byId: Map<number, Project>;
  template: PopupTemplate;
}

export function hasWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isWebGLError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /webgl/i.test(`${error.name} ${error.message}`);
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${Math.round(ms / 1000)} s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function readyLayerView(view: SceneView, layer: Layer): Promise<LayerView> {
  await layer.load();
  if (layer.loadStatus !== 'loaded') throw new Error(`Layer "${layer.title ?? layer.id}" did not load`);
  const layerView = await view.whenLayerView(layer);
  await reactiveUtils.whenOnce(() => !layerView.updating);
  return layerView;
}

async function whenIdle(view: SceneView): Promise<void> {
  await reactiveUtils.whenOnce(() => view.ready && !view.updating);
}

function closeUpTarget(longitude: number, latitude: number) {
  return {
    center: new Point({ longitude, latitude, spatialReference: SpatialReference.WGS84 }),
    zoom: CLOSE_UP_ZOOM,
    tilt: CLOSE_UP_TILT,
    heading: CLOSE_UP_HEADING
  };
}

async function clearPopup(view: SceneView, timeoutMs: number): Promise<void> {
  const popup = view.popup;
  if (!(popup instanceof Popup)) {
    throw new Error('SceneView popup is not the explicitly initialized Popup widget');
  }
  popup.clear();
  popup.close();
  await withTimeout(
    reactiveUtils.whenOnce(() => !popup.visible && popup.features.length === 0),
    timeoutMs,
    'Popup clearing'
  );
}

function indexProjects(projects: readonly Project[]): Map<number, Project> {
  return new Map(projects.map((p) => [p.objectId, p]));
}

function projectCollection(projects: readonly Project[]): unknown {
  return {
    type: 'FeatureCollection',
    features: projects.map((p) => ({
      type: 'Feature',
      id: p.objectId,
      geometry: p.geometry,
      properties: {
        OBJECTID: p.objectId,
        PROJECT_NO: p.projectNo,
        DESCRIPTION: p.description,
        STATUS: p.status,
        WEBLINK: p.recordUrl ?? '',
        sourceUrl: p.sourceUrl,
        retrievedAt: p.retrievedAt,
        assign_lon: p.longitude,
        assign_lat: p.latitude,
        heightM: p.heightM,
        heightRule: p.heightRule,
        modelType: p.modelType
      }
    }))
  };
}

function transitCollection(skytrain: TransitCollection, kind: 'point' | 'line'): unknown {
  return {
    type: 'FeatureCollection',
    features: skytrain.features
      .filter((f) => (kind === 'point') === (f.geometry.type === 'Point'))
      .map((f) => ({ type: 'Feature', properties: { name: f.properties.name }, geometry: f.geometry }))
  };
}

function projectPopupTemplate(byId: Map<number, Project>, sourceLayer: string): PopupTemplate {
  const lookup = (graphic: Graphic): Project | undefined => byId.get(Number(graphic.attributes?.OBJECTID));
  return new PopupTemplate({
    outFields: ['*'],
    title: PROJECT_POPUP_TITLE,
    content: (event: { graphic: Graphic }) => {
      const project = lookup(event.graphic);
      if (project) return createProjectFacts(project, sourceLayer);
      const p = document.createElement('p');
      p.textContent = 'Project facts unavailable for this feature.';
      return p;
    }
  });
}

function createProjectLayer(projects: readonly Project[], sourceLayer: string, toBlobUrl: (data: unknown) => string): ProjectLayerEntry {
  const byId = indexProjects(projects);
  const url = toBlobUrl(projectCollection(projects));
  const template = projectPopupTemplate(byId, sourceLayer);
  const layer = new GeoJSONLayer({
    url,
    title: 'Development applications (schematic extrusions of application boundaries)',
    copyright: CITY_COPYRIGHT,
    geometryType: 'polygon',
    fields: [
      { name: 'OBJECTID', type: 'oid' },
      { name: 'PROJECT_NO', type: 'string' },
      { name: 'DESCRIPTION', type: 'string' },
      { name: 'STATUS', type: 'string' },
      { name: 'WEBLINK', type: 'string' },
      { name: 'sourceUrl', type: 'string' },
      { name: 'retrievedAt', type: 'string' },
      { name: 'assign_lon', type: 'double' },
      { name: 'assign_lat', type: 'double' },
      { name: 'heightM', type: 'double' },
      { name: 'heightRule', type: 'string' },
      { name: 'modelType', type: 'string' }
    ],
    outFields: ['*'],
    elevationInfo: { mode: 'on-the-ground' },
    popupTemplate: template,
    renderer: new SimpleRenderer({
      symbol: new PolygonSymbol3D({
        symbolLayers: [
          new ExtrudeSymbol3DLayer({
            material: { color: [11, 79, 156, 0.55] },
            edges: new SolidEdges3D({ color: [17, 17, 17, 0.9], size: 1 })
          })
        ]
      }),
      visualVariables: [new SizeVariable({ field: 'heightM', valueUnit: 'meters' })]
    })
  });
  return { layer, url, byId, template };
}

function createTransitLayer(url: string, kind: 'point' | 'line'): GeoJSONLayer {
  return new GeoJSONLayer({
    url,
    title: kind === 'point' ? 'SkyTrain stations (OpenStreetMap context)' : 'SkyTrain lines (OpenStreetMap context)',
    copyright: OSM_COPYRIGHT,
    geometryType: kind === 'point' ? 'point' : 'polyline',
    fields: [{ name: 'name', type: 'string' }],
    popupEnabled: false,
    elevationInfo: { mode: 'on-the-ground' },
    renderer: new SimpleRenderer({
      symbol:
        kind === 'point'
          ? new SimpleMarkerSymbol({ color: [255, 255, 255], size: 9, outline: { color: [0, 90, 50], width: 2 } })
          : new SimpleLineSymbol({ color: [0, 120, 70], width: 3 })
    })
  });
}

function createAssetGraphics(showcase: Project): Graphic[] {
  const { podium, tower } = ILLUSTRATIVE_ASSET;
  const template = new PopupTemplate({
    title: `${ILLUSTRATIVE_ASSET.label} – ILLUSTRATIVE (not an approved design)`,
    content: () => createAssetFacts(showcase)
  });
  const symbol = (color: number[]): MeshSymbol3D =>
    new MeshSymbol3D({ symbolLayers: [new FillSymbol3DLayer({ material: { color } })] });
  const at = (z: number): Point =>
    new Point({ longitude: showcase.longitude, latitude: showcase.latitude, z, spatialReference: SpatialReference.WGS84 });
  const podiumMesh = Mesh.createBox(at(0), {
    size: { width: podium.widthM, depth: podium.depthM, height: podium.heightM }
  });
  const towerMesh = Mesh.createBox(at(podium.heightM), {
    size: { width: tower.widthM, depth: tower.depthM, height: tower.heightM }
  });
  const attributes = (part: string) => ({ assetId: ILLUSTRATIVE_ASSET.id, part, illustrative: 'yes' });
  return [
    new Graphic({ geometry: podiumMesh, symbol: symbol([214, 116, 24, 1]), attributes: attributes('podium'), popupTemplate: template }),
    new Graphic({ geometry: towerMesh, symbol: symbol([245, 158, 40, 1]), attributes: attributes('tower'), popupTemplate: template })
  ];
}

async function verifyProjectLayer(layer: GeoJSONLayer, byId: Map<number, Project>): Promise<void> {
  const result = await layer.queryFeatures({ where: '1=1', outFields: ['OBJECTID', 'heightM'], returnGeometry: false });
  if (result.features.length !== byId.size) {
    throw new Error(`Project layer has ${result.features.length} features; expected ${byId.size}`);
  }
  for (const feature of result.features) {
    const id = Number(feature.attributes?.OBJECTID);
    const expected = byId.get(id);
    if (!expected || Number(feature.attributes?.heightM) !== expected.heightM) {
      throw new Error(`Project layer height mismatch for OBJECTID ${id}`);
    }
  }
}

export async function createScene(options: SceneOptions): Promise<SceneController> {
  if (typeof ASSETS_PATH !== 'string' || ASSETS_PATH === '') {
    throw new SceneError('failed', 'ArcGIS SDK assets path is not configured.');
  }
  if (!hasWebGL2()) {
    throw new SceneError('unavailable', 'WebGL 2 is not available in this browser, so the 3D scene cannot render.');
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const blobUrls = new Set<string>();
  const toBlobUrl = (data: unknown): string => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/geo+json' }));
    blobUrls.add(url);
    return url;
  };
  const revoke = (url: string): void => {
    URL.revokeObjectURL(url);
    blobUrls.delete(url);
  };

  const transitPoints = createTransitLayer(toBlobUrl(transitCollection(options.skytrain, 'point')), 'point');
  const transitLines = createTransitLayer(toBlobUrl(transitCollection(options.skytrain, 'line')), 'line');
  let current = createProjectLayer(options.projects, options.sourceLayer, toBlobUrl);
  const assetLayer = new GraphicsLayer({
    title: `${ILLUSTRATIVE_ASSET.label} (illustrative)`,
    elevationInfo: { mode: 'absolute-height' },
    graphics: createAssetGraphics(options.showcase)
  });
  const map = new ArcGISMap({
    basemap: new Basemap({
      title: 'OpenStreetMap',
      baseLayers: [new WebTileLayer({ urlTemplate: OSM_URL, title: 'OpenStreetMap', copyright: OSM_COPYRIGHT })]
    }),
    ground: new Ground(),
    layers: [transitLines, transitPoints, current.layer, assetLayer]
  });

  let view: SceneView | null = null;
  let destroyed = false;
  const cleanup = (): void => {
    if (destroyed) return;
    destroyed = true;
    if (view) view.destroy();
    else map.destroy();
    for (const url of [...blobUrls]) revoke(url);
  };

  try {
    view = new SceneView({
      container: options.container,
      map,
      center: [options.showcase.longitude, options.showcase.latitude],
      zoom: CLOSE_UP_ZOOM,
      popup: new Popup()
    });
    const v = view;
    await withTimeout(v.when(), timeoutMs, 'SceneView initialisation');
    if (!(v.popup instanceof Popup)) throw new Error('SceneView popup widget was not initialized');
    await withTimeout(
      Promise.all([transitLines, transitPoints, current.layer, assetLayer].map((layer) => readyLayerView(v, layer))),
      timeoutMs,
      'Layer loading'
    );
    await v.goTo(closeUpTarget(options.showcase.longitude, options.showcase.latitude), { animate: false });
    await withTimeout(whenIdle(v), timeoutMs, 'Scene rendering');
    await verifyProjectLayer(current.layer, current.byId);
  } catch (error) {
    cleanup();
    throw new SceneError(isWebGLError(error) ? 'unavailable' : 'failed', `3D scene could not start: ${errorMessage(error)}`);
  }
  const sceneView = view;

  const assertAlive = (): void => {
    if (destroyed) throw new SceneError('failed', 'The 3D scene has been destroyed.');
  };

  let chain: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const run = chain.then(operation);
    chain = run.catch(() => undefined);
    return run;
  };

  const replace = async (projects: readonly Project[]): Promise<void> => {
    assertAlive();
    try {
      await clearPopup(sceneView, timeoutMs);
      const next = createProjectLayer(projects, options.sourceLayer, toBlobUrl);
      map.layers.add(next.layer, map.layers.indexOf(current.layer) + 1);
      await withTimeout(readyLayerView(sceneView, next.layer), timeoutMs, 'Updated project layer');
      await verifyProjectLayer(next.layer, next.byId);
      await clearPopup(sceneView, timeoutMs);
      await withTimeout(whenIdle(sceneView), timeoutMs, 'Scene rendering');
      const old = current;
      current = next;
      map.layers.remove(old.layer);
      old.layer.destroy();
      revoke(old.url);
      await withTimeout(whenIdle(sceneView), timeoutMs, 'Scene rendering');
    } catch (error) {
      cleanup();
      throw new SceneError('failed', `Scene update failed and the 3D scene was closed: ${errorMessage(error)}`);
    }
  };

  const open = async (objectId: number): Promise<boolean> => {
    assertAlive();
    if (!Number.isInteger(objectId) || objectId <= 0) return false;
    const entry = current;
    const project = entry.byId.get(objectId);
    if (!project) return false;
    const result = await entry.layer.queryFeatures({
      where: `OBJECTID = ${objectId}`,
      outFields: ['*'],
      returnGeometry: true
    });
    const feature = result.features[0];
    if (!feature) return false;
    feature.popupTemplate = entry.template;
    await sceneView.goTo(closeUpTarget(project.longitude, project.latitude), { animate: false });
    await withTimeout(whenIdle(sceneView), timeoutMs, 'Scene rendering');
    assertAlive();
    if (current !== entry) return false;
    await sceneView.openPopup({
      features: [feature],
      location: new Point({ longitude: project.longitude, latitude: project.latitude, spatialReference: SpatialReference.WGS84 })
    });
    await withTimeout(reactiveUtils.whenOnce(() => sceneView.popup?.visible === true), 10_000, 'Popup');
    return sceneView.popup?.visible === true;
  };

  return {
    get view() {
      return sceneView;
    },
    setProjects(projects: readonly Project[]): Promise<void> {
      return enqueue(() => replace(projects));
    },
    openProject(objectId: number): Promise<boolean> {
      return enqueue(() => open(objectId));
    },
    async getSceneState(): Promise<SceneDiagnostics> {
      assertAlive();
      const layer = current.layer;
      const [projectFeatureCount, showcaseResult, transitPointCount, transitLineCount] = await Promise.all([
        layer.queryFeatureCount(),
        layer.queryFeatures({ where: `OBJECTID = ${SHOWCASE_OBJECT_ID}`, outFields: ['OBJECTID', 'heightM'], returnGeometry: false }),
        transitPoints.queryFeatureCount(),
        transitLines.queryFeatureCount()
      ]);
      const showcaseFeature = showcaseResult.features[0];
      const height = showcaseFeature ? Number(showcaseFeature.attributes?.heightM) : NaN;
      const meshes = assetLayer.graphics.filter((g) => g.geometry?.type === 'mesh');
      let zmax: number | null = null;
      meshes.forEach((g) => {
        const top = g.geometry?.extent?.zmax;
        if (typeof top === 'number' && Number.isFinite(top)) zmax = zmax === null ? top : Math.max(zmax, top);
      });
      return {
        available: true,
        viewReady: sceneView.ready,
        viewUpdating: sceneView.updating,
        layers: map.allLayers
          .map((l) => ({ id: l.id, title: l.title ?? null, type: l.type, loadStatus: l.loadStatus }))
          .toArray(),
        groundLayerCount: map.ground.layers.length,
        projectFeatureCount,
        showcaseHeightM: Number.isFinite(height) ? height : null,
        transitPointCount,
        transitLineCount,
        assetGraphicCount: assetLayer.graphics.length,
        assetMeshCount: meshes.length,
        assetZmaxM: zmax,
        popupVisible: sceneView.popup?.visible === true
      };
    },
    destroy: cleanup
  };
}
