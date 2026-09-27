import type { PointerEvent, ReactNode } from 'react';
import { useMemo } from 'react';
import { Bell, Brain, Check, ChevronDown, Clock, Cloud, Flag, Import, Laptop, Link2, Moon, Pause, Play, Plus, Smartphone, Sparkles } from 'lucide-react';
import { DEMO_TEMPLATES } from '../../data/demoTemplates';
import { dayStops } from '../../lib/dayPath';
import { dayOfWeek } from '../../lib/engine';
import { SHORT_WEEKDAYS, formatHours, formatLongDate, formatMinutes, formatShortDate, formatSpeed } from '../../lib/format';
import type { LandingPreview } from '../../lib/landingPreview';
import { REASON_COPY, microTipFor } from '../../lib/postpone';
import { PALETTE, resolveColor } from '../../lib/subjects';
import type { PostponeReason } from '../../types';
import { WeekRoute } from '../day/WeekRoute';
import { DayPath } from '../path/DayPath';
import { CommitmentGauge } from '../progress/CommitmentGauge';
import { StreakCard } from '../progress/StreakCard';
import { StudyHeatmap } from '../progress/StudyHeatmap';
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
        <h4 id={`${id}-title`} className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h4>
        <p className="mt-2 max-w-[34rem] text-[14.5px] leading-relaxed text-ink-2">{children}</p>
      </div>
      <div className="relative mt-auto px-6 pt-6 pb-6 sm:px-7 sm:pb-7" aria-hidden="true" inert>
        {visual}
      </div>
    </article>
  );
}

/** One stage of the study loop: a numbered heading and its cards. */
function Chapter({ id, n, label, title, text, children }: { id: string; n: string; label: string; title: string; text: string; children: ReactNode }) {
  return (
    <div className="mt-20 first-of-type:mt-14 sm:mt-28" role="group" aria-labelledby={`${id}-title`}>
      <div className="reveal grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end lg:gap-16">
        <div>
          <p className="flex items-center gap-2.5 text-[13px] font-semibold text-ink-3">
            <span className="kbd tnum">{n}</span>
            {label}
          </p>
          <h3 id={`${id}-title`} className="mt-4 text-[28px] leading-[1.15] font-semibold tracking-[-0.025em] text-ink sm:text-[34px]">
            {title}
          </h3>
        </div>
        <p className="max-w-[560px] text-[16px] leading-relaxed text-ink-2 lg:pb-1">{text}</p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-6">{children}</div>
    </div>
  );
}

function colorOfBranch(preview: LandingPreview, playlistId: string) {
  return preview.branches.get(playlistId)?.color.solid ?? 'var(--color-ink-3)';
}

// ---------------------------------------------------------------------------
// 01 Planla

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
          <span key={item.id} className="min-w-2 rounded-[7px]" style={{ flexGrow: item.effectiveMinutes, background: colorOfBranch(preview, item.playlistId) }} />
        ))}
        {goal - planned >= 15 && <span className="rounded-[7px] border border-dashed border-line-strong" style={{ flexGrow: goal - planned }} />}
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

