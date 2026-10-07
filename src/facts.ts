import { safeRecordUrl, type Project } from './model';

export const SOURCE_HOST = 'services5.arcgis.com';
export const SOURCE_PATH_PREFIX = '/YRpe0VKTJytZSSIB/arcgis/rest/services/';

export const ILLUSTRATIVE_ASSET = {
  id: 'illustrative-podium-tower',
  label: 'Illustrative podium and tower',
  podium: { widthM: 40, depthM: 30, heightM: 15 },
  tower: { widthM: 20, depthM: 20, heightM: 114 },
  provenance:
    'Authored by ParalleX Labs Inc. for this proof. Fixed illustrative dimensions, not derived from any City drawing, permit or approved design.'
} as const;

export function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== SOURCE_HOST || url.username || url.password || url.port) return null;
    return url.pathname.startsWith(SOURCE_PATH_PREFIX) ? url.href : null;
  } catch {
    return null;
  }
}

export function formatHeight(heightM: number): string {
  return `${Number.isInteger(heightM) ? heightM : heightM.toFixed(1)} m`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(href: string, text: string): HTMLAnchorElement {
  const a = el('a', text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer external';
  a.append(el('span', ' (opens in new tab)', 'visually-hidden'));
  return a;
}

function row(dl: HTMLDListElement, term: string, value: string | Node): void {
  const dd = el('dd');
  if (typeof value === 'string') dd.textContent = value;
  else dd.append(value);
  dl.append(el('dt', term), dd);
}

function location(project: Project): string {
  return `${project.latitude.toFixed(6)}, ${project.longitude.toFixed(6)} (latitude, longitude; recorded assigned point)`;
}

export function createProjectFacts(project: Project, sourceLayer: string): HTMLElement {
  const article = el('article', undefined, 'facts');
  article.dataset.objectId = String(project.objectId);
  article.setAttribute('aria-label', `Project ${project.projectNo}`);
  article.append(el('h3', `Project ${project.projectNo}`));
  const dl = el('dl');
  row(dl, 'Project number', project.projectNo);
  row(dl, 'OBJECTID', String(project.objectId));
  row(dl, 'Description', project.description.trim() || 'No description in public record');
  row(dl, 'Status', project.status.trim() || 'Not stated in public record');
  const recordUrl = safeRecordUrl(project.recordUrl);
  row(dl, 'Public record', recordUrl ? link(recordUrl, `City record for ${project.projectNo}`) : 'No validated public record link');
  row(dl, 'Source layer', sourceLayer);
  const sourceUrl = safeSourceUrl(project.sourceUrl);
  row(dl, 'Source service', sourceUrl ? link(sourceUrl, 'Public FeatureServer layer') : 'Source URL not validated');
  row(dl, 'Snapshot retrieved', project.retrievedAt);
  row(dl, 'Location', location(project));
  row(dl, 'Estimated height', `${formatHeight(project.heightM)} (schematic estimate, never an approved height)`);
  row(dl, 'Height rule', project.heightRule);
  row(dl, 'Model type', `${project.modelType} extrusion of the application boundary (not a building footprint)`);
  article.append(dl);
  return article;
}

export function createAssetFacts(showcase: Project): HTMLElement {
  const { podium, tower } = ILLUSTRATIVE_ASSET;
  const article = el('article', undefined, 'facts asset');
  article.dataset.assetId = ILLUSTRATIVE_ASSET.id;
  article.setAttribute('aria-label', `${ILLUSTRATIVE_ASSET.label} (illustrative)`);
  const heading = el('h3', `${ILLUSTRATIVE_ASSET.label} `);
  heading.append(el('span', 'Illustrative', 'badge'));
  article.append(heading);
  const dl = el('dl');
  row(dl, 'What it is', 'Schematic 3D object (podium and tower); not an approved building design');
  row(dl, 'Placed at', `Project ${showcase.projectNo} (OBJECTID ${showcase.objectId}); ${location(showcase)}`);
  row(dl, 'Podium', `${podium.widthM} m × ${podium.depthM} m footprint, ${podium.heightM} m high`);
  row(dl, 'Tower', `${tower.widthM} m × ${tower.depthM} m footprint, ${tower.heightM} m high`);
  row(dl, 'Overall height', `${formatHeight(podium.heightM + tower.heightM)} (illustrative; unchanged by demonstration updates)`);
  row(dl, 'Provenance', ILLUSTRATIVE_ASSET.provenance);
  article.append(dl);
  return article;
}
