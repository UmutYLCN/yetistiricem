import { ArrowRight, Check, ChevronRight, Eye, Menu, X, MessageCircleQuestion, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useToday } from '../../hooks/useToday';
import type { LandingPreview } from '../../lib/landingPreview';
import { buildLandingPreview } from '../../lib/landingPreview';
import { hasSavedSignIn } from '../../lib/authKey';
import { APP_PATH, DEMO_APP_PATH, DOCS_PATH, LANDING_PATH } from '../../lib/routes';
import { BrandMark, Wordmark } from '../ui/BrandMark';
import { ThemeIconToggle } from '../ui/ThemeToggle';
import { Features } from './Features';
import { AiSection, AskSection, HowItWorks } from './Stories';
import { ProductPreview } from './ProductPreview';
import { Goals } from './Goals';
import { Testimonials } from './Testimonials';
import './landing.css';
import { msg } from '../../lib/messages';


const SECTIONS = [
  { id: 'ozellikler', label: 'Özellikler' },
  { id: 'nasil-calisir', label: 'Nasıl çalışır' },
  { id: 'yapay-zeka', label: 'Yapay zekâ' },
  { id: 'sss', label: 'SSS' },
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
    a: 'Hayır. Yoğun bir kamp, günlük bir alışkanlık, dönemlik dersler ya da kendi yol haritan için kullanabilirsin. Video serileri ve YouTube dışı konularla da plan oluşturabilirsin.',
  },
  {
    q: 'Demo verilerime dokunur mu?',
    a: 'Hayır. Demo örnek bir kamp gösterir; hiçbir şey kaydedilmez ve çıktığında kendi planın olduğu gibi durur.',
  },
];

/** The hero's account button opens the planner: straight in with a session, otherwise its sign-in page. */
function accountLabel(signedIn: boolean): string {
  return msg(signedIn ? 'Dashboard’a git' : 'Giriş yap ve başla');
}

