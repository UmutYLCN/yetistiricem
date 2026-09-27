import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Eye,
  GraduationCap,
  Languages,
  MessageCircleQuestion,
  PencilRuler,
  Plus,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useToday } from '../../hooks/useToday';
import type { LandingPreview } from '../../lib/landingPreview';
import { buildLandingPreview } from '../../lib/landingPreview';
import { hasSavedSignIn } from '../../lib/authKey';
import { APP_PATH, DEMO_APP_PATH, LANDING_PATH } from '../../lib/routes';
import { BrandMark, Wordmark } from '../ui/BrandMark';
import { Features } from './Features';
import { AiSection, AskSection, HowItWorks } from './Stories';
import { ProductPreview } from './ProductPreview';

const SECTIONS = [
  { id: 'ozellikler', label: 'Özellikler' },
  { id: 'nasil-calisir', label: 'Nasıl çalışır' },
  { id: 'yapay-zeka', label: 'Yapay zekâ' },
  { id: 'sss', label: 'SSS' },
];

const GOALS = [
  { label: 'TYT ve AYT', icon: GraduationCap },
  { label: 'Dil öğrenimi', icon: Languages },
  { label: 'Sertifika hazırlığı', icon: BadgeCheck },
  { label: 'Mesleki gelişim', icon: BriefcaseBusiness },
  { label: 'Kendi konun', icon: PencilRuler },
];

const FAQ = [
  {
    q: 'Hesap açmam gerekiyor mu?',
    a: 'Planına e-posta adresin ve şifrenle giriş yaparsın. İlk kez geliyorsan ücretsiz hesap oluşturabilirsin. Demoya giriş yapmadan göz atabilirsin.',
  },
  {
    q: 'Verilerim başka cihazla eşitlenir mi?',
    a: 'Evet. Kampların, ilerlemen ve notların hesabına kaydedilir; hangi cihazdan giriş yaparsan yap planın seninle. İstersen Ayarlar’dan yedeğini dosya olarak da indirebilirsin.',
  },
  {
    q: 'Hangi oynatma listelerini içe aktarabilirim?',
    a: 'Herkese açık ve liste dışı YouTube oynatma listelerini. Özel listeler bu sürümde desteklenmiyor; video bağlantılarını tek tek yapıştırabilir, YouTube dışındaki dersleri konu ve süreyle elle ekleyebilirsin.',
  },
  {
    q: 'Bir gün geride kalırsam ne olur?',
    a: 'Suçluluk yok. Plan sen istemedikçe değişmez; “Ritmi güncelle” ile geciken görevler sonraki uygun çalışma günlerine yayılır, tamamladıkların yerinde kalır. Nedenini seçersen İlerleme ekranı alışkanlıklarını gösterir ve küçük bir öneri alırsın.',
  },
  {
    q: '“Yetişir mi?” nasıl hesaplanıyor?',
    a: 'Her videonun gerçek süresi, izleme hızın, tekrar payın, günlük süren ve çalışma günlerin kullanılır. Görevler günlere sığacak kadar dağıtılır; son görevin günü hedef tarihinle karşılaştırılır.',
  },
  {
    q: 'Yapay zekâ bağlantısı güvenli mi?',
    a: 'Bağlantıyı sen onaylarsın ve Profil sayfandan istediğin an kaldırırsın. Yapay zekâ yalnızca kendi planını okur ve senin onayınla kamp ekler; bir şey silemez, Keşfet’te yayın yapamaz, şifrene ulaşamaz.',
  },
  {
    q: 'Kampımı Keşfet’te yayınlamak zorunda mıyım?',
    a: 'Hayır. Kampların sen yayınlamadıkça yalnızca sana görünür. Yayınladığında adın ve kampın içeriği görünür; ilerlemen, notların ve e-postan hiçbir zaman paylaşılmaz.',
  },
  {
    q: 'Hedef tarihime yetişemezsem?',
    a: 'Hedef bitiş tarihi programı sıkıştırmaz. Program bu tarihe yetişmiyorsa Yetişir durumu gösterir ve günlük çalışma süreni artırmayı önerebilir.',
  },
  {
    q: 'Sadece sınav hazırlığı için mi?',
    a: 'Hayır. TYT ve AYT yalnızca iki örnek; dil öğrenimi, sertifika hazırlığı ya da video derslerle çalıştığın herhangi bir konu için kamp kurabilirsin.',
  },
  {
    q: 'Demo verilerime dokunur mu?',
    a: 'Hayır. Demo örnek bir kamp gösterir; hiçbir şey kaydedilmez ve çıktığında kendi planın olduğu gibi durur.',
  },
];

