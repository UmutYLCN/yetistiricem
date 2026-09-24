import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(entry => (entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : Promise.resolve([join(dir, entry.name)])))
  );
  return nested.flat();
}

test('browser code never reads the key or calls Google directly', async () => {
  for (const file of await sourceFiles(join(root, 'src'))) {
    const text = await readFile(file, 'utf8');
    // The name may appear in help text; reading it from an env object may not.
    assert.doesNotMatch(text, /env\s*(?:\.|\[\s*['"`])\s*(?:VITE_)?YOUTUBE_API_KEY/, file);
    assert.doesNotMatch(text, /VITE_YOUTUBE/, file);
    assert.ok(!text.includes('googleapis.com'), file);
  }
});

test('the production bundle does not contain the key, even when it is set at build time', async () => {
  const sentinel = 'AIzaSENTINEL-must-never-ship-0123456789';
  const previous = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = sentinel;
  try {
    const result = await build({
      root,
      configFile: join(root, 'vite.config.ts'),
      logLevel: 'silent',
      build: { write: false },
    });
    const outputs = Array.isArray(result) ? result : [result];
    let bundle = '';
    for (const output of outputs) {
      assert.ok('output' in output, 'expected an in-memory build result');
      for (const file of output.output) bundle += file.type === 'chunk' ? file.code : String(file.source);
    }
    assert.ok(bundle.includes('/api/youtube/playlist'), 'the bundle calls the server endpoint');
    assert.ok(!bundle.includes(sentinel), 'the key value is not in the bundle');
    assert.ok(!bundle.includes('googleapis.com'), 'the browser never calls Google directly');
  } finally {
    if (previous === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = previous;
  }
});
