import { useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Coffee,
  Compass,
  Flag,
  FolderKanban,
  GraduationCap,
  Layers,
  Link2,
  ListVideo,
  Map,
  NotebookPen,
  Pause,
  Play,
  Repeat2,
  Route,
  Sparkles,
  Timer,
  TrendingUp,
  Video,
  Zap,
} from 'lucide-react';
import { msg } from '../../lib/messages';


const GOALS = [
  { label: 'Yoğun kamplar', icon: Zap },
  { label: 'Dönemlik dersler', icon: CalendarDays },
  { label: 'Günlük alışkanlıklar', icon: Coffee },
  { label: 'Sıfırdan yol haritaları', icon: Map },
  { label: 'Kapsamlı seriler', icon: BookOpen },
  { label: 'Kendi hızında öğrenme', icon: Route },
  { label: 'Uzun oynatma listeleri', icon: ListVideo },
  { label: 'Kısa video serileri', icon: Video },
  { label: 'Düzenli tekrarlar', icon: Repeat2 },
  { label: 'Yarım kalan hedefler', icon: Flag },
  { label: 'Kişisel meraklar', icon: Sparkles },
  { label: 'Bağımsız müfredatlar', icon: Compass },
  { label: 'Akademik çalışmalar', icon: GraduationCap },
  { label: 'Yeni beceriler', icon: TrendingUp },
  { label: 'Karma ders listeleri', icon: Layers },
  { label: 'YouTube dışı konular', icon: NotebookPen },
  { label: 'Hızlı tekrar kampları', icon: Timer },
  { label: 'Dağınık listeleri toparlama', icon: FolderKanban },
  { label: 'Farklı kanallardan dersler', icon: Link2 },
  { label: 'Kendi yol haritan', icon: Map },
];

export function Goals() {
  const [paused, setPaused] = useState(false);
  return (
    <section aria-labelledby="hedefler-baslik" className="learning-section">
      <div className="learning-heading">
        <div>
          <p className="section-eyebrow">{msg("Ne öğrenirsen öğren")}</p>
          <h2 id="hedefler-baslik">{msg("Hedefin sana özel. Ritmin de öyle.")}</h2>
        </div>
        <button
          type="button"
          className="landing-icon-button marquee-control"
          aria-label={paused ? msg("Kayan listeyi oynat") : msg("Kayan listeyi duraklat")}
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </button>
      </div>
      <div className="learning-marquees" data-paused={paused}>
        {[GOALS.slice(0, 10), GOALS.slice(10)].map((row, rowIndex) => (
          <div className="learning-marquee" key={rowIndex}>
            <div className="learning-track">
              {[0, 1].map((copy) => (
                <ul key={copy} className="learning-group" aria-hidden={copy === 1 ? true : undefined}>
                  {row.map(({ label, icon: Icon }) => (
                    <li key={label}>
                      <Icon aria-hidden="true" />
                      {msg(label)}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
