# Geliştirme ve çalıştırma

## Gereksinimler

- Node.js 22.12 veya üzeri
- npm

Vite sürümünün Node gereksinimi kilitli bağımlılık sürümünden gelir; bu proje için 22.12+ tabanını kullan.

## Yerel kurulum

~~~bash
npm ci
cp .env.example .env.local
~~~

Oynatma listesi içe aktarımını yerelde denemek için .env.local dosyasına kendi YouTube Data API anahtarını ekle:

~~~dotenv
YOUTUBE_API_KEY=anahtarini_buraya_yaz
~~~

Anahtarı repoya, istemci koduna veya VITE_ adlı bir değişkene koyma. API anahtarı olmadan arayüz, elle video ekleme ve planlama özellikleri çalışır; yalnızca YouTube listesini sunucudan okuma kapalı kalır.

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| <code>npm run dev</code> | Vite geliştirme sunucusunu ve playlist endpoint’ini başlatır. |
| <code>npm run lint</code> | Oxlint ile kaynak dosyalarını denetler. |
| <code>npm test</code> | TypeScript test tiplerini denetler ve node:test testlerini çalıştırır. YouTube çağrıları taklit edilir; anahtar gerekmez. |
| <code>npm run build</code> | TypeScript proje denetimini ve üretim derlemesini çalıştırır. |
| <code>npm run preview</code> | Üretim derlemesini Vite preview ile sunar; endpoint eklentisi de kullanılabilir. |
| <code>npm start</code> | Önceden oluşturulmuş <code>dist/</code> içeriğini ve playlist endpoint’ini tek Node sunucusunda sunar. |
| <code>npm run pages:dev</code> | Wrangler ile yerel Pages Functions ve statik dosyaları birlikte çalıştırır. |
| <code>npm run pages:deploy</code> | Build alıp Pages’e Wrangler ile manuel dağıtım yapar. Git entegrasyonlu projede olağan yayın akışı <code>main</code> dalına push etmektir. |

npm start için önce npm run build çalıştır. Varsayılan adres 127.0.0.1:3000’dir. Barındırma ortamında HOST=0.0.0.0 ve gerekiyorsa PORT ayarlanabilir.

## Cloudflare Pages

Pages yapılandırması `wrangler.jsonc` içinde; Node build sürümü `.nvmrc` ile sabitlenir. Pages build ayarları `npm run build` komutunu ve `dist` çıktı klasörünü kullanır. Üretim `main` dalındaki GitHub commit’lerinden otomatik yayınlanır.

Planlayıcı `/app` adresinde çalışır ve bu yol için ayrı bir dosya yoktur. Pages, çıktının kökünde `404.html` bulunmadığı sürece bilinmeyen yolları `index.html` ile yanıtlar; `public/` içine `404.html` ekleme, yoksa `/app` açılmaz. `npm start` sunucusu ve Vite de aynı şekilde uygulama kabuğunu döndürür.

Oynatma listesi servisi Pages Function olarak `functions/api/youtube/playlist.ts` içinde çalışır ve aynı doğrulama/API kodunu `server/` ile paylaşır. `public/_routes.json` yalnızca `/api/youtube/playlist` yolunu Function’a yönlendirir; diğer istekler statik dosya olarak sunulur.

Cloudflare Pages projesinin Production ortamında `YOUTUBE_API_KEY` adında gizli bir secret tanımla. Preview dağıtımlarında YouTube içe aktarımı kullanılacaksa Preview ortamına da ayrı ayrı ekle. Anahtarı `vars` alanına, GitHub’a veya tarayıcıya koyma. `npm run pages:dev` ile yerelde Pages Function davranışını deneyebilirsin; yerel denemede gizli değişkeni `.dev.vars` içine koy ve dosyayı commit etme.

## YouTube Data API kurulumu

Google Cloud Console’da bir proje seç veya oluştur, YouTube Data API v3’ü etkinleştir ve bir API anahtarı oluştur. Anahtarı yalnızca YouTube Data API v3 ile sınırla. Uygulama istekleri sunucudan gönderdiği için tarayıcı referrer kısıtı kullanma; barındırma ortamında sabit çıkış IP’si varsa IP kısıtı ekleyebilirsin.

Yerel geliştirme .env.local dosyasını Vite tarafından okur. Üretimde anahtarı barındırma sağlayıcısının gizli ortam değişkeni olarak tanımla. Pages dağıtımında yukarıdaki Function endpoint’i kullanılır; başka statik barındırmada playlist içe aktarımı için uygulamanın Node sunucusunu ayrıca çalıştırmalısın.

## Kontrol

Pull request veya yerel teslimattan önce:

~~~bash
npm test
npm run lint
npm run build
~~~

Testler gerçek YouTube ağına bağlanmaz. Oynatma listesi endpoint’i, hata yanıtları, sayfalama ve API anahtarı gizliliği test verileriyle denetlenir.
