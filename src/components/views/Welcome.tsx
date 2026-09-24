import { Eye, Plus } from 'lucide-react';
import { BrandMark } from '../layout/Navigation';

interface Props {
  onAddCamp: () => void;
  onStartDemo: () => void;
}

const STEPS = [
  {
    title: 'Kaynaklarını ekle',
    body: 'YouTube oynatma listelerini yapıştır; her liste adı ve gerçek süreleriyle bir branş olur (Matematik, Fizik…).',
  },
  {
    title: 'Kampını ve ritmini kur',
    body: 'Kampına ad ve tarih ver. Branşları otomatik dağıt ya da hangi gün hangi branşın geleceğini kendin seç.',
  },
  {
    title: 'Her gün işaretle',
    body: 'İzlediğini işaretle; görev yerinde kalır. Geride kalırsan kalanları tek dokunuşla ileri taşı.',
  },
];

/** First-run screen. Nothing is created until the user asks for it. */
export function Welcome({ onAddCamp, onStartDemo }: Props) {
  return (
    <div className="mx-auto max-w-[760px] py-4 sm:py-10">
      <div className="card overflow-hidden">
        <div className="border-b border-line px-6 pt-8 pb-7 sm:px-10 sm:pt-10">
          <BrandMark size={40} />
          <h1 className="font-display mt-5 text-[30px] leading-[1.15] text-ink sm:text-[36px]">
            Planını kur, her gün biraz yetiştir.
          </h1>
          <p className="mt-3 max-w-[560px] text-[15.5px] text-ink-2">
            Yetiştiricem, bir kampın tüm branşlarındaki ders videolarını günlük çalışma süreni aşmayacak şekilde günlere böler
            ve nerede olduğunu gösterir. Planın şu an boş.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button type="button" className="btn btn-primary" onClick={onAddCamp}>
              <Plus aria-hidden="true" />
              İlk kampını kur
            </button>
            <button type="button" className="btn btn-secondary" onClick={onStartDemo}>
              <Eye aria-hidden="true" />
              Demo ile göz at
            </button>
          </div>
          <p className="mt-3 text-[12.5px] text-ink-3">
            Demo örnek bir plan gösterir; hiçbir şey kaydedilmez ve çıktığında planın yine boş olur.
          </p>
        </div>
        <ol className="grid gap-px bg-line sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="bg-card px-6 py-5 sm:px-7">
              <span className="tnum flex size-7 items-center justify-center rounded-full bg-forest-soft text-[13px] font-bold text-forest-strong">
                {i + 1}
              </span>
              <p className="mt-3 font-semibold text-ink">{step.title}</p>
              <p className="mt-1 text-[13.5px] text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Compact empty state for views other than the day plan. */
export function NoCampsYet({ onAddCamp, onStartDemo }: { onAddCamp: () => void; onStartDemo: () => void }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <p className="font-display text-[21px] text-ink">Henüz kamp yok</p>
      <p className="mt-1 max-w-sm text-[14px] text-ink-2">Bir kamp kurduğunda planın, haftan ve ilerlemen burada görünür.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" className="btn btn-primary" onClick={onAddCamp}>
          <Plus aria-hidden="true" />
          Kamp kur
        </button>
        <button type="button" className="btn btn-secondary" onClick={onStartDemo}>
          <Eye aria-hidden="true" />
          Demo ile göz at
        </button>
      </div>
    </div>
  );
}
