import { Download, LoaderCircle } from 'lucide-react';
import type { SharedCamp } from '../../lib/campShare';
import { shareSummary } from '../../lib/campShare';
import { formatHours, formatLongDate, formatMinutes } from '../../lib/format';
import { weekdaysLabel } from '../../lib/planView';
import { resolveColor } from '../../lib/subjects';
import { SubjectDot } from '../ui/Bits';
import { Dialog } from '../ui/Dialog';
import { msg } from '../../lib/messages';


export type ImportOffer = { status: 'loading' } | { status: 'ready'; camp: SharedCamp; source: 'link' | 'mcp' | 'mcp-kesfet' } | { status: 'error'; message: string };

interface Props {
  /** Null when there is nothing to import. */
  offer: ImportOffer | null;
  today: string;
  isDemo: boolean;
  onImport: (camp: SharedCamp) => void;
  onClose: () => void;
}

const SHOWN_BRANCHES = 8;

/** Asks before a shared camp or AI proposal joins the student's camps. */
export function ImportCampDialog({ offer, today, isDemo, onImport, onClose }: Props) {
  if (offer?.status === 'error') {
    return (
      <Dialog
        open
        onClose={onClose}
        tone="danger"
        width={460}
        title={msg("Kamp içe aktarılamadı")}
        footer={
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {msg("\n            Tamam\n          ")}</button>
        }
      >
        <p className="text-[14.5px] text-ink-2">{offer.message}</p>
      </Dialog>
    );
  }

  const camp = offer?.status === 'ready' ? offer.camp : null;
  const isMcp = offer?.status === 'ready' && offer.source !== 'link';
  const summary = camp ? shareSummary(camp) : null;
  const studyDays = camp ? camp.schedule.activeDays.filter(d => !camp.schedule.restDays.includes(d) && !camp.schedule.mockExamDays.includes(d)) : [];

  return (
    <Dialog
      open={offer !== null}
      onClose={onClose}
      width={isMcp ? 720 : 540}
      tall={isMcp}
      eyebrow={isMcp ? 'Yapay zekâ taslağı' : 'Paylaşılan kamp'}
      title={camp ? (isMcp ? msg("Kampı planına eklemeden önce incele") : msg("Yeni kampı içe aktarmak istiyor musun?")) : msg("Kamp okunuyor…")}
      description={
        summary
          ? `${summary.branches} branş · ${summary.videos} video · toplam ${formatHours(summary.minutes)}`
          : undefined
      }
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {msg("\n            Vazgeç\n          ")}</button>
          <button type="button" className="btn btn-primary" disabled={!camp} onClick={() => camp && onImport(camp)} data-autofocus={isMcp ? undefined : true}>
            <Download aria-hidden="true" />
            {isMcp ? msg("Planıma ekle") : msg("İçe aktar")}
          </button>
        </>
      }
    >
      {!camp ? (
        <p className="flex items-center gap-2 py-4 text-[14px] text-ink-2">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {msg("\n          Bağlantıdaki kamp açılıyor…\n        ")}</p>
      ) : (
        <div className="space-y-4">
          {isMcp && (
            <p className="rounded-[10px] border border-forest/30 bg-forest-tint px-3.5 py-2.5 text-[13.5px] text-forest">
              {msg("\n              Bu kamp henüz planına eklenmedi. Aşağıdaki listenin tamamını gözden geçir; yalnızca “Planıma ekle” dediğinde kaydedilir.\n            ")}</p>
          )}
          <section className="rounded-[14px] border border-line bg-sunk/60 p-4">
            <p className="font-display text-[19px] break-words text-ink">{camp.name}</p>
            <p className="tnum mt-1 text-[13px] text-ink-2">
              {msg("\n              Günde ")}{formatMinutes(camp.schedule.dailyStudyHours * 60)} {msg(" · ")}{weekdaysLabel(studyDays)} {msg(" ·")}{msg(" ")}
              {camp.schedule.mode === 'manual' ? msg("elle yerleşim") : msg("otomatik dağıtım")}
            </p>
            {!isMcp && (
              <ul className="mt-3 space-y-1.5">
                {camp.branches.slice(0, SHOWN_BRANCHES).map((branch, i) => (
                  <li key={`${branch.subject}-${i}`} className="flex min-w-0 items-center gap-2 text-[13.5px]">
                    <SubjectDot color={resolveColor(branch.color, branch.subject).solid} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold text-ink">{branch.subject}</span>
                      {branch.title && <span className="text-ink-3"> {msg(" · ")}{branch.title}</span>}
                    </span>
                    <span className="tnum shrink-0 text-ink-3">{branch.videos.length} {msg(" video")}</span>
                  </li>
                ))}
                {camp.branches.length > SHOWN_BRANCHES && (
                  <li className="text-[12.5px] text-ink-3">{msg("+")}{camp.branches.length - SHOWN_BRANCHES} {msg(" branş daha")}</li>
                )}
              </ul>
            )}
          </section>
          {isMcp && (
            <div className="space-y-3" aria-label={msg("Kampın tüm dersleri ve konuları")}>
              {camp.branches.map((branch, branchIndex) => (
                <section key={`${branch.subject}-${branchIndex}`} className="overflow-hidden rounded-[12px] border border-line bg-card">
                  <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
                    <SubjectDot color={resolveColor(branch.color, branch.subject).solid} />
                    <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{branch.subject}{branch.title ? ` · ${branch.title}` : msg("")}</h3>
                    <span className="tnum shrink-0 text-[12px] text-ink-3">{branch.videos.length} {msg(" öğe")}</span>
                  </div>
                  <ol className="divide-y divide-line/70">
                    {branch.videos.map((video, videoIndex) => (
                      <li key={`${video.youtubeId ?? video.title}-${videoIndex}`} className="flex min-w-0 items-start gap-3 px-3.5 py-2 text-[13px]">
                        <span className="tnum w-6 shrink-0 text-right text-ink-3">{videoIndex + 1}{msg(".")}</span>
                        <span className="min-w-0 flex-1 break-words text-ink-2">{video.title}</span>
                        <span className="tnum shrink-0 text-ink-3">{formatMinutes(video.minutes)}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}
          <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-ink-2">
            <li>{msg("Kamp bugünden (")}{formatLongDate(today)}{msg(") başlar; temposunu Kamplar’dan değiştirebilirsin.")}</li>
            {isMcp ? <li>{msg("Kamp sıfırdan başlar; diğer kampların etkilenmez.")}{offer?.status === 'ready' && offer.source === 'mcp-kesfet' ? msg(" Keşfet’teki sahibine ait olarak işaretli kalır.") : msg("")}</li> : <li>{msg("Paylaşanın ilerlemesi, notları ve ileri taşımaları gelmez; kamp sıfırdan başlar.")}</li>}
            {!isMcp && <li>{msg("Videolar yalnızca YouTube bağlantısı olarak alınır; diğer kampların etkilenmez.")}</li>}
            {isDemo && <li className="text-warn">{msg("Demodan çıkılır; kamp kendi verilerine eklenir.")}</li>}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