/** Landing account buttons open the planner: straight in with a session, otherwise its sign-in page. */
function accountLabel(signedIn: boolean, long: boolean): string {
  if (signedIn) return long ? 'Dashboard’a git' : 'Dashboard';
  return long ? 'Giriş yap ve başla' : 'Giriş yap';
}

function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-4 sm:px-6">
        <a href={LANDING_PATH} className="flex shrink-0 items-center gap-2.5 rounded-[10px]" aria-label="Yetişir ana sayfası">
          <BrandMark size={28} />
          <Wordmark className="text-[16px]" />
        </a>
        <nav aria-label="Sayfa bölümleri" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {SECTIONS.map(section => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="rounded-[8px] px-3 py-2 text-[13.5px] text-ink-2 transition-colors hover:bg-sunk/60 hover:text-ink"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a href={APP_PATH} className="btn btn-primary btn-sm group">
            {accountLabel(signedIn, false)}
            <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero({ preview, signedIn }: { preview: LandingPreview; signedIn: boolean }) {
  // `overflow-clip`, not `overflow-hidden`: a scroll container here would pin the preview's scroll-driven tilt.
  return (
    <section aria-labelledby="hero-title" className="relative overflow-clip">
      <div className="hero-backdrop" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1200px] px-4 pt-16 text-center sm:px-6 sm:pt-24">
        <a href="#yapay-zeka" className="announce">
          <span className="announce-badge">Yeni</span>
          <span className="min-w-0 truncate">Claude, ChatGPT ve Gemini ile planla</span>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        </a>
        <h1 id="hero-title" className="hero-title text-gradient mx-auto mt-7">
          Panik yok,
          <br />
          yetişir.
        </h1>
        <p className="mx-auto mt-6 max-w-[640px] text-[17px] leading-relaxed text-ink-2 sm:text-[19px]">
          YouTube ders videolarını günlük ritmine göre dağıt; bugün ne izleyeceğini düşünme, hedefine tam vaktinde ulaş. Günlük süreni ve
          izleme hızını gir, Yetişir ne zaman biteceğini gün gün hesaplasın.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={APP_PATH} className="btn btn-primary btn-lg group">
            {accountLabel(signedIn, true)}
            <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
          <a href={DEMO_APP_PATH} className="btn btn-secondary btn-lg">
            <Eye aria-hidden="true" />
            Demo ile göz at
          </a>
        </div>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-ink-3">
          {['Ücretsiz', 'E-posta ve şifre', 'Demo ile göz at'].map(point => (
            <li key={point} className="flex items-center gap-1.5">
              <Check className="size-3.5 text-forest" strokeWidth={2.5} aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <figure className="relative mx-auto mt-16 max-w-[1240px] px-3 sm:mt-20 sm:px-6">
        <div className="preview-glow" aria-hidden="true" />
        <div className="hero-tilt">
          <ProductPreview base={preview} />
        </div>
        <figcaption className="mt-2 text-center text-[12.5px] text-ink-3">
          Örnek plan: demo kampın bugünü, uygulamanın kendi ekranıyla.
        </figcaption>
      </figure>
    </section>
  );
}

function Goals() {
  return (
    <section aria-labelledby="hedefler-baslik" className="mx-auto max-w-[1200px] px-4 pt-20 sm:px-6 sm:pt-24">
      <h2 id="hedefler-baslik" className="text-center text-[13.5px] text-ink-3">
        Video derslerle çalıştığın her hedef için
      </h2>
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
        {GOALS.map(({ label, icon: Icon }) => (
          <li key={label} className="flex items-center gap-2.5 text-[16px] font-medium tracking-[-0.01em] text-ink-2">
            <Icon className="size-[18px] text-ink-3" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Faq() {
  return (
    <section id="sss" aria-labelledby="sss-baslik" className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 sm:py-32">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <div className="reveal">
          <p className="section-eyebrow">
            <MessageCircleQuestion aria-hidden="true" />
            SSS
          </p>
          <h2 id="sss-baslik" className="section-title text-gradient mt-4">
            Sık sorulanlar
          </h2>
          <p className="mt-5 max-w-[420px] text-[17px] leading-relaxed text-ink-2">
            Aklına takılan başka bir şey varsa en hızlı yol denemek: demo hiçbir şey kaydetmez.
          </p>
          <a href={DEMO_APP_PATH} className="btn btn-secondary mt-7">
            <Eye aria-hidden="true" />
            Demo ile göz at
          </a>
        </div>
        <div className="reveal border-t border-line">
          {FAQ.map(item => (
            <details key={item.q} className="faq-item border-b border-line">
              <summary className="flex items-center justify-between gap-6 rounded-[8px] py-5 text-[16px] font-medium text-ink">
                {item.q}
                <Plus className="faq-icon size-4 shrink-0 text-ink-3 transition-transform duration-200" aria-hidden="true" />
              </summary>
              <p className="-mt-1 pr-10 pb-6 text-[15px] leading-relaxed text-ink-2">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section aria-labelledby="son-cagri-baslik" className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="cta-panel reveal px-6 py-16 text-center sm:px-12 sm:py-24">
        <div className="cta-mark">
          <BrandMark size={52} />
        </div>
        <h2 id="son-cagri-baslik" className="section-title text-gradient mx-auto mt-8 max-w-[16ch]">
          Panik yok. Bugünün adımını at.
        </h2>
        <p className="mx-auto mt-5 max-w-[520px] text-[17px] leading-relaxed text-ink-2">
          Kampını birkaç dakikada kur ya da yapay zekâna kurdur; gerisi yetişir.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={APP_PATH} className="btn btn-primary btn-lg group">
            {accountLabel(signedIn, true)}
            <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
          <a href={DEMO_APP_PATH} className="btn btn-secondary btn-lg">
            <Eye aria-hidden="true" />
            Demo ile göz at
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteFooter({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[320px]">
          <div className="flex items-center gap-2.5">
            <BrandMark size={26} />
            <Wordmark className="text-[15.5px]" />
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">Panik yok, yetişir. Ders videolarını günlük ritmine göre dağıtan çalışma planlayıcı.</p>
        </div>
        <nav aria-label="Alt menü">
          <ul className="flex flex-wrap gap-x-8 gap-y-3 text-[13.5px] text-ink-2">
            {SECTIONS.map(section => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="transition-colors hover:text-ink">
                  {section.label}
                </a>
              </li>
            ))}
            <li>
              <a href={DEMO_APP_PATH} className="transition-colors hover:text-ink">
                Demo
              </a>
            </li>
            <li>
              <a href={APP_PATH} className="transition-colors hover:text-ink">
                {accountLabel(signedIn, false)}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-[1200px] border-t border-line/70 px-4 py-6 text-[12.5px] text-ink-3 sm:px-6">
        © {new Date().getFullYear()} Yetişir · Bugünün adımını at, gerisi yetişir.
      </div>
    </footer>
  );
}

/**
 * The landing page at `/`. Its "Dashboard" / "Giriş yap" links open the planner
 * at `/app` (a full page load, see `lib/routes`), which asks signed-out visitors to sign in.
 */
export default function Landing() {
  const today = useToday();
  const preview = useMemo(() => buildLandingPreview(today), [today]);
  const [signedIn] = useState(hasSavedSignIn);
  return (
    <div className="landing overflow-x-clip">
      <a href="#icerik" className="skip-link">
        İçeriğe geç
      </a>
      <SiteHeader signedIn={signedIn} />
      <main id="icerik" tabIndex={-1} className="outline-none">
        <Hero preview={preview} signedIn={signedIn} />
        <Goals />
        <AskSection preview={preview} />
        <Features preview={preview} />
        <HowItWorks preview={preview} />
        <AiSection preview={preview} />
        <Faq />
        <FinalCta signedIn={signedIn} />
      </main>
      <SiteFooter signedIn={signedIn} />
    </div>
  );
}