function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header
      className="landing-header"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setMenuOpen(false);
          document.getElementById('landing-menu-toggle')?.focus();
        }
      }}
    >
      <div className="landing-header-inner">
        <a href={LANDING_PATH} className="landing-brand" aria-label={msg("Yetişir ana sayfası")}>
          <BrandMark size={27} />
          <Wordmark className="text-[21px]" />
        </a>
        <nav aria-label={msg("Sayfa bölümleri")} className="landing-desktop-nav">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {msg(section.label)}
            </a>
          ))}
          <a href={DOCS_PATH}>{msg("Belgeler")}</a>
        </nav>
        <div className="landing-header-actions">
          <ThemeIconToggle />
          <button
            id="landing-menu-toggle"
            type="button"
            className="landing-icon-button landing-menu-toggle"
            aria-label={menuOpen ? msg("Menüyü kapat") : msg("Menüyü aç")}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-nav"
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav id="landing-mobile-nav" aria-label={msg("Mobil sayfa bölümleri")} className="landing-mobile-nav" hidden={!menuOpen}>
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} onClick={() => setMenuOpen(false)}>
            {msg(section.label)}
            <ArrowRight aria-hidden="true" />
          </a>
        ))}
        <a href={DOCS_PATH}>
          {msg("\n          Belgeler\n          ")}<ArrowRight aria-hidden="true" />
        </a>
      </nav>
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
          <span className="announce-badge">{msg("Yeni")}</span>
          <span className="min-w-0 truncate">{msg("Claude, ChatGPT ve Grok ile planla")}</span>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
        </a>
        <h1 id="hero-title" className="hero-title text-gradient mx-auto mt-7">
          {msg("\n          Panik yok,\n          ")}<br />
          {msg("\n          yetişir.\n        ")}</h1>
        <p className="mx-auto mt-6 max-w-[640px] text-[17px] leading-relaxed text-ink-2 sm:text-[19px]">
          {msg("\n          YouTube ders videolarını günlük ritmine göre dağıt; bugün ne izleyeceğini düşünme, hedefine tam vaktinde ulaş. Günlük süreni ve\n          izleme hızını gir, Yetişir ne zaman biteceğini gün gün hesaplasın.\n        ")}</p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={APP_PATH} className="btn btn-primary btn-lg group">
            {accountLabel(signedIn)}
            <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
          <a href={DEMO_APP_PATH} className="btn btn-secondary btn-lg">
            <Eye aria-hidden="true" />
            {msg("\n            Demo ile göz at\n          ")}</a>
        </div>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-ink-3">
          {['Ücretsiz', 'E-posta ve şifre', 'Demo ile göz at'].map((point) => (
            <li key={point} className="flex items-center gap-1.5">
              <Check className="size-3.5 text-forest" strokeWidth={2.5} aria-hidden="true" />
              {msg(point)}
            </li>
          ))}
        </ul>
      </div>

      <figure className="relative mx-auto mt-16 max-w-[1240px] px-3 sm:mt-20 sm:px-6">
        <div className="preview-glow" aria-hidden="true" />
        <div className="hero-tilt">
          <ProductPreview base={preview} />
        </div>
      </figure>
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
            {msg("\n            SSS\n          ")}</p>
          <h2 id="sss-baslik" className="section-title text-gradient mt-4">
            {msg("\n            Sık sorulanlar\n          ")}</h2>
          <p className="mt-5 max-w-[420px] text-[17px] leading-relaxed text-ink-2">
            {msg("\n            Başlamadan önce aklına takılanlar. Hesabın, planın ve çalışma ritmin hakkında kısa cevaplar.\n          ")}</p>
        </div>
        <div className="reveal border-t border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="faq-item border-b border-line">
              <summary className="flex items-center justify-between gap-6 rounded-[8px] py-5 text-[16px] font-medium text-ink">
                {msg(item.q)}
                <Plus className="faq-icon size-4 shrink-0 text-ink-3 transition-transform duration-200" aria-hidden="true" />
              </summary>
              <p className="-mt-1 pr-10 pb-6 text-[15px] leading-relaxed text-ink-2">{msg(item.a)}</p>
            </details>
          ))}
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
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">
            {msg("\n            Panik yok, yetişir. Ders videolarını günlük ritmine göre dağıtan çalışma planlayıcı.\n          ")}</p>
        </div>
        <nav aria-label={msg("Alt menü")}>
          <ul className="flex flex-wrap gap-x-8 gap-y-3 text-[13.5px] text-ink-2">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="transition-colors hover:text-ink">
                  {msg(section.label)}
                </a>
              </li>
            ))}
            <li>
              <a href={DOCS_PATH} className="transition-colors hover:text-ink">
                {msg("\n                Belgeler\n              ")}</a>
            </li>
            <li>
              <a href={DEMO_APP_PATH} className="transition-colors hover:text-ink">
                {msg("\n                Demo\n              ")}</a>
            </li>
            <li>
              <a href={APP_PATH} className="transition-colors hover:text-ink">
                {signedIn ? msg("Dashboard") : msg("Giriş yap")}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-[1200px] border-t border-line/70 px-4 py-6 text-[12.5px] text-ink-3 sm:px-6">
        {msg("\n        © ")}{new Date().getFullYear()} {msg(" Yetişir · Bugünün adımını at, gerisi yetişir.\n      ")}</div>
    </footer>
  );
}

/**
 * The landing page at `/`. Its hero and footer account links open the planner
 * at `/app` (a full page load, see `lib/routes`), which asks signed-out visitors to sign in.
 */
export default function Landing() {
  const today = useToday();
  const preview = useMemo(() => buildLandingPreview(today), [today]);
  const [signedIn] = useState(hasSavedSignIn);
  return (
    <div className="landing overflow-x-clip">
      <a href="#icerik" className="skip-link">
        {msg("\n        İçeriğe geç\n      ")}</a>
      <SiteHeader />
      <main id="icerik" tabIndex={-1} className="outline-none">
        <Hero preview={preview} signedIn={signedIn} />
        <Goals />
        <AskSection preview={preview} />
        <Features preview={preview} />
        <HowItWorks preview={preview} />
        <AiSection preview={preview} />
        <Faq />
        <Testimonials />
      </main>
      <SiteFooter signedIn={signedIn} />
    </div>
  );
}
