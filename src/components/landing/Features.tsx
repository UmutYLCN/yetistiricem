import type { PointerEvent, ReactNode } from 'react';
import { ChevronDown, Download, FileJson, Flag, Link2, Lock, Moon, Play, Sparkles, Upload } from 'lucide-react';
import { DEMO_TEMPLATES } from '../../data/demoTemplates';
import { dayOfWeek } from '../../lib/engine';
import { SHORT_WEEKDAYS, formatHours, formatLongDate, formatMinutes, formatSpeed } from '../../lib/format';
import type { LandingPreview } from '../../lib/landingPreview';
import { backupFileName } from '../../lib/persistence';
import { PALETTE, resolveColor } from '../../lib/subjects';
import { WeekRoute } from '../day/WeekRoute';
import { OverdueCard } from '../rail/RightRail';
import { SubjectDot } from '../ui/Bits';

const noop = () => {};

function trackPointer(event: PointerEvent<HTMLElement>) {
  const card = event.currentTarget;
  const box = card.getBoundingClientRect();
  card.style.setProperty('--spot-x', `${event.clientX - box.left}px`);
  card.style.setProperty('--spot-y', `${event.clientY - box.top}px`);
}

/** A feature card: title and text for everyone, a picture (inert, hidden from assistive technology) under them. */
function Bento({ id, title, children, visual, className = '' }: { id: string; title: string; children: ReactNode; visual: ReactNode; className?: string }) {
  return (
    <article id={id} aria-labelledby={`${id}-title`} className={`bento reveal ${className}`} onPointerMove={trackPointer}>
      <div className="relative px-6 pt-6 sm:px-7 sm:pt-7">
        <h3 id={`${id}-title`} className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h3>
        <p className="mt-2 max-w-[34rem] text-[14.5px] leading-relaxed text-ink-2">{children}</p>
      </div>
      <div className="relative mt-auto px-6 pt-6 pb-6 sm:px-7 sm:pb-7" aria-hidden="true" inert>
        {visual}
      </div>
    </article>
  );
}

function colorOfBranch(preview: LandingPreview, playlistId: string) {
  return preview.branches.get(playlistId)?.color.solid ?? 'var(--color-ink-3)';
}

