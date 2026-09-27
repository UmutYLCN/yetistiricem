import { ArrowRight, Check, ChevronDown, CircleCheck, Compass, Focus, Layers, ListVideo, Search, ShieldCheck, X } from 'lucide-react';
import { DEMO_TEMPLATES } from '../../data/demoTemplates';
import type { CatalogEntry } from '../../lib/catalog';
import { formatHours, formatMinutes, formatSpeed } from '../../lib/format';
import type { LandingPreview } from '../../lib/landingPreview';
import { DEMO_APP_PATH, discoverReturnUrl } from '../../lib/routes';
import { CatalogCard } from '../discover/CatalogCard';
import { FocusCompletion } from '../focus/FocusCompletion';
import { Sidebar } from '../layout/Navigation';
import { BrandMark } from '../ui/BrandMark';
import { Skeleton, Thumbnail } from './Illustrations';

const noop = () => {};

export function FocusShowcase({ preview }: { preview: LandingPreview }) {
  const items = preview.day.plan?.items ?? [];
  const item = items.find((task) => !task.completed) ?? items[0];
  const next = items.find((task) => task.id !== item?.id && !task.completed) ?? null;
  return (
    <div id="focus" className="focus-showcase landing-chapter" role="group" aria-labelledby="focus-heading">
      <div className="showcase-heading">
        <div>
          <p className="section-eyebrow">
            <Focus aria-hidden="true" />
            02 / yetişir focus
          </p>
          <h3 id="focus-heading">
            Bir video.
            <br />
            <span className="text-ink-3">Bütün dikkatin.</span>
          </h3>
        </div>
        <div>
          <p>
            YouTube’a gitmeden, akışa kapılmadan. Dersini aç, kendi hızında izle. Video bittiğinde görevin tamamlanır; bir sonraki adımın
            hazırdır.
          </p>
          <a href={DEMO_APP_PATH} className="landing-text-link">
            Uygulamaya göz at <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="focus-showcase-scene" aria-hidden="true" inert>
        <div className="focus-side-card focus-side-left">
          <span className="art-meta">
            <ListVideo />
            Bugünün listesi
          </span>
          {items.slice(0, 3).map((task, i) => (
            <div key={task.id} className="sketch-row">
              <Thumbnail tone={i} />
              <div className="sketch-row-lines">
                <Skeleton width="80%" />
                <Skeleton width="55%" />
              </div>
              <Check className="size-3 text-forest" />
            </div>
          ))}
        </div>
        <div className="focus-showcase-window">
          <div className="focus-window-header">
            <div className="flex min-w-0 items-center gap-2">
              <BrandMark size={22} />
              <span className="font-semibold">
                yetişir <span className="text-ink-3">/ focus</span>
              </span>
            </div>
            <span className="art-sample-label">Örnek görünüm</span>
            <X className="size-4 text-ink-3" />
          </div>
          <div className="focus-window-title">
            <span>{item?.subject}</span>
            <p>{item?.title}</p>
          </div>
          <div className="focus-frame landing-focus-frame">
            <div className="focus-cover focus-cover-done">
              <FocusCompletion completed next={next} onUndo={noop} />
            </div>
          </div>
          <div className="focus-meter">
            <span className="w-full" />
          </div>
          <div className="focus-preview-footer">
            <span className="flex items-center gap-2">
              <CircleCheck className="size-4 text-forest" />
              Tamamlandı
            </span>
            <span>{formatSpeed(preview.prefs.playbackSpeed)} hız</span>
            <span className="art-flat-action ml-auto">
              Sıradaki göreve geç <ArrowRight />
            </span>
          </div>
        </div>
        <div className="focus-side-card focus-side-right">
          <span className="glow-check">
            <Check />
          </span>
          <p>
            Bir adım daha
            <br />
            <strong>tamamlandı.</strong>
          </p>
          <Skeleton width="75%" />
          <Skeleton width="50%" />
        </div>
      </div>
      <ul className="focus-benefits">
        <li>
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>Dikkatin derste kalsın</strong>
            <span>Duraklatınca ve bitirince öneriler gizlenir.</span>
          </div>
        </li>
        <li>
          <Focus aria-hidden="true" />
          <div>
            <strong>Nasıl çalıştığını gör</strong>
            <span>Odak süren, hızın ve duraklamaların kaydedilir.</span>
          </div>
        </li>
        <li>
          <CircleCheck aria-hidden="true" />
          <div>
            <strong>Bitir, sıradakine geç</strong>
            <span>Tamamlanan video planında işaretlenir.</span>
          </div>
        </li>
      </ul>
    </div>
  );
}

