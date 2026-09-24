# Camps, branches and the camp wizard

What shipped in the first camp/branch slice, and its deliberate V1 boundaries. The scheduling rules live in [`planner-engine.md`](planner-engine.md).

## Model

- **Camp** (`StudyCamp`): the whole study program, e.g. "TYT 2027". It owns its branches, its **tempo** (`CampSchedule`: dates, daily time, weekly form) and its shift events. Several camps can exist; every plan screen shows the **open camp** (`yt_active_camp`), chosen from the compact sidebar switcher (shown with two or more camps), the mobile top bar or the Kamplar page. The plan screens carry no camp/tempo summary bar.
- **Branch** (`SubjectPlaylist`, unchanged shape): one ordered list of videos, normally one YouTube playlist. `subject` is the branch name shown in the plan (Matematik); `title`, `channelName` and `playlistUrl` describe the source list.
- Tempo is per camp only. It is edited with **Tempoyu düzenle** in the Kamplar section of the open camp (İlerleme also links to it when the plan runs late or has unplaced branches). Ayarlar holds app-level options only (backup, restore, demo, reset). A new camp starts from the Dengeli preset and borrows only watch speed and practice share from the open camp; the first camp built from an older version's saved settings starts from those settings.

## Wizard (`src/components/wizard/`, rules in `src/lib/campDraft.ts`)

1. **Kaynaklar**: paste YouTube playlists (read by the server endpoint with real titles, order, channels and durations, reviewed before adding). Each playlist becomes its own editable branch card: branch name (suggested from the title by `guessBranchName`, e.g. "2027 TYT Matematik Kampı" → Matematik), source name, colour, and the ordered videos (removable). Single videos and pasted lists go to a new branch or an existing one. Demo templates add a labelled, link-free branch with fresh ids. Continue needs at least one branch, every branch named and non-empty.
2. **Kamp**: name (required), start date (required, defaults to today; a past date is allowed with a warning), optional target end date (with +1/+3/+6 month shortcuts).
3. **Ritim**: first a choice between **Otomatik dağıt** and **Branşları günlere ben yerleştireceğim**; only the chosen mode's controls appear.
   - Automatic: a preset (Hafif / Dengeli (recommended) / Yoğun) plus optional study weekdays, daily time and distinct branches per day, each marked "Ön ayardan" until changed, with "Ön ayara dön". An optional mock exam day. Choosing only the preset is enough.
   - Manual: daily time and a weekday list; each weekday is Ders / Deneme / Dinlenme, and a Ders day gets branch chips. It starts from a suggested rotation ("Önerilen dağılım" / "Temizle"). A branch on no day blocks the step, with a one-tap "En boş günlere yerleştir".
   - Watch speed and practice share sit in a collapsed section.
4. **Önizleme**: nothing is saved yet. First study day, estimated finish, study days, total work; the target-date signal (on track / N days late with the smallest daily time that fixes it and a one-tap apply / cannot be computed while videos are unplaced); oversized videos; each branch's finish; then real dated day cards (weekday names, branch-coloured videos, day total against capacity), two weeks at a time.

The draft survives closing the dialog until the camp is created. The stepper allows going back freely and forward only through valid steps; a blocked step scrolls to its first error.

## Adding branches to a camp (`AddBranchWizard`, saved by `addBranches` in `src/lib/plannerOps.ts`)

Every “Branş ekle” (Kamplar, an empty Bugün day, an empty plan page) opens this wizard for the open camp, whose id is fixed when it opens. It never asks for a camp name, dates or a rhythm and never creates a camp; the header shows the camp's name and saved tempo.

1. **Kaynaklar**: the same composer and checks as the new-camp wizard (videos already in the camp are flagged as duplicates).
2. **Günler** (manual camps only): the weekdays the new branches join, next to the camp's current week; mock days are disabled, and a chosen rest day becomes a study day.
3. **Önizleme**: the new branches and their videos, the extra work, the first new task, the finish date before and after, the target-date signal, and the coming days with the new tasks marked.

Saving keeps the camp's id, name, dates and tempo, its branches, completion marks and shift events, and touches no other camp. The plan is relaid with the camp's own schedule; in a running camp the new tasks that would fall on past days (and today) are carried to tomorrow with one stored shift event, so each new branch starts at its first video.

## Migration and data safety (`src/lib/persistence.ts`)

- New keys: `yt_camps` (`{ version: 1, camps }`) and `yt_active_camp`. `yt_completed`, `yt_day_notes`, `yt_selected_date` keep their keys and stay shared.
- When `yt_camps` is missing (or unreadable, which is copied aside first) and the older `yt_playlists` has lists, they become one camp, **Çalışma kampım** (`id: camp-migrated`, `origin: 'migrated'`): every old camp is a branch with its id, videos, links, durations, channels and colours; the old preferences become its automatic tempo; old shift events (and a legacy `yt_shifted_date`, converted once) become its shift events. The plan layout is identical (`tests/migration.test.ts`).
- The new store is written first. The older keys are never written or removed afterwards: they stay as a snapshot (Reset clears them). If the write fails, the migrated data is still used in memory, the user is warned, and the next load retries with the same camp id. Once `yt_camps` exists it is authoritative, including an empty list after the user deleted every camp.
- Settings saved without any list seed the first camp's wizard instead of creating a camp.
- Backups are version 3 (all camps). Version 1/2 flat backups still restore, converted the same way. Damaged backups are refused, never restored partially.

## V1 boundaries

- Completion is shared across camps (videos have unique ids). Day notes are no longer shown or edited, but stored notes (`yt_day_notes`) are kept and still travel in backups.
- In automatic mode two branches with the same name count as one for the daily branch cap (the wizard says so on the card).
- A branch keeps one source link, so every imported playlist becomes its own branch; merging lists into one branch is manual (single/pasted videos). Importing into an existing branch via "Video ekle" fills the link only if the branch had none.
- Manual days take their branches in camp order, round-robin until the day is full; there is no per-branch time share or fixed video count per day, and no drag-and-drop of branches or videos.
- The target date is advisory: suggestions only change the daily time; the plan is never compressed to fit it.
- Presets are fixed. Changing a running camp's tempo relays its plan; completion and stored shifts are kept and replayed under the new rules.
- The migrated older keys are not deleted, so a very large library briefly uses about twice the storage.
