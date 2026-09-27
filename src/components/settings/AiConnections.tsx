import { useEffect, useId, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, RefreshCw, Unplug } from 'lucide-react';
import type { AiConnection } from '../../lib/catalogApi';
import { listAiConnections, revokeAiConnection } from '../../lib/catalogApi';
import { publishedLabel } from '../../lib/catalog';
import { docsHref } from '../../lib/routes';
import type { AiClient } from '../../lib/aiClients';
import { AI_CLIENTS, aiClientName, aiClientOf } from '../../lib/aiClients';
import { AiLogo } from '../ui/AiLogos';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; connections: AiConnection[] };

/**
 * "Yapay zekâ bağlantıları" in Profil ve ayarlar: one tile per assistant. A
 * connected one has a green frame and a check; an unconnected one opens its
 * page in the docs (`/docs/<client>`), where the steps live.
 */
export function AiConnections({ today }: { today: string }) {
  const uid = useId();
  const confirm = useConfirm();
  const notify = useToast();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void listAiConnections().then(result => {
      if (!cancelled) setLoaded(result.ok ? { status: 'ready', connections: result.data } : { status: 'error', message: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const connections = loaded.status === 'ready' ? loaded.connections : [];
  const grantsOf = (client: AiClient) => connections.filter(c => aiClientOf(c.name) === client);
  const others = connections.filter(c => aiClientOf(c.name) === null);

  const disconnect = async (name: string, grants: AiConnection[]) => {
    const ok = await confirm({
      title: `${name} bağlantısı kaldırılsın mı?`,
      tone: 'danger',
      confirmLabel: 'Bağlantıyı kaldır',
      body: <p>{name} artık planını okuyamaz ve kamp ekleyemez. Tekrar bağlamak istersen yeniden izin vermen gerekir.</p>,
    });
    if (!ok) return;
    for (const grant of grants) {
      const result = await revokeAiConnection(grant.clientId);
      if (!result.ok) {
        notify({ message: result.error, tone: 'info' });
        return;
      }
    }
    const gone = new Set(grants.map(g => g.clientId));
    setLoaded(current => (current.status === 'ready' ? { status: 'ready', connections: current.connections.filter(c => !gone.has(c.clientId)) } : current));
    notify({ message: `${name} bağlantısı kaldırıldı.`, tone: 'info' });
  };

  return (
    <section className="card px-5 py-4 sm:px-6" aria-labelledby={`${uid}-title`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${uid}-title`} className="text-[16px] font-semibold text-ink">
          Yapay zekâ bağlantıları
        </h2>
        <a href={docsHref('yapay-zeka')} className="inline-flex items-center gap-1 text-[13px] font-medium text-forest hover:underline">
          Nasıl çalışır?
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </a>
      </div>
      <p className="mt-0.5 text-[13px] text-ink-2">Bağlı yapay zekân seni değerlendirir ve onayınla kampını kurar.</p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {AI_CLIENTS.map(client => {
          const grants = grantsOf(client);
          const name = aiClientName(client);
          const connected = grants.length > 0;
          const since = grants.map(g => g.grantedAt).sort()[0];
          const tileBase = 'relative flex h-full flex-col items-center gap-2 rounded-[14px] border px-4 pt-5 pb-4 text-center transition-colors';
          return (
            <li key={client}>
              {connected ? (
                <div className={`${tileBase} border-forest/70 bg-forest-tint`}>
                  <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-forest text-on-fill ring-4 ring-card" aria-hidden="true">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <AiLogo client={client} size={30} className="text-ink" />
                  <p className="text-[14.5px] font-semibold text-ink">{name}</p>
                  <p className="text-[12px] text-forest">Bağlı{since ? ` · ${publishedLabel(since, today)}` : ''}</p>
                  <button type="button" className="btn btn-ghost btn-sm mt-1 hover:text-danger" onClick={() => void disconnect(name, grants)}>
                    <Unplug aria-hidden="true" />
                    Kaldır
                  </button>
                </div>
              ) : (
                <a
                  href={docsHref(client)}
                  className={`${tileBase} group border-line bg-field hover:border-line-strong hover:bg-sunk/60`}
                  aria-label={`${name} bağlı değil; nasıl bağlanacağını belgelerde gör`}
                >
                  <AiLogo client={client} size={30} className="text-ink opacity-80 transition-opacity group-hover:opacity-100" />
                  <p className="text-[14.5px] font-semibold text-ink">{name}</p>
                  <p className="flex items-center gap-1 text-[12px] text-ink-3 group-hover:text-ink-2">
                    {loaded.status === 'loading' ? (
                      <LoaderCircle className="size-3.5 animate-spin" aria-label="Yükleniyor" />
                    ) : (
                      <>
                        Bağla
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </>
                    )}
                  </p>
                </a>
              )}
            </li>
          );
        })}
      </ul>

      {others.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-[12px] border border-line">
          {others.map(other => (
            <li key={other.clientId} className="flex items-center gap-3 px-4 py-2.5">
              <span className="size-2 rounded-full bg-forest" aria-hidden="true" />
              <p className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                {other.name}
                <span className="text-ink-3"> · {publishedLabel(other.grantedAt, today)}</span>
              </p>
              <button type="button" className="btn btn-ghost btn-sm hover:text-danger" onClick={() => void disconnect(other.name, [other])}>
                <Unplug aria-hidden="true" />
                Kaldır
              </button>
            </li>
          ))}
        </ul>
      )}

      {loaded.status === 'error' && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
          {loaded.message}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setLoaded({ status: 'loading' });
              setAttempt(n => n + 1);
            }}
          >
            <RefreshCw aria-hidden="true" />
            Tekrar dene
          </button>
        </p>
      )}
    </section>
  );
}
