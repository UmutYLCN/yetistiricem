import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, MessageSquareQuote, Quote } from 'lucide-react';
import { APP_PATH } from '../../lib/routes';
import { msg } from '../../lib/messages';


// Fictional sample quotes and identities for the landing page until real testimonials are available.
const EXAMPLE_REVIEWS = [
  {
    quote: 'Listeye bakıp nereden başlayacağımı düşünmek yerine, bugün önümdeki tek adıma bakıyorum.',
    context: 'Sıfırdan bir yol haritası',
    name: 'Sinem Aydın',
    initial: 'SA',
  },
  {
    quote: 'Bir gün aksadığında her şeyi baştan kurmak zorunda olmamak, devam etmeyi kolaylaştırıyor.',
    context: 'Kendi hızında öğrenme',
    name: 'Duru Koç',
    initial: 'DK',
  },
  {
    quote: 'Ne zaman biteceğini en baştan görmek iyi geliyor. Hedef artık kocaman bir belirsizlik değil.',
    context: 'Yoğun bir kamp',
    name: 'Emre Demir',
    initial: 'ED',
  },
  {
    quote: 'Farklı yerlerde duran listeleri tek bir güne sığdırmak. Tam ihtiyacım olan düzen bu.',
    context: 'Birden fazla hedef',
    name: 'Aslı Yılmaz',
    initial: 'AY',
  },
  {
    quote: 'Her gün biraz zaman ayırıp ilerlediğimi görmek, yarım bıraktığım seriye geri dönmemi sağlıyor.',
    context: 'Günlük bir alışkanlık',
    name: 'Mert Kaya',
    initial: 'MK',
  },
];

export function Testimonials() {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const move = (direction: number) => {
    const element = track.current;
    if (!element) return;
    const step = (element.firstElementChild?.getBoundingClientRect().width ?? 350) + 16;
    element.scrollBy({
      left: direction * step,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };
  return (
    <section aria-labelledby="yorumlar-baslik" className="testimonials-section">
      <div className="testimonials-heading">
        <div>
          <p className="section-eyebrow">
            <MessageSquareQuote aria-hidden="true" />
            {msg("\n            Birlikte ilerliyoruz\n          ")}</p>
          <h2 id="yorumlar-baslik" className="section-title mt-4">
            {msg("\n            Küçük adımlar.\n            ")}<br />
            <span className="text-ink-3">{msg("Yeni başlangıçlar.")}</span>
          </h2>
        </div>
        <div className="testimonials-heading-right">
          <p>{msg("Her hedefin arkasında bir hikâye var.")}</p>
          <p className="testimonials-disclosure">{msg("Tanıtım için kurgulanmış isimler ve yorumlar.")}</p>
          <div className="flex gap-2">
            <button type="button" className="landing-icon-button" disabled={edges.start} aria-label={msg("Önceki yorum")} onClick={() => move(-1)}>
              <ArrowLeft aria-hidden="true" />
            </button>
            <button type="button" className="landing-icon-button" disabled={edges.end} aria-label={msg("Sonraki yorum")} onClick={() => move(1)}>
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <ul
        ref={track}
        className="testimonials-track"
        tabIndex={0}
        aria-label={msg("Kullanıcı yorumları, sağa kaydırılabilir")}
        onScroll={event => {
          const element = event.currentTarget;
          setEdges({ start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
        }}
      >
        {EXAMPLE_REVIEWS.map((review, i) => (
          <li key={review.initial} className={`testimonial-card sketch-tone-${i % 3}`}>
            <div className="flex items-center justify-between">
              <Quote className="testimonial-quote-icon" aria-hidden="true" />
            </div>
            <blockquote>{msg("“")}{msg(review.quote)}{msg("”")}</blockquote>
            <div className="testimonial-person">
              <span aria-hidden="true">{review.initial}</span>
              <div>
                <p>{review.name}</p>
                <small>{msg(review.context)}</small>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="testimonials-bottom">
        <p>{msg("Senin hikâyen de bir adımla başlar.")}</p>
        <a href={APP_PATH}>
          {msg("\n          Kendi ritmini bul ")}<ArrowRight aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