function PlaylistVisual() {
  const branch = DEMO_TEMPLATES[0];
  const color = resolveColor(branch.colorTag, branch.subject).solid;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-[12px] border border-line-strong bg-field py-1.5 pr-1.5 pl-3">
        <Link2 className="size-4 shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink-2">https://www.youtube.com/playlist?list=…</span>
        <span className="btn btn-primary btn-sm shrink-0">Listeyi getir</span>
      </div>
      <div className="overflow-hidden rounded-[12px] border border-line bg-paper/60">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line px-4 py-3">
          <SubjectDot color={color} />
          <span className="text-[13.5px] font-semibold" style={{ color }}>
            {branch.subject}
          </span>
          <span className="chip chip-demo">Örnek liste</span>
          <span className="tnum ml-auto text-[12.5px] text-ink-3">
            {branch.videos.length} video · {formatMinutes(branch.totalDurationMinutes)}
          </span>
        </div>
        <ol>
          {branch.videos.slice(0, 4).map(video => (
            <li key={video.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5 text-[13.5px] first:border-t-0">
              <Play className="size-3.5 shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate text-ink">{video.title}</span>
              <span className="tnum shrink-0 text-ink-3">{formatMinutes(video.durationMinutes)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function DailyGoalVisual({ preview }: { preview: LandingPreview }) {
  const items = preview.day.plan?.items ?? [];
  const goal = preview.prefs.dailyStudyHours * 60;
  const planned = items.reduce((acc, item) => acc + item.effectiveMinutes, 0);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12.5px] text-ink-3">Günlük hedef</p>
        <p className="tnum text-[13px] text-ink-2">
          <span className="font-semibold text-ink">{formatMinutes(planned)}</span> / {formatMinutes(goal)}
        </p>
      </div>
      <div className="mt-2 flex h-10 gap-1 rounded-[11px] border border-line bg-field p-1">
        {items.map(item => (
          <span
            key={item.id}
            className="min-w-2 rounded-[7px]"
            style={{ flexGrow: item.effectiveMinutes, background: colorOfBranch(preview, item.playlistId) }}
          />
        ))}
        {goal - planned >= 15 && (
          <span className="rounded-[7px] border border-dashed border-line-strong" style={{ flexGrow: goal - planned }} />
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {items.slice(0, 3).map(item => (
          <li key={item.id} className="flex items-center gap-2.5 text-[13px]">
            <SubjectDot color={colorOfBranch(preview, item.playlistId)} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{item.title}</span>
            <span className="tnum shrink-0 text-ink-3">~{formatMinutes(item.effectiveMinutes)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="chip">{formatSpeed(preview.prefs.playbackSpeed)} izleme hızı</span>
        <span className="chip">%{Math.round(preview.prefs.practiceMultiplier * 100)} tekrar payı</span>
      </div>
    </div>
  );
}

function RhythmVisual({ preview }: { preview: LandingPreview }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5">
      {preview.rhythmWeek.map(day => {
        const items = day.plan?.items ?? [];
        return (
          <li key={day.date} className="flex min-w-0 flex-col items-center gap-2">
            <div className="flex h-[108px] w-full flex-col justify-end gap-1 rounded-[10px] border border-line bg-field p-1">
              {day.kind === 'rest' ? (
                <Moon className="m-auto size-4 text-ink-3" />
              ) : day.kind === 'mock' ? (
                <Flag className="m-auto size-4 text-accent" />
              ) : items.length === 0 ? (
                <span className="m-auto text-[13px] text-ink-3">–</span>
              ) : (
                items.map(item => (
                  <span
                    key={item.id}
                    className="block rounded-[4px]"
                    style={{ height: Math.max(8, Math.round(item.effectiveMinutes / 2.6)), background: colorOfBranch(preview, item.playlistId) }}
                  />
                ))
              )}
            </div>
            <span className="text-[11px] font-semibold text-ink-3">{SHORT_WEEKDAYS[dayOfWeek(day.date)]}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CatchUpVisual({ preview }: { preview: LandingPreview }) {
  return <OverdueCard count={preview.index.overdue.length} today={preview.today} onShift={noop} />;
}

function ProgressVisual({ preview, labelledBy }: { preview: LandingPreview; labelledBy: string }) {
  const { stats } = preview;
  return (
    <div>
      <WeekRoute days={preview.week} today={preview.today} selectedDate={preview.day.date} labelledBy={labelledBy} onGo={noop} />
      <dl className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-[12px] border border-line bg-field px-3.5 py-3">
          <dt className="text-[12px] text-ink-3">Tahmini bitiş</dt>
          <dd className="tnum mt-0.5 text-[14px] font-semibold text-ink">{formatLongDate(stats.estimatedFinishDate)}</dd>
        </div>
        <div className="rounded-[12px] border border-line bg-field px-3.5 py-3">
          <dt className="text-[12px] text-ink-3">Kalan çalışma</dt>
          <dd className="tnum mt-0.5 text-[14px] font-semibold text-ink">{formatHours(stats.totalMinutes)}</dd>
        </div>
      </dl>
    </div>
  );
}

// An illustration of the combined view; camp names and goals are examples.
const SAMPLE_CAMPS = [
  { name: 'TYT 2027', tempo: 'Pzt–Cmt · 1,25x', minutes: 180, color: PALETTE[0].solid },
  { name: 'İngilizce', tempo: 'Her gün · 1x', minutes: 60, color: PALETTE[6].solid },
];

function AllCampsVisual() {
  const total = SAMPLE_CAMPS.reduce((acc, camp) => acc + camp.minutes, 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-[11px] border border-line-strong bg-field px-3.5 py-2.5">
        <span className="text-[14px] font-semibold text-ink">Tüm Kamplar</span>
        <ChevronDown className="size-4 text-ink-3" />
      </div>
      {SAMPLE_CAMPS.map(camp => (
        <div key={camp.name} className="flex items-center gap-3 rounded-[11px] border border-line bg-paper/60 px-3.5 py-2.5">
          <span className="w-1 self-stretch rounded-full" style={{ background: camp.color }} />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-ink">{camp.name}</p>
            <p className="text-[12px] text-ink-3">{camp.tempo}</p>
          </div>
          <p className="tnum text-[13px] font-semibold text-ink">{formatMinutes(camp.minutes)}</p>
        </div>
      ))}
      <p className="tnum pt-1 text-[12.5px] text-ink-3">
        Günlük hedef: {SAMPLE_CAMPS.map(camp => `${camp.name} ${formatMinutes(camp.minutes)}`).join(' + ')} ={' '}
        <span className="font-semibold text-ink-2">toplam {formatMinutes(total)}</span>
      </p>
    </div>
  );
}

function BackupVisual({ today }: { today: string }) {
  return (
    <div>
      <div className="flex items-center gap-3 rounded-[12px] border border-line bg-field p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-line-strong bg-sunk">
          <FileJson className="size-5 text-ink-2" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-mono text-[12.5px] text-ink">{backupFileName(today)}</p>
          <p className="mt-0.5 text-[12px] text-ink-3">Kamplar, ilerleme ve notlar</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="btn btn-secondary btn-sm">
          <Download />
          Yedek indir
        </span>
        <span className="btn btn-ghost btn-sm">
          <Upload />
          Yedekten geri yükle
        </span>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-ink-3">
        <Lock className="size-3.5" />
        Her şey bu tarayıcıda; sunucuya gönderilmez.
      </p>
    </div>
  );
}

export function Features({ preview }: { preview: LandingPreview }) {
  return (
    <section id="ozellikler" aria-labelledby="ozellikler-baslik" className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 sm:py-32">
      <div className="reveal max-w-[720px]">
        <p className="section-eyebrow">
          <Sparkles aria-hidden="true" />
          Özellikler
        </p>
        <h2 id="ozellikler-baslik" className="section-title text-gradient mt-4">
          Planı Yetiştiricem kurar, sen çalışırsın.
        </h2>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          Videoların süresini, izleme hızını ve temponu hesaba katar; her güne sığacak kadarını koyar. Sen sadece bugünün listesine
          bakarsın.
        </p>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Bento
          id="oynatma-listesi"
          className="lg:col-span-4"
          title="Oynatma listesini yapıştır, gerisi hazır"
          visual={<PlaylistVisual />}
        >
          Herkese açık bir YouTube oynatma listesinin bağlantısı yeter: videolar adları ve gerçek süreleriyle gelir, her liste kendi branşı
          olur. İstersen videoları tek tek de ekleyebilirsin.
        </Bento>
        <Bento id="gunluk-hedef" className="lg:col-span-2" title="Günlük süreni aşmaz" visual={<DailyGoalVisual preview={preview} />}>
          Günde ne kadar çalışacağını söyle; izleme hızın ve tekrar payınla her gün o süreye sığar.
        </Bento>
        <Bento id="ritim" className="lg:col-span-2" title="Kendi ritmin" visual={<RhythmVisual preview={preview} />}>
          Branşları otomatik dağıt ya da hangi gün hangisinin geleceğini kendin seç. Dinlenme ve deneme günleri de planda.
        </Bento>
        <Bento id="ileri-tasi" className="lg:col-span-2" title="Geride mi kaldın? Sorun değil" visual={<CatchUpVisual preview={preview} />}>
          İşaretlemek planı değiştirmez. Yetişmeyen görevleri yalnızca sen istediğinde sonraki çalışma günlerine taşırsın.
        </Bento>
        <Bento
          id="ilerleme"
          className="md:col-span-2 lg:col-span-2"
          title="Hedefe ne kadar kaldı?"
          visual={<ProgressVisual preview={preview} labelledBy="ilerleme-title" />}
        >
          Haftanın rotası, kalan çalışma süresi ve tahmini bitiş tarihi her an önünde.
        </Bento>
        <Bento id="tum-kamplar" className="lg:col-span-3" title="Tüm Kamplar, tek akış" visual={<AllCampsVisual />}>
          Sınav hazırlığını ve İngilizceyi ayrı tempolarla sürdür. Bugün ekranında hepsi birlikte görünür, günlük hedefler toplanır.
        </Bento>
        <Bento id="veriler" className="lg:col-span-3" title="Hesap yok, veriler senin" visual={<BackupVisual today={preview.today} />}>
          Kampların ve ilerlemen yalnızca kullandığın tarayıcıda saklanır. Yedeğini indir, başka bir tarayıcıda geri yükle.
        </Bento>
      </div>
    </section>
  );
}