/** The demo camp against its own target date: today, the plan's last day, the target. */
function DeadlineVisual({ preview }: { preview: LandingPreview }) {
  const { deadline, today, stats } = preview;
  if (deadline.kind !== 'on-track' && deadline.kind !== 'late') return null;
  const days = (date: string) => (Date.parse(date) - Date.parse(today)) / 86_400_000;
  const span = Math.max(1, days(deadline.targetEndDate), days(deadline.finishDate));
  const at = (date: string) => `${Math.min(100, Math.max(0, (days(date) / span) * 100))}%`;
  const marks = [
    { date: today, label: 'Bugün', tone: 'bg-ink-2' },
    { date: deadline.finishDate, label: 'Bitiş', tone: 'bg-forest' },
    { date: deadline.targetEndDate, label: 'Hedef', tone: 'bg-accent' },
  ];
  return (
    <div>
      <div className="rounded-[14px] border border-forest/40 bg-forest-soft px-4 py-3.5">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <Check className="size-4 text-forest" strokeWidth={3} />
          {deadline.kind === 'on-track' ? 'Panik yok, yetişir.' : `Hedefin ${deadline.lateDays} gün gerisinde.`}
        </p>
        <p className="mt-1 text-[13px] text-ink-2">
          Plan {formatLongDate(deadline.finishDate)} tarihinde bitiyor
          {deadline.kind === 'on-track' && deadline.spareDays > 0 ? `; hedeften ${deadline.spareDays} gün önce.` : '.'}
        </p>
      </div>
      <div className="relative mx-4 mt-7 h-1.5 rounded-full bg-field">
        <span className="absolute inset-y-0 left-0 rounded-full bg-forest" style={{ width: at(deadline.finishDate) }} />
        {marks.map(mark => (
          <span key={mark.label} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: at(mark.date) }}>
            <span className={`block size-3 rounded-full ring-4 ring-card ${mark.tone}`} />
            <span className="tnum absolute top-4 left-1/2 -translate-x-1/2 text-center text-[11px] leading-snug whitespace-nowrap text-ink-3">
              {mark.label}
              <br />
              {formatShortDate(mark.date)}
            </span>
          </span>
        ))}
      </div>
      <p className="tnum mt-12 text-[12.5px] text-ink-3">
        Kalan {formatHours(stats.totalMinutes)} · günde {preview.prefs.dailyStudyHours} saat · {formatSpeed(preview.prefs.playbackSpeed)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 02 Çalış

function PathVisual({ preview }: { preview: LandingPreview }) {
  const stops = useMemo(() => dayStops(preview.day, preview.today).slice(0, 4), [preview.day, preview.today]);
  const minutes = stops.reduce((acc, s) => acc + s.item.effectiveMinutes, 0);
  const doneMinutes = stops.filter(s => s.item.completed).reduce((acc, s) => acc + s.item.effectiveMinutes, 0);
  return (
    <div className="-mx-2 max-h-[360px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_78%,transparent)]">
      <DayPath
        stops={stops}
        look={item => ({ color: colorOfBranch(preview, item.playlistId), tag: item.subject, playable: false })}
        isToday={preview.day.date === preview.today}
        minutes={minutes}
        doneMinutes={doneMinutes}
        onOpen={noop}
      />
    </div>
  );
}

function FocusVisual({ preview }: { preview: LandingPreview }) {
  const item = preview.day.plan?.items.find(i => !i.completed) ?? preview.day.plan?.items[0];
  const color = item ? colorOfBranch(preview, item.playlistId) : 'var(--color-ink-3)';
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-paper">
      <div className="flex items-center gap-1.5 border-b border-line px-3.5 py-2.5 text-[12px]">
        <span className="font-semibold text-accent-strong">Yetişir Focus</span>
        <span className="text-ink-3">·</span>
        <SubjectDot color={color} />
        <span className="min-w-0 truncate" style={{ color }}>
          {item?.subject}
        </span>
      </div>
      <div className="relative grid aspect-video place-items-center bg-sunk">
        <span className="grid size-14 place-items-center rounded-full bg-ink text-paper">
          <Play className="ml-0.5 size-6" fill="currentColor" />
        </span>
        <span className="absolute right-3 bottom-3 left-3 h-1 overflow-hidden rounded-full bg-line-strong">
          <span className="block h-full w-[62%] rounded-full bg-accent" />
        </span>
        <span className="absolute top-3 right-3 rounded-full bg-forest px-3 py-1 text-[12px] font-semibold text-on-fill">Harika iş! Sıradaki →</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 text-[12px] text-ink-2">
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{item?.title}</span>
        <span className="chip">
          <Clock />
          {formatSpeed(preview.prefs.playbackSpeed)}
        </span>
        <span className="chip">
          <Pause />2 duraklama
        </span>
      </div>
    </div>
  );
}

