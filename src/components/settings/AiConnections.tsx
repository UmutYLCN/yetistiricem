import { useCallback, useEffect, useId, useState } from 'react';
import { Bot, Check, Copy, LoaderCircle, MessageSquareText, RefreshCw, Unplug } from 'lucide-react';
import type { AiConnection } from '../../lib/catalogApi';
import { listAiConnections, revokeAiConnection } from '../../lib/catalogApi';
import { publishedLabel } from '../../lib/catalog';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

type Client = 'claude' | 'chatgpt' | 'gemini';

const CLIENTS: { id: Client; label: string }[] = [
  { id: 'claude', label: 'Claude' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'gemini', label: 'Gemini' },
];

const STEPS: Record<Client, string[]> = {
  claude: [
    'claude.ai’de Ayarlar → Connectors → “Add custom connector”a gir.',
    'Ad olarak “Yetişir”, URL olarak aşağıdaki adresi yaz, “Connect”e bas.',
    'Açılan Yetişir sayfasında giriş yap ve “İzin ver”e bas. Sohbette araçlar menüsünden Yetişir’i aç.',
  ],
  chatgpt: [
    'ChatGPT’de Ayarlar → Apps & Connectors → Advanced → “Developer mode”u aç.',
    '“Create” ile yeni bağlayıcı ekle: URL aşağıdaki adres, kimlik doğrulama “OAuth”.',
    'Açılan Yetişir sayfasında giriş yap ve “İzin ver”e bas.',
  ],
  gemini: [
    'Gemini CLI’da ~/.gemini/settings.json dosyasına mcpServers altında "yetisir": { "httpUrl": "<adres>" } ekle.',
    'Gemini CLI’da /mcp auth yetisir komutunu çalıştır.',
    'Açılan Yetişir sayfasında giriş yap ve “İzin ver”e bas.',
  ],
};

const EXAMPLES = ['Nasıl gidiyorum? Beni değerlendir.', 'Bu hafta neyi yetiştirmem lazım?', 'Şu playlistten 3 ayda bitecek bir kamp kuralım.'];

type Loaded = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; connections: AiConnection[] };

/**
 * "Yapay zekâ bağlantıları" in Ayarlar: which AI clients can act for the
 * student through the MCP server (docs/mcp.md), how to connect one, and a way
 * to cut one off.
 */
export function AiConnections({ today }: { today: string }) {
  const uid = useId();
  const confirm = useConfirm();
  const notify = useToast();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [client, setClient] = useState<Client>('claude');
  const [copied, setCopied] = useState(false);
  const address = `${window.location.origin}/mcp`;

  useEffect(() => {
    let cancelled = false;
    void listAiConnections().then(result => {
      if (!cancelled) setLoaded(result.ok ? { status: 'ready', connections: result.data } : { status: 'error', message: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify({ message: 'Kopyalanamadı; adresi seçip elle kopyala.', tone: 'info' });
    }
  }, [address, notify]);

  const disconnect = async (connection: AiConnection) => {
    const ok = await confirm({
      title: `${connection.name} bağlantısı kaldırılsın mı?`,
      tone: 'danger',
      confirmLabel: 'Bağlantıyı kaldır',
      body: <p>{connection.name} artık planını okuyamaz ve kamp ekleyemez. Tekrar bağlamak istersen yeniden izin vermen gerekir.</p>,
    });
    if (!ok) return;
    const result = await revokeAiConnection(connection.clientId);
    if (!result.ok) {
      notify({ message: result.error, tone: 'info' });
      return;
    }
    setLoaded(current => (current.status === 'ready' ? { status: 'ready', connections: current.connections.filter(c => c.clientId !== connection.clientId) } : current));
    notify({ message: `${connection.name} bağlantısı kaldırıldı.`, tone: 'info' });
  };

  return (
    <section className="card" aria-labelledby={`${uid}-title`}>
      <div className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-forest-soft text-forest" aria-hidden="true">
          <Bot className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${uid}-title`} className="text-[16px] font-semibold text-ink">
            Yapay zekâ bağlantıları
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Claude, ChatGPT ya da Gemini’yi hesabına bağla: ilerlemeni okuyup seni değerlendirsin, roadmap’ini sohbette birlikte kurun, onayınla
            planına eklesin.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 sm:px-6">
        <p className="eyebrow">Bağlı uygulamalar</p>
        {loaded.status === 'loading' && (
          <p className="mt-3 flex items-center gap-2 text-[13.5px] text-ink-3">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Yükleniyor…
          </p>
        )}
        {loaded.status === 'error' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px] text-ink-2">
            <span>{loaded.message}</span>
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
          </div>
        )}
        {loaded.status === 'ready' &&
          (loaded.connections.length === 0 ? (
            <p className="mt-2 text-[13.5px] text-ink-3">Henüz bağlı bir yapay zekâ yok. Aşağıdaki adımlarla bağlayabilirsin.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-[12px] border border-line">
              {loaded.connections.map(connection => (
                <li key={connection.clientId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-sunk text-[13px] font-semibold text-ink-2 ring-1 ring-line-strong">
                    {connection.name.charAt(0).toLocaleUpperCase('tr-TR')}
                    <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-forest ring-2 ring-card" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{connection.name}</p>
                    <p className="text-[12.5px] text-ink-3">
                      Bağlı · {publishedLabel(connection.grantedAt, today)}
                      {connection.site && ` · ${connection.site}`}
                    </p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm hover:text-danger" onClick={() => void disconnect(connection)}>
                    <Unplug aria-hidden="true" />
                    Bağlantıyı kaldır
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>

      <div className="border-t border-line px-5 py-4 sm:px-6">
        <p className="eyebrow">Nasıl bağlanır?</p>
        <div className="segmented mt-3 w-full sm:w-auto" role="group" aria-label="Yapay zekâ uygulaması">
          {CLIENTS.map(c => (
            <button key={c.id} type="button" aria-pressed={client === c.id} onClick={() => setClient(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <ol className="mt-4 space-y-2.5">
          {STEPS[client].map((step, i) => (
            <li key={step} className="flex gap-3 text-[13.5px] text-ink-2">
              <span className="tnum grid size-5 shrink-0 place-items-center rounded-full bg-sunk text-[11.5px] font-semibold text-ink-2 ring-1 ring-line-strong">
                {i + 1}
              </span>
              <span className="min-w-0">{step}</span>
            </li>
          ))}
        </ol>

        <label htmlFor={`${uid}-address`} className="field-label mt-4">
          Bağlantı adresi
        </label>
        <div className="flex gap-2">
          <input id={`${uid}-address`} className="input tnum min-w-0 flex-1" value={address} readOnly onFocus={e => e.currentTarget.select()} />
          <button type="button" className="btn btn-secondary shrink-0" onClick={() => void copy()}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? 'Kopyalandı' : 'Kopyala'}
          </button>
        </div>

        <p className="eyebrow mt-5">Bağladıktan sonra sor</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map(example => (
            <li key={example} className="chip">
              <MessageSquareText className="size-3.5" aria-hidden="true" />
              {example}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12.5px] text-ink-3">
          Yapay zekâ planını okuyabilir ve senin onayınla kamp ekleyebilir; bir şey silemez, Keşfet’te yayın yapamaz, şifrene ulaşamaz.
        </p>
      </div>
    </section>
  );
}
