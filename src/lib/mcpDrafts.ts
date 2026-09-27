import type { SharedCamp } from './campShare.ts';
import { readShareDocument } from './campShare.ts';
import { getSupabaseForAccount } from './catalogApi.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type McpDraftResult = { ok: true; camp: SharedCamp; origin: 'ai' | 'kesfet' } | { ok: false; error: string };

/** A draft is readable only by the account that authorized the AI client. */
export async function readMcpCampDraft(id: string, userId: string): Promise<McpDraftResult> {
  if (!UUID.test(id)) return { ok: false, error: 'Bu kamp önizleme bağlantısı geçerli değil.' };
  const account = await getSupabaseForAccount(userId);
  if (account.status !== 'ready') return { ok: false, error: 'Kamp önizlemesi için Yetişir hesabına giriş yap.' };
  try {
    const { data, error } = await account.client.from('mcp_camp_drafts').select('payload,origin').eq('id', id).maybeSingle();
    if (error) return { ok: false, error: 'Kamp önizlemesi açılamadı. Biraz sonra tekrar dene.' };
    if (!data) return { ok: false, error: 'Bu kamp önizlemesi bulunamadı veya süresi doldu. Yapay zekâdan yeniden hazırlamasını iste.' };
    const result = readShareDocument(data.payload);
    if (!result.ok || (data.origin !== 'ai' && data.origin !== 'kesfet')) {
      return { ok: false, error: 'Kamp önizlemesindeki veriler okunamadı. Yapay zekâdan yeniden hazırlamasını iste.' };
    }
    return { ok: true, camp: result.camp, origin: data.origin };
  } catch {
    return { ok: false, error: 'Kamp önizlemesi açılamadı. İnternet bağlantını kontrol edip tekrar dene.' };
  }
}

/** Called only after the approved camp is saved in the student's cloud plan. */
export async function discardMcpCampDraft(id: string, userId: string): Promise<void> {
  if (!UUID.test(id)) return;
  const account = await getSupabaseForAccount(userId);
  if (account.status !== 'ready') return;
  await account.client.from('mcp_camp_drafts').delete().eq('id', id);
}
