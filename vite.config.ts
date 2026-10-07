import { cpSync, createReadStream, existsSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';

const BASE = '/demos/surrey-arcgis/';
const ASSETS_DIR = 'arcgis-assets';
const ASSETS_URL = `${BASE}${ASSETS_DIR}`;
const rootDir = dirname(fileURLToPath(import.meta.url));
const sdkAssetsSource = resolve(rootDir, 'node_modules', '@arcgis', 'core', 'assets');

const MIME: Readonly<Record<string, string>> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pbf': 'application/x-protobuf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function assertSdkAssets(): void {
  if (!existsSync(sdkAssetsSource) || !statSync(sdkAssetsSource).isDirectory()) {
    throw new Error(`ArcGIS SDK assets not found at ${sdkAssetsSource}. Run npm install.`);
  }
}

function arcgisLocalAssets(): Plugin {
  let config: ResolvedConfig | undefined;
  return {
    name: 'arcgis-local-assets',
    configResolved(resolved) {
      config = resolved;
    },
    configureServer(server) {
      assertSdkAssets();
      server.middlewares.use(ASSETS_URL, (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next();
          return;
        }
        let relative: string;
        try {
          relative = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
        } catch {
          res.statusCode = 400;
          res.end('Bad request');
          return;
        }
        const target = resolve(sdkAssetsSource, `.${relative}`);
        if (target !== sdkAssetsSource && !target.startsWith(sdkAssetsSource + sep)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        if (!existsSync(target) || !statSync(target).isFile()) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', MIME[extname(target).toLowerCase()] ?? 'application/octet-stream');
        res.setHeader('Content-Length', String(statSync(target).size));
        res.setHeader('Cache-Control', 'no-cache');
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        createReadStream(target).pipe(res);
      });
    },
    writeBundle() {
      if (!config || config.command !== 'build') return;
      try {
        assertSdkAssets();
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
      const outDir = resolve(config.root, config.build.outDir);
      const destination = join(outDir, ASSETS_DIR);
      rmSync(destination, { recursive: true, force: true });
      cpSync(sdkAssetsSource, destination, { recursive: true });
    }
  };
}

export default defineConfig({
  base: BASE,
  root: rootDir,
  publicDir: 'public',
  plugins: [arcgisLocalAssets()],
  define: {
    'import.meta.env.VITE_ARCGIS_ASSETS_PATH': JSON.stringify(ASSETS_URL)
  },
  server: {
    port: 5173,
    strictPort: true
  },
  preview: {
    port: 4173,
    strictPort: true
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 4096
  }
});
