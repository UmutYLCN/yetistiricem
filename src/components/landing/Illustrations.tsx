import type { CSSProperties } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  Flame,
  Link2,
  Moon,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DEMO_TEMPLATES } from '../../data/demoTemplates';
import { dayOfWeek } from '../../lib/engine';
import { SHORT_WEEKDAYS, formatHours, formatLongDate, formatMinutes, formatShortDate, formatSpeed } from '../../lib/format';
import type { LandingPreview } from '../../lib/landingPreview';
import { microTipFor } from '../../lib/postpone';
import { StudyHeatmap } from '../progress/StudyHeatmap';
import { msg } from '../../lib/messages';


/** Decorative UI only: all displayed durations and progress come from the labelled demo. */
export function Skeleton({ width = '100%', className = '' }: { width?: string; className?: string }) {
  return <span className={`sketch-line ${className}`} style={{ width }} />;
}

export function Thumbnail({ tone = 0, minutes }: { tone?: number; minutes?: number }) {
  return (
    <span className={`sketch-thumbnail sketch-tone-${tone % 3}`}>
      <Play size={13} fill="currentColor" strokeWidth={0} />
      {minutes !== undefined && <span className="sketch-duration">{formatMinutes(minutes)}</span>}
    </span>
  );
}

export function SketchRow({ tone = 0, minutes, done = false }: { tone?: number; minutes?: number; done?: boolean }) {
  return (
    <div className="sketch-row">
      <Thumbnail tone={tone} minutes={minutes} />
      <div className="sketch-row-lines">
        <Skeleton width={`${72 - tone * 8}%`} />
        <Skeleton width="42%" className="sketch-line-muted" />
      </div>
      {done ? <Check className="size-4 text-forest" /> : <span className="sketch-checkbox" />}
    </div>
  );
}

export function PlaylistVisual() {
  return (
    <div className="playlist-art illustration-stage">
      <div className="sketch-panel playlist-back">
        <Skeleton width="45%" />
        <Skeleton width="70%" />
      </div>
      <div className="sketch-panel playlist-front">
        <div className="sketch-toolbar">
          <Link2 />
          <Skeleton width="60%" />
          <span className="sketch-action">
            <ArrowRight />
          </span>
        </div>
        <div className="sketch-list">
          {DEMO_TEMPLATES[0].videos.slice(0, 3).map((video, i) => (
            <SketchRow key={video.id} tone={i} minutes={video.durationMinutes} />
          ))}
        </div>
        <div className="sketch-footer">
          <CircleCheck />
          <span>{msg("İsimler ve süreler hazır")}</span>
          <span className="ml-auto text-ink-3">{msg("Örnek liste")}</span>
        </div>
      </div>
      <span className="art-float-tag">
        <span className="glow-check">
          <Check />
        </span>
        {msg("\n        Tek bağlantı. Bütün seri.\n      ")}</span>
    </div>
  );
}

export function DailyGoalVisual({ preview }: { preview: LandingPreview }) {
  const items = preview.day.plan?.items ?? [];
  const goal = preview.prefs.dailyStudyHours * 60;
  const planned = items.reduce((sum, item) => sum + item.effectiveMinutes, 0);
  const ratio = Math.min(100, (planned / goal) * 100);
  return (
    <div className="daily-art illustration-stage">
      <div className="sketch-panel daily-panel">
        <div className="art-meta">
          <Clock3 />
          <span>{msg("Günlük alanın")}</span>
          <Check className="ml-auto text-forest" />
        </div>
        <p className="daily-value">
          {formatMinutes(planned)}
          <span> {msg(" / ")}{formatMinutes(goal)}</span>
        </p>
        <div className="daily-meter">
          <span style={{ width: `${ratio}%` }} />
        </div>
        <div className="daily-video-stack">
          {items.slice(0, 3).map((item, i) => (
            <SketchRow key={item.id} tone={i} minutes={item.effectiveMinutes} />
          ))}
        </div>
      </div>
      <div className="daily-settings">
        <span>{formatSpeed(preview.prefs.playbackSpeed)} {msg(" hız")}</span>
        <Plus />
        <span>{msg("%")}{Math.round(preview.prefs.practiceMultiplier * 100)} {msg(" tekrar")}</span>
        <span className="text-forest">{msg("= sana göre")}</span>
      </div>
    </div>
  );
}

