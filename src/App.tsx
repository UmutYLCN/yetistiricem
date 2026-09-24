import { useCallback, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { CalendarCheck, Eye, Info, LogOut, TriangleAlert, X } from 'lucide-react';
import type { DailyPlanItem, SubjectPlaylist, UserPreferences } from './types';
import { usePlanner } from './hooks/usePlanner';
import { useToday } from './hooks/useToday';
import { addDays, buildSchedule, calculateStats, countCompletedVideos, createShiftEvent } from './lib/engine';
import { isLegacyKind } from './lib/camps';
import { formatDayTitle, formatLongDate, relativeDayLabel, weekKeys } from './lib/format';
import { backupFileName, createBackup, parseBackup } from './lib/persistence';
import { indexCamps, indexPlans, nextUp, summarizeDay, weeksOverview } from './lib/planView';
import { DayNote } from './components/day/DayNote';
import { DayPanel } from './components/day/DayPanel';
import { WeekStrip } from './components/day/WeekStrip';
import { AddCampDialog } from './components/camps/AddCampDialog';
import { AddVideosDialog, EditCampDialog, EditVideoDialog } from './components/camps/CampDialogs';
import type { View } from './components/layout/Navigation';
import { MobileTabBar, MobileTopBar, Sidebar } from './components/layout/Navigation';
import { PageHeader } from './components/layout/PageHeader';
import { NextUpCard, OverdueCard, ProgressCard, WeekCard } from './components/rail/RightRail';
import { ConfirmProvider, useConfirm } from './components/ui/ConfirmDialog';
import { ToastProvider, useToast } from './components/ui/Toast';
import { CampsView } from './components/views/CampsView';
import { ProgressView } from './components/views/ProgressView';
import { SettingsView } from './components/views/SettingsView';
import { WeekView } from './components/views/WeekView';
import { NoCampsYet, Welcome } from './components/views/Welcome';

type CampDialog =
  | { kind: 'editCamp'; campId: string }
  | { kind: 'addVideos'; campId: string }
  | { kind: 'editVideo'; campId: string; videoId: string }
  | null;

function celebrate() {
  void confetti({
    particleCount: 70,
    spread: 65,
    startVelocity: 32,
    origin: { y: 0.75 },
    colors: ['#1f5a43', '#e0782f', '#34496b', '#e2ede6'],
    disableForReducedMotion: true,
  });
}

function Planner() {
  const today = useToday();
  const { data, isDemo, selectedDate, notices, actions } = usePlanner(today);
  const notify = useToast();
  const confirm = useConfirm();
  const [view, setView] = useState<View>('today');
  const [addOpen, setAddOpen] = useState(false);
  const [campDialog, setCampDialog] = useState<CampDialog>(null);
  const [legacyDismissed, setLegacyDismissed] = useState(false);

  const schedule = useMemo(
    () =>
      buildSchedule(data.playlists, data.preferences, {
        completedMap: data.completedMap,
        shiftEvents: data.shiftEvents,
        today,
      }),
    [data.playlists, data.preferences, data.completedMap, data.shiftEvents, today]
  );
  const prefs = schedule.preferences;
  const index = useMemo(() => indexPlans(schedule.plans, today), [schedule.plans, today]);
  const camps = useMemo(() => indexCamps(data.playlists), [data.playlists]);
  const stats = useMemo(() => {
    const total = data.playlists.reduce((acc, p) => acc + p.videos.length, 0);
    return calculateStats(schedule.plans, total, countCompletedVideos(data.playlists, data.completedMap));
  }, [schedule.plans, data.playlists, data.completedMap]);
  const oversizedIds = useMemo(
    () => new Set(schedule.issues.flatMap(issue => (issue.kind === 'oversized-item' ? [issue.itemId] : []))),
    [schedule.issues]
  );
  const weekDays = useMemo(
    () => weekKeys(selectedDate).map(date => summarizeDay(date, index, prefs)),
    [selectedDate, index, prefs]
  );
  const hasCamps = data.playlists.length > 0;
  const hasLegacy = [...camps.values()].some(c => isLegacyKind(c.kind));

  // --- actions -----------------------------------------------------------

  const selectDate = actions.setSelectedDate;

  const navigate = (next: View) => {
    if (next === 'today') selectDate(today);
    setView(next);
  };

  const openDay = (date: string) => {
    selectDate(date);
    setView('today');
  };

  const handleToggle = (item: DailyPlanItem, done: boolean) => {
    actions.setCompleted(item.videoId, done);
    if (!done) return;
    const date = index.items.find(s => s.item.id === item.id)?.date;
    const dayItems = date ? (index.byDate.get(date)?.items ?? []) : [];
    const dayDone = dayItems.length > 0 && dayItems.every(i => i.videoId === item.videoId || i.completed);
    if (dayDone) celebrate();
    notify({
      message: dayDone ? `Günün tüm görevleri tamam! “${item.title}” işaretlendi.` : `“${item.title}” tamamlandı.`,
      actionLabel: 'Geri al',
      onAction: () => actions.setCompleted(item.videoId, false),
    });
  };

  const handleShift = (date: string) => {
    const event = createShiftEvent(date, schedule.plans, today);
    if (!event) {
      notify({ message: 'Taşınacak tamamlanmamış görev yok.', tone: 'info' });
      return;
    }
    actions.addShiftEvent(event);
    notify({
      message: `${event.itemIds.length} görev ${formatLongDate(event.resumeDate)} gününden itibaren yeniden planlandı.`,
      actionLabel: 'Geri al',
      onAction: () => actions.removeShiftEvent(event),
    });
  };

  const handleEditLink = (item: DailyPlanItem) => setCampDialog({ kind: 'editVideo', campId: item.playlistId, videoId: item.videoId });

  const openAddCamp = async () => {
    if (isDemo) {
      const ok = await confirm({
        title: 'Demodan çıkılsın mı?',
        body: <p>Kendi planını kurmak için demodan çıkman gerekiyor. Demo verileri kaydedilmez ve silinir.</p>,
        confirmLabel: 'Demodan çık ve kamp ekle',
      });
      if (!ok) return;
      actions.exitDemo();
    }
    setAddOpen(true);
  };

  const handleCreateCamp = (camp: SubjectPlaylist) => {
    if (data.playlists.length === 0) {
      // Pin the start date now: unsaved defaults would restart the plan every day,
      // and a start date from before any camp existed would make it overdue at once.
      const startDate = data.preferences.startDate < today ? today : data.preferences.startDate;
      actions.setPreferences({ ...data.preferences, startDate });
      actions.addCamp(camp);
      notify({
        message:
          startDate === today
            ? `“${camp.title}” eklendi. Planın bugünden itibaren hazır.`
            : `“${camp.title}” eklendi. Plan başlangıcı: ${formatLongDate(startDate)}.`,
        tone: 'info',
      });
      return;
    }

    actions.addCamp(camp);
    // The plan is laid out from its start date, so a camp added mid-plan would
    // land partly on past days. Carry only those new tasks forward, as a normal
    // stored shift event (today's plan stays as it is).
    const { plans } = buildSchedule([...data.playlists, camp], data.preferences, {
      completedMap: data.completedMap,
      shiftEvents: data.shiftEvents,
      today,
    });
    const pastIds = plans
      .filter(plan => plan.date < today)
      .flatMap(plan => plan.items.filter(item => item.playlistId === camp.id && !item.completed).map(item => item.id));
    if (pastIds.length > 0) {
      actions.addShiftEvent({ date: addDays(today, -1), resumeDate: addDays(today, 1), itemIds: pastIds });
    }
    notify({
      message:
        pastIds.length > 0
          ? `“${camp.title}” eklendi; geçmiş günlere düşen ${pastIds.length} görevi yarından itibaren planlandı.`
          : `“${camp.title}” eklendi.`,
      tone: 'info',
    });
  };

  const handleRemoveCamp = async (campId: string) => {
    const camp = data.playlists.find(p => p.id === campId);
    if (!camp) return;
    const doneCount = camp.videos.filter(v => data.completedMap[v.id]).length;
    const ok = await confirm({
      title: 'Kamp kaldırılsın mı?',
      tone: 'danger',
      confirmLabel: 'Kampı kaldır',
      body: (
        <>
          <p>
            <span className="font-semibold text-ink">{camp.title}</span> ve içindeki {camp.videos.length} video plandan çıkar
            {doneCount > 0 && `; ${doneCount} tamamlanma kaydı da silinir`}. Kalan görevler yeniden dağıtılır.
          </p>
          {!isDemo && <p>Bu işlem geri alınamaz. Emin değilsen önce Ayarlar’dan yedek indir.</p>}
        </>
      ),
    });
    if (!ok) return;
    actions.removeCamp(campId);
    notify({ message: `“${camp.title}” kaldırıldı.`, tone: 'info' });
  };

  const handleSavePreferences = (next: UserPreferences) => {
    actions.setPreferences(next);
    notify({ message: 'Ayarlar kaydedildi, plan yeniden dağıtıldı.', tone: 'info' });
  };

  const handleSaveNote = useCallback((date: string, text: string) => actions.setDayNote(date, text), [actions]);

  const handleBackup = () => {
    const blob = new Blob([JSON.stringify(createBackup(data, selectedDate), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName(today);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify({ message: 'Yedek indirildi.', tone: 'info' });
  };

  const handleRestoreFile = async (file: File) => {
    let text: string;
    try {
      text = await file.text();
    } catch {
      text = '';
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      await confirm({ title: 'Yedek açılamadı', body: <p>{parsed.error}</p>, confirmLabel: 'Tamam', hideCancel: true });
      return;
    }
    const { summary, warnings } = parsed;
    const ok = await confirm({
      title: 'Yedek geri yüklensin mi?',
      tone: 'danger',
      confirmLabel: 'Geri yükle',
      body: (
        <>
          <p>
            <span className="font-semibold text-ink">{file.name}</span>
            {summary.exportedAt && ` · ${new Date(summary.exportedAt).toLocaleString('tr-TR')}`}
          </p>
          <ul className="tnum list-disc space-y-0.5 pl-5">
            <li>{summary.camps} kamp, {summary.videos} video</li>
            <li>{summary.completed} tamamlanan video</li>
            <li>
              {summary.shifts} ileri taşıma, {summary.notes} gün notu
            </li>
          </ul>
          {warnings.map(w => (
            <p key={w} className="text-warn">
              {w}
            </p>
          ))}
          <p>
            Şu anki {data.playlists.length} kampın, ilerlemen ve ayarların bu yedekle <strong>değiştirilecek</strong>.
          </p>
        </>
      ),
    });
    if (!ok) return;
    actions.restore(parsed.data, parsed.selectedDate);
    notify({ message: 'Yedek geri yüklendi.', tone: 'info' });
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Tüm veriler silinsin mi?',
      tone: 'danger',
      confirmLabel: 'Her şeyi sil',
      body: (
        <>
          <p>
            {data.playlists.length} kamp, {countCompletedVideos(data.playlists, data.completedMap)} tamamlanan video,{' '}
            {data.shiftEvents.length} ileri taşıma, {Object.keys(data.dayNotes).length} gün notu ve ayarların bu tarayıcıdan
            silinir.
          </p>
          <p className="font-semibold text-ink">Bu işlem geri alınamaz. Gerekirse önce yedek indir.</p>
        </>
      ),
    });
    if (!ok) return;
    actions.reset(today);
    setView('today');
    notify({ message: 'Tüm veriler silindi. Temiz bir sayfa.', tone: 'info' });
  };

  const startDemo = () => {
    actions.startDemo(today);
    setView('today');
  };

  const exitDemo = () => {
    actions.exitDemo();
    notify({ message: 'Demodan çıktın; kendi verilerine döndün.', tone: 'info' });
  };

  // --- views -------------------------------------------------------------

  const summary = summarizeDay(selectedDate, index, prefs);
  const isToday = selectedDate === today;

  let content;
  if (view === 'today') {
    content =
      !hasCamps && !isDemo ? (
        <Welcome onAddCamp={openAddCamp} onStartDemo={startDemo} onOpenSettings={() => setView('settings')} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <PageHeader
              eyebrow={<span className={isToday ? 'text-accent' : ''}>{relativeDayLabel(selectedDate, today)}</span>}
              title={formatDayTitle(selectedDate)}
              actions={
                !isToday && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => selectDate(today)}>
                    <CalendarCheck aria-hidden="true" />
                    Bugüne dön
                  </button>
                )
              }
            />
            <div className="xl:hidden">
              <OverdueCard count={index.overdue.length} today={today} onShift={() => handleShift(addDays(today, -1))} />
            </div>
            <WeekStrip days={weekDays} selectedDate={selectedDate} today={today} onSelect={selectDate} />
            <DayPanel
              summary={summary}
              today={today}
              camps={camps}
              oversizedIds={oversizedIds}
              firstDate={index.firstDate}
              lastDate={index.lastDate}
              startDate={prefs.startDate}
              onToggle={handleToggle}
              onShift={handleShift}
              onEditLink={handleEditLink}
            />
            <DayNote
              key={`${isDemo ? 'demo' : 'real'}-${selectedDate}`}
              date={selectedDate}
              value={data.dayNotes[selectedDate] ?? ''}
              onSave={handleSaveNote}
              isDemo={isDemo}
            />
          </div>
          <aside aria-label="Özet" className="min-w-0 space-y-4">
            <div className="hidden xl:block">
              <OverdueCard count={index.overdue.length} today={today} onShift={() => handleShift(addDays(today, -1))} />
            </div>
            <ProgressCard stats={stats} prefs={prefs} today={today} />
            <WeekCard days={weekDays} selectedDate={selectedDate} today={today} onSelect={selectDate} />
            <NextUpCard items={nextUp(index, today, 4)} camps={camps} today={today} onSelect={openDay} />
          </aside>
        </div>
      );
  } else if (view === 'week') {
    content = hasCamps ? (
      <WeekView
        days={weekDays}
        today={today}
        selectedDate={selectedDate}
        camps={camps}
        oversizedIds={oversizedIds}
        onSelectDate={selectDate}
        onOpenDay={openDay}
        onToggle={handleToggle}
        onEditLink={handleEditLink}
      />
    ) : (
      <div className="mx-auto max-w-[920px]">
        <PageHeader title="Haftalık plan" />
        <NoCampsYet onAddCamp={openAddCamp} onStartDemo={startDemo} />
      </div>
    );
  } else if (view === 'progress') {
    content = hasCamps ? (
      <ProgressView
        stats={stats}
        prefs={prefs}
        today={today}
        index={index}
        camps={camps}
        weeks={weeksOverview(index)}
        issues={schedule.issues}
        onShiftOverdue={() => handleShift(addDays(today, -1))}
        onOpenWeek={monday => {
          selectDate(monday <= today && today <= addDays(monday, 6) ? today : monday);
          setView('week');
        }}
        onOpenSettings={() => setView('settings')}
      />
    ) : (
      <div className="mx-auto max-w-[920px]">
        <PageHeader title="İlerleme" />
        <NoCampsYet onAddCamp={openAddCamp} onStartDemo={startDemo} />
      </div>
    );
  } else if (view === 'camps') {
    content = (
      <CampsView
        camps={[...camps.values()]}
        index={index}
        completedMap={data.completedMap}
        today={today}
        isDemo={isDemo}
        onAddCamp={openAddCamp}
        onStartDemo={startDemo}
        onEditCamp={campId => setCampDialog({ kind: 'editCamp', campId })}
        onAddVideos={campId => setCampDialog({ kind: 'addVideos', campId })}
        onEditVideo={(campId, videoId) => setCampDialog({ kind: 'editVideo', campId, videoId })}
        onRemoveCamp={handleRemoveCamp}
      />
    );
  } else {
    content = (
      <SettingsView
        preferences={data.preferences}
        onSave={handleSavePreferences}
        isDemo={isDemo}
        campCount={data.playlists.length}
        onBackup={handleBackup}
        onRestoreFile={handleRestoreFile}
        onReset={handleReset}
        onStartDemo={startDemo}
        onExitDemo={exitDemo}
      />
    );
  }

  // Line notices up with the page below them.
  const noticeWidth =
    view === 'settings' || (view === 'today' && !hasCamps && !isDemo)
      ? 'max-w-[760px]'
      : view === 'today'
        ? ''
        : 'max-w-[920px]';

  const dialogCamp = campDialog ? data.playlists.find(p => p.id === campDialog.campId) : undefined;
  const dialogVideo =
    campDialog?.kind === 'editVideo' ? dialogCamp?.videos.find(v => v.id === campDialog.videoId) : undefined;
  const closeCampDialog = () => setCampDialog(null);

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      <Sidebar view={view} onNavigate={navigate} onAddCamp={openAddCamp} campCount={data.playlists.length} isDemo={isDemo} />
      <div className="min-w-0 flex-1">
        <MobileTopBar view={view} onNavigate={navigate} onAddCamp={openAddCamp} isDemo={isDemo} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-5 pb-28 outline-none sm:px-6 lg:px-10 lg:pt-9 lg:pb-14">
          {(isDemo || notices.length > 0 || (hasLegacy && !legacyDismissed && !isDemo)) && (
            <div className={`mx-auto mb-5 space-y-2.5 ${noticeWidth}`}>
              {isDemo && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-dashed border-ink-3/60 bg-card px-4 py-3">
                  <Eye className="size-4 shrink-0 text-ink-2" aria-hidden="true" />
                  <p className="min-w-[12rem] flex-1 text-[14px] text-ink-2">
                    <span className="font-semibold text-ink">Demo önizleme.</span> Örnek bir plan; değişiklikler kaydedilmez,
                    kendi verilerine dokunulmaz.
                  </p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={exitDemo}>
                    <LogOut aria-hidden="true" />
                    Demodan çık
                  </button>
                </div>
              )}
              {!isDemo && hasLegacy && !legacyDismissed && (
                <div className="callout callout-warn items-start">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
                  <div className="min-w-0 flex-1 text-[13.5px] text-ink-2">
                    <p className="font-semibold text-ink">Eski sürümden kalan örnek veriler var.</p>
                    <p className="mt-0.5">
                      Bazı kampların video bağlantıları ve süreleri gerçek değil. İlerlemen korunuyor.{' '}
                      <button type="button" className="font-semibold text-forest underline" onClick={() => setView('camps')}>
                        Kamplara bak
                      </button>
                    </p>
                  </div>
                  <button type="button" className="icon-btn -my-1.5 size-8" onClick={() => setLegacyDismissed(true)} aria-label="Uyarıyı kapat">
                    <X aria-hidden="true" />
                  </button>
                </div>
              )}
              {!isDemo &&
                notices.map(notice => (
                  <div key={notice.id} className={`callout ${notice.tone === 'warn' ? 'callout-warn' : 'callout-info'} items-start`}>
                    {notice.tone === 'warn' ? (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
                    ) : (
                      <Info className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1 text-[13.5px] text-ink-2">
                      <p className="font-semibold text-ink">{notice.title}</p>
                      <p className="mt-0.5 break-words">{notice.body}</p>
                    </div>
                    <button
                      type="button"
                      className="icon-btn -my-1.5 size-8"
                      onClick={() => actions.dismissNotice(notice.id)}
                      aria-label="Bildirimi kapat"
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                ))}
            </div>
          )}
          {content}
        </main>
      </div>
      <MobileTabBar view={view} onNavigate={navigate} />

      <AddCampDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingIds={data.playlists.map(p => p.id)}
        onCreate={handleCreateCamp}
      />
      {campDialog?.kind === 'editCamp' && dialogCamp && (
        <EditCampDialog key={dialogCamp.id} camp={dialogCamp} onSave={actions.updateCamp} onClose={closeCampDialog} />
      )}
      {campDialog?.kind === 'addVideos' && dialogCamp && (
        <AddVideosDialog key={dialogCamp.id} camp={dialogCamp} onSave={actions.updateCamp} onClose={closeCampDialog} />
      )}
      {campDialog?.kind === 'editVideo' && dialogCamp && dialogVideo && (
        <EditVideoDialog
          key={dialogVideo.id}
          camp={dialogCamp}
          video={dialogVideo}
          onSave={actions.updateCamp}
          onClose={closeCampDialog}
        />
      )}
    </div>
  );
}

const App = () => (
  <ToastProvider>
    <ConfirmProvider>
      <Planner />
    </ConfirmProvider>
  </ToastProvider>
);

export default App;
