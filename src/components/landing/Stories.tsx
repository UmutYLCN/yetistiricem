import type { ReactNode } from 'react';
import { ArrowRight, Bot, CalendarDays, Check, CircleCheck, Link2, ListChecks, ListVideo, MessageCircleQuestion, PencilLine, ShieldCheck, Wrench } from 'lucide-react';
import { SHORT_WEEKDAYS, formatHours, formatLongDate, formatShortDate, formatSpeed, relativeDayLabel } from '../../lib/format';
import type { LandingPreview } from '../../lib/landingPreview';
import { APP_PATH } from '../../lib/routes';

// ---------------------------------------------------------------------------
// "Hocam yetişir mi?"

const QUESTIONS = ['Hocam bu saatten sonra yetişir mi?', 'Sıfırdan başlasam yetişir mi?', 'Günde 2 saatle bu kamp biter mi?'];

/** The question every student asks, and how Yetişir answers it: with a date, not a slogan. */
export function AskSection({ preview }: { preview: LandingPreview }) {
  const { deadline, stats, prefs } = preview;
  const finish = deadline.kind === 'on-track' || deadline.kind === 'late' ? deadline.finishDate : stats.estimatedFinishDate;
  return (
    <section aria-labelledby="soru-baslik" className="mx-auto max-w-[1200px] px-4 pt-24 sm:px-6 sm:pt-32">
      <div className="reveal grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="section-eyebrow">
            <MessageCircleQuestion aria-hidden="true" />
            En çok sorulan soru
          </p>
          <h2 id="soru-baslik" className="section-title text-gradient mt-4">
            “Yetişir mi?” sorusuna takvimle cevap.
          </h2>
          <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-ink-2">
            Sınava, mülakata ya da yeni bir hedefe hazırlanırken akıldaki soru hep aynı. Yetişir motivasyon cümlesi söylemez: videolarının
            gerçek süresini, izleme hızını ve günlük vaktini hesaplar, hangi gün biteceğini gösterir.
          </p>
        </div>
        <div className="relative" aria-hidden="true" inert>
          <ul className="space-y-2.5">
            {QUESTIONS.map((q, i) => (
              <li
                key={q}
                className="w-fit max-w-[85%] rounded-[16px] rounded-bl-[6px] border border-line bg-card px-4 py-2.5 text-[14.5px] text-ink-2"
                style={{ marginLeft: `${i * 6}%` }}
              >
                {q}
              </li>
            ))}
          </ul>
          <div className="mt-5 ml-auto max-w-[88%] rounded-[18px] rounded-br-[6px] border border-forest/40 bg-forest-soft p-4">
            <p className="flex items-center gap-2 text-[17px] font-semibold text-ink">
              <CircleCheck className="size-5 text-forest" />
              Panik yok, yetişir.
            </p>
            <p className="tnum mt-1.5 text-[14px] text-ink-2">
              Kalan {formatHours(stats.totalMinutes)}, günde {prefs.dailyStudyHours} saat, {formatSpeed(prefs.playbackSpeed)} hızla: son görev{' '}
              <span className="font-semibold text-ink">{formatLongDate(finish)}</span>.
            </p>
            <p className="mt-2 text-[12px] text-ink-3">Demo kampının gerçek hesabı</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Nasıl çalışır

function StepSources() {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {[
        { icon: ListVideo, label: 'Oynatma listesi' },
        { icon: Link2, label: 'Videolar' },
        { icon: PencilLine, label: 'Konular' },
      ].map(({ icon: Icon, label }, i) => (
        <span
          key={label}
          className={`grid justify-items-center gap-1.5 rounded-[10px] border px-1 py-2.5 text-center text-[11px] ${
            i === 0 ? 'border-forest/50 bg-forest-soft text-ink' : 'border-line bg-field text-ink-3'
          }`}
        >
          <Icon className="size-4" />
          {label}
        </span>
      ))}
    </div>
  );
}

function StepCamp({ today }: { today: string }) {
  return (
    <div className="space-y-2">
      <span className="flex items-center rounded-[10px] border border-line-strong bg-field px-3 py-2 text-[13px] text-ink">
        TYT 2027
        <span className="ml-0.5 h-4 w-px animate-pulse bg-forest" />
      </span>
      <div className="flex gap-1.5">
        <span className="chip">
          <CalendarDays />
          {formatShortDate(today)}
        </span>
        <span className="chip">Hedef: isteğe bağlı</span>
      </div>
    </div>
  );
}

function StepRhythm({ preview }: { preview: LandingPreview }) {
  const active = new Set(preview.prefs.activeDays);
  return (
    <div className="space-y-2.5">
      <div className="segmented w-full">
        <button type="button" aria-pressed="true" tabIndex={-1}>
          Otomatik
        </button>
        <button type="button" aria-pressed="false" tabIndex={-1}>
          Elle
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[1, 2, 3, 4, 5, 6, 0].map(d => (
          <span
            key={d}
            className={`rounded-[7px] py-1 text-center text-[10.5px] font-semibold ${active.has(d) ? 'bg-forest-soft text-forest' : 'bg-field text-ink-3'}`}
          >
            {SHORT_WEEKDAYS[d]}
          </span>
        ))}
      </div>
    </div>
  );
}

