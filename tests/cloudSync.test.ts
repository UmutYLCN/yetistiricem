/// <reference types="vite/client" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StudyCamp } from '../src/types/index.ts';
import { planHydration, SYNC_KEY, UNCLAIMED_KEY, toCloudDocument, unsyncedKey } from '../src/lib/cloudState.ts';
import { hydrateAccount, isolateSignedOutPlanner, leaveAccountLocally, readSyncMeta } from '../src/lib/cloudSync.ts';
import { CAMP_KEYS, campStore, emptyData, loadPlanner } from '../src/lib/persistence.ts';
import { prefs } from './helpers.ts';

const TODAY = '2026-09-27';
const OWNER = 'account-a';
const OTHER = 'account-b';

function camp(id: string): StudyCamp {
  return {
    id,
    name: id,
    createdAt: TODAY,
    branches: [],
    schedule: { ...prefs(), mode: 'auto', targetEndDate: null, weekPlan: [[], [], [], [], [], [], []] },
    shiftEvents: [],
  };
}

function plan(id: string) {
  const data = emptyData();
  data.camps = [camp(id)];
  data.activeCampId = id;
  return data;
}

async function withStorage(run: (store: Map<string, string>) => Promise<void>, failOn: string[] = [], failRemovalOn: string[] = []) {
  const store = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failOn.includes(key)) throw new Error('QuotaExceededError');
        store.set(key, value);
      },
      removeItem: (key: string) => {
        if (failRemovalOn.includes(key)) throw new Error('StorageUnavailable');
        store.delete(key);
      },
    },
  });
  try {
    await run(store);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

test('ownerless stale camp is backed up; cloud plan wins without a dirty upload', async () => {
  await withStorage(async store => {
    store.set(CAMP_KEYS.camps, JSON.stringify(campStore([camp('deleted-camp')])));
    const remote = plan('current-camp');
    const result = await hydrateAccount(OWNER, TODAY, undefined, async () => ({ data: remote, revision: 7 }));

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(loadPlanner().data.camps.map(c => c.id), ['current-camp']);
    assert.deepEqual(readSyncMeta(), { owner: OWNER, revision: 7, dirty: false });
    const backup = JSON.parse(store.get(UNCLAIMED_KEY)!);
    assert.deepEqual(backup.data.camps.map((c: StudyCamp) => c.id), ['deleted-camp']);
  });
});

test('ownerless local plan is not silently uploaded to an empty account', async () => {
  await withStorage(async store => {
    store.set(CAMP_KEYS.camps, JSON.stringify(campStore([camp('unknown-owner')])));
    assert.deepEqual(await hydrateAccount(OWNER, TODAY, undefined, async () => null), { ok: true });
    assert.deepEqual(loadPlanner().data.camps, []);
    assert.deepEqual(readSyncMeta(), { owner: OWNER, revision: 0, dirty: false });
    assert.ok(store.has(UNCLAIMED_KEY));
  });
});

test('restoring this account’s pending plan first backs up an unrelated ownerless plan', async () => {
  await withStorage(async store => {
    store.set(CAMP_KEYS.camps, JSON.stringify(campStore([camp('ownerless-camp')])));
    store.set(unsyncedKey(OWNER), JSON.stringify({ revision: 3, data: toCloudDocument(plan('my-pending-camp')) }));

    assert.deepEqual(await hydrateAccount(OWNER, TODAY, undefined, async () => ({ data: plan('older-cloud-camp'), revision: 3 })), { ok: true });
    assert.deepEqual(loadPlanner().data.camps.map(c => c.id), ['my-pending-camp']);
    assert.deepEqual(JSON.parse(store.get(UNCLAIMED_KEY)!).data.camps.map((c: StudyCamp) => c.id), ['ownerless-camp']);
    assert.equal(readSyncMeta()?.dirty, true);
  });
});

test('stale flat keys are backed up but cannot become a camp after migration', async () => {
  await withStorage(async store => {
    store.set('yt_camps_migrated', 'true');
    store.set('yt_playlists', JSON.stringify([{ id: 'old-camp' }]));
    assert.deepEqual(await hydrateAccount(OWNER, TODAY, undefined, async () => ({ data: plan('cloud-camp'), revision: 4 })), { ok: true });
    assert.deepEqual(loadPlanner().data.camps.map(c => c.id), ['cloud-camp']);
    assert.equal(JSON.parse(store.get(UNCLAIMED_KEY)!).raw.yt_playlists, JSON.stringify([{ id: 'old-camp' }]));
  });
});

test('unsaved changes of the same owner survive a delayed save, but a newer cloud revision causes a backup', async () => {
  await withStorage(async store => {
    store.set(CAMP_KEYS.camps, JSON.stringify(campStore([camp('deleted-locally')])));
    store.set(SYNC_KEY, JSON.stringify({ owner: OWNER, revision: 4, dirty: true }));
    const remote = plan('still-in-cloud');

    assert.equal(planHydration({ userId: OWNER, meta: readSyncMeta(), hasLocal: true, hasWorkingCopy: true, remote: { revision: 4 } }).kind, 'keep-local');
    assert.deepEqual(await hydrateAccount(OWNER, TODAY, undefined, async () => ({ data: remote, revision: 4 })), { ok: true });
    assert.deepEqual(loadPlanner().data.camps.map(c => c.id), ['deleted-locally']);
    assert.equal(readSyncMeta()?.dirty, true);

    assert.deepEqual(await hydrateAccount(OWNER, TODAY, undefined, async () => ({ data: remote, revision: 5 })), { ok: true });
    assert.deepEqual(loadPlanner().data.camps.map(c => c.id), ['still-in-cloud']);
    assert.deepEqual(readSyncMeta(), { owner: OWNER, revision: 5, dirty: false });
    const conflict = JSON.parse(store.get('yt_sync__cakisma')!);
    assert.deepEqual(conflict.data.camps.map((c: StudyCamp) => c.id), ['deleted-locally']);
  });
});

test('an unsaved camp deletion survives a closed tab on the same device', async () => {
  await withStorage(async store => {
    store.set(CAMP_KEYS.camps, JSON.stringify(campStore([])));
    store.set(SYNC_KEY, JSON.stringify({ owner: OWNER, revision: 4, dirty: true }));

    assert.deepEqual(await hydrateAccount(OWNER, TODAY, undefined, async () => ({ data: plan('deleted-camp'), revision: 4 })), { ok: true });
    assert.deepEqual(loadPlanner().data.camps, []);
    assert.deepEqual(readSyncMeta(), { owner: OWNER, revision: 4, dirty: true });
    assert.equal(store.has('yt_sync__cakisma'), false);
  });
});

test('a missing working copy with a stale dirty flag cannot erase the cloud plan', async () => {
  await withStorage(async store => {
    store.set(SYNC_KEY, JSON.stringify({ owner: OWNER, revision: 4, dirty: true }));
    assert.deepEqual(await hydrateAccount(OWNER, TODAY, undefined, async () => ({ data: plan('cloud-camp'), revision: 4 })), { ok: true });
    assert.deepEqual(loadPlanner().data.camps.map(c => c.id), ['cloud-camp']);
    assert.deepEqual(readSyncMeta(), { owner: OWNER, revision: 4, dirty: false });
  });
});

test('sign-out does not erase the working copy if its owner marker cannot be cleared', async () => {
  await withStorage(async store => {
    store.set(CAMP_KEYS.camps, JSON.stringify(campStore([camp('saved-camp')])));
    store.set(SYNC_KEY, JSON.stringify({ owner: OWNER, revision: 4, dirty: false }));
    assert.equal(leaveAccountLocally(plan('saved-camp')), false);
    assert.equal(store.has(CAMP_KEYS.camps), true);
    assert.deepEqual(readSyncMeta(), { owner: OWNER, revision: 4, dirty: false });
  }, [], [SYNC_KEY]);
});

test('passive sign-out isolates an unsaved plan for its owner, and another account cannot import it', async () => {
  await withStorage(async store => {
    store.set(CAMP_KEYS.camps, JSON.stringify(campStore([camp('owner-a-camp')])));
    store.set(SYNC_KEY, JSON.stringify({ owner: OWNER, revision: 3, dirty: true }));

    assert.equal(isolateSignedOutPlanner(), true);
    assert.equal(readSyncMeta(), null);
    assert.equal(store.has(CAMP_KEYS.camps), false);
    assert.deepEqual(JSON.parse(store.get(unsyncedKey(OWNER))!).data.camps.map((c: StudyCamp) => c.id), ['owner-a-camp']);

    assert.deepEqual(await hydrateAccount(OTHER, TODAY, undefined, async () => ({ data: plan('owner-b-camp'), revision: 2 })), { ok: true });
    assert.deepEqual(loadPlanner().data.camps.map(c => c.id), ['owner-b-camp']);
    assert.ok(store.has(unsyncedKey(OWNER)));
  });
});

test('passive sign-out never turns a missing camp store into an actionable empty deletion', async () => {
  await withStorage(async store => {
    store.set(SYNC_KEY, JSON.stringify({ owner: OWNER, revision: 3, dirty: true }));
    store.set('yt_day_notes', JSON.stringify({ [TODAY]: 'Recover this note' }));
    assert.equal(isolateSignedOutPlanner(), true);
    assert.equal(store.has(unsyncedKey(OWNER)), false);
    assert.equal(JSON.parse(store.get(UNCLAIMED_KEY)!).owner, OWNER);

    assert.deepEqual(await hydrateAccount(OWNER, TODAY, undefined, async () => ({ data: plan('cloud-camp'), revision: 3 })), { ok: true });
    assert.deepEqual(loadPlanner().data.camps.map(c => c.id), ['cloud-camp']);
    assert.equal(readSyncMeta()?.dirty, false);
  });
});

test('a signed-out browser keeps ownerless data only in a separate recovery copy', async () => {
  await withStorage(async store => {
    store.set(CAMP_KEYS.camps, JSON.stringify(campStore([camp('old-browser-camp')])));
    assert.equal(isolateSignedOutPlanner(), true);
    assert.equal(store.has(CAMP_KEYS.camps), false);
    assert.deepEqual(JSON.parse(store.get(UNCLAIMED_KEY)!).data.camps.map((c: StudyCamp) => c.id), ['old-browser-camp']);

    assert.deepEqual(await hydrateAccount(OTHER, TODAY, undefined, async () => ({ data: plan('new-account-camp'), revision: 1 })), { ok: true });
    assert.deepEqual(loadPlanner().data.camps.map(c => c.id), ['new-account-camp']);
  });
});

test('a dirty revision-zero copy never blindly merges into an existing cloud plan', () => {
  assert.deepEqual(
    planHydration({ userId: OWNER, meta: { owner: OWNER, revision: 0, dirty: true }, hasLocal: true, hasWorkingCopy: true, remote: { revision: 1 } }),
    { kind: 'conflict' }
  );
  assert.deepEqual(planHydration({ userId: OWNER, meta: null, hasLocal: true, hasWorkingCopy: true, remote: 'offline' }), { kind: 'offline-blocked' });
});

test('failed ownerless backup blocks replacement and leaves the local plan intact', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    await withStorage(async store => {
      store.set(CAMP_KEYS.camps, JSON.stringify(campStore([camp('local-only')])));
      const result = await hydrateAccount(OWNER, TODAY, undefined, async () => ({ data: plan('cloud-only'), revision: 2 }));
      assert.equal(result.ok, false);
      assert.deepEqual(loadPlanner().data.camps.map(c => c.id), ['local-only']);
      assert.equal(readSyncMeta(), null);
    }, [UNCLAIMED_KEY]);
  } finally {
    console.error = originalError;
  }
});

test('a cancelled sign-in cannot replace local data after the account changes', async () => {
  await withStorage(async store => {
    store.set(CAMP_KEYS.camps, JSON.stringify(campStore([camp('local-only')])));
    const controller = new AbortController();
    let finishFetch: ((value: { data: ReturnType<typeof plan>; revision: number }) => void) | undefined;
    const hydration = hydrateAccount(OWNER, TODAY, controller.signal, () => new Promise(resolve => {
      finishFetch = resolve;
    }));
    controller.abort();
    finishFetch!({ data: plan('other-account'), revision: 2 });
    assert.equal((await hydration).ok, false);
    assert.deepEqual(loadPlanner().data.camps.map(c => c.id), ['local-only']);
    assert.equal(readSyncMeta(), null);
  });
});

test('a session that changes during cloud read cannot hydrate the previous account', async () => {
  await withStorage(async store => {
    store.set(CAMP_KEYS.camps, JSON.stringify(campStore([camp('local-only')])));
    const result = await hydrateAccount(OWNER, TODAY, undefined, async () => 'owner-changed');
    assert.equal(result.ok, false);
    assert.deepEqual(loadPlanner().data.camps.map(c => c.id), ['local-only']);
    assert.equal(readSyncMeta(), null);
  });
});
