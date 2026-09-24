# Yetiştiricem

YouTube ders videolarını günlük çalışma süresine göre günlere bölen, tarayıcıda çalışan bir çalışma planlayıcı.

- **Bugün:** haftalık gün şeridi, seçili günün görevleri, gün notu, ilerleme özeti ve sıradaki görevler.
- **Haftalık:** haftanın yedi günü ve görevleri; buradan da işaretleyebilirsin.
- **İlerleme:** genel yüzde, kalan çalışma süresi, tahmini bitiş, kamp ve hafta bazında ilerleme.
- **Kamplar:** kamp ekleme, düzenleme, video ekleme/düzenleme/silme, kamp kaldırma.
- **Ayarlar:** günlük süre, izleme hızı, tekrar payı, günde en fazla ders, başlangıç tarihi, haftalık çalışma/deneme/dinlenme düzeni; yedek indirme, yedekten geri yükleme, demo, sıfırlama.

Bir görevi işaretlemek planı kaydırmaz: görev o günde kalır ve geri alınabilir. Geride kalan görevler yalnızca “ileri taşı / yeniden planla” dediğinde, kalıcı bir kaydırma olarak sonraki günlere dağıtılır.

## Çalıştırma

```bash
npm ci
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build
npm run lint     # oxlint
npm test         # planlama motoru testleri (node:test)
```

## Video ekleme

Uygulama YouTube’a bağlanmaz ve API anahtarı kullanmaz; bu yüzden oynatma listelerini okuyamaz. Her videonun bağlantısını ve süresini sen girersin:

- **Tek tek:** bağlantı, isteğe bağlı başlık ve süre.
- **Liste yapıştır:** her satıra bir video, `bağlantı | başlık | süre`. Başlık isteğe bağlıdır; süre `42`, `38:20`, `1:05:00` ya da `1 sa 5 dk` olabilir. Hatalı satırlar kutuda bırakılır ve sebebi gösterilir.

`youtube.com/watch`, `youtu.be`, `shorts`, `embed` ve `live` bağlantıları kabul edilir. Oynatma listesi bağlantısı kampa yalnızca referans olarak kaydedilebilir.

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

- `src/utils/` — planlama motoru, tarih anahtarları, depolama yardımcıları, YouTube bağlantı/süre ayrıştırma. Motor sözleşmesi: [`docs/planner-engine.md`](docs/planner-engine.md).
- `src/lib/` — arayüzün motora tek giriş noktası (`engine.ts`), yükleme/geçiş/yedek (`persistence.ts`), kamp sınıflandırma, ekran için türetilmiş görünümler, biçimlendirme.
- `src/components/` — gün, haftalık, ilerleme, kamplar ve ayarlar ekranları; diyaloglar `ui/Dialog.tsx` üzerinden.
