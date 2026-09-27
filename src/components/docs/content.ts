import type { ReactNode } from 'react';
import { Account, AiOverview, CampJson, CampWizard, ChatGptDoc, ClaudeDoc, Daily, Focus, GeminiDoc, Kesfet, Overview, Progress, QuickStart, Reschedule, Sources, Tempo } from './pages';

// Every docs page, in sidebar order. `slug` is the address under /docs ('' is
// the overview); `keywords` feed the search box; the text is in `pages.tsx`.

export interface DocPage {
  slug: string;
  group: string;
  title: string;
  description: string;
  keywords?: string;
  Body: () => ReactNode;
}

export const DOC_PAGES: DocPage[] = [
  { slug: '', group: 'Başlangıç', title: 'Yetişir nedir?', description: 'Ders videolarını günlük ritmine göre dağıtan çalışma planlayıcı.', keywords: 'giriş kavram kamp branş görev', Body: Overview },
  { slug: 'hizli-baslangic', group: 'Başlangıç', title: 'Hızlı başlangıç', description: 'Hesabını aç, ilk kampını birkaç dakikada kur.', keywords: 'hesap kayıt başla ilk', Body: QuickStart },
  { slug: 'kamp-olusturma', group: 'Kamplar', title: 'Kamp oluşturma', description: 'Sihirbazın dört adımı, branş eklemek ve birden fazla kamp.', keywords: 'sihirbaz yeni kamp tüm kamplar branş ekle', Body: CampWizard },
  { slug: 'kaynaklar', group: 'Kamplar', title: 'Branşlar ve kaynaklar', description: 'Oynatma listesi, video bağlantıları ve elle eklenen konular.', keywords: 'youtube playlist oynatma listesi video konu zil bildirim', Body: Sources },
  { slug: 'tempo', group: 'Kamplar', title: 'Tempo ve ritim', description: 'Günlük süre, hız, tekrar payı, otomatik ya da elle dağıtım, hedef tarih.', keywords: 'hız süre hedef tarih yetişir mi deneme dinlenme', Body: Tempo },
  { slug: 'bugun', group: 'Her gün', title: 'Rotam', description: 'Günün görevleri: liste ya da yol, ve haftanın rotası.', keywords: 'rotam bugün görev işaretle yol liste hafta rotası haftalık', Body: Daily },
  { slug: 'ritmi-guncelle', group: 'Her gün', title: 'Ritmi güncelle', description: 'Geride kaldığında görevleri suçluluk duymadan yeniden dağıt.', keywords: 'erteleme ileri taşı geciken neden öneri kritik', Body: Reschedule },
  { slug: 'focus', group: 'Her gün', title: 'Yetişir Focus', description: 'Videoları önerisiz, dikkat dağıtmayan bir oynatıcıda izle.', keywords: 'odak oynatıcı video izle', Body: Focus },
  { slug: 'ilerleme', group: 'İlerleme', title: 'İlerleme ekranı', description: 'Seri, sorumluluk skoru, ısı haritası ve erteleme analizi.', keywords: 'seri streak skor ısı haritası istatistik', Body: Progress },
  { slug: 'kesfet', group: 'Keşfet ve paylaşım', title: 'Keşfet ve paylaşım', description: 'Kamp yayınlamak, başkalarının kampını eklemek, paylaşım linkleri.', keywords: 'yayınla paylaş link kopyala', Body: Kesfet },
  { slug: 'yapay-zeka', group: 'Yapay zekâ', title: 'Genel bakış', description: 'Claude, ChatGPT ya da Gemini’yi hesabına bağla.', keywords: 'mcp ai yapay zeka bağlan claude chatgpt gemini güvenlik', Body: AiOverview },
  { slug: 'claude', group: 'Yapay zekâ', title: 'Claude', description: 'Claude’u Yetişir’e bağla.', keywords: 'anthropic connector bağlayıcı', Body: ClaudeDoc },
  { slug: 'chatgpt', group: 'Yapay zekâ', title: 'ChatGPT', description: 'ChatGPT’yi Yetişir’e bağla.', keywords: 'openai connector geliştirici modu', Body: ChatGptDoc },
  { slug: 'gemini', group: 'Yapay zekâ', title: 'Gemini', description: 'Gemini CLI’ı Yetişir’e bağla.', keywords: 'google cli settings.json', Body: GeminiDoc },
  { slug: 'kamp-json', group: 'Yapay zekâ', title: 'Kamp JSON formatı', description: 'Yapay zekânın kamp yazarken uyduğu biçim ve sınırlar.', keywords: 'json send_camp format sınır şema', Body: CampJson },
  { slug: 'hesap', group: 'Hesap', title: 'Hesap ve veriler', description: 'Senkron, profil, yedek, sıfırlama ve demo.', keywords: 'senkron cihaz yedek sıfırla çıkış profil', Body: Account },
];