export function RhythmVisual({ preview }: { preview: LandingPreview }) {
  return (
    <div className="rhythm-art illustration-stage">
      <div className="sketch-panel rhythm-panel">
        <div className="sketch-toolbar">
          <CalendarDays />
          <span>{msg("Senin haftan")}</span>
          <span className="art-segment ml-auto">
            {msg("\n            Otomatik ")}<span>{msg("Elle")}</span>
          </span>
        </div>
        <ol className="rhythm-calendar">
          {preview.rhythmWeek.map((day) => (
            <li key={day.date} data-rest={day.kind === 'rest'}>
              <span>{SHORT_WEEKDAYS[dayOfWeek(day.date)]}</span>
              <div className="rhythm-day">
                {day.kind === 'rest' ? (
                  <Moon />
                ) : (
                  (day.plan?.items ?? []).slice(0, 4).map((item, i) => (
                    <span key={item.id} className={`rhythm-task sketch-tone-${i % 3}`}>
                      <span className="rhythm-task-line" />
                      <span className="rhythm-task-line" />
                    </span>
                  ))
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="rhythm-rest-note">
        <Moon />
        <span>{msg("Dinlenmek de planın bir parçası.")}</span>
      </div>
    </div>
  );
}

export function BellVisual() {
  const fresh = DEMO_TEMPLATES[0].videos.slice(-3);
  return (
    <div className="notification-art illustration-stage">
      <div className="notification-trail">
        <span />
        <span />
        <span />
        <div className="notification-bell">
          <Bell />
          <i>{fresh.length}</i>
        </div>
      </div>
      <div className="sketch-panel notification-panel">
        <div className="notification-heading">
          <span className="glow-check">
            <Plus />
          </span>
          <div>
            <strong>{msg("Listende ")}{fresh.length} {msg(" yeni video")}</strong>
            <span>{msg("Planına eklemek senin elinde")}</span>
          </div>
          <span className="art-sample-label">{msg("Örnek")}</span>
        </div>
        <div className="sketch-list">
          {fresh.map((video, i) => (
            <SketchRow key={video.id} tone={i} minutes={video.durationMinutes} />
          ))}
        </div>
        <div className="sketch-footer">
          <span className="art-flat-action">
            {msg("\n            Planımın sonuna ekle ")}<ArrowRight />
          </span>
          <span className="text-ink-3">{msg("Daha sonra")}</span>
        </div>
      </div>
    </div>
  );
}

export function DeadlineVisual({ preview }: { preview: LandingPreview }) {
  const { deadline, stats } = preview;
  const onTrack = deadline.kind === 'on-track';
  return (
    <div className="deadline-art illustration-stage">
      <div className="sketch-panel deadline-panel">
        <div className="art-meta">
          <CalendarDays />
          <span>{msg("Tahmini bitiş")}</span>
          <span className="art-sample-label ml-auto">{msg("Demo planı")}</span>
        </div>
        <p className="deadline-date">{formatLongDate(stats.estimatedFinishDate)}</p>
        <div className="deadline-track">
          <span />
          <CircleCheck />
          <span />
          <span className="deadline-target" />
        </div>
        <div className="flex justify-between gap-2 text-[11px] text-ink-3">
          <span>{msg("Bugün")}</span>
          <span className="text-forest">{msg("Bitiş")}</span>
          <span>{msg("Hedefin")}</span>
        </div>
        <div className="deadline-result">
          <Check />
          <span>{onTrack ? `Hedefinden ${deadline.spareDays} gün önce.` : msg("Bitiş tarihin, daha başlamadan belli.")}</span>
        </div>
      </div>
    </div>
  );
}

export function RescheduleVisual({ preview }: { preview: LandingPreview }) {
  const tip = microTipFor('difficult');
  return (
    <div className="reschedule-art illustration-stage">
      <div className="sketch-panel reschedule-before">
        <span className="size-2 rounded-full bg-study-clay" />
        <span>{preview.index.overdue.length} {msg(" görev geride kaldı")}</span>
        <RotateCcw className="ml-auto size-4 text-ink-3" />
      </div>
      <div className="reschedule-connector">
        <ArrowDown />
        <span>{msg("Ritmi güncelle")}</span>
      </div>
      <div className="sketch-panel reschedule-after">
        <div className="art-meta">
          <span className="glow-check">
            <Check />
          </span>
          <span>{msg("Yeni bir gün, yeniden denge.")}</span>
        </div>
        <div className="reschedule-days">
          {preview.rhythmWeek
            .filter((day) => day.total > 0)
            .slice(0, 3)
            .map((day, i) => (
              <div key={day.date}>
                <span>{SHORT_WEEKDAYS[dayOfWeek(day.date)]}</span>
                <span className={`rhythm-task sketch-tone-${i}`}>
                  <Skeleton width="70%" />
                </span>
                <span className={`rhythm-task sketch-tone-${(i + 1) % 3}`}>
                  <Skeleton width="50%" />
                </span>
              </div>
            ))}
        </div>
        <div className="reschedule-tip">
          <Sparkles />
          <span>
            <strong>{tip.title}{msg(".")}</strong> {tip.body}
          </span>
        </div>
      </div>
    </div>
  );
}

export function HabitsVisual({ preview }: { preview: LandingPreview }) {
  const { streak, chain, commitment } = preview.insights;
  return (
    <div className="habits-art illustration-stage">
      <div className="sketch-panel habits-panel">
        <div className="habits-stats">
          <div>
            <span className="art-meta">
              <Flame />
              {msg("\n              Yetişir serisi\n            ")}</span>
            <p>
              {streak.current}
              <span> {msg(" gün")}</span>
            </p>
          </div>
          <div>
            <span className="art-meta">
              <CircleCheck />
              {msg("\n              Zamanında tamamlanan\n            ")}</span>
            <p>{commitment.score === null ? msg("—") : `%${Math.round(commitment.score)}`}</p>
          </div>
        </div>
        <ol className="habits-chain">
          {chain.map((day) => (
            <li key={day.date}>
              <span data-state={day.state}>
                {day.state === 'done' ? <Check /> : day.state === 'rest' ? <Moon /> : <span className="size-1.5 rounded-full bg-ink-3" />}
              </span>
              <small>{SHORT_WEEKDAYS[dayOfWeek(day.date)]}</small>
            </li>
          ))}
        </ol>
        <div className="sketch-footer">
          <span>{msg("Bir adım daha. Bir gün daha.")}</span>
          <span className="ml-auto text-ink-3">{msg("Demo planı")}</span>
        </div>
      </div>
    </div>
  );
}

export function HeatmapVisual({ preview }: { preview: LandingPreview }) {
  return (
    <div className="landing-heatmap">
      <StudyHeatmap heatmap={preview.insights.heatmap} today={preview.today} undated={0} since={preview.insights.since} />
    </div>
  );
}

export function ProgressVisual({ preview }: { preview: LandingPreview }) {
  const { stats } = preview;
  const percent = stats.totalVideos ? Math.round((stats.completedVideos / stats.totalVideos) * 100) : 0;
  return (
    <div className="progress-art illustration-stage">
      <div className="sketch-panel progress-panel">
        <div className="progress-summary">
          <div className="progress-ring" style={{ '--progress': `${percent}%` } as CSSProperties}>
            <span>{msg("%")}{percent}</span>
          </div>
          <div>
            <span className="art-meta">{msg("Her adım sayılır")}</span>
            <p className="mt-1 text-[22px] font-semibold">
              {stats.completedVideos}
              <span className="text-[14px] font-normal text-ink-3"> {msg(" / ")}{stats.totalVideos} {msg(" görev")}</span>
            </p>
          </div>
        </div>
        <div className="progress-week">
          {preview.week.map((day) => (
            <div key={day.date}>
              <span>{SHORT_WEEKDAYS[dayOfWeek(day.date)]}</span>
              <span className={day.date === preview.day.date ? 'is-current' : ''}>
                {day.kind === 'rest' ? (
                  <Moon />
                ) : (
                  <span>
                    {day.done}{msg("/")}{day.total}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
        <dl className="progress-details">
          <div>
            <dt>{msg("Tahmini bitiş")}</dt>
            <dd>{formatShortDate(stats.estimatedFinishDate)}</dd>
          </div>
          <div>
            <dt>{msg("Kalan çalışma")}</dt>
            <dd>{formatHours(stats.totalMinutes)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
