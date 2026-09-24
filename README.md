# Yetiştiricem

YouTube ders videolarını günlük çalışma süresine göre günlere bölen, tarayıcıda çalışan bir çalışma planlayıcı.

- **Bugün:** haftalık gün şeridi, seçili günün görevleri, gün notu, ilerleme özeti ve sıradaki görevler.
- **Haftalık:** haftanın yedi günü ve görevleri; buradan da işaretleyebilirsin.
- **İlerleme:** genel yüzde, kalan çalışma süresi, tahmini bitiş, kamp ve hafta bazında ilerleme.
- **Kamplar:** kamp ekleme (YouTube oynatma listesinden içe aktararak ya da elle), düzenleme, video ekleme/düzenleme/silme, kamp kaldırma.
- **Ayarlar:** günlük süre, izleme hızı, tekrar payı, günde en fazla ders, başlangıç tarihi, haftalık çalışma/deneme/dinlenme düzeni; yedek indirme, yedekten geri yükleme, demo, sıfırlama.

Bir görevi işaretlemek planı kaydırmaz: görev o günde kalır ve geri alınabilir. Geride kalan görevler yalnızca “ileri taşı / yeniden planla” dediğinde, kalıcı bir kaydırma olarak sonraki günlere dağıtılır.

## Çalıştırma

Node.js 22.9 ya da üstü gerekir.

```bash
npm ci
npm run dev      # http://localhost:5173 (oynatma listesi servisi dahil)
npm run build    # tsc + vite build
npm start        # dist/ + oynatma listesi servisi tek portta (varsayılan 127.0.0.1:3000)
npm run lint     # oxlint
npm test         # motor, oynatma listesi servisi ve anahtar gizliliği testleri (node:test)
```

Testler YouTube’a bağlanmaz ve API anahtarı istemez; YouTube Data API yanıtları testlerde taklit edilir.

## Video ekleme

Kamp eklerken ya da bir kampa “Video ekle” dediğinde üç yol var:

- **Oynatma listesi:** listenin bağlantısını yapıştır (`…/playlist?list=…`, `watch?v=…&list=…`, `youtu.be/…?list=…` ya da yalnızca `PL…` kimliği). Videolar liste sırasıyla; YouTube’daki adları, kanalları, küçük resimleri ve saniyesine kadar süreleriyle gelir. Eklemeden önce listeyi gözden geçirip seçebilirsin. Kamp adı, kanal ve liste bağlantısı boşsa listeden doldurulur.
- **Tek tek:** bağlantı, isteğe bağlı başlık ve süre.
- **Liste yapıştır:** her satıra bir video, `bağlantı | başlık | süre`. Başlık isteğe bağlıdır; süre `42`, `38:20`, `1:05:00` ya da `1 sa 5 dk` olabilir. Hatalı satırlar kutuda bırakılır ve sebebi gösterilir.

`youtube.com/watch`, `youtu.be`, `shorts`, `embed` ve `live` bağlantıları kabul edilir.

Oynatma listesinden içe aktarırken hiçbir değer uydurulmaz. Eklenemeyen videolar listede yerinde durur ve sebebi yazar: gizli ya da silinmiş videolar, süresi belli olmayan canlı yayınlar ve prömiyerler, 10 saati aşan videolar. Kampta ya da eklenecekler listesinde zaten olan bir video ve listede ikinci kez geçen bir video eklenmez; ilk geçtiği yer kullanılır. YouTube’un Türkiye’de engelli gösterdiği videolar işaretlenir ve varsayılan olarak seçilmez.

## Oynatma listesi içe aktarma: kurulum

Listeyi tarayıcı değil sunucu okur: `GET /api/youtube/playlist?id=<liste kimliği>` resmi **YouTube Data API v3** ile listenin tüm sayfalarını (sayfa başı 50 video) ve videoların ayrıntılarını alır. API anahtarı yalnızca sunucuda durur, tarayıcıya ve derlenmiş dosyalara hiç girmez (`tests/keySecrecy.test.ts` bunu derleme çıktısında denetler). Servis yalnızca doğrulanmış bir liste kimliği kabul eder; adres (URL) almaz, bu yüzden genel amaçlı bir vekil (proxy) olarak kullanılamaz. Kod: `server/`, ortak sözleşme: `src/utils/youtubePlaylist.ts`.

### 1. YouTube Data API v3’ü aç ve anahtar oluştur

