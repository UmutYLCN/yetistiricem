import type { SubjectPlaylist } from '../types';
import { newId } from '../lib/camps';
import { defaultColorKey } from '../lib/subjects';

// Built-in demo templates: a sample order of TYT topics per subject.
//
// These are NOT any channel's playlist. They carry no video links, and each
// topic's minutes are fixed sample values so the plan looks the same on every
// load. They exist to preview the planner or to sketch a plan before adding
// real videos (a link can be added to each topic later).

interface TemplateSpec {
  id: string;
  title: string;
  subject: string;
  baseMinutes: number;
  topics: string[];
}

/** Fixed offsets so sample minutes vary a little but never randomly. */
const MINUTE_PATTERN = [0, 6, 3, 9, -3, 12, 4, 7];

const SPECS: TemplateSpec[] = [
  {
    id: 'demo-tyt-matematik',
    title: 'TYT Matematik konu sırası',
    subject: 'Matematik',
    baseMinutes: 40,
    topics: [
      'Temel Kavramlar',
      'Sayı Basamakları',
      'Bölme ve Bölünebilme',
      'EBOB – EKOK',
      'Rasyonel Sayılar',
      'Basit Eşitsizlikler',
      'Mutlak Değer',
      'Üslü Sayılar',
      'Köklü Sayılar',
      'Çarpanlara Ayırma',
      'Oran – Orantı',
      'Denklem Çözme',
      'Sayı Problemleri',
      'Yaş Problemleri',
      'Yüzde, Kâr – Zarar Problemleri',
      'Kümeler',
    ],
  },
  {
    id: 'demo-tyt-geometri',
    title: 'TYT Geometri konu sırası',
    subject: 'Geometri',
    baseMinutes: 42,
    topics: [
      'Doğruda ve Üçgende Açılar',
      'Dik Üçgen ve Pisagor',
      'İkizkenar ve Eşkenar Üçgen',
      'Üçgende Açıortay',
      'Üçgende Kenarortay',
      'Eşlik ve Benzerlik',
      'Üçgende Alan',
      'Çokgenler',
      'Dörtgenler',
      'Çember ve Daire',
      'Katı Cisimler',
      'Analitik Geometriye Giriş',
    ],
  },
  {
    id: 'demo-tyt-fizik',
    title: 'TYT Fizik konu sırası',
    subject: 'Fizik',
    baseMinutes: 36,
    topics: [
      'Fizik Bilimine Giriş',
      'Madde ve Özellikleri',
      'Hareket',
      'Newton’un Hareket Yasaları',
      'İş, Güç ve Enerji',
      'Isı ve Sıcaklık',
      'Basınç',
      'Kaldırma Kuvveti',
      'Elektrostatik',
      'Elektrik Akımı',
      'Manyetizma',
      'Dalgalar ve Optik',
    ],
  },
  {
    id: 'demo-tyt-kimya',
    title: 'TYT Kimya konu sırası',
    subject: 'Kimya',
    baseMinutes: 38,
    topics: [
      'Kimya Bilimi',
      'Atom ve Periyodik Sistem',
      'Kimyasal Türler Arası Etkileşimler',
      'Maddenin Halleri',
      'Doğa ve Kimya',
      'Kimyanın Temel Kanunları',
      'Mol Kavramı',
      'Kimyasal Tepkimeler',
      'Karışımlar',
      'Asitler, Bazlar ve Tuzlar',
    ],
  },
  {
    id: 'demo-tyt-biyoloji',
    title: 'TYT Biyoloji konu sırası',
    subject: 'Biyoloji',
    baseMinutes: 34,
    topics: [
      'Canlıların Ortak Özellikleri',
      'Canlıların Temel Bileşenleri',
      'Hücre ve Organeller',
      'Hücre Zarından Madde Geçişi',
      'Canlıların Sınıflandırılması',
      'Mitoz ve Eşeysiz Üreme',
      'Mayoz ve Eşeyli Üreme',
      'Kalıtım',
      'Ekosistem Ekolojisi',
      'Güncel Çevre Sorunları',
    ],
  },
  {
    id: 'demo-tyt-turkce',
    title: 'TYT Türkçe konu sırası',
    subject: 'Türkçe',
    baseMinutes: 40,
    topics: [
      'Sözcükte Anlam',
      'Cümlede Anlam',
      'Paragrafta Anlam',
      'Ses Bilgisi',
      'Yazım Kuralları',
      'Noktalama İşaretleri',
      'İsim ve Sıfat',
      'Zamir ve Zarf',
      'Fiil ve Ek Fiil',
      'Fiilimsiler',
      'Cümlenin Ögeleri',
      'Anlatım Bozuklukları',
    ],
  },
];

function build(spec: TemplateSpec): SubjectPlaylist {
  const videos = spec.topics.map((topic, i) => ({
    id: `${spec.id}-${String(i + 1).padStart(2, '0')}`,
    title: `${i + 1}. ${topic}`,
    durationMinutes: spec.baseMinutes + MINUTE_PATTERN[i % MINUTE_PATTERN.length],
    videoUrl: '',
    thumbnailUrl: '',
    completed: false,
  }));
  return {
    id: spec.id,
    title: spec.title,
    subject: spec.subject,
    channelName: 'Demo şablon',
    playlistUrl: '',
    videos,
    colorTag: defaultColorKey(spec.subject),
    totalDurationMinutes: videos.reduce((acc, v) => acc + v.durationMinutes, 0),
    source: 'demo-template',
  };
}

export const DEMO_TEMPLATES: SubjectPlaylist[] = SPECS.map(build);

/** A copy with the template's own ids (the in-memory demo preview). */
export function cloneTemplate(template: SubjectPlaylist): SubjectPlaylist {
  return { ...template, videos: template.videos.map(v => ({ ...v })) };
}

/**
 * A copy with fresh branch and video ids, for adding a template to a camp:
 * the same template may sit in several camps without sharing ids or progress.
 */
export function instantiateTemplate(template: SubjectPlaylist): SubjectPlaylist {
  const id = newId('branch');
  return {
    ...template,
    id,
    videos: template.videos.map((v, i) => ({ ...v, id: `${id}-v${String(i + 1).padStart(2, '0')}` })),
  };
}
