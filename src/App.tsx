import { useCallback, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { CalendarCheck, Eye, Info, LogOut, TriangleAlert, X } from 'lucide-react';
import type { CampSchedule, DailyPlanItem, StudyCamp, SubjectPlaylist } from './types';
import { usePlanner } from './hooks/usePlanner';
import { useToday } from './hooks/useToday';
import { addDays, buildCampSchedule, calculateStats, countCompletedVideos, createShiftEvent } from './lib/engine';
import { classifyCamp, isLegacyKind } from './lib/camps';
import { formatDayTitle, formatLongDate, relativeDayLabel, weekKeys } from './lib/format';
import { activeCampOf, backupFileName, createBackup, parseBackup } from './lib/persistence';
import { indexCamps, indexPlans, nextUp, summarizeDay, weeksOverview } from './lib/planView';
import { allBranches, defaultSchedule, withBranchOnWeekdays } from './lib/studyCamp';
import { DayNote } from './components/day/DayNote';
import { DayPanel } from './components/day/DayPanel';
import { WeekStrip } from './components/day/WeekStrip';
import { AddVideosDialog, EditBranchDialog, EditVideoDialog } from './components/camps/CampDialogs';
import { AddBranchesDialog, CampTempoDialog, RenameCampDialog } from './components/camps/CampProgramDialogs';
import { CampBar } from './components/layout/CampBar';
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
import { CampWizard } from './components/wizard/CampWizard';

type OpenDialog =
  | { kind: 'editBranch'; branchId: string }
  | { kind: 'addVideos'; branchId: string }
  | { kind: 'editVideo'; branchId: string; videoId: string }
  | { kind: 'tempo' }
  | { kind: 'addBranches' }
  | { kind: 'rename'; campId: string }
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
  const { data, isDemo, selectedDate, notices, seedPreferences, actions } = usePlanner(today);
  const notify = useToast();
  const confirm = useConfirm();
  const [view, setView] = useState<View>('today');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [legacyDismissed, setLegacyDismissed] = useState(false);

  // Every screen shows the open camp: its branches, tempo and shift events.
  const camp = activeCampOf(data);
  const branches = useMemo(() => camp?.branches ?? [], [camp]);
  const emptyCamp = useMemo(() => ({ branches: [], schedule: defaultSchedule(today), shiftEvents: [] }), [today]);
  const schedule = useMemo(
    () => buildCampSchedule(camp ?? emptyCamp, { completedMap: data.completedMap, today }),
    [camp, emptyCamp, data.completedMap, today]
  );
  const prefs = schedule.preferences;
  const index = useMemo(() => indexPlans(schedule.plans, today), [schedule.plans, today]);
  const camps = useMemo(() => indexCamps(branches), [branches]);
  const stats = useMemo(() => {
    const total = branches.reduce((acc, p) => acc + p.videos.length, 0);
    return calculateStats(schedule.plans, total, countCompletedVideos(branches, data.completedMap));
  }, [schedule.plans, branches, data.completedMap]);
  const oversizedIds = useMemo(
    () => new Set(schedule.issues.flatMap(issue => (issue.kind === 'oversized-item' ? [issue.itemId] : []))),
    [schedule.issues]
  );
  const weekDays = useMemo(
    () => weekKeys(selectedDate).map(date => summarizeDay(date, index, prefs)),
    [selectedDate, index, prefs]
  );
  const hasCamp = camp !== null;
  const hasBranches = branches.length > 0;
  const hasLegacy = allBranches(data.camps).some(b => isLegacyKind(classifyCamp(b)));
  const campOptions = useMemo(() => data.camps.map(c => ({ id: c.id, name: c.name })), [data.camps]);

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

  const openTempo = () => {
    if (camp) setDialog({ kind: 'tempo' });
  };

  const selectCamp = (campId: string) => {
    if (campId === camp?.id) return;
    actions.setActiveCamp(campId);
    const next = data.camps.find(c => c.id === campId);
    if (next) notify({ message: `Açık kamp: “${next.name}”.`, tone: 'info' });
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
    if (!camp) return;
    const event = createShiftEvent(date, schedule.plans, today);
    if (!event) {
      notify({ message: 'Taşınacak tamamlanmamış görev yok.', tone: 'info' });
      return;
    }
    const campId = camp.id;
    actions.addShiftEvent(campId, event);
    notify({
      message: `${event.itemIds.length} görev ${formatLongDate(event.resumeDate)} gününden itibaren yeniden planlandı.`,
      actionLabel: 'Geri al',
      onAction: () => actions.removeShiftEvent(campId, event),
    });
  };

  const handleEditLink = (item: DailyPlanItem) => setDialog({ kind: 'editVideo', branchId: item.playlistId, videoId: item.videoId });

  const openNewCamp = async () => {
    if (isDemo) {
      const ok = await confirm({
        title: 'Demodan çıkılsın mı?',
        body: <p>Kendi planını kurmak için demodan çıkman gerekiyor. Demo verileri kaydedilmez ve silinir.</p>,
        confirmLabel: 'Demodan çık ve kamp oluştur',
      });
      if (!ok) return;
      actions.exitDemo();
    }
    setWizardOpen(true);
  };

  const handleCreateCamp = (created: StudyCamp) => {
    actions.createCamp(created);
    selectDate(today);
    setView('today');
    const videos = created.branches.reduce((acc, b) => acc + b.videos.length, 0);
    notify({
      message:
        created.schedule.startDate > today
          ? `“${created.name}” hazır: ${created.branches.length} branş, ${videos} video. Plan ${formatLongDate(created.schedule.startDate)} tarihinde başlıyor.`
          : `“${created.name}” hazır: ${created.branches.length} branş, ${videos} video.`,
      tone: 'info',
    });
  };

  const handleAddBranches = (added: SubjectPlaylist[], weekdays: number[] | undefined) => {
    if (!camp || added.length === 0) return;
    // The plan is laid out from its start date, so branches added mid-plan
    // would land partly on past days. Carry only those new tasks forward, as a
    // normal stored shift event (today's plan stays as it is).
    let next: StudyCamp = camp;
    for (const branch of added) {
      next = {
        ...next,
        branches: [...next.branches, branch],
        schedule: weekdays ? withBranchOnWeekdays(next.schedule, branch.id, weekdays) : next.schedule,
      };
    }
    const newIds = new Set(added.map(b => b.id));
    const { plans } = buildCampSchedule(next, { completedMap: data.completedMap, today });
    const pastIds = plans
      .filter(plan => plan.date < today)
      .flatMap(plan => plan.items.filter(item => newIds.has(item.playlistId) && !item.completed).map(item => item.id));
    const shift = pastIds.length > 0 ? { date: addDays(today, -1), resumeDate: addDays(today, 1), itemIds: pastIds } : null;
    added.forEach((branch, i) => actions.addBranch(camp.id, branch, { weekdays, shift: i === added.length - 1 ? shift : null }));
    const names = added.map(b => `“${b.subject}”`).join(', ');
    notify({
      message:
        pastIds.length > 0
          ? `${names} eklendi; geçmiş günlere düşen ${pastIds.length} görev yarından itibaren planlandı.`
          : `${names} eklendi.`,
      tone: 'info',
    });
  };

  const handleRemoveBranch = async (branchId: string) => {
    const branch = branches.find(p => p.id === branchId);
    if (!camp || !branch) return;
    const doneCount = branch.videos.filter(v => data.completedMap[v.id]).length;
    const ok = await confirm({
      title: 'Branş kaldırılsın mı?',
      tone: 'danger',
      confirmLabel: 'Branşı kaldır',
      body: (
        <>
          <p>
            <span className="font-semibold text-ink">{branch.subject}</span> ve içindeki {branch.videos.length} video “{camp.name}”
            planından çıkar{doneCount > 0 && `; ${doneCount} tamamlanma kaydı da silinir`}. Kalan görevler yeniden dağıtılır.
          </p>
          {!isDemo && <p>Bu işlem geri alınamaz. Emin değilsen önce Ayarlar’dan yedek indir.</p>}
        </>
      ),
    });
    if (!ok) return;
    actions.removeBranch(camp.id, branchId);
    notify({ message: `“${branch.subject}” kaldırıldı.`, tone: 'info' });
  };

  const handleDeleteCamp = async (campId: string) => {
    const target = data.camps.find(c => c.id === campId);
    if (!target) return;
    const videos = target.branches.reduce((acc, b) => acc + b.videos.length, 0);
    const doneCount = countCompletedVideos(target.branches, data.completedMap);
    const ok = await confirm({
      title: 'Kamp silinsin mi?',
      tone: 'danger',
      confirmLabel: 'Kampı sil',
      body: (
        <>
          <p>
            <span className="font-semibold text-ink">{target.name}</span>, {target.branches.length} branşı ve {videos} videosuyla silinir
            {doneCount > 0 && `; ${doneCount} tamamlanma kaydı da gider`}. Diğer kampların etkilenmez.
          </p>
          {!isDemo && <p>Bu işlem geri alınamaz. Emin değilsen önce Ayarlar’dan yedek indir.</p>}
        </>
      ),
    });
    if (!ok) return;
    actions.removeCamp(campId);
    notify({ message: `“${target.name}” silindi.`, tone: 'info' });
  };

  const handleSaveTempo = (next: CampSchedule) => {
    if (!camp) return;
    actions.setCampSchedule(camp.id, next);
    notify({ message: `“${camp.name}” temposu kaydedildi; plan yeniden dağıtıldı.`, tone: 'info' });
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
    const parsed = parseBackup(text, today);
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
            <li>
              {summary.camps} kamp, {summary.branches} branş, {summary.videos} video
            </li>
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
            Şu anki {data.camps.length} kampın, ilerlemen ve notların bu yedekle <strong>değiştirilecek</strong>.
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
            {data.camps.length} kamp, {countCompletedVideos(allBranches(data.camps), data.completedMap)} tamamlanan video,{' '}
            {data.camps.reduce((acc, c) => acc + c.shiftEvents.length, 0)} ileri taşıma ve {Object.keys(data.dayNotes).length} gün notu bu
            tarayıcıdan silinir.
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
  const campBar = camp && <CampBar camp={camp} onEditTempo={openTempo} />;
  const noPlanYet = (title: string) => (
    <div className="mx-auto max-w-[920px]">
      {campBar}
      <PageHeader title={title} />
      {camp ? (
        <div className="card flex flex-col items-center px-6 py-12 text-center">
          <p className="font-display text-[21px] text-ink">Bu kampta branş yok</p>
          <p className="mt-1 max-w-sm text-[14px] text-ink-2">Bir oynatma listesi ekle; her liste bir branş olur ve plan kendiliğinden kurulur.</p>
          <button type="button" className="btn btn-primary mt-5" onClick={() => setDialog({ kind: 'addBranches' })}>
            Branş ekle
          </button>
        </div>
      ) : (
        <NoCampsYet onAddCamp={openNewCamp} onStartDemo={startDemo} />
      )}
    </div>
  );

  let content;
  if (view === 'today') {
    content = !hasCamp ? (
      <Welcome onAddCamp={openNewCamp} onStartDemo={startDemo} />
    ) : (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {campBar}
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
            onAddBranches={() => setDialog({ kind: 'addBranches' })}
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
          <ProgressCard stats={stats} prefs={prefs} today={today} targetEndDate={camp.schedule.targetEndDate} />
          <WeekCard days={weekDays} selectedDate={selectedDate} today={today} onSelect={selectDate} />
          <NextUpCard items={nextUp(index, today, 4)} camps={camps} today={today} onSelect={openDay} />
        </aside>
      </div>
    );
  } else if (view === 'week') {
    content = hasBranches ? (
      <div className="mx-auto max-w-[920px]">
        {campBar}
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
      </div>
    ) : (
      noPlanYet('Haftalık plan')
    );
  } else if (view === 'progress') {
    content =
      hasBranches && camp ? (
        <div className="mx-auto max-w-[920px]">
          {campBar}
          <ProgressView
            stats={stats}
            prefs={prefs}
            camp={camp}
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
            onEditTempo={openTempo}
          />
        </div>
      ) : (
        noPlanYet('İlerleme')
      );
  } else if (view === 'camps') {
    content = (
      <CampsView
        allCamps={data.camps}
        activeCamp={camp}
        camps={[...camps.values()]}
        index={index}
        completedMap={data.completedMap}
        today={today}
        isDemo={isDemo}
        onAddCamp={openNewCamp}
        onStartDemo={startDemo}
        onSelectCamp={selectCamp}
        onEditTempo={openTempo}
        onRenameCamp={campId => setDialog({ kind: 'rename', campId })}
        onDeleteCamp={handleDeleteCamp}
        onAddBranches={() => setDialog({ kind: 'addBranches' })}
        onEditBranch={branchId => setDialog({ kind: 'editBranch', branchId })}
        onAddVideos={branchId => setDialog({ kind: 'addVideos', branchId })}
        onEditVideo={(branchId, videoId) => setDialog({ kind: 'editVideo', branchId, videoId })}
        onRemoveBranch={handleRemoveBranch}
      />
    );
  } else {
    content = (
      <SettingsView
        isDemo={isDemo}
        campCount={data.camps.length}
        onBackup={handleBackup}
        onRestoreFile={handleRestoreFile}
        onReset={handleReset}
        onStartDemo={startDemo}
        onExitDemo={exitDemo}
        onOpenCamps={() => setView('camps')}
      />
    );
  }

  // Line notices up with the page below them.
  const noticeWidth =
    view === 'settings' || (view === 'today' && !hasCamp && !isDemo) ? 'max-w-[760px]' : view === 'today' ? '' : 'max-w-[920px]';

  const dialogBranch = dialog && 'branchId' in dialog ? branches.find(p => p.id === dialog.branchId) : undefined;
  const dialogVideo = dialog?.kind === 'editVideo' ? dialogBranch?.videos.find(v => v.id === dialog.videoId) : undefined;
  const renameTarget = dialog?.kind === 'rename' ? data.camps.find(c => c.id === dialog.campId) : undefined;
  const closeDialog = () => setDialog(null);
  const saveBranch = (branch: SubjectPlaylist) => camp && actions.updateBranch(camp.id, branch);

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      <Sidebar
        view={view}
        onNavigate={navigate}
        onAddCamp={openNewCamp}
        camps={campOptions}
        activeCampId={camp?.id ?? null}
        onSelectCamp={selectCamp}
        onEditTempo={openTempo}
        isDemo={isDemo}
      />
      <div className="min-w-0 flex-1">
        <MobileTopBar
          view={view}
          onNavigate={navigate}
          onAddCamp={openNewCamp}
          camps={campOptions}
          activeCampId={camp?.id ?? null}
          onSelectCamp={selectCamp}
          isDemo={isDemo}
        />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-5 pb-28 outline-none sm:px-6 lg:px-10 lg:pt-9 lg:pb-14">
          {(isDemo || notices.length > 0 || (hasLegacy && !legacyDismissed && !isDemo)) && (
            <div className={`mx-auto mb-5 space-y-2.5 ${noticeWidth}`}>
              {isDemo && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-dashed border-ink-3/60 bg-card px-4 py-3">
                  <Eye className="size-4 shrink-0 text-ink-2" aria-hidden="true" />
                  <p className="min-w-[12rem] flex-1 text-[14px] text-ink-2">
                    <span className="font-semibold text-ink">Demo önizleme.</span> Örnek bir kamp; değişiklikler kaydedilmez, kendi
                    verilerine dokunulmaz.
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
                      Bazı branşların video bağlantıları ve süreleri gerçek değil. İlerlemen korunuyor.{' '}
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

      <CampWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        today={today}
        seed={data.camps.length === 0 ? seedPreferences : null}
        habits={camp?.schedule ?? null}
        onCreate={handleCreateCamp}
      />
      {dialog?.kind === 'tempo' && camp && (
        <CampTempoDialog key={camp.id} camp={camp} today={today} onSave={handleSaveTempo} onClose={closeDialog} />
      )}
      {dialog?.kind === 'addBranches' && camp && <AddBranchesDialog key={camp.id} camp={camp} onAdd={handleAddBranches} onClose={closeDialog} />}
      {renameTarget && (
        <RenameCampDialog
          key={renameTarget.id}
          camp={renameTarget}
          onSave={name => {
            actions.renameCamp(renameTarget.id, name);
            notify({ message: `Kampın adı “${name}” oldu.`, tone: 'info' });
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === 'editBranch' && dialogBranch && (
        <EditBranchDialog key={dialogBranch.id} camp={dialogBranch} onSave={saveBranch} onClose={closeDialog} />
      )}
      {dialog?.kind === 'addVideos' && dialogBranch && (
        <AddVideosDialog key={dialogBranch.id} camp={dialogBranch} onSave={saveBranch} onClose={closeDialog} />
      )}
      {dialog?.kind === 'editVideo' && dialogBranch && dialogVideo && (
        <EditVideoDialog key={dialogVideo.id} camp={dialogBranch} video={dialogVideo} onSave={saveBranch} onClose={closeDialog} />
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
