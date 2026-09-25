# Teknik mimari

## Genel görünüm

Arayüz ile YouTube oynatma listesi hizmeti aynı uygulamada çalışır. Kamp planı ve ilerleme tarayıcıda saklanır; sunucu yalnızca oynatma listesi içe aktarım isteğini ve YouTube API çağrılarını işler.

~~~mermaid
flowchart LR
  U["React arayüzü"] --> H["usePlanner / usePlaylistFetch"]
  H --> P["persistence.ts"]
  P --> LS[("Tarayıcı localStorage")]
  H --> E["buildCampSchedule"]
  E --> A["Kamp başına plan"]
  A --> M["mergeDailyPlans"]
  M --> V["Bugün / Haftalık / İlerleme"]
  H -->|liste kimliği| R["GET /api/youtube/playlist"]
  R --> Y["YouTube Data API v3"]
  Y --> R
  R -->|video bilgileri| U
~~~

## Uygulama katmanları

- **Arayüz:** `src/App.tsx` navigasyon ve kullanıcı işlemlerini düzenler. Sayfalar `src/components/` altında; plan durumu `src/hooks/usePlanner.ts` tarafından yüklenip güncellenir.
- **Planlama:** Arayüzün motor, tarih ve depolama yardımcılarına giriş noktası `src/lib/engine.ts`’tir. Asıl takvim kuralları `src/utils/roadmapEngine.ts` içindedir.
- **Kamp işlemleri:** Kamp/branş güncellemeleri `src/lib/plannerOps.ts` üzerinden yapılır; kamp sihirbazı taslağı `src/lib/campDraft.ts` içindedir.
- **Birleşik görünüm:** `src/lib/allCamps.ts`, her kampı kendi ayarlarıyla ayrı ayrı planlar ve `mergeDailyPlans` ile sonuçları tarihe göre birleştirir. Birleştirme planları yeniden dağıtmaz. Kaydırma olayları görevin ait olduğu kampta tutulur.
- **Saklama ve geçiş:** `src/lib/persistence.ts` localStorage kayıtlarını yükler, eski düz kayıtları kampa dönüştürür ve yedek içe/dışa aktarma akışlarını yönetir.
- **YouTube hizmeti:** `server/` altındaki ortak handler, Vite geliştirme/önizleme ortamında ve `npm start` ile çalışan Node sunucusunda kullanılır.

Daha ayrıntılı takvim garantileri için [planlama motoru sözleşmesine](planner-engine.md), kamp sihirbazı için [kamp oluşturma notlarına](camp-creation-wizard-notes.md) bak.

## Kamp başına planlama

`buildCampSchedule` her kamp için başlangıç ve hedef tarihini, günlük kapasiteyi, otomatik/elle ritmi ve o kampın `shiftEvents` geçmişini kullanır. Birleşik görünüm yalnızca üretilmiş günlük planları tarihe göre bir araya getirir.

Tamamlanma işaretleri ortak video kimliği üzerinden görünür; tamamlanmış görevleri işaretlemek takvimi yeniden kurmaz. Bir görevi kaydırmak ayrı ve kalıcı bir olaydır. Çoklu kamp taşımasında her olay sadece kendi kampında saklanır.

## Tarayıcı verisi

Temel kayıtlar localStorage içindedir:

- `yt_camps`: kamp, branş, tempo ve kaydırma geçmişi.
- `yt_active_camp`: Kamplar sayfasında yönetilen gerçek kamp.
- `yt_camp_scope`: plan ekranında tek kamp veya Tüm Kamplar seçimi.
- `yt_completed`: tamamlanan video kimlikleri.
- `yt_day_notes`: eski sürüm uyumluluğu için saklanan gün notları; arayüzde gün notları gösterilmez.
- `yt_selected_date`: seçili takvim günü.

Eski `yt_playlists`, `yt_prefs`, `yt_shift_events` ve `yt_shifted_date` anahtarları geçiş girdisidir; yeni sürüm bunları yazıp silmez. Okunamayan kayıt önce ayrı bir anahtara kopyalanıp kullanıcıya bildirilir. Yedekler bütün kampları ve ilerlemeyi içerir; görünüm tercihi yedeğe eklenmez.

## Oynatma listesi akışı

1. Arayüzdeki `usePlaylistFetch` bağlantıdan liste kimliğini çıkarıp doğrular.
2. İstemci yalnızca <code>GET /api/youtube/playlist?id=&lt;liste-kimliği&gt;</code> isteği yapar; kamp verisini bu isteğe eklemez.
3. `server/playlistEndpoint.ts` kimliği doğrular, kısa süreli önbelleği kontrol eder ve `server/youtubeApi.ts` üzerinden sabit Google API uç noktalarına gider.
4. API anahtarı istek başlığında sunucudan YouTube’a gönderilir; tarayıcı koduna veya URL’ye konmaz.
5. Oynatma listesi sayfalanır, video ayrıntıları toplu istenir ve uygulamanın PlaylistResponse biçimine çevrilir. Hatalarda upstream metni yerine sınırlı hata kodları döner.

Liste sayfası başına 50 öğe alınır; üst sınır 100 sayfadır. Varsayılan sunucu önbelleği 5 dakikadır ve tekrar eden isteklerin kota tüketmesini azaltır. Özel oynatma listeleri için OAuth girişi uygulanmamıştır.

## Anahtar güvenliği

`YOUTUBE_API_KEY` sadece sunucu ortamında bulunmalıdır. Yerelde `.env.local` kullanılır; dosya Git’ten hariç tutulur. Değişkeni `VITE_` ile başlatma: bu önek tarayıcı paketine aktarılır. Google API hatalarının ham metni ve anahtar günlüklerde ya da endpoint cevaplarında tutulmaz.

YouTube veri endpoint’i teknik olarak genel amaçlı bir proxy değildir: yalnızca tek bir doğrulanmış liste kimliğini kabul eder ve sabit API kaynaklarını çağırır.
