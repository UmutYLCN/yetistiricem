import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { dayStops } from '../../lib/dayPath';
import type { LandingPreview } from '../../lib/landingPreview';
import { DayPath } from '../path/DayPath';
import {
  BellVisual,
  DailyGoalVisual,
  DeadlineVisual,
  HabitsVisual,
  HeatmapVisual,
  PlaylistVisual,
  ProgressVisual,
  RescheduleVisual,
  RhythmVisual,
} from './Illustrations';
import { DiscoverShowcase, FocusShowcase } from './Showcases';

const noop = () => {};

function Bento({
  id,
  title,
  children,
  visual,
  className = '',
}: {
  id: string;
  title: string;
  children: ReactNode;
  visual: ReactNode;
  className?: string;
}) {
  return (
    <article id={id} aria-labelledby={`${id}-title`} className={`landing-feature-card ${className}`}>
      <div className="landing-feature-copy">
        <h4 id={`${id}-title`}>{title}</h4>
        <p>{children}</p>
      </div>
      <div className="landing-feature-visual" aria-hidden="true" inert>
        {visual}
      </div>
    </article>
  );
}

function Chapter({
  id,
  n,
  label,
  title,
  text,
  children,
}: {
  id: string;
  n: string;
  label: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <div className="landing-chapter" role="group" aria-labelledby={`${id}-heading`}>
      <div className="chapter-heading">
        <div>
          <p className="section-eyebrow">
            {n} / {label}
          </p>
          <h3 id={`${id}-heading`}>{title}</h3>
        </div>
        <p>{text}</p>
      </div>
      <div className="landing-feature-grid">{children}</div>
    </div>
  );
}

function PathVisual({ preview }: { preview: LandingPreview }) {
  const stops = useMemo(() => dayStops(preview.day, preview.today).slice(0, 3), [preview.day, preview.today]);
  const minutes = stops.reduce((sum, stop) => sum + stop.item.effectiveMinutes, 0);
  const doneMinutes = stops.filter((stop) => stop.item.completed).reduce((sum, stop) => sum + stop.item.effectiveMinutes, 0);
  return (
    <div className="landing-path-art">
      <DayPath
        stops={stops}
        look={(item) => ({
          color: preview.branches.get(item.playlistId)?.color.solid ?? 'var(--color-ink-3)',
          tag: item.subject,
          playable: false,
        })}
        isToday={preview.day.date === preview.today}
        minutes={minutes}
        doneMinutes={doneMinutes}
        onOpen={noop}
      />
    </div>
  );
}

export function Features({ preview }: { preview: LandingPreview }) {
  return (
    <section id="ozellikler" aria-labelledby="ozellikler-baslik" className="landing-features">
      <div className="max-w-[700px]">
        <p className="section-eyebrow">
          <Sparkles aria-hidden="true" />
          Düşündüğün kadar zor değil
        </p>
        <h2 id="ozellikler-baslik" className="section-title mt-4">
          Büyük hedefler,
          <br />
          <span className="text-ink-3">bugünlük adımlar.</span>
        </h2>
        <p className="mt-5 max-w-[530px] text-[17px] leading-relaxed text-ink-2">
          Kaynaklarını bir araya getir. Kendine bir ritim kur. Yetişir, önündeki yolu gün gün netleştirsin.
        </p>
      </div>
      <Chapter
        id="planla"
        n="01"
        label="Planla"
        title="Hedefin gün gün hesaplanır."
        text="Günlük vaktini ve izleme hızını söyle. Planın ne zaman biteceğini daha başlamadan gör."
      >
        <Bento id="oynatma-listesi" title="Bir bağlantıdan, bütün bir plana." visual={<PlaylistVisual />}>
          Oynatma listeni ekle; videolar isimleri ve gerçek süreleriyle gelsin. İstersen farklı videoları ve kendi konularını bir araya
          getir.
        </Bento>
        <Bento id="gunluk-hedef" title="Planın, ayırdığın vakte göre." visual={<DailyGoalVisual preview={preview} />}>
          İzleme hızın ve tekrar payın hesaba katılır. Her güne, günlük sürene sığacak kadar çalışma yerleşir.
        </Bento>
        <Bento id="ritim" title="Kendi ritmin. Kendi haftan." visual={<RhythmVisual preview={preview} />}>
          Otomatik dağıt ya da hangi gün ne çalışacağını seç. Dinlenme ve deneme günlerine de yer var.
        </Bento>
        <Bento id="yetisir-mi" title="“Yetişir mi?” Artık biliyorsun." visual={<DeadlineVisual preview={preview} />}>
          Tahmini bitişini hedefinle karşılaştır. Zaman yetmiyorsa günlük süreni ne kadar artırman gerektiğini gör.
        </Bento>
      </Chapter>
      <FocusShowcase preview={preview} />
      <Chapter
        id="calis"
        n="03"
        label="Akışta kal"
        title="Sıradaki adımın hep belli."
        text="Bugünün yolu önünde. Listen büyüdüğünde yeni videoları kendi kararınla planına eklersin."
      >
        <Bento id="gunun-yolu" title="Bugün sadece bugünün adımı." visual={<PathVisual preview={preview} />}>
          Günün görevleri durak durak önünde. Nerede olduğunu ve ne kadar kaldığını tek bakışta gör.
        </Bento>
        <Bento id="yeni-videolar" title="Listen büyür. Haberin olur." visual={<BellVisual />}>
          Yeni dersler bildirimlerine gelir. İncele, istersen tek tıkla planının sonuna ekle.
        </Bento>
      </Chapter>
      <Chapter
        id="toparlan"
        n="04"
        label="Devam et"
        title="Bir gün aksadıysa, yeniden."
        text="Planını hayatına uydur. Ritmini güncelle, kaldığın yerden devam et. Attığın her adım görünür kalsın."
      >
        <Bento id="ritmi-guncelle" title="Ritmi güncelle, yine yetişir." visual={<RescheduleVisual preview={preview} />}>
          Geride kalanlar sonraki çalışma günlerine yayılsın. Neden aksadığını seç, sana uygun küçük bir öneri al.
        </Bento>
        <Bento id="seri" title="Devam ettikçe farkı gör." visual={<HabitsVisual preview={preview} />}>
          Çalıştığın günler seriye dönüşür. Görevlerinin ne kadarını planladığın günde bitirdiğini gör.
        </Bento>
        <Bento id="isi-haritasi" title="Emeğinin bir izi var." visual={<HeatmapVisual preview={preview} />}>
          Gün gün çalışman tek bir haritada. Küçük adımların zamanla nasıl biriktiğini gör.
        </Bento>
        <Bento id="ilerleme" title="Hedefe ne kadar kaldı?" visual={<ProgressVisual preview={preview} />}>
          Tamamladıkların, haftanın rotası ve tahmini bitişin. Yolun tamamı bir bakışta.
        </Bento>
      </Chapter>
      <DiscoverShowcase preview={preview} />
    </section>
  );
}