function CatalogPreview({ preview }: { preview: LandingPreview }) {
  const entries: CatalogEntry[] = DEMO_TEMPLATES.map((template) => ({
    id: template.id,
    authorId: 'sample',
    authorName: 'Örnek öğrenci',
    sourceCampId: template.id,
    name: template.title,
    description: 'Demo şablonu · Konuları sırayla incele, kendi ritmine göre planla.',
    subjects: [template.subject],
    branchCount: 1,
    videoCount: template.videos.length,
    totalMinutes: template.totalDurationMinutes,
    createdAt: `${preview.today}T12:00:00`,
    updatedAt: `${preview.today}T12:00:00`,
  }));
  return (
    <div className="discovery-window" aria-hidden="true" inert>
      <div className="discovery-window-bar">
        <div className="window-dots">
          <i />
          <i />
          <i />
        </div>
        <span>yetişir / keşfet</span>
        <span className="art-sample-label">Örnek kamplar</span>
      </div>
      <div className="discovery-app">
        <div className="discovery-sidebar">
          <Sidebar
            view="discover"
            onNavigate={noop}
            onAddCamp={noop}
            camps={[{ id: preview.camp.id, name: preview.camp.name }]}
            activeCampId={preview.camp.id}
            scope="camp"
            onSelectCamp={noop}
            onSelectAll={noop}
            isDemo
            profile={{ name: 'Demo', detail: 'Ayarlar' }}
          />
        </div>
        <div className="discovery-content">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[24px] font-semibold tracking-tight">Keşfet</p>
              <p className="mt-1 text-[12px] text-ink-3">Birlikte hazırlanmış rotalar. Sana ait bir tempo.</p>
            </div>
            <span className="art-flat-action max-sm:hidden">
              Kampını yayınla <ArrowRight />
            </span>
          </div>
          <div className="discovery-search">
            <Search />
            <span>Kamp, branş ya da kişi ara</span>
          </div>
          <ul className="discovery-grid">
            {entries.map((entry) => (
              <CatalogCard key={entry.id} entry={entry} today={preview.today} own={false} onOpen={noop} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function DiscoverShowcase({ preview }: { preview: LandingPreview }) {
  return (
    <div id="kesfet" className="discovery-showcase landing-chapter" role="group" aria-labelledby="kesfet-heading">
      <div className="showcase-heading">
        <div>
          <p className="section-eyebrow">
            <Compass aria-hidden="true" />
            05 / Birlikte
          </p>
          <h3 id="kesfet-heading">
            Birinin rotası,
            <br />
            <span className="text-ink-3">senin başlangıcın.</span>
          </h3>
        </div>
        <div>
          <p>
            Her şeyi sıfırdan kurmak zorunda değilsin. Paylaşılan kampları keşfet, içeriklerine bak, beğendiğini kendi planına ekle. Tempoyu
            yine sen belirlersin.
          </p>
          <a href={discoverReturnUrl('')} className="landing-text-link">
            Kampları keşfet <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </div>
      <CatalogPreview preview={preview} />
      <div className="all-camps-strip">
        <div>
          <p className="section-eyebrow">
            <Layers aria-hidden="true" />
            Tüm Kamplar
          </p>
          <h4>
            Birden fazla hedef.
            <br />
            Tek bir bugün.
          </h4>
          <p>Her kamp kendi temposunda ilerler. Günün planında hepsi bir araya gelir.</p>
        </div>
        <div className="all-camps-art" aria-hidden="true" inert>
          <div className="all-camps-sources">
            {[
              { name: 'Yoğun kampım', hours: preview.prefs.dailyStudyHours, tone: 0 },
              { name: 'Günlük alışkanlığım', hours: 0.5, tone: 1 },
            ].map((camp) => (
              <div key={camp.name} className={`sketch-panel sketch-tone-${camp.tone}`}>
                <span className="all-camp-color" />
                <span>{camp.name}</span>
                <span className="ml-auto text-ink-3">{formatHours(camp.hours * 60)}</span>
              </div>
            ))}
          </div>
          <ArrowRight className="all-camps-arrow" />
          <div className="sketch-panel all-camps-today">
            <span className="art-meta">
              Tüm Kamplar <ChevronDown className="ml-auto" />
            </span>
            <strong>{formatMinutes(preview.prefs.dailyStudyHours * 60 + 30)}</strong>
            <span>Örnek günlük hedef</span>
            <div className="flex gap-1">
              <span className="h-1.5 flex-[4] rounded-full bg-study-indigo" />
              <span className="h-1.5 flex-1 rounded-full bg-study-plum" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
