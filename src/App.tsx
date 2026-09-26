import { useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { CalendarCheck, Eye, Info, LogOut, TriangleAlert, X } from 'lucide-react';
import type { CampSchedule, DailyPlanItem, StudyCamp, SubjectPlaylist } from './types';
import { usePlanner } from './hooks/usePlanner';
import { useToday } from './hooks/useToday';
import type { CampShift, ScopedCamp } from './lib/allCamps';
import {
  buildAllCampsPlan,
  campIdOf,
  campLabelsOf,
  campOverview,
  resolveCampScope,
  shiftEventsByCamp,
  summarizeAllCampsDay,
} from './lib/allCamps';
import { addDays, buildCampSchedule, calculateStats, countCompletedVideos } from './lib/engine';
import { classifyCamp, isLegacyKind } from './lib/camps';
import { formatDayTitle, formatLongDate, relativeDayLabel, weekKeys } from './lib/format';
import { activeCampOf, backupFileName, createBackup, parseBackup } from './lib/persistence';
import { indexCamps, indexPlans, summarizeDay, weeksOverview } from './lib/planView';
import { withAddedBranches } from './lib/plannerOps';
import { allBranches, defaultSchedule } from './lib/studyCamp';
import { DayPanel } from './components/day/DayPanel';
import { WeekStrip } from './components/day/WeekStrip';
import { AddVideosDialog, EditBranchDialog, EditVideoDialog } from './components/camps/CampDialogs';
import { CampTempoDialog, RenameCampDialog } from './components/camps/CampProgramDialogs';
import { PathView } from './components/path/PathView';
import type { View } from './components/layout/Navigation';
import { MobileTabBar, MobileTopBar, Sidebar } from './components/layout/Navigation';
import { PageHeader } from './components/layout/PageHeader';
import { OverdueCard, ProgressCard, WeekCard } from './components/rail/RightRail';
import { ConfirmProvider, useConfirm } from './components/ui/ConfirmDialog';
import { ToastProvider, useToast } from './components/ui/Toast';
import { CampsView } from './components/views/CampsView';
import { ProgressView } from './components/views/ProgressView';
import { SettingsView } from './components/views/SettingsView';
import { WeekView } from './components/views/WeekView';
import type { NoCampsView } from './components/views/Welcome';
import { NoBranchesYet, NoCampVideos, NoCampsYet, Welcome } from './components/views/Welcome';
import { AddBranchWizard } from './components/wizard/AddBranchWizard';
import { CampWizard } from './components/wizard/CampWizard';

// Every dialog names the camp it edits: in "Tüm Kamplar" a task may belong to
// another camp than the one Kamplar manages.
type OpenDialog =
  | { kind: 'editBranch'; campId: string; branchId: string }
  | { kind: 'addVideos'; campId: string; branchId: string }
  | { kind: 'editVideo'; campId: string; branchId: string; videoId: string }
  | { kind: 'tempo'; campId: string }
  /** Adds branches to this existing camp (fixed when the wizard opens). */
  | { kind: 'addBranches'; campId: string }
  | { kind: 'rename'; campId: string }
  | null;

function celebrate() {
  void confetti({
    particleCount: 70,
    spread: 65,
    startVelocity: 32,
    origin: { y: 0.75 },
    colors: ['#3ecf8e', '#ff8a3d', '#8fa0f8', '#f4f5f6'],
    disableForReducedMotion: true,
  });
}

function Planner({ startInDemo }: { startInDemo: boolean }) {
  const today = useToday();
  const { data, isDemo, selectedDate, campScope, notices, seedPreferences, actions } = usePlanner(today, { startInDemo });
  const notify = useToast();
  const confirm = useConfirm();
  const [view, setView] = useState<View>('today');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [legacyDismissed, setLegacyDismissed] = useState(false);

  // The open camp: the one Kamplar manages, always a real camp. The plan
  // screens show it, or with "Tüm Kamplar" every camp with a plan, each laid
  // out with its own tempo and shift events and merged by date.
  const camp = activeCampOf(data);
  const scope = resolveCampScope(data.camps.length, campScope);
  const branches = useMemo(() => camp?.branches ?? [], [camp]);
  const emptyCamp = useMemo(() => ({ branches: [], schedule: defaultSchedule(today), shiftEvents: [] }), [today]);
  const schedule = useMemo(
    () => buildCampSchedule(camp ?? emptyCamp, { completedMap: data.completedMap, today }),
    [camp, emptyCamp, data.completedMap, today]
  );
  const prefs = schedule.preferences;
  const campIndex = useMemo(() => indexPlans(schedule.plans, today), [schedule.plans, today]);
  const campBranches = useMemo(() => indexCamps(branches), [branches]);
  const campStats = useMemo(() => {
    const total = branches.reduce((acc, p) => acc + p.videos.length, 0);
    return calculateStats(schedule.plans, total, countCompletedVideos(branches, data.completedMap));
  }, [schedule.plans, branches, data.completedMap]);

  // What the plan screens show (one camp, or every camp together).
  const allPlan = useMemo(
    () => (scope === 'all' ? buildAllCampsPlan(data.camps, { completedMap: data.completedMap, today }) : null),
    [scope, data.camps, data.completedMap, today]
  );
  const shownCamps: ScopedCamp[] = useMemo(
    () => allPlan?.camps ?? (camp ? [{ camp, result: schedule }] : []),
    [allPlan, camp, schedule]
  );
  const campLabels = useMemo(() => (allPlan ? campLabelsOf(allPlan.camps) : undefined), [allPlan]);
  const index = allPlan?.index ?? campIndex;
  const stats = allPlan?.stats ?? campStats;
  const allBranchInfo = useMemo(() => (allPlan ? indexCamps(allPlan.camps.flatMap(s => s.camp.branches)) : null), [allPlan]);
  const camps = allBranchInfo ?? campBranches;
  const oversizedIds = useMemo(
    () =>
      new Set(
        shownCamps.flatMap(({ result }) => result.issues.flatMap(issue => (issue.kind === 'oversized-item' ? [issue.itemId] : [])))
      ),
    [shownCamps]
  );
  const weekDays = useMemo(() => {
    if (!allPlan) return weekKeys(selectedDate).map(date => summarizeDay(date, campIndex, prefs));
    const campPrefs = allPlan.camps.map(s => s.result.preferences);
    return weekKeys(selectedDate).map(date => summarizeAllCampsDay(date, allPlan.index, campPrefs));
  }, [allPlan, selectedDate, campIndex, prefs]);
  const hasCamp = camp !== null;
  const hasBranches = branches.length > 0;
  // "Tüm Kamplar" with no camp holding a video yet.
  const noCampPlans = allPlan !== null && allPlan.camps.length === 0;
  const hasLegacy = allBranches(data.camps).some(b => isLegacyKind(classifyCamp(b)));
  const campOptions = useMemo(() => data.camps.map(c => ({ id: c.id, name: c.name })), [data.camps]);

  // --- actions -----------------------------------------------------------

  const selectDate = actions.setSelectedDate;

  const navigate = (next: View) => {
    if (next === 'today' || next === 'path') selectDate(today);
    setView(next);
  };

  const openDay = (date: string) => {
    selectDate(date);
    setView('today');
  };

  const openTempo = (campId: string | undefined = camp?.id) => {
    if (campId) setDialog({ kind: 'tempo', campId });
  };

  const openAddBranches = () => {
    if (camp) setDialog({ kind: 'addBranches', campId: camp.id });
  };

  // Shows one camp on the plan screens (and makes it the open camp).
  const selectCamp = (campId: string) => {
    if (campId === camp?.id && scope === 'camp') return;
    actions.setCampScope('camp');
    actions.setActiveCamp(campId);
    const next = data.camps.find(c => c.id === campId);
    if (next) notify({ message: `Açık kamp: “${next.name}”.`, tone: 'info' });
  };

  // A view choice only: the open camp stays the one Kamplar manages.
  const selectAllCamps = () => {
    if (scope === 'all') return;
    actions.setCampScope('all');
    notify({ message: 'Tüm kampların birlikte gösteriliyor.', tone: 'info' });
  };

  // Kamplar under "Tüm Kamplar": pick the camp to manage without leaving the combined view.
  const manageCamp = (campId: string) => actions.setActiveCamp(campId);

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

  // Each camp shown gets its own event, made from its own plan, so a camp
  // only ever carries (and replans) its own tasks.
  const handleShift = (date: string) => {
    if (shownCamps.length === 0) return;
    const shifts: CampShift[] = shiftEventsByCamp(
      shownCamps.map(({ camp: c, result }) => ({ campId: c.id, plans: result.plans })),
      date,
      today
    );
    if (shifts.length === 0) {
      notify({ message: 'Taşınacak tamamlanmamış görev yok.', tone: 'info' });
      return;
    }
    actions.addShiftEvents(shifts);
    const count = shifts.reduce((acc, s) => acc + s.event.itemIds.length, 0);
    notify({
      message:
        `${count} görev ${formatLongDate(shifts[0].event.resumeDate)} gününden itibaren yeniden planlandı.` +
        (shifts.length > 1 ? ` Her kamp kendi temposuyla (${shifts.length} kamp).` : ''),
      actionLabel: 'Geri al',
      onAction: () => actions.removeShiftEvents(shifts),
    });
  };

  const handleEditLink = (item: DailyPlanItem) => {
    const campId = campIdOf(item) ?? camp?.id;
    if (campId) setDialog({ kind: 'editVideo', campId, branchId: item.playlistId, videoId: item.videoId });
  };

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

  // Adds to the camp the wizard was opened for; never creates a camp.
  const handleAddBranches = (campId: string, added: SubjectPlaylist[], weekdays: number[] | undefined) => {
    const target = data.camps.find(c => c.id === campId);
    if (!target || added.length === 0) return;
    const { carried } = withAddedBranches(target, added, { weekdays, completedMap: data.completedMap, today });
    actions.addBranches(campId, added, { weekdays, today });
    const names = added.map(b => `“${b.subject}”`).join(', ');
    notify({
      message:
        carried > 0
          ? `${names} “${target.name}” kampına eklendi; ${carried} yeni görev yarından itibaren sırayla planlandı.`
          : `${names} “${target.name}” kampına eklendi.`,
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

  const handleSaveTempo = (target: StudyCamp, next: CampSchedule) => {
    actions.setCampSchedule(target.id, next);
    notify({ message: `“${target.name}” temposu kaydedildi; plan yeniden dağıtıldı.`, tone: 'info' });
  };

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

  const summary = allPlan
    ? summarizeAllCampsDay(selectedDate, allPlan.index, allPlan.camps.map(s => s.result.preferences))
    : summarizeDay(selectedDate, index, prefs);
  const isToday = selectedDate === today;
  const hasOverdue = index.overdue.length > 0;
  const firstStart = allPlan ? (shownCamps.map(s => s.result.preferences.startDate).sort()[0] ?? prefs.startDate) : prefs.startDate;
  // "Tüm Kamplar" before any camp has a video: nothing to combine yet.
  const noPlansInCamps = (title: string) => (
    <div className="mx-auto max-w-[920px]">
      <PageHeader title={title} subtitle="Tüm kamplar" />
      <NoCampVideos campName={camp?.name} onAddBranches={openAddBranches} onOpenCamps={() => setView('camps')} />
    </div>
  );
  const noPlanYet = (title: string, emptyView: NoCampsView) => (
    <div className="mx-auto max-w-[920px]">
      <PageHeader title={title} />
      {camp ? (
        <NoBranchesYet onAddBranches={openAddBranches} />
      ) : (
        <NoCampsYet view={emptyView} onAddCamp={openNewCamp} onStartDemo={startDemo} />
      )}
    </div>
  );

  let content;
  if (view === 'today') {
    content = !hasCamp ? (
      <Welcome onAddCamp={openNewCamp} onStartDemo={startDemo} />
    ) : noCampPlans ? (
      noPlansInCamps('Bugün')
    ) : (
      <div className={`grid gap-x-6 gap-y-4 xl:grid-cols-[minmax(0,1fr)_320px] ${hasOverdue ? 'xl:grid-rows-[auto_auto_1fr]' : ''}`}>
        <div className="min-w-0">
          <PageHeader
            eyebrow={<span className={isToday ? 'text-accent' : ''}>{relativeDayLabel(selectedDate, today)}</span>}
            title={formatDayTitle(selectedDate)}
            subtitle={campLabels && `Tüm kamplar · ${campLabels.size} kamp birlikte`}
            actions={
              !isToday && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => selectDate(today)}>
                  <CalendarCheck aria-hidden="true" />
                  Bugüne dön
                </button>
              )
            }
          />
        </div>
        {/* After the title below xl; from xl the first card of the summary column, level with the week strip. */}
        <OverdueCard
          className="min-w-0 xl:col-start-2 xl:row-start-2 xl:self-start"
          count={index.overdue.length}
          today={today}
          onShift={() => handleShift(addDays(today, -1))}
        />
        {/* Spans the overdue card's row too, so the card never pushes the week strip down. */}
        <div className={`min-w-0 space-y-4 xl:col-start-1 xl:row-start-2 ${hasOverdue ? 'xl:row-span-2' : ''}`}>
          <WeekStrip days={weekDays} selectedDate={selectedDate} today={today} onSelect={selectDate} />
          <DayPanel
            summary={summary}
            today={today}
            camps={camps}
            oversizedIds={oversizedIds}
            firstDate={index.firstDate}
            lastDate={index.lastDate}
            startDate={firstStart}
            onToggle={handleToggle}
            onShift={handleShift}
            onEditLink={handleEditLink}
            onAddBranches={openAddBranches}
            campLabels={campLabels}
          />
        </div>
        {/* Side by side under the day below xl; from xl a column level with the week strip, under the overdue card if any. */}
        <aside
          aria-label="Özet"
          className={`mt-2 grid min-w-0 content-start gap-4 sm:grid-cols-2 xl:col-start-2 xl:mt-0 xl:grid-cols-1 ${hasOverdue ? 'xl:row-start-3' : 'xl:row-start-2'}`}
        >
          <ProgressCard
            stats={stats}
            prefs={prefs}
            today={today}
            targetEndDate={campLabels ? null : camp.schedule.targetEndDate}
            campGoals={campLabels && [...campLabels.values()]}
          />
          <WeekCard days={weekDays} selectedDate={selectedDate} today={today} onSelect={selectDate} />
        </aside>
      </div>
    );
  } else if (view === 'path') {
    content = noCampPlans ? (
      noPlansInCamps('Günün yolu')
    ) : allPlan || hasBranches ? (
      <PathView
        summary={summary}
        today={today}
        camps={camps}
        oversizedIds={oversizedIds}
        overdueCount={index.overdue.length}
        firstDate={index.firstDate}
        lastDate={index.lastDate}
        startDate={firstStart}
        onSelectDate={selectDate}
        onToggle={handleToggle}
        onShift={handleShift}
        onShiftOverdue={() => handleShift(addDays(today, -1))}
        onEditLink={handleEditLink}
        onAddBranches={openAddBranches}
        campLabels={campLabels}
      />
    ) : (
      noPlanYet('Günün yolu', 'path')
    );
  } else if (view === 'week') {
    content = noCampPlans ? (
      noPlansInCamps('Haftalık plan')
    ) : allPlan || hasBranches ? (
      <div className="mx-auto max-w-[920px]">
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
          campLabels={campLabels}
        />
      </div>
    ) : (
      noPlanYet('Haftalık plan', 'week')
    );
  } else if (view === 'progress') {
    content = noCampPlans ? (
      noPlansInCamps('İlerleme')
    ) : (allPlan || hasBranches) && camp ? (
      <div className="mx-auto max-w-[920px]">
        <ProgressView
          stats={stats}
          today={today}
          index={index}
          camps={camps}
          weeks={weeksOverview(index)}
          scope={
            allPlan
              ? { kind: 'all', camps: allPlan.camps.map(s => campOverview(s, data.completedMap)) }
              : { kind: 'camp', camp, prefs, issues: schedule.issues }
          }
          onShiftOverdue={() => handleShift(addDays(today, -1))}
          onOpenWeek={monday => {
            selectDate(monday <= today && today <= addDays(monday, 6) ? today : monday);
            setView('week');
          }}
          onEditTempo={openTempo}
        />
      </div>
    ) : (
      noPlanYet('İlerleme', 'progress')
    );
  } else if (view === 'camps') {
    content = (
      <CampsView
        allCamps={data.camps}
        activeCamp={camp}
        camps={[...campBranches.values()]}
        index={campIndex}
        completedMap={data.completedMap}
        today={today}
        isDemo={isDemo}
        showsAllCamps={scope === 'all'}
        onAddCamp={openNewCamp}
        onStartDemo={startDemo}
        onSelectCamp={scope === 'all' ? manageCamp : selectCamp}
        onEditTempo={() => openTempo()}
        onRenameCamp={campId => setDialog({ kind: 'rename', campId })}
        onDeleteCamp={handleDeleteCamp}
        onAddBranches={openAddBranches}
        onEditBranch={branchId => camp && setDialog({ kind: 'editBranch', campId: camp.id, branchId })}
        onAddVideos={branchId => camp && setDialog({ kind: 'addVideos', campId: camp.id, branchId })}
        onEditVideo={(branchId, videoId) => camp && setDialog({ kind: 'editVideo', campId: camp.id, branchId, videoId })}
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
    view === 'settings' || (view === 'today' && !hasCamp && !isDemo)
      ? 'max-w-[760px]'
      : view === 'today'
        ? ''
        : view === 'path' && (allPlan || hasBranches)
          ? 'max-w-[720px]'
          : 'max-w-[920px]';

  const dialogCamp = dialog ? data.camps.find(c => c.id === dialog.campId) : undefined;
  const dialogBranch = dialog && 'branchId' in dialog ? dialogCamp?.branches.find(p => p.id === dialog.branchId) : undefined;
  const dialogVideo = dialog?.kind === 'editVideo' ? dialogBranch?.videos.find(v => v.id === dialog.videoId) : undefined;
  const renameTarget = dialog?.kind === 'rename' ? dialogCamp : undefined;
  const addTarget = dialog?.kind === 'addBranches' ? dialogCamp : undefined;
  const tempoTarget = dialog?.kind === 'tempo' ? dialogCamp : undefined;
  const closeDialog = () => setDialog(null);
  const saveBranch = (branch: SubjectPlaylist) => dialogCamp && actions.updateBranch(dialogCamp.id, branch);

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
        scope={scope}
        onSelectCamp={selectCamp}
        onSelectAll={selectAllCamps}
        isDemo={isDemo}
      />
      <div className="min-w-0 flex-1">
        <MobileTopBar
          view={view}
          onNavigate={navigate}
          onAddCamp={openNewCamp}
          camps={campOptions}
          activeCampId={camp?.id ?? null}
          scope={scope}
          onSelectCamp={selectCamp}
          onSelectAll={selectAllCamps}
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
      {tempoTarget && (
        <CampTempoDialog
          key={tempoTarget.id}
          camp={tempoTarget}
          today={today}
          onSave={next => handleSaveTempo(tempoTarget, next)}
          onClose={closeDialog}
        />
      )}
      {addTarget && (
        <AddBranchWizard
          key={addTarget.id}
          camp={addTarget}
          today={today}
          completedMap={data.completedMap}
          onAdd={(added, weekdays) => handleAddBranches(addTarget.id, added, weekdays)}
          onClose={closeDialog}
        />
      )}
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

/** The planner ("Dashboard"). `startInDemo`: open the demo preview (the landing page's "Demo ile göz at"). */
const App = ({ startInDemo = false }: { startInDemo?: boolean }) => (
  <ToastProvider>
    <ConfirmProvider>
      <Planner startInDemo={startInDemo} />
    </ConfirmProvider>
  </ToastProvider>
);

export default App;