function StepPreview({ preview }: { preview: LandingPreview }) {
  const { deadline, stats } = preview;
  return (
    <div className="rounded-[11px] border border-forest/40 bg-forest-soft px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Check className="size-3.5 text-forest" strokeWidth={3} />
        Panik yok, yetişir.
      </p>
      <p className="tnum mt-0.5 text-[12px] text-ink-2">
        Bitiş {formatShortDate(deadline.kind === 'on-track' || deadline.kind === 'late' ? deadline.finishDate : stats.estimatedFinishDate)}
      </p>
    </div>
  );
}

export function HowItWorks({ preview }: { preview: LandingPreview }) {
  const steps: { title: string; body: string; visual: ReactNode }[] = [
    {
      title: 'Kaynaklarını ekle',
      body: 'YouTube oynatma listesi, video bağlantıları ya da YouTube dışındaki dersler için konular. Her liste kendi branşı olur.',
      visual: <StepSources />,
    },
    { title: 'Kampını tanımla', body: 'Kampına bir ad ver, başlangıcı seç. Hedef tarih isteğe bağlı.', visual: <StepCamp today={preview.today} /> },
    {
      title: 'Ritmini seç',
      body: 'Günlük süre, hız ve çalışma günleri. Otomatik dağıt ya da branşları günlere kendin yerleştir.',
      visual: <StepRhythm preview={preview} />,
    },
    { title: 'Önizle ve başla', body: 'Takvimi ve bitiş tarihini gör, kaydet. Sonra her gün sadece bugünü işaretle.', visual: <StepPreview preview={preview} /> },
  ];
  return (
    <section id="nasil-calisir" aria-labelledby="nasil-calisir-baslik" className="border-y border-line/70 bg-card/40">
      <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 sm:py-32">
        <div className="reveal max-w-[720px]">
          <p className="section-eyebrow">
            <ListChecks aria-hidden="true" />
            Nasıl çalışır
          </p>
          <h2 id="nasil-calisir-baslik" className="section-title text-gradient mt-4">
            Dört adımda planın hazır.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
            Kamp sihirbazı seni adım adım götürür; kaydetmeden önce her şeyi önizler. İstersen tüm bunları bir yapay zekâyla sohbet ederek de
            yaparsın.
          </p>
        </div>
        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="bento reveal flex flex-col p-6">
              <div className="flex items-center gap-3">
                <span className="kbd tnum">{i + 1}</span>
                {i < steps.length - 1 && <span className="h-px flex-1 bg-linear-to-r from-line-strong to-transparent max-lg:hidden" aria-hidden="true" />}
              </div>
              <h3 className="mt-5 text-[16.5px] font-semibold tracking-[-0.01em] text-ink">{step.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{step.body}</p>
              <div className="mt-auto pt-6" aria-hidden="true" inert>
                {step.visual}
              </div>
            </li>
          ))}
        </ol>
        <p className="reveal mt-8 text-center text-[14.5px] text-ink-2">
          Uğraşmak istemiyor musun?{' '}
          <a href="#yapay-zeka" className="font-semibold text-forest underline-offset-4 hover:underline">
            Claude’a anlat, o kursun →
          </a>
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Yapay zekâ

function ToolCall({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-field px-2 py-1 font-mono text-[11.5px] text-ink-3">
      <Wrench className="size-3" />
      Yetişir · {name}
    </span>
  );
}

