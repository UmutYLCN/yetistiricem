import type { ReactNode } from 'react';
import { CalendarRange, CircleCheck, Eye, ListVideo, Plus } from 'lucide-react';
import { EmptyState, FeaturedIcon } from '../ui/EmptyState';
import { BranchesArt, CampsArt, PathArt, ProgressArt, WeekArt, WelcomeArt } from './EmptyArt';

interface Props {
  onAddCamp: () => void;
  onStartDemo: () => void;
}

const STEPS = [
  {
    icon: ListVideo,
    title: 'Kaynaklarını ekle',
    body: 'YouTube oynatma listelerini yapıştır; her liste adı ve gerçek süreleriyle bir branş olur (Matematik, Fizik…).',
  },
  {
    icon: CalendarRange,
    title: 'Kampını ve ritmini kur',
    body: 'Kampına ad ve tarih ver. Branşları otomatik dağıt ya da hangi gün hangi branşın geleceğini kendin seç.',
  },
  {
    icon: CircleCheck,
    title: 'Her gün işaretle',
    body: 'İzlediğini işaretle; görev yerinde kalır. Geride kalırsan kalanları tek dokunuşla ileri taşı.',
  },
];

const DEMO_NOTE = 'Demo örnek bir plan gösterir; hiçbir şey kaydedilmez ve çıktığında planın yine boş olur.';

/** First-run screen. Nothing is created until the user asks for it. */
export function Welcome({ onAddCamp, onStartDemo }: Props) {
  return (
    <div className="mx-auto max-w-[1040px] py-2 sm:py-6">
      <section aria-labelledby="welcome-title" className="card empty-surface overflow-hidden">
        <div className="grid items-center gap-10 px-6 pt-9 pb-10 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-8 lg:py-14">
          <div className="min-w-0">
            <span className="chip chip-forest">Başlangıç</span>
            <h1 id="welcome-title" className="font-display mt-4 text-[30px] leading-[1.12] text-ink sm:text-[38px]">
              İlk kampını kur, gerisini Yetiştiricem planlasın.
            </h1>
            <p className="mt-4 max-w-[500px] text-[15.5px] leading-relaxed text-ink-2">
              Oynatma listelerini ekle, günlük çalışma süreni seç. Ders videoları bu süreyi aşmayacak şekilde günlere bölünür; her gün ne
              çalışacağını ve hedefe ne kadar kaldığını görürsün. Planın şu an boş.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <button type="button" className="btn btn-primary btn-lg" onClick={onAddCamp}>
                <Plus aria-hidden="true" />
                İlk kampını kur
              </button>
              <button type="button" className="btn btn-secondary btn-lg" onClick={onStartDemo}>
                <Eye aria-hidden="true" />
                Demo ile göz at
              </button>
            </div>
            <p className="mt-3.5 text-[12.5px] text-ink-3">{DEMO_NOTE}</p>
          </div>
          <WelcomeArt />
        </div>
        <ol className="grid border-t border-line sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className="flex gap-4 border-line px-6 py-6 not-first:border-t sm:flex-col sm:px-8 sm:not-first:border-t-0 sm:not-first:border-l"
            >
              <FeaturedIcon icon={<Icon />} size="sm" rings={false} />
              <div className="min-w-0">
                <p className="tnum text-[12px] font-semibold text-ink-3">{i + 1}. adım</p>
                <p className="mt-0.5 font-semibold text-ink">{title}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** A page-sized empty state on a card. */
function EmptyPage(props: Parameters<typeof EmptyState>[0]) {
  return (
    <div className="card empty-surface overflow-hidden px-6 pt-10 pb-12 sm:pt-12 sm:pb-14">
      <EmptyState {...props} />
    </div>
  );
}

export type NoCampsView = 'path' | 'week' | 'progress' | 'camps';

const NO_CAMPS: Record<NoCampsView, { art: ReactNode; title: string; body: string }> = {
  path: {
    art: <PathArt />,
    title: 'Günün yolu burada çizilecek',
    body: 'Bir kamp kurduğunda her günün videoları bir yol olur: birini izleyip işaretlersin, sıradakine geçersin.',
  },
  week: {
    art: <WeekArt />,
    title: 'Haftan burada şekillenecek',
    body: 'Bir kamp kurduğunda her günün görevleri, haftanın rotası ve toplam çalışma süresi burada görünür.',
  },
  progress: {
    art: <ProgressArt />,
    title: 'İlerlemen burada birikecek',
    body: 'Görevleri işaretledikçe tamamlanan videolar, kalan çalışma süresi ve tahmini bitiş tarihi burada görünür.',
  },
  camps: {
    art: <CampsArt />,
    title: 'Henüz kamp yok',
    body: 'Kamp, bir hedefin tamamıdır: TYT 2027 ya da İngilizce gibi. Her kampın kendi branşları, tarihleri ve temposu olur.',
  },
};

/** Empty state for the views other than the day plan, before the first camp. */
export function NoCampsYet({ view, onAddCamp, onStartDemo }: Props & { view: NoCampsView }) {
  const { art, title, body } = NO_CAMPS[view];
  return (
    <EmptyPage
      art={art}
      title={title}
      footnote={DEMO_NOTE}
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={onAddCamp}>
            <Plus aria-hidden="true" />
            Kamp kur
          </button>
          <button type="button" className="btn btn-secondary" onClick={onStartDemo}>
            <Eye aria-hidden="true" />
            Demo ile göz at
          </button>
        </>
      }
    >
      {body}
    </EmptyPage>
  );
}

/** The open camp has no branch yet. */
export function NoBranchesYet({ onAddBranches }: { onAddBranches: () => void }) {
  return (
    <EmptyPage
      art={<BranchesArt />}
      title="Bu kampta henüz branş yok"
      actions={
        <button type="button" className="btn btn-primary" onClick={onAddBranches}>
          <Plus aria-hidden="true" />
          Branş ekle
        </button>
      }
    >
      Bir oynatma listesi ekle; her liste bir branş olur ve plan kendiliğinden kurulur.
    </EmptyPage>
  );
}

/** "Tüm Kamplar" before any camp has a video. `campName`: the open camp, offered for adding branches. */
export function NoCampVideos({ campName, onAddBranches, onOpenCamps }: { campName?: string; onAddBranches: () => void; onOpenCamps: () => void }) {
  return (
    <EmptyPage
      art={<BranchesArt />}
      title="Kamplarında henüz video yok"
      actions={
        <>
          {campName && (
            <button type="button" className="btn btn-primary" onClick={onAddBranches}>
              <Plus aria-hidden="true" />“{campName}” kampına branş ekle
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onOpenCamps}>
            Kamplara git
          </button>
        </>
      }
    >
      Tüm Kamplar, video içeren kampları tarihe göre birlikte gösterir. Bir kampa branş ekle; o kamp kendi temposuyla buraya katılır.
    </EmptyPage>
  );
}