function BellVisual() {
  const branch = DEMO_TEMPLATES[0];
  const fresh = branch.videos.slice(-3);
  const color = resolveColor(branch.colorTag, branch.subject).solid;
  return (
    <div>
      <div className="flex justify-end">
        <span className="relative grid size-10 place-items-center rounded-[11px] border border-line-strong bg-field text-ink-2">
          <Bell className="size-[18px]" />
          <span className="tnum absolute -top-1.5 -right-1.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-on-fill">
            {fresh.length}
          </span>
        </span>
      </div>
      <div className="mt-2 overflow-hidden rounded-[14px] border border-line-strong bg-card">
        <div className="border-b border-line px-4 py-3">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
            <SubjectDot color={color} />
            {branch.subject} listesine {fresh.length} yeni video
          </p>
          <p className="tnum mt-0.5 text-[12px] text-ink-3">Toplam {formatMinutes(fresh.reduce((acc, v) => acc + v.durationMinutes, 0))} · günde bir kez bakılır</p>
        </div>
        <ul className="px-4 py-2">
          {fresh.map(video => (
            <li key={video.id} className="flex items-center gap-2 py-1.5 text-[12.5px] text-ink-2">
              <Plus className="size-3.5 text-forest" />
              <span className="min-w-0 flex-1 truncate">{video.title}</span>
              <span className="tnum text-ink-3">{formatMinutes(video.durationMinutes)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
          <span className="btn btn-primary btn-sm">Planımın sonuna ekle</span>
          <span className="btn btn-ghost btn-sm">Göz ardı et</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 03 Toparlan

const SHOWN_REASONS: PostponeReason[] = ['distraction', 'difficult', 'exhausted', 'emergency'];

function RescheduleVisual({ preview }: { preview: LandingPreview }) {
  const tip = microTipFor('difficult');
  return (
    <div className="space-y-3">
      <OverdueCard count={Math.max(1, preview.index.overdue.length)} today={preview.today} onShift={noop} />
      <div className="rounded-[14px] border border-line bg-paper/60 p-3.5">
        <p className="text-[13px] font-semibold text-ink">Neden yetişmedi?</p>
        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {SHOWN_REASONS.map(reason => (
            <span
              key={reason}
              className={`truncate rounded-[9px] border px-2.5 py-2 text-[12px] ${
                reason === 'difficult' ? 'border-accent/60 bg-accent-soft font-semibold text-ink' : 'border-line bg-field text-ink-2'
              }`}
            >
              {REASON_COPY[reason].label}
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2.5 rounded-[11px] bg-sunk px-3 py-2.5">
          <Brain className="mt-0.5 size-4 shrink-0 text-accent-strong" />
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">{tip.title}</span> {tip.body}
          </p>
        </div>
      </div>
    </div>
  );
}

function HabitsVisual({ preview }: { preview: LandingPreview }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <StreakCard streak={preview.insights.streak} chain={preview.insights.chain} />
      <CommitmentGauge commitment={preview.insights.commitment} />
    </div>
  );
}

function HeatmapVisual({ preview }: { preview: LandingPreview }) {
  const { insights, today } = preview;
  return <StudyHeatmap heatmap={insights.heatmap} today={today} undated={0} since={insights.since} />;
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

// ---------------------------------------------------------------------------
// 04 Birlikte

// Pictures of the combined view and Keşfet; camp names and authors are examples.
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

const SAMPLE_SHELF = [
  { template: DEMO_TEMPLATES[0], when: 'Bugün' },
  { template: DEMO_TEMPLATES[2], when: '3 gün önce' },
];

function KesfetVisual() {
  return (
    <ul className="space-y-2.5">
      {SAMPLE_SHELF.map(({ template, when }) => {
        const color = resolveColor(template.colorTag, template.subject).solid;
        return (
          <li key={template.id} className="rounded-[14px] border border-line bg-paper/60 px-4 py-3.5">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{template.title}</p>
              <span className="chip chip-demo shrink-0">Örnek</span>
            </div>
            <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-ink-2">
              <span className="grid size-5 place-items-center rounded-full bg-sunk text-[10px] font-semibold ring-1 ring-line-strong">Ö</span>
              Örnek öğrenci <span className="text-ink-3">· {when}</span>
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="chip">
                <SubjectDot color={color} />
                {template.subject}
              </span>
              <span className="tnum text-[12px] text-ink-3">
                {template.videos.length} konu · {formatHours(template.totalDurationMinutes)}
              </span>
              <span className="btn btn-secondary btn-sm ml-auto">
                <Import />
                Planıma ekle
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DevicesVisual({ today }: { today: string }) {
  return (
    <div className="mx-auto flex max-w-[560px] items-center justify-center gap-4 py-2">
      <div className="grid flex-[1.3] justify-items-center gap-2 rounded-[14px] border border-line bg-paper/60 px-3 py-5">
        <Laptop className="size-9 text-ink-2" strokeWidth={1.5} />
        <p className="text-[12px] text-ink-3">Bilgisayar</p>
        <span className="chip chip-forest">
          <Check />
          Kaydedildi
        </span>
      </div>
      <div className="grid justify-items-center gap-1.5">
        <span className="h-px w-10 bg-linear-to-r from-transparent via-forest to-transparent" />
        <Cloud className="size-6 text-forest" />
        <span className="tnum text-[11px] text-ink-3">{formatShortDate(today)}</span>
        <span className="h-px w-10 bg-linear-to-r from-transparent via-forest to-transparent" />
      </div>
      <div className="grid flex-1 justify-items-center gap-2 rounded-[14px] border border-line bg-paper/60 px-3 py-5">
        <Smartphone className="size-9 text-ink-2" strokeWidth={1.5} />
        <p className="text-[12px] text-ink-3">Telefon</p>
        <span className="chip chip-forest">
          <Check />
          Güncel
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Features({ preview }: { preview: LandingPreview }) {
  return (
    <section id="ozellikler" aria-labelledby="ozellikler-baslik" className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 sm:py-32">
      <div className="reveal max-w-[760px]">
        <p className="section-eyebrow">
          <Sparkles aria-hidden="true" />
          Özellikler
        </p>
        <h2 id="ozellikler-baslik" className="section-title text-gradient mt-4">
          Planı Yetişir kurar, sen çalışırsın.
        </h2>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          Planla, çalış, aksadığında toparlan, gerekirse başkalarının kampından ilham al. Aşağıdaki görsellerin hepsi uygulamanın kendi
          ekranları; demo kampıyla çiziliyor.
        </p>
      </div>

      <Chapter
        id="planla"
        n="01"
        label="Planla"
        title="Hedefin gün gün hesaplanır."
        text="Oynatma listeni ekle, günlük süreni ve izleme hızını söyle. Yetişir her güne sığacak kadarını koyar ve hedef tarihine yetişip yetişmediğini daha kaydetmeden gösterir."
      >
        <Bento id="oynatma-listesi" className="lg:col-span-4" title="Oynatma listesini yapıştır, gerisi hazır" visual={<PlaylistVisual />}>
          Herkese açık bir YouTube oynatma listesinin bağlantısı yeter: videolar adları ve gerçek süreleriyle gelir, her liste kendi branşı
          olur. Tek tek video bağlantıları ya da YouTube dışındaki konular da olur.
        </Bento>
        <Bento id="gunluk-hedef" className="lg:col-span-2" title="Günlük süreni aşmaz" visual={<DailyGoalVisual preview={preview} />}>
          İzleme hızın ve tekrar payınla her gün söylediğin süreye sığar.
        </Bento>
        <Bento id="ritim" className="lg:col-span-3" title="Kendi ritmin" visual={<RhythmVisual preview={preview} />}>
          Branşları otomatik dağıt ya da hangi gün hangisinin geleceğini kendin seç. Dinlenme ve deneme günleri de planda.
        </Bento>
        <Bento id="yetisir-mi" className="lg:col-span-3" title="“Yetişir mi?” sorusunun cevabı" visual={<DeadlineVisual preview={preview} />}>
          Hedef tarih seçtiğinde plan hangi gün bittiğini ve hedefe kaç gün kaldığını söyler. Yetişmiyorsa günlük süreyi ne kadar artırman
          gerektiğini önerir.
        </Bento>
      </Chapter>

      <Chapter
        id="calis"
        n="02"
        label="Çalış"
        title="Bugün sadece bugünün adımı."
        text="Dağın tamamını değil, bugünün yolunu görürsün. Videoyu dikkat dağıtmadan izler, bitince bir sonrakine geçersin."
      >
        <Bento id="gunun-yolu" className="lg:col-span-2" title="Günün yolu" visual={<PathVisual preview={preview} />}>
          Bugünün görevleri bir yol üzerinde durak durak; nerede olduğun ve ne kadar kaldığı bir bakışta.
        </Bento>
        <Bento id="focus" className="lg:col-span-2" title="Yetişir Focus" visual={<FocusVisual preview={preview} />}>
          Videoyu YouTube’a gitmeden, önerisiz bir oynatıcıda izle. Bittiğinde görev kendiliğinden tamamlanır.
        </Bento>
        <Bento id="yeni-videolar" className="md:col-span-2 lg:col-span-2" title="Listen büyüdükçe haber verir" visual={<BellVisual />}>
          Oynatma listesine yeni ders eklendiğinde zil çalar; tek tıkla planının sonuna eklersin.
        </Bento>
      </Chapter>

      <Chapter
        id="toparlan"
        n="03"
        label="Toparlan"
        title="Aksadığında suçluluk yok."
        text="Bir gün kaçtıysa plan seni cezalandırmaz. Ritmini güncellersin, kalanlar yeniden dağılır; neden aksadığını seçersen alışkanlıklarını görür, küçük bir öneri alırsın."
      >
        <Bento id="ritmi-guncelle" className="lg:col-span-3" title="Ritmi güncelle, yine yetişir" visual={<RescheduleVisual preview={preview} />}>
          Geciken görevler kırmızıyla öne çıkar ve tek dokunuşla sonraki çalışma günlerine yayılır. Nedenini seçersen ona göre küçük bir
          adım önerilir.
        </Bento>
        <Bento id="seri" className="lg:col-span-3" title="Yetişir serisi ve sözünü tutma oranın" visual={<HabitsVisual preview={preview} />}>
          Kesintisiz çalıştığın günler seriye dönüşür; görevlerini planlı gününde bitirme oranın da her an önünde.
        </Bento>
        <Bento id="isi-haritasi" className="lg:col-span-4" title="Çalışma ısı haritası" visual={<HeatmapVisual preview={preview} />}>
          Son haftalarda gün gün ne kadar çalıştığın; hangi günler güçlü, hangileri boş, bir bakışta.
        </Bento>
        <Bento
          id="ilerleme"
          className="md:col-span-2 lg:col-span-2"
          title="Hedefe ne kadar kaldı?"
          visual={<ProgressVisual preview={preview} labelledBy="ilerleme-title" />}
        >
          Haftanın rotası, kalan çalışma ve tahmini bitiş.
        </Bento>
      </Chapter>

      <Chapter
        id="birlikte"
        n="04"
        label="Birlikte"
        title="Tek başına kurmak zorunda değilsin."
        text="Başka öğrencilerin yayınladığı kampları incele, beğendiğini planına ekle. Birden fazla hedefi aynı anda sürdür; planın her cihazda seninle."
      >
        <Bento id="kesfet" className="lg:col-span-3" title="Keşfet" visual={<KesfetVisual />}>
          Öğrencilerin paylaştığı kampların içine bak, kimin hazırladığını gör, tek tıkla kendi planına kopyala.
        </Bento>
        <Bento id="tum-kamplar" className="lg:col-span-3" title="Tüm Kamplar, tek akış" visual={<AllCampsVisual />}>
          Sınav hazırlığını ve İngilizceyi ayrı tempolarla sürdür. Bugün ekranında hepsi birlikte görünür, günlük hedefler toplanır.
        </Bento>
        <Bento id="her-cihaz" className="md:col-span-2 lg:col-span-6" title="Planın hesabında, her cihazda" visual={<DevicesVisual today={preview.today} />}>
          Kampların, ilerlemen ve notların hesabına kaydedilir; telefondan da bilgisayardan da aynı planı açarsın. Paylaşım linkiyle bir kampı
          arkadaşına gönderebilir, istersen yedeğini dosya olarak indirebilirsin.
        </Bento>
      </Chapter>
    </section>
  );
}