1. [Google Cloud Console](https://console.cloud.google.com/)’da bir proje seç ya da oluştur.
2. **APIs & Services → Library**’de “YouTube Data API v3”ü bul ve **Enable** de.
3. **APIs & Services → Credentials → Create credentials → API key** ile anahtar oluştur.
4. Anahtarı kısıtla: **API restrictions → Restrict key → YouTube Data API v3**. Uygulama kısıtı olarak **HTTP referrers seçme**: istekler tarayıcıdan değil sunucudan gider. Sunucunun sabit bir IP’si varsa **IP addresses** kısıtı kullanılabilir.

### 2. Yerelde

```bash
cp .env.example .env.local      # .env.local git’e girmez
# .env.local içine: YOUTUBE_API_KEY=AIza...
npm run dev
```

`npm run dev` ve `npm run preview` servisi Vite içinde çalıştırır. Anahtar `VITE_` önekiyle **yazılmamalı**: Vite yalnızca `VITE_` ile başlayan değişkenleri tarayıcıya verir.

### 3. Yayında

```bash
npm ci && npm run build
YOUTUBE_API_KEY=AIza... HOST=0.0.0.0 PORT=8080 npm start
```

`npm start` (`server/index.ts`) `dist/` klasörünü ve servisi aynı porttan sunar; ek bağımlılık yoktur. Ortam değişkenleri:

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | — | Zorunlu. Yoksa servis `not-configured` döner, uygulamanın geri kalanı çalışır. |
| `PORT` | `3000` | Dinlenecek port. |
| `HOST` | `127.0.0.1` | Konteyner ve barındırma servislerinde `0.0.0.0` yap. |

Yerelde `.env.local` varsa `npm start` onu da okur; ortamda tanımlı değer önceliklidir. Anahtarı barındırma servisinin gizli ortam değişkeni (secret) olarak ver, depoya yazma. Uygulama yalnızca statik dosya olarak (servis olmadan) yayınlanırsa “Oynatma listesi” sekmesi “servise ulaşılamadı” der; tek tek ve liste yapıştırarak ekleme çalışmaya devam eder.

### Kota

Projenin varsayılan günlük kotası 10.000 birimdir. Bir liste `1 + 2 × ⌈video sayısı / 50⌉` birim harcar (72 videoluk liste: 5 birim). Aynı liste sunucuda 5 dakika saklanır; art arda yapıştırma ve çift tıklama kota yemez. Kota dolarsa kullanıcıya bir sonraki gün yenileneceği (Türkiye saatiyle 10.00–11.00 civarı) söylenir.

### Gizli listeler

Herkese açık ve **liste dışı** (unlisted) listeler okunur. **Gizli** listeler, “Daha sonra izle”, “Beğenilen videolar” ve YouTube Mix’leri bir API anahtarıyla okunamaz; bunlar için hesabın sahibinin OAuth ile giriş yapması gerekir ve bu sürümde yoktur. Uygulama bunu açıkça söyler ve listeyi “Liste dışı” yapmayı önerir.

### Servisin yanıtları

Başarılı yanıt `{ playlist, entries, truncated }` biçimindedir (`src/utils/youtubePlaylist.ts`). Hata yanıtı `{ "error": { "code": … } }`: `invalid-id` (400), `not-found` (404, silinmiş ya da gizli liste), `private` (403), `quota` (429), `not-configured` (503), `bad-key` (502, geçersiz/kısıtlı anahtar ya da kapalı API), `upstream` (502). YouTube’un hata metni ve anahtar hiçbir yanıtta ya da günlük satırında yer almaz.

**Demo şablonlar** (Kamp ekle → Demo şablon) gerçek bir kanalın listesi değildir: örnek bir TYT konu sırası ve sabit örnek süreler içerir, video bağlantısı yoktur. Her konuya sonradan kendi videonun bağlantısını ekleyebilirsin. **Demo önizleme** ise örnek bir planı yalnızca bellekte gösterir; hiçbir şey kaydedilmez.

## Veriler

Her şey tarayıcının `localStorage` alanında durur:

| Anahtar | İçerik |
| --- | --- |
| `yt_prefs` | ayarlar |
| `yt_playlists` | kamplar ve videolar |
| `yt_completed` | tamamlanan videolar (`videoId → true`) |
| `yt_shift_events` | kalıcı ileri taşımalar |
| `yt_shifted_date` | eski sürümün tek kaydırma tarihi; açılışta kalıcı kaydırmaya çevrilir |
| `yt_day_notes` | gün notları |
| `yt_selected_date` | seçili gün |

Okunamayan bir kayıt silinmez: `<anahtar>__okunamadi` adıyla kopyalanır ve ekranda uyarı gösterilir. Önceki sürümün uydurma örnek kampları (`watch?v=sample` bağlantıları, rastgele süreler) ve oynatma listesi okunmadan oluşturulmuş “Özel Video” kampları korunur ama açıkça işaretlenir.

Yedek dosyası (`yetistiricem-yedek-YYYY-AA-GG.json`) tüm bu verileri içerir; geri yüklemeden önce içeriği doğrulanır ve özetlenir.

## Kod düzeni

- `src/utils/` — planlama motoru, tarih anahtarları, depolama yardımcıları, YouTube bağlantı/süre ayrıştırma, oynatma listesi servisinin sözleşmesi. Motor sözleşmesi: [`docs/planner-engine.md`](docs/planner-engine.md).
- `server/` — oynatma listesi servisi (YouTube Data API istemcisi, istek işleyici, Vite eklentisi) ve `npm start` sunucusu.
- `src/lib/` — arayüzün motora tek giriş noktası (`engine.ts`), yükleme/geçiş/yedek (`persistence.ts`), kamp sınıflandırma, oynatma listesi içe aktarma kuralları (`playlistImport.ts`), ekran için türetilmiş görünümler, biçimlendirme.
- `src/components/` — gün, haftalık, ilerleme, kamplar ve ayarlar ekranları; diyaloglar `ui/Dialog.tsx` üzerinden.
