import { useState } from 'react';
import { Check, Info, Plus } from 'lucide-react';
import type { SubjectPlaylist } from '../../types';
import { DEMO_TEMPLATES, cloneTemplate } from '../../data/demoTemplates';
import { createManualCamp } from '../../lib/camps';
import { focusFirstInvalid } from '../../lib/dom';
import { formatHours } from '../../lib/format';
import { resolveColor } from '../../lib/subjects';
import type { DraftVideo } from '../../utils/youtubeParser';
import { Dialog } from '../ui/Dialog';
import { SubjectDot } from '../ui/Bits';
import { CampFields } from './CampFields';
import type { CampFieldValues } from './campForm';
import { EMPTY_CAMP_FIELDS, campFieldErrors, storedPlaylistUrl } from './campForm';
import { VideoEntry } from './VideoEntry';

interface Props {
  open: boolean;
  onClose: () => void;
  existingIds: string[];
  onCreate: (camp: SubjectPlaylist) => void;
}

/**
 * New camp: the user's own videos, or a clearly labelled demo template.
 * The draft survives closing the dialog until the camp is created.
 */
export function AddCampDialog({ open, onClose, existingIds, onCreate }: Props) {
  const [mode, setMode] = useState<'manual' | 'template'>('manual');
  const [fields, setFields] = useState<CampFieldValues>(EMPTY_CAMP_FIELDS);
  const [drafts, setDrafts] = useState<DraftVideo[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const errors = campFieldErrors(fields);
  const videosError = submitted && drafts.length === 0 ? 'En az bir video ekle.' : undefined;

  const create = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0 || drafts.length === 0) {
      focusFirstInvalid(document.querySelector('dialog[open]'));
      return;
    }
    onCreate(
      createManualCamp({
        title: fields.title,
        subject: fields.subject,
        colorTag: fields.colorKey,
        channelName: fields.channelName,
        playlistUrl: storedPlaylistUrl(fields),
        videos: drafts,
      })
    );
    setFields(EMPTY_CAMP_FIELDS);
    setDrafts([]);
    setSubmitted(false);
    onClose();
  };

  const hasDraft = fields.title.trim() !== '' || drafts.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Kamp ekle"
      description="Bir kamp, aynı dersin sırayla izleyeceğin videolarıdır."
      width={640}
      dismissOnBackdrop={false}
      footer={
        mode === 'manual' ? (
          <>
            {hasDraft && <p className="mr-auto text-[12.5px] text-ink-3">Taslak kapatınca da korunur.</p>}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Vazgeç
            </button>
            <button type="button" className="btn btn-primary" onClick={create}>
              <Plus aria-hidden="true" />
              Kampı oluştur{drafts.length > 0 && ` (${drafts.length} video)`}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Kapat
          </button>
        )
      }
    >
      <div className="segmented mb-5 w-full sm:w-auto" role="group" aria-label="Kamp türü">
        <button
          type="button"
          aria-pressed={mode === 'manual'}
          onClick={() => setMode('manual')}
          className="flex-1 sm:flex-none"
        >
          Kendi videoların
        </button>
        <button
          type="button"
          aria-pressed={mode === 'template'}
          onClick={() => setMode('template')}
          className="flex-1 sm:flex-none"
        >
          Demo şablon
        </button>
      </div>

      {mode === 'manual' ? (
        <div className="space-y-6">
          <CampFields values={fields} onChange={setFields} errors={errors} showErrors={submitted} />
          <div>
            <h3 className="mb-2 text-[15px] font-semibold text-ink">Videolar</h3>
            <p className="mb-3 text-[13px] text-ink-2">
              Uygulama YouTube’a bağlanmaz; bu yüzden her videonun bağlantısını ve süresini sen girersin. Süre, planın günlere
              doğru bölünmesi için gerekli.
            </p>
            <VideoEntry drafts={drafts} onChange={setDrafts} existingIds={[]} offset={0} error={videosError} />
          </div>
        </div>
      ) : (
        <div>
          <div className="callout callout-warn mb-4">
            <Info className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-[13.5px] text-ink-2">
              <span className="font-semibold text-ink">Bunlar gerçek bir kanalın listesi değil.</span> Şablonlar örnek bir TYT
              konu sırası ve sabit örnek süreler içerir; video bağlantısı yoktur. Planı denemek ya da konu sırasını görmek
              için ekleyebilir, sonra her konuya kendi videonun bağlantısını ekleyebilirsin.
            </p>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {DEMO_TEMPLATES.map(template => {
              const added = existingIds.includes(template.id);
              const color = resolveColor(template.colorTag, template.subject);
              return (
                <li key={template.id} className="flex flex-col rounded-[12px] border border-line bg-paper/50 p-3.5">
                  <div className="flex items-center gap-2">
                    <SubjectDot color={color.solid} />
                    <span className="text-[12px] font-semibold" style={{ color: color.solid }}>
                      {template.subject}
                    </span>
                    <span className="chip chip-demo ml-auto">Demo</span>
                  </div>
                  <p className="mt-1.5 font-semibold text-ink">{template.title}</p>
                  <p className="tnum mt-0.5 text-[12.5px] text-ink-3">
                    {template.videos.length} konu · ~{formatHours(template.totalDurationMinutes)} örnek süre
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm mt-3 self-start"
                    disabled={added}
                    onClick={() => {
                      onCreate(cloneTemplate(template));
                      onClose();
                    }}
                    aria-label={added ? `${template.title} zaten ekli` : `${template.title} demo şablonunu ekle`}
                  >
                    {added ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                    {added ? 'Ekli' : 'Ekle'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
