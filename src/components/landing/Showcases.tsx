import {
  ArrowRight,
  Check,
  CircleCheck,
  Compass,
  Focus,
  Layers,
  ListVideo,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { addDays } from '../../lib/engine';
import { formatHours, formatMinutes, formatSpeed } from '../../lib/format';
import type { LandingPreview } from '../../lib/landingPreview';
import { DEMO_APP_PATH, discoverReturnUrl } from '../../lib/routes';
import { CatalogCard } from '../discover/CatalogCard';
import type { CatalogPreviewEntry } from '../discover/CatalogCard';
import { FocusCompletion } from '../focus/FocusCompletion';
import { PageHeader } from '../layout/PageHeader';
import { AppPreviewLayout } from './AppPreviewLayout';
import { BrandMark } from '../ui/BrandMark';
import { Skeleton, Thumbnail } from './Illustrations';

const noop = () => {};

export function FocusShowcase({ preview }: { preview: LandingPreview }) {
  const items = preview.day.plan?.items ?? [];
  const item = items.find(task => !task.completed) ?? items[0];
  const next = items.find(task => task.id !== item?.id && !task.completed) ?? null;
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

// Fictional names and course ideas for this inert showcase, never published or imported.
const CATALOG_EXAMPLES: Omit<CatalogPreviewEntry, 'preview' | 'createdAt'>[] = [
  {
    id: 'yks-2027',
    tags: ['yks', 'tyt', 'ayt'],
    cover: null,
    saveCount: 128,
    name: 'YKS 2027 hazırlık kampı',
    author: { name: 'Ömer Yıldız', avatar: 'shape-6', stage: 'exam-prep', department: 'Tıp', profession: null, bio: null },
    description: 'Matematik, Türkçe, Fizik, Kimya ve Biyoloji konularını aynı çalışma planında topla.',
    subjects: ['Matematik', 'Türkçe', 'Fizik', 'Kimya', 'Biyoloji'],
  },
  {
    id: 'computer-engineering-fall',
    tags: ['bilgisayarmühendisliği', 'vize'],
    cover: null,
    saveCount: 64,
    name: 'Bilgisayar Mühendisliği · 3. sınıf 1. dönem',
    author: { name: 'Ayşe Koç', avatar: 'shape-3', stage: 'university', department: 'Bilgisayar Mühendisliği', profession: null, bio: null },
    description: 'Algoritmalar, veritabanı, işletim sistemleri ve bilgisayar ağları. Dönem derslerini tek planda takip et.',
    subjects: ['Algoritmalar', 'Veritabanı', 'İşletim Sistemleri', 'Bilgisayar Ağları'],
  },
  {
    id: 'python',
    tags: ['yazılım', 'python'],
    cover: null,
    saveCount: 212,
    name: 'Sıfırdan Python',
    author: { name: 'Deniz Arslan', avatar: 'shape-4', stage: 'working', department: null, profession: 'Yazılım geliştirici', bio: null },
    description: 'İlk satır koddan küçük projelere. Temelleri öğren, her adımda pratiğe dök.',
    subjects: ['Python', 'Programlama'],
  },
  {
    id: 'english',
    tags: ['ingilizce', 'konuşma'],
    cover: null,
    saveCount: 97,
    name: 'İngilizce konuşma rutini',
    author: { name: 'Ece Demir', avatar: 'shape-2', stage: 'university', department: 'İngiliz Dili ve Edebiyatı', profession: null, bio: null },
    description: 'Dinleme, telaffuz ve günlük konuşma. Her gün biraz daha rahat ifade et.',
    subjects: ['İngilizce', 'Konuşma pratiği'],
  },
  {
    id: 'design',
    tags: ['tasarım', 'figma'],
    cover: null,
    saveCount: 58,
    name: 'Figma ile arayüz tasarımı',
    author: { name: 'Selin Kaya', avatar: 'shape-1', stage: 'graduate', department: null, profession: 'Ürün tasarımcısı', bio: null },
    description: 'Tipografi, renk ve bileşenler. İlk ekranından etkileşimli prototipine.',
    subjects: ['Figma', 'UI tasarımı'],
  },
  {
    id: 'data',
    tags: ['excel', 'veri'],
    cover: null,
    saveCount: 41,
    name: 'Excel ile veri analizi',
    author: { name: 'Mert Aydın', avatar: 'shape-5', stage: 'working', department: null, profession: 'Veri analisti', bio: null },
    description: 'Dağınık tablolardan anlaşılır raporlara. Formüller, grafikler ve veriyle düşünme.',
    subjects: ['Excel', 'Veri analizi'],
  },
  {
    id: 'photography',
    tags: ['fotoğraf'],
    cover: null,
    saveCount: 33,
    name: 'Fotoğrafçılığa ilk adım',
    author: { name: 'İpek Yılmaz', avatar: 'shape-7', stage: 'high-school', department: 'Görsel İletişim Tasarımı', profession: null, bio: null },
    description: 'Işığı gör, kadrajını kur. Manuel ayarlardan kendi görsel hikâyene.',
    subjects: ['Fotoğrafçılık'],
  },
  {
    id: 'spanish',
    tags: ['ispanyolca', 'dil'],
    cover: null,
    saveCount: 26,
    name: 'İspanyolca: günlük pratik',
    author: { name: 'Can Erdem', avatar: 'shape-8', stage: 'university', department: 'Uluslararası İlişkiler', profession: null, bio: null },
    description: 'Kelimeler, kısa diyaloglar ve dinleme. Yeni bir dile kendi hızında alış.',
    subjects: ['İspanyolca'],
  },
];

function CatalogPreview({ preview }: { preview: LandingPreview }) {
  const entries: CatalogPreviewEntry[] = CATALOG_EXAMPLES.map((example, index) => ({
    ...example,
    preview: true,
    createdAt: `${addDays(preview.today, -index * 4)}T12:00:00`,
  }));
  return (
    <div className="preview-frame max-h-none text-left [mask-image:none]" aria-hidden="true" inert>
      <AppPreviewLayout view="discover">
        <PageHeader
          title="Keşfet"
          actions={
            <span className="chip chip-demo" title="Kamp ve kişi adları, etiketler ve kayıt sayıları bu tanıtım için kurgulanmıştır.">
              Örnek kamplar
            </span>
          }
        />
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
          <input
            className="input min-h-[46px] rounded-full pl-10"
            type="search"
            placeholder="Kamp adı ya da #etiket ara"
            aria-label="Kamplarda ara"
            readOnly
            tabIndex={-1}
          />
        </div>
        <div className="mt-3 mb-5 flex gap-1.5 overflow-hidden">
          {['Tümü', '#yks', '#yazılım', '#ingilizce', '#tasarım'].map((label, i) => (
            <span key={label} className={`filter-chip inline-flex items-center ${i === 0 ? 'is-active' : ''}`}>
              {label}
            </span>
          ))}
        </div>
        <ul className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(entry => (
            <CatalogCard key={entry.id} entry={entry} today={preview.today} own={false} saved={false} onOpen={noop} onToggleSave={noop} />
          ))}
        </ul>
      </AppPreviewLayout>
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
            ].map(camp => (
              <div key={camp.name} className={`sketch-panel sketch-tone-${camp.tone}`}>
                <span className="all-camp-color" />
                <span>{camp.name}</span>
                <span className="ml-auto text-ink-3">{formatHours(camp.hours * 60)}</span>
              </div>
            ))}
          </div>
          <ArrowRight className="all-camps-arrow" />
          <div className="sketch-panel all-camps-today">
            <span className="art-meta">Bugün · tüm kamplar</span>
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
