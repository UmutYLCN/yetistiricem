import { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { CalendarCheck, ChevronLeft, ChevronRight, Eye, Info, LogOut, TriangleAlert, X } from 'lucide-react';
import type { CampSchedule, DailyPlanItem, PostponeReason, StudyCamp, SubjectPlaylist } from './types';
import { usePlanner } from './hooks/usePlanner';
import { usePlaylistSync } from './hooks/usePlaylistSync';
import { useToday } from './hooks/useToday';
import type { CampShift, ScopedCamp } from './lib/allCamps';
import {
  buildAllCampsPlan,
  campIdOf,
  campLabelsOf,
  campOverview,
  combinesCamps,
  runningCamps,
  shiftEventsByCamp,
  summarizeAllCampsDay,
} from './lib/allCamps';
import { addDays, buildCampSchedule, calculateStats, countCompletedVideos } from './lib/engine';
import type { SharedCamp } from './lib/campShare';
import { campFromShare, decodeCampShare } from './lib/campShare';
import { discardMcpCampDraft, readMcpCampDraft } from './lib/mcpDrafts';
import { classifyCamp, isLegacyKind } from './lib/camps';
import { focusTotals, focusableVideoId, nextFocusItem } from './lib/focus';
import { progressInsights } from './lib/insights';
import { formatDayTitle, formatLongDate, relativeDayLabel, weekKeys } from './lib/format';
import { activeCampOf, backupFileName, createBackup, parseBackup } from './lib/persistence';
import { indexCamps, indexPlans, summarizeDay, weeksOverview } from './lib/planView';
import { withAddedBranches, withAppendedVideos, withResumed } from './lib/plannerOps';
import type { SyncNotification } from './lib/playlistSync';
import { draftFromPending, syncNotifications, syncTargets } from './lib/playlistSync';
import { allBranches, defaultSchedule } from './lib/studyCamp';
import { profileSummary } from './lib/studentProfile';
import { DayPanel } from './components/day/DayPanel';
import { WeekStrip } from './components/day/WeekStrip';
import type { DayLayout } from './components/day/DayLayoutToggle';
import { DayLayoutToggle } from './components/day/DayLayoutToggle';
import { AddVideosDialog, EditBranchDialog, EditVideoDialog } from './components/camps/CampDialogs';
import { CampTempoDialog, RenameCampDialog } from './components/camps/CampProgramDialogs';
import type { PostponeChoice, PostponeRequest } from './components/camps/PostponeReasonDialog';
import type { ImportOffer } from './components/camps/ImportCampDialog';
import { ImportCampDialog } from './components/camps/ImportCampDialog';
import { PublishCampDialog } from './components/camps/PublishCampDialog';
import { RenameDialog, SignInDialog } from './components/discover/AccountDialogs';
import { CampDetail } from './components/discover/CampDetail';
import { DiscoverView } from './components/views/DiscoverView';
import { AuthGate } from './components/auth/AuthGate';
import type { Account } from './hooks/useAccount';
import type { CatalogEntry } from './lib/catalog';
import { encodeCampShare } from './lib/campShare';
import { leaveAccountLocally } from './lib/cloudSync';
import { useCloudSync } from './hooks/useCloudSync';
import { useSavedCamps } from './hooks/useSavedCamps';
import { listMyPublications, unpublishCamp } from './lib/catalogApi';
import { APP_PATH, campImportUrl, clearMcpDraftRequest, discoverReturnUrl } from './lib/routes';
import type { FocusTarget } from './components/focus/FocusModal';
import { FocusModal } from './components/focus/FocusModal';
import { PostponeReasonDialog } from './components/camps/PostponeReasonDialog';
import { PathView } from './components/path/PathView';
import type { Profile, View } from './components/layout/Navigation';
import { MobileTabBar, MobileTopBar, Sidebar } from './components/layout/Navigation';
import { NotificationBell } from './components/layout/NotificationBell';
import { PageHeader } from './components/layout/PageHeader';
import { OverdueCard, ProgressCard, WeekCard } from './components/rail/RightRail';
import { ConfirmProvider, useConfirm } from './components/ui/ConfirmDialog';
import { ToastProvider, useToast } from './components/ui/Toast';
import { CampsView } from './components/views/CampsView';
import { ProgressView } from './components/views/ProgressView';
import { SettingsView } from './components/views/SettingsView';
import { SettingsDialog } from './components/settings/SettingsDialog';
import { OnboardingDialog } from './components/profile/OnboardingDialog';
import type { NoCampsView } from './components/views/Welcome';
import { AllCampsPaused, NoBranchesYet, NoCampVideos, NoCampsYet, Welcome } from './components/views/Welcome';
import { AddBranchWizard } from './components/wizard/AddBranchWizard';
import { CampWizard } from './components/wizard/CampWizard';
import { msg, translateTemplate } from './lib/messages';


// Every dialog names the camp it edits: with several camps on screen a task may
// belong to another camp than the one Kamplar manages.
type OpenDialog =
  | { kind: 'editBranch'; campId: string; branchId: string }
  | { kind: 'addVideos'; campId: string; branchId: string }
  | { kind: 'editVideo'; campId: string; branchId: string; videoId: string }
  | { kind: 'tempo'; campId: string }
  /** Adds branches to this existing camp (fixed when the wizard opens). */
  | { kind: 'addBranches'; campId: string }
  | { kind: 'rename'; campId: string }
  | { kind: 'publish'; campId: string }
  | null;

/** A shift waiting in the reason dialog; `saved` once it is stored (the dialog then shows its tip). */
interface PendingShift {
  shifts: CampShift[];
  request: PostponeRequest;
  saved: { shifts: CampShift[]; reason: PostponeReason } | null;
}

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

interface PlannerProps {
  startInDemo: boolean;
  importPayload: string | null;
  mcpDraftId: string | null;
  /** Open on Keşfet (a sign-in link brought the student back). */
  openDiscover: boolean;
  /** The student's account (`AuthGate` shows the planner only with one, or in the demo). */
  account: Account;
  /** The signed-in account whose plan this page holds; null in a demo page or without sign-in set up. */
  userId: string | null;
}

function Planner({ startInDemo, importPayload, mcpDraftId, openDiscover, account, userId }: PlannerProps) {
  const today = useToday();
  const { data, realData, isDemo, selectedDate, notices, seedPreferences, actions } = usePlanner(today, { startInDemo });
  // The account's plan is saved to the cloud as it changes (a demo page holds no account plan).
  const sync = useCloudSync(realData, startInDemo ? null : userId);
  const notify = useToast();
  const confirm = useConfirm();
  const [view, setView] = useState<View>(openDiscover ? 'discover' : 'today');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [legacyDismissed, setLegacyDismissed] = useState(false);
  const [pendingShift, setPendingShift] = useState<PendingShift | null>(null);
  /** The task playing in focus mode (its id and day in the plan shown). */
  const [focus, setFocus] = useState<{ itemId: string; date: string } | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [discoverId, setDiscoverId] = useState<string | null>(null);
  const [catalogVersion, setCatalogVersion] = useState(0);
  // A shared camp or private AI proposal, read once when the page opens.
  const [importOffer, setImportOffer] = useState<ImportOffer | null>(importPayload || mcpDraftId ? { status: 'loading' } : null);
  const [approvedDraft, setApprovedDraft] = useState<{ id: string; campId: string } | null>(null);
  useEffect(() => {
    if (!importPayload && !mcpDraftId) return;
    let cancelled = false;
    if (mcpDraftId) {
      if (!userId) {
        setImportOffer({ status: 'error', message: 'Bu kampı görmek için Yetişir hesabına giriş yap.' });
      } else {
        void readMcpCampDraft(mcpDraftId, userId).then(result => {
          if (!cancelled) {
            setImportOffer(result.ok ? { status: 'ready', camp: result.camp, source: result.origin === 'kesfet' ? 'mcp-kesfet' : 'mcp' } : { status: 'error', message: result.error });
          }
        });
      }
    } else if (importPayload) {
      void decodeCampShare(importPayload).then(result => {
        if (!cancelled) setImportOffer(result.ok ? { status: 'ready', camp: result.camp, source: 'link' } : { status: 'error', message: result.error });
      });
    }
    return () => {
      cancelled = true;
    };
  }, [importPayload, mcpDraftId, userId]);

  // Keep the proposal available until the approved camp reaches the cloud.
  useEffect(() => {
    if (!approvedDraft || !userId || sync.status !== 'saved' || !realData.camps.some(c => c.id === approvedDraft.campId)) return;
    setApprovedDraft(null);
    void discardMcpCampDraft(approvedDraft.id, userId);
  }, [approvedDraft, realData.camps, sync.status, userId]);

  // The daily check of the branches' YouTube playlists (never in the demo).
  const syncEnabled = !isDemo && syncTargets(data.camps).length > 0;
  const { checking: syncChecking } = usePlaylistSync(data.camps, data.playlistSync, today, !isDemo, actions);
  const notifications = useMemo(() => (isDemo ? [] : syncNotifications(data.camps, data.playlistSync)), [isDemo, data.camps, data.playlistSync]);

  // The open camp: the one Kamplar manages, always a real camp (it may be
  // paused). The plan screens show the running camps: one alone, or two and
  // more merged by date, each laid out with its own tempo and shift events.
  const camp = activeCampOf(data);
  const branches = useMemo(() => camp?.branches ?? [], [camp]);
  const running = useMemo(() => runningCamps(data.camps), [data.camps]);
  const combined = combinesCamps(running.length);
  const planCamp = combined ? null : (running[0] ?? null);
  const emptyCamp = useMemo(() => ({ branches: [], schedule: defaultSchedule(today), shiftEvents: [] }), [today]);
  const schedule = useMemo(
    () => buildCampSchedule(planCamp ?? emptyCamp, { completedMap: data.completedMap, today }),
    [planCamp, emptyCamp, data.completedMap, today]
  );
  const prefs = schedule.preferences;
  const planBranches = useMemo(() => planCamp?.branches ?? [], [planCamp]);
  const singleIndex = useMemo(() => indexPlans(schedule.plans, today), [schedule.plans, today]);
  const singleBranches = useMemo(() => indexCamps(planBranches), [planBranches]);
  const singleStats = useMemo(() => {
    const total = planBranches.reduce((acc, p) => acc + p.videos.length, 0);
    return calculateStats(schedule.plans, total, countCompletedVideos(planBranches, data.completedMap));
  }, [schedule.plans, planBranches, data.completedMap]);

  // Kamplar lists the open camp's branches, shown on the plan screens or not.
  const managedSchedule = useMemo(
    () => (camp && camp === planCamp ? schedule : buildCampSchedule(camp ?? emptyCamp, { completedMap: data.completedMap, today })),
    [camp, planCamp, schedule, emptyCamp, data.completedMap, today]
  );
  const campIndex = useMemo(() => indexPlans(managedSchedule.plans, today), [managedSchedule.plans, today]);
  const campBranches = useMemo(() => indexCamps(branches), [branches]);

  // What the plan screens show (one camp, or every running camp together).
  const allPlan = useMemo(
    () => (combined ? buildAllCampsPlan(running, { completedMap: data.completedMap, today }) : null),
    [combined, running, data.completedMap, today]
  );
  const shownCamps: ScopedCamp[] = useMemo(
    () => allPlan?.camps ?? (planCamp ? [{ camp: planCamp, result: schedule }] : []),
    [allPlan, planCamp, schedule]
  );
  const campLabels = useMemo(() => (allPlan ? campLabelsOf(allPlan.camps) : undefined), [allPlan]);
  const index = allPlan?.index ?? singleIndex;
  const stats = allPlan?.stats ?? singleStats;
  const allBranchInfo = useMemo(() => (allPlan ? indexCamps(allPlan.camps.flatMap(s => s.camp.branches)) : null), [allPlan]);
  const camps = allBranchInfo ?? singleBranches;
  const oversizedIds = useMemo(
    () =>
      new Set(
        shownCamps.flatMap(({ result }) => result.issues.flatMap(issue => (issue.kind === 'oversized-item' ? [issue.itemId] : [])))
      ),
    [shownCamps]
  );
  const weekDays = useMemo(() => {
    if (!allPlan) return weekKeys(selectedDate).map(date => summarizeDay(date, singleIndex, prefs));
    const campPrefs = allPlan.camps.map(s => s.result.preferences);
    return weekKeys(selectedDate).map(date => summarizeAllCampsDay(date, allPlan.index, campPrefs));
  }, [allPlan, selectedDate, singleIndex, prefs]);
  const insights = useMemo(
    () => (view === 'progress' ? progressInsights(shownCamps, data.completedMap, data.completionDates, today) : null),
    [view, shownCamps, data.completedMap, data.completionDates, today]
  );
  const hasCamp = camp !== null;
  // Every camp is paused: the plan screens have nothing to show until one resumes.
  const allPaused = hasCamp && running.length === 0;
  const hasBranches = planBranches.length > 0;
  // Several running camps, none holding a video yet.
  const noCampPlans = allPlan !== null && allPlan.camps.length === 0;
  const hasLegacy = allBranches(data.camps).some(b => isLegacyKind(classifyCamp(b)));

  // Focus mode reads the task from the plan shown, so it always has the current completion.
  const canFocus = (item: DailyPlanItem) => focusableVideoId(item, camps.get(item.playlistId)?.kind ?? 'manual') !== null;
  const focusEntry = focus ? index.items.find(s => s.item.id === focus.itemId && s.date === focus.date) : undefined;
  const focusTarget: FocusTarget | null = (() => {
    if (!focusEntry) return null;
    const { item, date } = focusEntry;
    const info = camps.get(item.playlistId);
    const videoId = focusableVideoId(item, info?.kind ?? 'manual');
    if (!videoId) return null;
    const campId = campIdOf(item) ?? planCamp?.id;
    const owner = data.camps.find(c => c.id === campId);
    return {
      item,
      date,
      videoId,
      info,
      campName: campId ? campLabels?.get(campId)?.name : undefined,
      speed: owner?.schedule.playbackSpeed ?? 1,
    };
  })();
  const nextFocus = focusEntry ? nextFocusItem(index.items, { id: focusEntry.item.id, date: focusEntry.date }, canFocus) : null;

  // --- actions -----------------------------------------------------------

  const selectDate = actions.setSelectedDate;

  // Rotam shows the day as a list or as the path; the menu brings back the last one used.
  const [dayLayout, setDayLayout] = useState<DayLayout>('today');
  const navigate = (next: View) => {
    if (next === 'today' || next === 'path') selectDate(today);
    if (next === 'discover') setDiscoverId(null);
    setView(next === 'today' ? dayLayout : next);
  };
  const switchLayout = (layout: DayLayout) => {
    setDayLayout(layout);
    setView(layout);
  };
  const layoutToggle = <DayLayoutToggle value={view === 'path' ? 'path' : 'today'} onChange={switchLayout} />;

  const openTempo = (campId: string | undefined = camp?.id) => {
    if (campId) setDialog({ kind: 'tempo', campId });
  };

  const addBranchesTo = (campId: string | undefined) => {
    if (campId) setDialog({ kind: 'addBranches', campId });
  };
  const openAddBranches = () => addBranchesTo(camp?.id);
  // From the plan screens: the camp they show (Kamplar's own button adds to the open camp).
  const addToShownCamp = () => addBranchesTo(planCamp?.id ?? camp?.id);

  // Kamplar: pick the camp to manage; the plan screens keep showing every camp.
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
  // only ever carries (and replans) its own tasks. The events are stored once
  // the student names a reason (or skips the question) in the dialog.
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
    const carried = new Set(shifts.flatMap(s => s.event.itemIds));
    const shortest = index.items
      .filter(s => carried.has(s.item.id) && s.item.durationMinutes > 0)
      .reduce<DailyPlanItem | null>((best, s) => (!best || s.item.durationMinutes < best.durationMinutes ? s.item : best), null);
    setPendingShift({
      shifts,
      request: {
        count: shifts.reduce((acc, s) => acc + s.event.itemIds.length, 0),
        resumeDate: shifts[0].event.resumeDate,
        campCount: shifts.length,
        shortest: shortest ? { title: shortest.title, minutes: shortest.durationMinutes } : undefined,
      },
      saved: null,
    });
  };

  const announceShift = (shifts: CampShift[]) => {
    const count = shifts.reduce((acc, s) => acc + s.event.itemIds.length, 0);
    notify({
      message:
        `${count} görev ${formatLongDate(shifts[0].event.resumeDate)} gününden itibaren yeniden planlandı.` +
        (shifts.length > 1 ? ` Her kamp kendi temposuyla (${shifts.length} kamp).` : ''),
      actionLabel: 'Geri al',
      onAction: () => actions.removeShiftEvents(shifts),
    });
  };

  const confirmShift = ({ reason, note }: PostponeChoice) => {
    if (!pendingShift) return;
    const shifts = pendingShift.shifts.map(({ campId, event }) => ({
      campId,
      event: { ...event, ...(reason ? { reason } : {}), ...(reason && note ? { note } : {}) },
    }));
    actions.addShiftEvents(shifts);
    if (reason) {
      setPendingShift({ ...pendingShift, saved: { shifts, reason } });
    } else {
      setPendingShift(null);
      announceShift(shifts);
    }
  };

  const closeShiftDialog = () => {
    if (pendingShift?.saved) announceShift(pendingShift.saved.shifts);
    setPendingShift(null);
  };

  const undoShift = () => {
    if (pendingShift?.saved) actions.removeShiftEvents(pendingShift.saved.shifts);
    setPendingShift(null);
    notify({ message: 'Taşıma geri alındı; görevler yerinde.', tone: 'info' });
  };

  const openFocus = (item: DailyPlanItem) => {
    const entry = index.items.find(s => s.item.id === item.id);
    if (entry) setFocus({ itemId: entry.item.id, date: entry.date });
  };

  // From the "distraction" tip: the first open task with a video, from today on.
  const focusCandidate = index.items.find(s => s.date >= today && !s.item.completed && canFocus(s.item));
  const startFocusFromTip = () => {
    if (!focusCandidate) return;
    closeShiftDialog();
    setFocus({ itemId: focusCandidate.item.id, date: focusCandidate.date });
  };

  const acceptNotification = ({ campId, branch, videos }: SyncNotification) => {
    const target = data.camps.find(c => c.id === campId);
    if (!target) return;
    const { carried } = withAppendedVideos(target, branch.id, videos.map(draftFromPending), { completedMap: data.completedMap, today });
    actions.acceptPlaylistVideos(campId, branch.id);
    notify({
      message:
        `${videos.length} video “${branch.subject}” sonuna eklendi; plan yeniden hesaplandı.` +
        (carried > 0 ? ` ${carried} görev yarından itibaren sırayla planlandı.` : ''),
      tone: 'info',
    });
  };

  const dismissNotification = ({ branch, videos }: SyncNotification) => {
    actions.dismissPlaylistVideos(branch.id);
    notify({ message: `${videos.length} yeni video göz ardı edildi; bir daha sorulmayacak.`, tone: 'info' });
  };

  const bell = (
    <NotificationBell
      notifications={notifications}
      sync={data.playlistSync}
      enabled={syncEnabled}
      checking={syncChecking}
      today={today}
      showCamp={data.camps.length > 1}
      onAccept={acceptNotification}
      onDismiss={dismissNotification}
    />
  );

  const me = account.state.status === 'signed-in' ? account.state : null;

  // Which of the student's camps are live in Keşfet (Kamplar shows it and offers "Yayından kaldır").
  const [publications, setPublications] = useState<{ userId: string; byCamp: Map<string, CatalogEntry> } | null>(null);
  const publisherId = !isDemo && me ? me.userId : null;
  useEffect(() => {
    if (!publisherId || view !== 'camps') return;
    let cancelled = false;
    void listMyPublications(publisherId).then(result => {
      if (cancelled || !result.ok) return;
      setPublications({ userId: publisherId, byCamp: new Map(result.data.map(entry => [entry.sourceCampId, entry])) });
    });
    return () => {
      cancelled = true;
    };
  }, [publisherId, view, catalogVersion]);
  const myPublications = publications && publications.userId === publisherId ? publications.byCamp : null;
  // Keşfet camps the student saved for later (the heart).
  const savedCamps = useSavedCamps(me ? me.userId : null);
  const profile: Profile = me
    ? {
        name: me.displayName ?? me.email?.split('@')[0] ?? 'Hesabın',
        detail: (me.profile && profileSummary(me.profile)) ?? me.email ?? 'Profil',
        avatar: me.profile?.avatar ?? null,
      }
    : { name: isDemo ? 'Demo' : 'Misafir', detail: 'Profil', avatar: null };

  const handleEditLink = (item: DailyPlanItem) => {
    const campId = campIdOf(item) ?? planCamp?.id;
    if (campId) setDialog({ kind: 'editVideo', campId, branchId: item.playlistId, videoId: item.videoId });
  };

  // A page opened on the demo holds no account plan: leaving it starts a fresh
  // page (sign-in, then the account's plan). A demo opened from the student's
  // own plan just closes.
  const signedIn = account.state.status === 'signed-in' || account.state.status === 'off';
  const leaveDemo = () => {
    if (!startInDemo) {
      actions.exitDemo();
      return true;
    }
    window.location.assign(APP_PATH);
    return false;
  };

  const openNewCamp = async () => {
    if (isDemo) {
      const ok = await confirm({
        title: 'Demodan çıkılsın mı?',
        body: (
          <p>
            {msg("\n            Kendi planını kurmak için demodan çıkman gerekiyor")}{signedIn ? msg("") : msg(" ve giriş yapman gerekiyor")}{msg(". Demo verileri kaydedilmez ve\n            silinir")}{startInDemo ? msg("; kampını kendi planında “Yeni kamp” ile kurabilirsin") : msg("")}{msg(".\n          ")}</p>
        ),
        confirmLabel: signedIn ? 'Demodan çık ve kamp oluştur' : 'Demodan çık ve giriş yap',
      });
      if (!ok || !leaveDemo()) return;
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
            <span className="font-semibold text-ink">{branch.subject}</span> {msg(" ve içindeki ")}{branch.videos.length} {msg(" video “")}{camp.name}{msg("”\n            planından çıkar")}{doneCount > 0 && `; ${doneCount} tamamlanma kaydı da silinir`}{msg(". Kalan görevler yeniden dağıtılır.\n          ")}</p>
          {!isDemo && <p>{msg("Bu işlem geri alınamaz. Emin değilsen önce Ayarlar’dan yedek indir.")}</p>}
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
    const deletionDetails = `${msg(", ")}${target.branches.length}${msg(" branşı ve ")}${videos}${msg(" videosuyla silinir")}${doneCount > 0 ? translateTemplate('; {count} tamamlanma kaydı da gider', { count: doneCount }) : ''}${msg(". Diğer kampların etkilenmez.")}`;
    const ok = await confirm({
      title: msg('Kamp silinsin mi?'),
      tone: 'danger',
      confirmLabel: msg('Kampı sil'),
      body: (
        <>
          <p>
            <span className="font-semibold text-ink">{target.name}</span>{deletionDetails}
          </p>
          {!isDemo && <p>{msg("Bu işlem geri alınamaz. Emin değilsen önce Ayarlar’dan yedek indir.")}</p>}
        </>
      ),
    });
    if (!ok) return;
    actions.removeCamp(campId);
    notify({ message: `“${target.name}” silindi.`, tone: 'info' });
  };

  const handlePauseCamp = async (campId: string) => {
    const target = data.camps.find(c => c.id === campId);
    if (!target || target.pausedAt) return;
    const ok = await confirm({
      title: 'Kamp duraklatılsın mı?',
      confirmLabel: 'Duraklat',
      body: (
        <p>
          <span className="font-semibold text-ink">{target.name}</span> {msg(" Rotam’dan ve İlerleme’den çıkar. Branşları, ilerlemen ve temposu\n          olduğu gibi saklanır. Devam ettiğinde kalan görevler o günden itibaren yeniden dağıtılır.\n        ")}</p>
      ),
    });
    if (!ok) return;
    actions.pauseCamp(campId);
    notify({ message: `“${target.name}” duraklatıldı. Hazır olduğunda Kamplar’dan devam edebilirsin.`, tone: 'info' });
  };

  const handleResumeCamp = (campId: string) => {
    const target = data.camps.find(c => c.id === campId);
    if (!target?.pausedAt) return;
    const { carried } = withResumed(target, { completedMap: data.completedMap, today });
    actions.resumeCamp(campId);
    notify({
      message:
        carried > 0
          ? `“${target.name}” yeniden başladı; kalan ${carried} görev bugünden itibaren sırayla planlandı.`
          : `“${target.name}” yeniden başladı.`,
      tone: 'info',
    });
  };

  const handleImportCamp = async (shared: SharedCamp, source: 'kesfet' | 'link' | 'mcp' | 'mcp-kesfet') => {
    setImportOffer(null);
    if (startInDemo) {
      // The camp travels in an import link, offered again on the student's own plan (after sign-in).
      window.location.assign((source === 'mcp' || source === 'mcp-kesfet') && mcpDraftId ? `${APP_PATH}?draft=${encodeURIComponent(mcpDraftId)}` : campImportUrl(await encodeCampShare(shared)));
      return;
    }
    if (isDemo) actions.exitDemo();
    const created = campFromShare(shared, today, source === 'mcp' ? undefined : source === 'mcp-kesfet' ? 'kesfet' : source);
    handleCreateCamp(created);
    if ((source === 'mcp' || source === 'mcp-kesfet') && mcpDraftId) {
      clearMcpDraftRequest();
      setApprovedDraft({ id: mcpDraftId, campId: created.id });
    }
  };

  const openCatalogEntry = (entry: CatalogEntry) => {
    setDialog(null);
    setDiscoverId(entry.id);
    setView('discover');
  };

  const handleUnpublish = async (entry: CatalogEntry) => {
    const ok = await confirm({
      title: 'Kamp yayından kaldırılsın mı?',
      tone: 'danger',
      confirmLabel: 'Yayından kaldır',
      body: (
        <p>
          <span className="font-semibold text-ink">{entry.name}</span> {msg(" Keşfet’ten kalkar. Kendi kampın ve daha önce ekleyenlerin\n          kampları olduğu gibi kalır.\n        ")}</p>
      ),
    });
    if (!ok) return;
    const result = await unpublishCamp(entry.id);
    if (!result.ok) {
      notify({ message: result.error, tone: 'info' });
      return;
    }
    setDiscoverId(null);
    setCatalogVersion(v => v + 1);
    notify({ message: `“${entry.name}” yayından kaldırıldı.`, tone: 'info' });
  };

  // The account's plan leaves this browser (after reaching the cloud), so the
  // next account never sees it; the gate then starts a fresh page on sign-in.
  const handleSignOut = async () => {
    if (!startInDemo && userId) {
      const saved = await sync.flush();
      if (!saved) {
        const ok = await confirm({
          title: 'Kaydedilmemiş değişiklikler var',
          body: (
            <p>
              {msg("\n              Hesabına şu an ulaşılamıyor. Çıkarsan son değişikliklerin bu cihazda saklanır ve buradan tekrar giriş yaptığında hesabına\n              kaydedilir.\n            ")}</p>
          ),
          confirmLabel: 'Yine de çıkış yap',
        });
        if (!ok) return;
      }
      if (!leaveAccountLocally(realData, !saved)) {
        notify({ message: 'Bu cihazdaki kaydedilmemiş plan yedeklenemedi. Depolama alanını kontrol edip tekrar dene.', tone: 'info' });
        return;
      }
    }
    await account.signOut();
    if (startInDemo) notify({ message: 'Çıkış yaptın.', tone: 'info' });
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
              {summary.camps} {msg(" kamp, ")}{summary.branches} {msg(" branş, ")}{summary.videos} {msg(" video\n            ")}</li>
            <li>{summary.completed} {msg(" tamamlanan video")}</li>
            <li>
              {summary.shifts} {msg(" ileri taşıma, ")}{summary.notes} {msg(" gün notu\n            ")}</li>
          </ul>
          {warnings.map(w => (
            <p key={w} className="text-warn">
              {w}
            </p>
          ))}
          <p>
            {msg("\n            Şu anki ")}{data.camps.length} {msg(" kampın, ilerlemen ve notların bu yedekle ")}<strong>{msg("değiştirilecek")}</strong>{msg(".\n          ")}</p>
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
            {data.camps.length} {msg(" kamp, ")}{countCompletedVideos(allBranches(data.camps), data.completedMap)} {msg(" tamamlanan video,")}{msg(" ")}
            {data.camps.reduce((acc, c) => acc + c.shiftEvents.length, 0)} {msg(" ileri taşıma ve ")}{Object.keys(data.dayNotes).length} {msg(" gün notu\n            hesabından ve giriş yaptığın her cihazdan silinir.\n          ")}</p>
          <p className="font-semibold text-ink">{msg("Bu işlem geri alınamaz. Gerekirse önce yedek indir.")}</p>
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
    if (leaveDemo()) notify({ message: 'Demodan çıktın; kendi verilerine döndün.', tone: 'info' });
  };

  // --- views -------------------------------------------------------------

  const summary = allPlan
    ? summarizeAllCampsDay(selectedDate, allPlan.index, allPlan.camps.map(s => s.result.preferences))
    : summarizeDay(selectedDate, index, prefs);
  const isToday = selectedDate === today;
  const hasOverdue = index.overdue.length > 0;
  // Rotam's header, the same above the list and the path, so switching moves nothing but the content below.
  const rotamHeader = (
    <PageHeader
      eyebrow={<span className={isToday ? 'text-accent' : ''}>{relativeDayLabel(selectedDate, today)}</span>}
      title={formatDayTitle(selectedDate)}
      actions={
        <div className="flex items-center justify-between gap-x-3 max-sm:w-full sm:justify-end">
          <div className="flex items-center gap-1">
            <button type="button" className="icon-btn" onClick={() => selectDate(addDays(selectedDate, -1))} aria-label={msg("Önceki gün")}>
              <ChevronLeft aria-hidden="true" />
            </button>
            {!isToday && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => selectDate(today)}>
                <CalendarCheck aria-hidden="true" />
                {msg("\n                Bugüne dön\n              ")}</button>
            )}
            <button type="button" className="icon-btn" onClick={() => selectDate(addDays(selectedDate, 1))} aria-label={msg("Sonraki gün")}>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
          {layoutToggle}
        </div>
      }
    />
  );
  const firstStart = allPlan ? (shownCamps.map(s => s.result.preferences.startDate).sort()[0] ?? prefs.startDate) : prefs.startDate;
  // Several running camps before any has a video: nothing to combine yet.
  const emptyTarget = camp && !camp.pausedAt ? camp : running[0];
  const noPlansInCamps = (title: string) => (
    <div className="mx-auto max-w-[920px]">
      <PageHeader title={title} />
      <NoCampVideos campName={emptyTarget?.name} onAddBranches={() => addBranchesTo(emptyTarget?.id)} onOpenCamps={() => setView('camps')} />
    </div>
  );
  const pausedPage = (title: string) => (
    <div className="mx-auto max-w-[920px]">
      <PageHeader title={title} />
      <AllCampsPaused count={data.camps.length} onOpenCamps={() => setView('camps')} />
    </div>
  );
  const noPlanYet = (title: string, emptyView: NoCampsView) => (
    <div className="mx-auto max-w-[920px]">
      <PageHeader title={title} />
      {camp ? (
        <NoBranchesYet onAddBranches={addToShownCamp} />
      ) : (
        <NoCampsYet view={emptyView} onAddCamp={openNewCamp} onStartDemo={startDemo} />
      )}
    </div>
  );

  let content;
  if (view === 'today') {
    content = !hasCamp ? (
      <Welcome onAddCamp={openNewCamp} onStartDemo={startDemo} />
    ) : allPaused ? (
      pausedPage('Bugün')
    ) : noCampPlans ? (
      noPlansInCamps('Bugün')
    ) : (
      <div>
      {rotamHeader}
      <div className={`grid gap-x-6 gap-y-4 xl:grid-cols-[minmax(0,1fr)_320px] ${hasOverdue ? 'xl:grid-rows-[auto_1fr]' : ''}`}>
        {/* After the title below xl; from xl the first card of the summary column, level with the week strip. */}
        <OverdueCard
          className="min-w-0 xl:col-start-2 xl:row-start-1 xl:self-start"
          count={index.overdue.length}
          today={today}
          onShift={() => handleShift(addDays(today, -1))}
        />
        {/* Spans the overdue card's row too, so the card never pushes the week strip down. */}
        <div className={`min-w-0 space-y-4 xl:col-start-1 xl:row-start-1 ${hasOverdue ? 'xl:row-span-2' : ''}`}>
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
            onFocus={openFocus}
            onAddBranches={addToShownCamp}
            campLabels={campLabels}
          />
        </div>
        {/* Side by side under the day below xl; from xl a column level with the week strip, under the overdue card if any. */}
        <aside
          aria-label={msg("Özet")}
          className={`mt-2 grid min-w-0 content-start gap-4 sm:grid-cols-2 xl:col-start-2 xl:mt-0 xl:grid-cols-1 ${hasOverdue ? 'xl:row-start-2' : 'xl:row-start-1'}`}
        >
          <ProgressCard
            stats={stats}
            prefs={prefs}
            today={today}
            targetEndDate={campLabels ? null : (planCamp?.schedule.targetEndDate ?? null)}
            campGoals={campLabels && [...campLabels.values()]}
          />
          <WeekCard days={weekDays} selectedDate={selectedDate} today={today} onSelect={selectDate} />
        </aside>
      </div>
      </div>
    );
  } else if (view === 'path') {
    content = allPaused ? (
      pausedPage('Günün yolu')
    ) : noCampPlans ? (
      noPlansInCamps('Günün yolu')
    ) : allPlan || hasBranches ? (
      <div>
      {rotamHeader}
      <PathView
        summary={summary}
        today={today}
        camps={camps}
        oversizedIds={oversizedIds}
        overdueCount={index.overdue.length}
        firstDate={index.firstDate}
        lastDate={index.lastDate}
        startDate={firstStart}
        onToggle={handleToggle}
        onShift={handleShift}
        onShiftOverdue={() => handleShift(addDays(today, -1))}
        onEditLink={handleEditLink}
        onFocus={openFocus}
        onAddBranches={addToShownCamp}
        campLabels={campLabels}
      />
      </div>
    ) : (
      noPlanYet('Günün yolu', 'path')
    );
  } else if (view === 'progress') {
    const progressScope = allPlan
      ? ({ kind: 'all', camps: allPlan.camps.map(s => campOverview(s, data.completedMap)) } as const)
      : planCamp && hasBranches
        ? ({ kind: 'camp', camp: planCamp, prefs, issues: schedule.issues } as const)
        : null;
    content = allPaused ? (
      pausedPage('İlerleme')
    ) : noCampPlans ? (
      noPlansInCamps('İlerleme')
    ) : progressScope && insights ? (
      <div className="mx-auto max-w-[920px]">
        <ProgressView
          stats={stats}
          today={today}
          index={index}
          camps={camps}
          weeks={weeksOverview(index)}
          scope={progressScope}
          insights={insights}
          onShiftOverdue={() => handleShift(addDays(today, -1))}
          onOpenWeek={monday => {
            selectDate(monday <= today && today <= addDays(monday, 6) ? today : monday);
            setView('today');
          }}
          onEditTempo={openTempo}
        />
      </div>
    ) : (
      noPlanYet('İlerleme', 'progress')
    );
  } else if (view === 'discover') {
    content = discoverId ? (
      <CampDetail
        key={discoverId}
        id={discoverId}
        today={today}
        userId={account.state.status === 'signed-in' ? account.state.userId : null}
        onBack={() => setDiscoverId(null)}
        onImport={shared => void handleImportCamp(shared, 'kesfet')}
        onUnpublish={entry => void handleUnpublish(entry)}
        saved={savedCamps.saved ? savedCamps.saved.has(discoverId) : null}
        onToggleSave={savedCamps.toggle}
        onSignIn={() => setSignInOpen(true)}
        onNotify={message => notify({ message, tone: 'info' })}
      />
    ) : (
      <DiscoverView
        account={account.state}
        today={today}
        version={catalogVersion}
        saved={savedCamps.saved}
        onToggleSave={savedCamps.toggle}
        onNotify={message => notify({ message, tone: 'info' })}
        onOpen={setDiscoverId}
        onSignIn={() => setSignInOpen(true)}
        onOpenCamps={() => setView('camps')}
      />
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
        showsAllCamps={combined}
        onAddCamp={openNewCamp}
        onStartDemo={startDemo}
        onSelectCamp={manageCamp}
        onEditTempo={() => openTempo()}
        onRenameCamp={campId => setDialog({ kind: 'rename', campId })}
        onPublishCamp={campId => setDialog({ kind: 'publish', campId })}
        onDeleteCamp={handleDeleteCamp}
        onPauseCamp={campId => void handlePauseCamp(campId)}
        onResumeCamp={handleResumeCamp}
        onAddBranches={openAddBranches}
        onEditBranch={branchId => camp && setDialog({ kind: 'editBranch', campId: camp.id, branchId })}
        onAddVideos={branchId => camp && setDialog({ kind: 'addVideos', campId: camp.id, branchId })}
        onEditVideo={(branchId, videoId) => camp && setDialog({ kind: 'editVideo', campId: camp.id, branchId, videoId })}
        publications={myPublications}
        onUnpublishCamp={entry => void handleUnpublish(entry)}
        onViewPublication={openCatalogEntry}
      />
    );
  } else {
    content = (
      <SettingsView
        account={account.state}
        onRename={account.rename}
        onSaveProfile={account.saveProfile}
        onUploadAvatar={account.uploadAvatar}
        onSignOut={() => void handleSignOut()}
        isDemo={isDemo}
        campCount={data.camps.length}
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
    view === 'settings' || (view === 'today' && !hasCamp && !isDemo)
      ? 'max-w-[760px]'
      : view === 'today'
        ? ''
        : view === 'path' && (allPlan || hasBranches)
          ? ''
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
        {msg("\n        İçeriğe geç\n      ")}</a>
      <Sidebar
        view={view}
        onNavigate={navigate}
        onAddCamp={openNewCamp}
        campCount={data.camps.length}
        onOpenSettings={() => setSettingsOpen(true)}
        isDemo={isDemo}
        bell={bell}
        profile={profile}
      />
      <div className="min-w-0 flex-1">
        <MobileTopBar
          view={view}
          onNavigate={navigate}
          onAddCamp={openNewCamp}
          campCount={data.camps.length}
          onOpenSettings={() => setSettingsOpen(true)}
          isDemo={isDemo}
          bell={bell}
          profile={profile}
        />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-5 pb-28 outline-none sm:px-6 lg:px-10 lg:pt-9 lg:pb-14">
          {(isDemo || notices.length > 0 || (hasLegacy && !legacyDismissed && !isDemo)) && (
            <div className={`mx-auto mb-5 space-y-2.5 ${noticeWidth}`}>
              {isDemo && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-dashed border-ink-3/60 bg-card px-4 py-3">
                  <Eye className="size-4 shrink-0 text-ink-2" aria-hidden="true" />
                  <p className="min-w-[12rem] flex-1 text-[14px] text-ink-2">
                    <span className="font-semibold text-ink">{msg("Demo önizleme.")}</span> {msg(" Örnek bir kamp; değişiklikler kaydedilmez, kendi\n                    verilerine dokunulmaz.\n                  ")}</p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={exitDemo}>
                    <LogOut aria-hidden="true" />
                    {msg("\n                    Demodan çık\n                  ")}</button>
                </div>
              )}
              {!isDemo && hasLegacy && !legacyDismissed && (
                <div className="callout callout-warn items-start">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
                  <div className="min-w-0 flex-1 text-[13.5px] text-ink-2">
                    <p className="font-semibold text-ink">{msg("Eski sürümden kalan örnek veriler var.")}</p>
                    <p className="mt-0.5">
                      {msg("\n                      Bazı branşların video bağlantıları ve süreleri gerçek değil. İlerlemen korunuyor.")}{msg(" ")}
                      <button type="button" className="font-semibold text-forest underline" onClick={() => setView('camps')}>
                        {msg("\n                        Kamplara bak\n                      ")}</button>
                    </p>
                  </div>
                  <button type="button" className="icon-btn -my-1.5 size-8" onClick={() => setLegacyDismissed(true)} aria-label={msg("Uyarıyı kapat")}>
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
                      aria-label={msg("Bildirimi kapat")}
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
      <PostponeReasonDialog
        request={pendingShift?.request ?? null}
        savedReason={pendingShift?.saved?.reason ?? null}
        onConfirm={confirmShift}
        onUndo={undoShift}
        onClose={closeShiftDialog}
        onStartFocus={focusCandidate ? startFocusFromTip : undefined}
      />
      <FocusModal
        target={focusTarget}
        next={nextFocus?.item ?? null}
        pastSeconds={focusTarget ? focusTotals(data.focusSessions, focusTarget.item.videoId).seconds : 0}
        today={today}
        onComplete={item => actions.setCompleted(item.videoId, true)}
        onUndoComplete={item => actions.setCompleted(item.videoId, false)}
        onSession={actions.addFocusSession}
        onNext={() => nextFocus && setFocus({ itemId: nextFocus.item.id, date: nextFocus.date })}
        onClose={() => setFocus(null)}
      />
      {dialog?.kind === 'publish' && dialogCamp && (
        <PublishCampDialog
          key={dialogCamp.id}
          camp={dialogCamp}
          account={account.state}
          onSignIn={() => setSignInOpen(true)}
          onRename={() => setRenameOpen(true)}
          onClose={closeDialog}
          onView={openCatalogEntry}
          onPublished={() => setCatalogVersion(v => v + 1)}
        />
      )}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <SignInDialog
        open={signInOpen && account.state.status !== 'signed-in'}
        onClose={() => setSignInOpen(false)}
        onSignIn={(email, password) => account.signInWithPassword(email, password)}
        onSignUp={(email, password) => account.signUpWithPassword(email, password, discoverReturnUrl())}
        onGoogle={() => account.continueWithGoogle(discoverReturnUrl())}
      />
      <RenameDialog
        open={renameOpen}
        current={account.state.status === 'signed-in' ? account.state.displayName : null}
        onClose={() => setRenameOpen(false)}
        onSave={account.rename}
      />
      {me && !isDemo && me.profileStatus === 'ready' && !me.profile?.onboardedAt && me.displayName !== null && !importOffer && (
        <OnboardingDialog
          key={me.userId}
          open
          displayName={me.displayName}
          profile={me.profile}
          onRename={account.rename}
          onSave={account.saveProfile}
          onUploadAvatar={account.uploadAvatar}
        />
      )}
      <ImportCampDialog
        offer={importOffer}
        today={today}
        isDemo={isDemo}
        onImport={shared => void handleImportCamp(shared, importOffer?.status === 'ready' ? importOffer.source : 'link')}
        onClose={() => {
          if (mcpDraftId) clearMcpDraftRequest();
          setImportOffer(null);
        }}
      />
      {dialog?.kind === 'editBranch' && dialogBranch && (
        <EditBranchDialog
          key={dialogBranch.id}
          camp={dialogBranch}
          onSave={saveBranch}
          onClose={closeDialog}
          onRemove={() => {
            closeDialog();
            void handleRemoveBranch(dialogBranch.id);
          }}
        />
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
const App = ({ startInDemo = false, importPayload = null, mcpDraftId = null, openDiscover = false }: {
  startInDemo?: boolean;
  importPayload?: string | null;
  mcpDraftId?: string | null;
  openDiscover?: boolean;
}) => (
  <ToastProvider>
    <ConfirmProvider>
      <AuthGate startInDemo={startInDemo}>
        {(account, userId) => (
          <Planner
            startInDemo={startInDemo}
            importPayload={importPayload}
            mcpDraftId={mcpDraftId}
            openDiscover={openDiscover}
            account={account}
            userId={userId}
          />
        )}
      </AuthGate>
    </ConfirmProvider>
  </ToastProvider>
);

export default App;
