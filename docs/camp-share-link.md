# Camp share links

Code: `src/lib/campShare.ts` (format, validation, camp creation), `src/lib/routes.ts` (`takeImportRequest`, `campImportUrl`), `src/components/camps/ShareCampDialog.tsx` and `ImportCampDialog.tsx`. Behaviour is pinned by `tests/campShare.test.ts`.

A link `https://<host>/app?import=<payload>` opens the planner and asks "Yeni kampı içe aktarmak istiyor musun?". On "İçe aktar" the camp is added as a new camp that starts today; nothing else changes. The parameter leaves the address bar as soon as the page opens, so a reload never asks again. Kamplar → "Paylaş" builds such a link for any camp. The same format is meant for a future community catalog and for tools (e.g. an MCP server) that build links for the student.

## Payload

- `z.` + base64url(deflate-raw(JSON)): what the app writes.
- `j.` + base64url(JSON): also read, for tools that do not compress.

base64url is RFC 4648 §5 without padding. The JSON:

```json
{
  "app": "yetistiricem",
  "type": "camp",
  "version": 1,
  "camp": {
    "name": "TYT 2027",
    "schedule": {
      "dailyStudyHours": 3,
      "playbackSpeed": 1.5,
      "practiceMultiplier": 0.2,
      "maxSubjectsPerDay": 3,
      "activeDays": [1, 2, 3, 4, 5, 6],
      "restDays": [0],
      "mockExamDays": [],
      "mode": "auto"
    },
    "branches": [
      {
        "subject": "Matematik",
        "title": "TYT Matematik Kampı",
        "channel": "Kanal adı",
        "playlistId": "PL…",
        "color": "ink",
        "videos": [
          { "title": "Sayılar", "minutes": 24.5, "youtubeId": "dQw4w9WgXcQ", "channel": "Kanal adı" },
          { "title": "Konu tekrarı (video yok)", "minutes": 40 }
        ]
      }
    ]
  }
}
```

- `schedule`: the planner preferences without `startDate` (weekday lists use 0 = Sunday). `mode: "manual"` adds `weekPlan`: seven lists of branch indexes (positions in `branches`). Unusable values fall back to the defaults. The imported camp always starts on the import day, with no target date.
- `branches` (1–40): `subject` (branch name, required), `title` (source list name), `channel`, optional `playlistId` (a readable YouTube playlist id; enables the daily playlist check), optional `color` (a palette key from `src/lib/subjects.ts`; anything else gets the subject's default).
- `videos` (at least one per branch, at most 5,000 in all): `minutes` > 0 and ≤ 600, optional `youtubeId` (11 characters). Links are rebuilt from ids; a video without an id is a typed topic without a link.
- Never shared: ids, completion, completion days, notes, shifts and their reasons, focus sessions, target dates. Sample (demo template) and legacy branches are left out of a share.

## Limits and refusals

The payload may be at most 400,000 characters and its JSON at most 2,000,000 bytes after inflating (a small link cannot expand without bound). A foreign `app`/`type`, a newer `version`, or any broken branch or video refuses the whole link; nothing is imported in part.

Building a link in Node:

```js
import { deflateRawSync } from 'node:zlib';
const payload = 'z.' + deflateRawSync(JSON.stringify(share)).toString('base64url');
const url = `https://<host>/app?import=${payload}`;
```
