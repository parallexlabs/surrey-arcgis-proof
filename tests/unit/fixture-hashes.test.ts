import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Verify the existing frozen-fixture manifest against actual bytes.
const DATA_ROOT = resolve(process.cwd(), 'public', 'data');
const EXPECTED_FILES = [
  'SOURCES.json',
  'development_projects.geojson',
  'skytrain.geojson',
] as const;

interface ManifestEntry {
  filename: string;
  hash: string;
}

function readManifest(): ManifestEntry[] {
  const text = readFileSync(resolve(DATA_ROOT, 'SHA256SUMS'), 'utf8');
  return text.split(/\r?\n/).filter(line => line.trim() !== '').map((line, index) => {
    const match = /^([a-fA-F0-9]{64})[ \t]+\*?(\S+)$/.exec(line);
    const hash = match?.[1];
    const filename = match?.[2];
    if (!hash || !filename) {
      throw new Error(`Invalid SHA256SUMS entry ${index + 1}: ${line}`);
    }
    return { filename, hash };
  });
}

describe('frozen public fixture hashes', () => {
  it('lists exactly the three expected files with unique names and valid SHA-256 hashes', () => {
    const entries = readManifest();
    expect(entries).toHaveLength(3);
    expect(new Set(entries.map(entry => entry.filename)).size).toBe(3);
    expect(entries.map(entry => entry.filename).sort()).toEqual([...EXPECTED_FILES].sort());
    for (const entry of entries) {
      expect(entry.hash).toMatch(/^[a-fA-F0-9]{64}$/);
    }
  });

  it.each(EXPECTED_FILES)('matches the recorded SHA-256 for %s without rewriting bytes', filename => {
    const matches = readManifest().filter(entry => entry.filename === filename);
    expect(matches).toHaveLength(1);
    const entry = matches[0];
    if (!entry) throw new Error(`SHA256SUMS is missing ${filename}`);
    expect(entry.hash).toMatch(/^[a-fA-F0-9]{64}$/);
    const bytes = readFileSync(resolve(DATA_ROOT, filename));
    const actual = createHash('sha256').update(bytes).digest('hex');
    expect(actual, `Frozen fixture byte drift: ${filename}`).toBe(entry.hash.toLowerCase());
  });
});