function ChatVisual({ preview }: { preview: LandingPreview }) {
  const { insights, stats, deadline, day, index, today } = preview;
  const left = day.total - day.done;
  const when = day.date === today ? 'bugün' : `${relativeDayLabel(day.date, today).toLocaleLowerCase('tr-TR')}`;
  const done = stats.completedVideos;
  const total = stats.totalVideos;
  const overdue = index.overdue.length;
  const spare = deadline.kind === 'on-track' ? deadline.spareDays : 0;
  const finish = deadline.kind === 'on-track' || deadline.kind === 'late' ? deadline.finishDate : stats.estimatedFinishDate;
  return (
    <div className="overflow-hidden rounded-[20px] border border-line-strong bg-card">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-[12.5px] text-ink-3">
        <Bot className="size-4 text-forest" />
        Claude · Yetişir bağlı
        <span className="ml-auto size-2 rounded-full bg-forest" />
      </div>
      <div className="space-y-4 px-4 py-5 sm:px-5">
        <p className="ml-auto w-fit max-w-[80%] rounded-[16px] rounded-br-[6px] bg-sunk px-4 py-2.5 text-[14px] text-ink">
          Nasıl gidiyorum? Beni değerlendir.
        </p>
        <div className="space-y-2">
          <ToolCall name="get_my_progress" />
          <p className="max-w-[92%] text-[14px] leading-relaxed text-ink-2">
            Kampında <span className="font-semibold text-ink">{done}/{total}</span> görev bitti, serin{' '}
            <span className="font-semibold text-ink">{insights.streak.current} gün</span>. {overdue > 0 ? `${overdue} görev geride kaldı; ` : ''}
            {when} {left} görevle günü kapatırsın. Bu tempoyla plan {formatLongDate(finish)} tarihinde bitiyor
            {spare > 0 ? `, hedeften ${spare} gün önce` : ''}: <span className="font-semibold text-forest">panik yok, yetişir.</span>
          </p>
        </div>
        <p className="ml-auto w-fit max-w-[80%] rounded-[16px] rounded-br-[6px] bg-sunk px-4 py-2.5 text-[14px] text-ink">
          Fizik için şu oynatma listesinden 3 ayda bitecek bir kamp kuralım.
        </p>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <ToolCall name="read_youtube_playlist" />
            <ToolCall name="send_camp · dryRun" />
          </div>
          <p className="max-w-[92%] text-[14px] leading-relaxed text-ink-2">
            Listeyi okudum ve kampı hazırladım. Günde 2 saat ve 1,5x hızla hedefinden önce bitiyor. Onaylarsan planına ekliyorum.
          </p>
          <span className="btn btn-primary btn-sm">Ekle</span>
        </div>
      </div>
    </div>
  );
}

const CLIENTS = ['Claude', 'ChatGPT', 'Gemini'];

export function AiSection({ preview }: { preview: LandingPreview }) {
  return (
    <section id="yapay-zeka" aria-labelledby="yapay-zeka-baslik" className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 sm:py-32">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="reveal">
          <p className="section-eyebrow">
            <Bot aria-hidden="true" />
            Yapay zekâ ile
          </p>
          <h2 id="yapay-zeka-baslik" className="section-title text-gradient mt-4">
            “Nasıl gidiyorum?” diye sor.
          </h2>
          <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-ink-2">
            Claude, ChatGPT ya da Gemini’yi hesabına bağla. İlerlemeni, serini ve erteleme nedenlerini okuyup seni değerlendirsin; roadmap’ini
            sohbette birlikte kurun, onayınla planına eklesin.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {CLIENTS.map(client => (
              <li key={client} className="chip">
                <Check className="text-forest" />
                {client}
              </li>
            ))}
          </ul>
          <ul className="mt-7 space-y-3 text-[14.5px] text-ink-2">
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
              Bağlantıyı sen onaylarsın; yapay zekâ yalnızca kendi planını görür, hiçbir şey silemez.
            </li>
            <li className="flex gap-3">
              <ListVideo className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
              Videolar YouTube’dan gerçek süreleriyle okunur; uydurma bir ders plana giremez.
            </li>
          </ul>
          <a href={APP_PATH} className="btn btn-secondary mt-8 group">
            Profil sayfandan bağla
            <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </div>
        <figure className="reveal">
          <div aria-hidden="true" inert>
            <ChatVisual preview={preview} />
          </div>
          <figcaption className="mt-2 text-center text-[12.5px] text-ink-3">Örnek sohbet; ilk cevaptaki sayılar demo kampından.</figcaption>
        </figure>
      </div>
    </section>
  );
}
