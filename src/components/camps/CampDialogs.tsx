import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { SubjectPlaylist, Video } from '../../types';
import type { CampKind } from '../../lib/camps';
import { classifyCamp, videoFromDraft, withVideos, youtubeIdsOf } from '../../lib/camps';
import { focusFirstInvalid } from '../../lib/dom';
import { defaultColorKey } from '../../lib/subjects';
import type { DraftVideo } from '../../utils/youtubeParser';
import { parseDurationInput, parseYoutubeVideoId, validateVideoUrl, youtubeThumbnailUrl } from '../../utils/youtubeParser';
import { useConfirm } from '../ui/ConfirmDialog';
import { Dialog } from '../ui/Dialog';
import { CampFields } from './CampFields';
import type { CampFieldValues } from './campForm';
import { campFieldErrors, storedPlaylistUrl } from './campForm';
import { VideoEntry } from './VideoEntry';

function durationText(minutes: number): string {
  if (Number.isInteger(minutes)) return String(minutes);
  const whole = Math.floor(minutes);
  const seconds = Math.round((minutes - whole) * 60);
  return `${whole}:${String(seconds).padStart(2, '0')}`;
}

export function EditCampDialog({
  camp,
  onSave,
  onClose,
}: {
  camp: SubjectPlaylist;
  onSave: (camp: SubjectPlaylist) => void;
  onClose: () => void;
}) {
  const kind = classifyCamp(camp);
  const [fields, setFields] = useState<CampFieldValues>({
    title: camp.title,
    subject: camp.subject,
    colorKey: camp.colorTag && !camp.colorTag.startsWith('bg-') ? camp.colorTag : '',
    channelName: kind === 'manual' ? camp.channelName : '',
    playlistUrl: camp.playlistUrl,
  });
  const [submitted, setSubmitted] = useState(false);
  const errors = campFieldErrors(fields);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(document.querySelector('dialog[open]'));
      return;
    }
    onSave({
      ...camp,
      title: fields.title.trim(),
      subject: fields.subject,
      colorTag: fields.colorKey || (camp.colorTag.startsWith('bg-') ? camp.colorTag : defaultColorKey(fields.subject)),
      // Legacy samples used real people's names as a fake source; don't keep showing them.
      channelName: kind === 'manual' ? fields.channelName.trim() : camp.channelName,
      playlistUrl: storedPlaylistUrl(fields),
    });
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Kampı düzenle"
      width={600}
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Kaydet
          </button>
        </>
      }
    >
      <CampFields values={fields} onChange={setFields} errors={errors} showErrors={submitted} />
      <p className="field-hint mt-4">Dersi değiştirmek planı yeniden dağıtabilir; tamamlanan görevler korunur.</p>
    </Dialog>
  );
}

