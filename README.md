# Yetiştiricem

YouTube ders videolarını günlük çalışma süresine göre günlere bölen, tarayıcıda çalışan bir çalışma planlayıcı.

Bir **kamp** (ör. “TYT 2027”) çalışma programının tamamıdır: birden çok **branş** (Matematik, Fizik…) içerir ve her branş sırayla izlenecek videolardır (genellikle bir YouTube oynatma listesi). Her kampın kendi temposu (tarihler, günlük süre, haftalık düzen) ve kendi ileri taşımaları vardır; birden çok kamp tutulabilir, ekranlar açık kampı gösterir.

- **Yeni kamp:** dört adımlı sihirbaz. Kaynaklar (her oynatma listesi bir branş olur; tek video, liste yapıştırma ve demo şablon da var) → kamp adı, başlangıç ve isteğe bağlı hedef bitiş tarihi → ritim (önce “Otomatik dağıt” ya da “Branşları günlere ben yerleştireceğim”) → kaydetmeden önce günlük plan önizlemesi ve hedefe yetişme durumu.
- **Bugün:** haftalık gün şeridi, seçili günün görevleri, geciken görevler, ilerleme özeti ve haftanın ilerlemesi.
- **Haftalık:** haftanın rotası (her güne bir tamamlanma halkası; dokununca o günün kartına gider) ve Pazar’a kadar yatay kaydırılan yedi gün kartı; görevleri buradan da işaretleyebilirsin.
- **İlerleme:** genel yüzde, kalan çalışma süresi, tahmini bitiş, hedef tarihe göre durum, branş ve hafta bazında ilerleme.
- **Kamplar:** kamplar arasında geçiş, yeniden adlandırma, silme; açık kampın branşları (branş ekleme/düzenleme/kaldırma, video ekleme/düzenleme/silme) ve “Tempoyu düzenle”. “Branş ekle” adım adım bir sihirbaz açar: kaynaklar → (elle yerleşimli kampta) günler → önizleme. Yeni branşlar aynı kampa eklenir; kampın adı, tarihleri ve temposu değişmez, plan o tempoya göre yeniden dağıtılır.
- **Ayarlar:** uygulama düzeyi: yedek indirme, yedekten geri yükleme, demo, sıfırlama. Tempo ayarları kampa aittir, burada değil.

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

Kamp oluştururken, bir kampa “Branş ekle” ya da bir branşa “Video ekle” dediğinde üç yol var:

- **Oynatma listesi:** listenin bağlantısını yapıştır (`…/playlist?list=…`, `watch?v=…&list=…`, `youtu.be/…?list=…` ya da yalnızca `PL…` kimliği). Videolar liste sırasıyla; YouTube’daki adları, kanalları, küçük resimleri ve saniyesine kadar süreleriyle gelir. Eklemeden önce listeyi gözden geçirip seçebilirsin. Kamp sihirbazında her liste kendi branşı olur (listenin adı, kanalı ve bağlantısıyla; branş adı başlıktan tahmin edilir ve değiştirilebilir). Bir branş tek bir kaynak bağlantısı tutar; var olan bir branşa liste eklendiğinde videolar kendi bağlantılarıyla gelir, branşın kaynak bağlantısı yalnızca boşsa doldurulur.
- **Tek tek:** bağlantı, isteğe bağlı başlık ve süre (yeni ya da var olan bir branşa).
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

**Demo şablonlar** (Yeni kamp ya da Branş ekle → Demo şablon) gerçek bir kanalın listesi değildir: örnek bir TYT konu sırası ve sabit örnek süreler içerir, video bağlantısı yoktur. Her konuya sonradan kendi videonun bağlantısını ekleyebilirsin. **Demo önizleme** ise örnek bir planı yalnızca bellekte gösterir; hiçbir şey kaydedilmez.

## Veriler

Her şey tarayıcının `localStorage` alanında durur:

| Anahtar | İçerik |
| --- | --- |
| `yt_camps` | kamplar: branşları, videoları, temposu ve ileri taşımaları (`{ version, camps }`) |
| `yt_active_camp` | açık kampın kimliği |
| `yt_completed` | tamamlanan videolar (`videoId → true`, tüm kamplar için) |
| `yt_day_notes` | gün notları |
| `yt_selected_date` | seçili gün |
| `yt_playlists`, `yt_prefs`, `yt_shift_events`, `yt_shifted_date` | önceki sürümün düz kayıtları; yalnızca okunur |

`yt_camps` yokken önceki sürümün düz kayıtları bulunursa açılışta tek bir kampa (“Çalışma kampım”) dönüştürülür: eski her kamp bu kampın bir branşı olur; videolar, bağlantılar, süreler, tamamlananlar, notlar, ileri taşımalar ve ayarlar aynen korunur, plan değişmez. Yeni düzen kaydedilir; eski anahtarlar silinmez, dokunulmadan anlık görüntü olarak kalır (Sıfırla hepsini siler). Ayrıntılar: [`docs/camp-creation-wizard-notes.md`](docs/camp-creation-wizard-notes.md).

Okunamayan bir kayıt silinmez: `<anahtar>__okunamadi` adıyla kopyalanır ve ekranda uyarı gösterilir. Önceki sürümün uydurma örnek kampları (`watch?v=sample` bağlantıları, rastgele süreler) ve oynatma listesi okunmadan oluşturulmuş “Özel Video” kampları korunur ama açıkça işaretlenir.

Yedek dosyası (`yetistiricem-yedek-YYYY-AA-GG.json`, sürüm 3) tüm kampları ve bu verileri içerir; geri yüklemeden önce içeriği doğrulanır ve özetlenir. Önceki sürümlerin düz yedekleri de açılır ve tek bir kampa dönüştürülür.

## Kod düzeni

- `src/utils/` — planlama motoru, tarih anahtarları, depolama yardımcıları, YouTube bağlantı/süre ayrıştırma, oynatma listesi servisinin sözleşmesi. Motor sözleşmesi: [`docs/planner-engine.md`](docs/planner-engine.md).
- `server/` — oynatma listesi servisi (YouTube Data API istemcisi, istek işleyici, Vite eklentisi) ve `npm start` sunucusu.
- `src/lib/` — arayüzün motora tek giriş noktası (`engine.ts`), yükleme/geçiş/yedek (`persistence.ts`), kamp modeli ve ritim ön ayarları (`studyCamp.ts`), sihirbaz taslağı ve doğrulama (`campDraft.ts`), veri güncellemeleri (`plannerOps.ts`), branş sınıflandırma (`camps.ts`), oynatma listesi içe aktarma kuralları (`playlistImport.ts`), ekran için türetilmiş görünümler, biçimlendirme.
- `src/components/` — gün, haftalık, ilerleme, kamplar ve ayarlar ekranları, kamp sihirbazı (`wizard/`), tempo düzenleyici (`rhythm/`); diyaloglar `ui/Dialog.tsx` üzerinden.
