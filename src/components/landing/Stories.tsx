import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  CircleCheck,
  Link2,
  ListChecks,
  ListVideo,
  MessageCircleQuestion,
  PencilLine,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { formatHours, formatLongDate, formatShortDate, formatSpeed } from '../../lib/format';
import type { LandingPreview } from '../../lib/landingPreview';
import { APP_PATH, docsHref } from '../../lib/routes';
import { BrandMark, Wordmark } from '../ui/BrandMark';
import { AiLogo as ClientLogo } from '../ui/AiLogos';
import { AI_CLIENTS, aiClientName } from '../../lib/aiClients';
import type { AiClient } from '../../lib/aiClients';
import { RhythmVisual, Skeleton, SketchRow } from './Illustrations';
import { msg } from '../../lib/messages';


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
            {msg("\n            En çok sorulan soru\n          ")}</p>
          <h2 id="soru-baslik" className="section-title text-gradient mt-4">
            {msg("\n            “Yetişir mi?” sorusuna takvimle cevap.\n          ")}</h2>
          <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-ink-2">
            {msg("\n            Sınava, mülakata ya da yeni bir hedefe hazırlanırken akıldaki soru hep aynı. Yetişir videolarının gerçek süresini, izleme hızını\n            ve günlük vaktini hesaplar, hangi gün biteceğini gösterir.\n          ")}</p>
        </div>
        <div className="relative" aria-hidden="true" inert>
          <ul className="space-y-2.5">
            {QUESTIONS.map((q, i) => (
              <li
                key={q}
                className="w-fit max-w-[85%] rounded-[16px] rounded-bl-[6px] border border-line bg-card px-4 py-2.5 text-[14.5px] text-ink-2"
                style={{ marginLeft: `${i * 6}%` }}
              >
                {msg(q)}
              </li>
            ))}
          </ul>
          <div className="mt-5 ml-auto max-w-[88%] rounded-[18px] rounded-br-[6px] border border-forest/40 bg-forest-soft p-4">
            <p className="flex items-center gap-2 text-[17px] font-semibold text-ink">
              <CircleCheck className="size-5 text-forest" />
              {msg("\n              Panik yok, yetişir.\n            ")}</p>
            <p className="tnum mt-1.5 text-[14px] text-ink-2">
              {msg("\n              Kalan ")}{formatHours(stats.totalMinutes)}{msg(", günde ")}{prefs.dailyStudyHours} {msg(" saat, ")}{formatSpeed(prefs.playbackSpeed)} {msg(" hızla: son\n              görev ")}<span className="font-semibold text-ink">{formatLongDate(finish)}</span>{msg(".\n            ")}</p>
            <p className="mt-2 text-[12px] text-ink-3">{msg("Demo kampının gerçek hesabı")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// The walkthrough changes only this illustration, never planner data.
const STEPS = [
  {
    label: 'Kaynaklar',
    title: 'Nereden öğrenmek istersin?',
    body: 'Bir oynatma listesi, farklı videolar ya da kendi konuların. Kaynaklarını ekle; içerikler ve süreleri bir araya gelsin.',
    hint: 'Oynatma listesi · Video bağlantıları · Kendi konuların',
  },
  {
    label: 'Kampın',
    title: 'Bu başlangıca bir isim ver.',
    body: 'Kampını adlandır, başlangıç gününü seç. Aklında bir bitiş tarihi varsa onu da ekle; yetişip yetişmediğini birlikte görelim.',
    hint: 'Hedef tarihi eklemek tamamen sana bağlı.',
  },
  {
    label: 'Ritmin',
    title: 'Hayatına uyan bir tempo.',
    body: 'Günlük vaktini, izleme hızını ve çalışma günlerini seç. Branşları otomatik dağıt ya da haftanı kendin şekillendir.',
    hint: 'Dinlenme günleri de plana dahil.',
  },
  {
    label: 'Planın',
    title: 'Önündeki yol artık belli.',
    body: 'Günlük programını ve tahmini bitişini incele. İçine sindiğinde kaydet; sonra sadece bugünün adımını at.',
    hint: 'Kaydetmeden önce her şeyi önizleyebilirsin.',
  },
];

function WizardIllustration({ step, preview }: { step: number; preview: LandingPreview }) {
  if (step === 0)
    return (
      <div className="wizard-source-art">
        <div className="wizard-source-options">
          {[
            { icon: ListVideo, label: 'Oynatma listesi' },
            { icon: Link2, label: 'Videolar' },
            { icon: PencilLine, label: 'Konular' },
          ].map(({ icon: Icon, label }, i) => (
            <span key={label} data-active={i === 0}>
              <Icon />
              <span>{msg(label)}</span>
            </span>
          ))}
        </div>
        <div className="sketch-panel wizard-source-panel">
          <div className="sketch-toolbar">
            <Link2 />
            <Skeleton width="65%" />
            <span className="sketch-action">
              <ArrowRight />
            </span>
          </div>
          <div className="sketch-list">
            {preview.camp.branches[0].videos.slice(0, 3).map((video, i) => (
              <SketchRow key={video.id} minutes={video.durationMinutes} tone={i} />
            ))}
          </div>
          <div className="sketch-footer">
            <Check className="text-forest" />
            <span>{msg("Kaynakların hazır")}</span>
          </div>
        </div>
      </div>
    );
  if (step === 1)
    return (
      <div className="wizard-camp-art">
        <div className="sketch-panel wizard-camp-back">
          <CalendarDays />
          <Skeleton width="45%" />
          <Skeleton width="65%" />
        </div>
        <div className="sketch-panel wizard-camp-panel">
          <span className="art-meta">{msg("Kampının adı")}</span>
          <div className="wizard-fake-input">
            {msg("\n            Yeni başlangıcım\n            ")}<span className="wizard-caret" />
          </div>
          <div className="wizard-camp-dates">
            <div>
              <span>{msg("Başlangıç")}</span>
              <p>
                <CalendarDays />
                {formatShortDate(preview.today)}
              </p>
            </div>
            <div>
              <span>{msg("Hedef tarihi")}</span>
              <p>
                <CalendarDays />
                {preview.camp.schedule.targetEndDate ? formatShortDate(preview.camp.schedule.targetEndDate) : msg("İsteğe bağlı")}
              </p>
            </div>
          </div>
          <div className="wizard-camp-footer">
            <BrandMark size={28} />
            <Skeleton width="48%" />
            <span className="glow-check ml-auto">
              <Check />
            </span>
          </div>
        </div>
      </div>
    );
  if (step === 2)
    return (
      <div className="wizard-rhythm-art">
        <div className="wizard-tempo">
          <span>
            <strong>{preview.prefs.dailyStudyHours} {msg(" sa")}</strong>{msg("günlük süre\n          ")}</span>
          <span>
            <strong>{formatSpeed(preview.prefs.playbackSpeed)}</strong>{msg("izleme hızı\n          ")}</span>
          <span>
            <strong>{msg("%")}{Math.round(preview.prefs.practiceMultiplier * 100)}</strong>{msg("tekrar payı\n          ")}</span>
        </div>
        <RhythmVisual preview={preview} />
      </div>
    );
  return (
    <div className="wizard-ready-art">
      <span className="glow-check wizard-ready-check">
        <Check />
      </span>
      <p className="wizard-ready-title">{msg("Panik yok, yetişir.")}</p>
      <p className="text-[13px] text-ink-3">{msg("Örnek kampın hazır.")}</p>
      <div className="sketch-panel wizard-ready-panel">
        <div>
          <span>{msg("Tahmini bitiş")}</span>
          <strong>{formatLongDate(preview.stats.estimatedFinishDate)}</strong>
        </div>
        <div>
          <span>{msg("Günlük ritmin")}</span>
          <strong>
            {preview.prefs.dailyStudyHours} {msg(" saat · ")}{formatSpeed(preview.prefs.playbackSpeed)}
          </strong>
        </div>
        <div className="wizard-ready-timeline">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className={i === 6 ? '' : 'is-ready'}>
              {i === 6 ? <CalendarDays /> : <Check />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HowItWorks({ preview }: { preview: LandingPreview }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  return (
    <section id="nasil-calisir" aria-labelledby="nasil-calisir-baslik" className="walkthrough-section">
      <div className="walkthrough-inner">
        <div className="walkthrough-heading">
          <p className="section-eyebrow">
            <ListChecks aria-hidden="true" />
            {msg("\n            Nasıl çalışır\n          ")}</p>
          <h2 id="nasil-calisir-baslik" className="section-title mt-4">
            {msg("\n            Bir başlangıç.\n            ")}<br />
            <span className="text-ink-3">{msg("Dört küçük adım.")}</span>
          </h2>
          <p>{msg("Bir sonraki adıma geç. Planının nasıl oluştuğunu gör.")}</p>
        </div>
        <div className="walkthrough">
          <ol className="walkthrough-steps" aria-label={msg("Kurulum adımları")}>
            {STEPS.map((item, i) => (
              <li key={item.label}>
                <button
                  type="button"
                  aria-current={step === i ? 'step' : undefined}
                  aria-controls="walkthrough-panel"
                  onClick={() => setStep(i)}
                >
                  <span className="walkthrough-step-number">{i < step ? <Check aria-hidden="true" /> : `0${i + 1}`}</span>
                  <span>{msg(item.label)}</span>
                </button>
              </li>
            ))}
          </ol>
          <div id="walkthrough-panel" className="walkthrough-panel">
            <div className="walkthrough-copy">
              <div aria-live="polite" aria-atomic="true">
                <span className="walkthrough-count">{msg("ADIM 0")}{step + 1} {msg(" / 04")}</span>
                <h3>{msg(current.title)}</h3>
                <p>{msg(current.body)}</p>
                <span className="walkthrough-hint">
                  <Check aria-hidden="true" />
                  {msg(current.hint)}
                </span>
              </div>
              <div className="walkthrough-controls">
                <button
                  type="button"
                  className="landing-icon-button"
                  aria-label={msg("Önceki adım")}
                  disabled={step === 0}
                  onClick={() => setStep((value) => value - 1)}
                >
                  <ArrowLeft aria-hidden="true" />
                </button>
                {step < 3 ? (
                  <button type="button" className="landing-nav-cta" onClick={() => setStep((value) => value + 1)}>
                    {msg("\n                    İleri\n                    ")}<ArrowRight aria-hidden="true" />
                  </button>
                ) : (
                  <a href={APP_PATH} className="landing-nav-cta">
                    {msg("\n                    Planımı kur\n                    ")}<ArrowRight aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
            <div key={step} className="walkthrough-art" aria-hidden="true" inert>
              <WizardIllustration step={step} preview={preview} />
            </div>
          </div>
        </div>
        <p className="walkthrough-alternative">
          {msg("\n          İstersen bir sohbetle de başla.")}{msg(" ")}
          <a href="#yapay-zeka">
            {msg("\n            Yapay zekânla birlikte kur ")}<ArrowRight aria-hidden="true" />
          </a>
        </p>
      </div>
    </section>
  );
}

function ChatVisual({ preview, client }: { preview: LandingPreview; client: AiClient }) {
  const { stats, insights, deadline } = preview;
  const finish = stats.estimatedFinishDate;
  return (
    <div className="ai-conversation" aria-hidden="true" inert>
      <div className="ai-conversation-top">
        <ClientLogo client={client} size={20} />
        <strong>{aiClientName(client)}</strong>
        <span className="ai-connected">
          <span />
          {msg("\n          yetişir bağlı\n        ")}</span>
      </div>
      <div className="ai-conversation-body" key={client}>
        <p className="ai-question">{msg("Nasıl gidiyorum? Birlikte bakalım mı?")}</p>
        <div className="ai-answer">
          <ClientLogo client={client} size={20} />
          <div>
            <p>{msg("Tabii. Planına ve ilerlemene baktım.")}</p>
            <div className="ai-progress-card">
              <div>
                <span>{msg("Tamamlanan")}</span>
                <strong>
                  {stats.completedVideos}
                  <small>{msg("/")}{stats.totalVideos}</small>
                </strong>
              </div>
              <div>
                <span>{msg("Çalışma serin")}</span>
                <strong>
                  {insights.streak.current}
                  <small> {msg(" gün")}</small>
                </strong>
              </div>
              <div className="ai-progress-track">
                <span style={{ width: `${stats.totalVideos ? (stats.completedVideos / stats.totalVideos) * 100 : 0}%` }} />
              </div>
              <p>
                <CircleCheck />
                {formatShortDate(finish)} {msg(" tarihinde bitiyor")}{deadline.kind === 'on-track' ? ` · ${deadline.spareDays} gün öndesin` : msg("")}
              </p>
            </div>
            <p className="ai-answer-note">
              {preview.index.overdue.length > 0
                ? `${preview.index.overdue.length} görev geride kalmış. Küçük bir adımla ritmini yeniden bulabilirsin.`
                : msg("Ritmin yerinde. Bugünün adımıyla devam edebilirsin.")}
            </p>
          </div>
        </div>
        <p className="ai-question">{msg("Bu oynatma listesinden de bir kamp kuralım.")}</p>
        <div className="ai-answer">
          <ClientLogo client={client} size={20} />
          <div>
            <p>{msg("Kaynaklarını okuyup sana uygun bir plan hazırlayabilirim. Eklemek için önce onayını alacağım.")}</p>
            <div className="ai-draft-card">
              <span className="ai-draft-icon">
                <ListVideo />
              </span>
              <div>
                <Skeleton width="110px" />
                <Skeleton width="75px" />
              </div>
              <span className="art-sample-label ml-auto">{msg("Kamp taslağı")}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="ai-compose">
        <span>{msg("Hedefini anlat…")}</span>
        <span>
          <Send />
        </span>
      </div>
      <p className="ai-example-label">{msg("Örnek sohbet · İlerleme sayıları demo kampından.")}</p>
    </div>
  );
}

export function AiSection({ preview }: { preview: LandingPreview }) {
  const [client, setClient] = useState<AiClient>('claude');
  return (
    <section id="yapay-zeka" aria-labelledby="yapay-zeka-baslik" className="ai-section">
      <div className="ai-heading">
        <p className="section-eyebrow">
          <Sparkles aria-hidden="true" />
          {msg("\n          Sevdiğin yapay zekâ, senin planın\n        ")}</p>
        <h2 id="yapay-zeka-baslik" className="section-title mt-4">
          {msg("\n          Sadece konuşma.\n          ")}<br />
          <span className="text-ink-3">{msg("Birlikte yol al.")}</span>
        </h2>
        <p>
          {msg("\n          Claude, ChatGPT veya Grok’u Yetişir’e bağla. İlerlemeni bilsin, planını birlikte kurun. “Nasıl gidiyorum?” sorunun artık bir\n          bağlamı var.\n        ")}</p>
      </div>
      <div className="ai-showcase">
        <div className="ai-connection">
          <div className="ai-clients" role="group" aria-label={msg("Örnek sohbetteki yapay zekâyı seç")}>
            {AI_CLIENTS.map((name) => (
              <button key={name} type="button" aria-pressed={client === name} onClick={() => setClient(name)}>
                <span>
                  <ClientLogo client={name} size={32} />
                </span>
                {aiClientName(name)}
              </button>
            ))}
          </div>
          <div className="ai-connection-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="ai-hub" aria-hidden="true">
            <BrandMark size={50} />
            <Wordmark className="text-[23px]" />
            <span className="ai-hub-status">
              <Check />
              {msg("\n              Senin planın\n            ")}</span>
          </div>
          <ul className="ai-capabilities">
            <li>
              <Bot aria-hidden="true" />
              <div>
                <strong>{msg("Seni ve ritmini tanısın")}</strong>
                <span>{msg("İlerlemen, serin ve erteleme nedenlerin sohbetin bir parçası olsun.")}</span>
              </div>
            </li>
            <li>
              <ListVideo aria-hidden="true" />
              <div>
                <strong>{msg("Birlikte bir yol haritası kurun")}</strong>
                <span>{msg("Gerçek YouTube içeriklerinden, sana uygun yeni bir kamp hazırlayın.")}</span>
              </div>
            </li>
            <li>
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>{msg("Kontrol hep sende")}</strong>
                <span>{msg("Bağlantıyı sen onaylarsın. Kamp eklerken onayını alır; mevcut planını silemez.")}</span>
              </div>
            </li>
          </ul>
          <a href={docsHref('yapay-zeka')} className="landing-nav-cta ai-connect-cta">
            {msg("\n            Yapay zekânı bağla\n            ")}<ArrowRight aria-hidden="true" />
          </a>
        </div>
        <ChatVisual preview={preview} client={client} />
      </div>
    </section>
  );
}
