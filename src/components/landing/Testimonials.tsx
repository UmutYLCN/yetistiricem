import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, MessageSquareQuote, Quote } from 'lucide-react';
import { APP_PATH } from '../../lib/routes';

// Deliberate placeholders for the design review, never presented as real endorsements.
const EXAMPLE_REVIEWS = [
  {
    quote: 'Listeye bakıp nereden başlayacağımı düşünmek yerine, bugün önümdeki tek adıma bakıyorum.',
    context: 'Sıfırdan bir yol haritası',
    initial: '01',
  },
  {
    quote: 'Bir gün aksadığında her şeyi baştan kurmak zorunda olmamak, devam etmeyi kolaylaştırıyor.',
    context: 'Kendi hızında öğrenme',
    initial: '02',
  },
  {
    quote: 'Ne zaman biteceğini en baştan görmek iyi geliyor. Hedef artık kocaman bir belirsizlik değil.',
    context: 'Yoğun bir kamp',
    initial: '03',
  },
  {
    quote: 'Farklı yerlerde duran listeleri tek bir güne sığdırmak. Tam ihtiyacım olan düzen bu.',
    context: 'Birden fazla hedef',
    initial: '04',
  },
  {
    quote: 'Her gün biraz zaman ayırıp ilerlediğimi görmek, yarım bıraktığım seriye geri dönmemi sağlıyor.',
    context: 'Günlük bir alışkanlık',
    initial: '05',
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
            Birlikte ilerliyoruz
          </p>
          <h2 id="yorumlar-baslik" className="section-title mt-4">
            Küçük adımlar.
            <br />
            <span className="text-ink-3">Yeni başlangıçlar.</span>
          </h2>
        </div>
        <div className="testimonials-heading-right">
          <p>Her hedefin arkasında bir hikâye var.</p>
          <p className="testimonials-disclosure">Tasarım önizlemesi · Aşağıdaki yorumlar örnektir.</p>
          <div className="flex gap-2">
            <button type="button" className="landing-icon-button" disabled={edges.start} aria-label="Önceki yorum" onClick={() => move(-1)}>
              <ArrowLeft aria-hidden="true" />
            </button>
            <button type="button" className="landing-icon-button" disabled={edges.end} aria-label="Sonraki yorum" onClick={() => move(1)}>
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <ul
        ref={track}
        className="testimonials-track"
        tabIndex={0}
        aria-label="Örnek yorumlar, sağa kaydırılabilir"
        onScroll={(event) => {
          const element = event.currentTarget;
          setEdges({ start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
        }}
      >
        {EXAMPLE_REVIEWS.map((review, i) => (
          <li key={review.initial} className={`testimonial-card sketch-tone-${i % 3}`}>
            <div className="flex items-center justify-between">
              <Quote className="testimonial-quote-icon" aria-hidden="true" />
              <span className="art-sample-label">Örnek yorum</span>
            </div>
            <blockquote>“{review.quote}”</blockquote>
            <div className="testimonial-person">
              <span aria-hidden="true">{review.initial}</span>
              <div>
                <p>Örnek kullanıcı</p>
                <small>{review.context}</small>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="testimonials-bottom">
        <p>Senin hikâyen de bir adımla başlar.</p>
        <a href={APP_PATH}>
          Kendi ritmini bul <ArrowRight aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
