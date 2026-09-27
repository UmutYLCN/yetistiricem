import { useCallback, useEffect, useState } from 'react';
import { listSavedCampIds, setCampSaved } from '../lib/catalogApi';

/**
 * The Keşfet camps the signed-in student saved (the heart). Loaded once per
 * account; a toggle shows at once and is taken back if saving fails.
 * `saved` is null without an account (the heart then asks to sign in).
 */
export function useSavedCamps(userId: string | null) {
  const [state, setState] = useState<{ userId: string; ids: Set<string> } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void listSavedCampIds(userId).then(result => {
      if (!cancelled && result.ok) setState({ userId, ids: new Set(result.data) });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saved = userId && state?.userId === userId ? state.ids : null;

  /** Saves or unsaves a camp; resolves to whether it changed. */
  const toggle = useCallback(
    async (campId: string): Promise<{ ok: true; saved: boolean } | { ok: false; error: string }> => {
      if (!userId) return { ok: false, error: 'Kaydetmek için giriş yap.' };
      const next = !(state?.userId === userId && state.ids.has(campId));
      const apply = (on: boolean) =>
        setState(current => {
          if (!current || current.userId !== userId) return current;
          const ids = new Set(current.ids);
          if (on) ids.add(campId);
          else ids.delete(campId);
          return { userId, ids };
        });
      apply(next);
      const result = await setCampSaved(userId, campId, next);
      if (!result.ok) {
        apply(!next);
        return { ok: false, error: result.error };
      }
      return { ok: true, saved: next };
    },
    [userId, state]
  );

  return { saved, toggle };
}
