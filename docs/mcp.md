# Yapay zekâ bağlantısı (MCP)

Yetişir bir [Model Context Protocol](https://modelcontextprotocol.io) sunucusu sunar. Claude, ChatGPT ya da Gemini hesabına bağlandığında:

- **Seni değerlendirir:** “Nasıl gidiyorum?” dediğinde kamplarındaki ilerlemeni, geciken görevlerini, serini, planlı gününde bitirme oranını ve erteleme nedenlerini okuyup yorumlar.
- **Roadmap'i birlikte kurarsınız:** sohbette hedefini, süreni ve oynatma listelerini konuşursunuz; yapay zekâ kampı bizim JSON formatımızda yazar, kontrol eder ve senin onayınla planına ekler.

Adres: **`https://yetistiricem.pages.dev/mcp`** (Streamable HTTP, OAuth ile giriş).

## Bağlama

Bağlayıcıyı eklediğinde tarayıcıda Yetişir'in onay sayfası (`/oauth/consent`) açılır: giriş yapar, “İzin ver”e basarsın. Bağlı uygulamaları Yetişir’de **Profil ve ayarlar → Yapay zekâ bağlantıları** bölümünde logolarıyla görür (bağlı olanın çerçevesi yeşil), istediğini oradan kaldırırsın. Kullanıcıya yönelik adım adım rehber sitenin belgelerinde: `/docs/yapay-zeka`, `/docs/claude`, `/docs/chatgpt`, `/docs/gemini`, `/docs/kamp-json`.

- **Claude (claude.ai, masaüstü, mobil):** Ayarlar → Connectors → *Add custom connector* → ad `Yetişir`, URL yukarıdaki adres → *Connect*.
- **Claude Code:** `claude mcp add --transport http yetistiricem https://yetistiricem.pages.dev/mcp`, sonra `/mcp` ile giriş.
- **ChatGPT:** **Eklentiler → Ekle → MCP uygulaması oluştur**. Ad `Yetişir`, bağlantı türü *Sunucu URL'si*, adres yukarıdaki `/mcp` URL'si, kimlik doğrulama *OAuth*. Simge isteğe bağlıdır; gelişmiş OAuth ayarlarını otomatik bırak. Güven uyarısını kabul edip oluşturunca Yetişir'in izin sayfası açılır: doğru hesapla giriş yaptığını kontrol edip **İzin ver**'e bas. ChatGPT'ye döndüğünde gerekirse **Kişisel** eklentilerden Yetişir'i ekle; **Work** sohbetinde `@Yetişir` seç. Menü görünmüyorsa **Ayarlar → Security and login → Developer mode** ayarını kontrol et. Araç ve yazma izni ChatGPT hesabındaki erişime bağlıdır; ekleme ekranının görünmesi `send_camp` aracının çalışacağını tek başına doğrulamaz. [OpenAI kurulum rehberi](https://developers.openai.com/plugins/quickstart), [erişim koşulları](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt).
- **Gemini web:** **Settings → Connected Apps → Custom apps → Add a custom app** içinden yukarıdaki `/mcp` adresini gir; bağlandıktan sonra sohbette `@Yetişir` seç. Google bu özelliği şu anda ABD'de, İngilizce kullanan, etkinlik geçmişi açık kişisel hesaplarla sınırlıyor; Türkiye'deki kullanıcılar için genel bağlantı yolu olarak sunulmamalı. [Google koşulları](https://support.google.com/gemini/answer/17209137?co=GENIE.Platform%3DDesktop&hl=en-GA).
- **Gemini CLI:** `~/.gemini/settings.json` içine `{ "mcpServers": { "yetisir": { "httpUrl": "https://yetistiricem.pages.dev/mcp" } } }`, sonra `/mcp auth yetisir`. CLI OAuth dönüşünde `iss` parametresini zorunlu tutar; kimlik doğrulama başarısızsa bunu ayrıca kontrol et. [Gemini CLI rehberi](https://geminicli.com/docs/tools/mcp-server/).

## Araçlar

| Araç | Ne yapar |
| --- | --- |
| `get_my_progress` | Her kampın ilerlemesi (tamamlanan/toplam, kalan saat, geciken, bugünkü görevler, tahmini bitiş ve hedef tarih), seri, son 7 gün, çalışılan saat, planlı gününde bitirme oranı, erteleme sayısı ve nedenleri, odak modu, son gün notları. |
| `get_my_plan` | Bugünden (ya da verilen günden) en çok 14 günün görevleri, tüm kamplar birlikte; önce gecikenler. |
| `get_camp_format` | Kamp JSON'unun şeması, sınırları ve örneği. |
| `send_camp` | Kamp JSON'unu kontrol eder ve planına ekler (yeni kamp açık kamp olur, bugün başlar). `dryRun` ile yalnızca kontrol edip bitiş tarihini gösterir. |
| `read_youtube_playlist`, `read_youtube_videos` | Oynatma listesi ya da videoların gerçek başlık, id ve süreleri; uygulamanın atladıkları nedeniyle. |
| `search_kesfet`, `get_kesfet_camp`, `add_kesfet_camp` | Keşfet'te arar, bir kampın içine bakar, kopyasını planına ekler (başkasının kampı olarak işaretli, yayınlanamaz). |

## Kamp JSON'u

Paylaşım linkindeki `camp` belgesi ([camp-share-link.md](camp-share-link.md)), uygulamanın kendi formlarındaki sınırlarla (kaynak: `server/mcp/campFormat.ts`):

- `name` 1–80 karakter; `branches` 1–40, her birinde en az bir video; toplam en çok 5.000 video ve konu.
- `subject` (branş adı) 1–40, video/konu başlığı 1–200, kanal en çok 120 karakter; `minutes` 0'dan büyük, en çok 600.
- `youtubeId` 11 karakterlik video id'si; yoksa öğe linksiz konudur. `playlistId` yalnızca branş listenin tamamını tutuyorsa (her gün yeni videolar için kontrol edilir).
- `schedule`: `mode` `auto` (`activeDays` en az bir gün, `maxSubjectsPerDay` 1–10) ya da `manual` (`weekPlan`: pazardan başlayan yedi liste, 0 tabanlı branş sıraları; her branş en az bir günde). `dailyStudyHours` 0,5–16; `playbackSpeed` 1 / 1,25 / 1,5 / 1,75 / 2; `practiceMultiplier` 0 / 0,1 / 0,2 / 0,3 / 0,5 / 0,75 / 1; `mockExamDays` çalışma günleriyle çakışmaz.
- Kamp her zaman eklendiği gün başlar; JSON'da başlangıç ya da hedef tarih yoktur.

Her sorun yoluyla birlikte bildirilir (`camp.branches[2].videos[5].youtubeId: …`); yapay zekâ düzeltip yeniden gönderir, yarım kamp eklenmez.

## Kurallar

- **Veri uydurulmaz.** Kamptaki her YouTube videosu sunucuda YouTube Data API ile sorulur: başlık, kanal ve süre YouTube'dan gelir. YouTube'un döndürmediği, gizli, silinmiş, canlı, branşta tekrar eden, 10 saatten uzun ya da Türkiye'de engelli bir video kampı reddettirir.
- **Yalnızca kendi verin.** Sunucu servis anahtarı tutmaz; her okuma ve yazma senin OAuth token'ınla Supabase'e gider, RLS yalnızca kendi planına izin verir. Yalnızca OAuth ile verilmiş token'lar (içinde `client_id` olanlar) kabul edilir; uygulamanın tarayıcı oturumu bir yapay zekâ onayı yerine geçmez.
- **Silmez, yayınlamaz.** Araçlar yalnızca okur ya da kamp ekler. Ekleme, planın en yeni kaydının üstüne yapılır (`save_planner_state` revizyon kontrolü); o sırada başka cihaz kaydederse yeniden dener. Açık bir uygulama sekmesi yeni kampı yenileyince görür.
- **Anahtar sunucuda kalır.** `YOUTUBE_API_KEY` hiçbir cevapta yer almaz; YouTube'un hata metni iletilmez.

## Kurulum (bir kez)

1. Supabase → Authentication → **OAuth Server**: sunucuyu aç, *Authorization Path* `/oauth/consent`, **Dynamic client registration**'ı aç (Claude, ChatGPT kendini böyle kaydeder).
2. Supabase → Authentication → URL Configuration: Site URL `https://yetistiricem.pages.dev`; Redirect URLs'e `https://yetistiricem.pages.dev/**` (onay sayfasında Google ile giriş ve yeni hesap onayı oraya döner).
3. Cloudflare Pages ortamında `YOUTUBE_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (fonksiyonlar çalışma anında okur).

## Teknik

- `server/mcp/protocol.ts`: durumsuz Streamable HTTP (her POST tek JSON-RPC mesajı ya da toplu mesaj, tek JSON cevap; oturum, SSE ve sunucudan istemciye istek yok), `authenticate` her mesajdan önce çalışır. SDK kullanılmaz.
- `server/mcp/account.ts`: token kontrolü (`/auth/v1/user`, bir dakika önbellek), planı okuma/kaydetme, RFC 9728 kaynak meta verisi. `server/mcp/tools.ts`: araçlar. `server/mcp/myPlan.ts`: ilerleme ve günler (uygulamanın motoru ve `src/lib/insights.ts`). `server/mcp/campFormat.ts`: JSON şeması ve kontrolü. `server/mcpEndpoint.ts`: bağlama. Testler: `tests/mcp.test.ts`.
- Giriş akışı: token'sız istek 401 + `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp"`; istemci oradan Supabase Auth'u (`<proje>/auth/v1`) bulur, kendini kaydeder, öğrenciyi `/oauth/consent`'e (`src/components/auth/OAuthConsent.tsx`) gönderir.
- Aynı handler'lar Cloudflare Pages'de (`functions/mcp.ts`, `functions/.well-known/oauth-protected-resource/[[path]].ts`, `public/_routes.json`), `npm run dev` / `vite preview`'da (`server/vitePlugin.ts`) ve `npm start`'ta (`server/index.ts`, `APP_ORIGIN`) çalışır.
