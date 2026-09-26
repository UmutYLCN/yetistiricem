import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server/app.ts';
import { createPlaylistHandler } from '../server/playlistEndpoint.ts';
import { createVideosHandler } from '../server/videosEndpoint.ts';
import { PLAYLIST_ID, TEST_KEY, fakeVideo, fakeYouTube, vid } from './youtubeFake.ts';

interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/** Sends the path byte for byte (fetch would normalise "..", "%2e%2e"). */
function raw(port: number, path: string, method = 'GET'): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('the production server serves the built app and the YouTube endpoints on one port', async () => {
  const base = await mkdtemp(join(tmpdir(), 'yetistiricem-server-'));
  const dist = join(base, 'dist');
  await mkdir(join(dist, 'assets'), { recursive: true });
  await writeFile(join(dist, 'index.html'), '<!doctype html><title>Yetiştiricem</title>');
  await writeFile(join(dist, 'assets', 'index-abc123.js'), 'console.log("app")');
  await writeFile(join(base, 'secret.txt'), 'do not serve');

  const yt = fakeYouTube({
    playlists: [{ id: PLAYLIST_ID, title: 'Kamp', channelTitle: 'Kanal', items: [{ videoId: vid(1) }] }],
    videos: [fakeVideo(1)],
  });
  const server = createAppServer({
    distDir: dist,
    playlistHandler: createPlaylistHandler({ apiKey: TEST_KEY, fetch: yt.fetch }),
    videosHandler: createVideosHandler({ apiKey: TEST_KEY, fetch: yt.fetch }),
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    const home = await raw(port, '/');
    assert.equal(home.status, 200);
    assert.match(String(home.headers['content-type']), /text\/html/);
    assert.equal(home.headers['cache-control'], 'no-cache');
    assert.match(home.body, /Yetiştiricem/);

    const asset = await raw(port, '/assets/index-abc123.js');
    assert.equal(asset.status, 200);
    assert.match(String(asset.headers['content-type']), /text\/javascript/);
    assert.match(String(asset.headers['cache-control']), /immutable/);

    assert.equal((await raw(port, '/some/page')).body, home.body, 'unknown routes get the app shell');
    assert.equal((await raw(port, '/missing.png')).status, 404);
    assert.equal((await raw(port, '/', 'POST')).status, 405);

    for (const path of ['/../secret.txt', '/..%2fsecret.txt', '/%2e%2e/secret.txt', '/assets/..%2f..%2fsecret.txt', '/%00']) {
      const response = await raw(port, path);
      assert.notEqual(response.status, 200, path);
      assert.ok(!response.body.includes('do not serve'), path);
    }

    const playlist = await raw(port, `/api/youtube/playlist?id=${PLAYLIST_ID}`);
    assert.equal(playlist.status, 200);
    assert.equal(JSON.parse(playlist.body).entries[0].videoId, vid(1));

    const videos = await raw(port, `/api/youtube/videos?ids=${vid(1)}`);
    assert.equal(videos.status, 200);
    assert.equal(JSON.parse(videos.body).entries[0].videoId, vid(1));

    const invalid = await raw(port, '/api/youtube/playlist?id=https%3A%2F%2Fevil.test');
    assert.equal(invalid.status, 400);
    assert.deepEqual(JSON.parse(invalid.body), { error: { code: 'invalid-id' } });

    const head = await raw(port, `/api/youtube/playlist?id=${PLAYLIST_ID}`, 'HEAD');
    assert.equal(head.status, 405);
    assert.equal(head.body, '');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(base, { recursive: true, force: true });
  }
});