export function AddVideosDialog({
  camp,
  onSave,
  onClose,
}: {
  camp: SubjectPlaylist;
  onSave: (camp: SubjectPlaylist) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<DraftVideo[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const save = () => {
    setSubmitted(true);
    if (drafts.length === 0) return;
    const start = camp.videos.length;
    const added = drafts.map((draft, i) => videoFromDraft(draft, camp.id, start + i + 1));
    onSave(withVideos(camp, [...camp.videos, ...added]));
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Video ekle"
      description={
        <>
          <span className="font-semibold text-ink">{camp.title}</span> kampının sonuna eklenir.
        </>
      }
      width={640}
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            <Plus aria-hidden="true" />
            {drafts.length > 0 ? `${drafts.length} videoyu ekle` : 'Videoları ekle'}
          </button>
        </>
      }
    >
      <VideoEntry
        drafts={drafts}
        onChange={setDrafts}
        existingIds={youtubeIdsOf(camp)}
        offset={camp.videos.length}
        error={submitted && drafts.length === 0 ? 'En az bir video ekle.' : undefined}
      />
    </Dialog>
  );
}

export function EditVideoDialog({
  camp,
  video,
  onSave,
  onClose,
}: {
  camp: SubjectPlaylist;
  video: Video;
  onSave: (camp: SubjectPlaylist) => void;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const kind: CampKind = classifyCamp(camp);
  const hasRealLink = parseYoutubeVideoId(video.videoUrl) !== null;
  const [title, setTitle] = useState(video.title);
  const [duration, setDuration] = useState(durationText(video.durationMinutes));
  const [url, setUrl] = useState(hasRealLink ? video.videoUrl : '');
  const [submitted, setSubmitted] = useState(false);

  const linkRequired = kind === 'manual';
  const otherIds = youtubeIdsOf({ ...camp, videos: camp.videos.filter(v => v.id !== video.id) });
  const titleError = !title.trim() ? 'Başlık boş olamaz.' : null;
  const durationCheck = parseDurationInput(duration);
  const urlCheck = url.trim() ? validateVideoUrl(url) : null;
  const urlError = urlCheck
    ? !urlCheck.ok
      ? urlCheck.error
      : otherIds.includes(urlCheck.value.id)
        ? 'Bu video kampta zaten var.'
        : null
    : linkRequired
      ? 'Bu kampta her videonun bağlantısı olmalı.'
      : null;
  const invalid = Boolean(titleError || !durationCheck.ok || urlError);

  const save = () => {
    setSubmitted(true);
    if (invalid || !durationCheck.ok) {
      focusFirstInvalid(document.querySelector('dialog[open]'));
      return;
    }
    const link = urlCheck?.ok ? urlCheck.value : null;
    // YouTube's thumbnail and channel describe the linked video; drop them once the link points elsewhere.
    const sameVideo = link !== null && link.id === parseYoutubeVideoId(video.videoUrl);
    const { channelName, ...rest } = video;
    const updated: Video = {
      ...rest,
      title: title.trim(),
      durationMinutes: durationCheck.value,
      // Keep an old non-link value (e.g. the legacy playlist link) unless the user set a real one.
      videoUrl: link ? link.url : hasRealLink ? '' : video.videoUrl,
      thumbnailUrl: link
        ? sameVideo && video.thumbnailUrl
          ? video.thumbnailUrl
          : youtubeThumbnailUrl(link.id)
        : hasRealLink
          ? ''
          : video.thumbnailUrl,
      ...(sameVideo && channelName ? { channelName } : {}),
    };
    onSave(withVideos(camp, camp.videos.map(v => (v.id === video.id ? updated : v))));
    onClose();
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Video silinsin mi?',
      body: (
        <p>
          <span className="font-semibold text-ink">{video.title}</span> kamptan çıkarılır ve tamamlanma kaydı silinir. Sonraki
          görevler yeniden dağıtılır.
        </p>
      ),
      confirmLabel: 'Videoyu sil',
      tone: 'danger',
    });
    if (!ok) return;
    onSave(withVideos(camp, camp.videos.filter(v => v.id !== video.id)));
    onClose();
  };

  const show = (error: string | null) => (submitted ? error : null);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Videoyu düzenle"
      description={camp.title}
      width={540}
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn-danger-quiet mr-auto" onClick={remove}>
            <Trash2 aria-hidden="true" />
            Sil
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Kaydet
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="field-label" htmlFor="edit-video-title">
            Başlık
          </label>
          <input
            id="edit-video-title"
            className="input"
            maxLength={200}
            value={title}
            onChange={e => setTitle(e.target.value)}
            aria-invalid={show(titleError) ? true : undefined}
            aria-describedby={show(titleError) ? 'edit-video-title-error' : undefined}
          />
          {show(titleError) && (
            <p id="edit-video-title-error" className="field-error">
              {titleError}
            </p>
          )}
        </div>
        <div>
          <label className="field-label" htmlFor="edit-video-url">
            YouTube video bağlantısı {!linkRequired && <span className="font-normal text-ink-3">(isteğe bağlı)</span>}
          </label>
          <input
            id="edit-video-url"
            className="input"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            aria-invalid={show(urlError) ? true : undefined}
            aria-describedby={show(urlError) ? 'edit-video-url-error' : 'edit-video-url-hint'}
            data-autofocus={hasRealLink ? undefined : true}
          />
          {show(urlError) ? (
            <p id="edit-video-url-error" className="field-error">
              {urlError}
            </p>
          ) : (
            <p id="edit-video-url-hint" className="field-hint">
              {kind === 'legacy-sample'
                ? 'Bu görev eski örnek veriden geliyor; kayıtlı bağlantı gerçek değil.'
                : kind === 'legacy-generated'
                  ? 'Bu görev otomatik uydurulmuştu; gerçek videonun bağlantısını ve süresini girebilirsin.'
                  : 'Videonun kendi bağlantısı (oynatma listesi değil).'}
            </p>
          )}
        </div>
        <div className="max-w-[12rem]">
          <label className="field-label" htmlFor="edit-video-duration">
            Süre
          </label>
          <input
            id="edit-video-duration"
            className="input tnum"
            value={duration}
            onChange={e => setDuration(e.target.value)}
            aria-invalid={show(durationCheck.ok ? null : durationCheck.error) ? true : undefined}
            aria-describedby={submitted && !durationCheck.ok ? 'edit-video-duration-error' : 'edit-video-duration-hint'}
          />
          {submitted && !durationCheck.ok ? (
            <p id="edit-video-duration-error" className="field-error">
              {durationCheck.error}
            </p>
          ) : (
            <p id="edit-video-duration-hint" className="field-hint">
              Dakika ya da dk:sn
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
