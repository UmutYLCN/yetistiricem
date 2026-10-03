import { Bot, CalendarCheck, Compass, Library, Sparkles } from 'lucide-react';
import { AiLogo } from '../ui/AiLogos';
import { Callout, Cards, CodeBlock, DocLink, H2, H3, PageCard, Steps } from './kit';
import { msg } from '../../lib/messages';


// The text of every docs page (listed in `content.ts`). It describes the app
// as it works; when a screen changes, change its page here.


const mcpUrl = () => `${window.location.origin}/mcp`;

export function Overview() {
  return (
    <>
      <p>
        <strong>{msg("Panik yok, yetişir.")}</strong> {msg(" Yetişir, YouTube oynatma listelerindeki ders videolarını ve kendi yazdığın konuları günlük\n        çalışma süreni aşmayacak şekilde günlere dağıtır. Her gün yalnızca bugünün görevlerine bakarsın; hedef tarihine yetişip\n        yetişmediğini de takvim söyler.\n      ")}</p>
      <H2 id="kavramlar">{msg("Temel kavramlar")}</H2>
      <ul>
        <li>
          <strong>{msg("Kamp:")}</strong> {msg(" büyük hedefin tamamı, örneğin “TYT 2027” ya da “İngilizce”. Her kampın kendi temposu ve takvimi vardır.\n        ")}</li>
        <li>
          <strong>{msg("Branş:")}</strong> {msg(" kampın içindeki ders ya da konu grubu, örneğin Matematik. Genellikle tek bir oynatma listesidir.\n        ")}</li>
        <li>
          <strong>{msg("Görev:")}</strong> {msg(" planlanan gündeki tek bir video ya da konu.\n        ")}</li>
        <li>
          <strong>{msg("Tempo:")}</strong> {msg(" günlük süre, izleme hızı, tekrar payı ve çalışma günleri. Takvim bunlardan hesaplanır.\n        ")}</li>
      </ul>
      <H2 id="nereden-baslamali">{msg("Nereden başlamalı?")}</H2>
      <Cards>
        <PageCard to="hizli-baslangic" title={msg("Hızlı başlangıç")} icon={<Sparkles className="size-4 text-forest" />}>
          {msg("\n          Hesabını aç, ilk kampını birkaç dakikada kur.\n        ")}</PageCard>
        <PageCard to="kamp-olusturma" title={msg("Kamp oluşturma")} icon={<Library className="size-4 text-forest" />}>
          {msg("\n          Sihirbazın dört adımı ve her adımda neyi seçtiğin.\n        ")}</PageCard>
        <PageCard to="bugun" title={msg("Her gün")} icon={<CalendarCheck className="size-4 text-forest" />}>
          {msg("\n          Rotam ekranıyla günlük kullanım.\n        ")}</PageCard>
        <PageCard to="yapay-zeka" title={msg("Yapay zekâ")} icon={<Bot className="size-4 text-forest" />}>
          {msg("\n          Claude, ChatGPT ya da Grok’u bağla; seni değerlendirsin, kampını kursun.\n        ")}</PageCard>
      </Cards>
    </>
  );
}

export function QuickStart() {
  return (
    <>
      <p>{msg("İlk kampını kurup ilk gününü görmek birkaç dakika sürer.")}</p>
      <Steps>
        {[
          <>
            <strong>{msg("Hesabını aç.")}</strong> {msg(" Ana sayfadaki ")}<strong>{msg("Giriş yap ve başla")}</strong> {msg(" ile e-posta ve şifreyle hesap oluştur. Önce\n            bakmak istersen ")}<strong>{msg("Demo ile göz at")}</strong> {msg(" örnek bir kampı açar; demoda hiçbir şey kaydedilmez.\n          ")}</>,
          <>
            <strong>{msg("Kaynaklarını ekle.")}</strong> {msg(" Bir YouTube oynatma listesinin bağlantısını yapıştır; videolar adları ve gerçek süreleriyle\n            gelir. Ayrıntılar: ")}<DocLink to="kaynaklar">{msg("Branşlar ve kaynaklar")}</DocLink>{msg(".\n          ")}</>,
          <>
            <strong>{msg("Kampına ad ver")}</strong>{msg(", başlangıç tarihini seç. Hedef tarih isteğe bağlıdır.\n          ")}</>,
          <>
            <strong>{msg("Ritmini seç:")}</strong> {msg(" günlük süreni ve çalışma günlerini söyle ya da branşları günlere kendin yerleştir. Bkz.")}{msg(" ")}
            <DocLink to="tempo">{msg("Tempo ve ritim")}</DocLink>{msg(".\n          ")}</>,
          <>
            <strong>{msg("Önizle ve kaydet.")}</strong> {msg(" Takvimi, tahmini bitişi ve hedefe yetişip yetişmediğini gör. Kaydedince")}{msg(" ")}
            <strong>{msg("Bugün")}</strong> {msg(" ekranı ilk günün görevleriyle açılır.\n          ")}</>,
        ]}
      </Steps>
      <Callout tone="tip" title={msg("Uğraşmak istemiyor musun?")}>
        {msg("\n        Yapay zekânı bağla, sohbette anlat; kampı o kursun. Bkz. ")}<DocLink to="yapay-zeka">{msg("Yapay zekâ")}</DocLink>{msg(".\n      ")}</Callout>
    </>
  );
}

export function CampWizard() {
  return (
    <>
      <p>
        {msg("\n        Yeni kamp sihirbazı kenar çubuğundaki ")}<strong>{msg("Yeni kamp")}</strong> {msg(" ile açılır. Kaydetmeden önce her şeyi önizler; istediğin adıma\n        geri dönebilirsin ve kapatsan bile taslak durur.\n      ")}</p>
      <H2 id="adimlar">{msg("Dört adım")}</H2>
      <Steps>
        {[
          <>
            <strong>{msg("Branşlar.")}</strong> {msg(" Oynatma listesi, video bağlantıları ya da elle yazılan konular. Listeyi getirince videolar ayrı bir\n            ekranda gelir; seçip branş olarak eklersin. Sonra branşların listelenir; ")}<strong>{msg("Başka branş ekle")}</strong> {msg(" ile istediğin kadar\n            ekleyebilir, her branşın adını, rengini ve videolarını düzenleyebilirsin. Devam etmek için en az bir branş gerekir.\n          ")}</>,
          <>
            <strong>{msg("Kamp.")}</strong> {msg(" Ad (en çok 80 karakter) ve başlangıç tarihi gerekir. Hedef bitiş tarihi isteğe bağlıdır; +1, +3 ve +6 ay\n            kısayolları vardır.\n          ")}</>,
          <>
            <strong>{msg("Ritim.")}</strong> {msg(" Otomatik dağıtım ya da branşları günlere elle yerleştirme. Bkz. ")}<DocLink to="tempo">{msg("Tempo ve ritim")}</DocLink>{msg(".\n          ")}</>,
          <>
            <strong>{msg("Önizleme.")}</strong> {msg(" İlk çalışma günü, tahmini bitiş, toplam çalışma, hedef tarih durumu ve gün gün takvim. Hiçbir şey\n            henüz kaydedilmemiştir.\n          ")}</>,
        ]}
      </Steps>
      <H2 id="brans-ekleme">{msg("Çalışan kampa branş eklemek")}</H2>
      <p>
        <strong>{msg("Kamplar")}</strong> {msg(" sayfasındaki ")}<strong>{msg("Branş ekle")}</strong> {msg(" yeni kamp açmaz; açık kampa branş ekler. Kampın adı, tarihleri ve\n        temposu korunur. Geçmiş günlere düşecek yeni görevler yarından başlar, böylece yeni branş ilk videosundan başlar.\n      ")}</p>
      <H2 id="birden-fazla-kamp">{msg("Birden fazla kamp")}</H2>
      <p>
        {msg("\n        İki ya da daha fazla kampın olduğunda Rotam ve İlerleme ekranları tüm kampları birlikte gösterir: görevler tek akışta, her\n        biri kamp ve branş adıyla. Her kamp kendi temposuyla planlanır; bir kampı değiştirmek diğerini etkilemez. Bir kampa ara\n        vermek istersen Kamplar’da kartın menüsünden ")}<strong>{msg("Kampı duraklat")}</strong> {msg(" de: kamp saklanır ama Rotam’dan ve İlerleme’den\n        çıkar. ")}<strong>{msg("Devam et")}</strong> {msg(" dediğinde geride kalan görevler o günden itibaren sırayla yeniden dağıtılır; bu erteleme sayılmaz.\n      ")}</p>
    </>
  );
}

export function Sources() {
  return (
    <>
      <p>{msg("Bir branşın videoları üç yoldan gelir. Başlık ve süreler hiçbir zaman tahmin edilmez: ya YouTube’dan okunur ya da sen yazarsın.")}</p>
      <H2 id="oynatma-listesi">{msg("Oynatma listesi")}</H2>
      <p>
        {msg("\n        Herkese açık ya da liste dışı bir YouTube oynatma listesinin bağlantısını yapıştır. Videolar sırasıyla, gerçek süreleri ve kanal\n        adlarıyla gelir; eklemeden önce listeyi gözden geçirirsin. Her oynatma listesi ayrı bir branş olur.\n      ")}</p>
      <p>{msg("Uygulama bazı videoları kendiliğinden dışarıda bırakır ve nedenini gösterir:")}</p>
      <ul>
        <li>{msg("gizli, silinmiş ya da kaldırılmış videolar,")}</li>
        <li>{msg("canlı yayınlar ve henüz yayınlanmamış videolar,")}</li>
        <li>{msg("listede ikinci kez geçen videolar,")}</li>
        <li>{msg("10 saatten uzun videolar,")}</li>
        <li>{msg("Türkiye’de engelli olabilecek videolar (istersen yine seçebilirsin).")}</li>
      </ul>
      <Callout tone="info">{msg("Özel (private) oynatma listeleri ve “Daha sonra izle” gibi kişisel listeler YouTube tarafından paylaşılmadığı için okunamaz.")}</Callout>
      <H2 id="videolar">{msg("Video bağlantıları")}</H2>
      <p>{msg("Bir ya da birden çok video bağlantısını yapıştır; başlık ve süre yine YouTube’dan okunur. Yeni bir branşa ya da var olana eklenebilirler.")}</p>
      <H2 id="konular">{msg("Elle eklenen konular")}</H2>
      <p>
        {msg("\n        YouTube dışındaki dersler için konu adını ve süresini yaz; Enter bir sonrakini ekler, yapıştırdığın satırlar ayrı konulara bölünür.\n        Bu görevler bağlantısız başlar; video bağlantısını sonra plandaki ")}<strong>{msg("Bağlantı ekle")}</strong> {msg(" ile ekleyebilirsin.\n      ")}</p>
      <H2 id="yeni-videolar">{msg("Listeye eklenen yeni videolar")}</H2>
      <p>
        {msg("\n        Oynatma listesiyle eklenen branşlar günde en fazla bir kez kontrol edilir. Listeye yeni ders eklendiyse sağ üstteki zilde görünür;")}{msg(" ")}
        <strong>{msg("Planımın sonuna ekle")}</strong> {msg(" ile branşın sonuna eklenir, ")}<strong>{msg("Göz ardı et")}</strong> {msg(" ile bir daha sorulmaz.\n      ")}</p>
    </>
  );
}

export function Tempo() {
  return (
    <>
      <p>
        {msg("\n        Tempo kampa aittir ve ")}<strong>{msg("Kamplar → Tempoyu düzenle")}</strong> {msg(" ile değişir. Kamp başladıysa yeni tempo bugünden itibaren geçerli olur ve geçmiş\n        günler olduğu gibi kalır; tamamladığın görevler ve ritim güncellemelerin korunur.\n      ")}</p>
      <H2 id="ayarlar">{msg("Tempo ayarları")}</H2>
      <table>
        <thead>
          <tr>
            <th>{msg("Ayar")}</th>
            <th>{msg("Ne yapar")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{msg("Günlük süre")}</td>
            <td>{msg("Bir çalışma gününe sığacak toplam süre: video, not ve soru çözme dahil. 0,5–16 saat.")}</td>
          </tr>
          <tr>
            <td>{msg("İzleme hızı")}</td>
            <td>{msg("Videoları kaç kat hızla izlediğin: 1x, 1,25x, 1,5x, 1,75x ya da 2x. Süreler buna göre kısalır.")}</td>
          </tr>
          <tr>
            <td>{msg("Tekrar payı")}</td>
            <td>{msg("Her videoya not ve pratik için eklenen süre, %0–100. %20, 30 dakikalık bir videoya 6 dakika ekler.")}</td>
          </tr>
          <tr>
            <td>{msg("Günde kaç branş")}</td>
            <td>{msg("Otomatik dağıtımda bir güne en çok kaç farklı branş gelsin.")}</td>
          </tr>
        </tbody>
      </table>
      <H2 id="otomatik">{msg("Otomatik dağıtım")}</H2>
      <p>
        {msg("\n        Hafif, Dengeli ya da Yoğun ön ayarından birini seçmen yeter; çalışma günleri, günlük süre ve günlük branş sayısını istersen tek tek\n        değiştirirsin. Branşlar çalışma günlerine sırayla dağılır. İsteğe bağlı bir deneme günü o günü boş tutar.\n      ")}</p>
      <H2 id="elle">{msg("Elle yerleştirme")}</H2>
      <p>
        {msg("\n        Haftanın her gününü Ders, Deneme ya da Dinlenme yaparsın; ders günlerine branş seçersin. Önerilen bir dağılımla başlar. Hiçbir güne\n        konmamış branş olursa uygulama uyarır ve “En boş günlere yerleştir” önerir.\n      ")}</p>
      <H2 id="yetisir-mi">{msg("“Yetişir mi?” hesabı")}</H2>
      <p>
        {msg("\n        Hedef tarih seçtiğinde son görevin günü hedefle karşılaştırılır. Yetişiyorsa ")}<strong>{msg("Panik yok, yetişir.")}</strong> {msg(" ve kaç gün\n        erken bittiği yazar. Yetişmiyorsa kaç gün geride olduğunu ve günlük süreyi ne kadar yaparsan yetişeceğini söyler; tek dokunuşla\n        uygulayabilirsin.\n      ")}</p>
      <Callout tone="info">{msg("Hedef tarih planı sıkıştırmaz: hiçbir video atlanmaz, günler taşırılmaz. Öneriler yalnızca günlük süreyi değiştirir.")}</Callout>
      <p>
        {msg("Bir erteleme planı hedef tarihin ötesine iterse Yetişir hemen sorar: günlük süreyi önerilen saate çıkarabilir (yeni süre bugünden başlar), hedef tarihi erteleyebilir ya da planı böyle bırakabilirsin. Öneri, Tercihler’deki günlük üst sınırı (başta 8 saat) geçmez; şu anki sürenin 1,5 katını aşarsa “Bu çok yoğun olabilir” uyarısı çıkar.")}
      </p>
    </>
  );
}

export function Daily() {
  return (
    <>
      <p>{msg("Her gün yalnızca bugünün görevlerine bakarsın. Sonraki bir günün görevini önden bitirirsen o görev bitirdiğin güne sayılır ve sonraki görevler boşalan yere öne kayar; işareti geri alabilirsin.")}</p>
      <H2 id="bugun">{msg("Rotam")}</H2>
      <p>
        {msg("\n        Menüdeki ")}<strong>{msg("Rotam")}</strong> {msg(" seçili günü iki şekilde gösterir; sağ üstteki ")}<strong>{msg("Liste / Yol")}</strong> {msg(" düğmesiyle geçersin ve\n        menü son kullandığını açar.\n      ")}</p>
      <H3 id="liste">{msg("Liste")}</H3>
      <p>
        {msg("\n        Seçili günün görevleri ve tahmini çalışma süresi. Üstteki ")}<strong>{msg("haftanın rotası")}</strong> {msg(" her günü bir halkayla gösterir: halka\n        o günün görevleri bittikçe dolar, tamamlanan gün tik alır, geciken günde kırmızı nokta belirir. Bir güne dokunarak ona geçer, oklarla\n        haftalar arasında gezersin. Sağ tarafta genel ilerleme, tahmini bitiş ve hedef tarihin durur.\n      ")}</p>
      <H3 id="yol">{msg("Yol")}</H3>
      <p>
        {msg("\n        Günün görevleri kıvrılan bir yol üzerinde durak durak. Bir durağa dokununca video yandaki panelde açılır; ")}<strong>{msg("İzledim")}</strong>{msg(" ")}
        {msg("\n        görevi tamamlar ve yol sıradaki durağa ilerler.\n      ")}</p>
      <Callout tone="tip">
        {msg("\n        Geride kaldıysan görevler kırmızıyla öne çıkar. Ne yapacağın: ")}<DocLink to="ritmi-guncelle">{msg("Ritmi güncelle")}</DocLink>{msg(".\n      ")}</Callout>
    </>
  );
}

export function Reschedule() {
  return (
    <>
      <p>
        {msg("\n        Bir gün aksadıysa suçluluk yok. Plan sen istemedikçe değişmez; geride kalan görevleri ")}<strong>{msg("Ritmi güncelle")}</strong> {msg(" ile sonraki\n        uygun çalışma günlerine yayarsın. Tamamladıkların yerinde kalır.\n      ")}</p>
      <H2 id="nasil">{msg("Nasıl yapılır?")}</H2>
      <Steps>
        {[
          <>{msg("Geçmiş bir günde tamamlanmamış görev varsa kırmızı kartta ")}<strong>{msg("Ritmi güncelle")}</strong>{msg("’ye bas.")}</>,
          <>
            <strong>{msg("Neden yetişmedi?")}</strong> {msg(" sorusunda bir neden seç: sosyal medya / dikkat dağınıklığı, ders ağır geldi, yorgunluk, zaman\n            yetmedi ya da isteksizlik. İstersen ")}<strong>{msg("Belirtmeden güncelle")}</strong> {msg(" ile geçebilirsin.\n          ")}</>,
          <>{msg("Geciken görevler bugünden itibaren sırayla yeniden dağılır, bugünkü görevlerin onların ardından gelir. Seçtiğin nedene göre küçük bir öneri görürsün; ")}<strong>{msg("Geri al")}</strong> {msg(" ile vazgeçebilirsin.")}</>,
        ]}
      </Steps>
      <H2 id="oneriler">{msg("Öneriler")}</H2>
      <p>
        {msg("\n        Öneriler küçük ve somuttur. Ders ağır geldiyse “2 dakika kuralı” (videonun yalnızca ilk 5 dakikası); dikkat dağıldıysa telefonu\n        uzaklaştırıp ")}<DocLink to="focus">{msg("Yetişir Focus")}</DocLink>{msg("; yorgunsan günü tek kısa bir videoyla kapatmak.\n      ")}</p>
      <H2 id="kritik">{msg("Defalarca ertelenen görevler")}</H2>
      <p>{msg("Bir görev üç kez ertelendiğinde üzerinde “Kritik” rozeti çıkar. Bugün ilk iş onu ele almayı dene.")}</p>
      <p>
        {msg("\n        Nedenlerin ")}<DocLink to="ilerleme" section="erteleme">{msg("İlerleme")}</DocLink> {msg(" ekranında dağılım olarak görünür; seni en çok neyin\n        zorladığını orada görürsün.\n      ")}</p>
    </>
  );
}

export function Focus() {
  return (
    <>
      <p>
        <strong>{msg("Yetişir Focus")}</strong>{msg(", videoyu YouTube’a gitmeden, önerisiz bir oynatıcıda izlemen için. Bir görevdeki")}{msg(" ")}
        <strong>{msg("Odaklan")}</strong> {msg(" ile açılır.\n      ")}</p>
      <ul>
        <li>{msg("Video sonuna kadar izlendiğinde görev kendiliğinden tamamlanır ve sıradaki göreve geçebilirsin.")}</li>
        <li>{msg("İzleme süresi, duraklatma sayısı ve oynatma hızı kaydedilir; bağlı yapay zekân seni değerlendirirken bunları da görür.")}</li>
        <li>{msg("Duraklattığında öneriler gizlenir; notunu alıp hazır olunca devam edersin.")}</li>
      </ul>
      <Callout tone="info">
        {msg("\n        Bazı kanallar videolarının başka sitelerde oynatılmasını kapatır. O zaman Focus bunu söyler ve ")}<strong>{msg("YouTube’da aç")}</strong>{msg(" ")}
        {msg("\n        bağlantısını gösterir.\n      ")}</Callout>
    </>
  );
}

export function Progress() {
  return (
    <>
      <p>{msg("İlerleme ekranı hedefe ne kadar kaldığını ve çalışma alışkanlıklarını gösterir.")}</p>
      <H2 id="genel">{msg("Genel durum")}</H2>
      <p>{msg("Tamamlanan videolar, kalan çalışma süresi, tahmini bitiş ve hedef tarih durumu; kamp ve branş bazında ilerleme.")}</p>
      <H2 id="seri">{msg("Yetişir serisi")}</H2>
      <p>
        {msg("\n        En az bir görev tamamladığın her çalışma günü seriyi uzatır. Dinlenme ve deneme günleri seriyi bozmaz; bugün henüz görev\n        tamamlamadıysan seri kaybolmaz, gün bitene kadar bekler.\n      ")}</p>
      <H2 id="sorumluluk">{msg("Sorumluluk skoru")}</H2>
      <p>
        {msg("\n        Görevlerin ne kadarını planlandığı gün ya da daha önce bitirdiğin. Ertelenen ya da gününden sonra biten görevler skoru düşürür;\n        bugünün açık görevleri henüz sayılmaz.\n      ")}</p>
      <H2 id="isi-haritasi">{msg("Çalışma ısı haritası")}</H2>
      <p>{msg("Son 13 haftada gün gün kaç video ve kaç dakika çalıştığın. Üzerine gelince o günün ayrıntısı görünür.")}</p>
      <H2 id="erteleme">{msg("Erteleme analizi")}</H2>
      <p>
        {msg("\n        Ritmi güncellerken seçtiğin nedenlerin dağılımı ve en çok ertelenen branş. Örneğin “Ertelemelerinin %55’i sosyal medya kaynaklı”\n        ya da bir branşın diğerlerinden belirgin biçimde daha çok ertelendiği.\n      ")}</p>
    </>
  );
}

export function Kesfet() {
  return (
    <>
      <p>
        <strong>{msg("Keşfet")}</strong>{msg(", öğrencilerin yayınladığı kampların rafıdır. Bir kampın içine bakar, kimin hazırladığını görür, beğendiğini\n        tek tıkla kendi planına kopyalarsın. Kopya eklendiği gün başlar; yayınlayanın ilerlemesi gelmez.\n      ")}</p>
      <H2 id="yayinlama">{msg("Kampını yayınlamak")}</H2>
      <Steps>
        {[
          <><strong>{msg("Kamplar")}</strong> {msg(" sayfasında kampının kartındaki ⋯ menüsünden ")}<strong>{msg("Keşfet’te yayınla")}</strong>{msg("’yı seç.")}</>,
          <>{msg("İstersen bir ")}<strong>{msg("kapak fotoğrafı")}</strong> {msg(" yükle (yüklemezsen branş renklerinden bir kapak çizilir), adı ve açıklamayı düzenle; kampın Keşfet’te ")}<strong>{msg("görünen adınla")}</strong> {msg(" çıkar.")}</>,
          <>{msg("Kampının konusunu anlatan en fazla 5 ")}<strong>{msg("ilgi etiketi")}</strong> {msg(" ekle (#yks, #matematik gibi); Keşfet’te arayanlar kampını bu etiketlerle bulur.")}</>,
          <>{msg("Yayınla. Yayındaki kampın kartında “Keşfet’te yayında” yazar; aynı ⋯ menüsünden ")}<strong>{msg("Yayını güncelle")}</strong> {msg(" ile içeriğini yenileyebilir, ")}<strong>{msg("Yayından kaldır")}</strong> {msg(" ile kaldırabilirsin.")}</>,
        ]}
      </Steps>
      <p>{msg("Yayınlanan: kampın adı, kapağı, etiketleri, temposu, branşları ve videoları. Yayınlanmayan: ilerlemen, notların, ritim güncellemelerin ve e-postan.")}</p>
      <H2 id="kaydetmek">{msg("Kaydetmek")}</H2>
      <p>
        {msg("\n        Hemen eklemek istemediğin bir kampı kartındaki kalple ")}<strong>{msg("kaydet")}</strong>{msg("; Keşfet’in üstündeki ")}<strong>{msg("Favoriler")}</strong>{msg("’de toplanır. Kendi yayınladıkların ")}<strong>{msg("Paylaştıklarım")}</strong>{msg("’da.\n        Kalbin yanındaki sayı kampı kaç kişinin kaydettiğini gösterir; kimin kaydettiği görünmez.\n      ")}</p>
      <Callout tone="warn" title={msg("Yalnızca kendi kampın")}>
        {msg("\n        Keşfet’ten ya da bir paylaşım linkinden eklediğin kamplar başkasının emeğidir; bunları kendi adınla yayınlayamazsın. Aynı videolardan\n        oluşan bir kampı başka biri zaten yayınladıysa ikinci yayın da reddedilir.\n      ")}</Callout>
      <H2 id="paylasim-linki">{msg("Paylaşım linki")}</H2>
      <p>
        {msg("\n        Bir kamp, ")}<code>{msg("/app?import=…")}</code> {msg(" biçiminde bir linkle de gelebilir. Linki açınca “Yeni kampı içe aktarmak istiyor musun?” diye\n        sorulur; onaylarsan kamp o gün başlar. Bozuk ya da eksik bir link hiçbir şey eklemez.\n      ")}</p>
    </>
  );
}

export function AiOverview() {
  return (
    <>
      <p>
        {msg("\n        Yetişir bir ")}<strong>{msg("MCP")}</strong> {msg(" (Model Context Protocol) sunucusu sunar. Claude, ChatGPT ya da Grok’u hesabına bağladığında\n        yapay zekân:\n      ")}</p>
      <ul>
        <li>
          <strong>{msg("seni değerlendirir:")}</strong> {msg(" “Nasıl gidiyorum?” dediğinde ilerlemeni, serini, sorumluluk skorunu ve erteleme nedenlerini\n          okuyup yorumlar;\n        ")}</li>
        <li>
          <strong>{msg("günlerini anlatır:")}</strong> {msg(" “Bu hafta neyi yetiştirmem lazım?” dediğinde geciken ve sıradaki görevlerini sayar;\n        ")}</li>
        <li>
          <strong>{msg("kampını kurar:")}</strong> {msg(" hedefini, süreni ve oynatma listelerini sohbette konuşursunuz; kampı doğrular ve bir önizleme bağlantısı verir. Tüm listeyi inceleyip ")}<strong>{msg("Planıma ekle")}</strong> {msg(" dediğinde kaydedersin;\n        ")}</li>
        <li>
          <strong>{msg("Keşfet’te arar")}</strong> {msg(" ve beğendiğin kampı inceleyip planına eklemen için önizleme hazırlar.\n        ")}</li>
      </ul>
      <H2 id="baglan">{msg("Bağlan")}</H2>
      <Cards>
        <PageCard to="claude" title={msg("Claude")} icon={<AiLogo client="claude" size={18} />}>
          {msg("\n          claude.ai, masaüstü ve mobil uygulama; Claude Code.\n        ")}</PageCard>
        <PageCard to="chatgpt" title={msg("ChatGPT")} icon={<AiLogo client="chatgpt" size={18} />}>
          {msg("\n          MCP uygulaması olarak; hesabındaki araç izinlerine bağlı.\n        ")}</PageCard>
        <PageCard to="grok" title={msg("Grok")} icon={<AiLogo client="grok" size={18} />}>
          {msg("\n          grok.com’da Eklentiler’den özel bağlayıcı olarak.\n        ")}</PageCard>
        <PageCard to="kamp-json" title={msg("Kamp JSON formatı")} icon={<Compass className="size-4 text-forest" />}>
          {msg("\n          Yapay zekânın kampı yazarken uyduğu sınırlar.\n        ")}</PageCard>
      </Cards>
      <H2 id="adres">{msg("Bağlantı adresi")}</H2>
      <CodeBlock label="MCP adresi">{mcpUrl()}</CodeBlock>
      <H2 id="guvenlik">{msg("Güvenlik")}</H2>
      <ul>
        <li>{msg("Bağlanırken Yetişir’in onay sayfası açılır; giriş yapıp ")}<strong>{msg("İzin ver")}</strong> {msg(" dersin. Onay vermeden hiçbir şey okunamaz.")}</li>
        <li>{msg("Yapay zekâ yalnızca kendi planını görür ve yalnızca kamp ekleyebilir: bir şey silemez, Keşfet’te yayın yapamaz, şifrene ulaşamaz.")}</li>
        <li>{msg("Kamptaki her video YouTube’dan yeniden okunur; başlık ve süre YouTube’dan gelir, uydurma bir video plana giremez.")}</li>
        <li>
          {msg("\n          Bağlı uygulamalarını ")}<strong>{msg("Profil ve ayarlar")}</strong>{msg("’da görür, istediğini oradan kaldırırsın.\n        ")}</li>
      </ul>
    </>
  );
}

export function ClaudeDoc() {
  return (
    <>
      <p>{msg("Claude web, masaüstü ve mobil uygulamada özel bağlayıcı (custom connector) olarak eklenir. Bir kez bağlaman yeter.")}</p>
      <H2 id="claude-ai">{msg("claude.ai ve Claude uygulaması")}</H2>
      <Steps>
        {[
          <>{msg("Claude’da ")}<strong>{msg("Ayarlar → Connectors")}</strong>{msg("’a gir ve ")}<strong>{msg("Add custom connector")}</strong>{msg("’a bas.")}</>,
          <>
            {msg("\n            Ad olarak ")}<strong>{msg("Yetişir")}</strong>{msg(", URL olarak aşağıdaki adresi yaz ve ")}<strong>{msg("Add")}</strong> {msg(" de.\n            ")}<div className="mt-3">
              <CodeBlock label="URL">{mcpUrl()}</CodeBlock>
            </div>
          </>,
          <>{msg("Bağlayıcının yanındaki ")}<strong>{msg("Connect")}</strong>{msg("’e bas. Yetişir’in onay sayfası açılır: giriş yap ve ")}<strong>{msg("İzin ver")}</strong>{msg("’e bas.")}</>,
          <>{msg("Sohbette araçlar menüsünden Yetişir’in açık olduğundan emin ol ve sor: “Nasıl gidiyorum?”")}</>,
        ]}
      </Steps>
      <H2 id="claude-code">{msg("Claude Code")}</H2>
      <CodeBlock label="Terminal">{`claude mcp add --transport http yetisir ${mcpUrl()}`}</CodeBlock>
      <p>
        {msg("\n        Ardından Claude Code’da ")}<code>{msg("/mcp")}</code> {msg(" komutuyla Yetişir’i seçip giriş yap.\n      ")}</p>
      <Callout tone="tip">{msg("Bağlandıktan sonra Profil ve ayarlar sayfasında Claude logosunun çevresi yeşil olur.")}</Callout>
    </>
  );
}

export function ChatGptDoc() {
  return (
    <>
      <p>{msg("ChatGPT’ye Yetişir’i bir MCP uygulaması olarak bağlayabilirsin. Bir kez bağlandıktan sonra sohbetten planını okuyabilir; hesabındaki araç izinleri uygunsa kamp ekleyebilirsin.")}</p>
      <Steps>
        {[
          <>
            {msg("\n            ChatGPT’de ")}<strong>{msg("Eklentiler → Ekle → MCP uygulaması oluştur")}</strong> {msg(" yolunu aç. Bu seçenek görünmüyorsa ")}<strong>{msg("Ayarlar → Security and login → Developer mode")}</strong> {msg(" ayarını kontrol et.\n          ")}</>,
          <>
            <strong>{msg("Ad")}</strong> {msg(" alanına ")}<strong>{msg("Yetişir")}</strong> {msg(" yaz. ")}<strong>{msg("Bağlantı")}</strong> {msg(" için ")}<strong>{msg("Sunucu URL’si")}</strong> {msg(" seçip aşağıdaki adresi gir; ")}<strong>{msg("Kimlik doğrulama")}</strong> {msg(" alanını ")}<strong>{msg("OAuth")}</strong> {msg(" olarak bırak. Simge isteğe bağlıdır, gelişmiş OAuth ayarlarını otomatik bırakabilirsin.\n            ")}<div className="mt-3">
              <CodeBlock label="Sunucu URL’si">{mcpUrl()}</CodeBlock>
            </div>
          </>,
          <>{msg("Güven uyarısını okuyup kabul et ve uygulamayı oluştur. Yetişir’in izin sayfası açılır; doğru hesapla giriş yaptığını kontrol edip ")}<strong>{msg("İzin ver")}</strong>{msg("’e bas.")}</>,
          <>{msg("ChatGPT’ye döndüğünde gerekirse ")}<strong>{msg("Kişisel")}</strong> {msg(" eklentilerde Yetişir’i bulup ekle. Ardından ")}<strong>{msg("Work")}</strong> {msg(" sohbeti aç ve ")}<strong>{msg("@Yetişir")}</strong> {msg(" seç.")}</>,
          <>{msg("Önce “Nasıl gidiyorum?” diye sorarak okuma aracını dene. Kamp kurmak için hedefini ve oynatma listeni anlat; ChatGPT’nin verdiği Yetişir önizleme bağlantısını aç, tüm listeyi incele ve ")}<strong>{msg("Planıma ekle")}</strong>{msg("’ye bas.")}</>,
        ]}
      </Steps>
      <Callout tone="info">
        {msg("\n        MCP uygulaması oluşturabilmen, kamp ekleme gibi yazma işlemlerinin hesabında açık olduğunu tek başına göstermez. Araçlar görünmüyorsa veya ")}<code>{msg("send_camp")}</code> {msg(" çalışmıyorsa ChatGPT hesap ve çalışma alanı izinlerini kontrol et.")}{msg(" ")}
        <a href="https://developers.openai.com/plugins/quickstart" target="_blank" rel="noreferrer">{msg("OpenAI kurulum rehberi")}</a> {msg(" ·")}{msg(" ")}
        <a href="https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt" target="_blank" rel="noreferrer">{msg("erişim koşulları")}</a>
      </Callout>
    </>
  );
}

export function GrokDoc() {
  return (
    <>
      <p>{msg("Grok’a Yetişir’i özel bir MCP bağlayıcısı olarak ekleyebilirsin. Bağlandıktan sonra Grok sohbette planını ve ilerlemeni okur, kamp önerisi hazırlar.")}</p>
      <Steps>
        {[
          <>
            <a href="https://grok.com" target="_blank" rel="noreferrer">{msg("grok.com")}</a>{msg("’da sol alttaki ")}<strong>{msg("Eklentiler")}</strong>{msg("’e bas. Sağ üstten ")}<strong>{msg("Yeni Bağlayıcı")}</strong>{msg("’yı aç ve ")}<strong>{msg("Özelleştirilmiş")}</strong>{msg("’i seç.\n          ")}</>,
          <>
            <strong>{msg("Ad")}</strong> {msg(" alanına ")}<strong>{msg("Yetişir")}</strong> {msg(" yaz, ")}<strong>{msg("Sunucu URL’si")}</strong> {msg(" alanına aşağıdaki adresi gir ve ")}<strong>{msg("Bağlayıcı Ekle")}</strong>{msg("’ye bas.\n            ")}<div className="mt-3">
              <CodeBlock label="Sunucu URL’si">{mcpUrl()}</CodeBlock>
            </div>
          </>,
          <>{msg("Yetişir’in izin sayfası açılır; doğru hesapla giriş yaptığını kontrol edip ")}<strong>{msg("İzin ver")}</strong>{msg("’e bas.")}</>,
          <>{msg("Önce “Nasıl gidiyorum?” diye sorarak okuma aracını dene. Kamp kurmak için hedefini ve oynatma listeni anlat; Grok’un verdiği Yetişir önizleme bağlantısını aç, tüm listeyi incele ve ")}<strong>{msg("Planıma ekle")}</strong>{msg("’ye bas.")}</>,
        ]}
      </Steps>
      <Callout tone="info">
        {msg("\n        Yetişir, Eklentiler’de ")}<strong>{msg("Bağlı")}</strong> {msg(" altında görünür. Bağlı görünüp araçlar gelmiyorsa bağlayıcıyı kaldırıp yeniden ekle; izin sayfası açılmadan bağlantı tamamlanmış sayılmaz.")}{msg(" ")}
        <a href="https://docs.x.ai/grok/connectors" target="_blank" rel="noreferrer">{msg("xAI bağlayıcı rehberi")}</a>
      </Callout>
    </>
  );
}

export function CampJson() {
  return (
    <>
      <p>
        {msg("\n        Yapay zekâ bir kampı ")}<code>{msg("send_camp")}</code> {msg(" aracıyla, aşağıdaki JSON biçiminde önizlemeye hazırlar. Sınırlar uygulamanın kendi formlarıyla\n        aynıdır; bir sorun olursa yeriyle birlikte bildirilir (")}<code>{msg("camp.branches[2].videos[5].youtubeId")}</code> {msg(" gibi). Kamp yalnızca\n        sen tüm listeyi inceleyip Yetişir’de onayladığında planına eklenir.\n      ")}</p>
      <CodeBlock label="Örnek">{msg("{\n  \"name\": \"TYT 2027\",\n  \"schedule\": {\n    \"mode\": \"auto\",\n    \"dailyStudyHours\": 3,\n    \"playbackSpeed\": 1.5,\n    \"practiceMultiplier\": 0.2,\n    \"maxSubjectsPerDay\": 2,\n    \"activeDays\": [1, 2, 3, 4, 5, 6],\n    \"mockExamDays\": [0]\n  },\n  \"branches\": [\n    {\n      \"subject\": \"Matematik\",\n      \"title\": \"TYT Matematik Kampı\",\n      \"videos\": [{ \"title\": \"Temel Kavramlar\", \"minutes\": 42, \"youtubeId\": \"xxxxxxxxxxx\" }]\n    },\n    { \"subject\": \"Türkçe\", \"videos\": [{ \"title\": \"Paragraf çalışması\", \"minutes\": 60 }] }\n  ]\n}")}</CodeBlock>
      <H2 id="sinirlar">{msg("Sınırlar")}</H2>
      <table>
        <tbody>
          <tr>
            <td>{msg("Kamp adı")}</td>
            <td>{msg("1–80 karakter")}</td>
          </tr>
          <tr>
            <td>{msg("Branşlar")}</td>
            <td>{msg("1–40; toplam en çok 5.000 video ve konu")}</td>
          </tr>
          <tr>
            <td>{msg("Branş adı")}</td>
            <td>{msg("1–40 karakter")}</td>
          </tr>
          <tr>
            <td>{msg("Video / konu")}</td>
            <td>{msg("başlık 1–200 karakter; süre 0’dan büyük, en çok 600 dakika")}</td>
          </tr>
          <tr>
            <td>{msg("youtubeId")}</td>
            <td>{msg("11 karakterlik video id’si; yoksa öğe linksiz bir konudur")}</td>
          </tr>
          <tr>
            <td>{msg("Günlük süre")}</td>
            <td>{msg("0,5–16 saat")}</td>
          </tr>
          <tr>
            <td>{msg("İzleme hızı")}</td>
            <td>{msg("1, 1.25, 1.5, 1.75 ya da 2")}</td>
          </tr>
          <tr>
            <td>{msg("Tekrar payı")}</td>
            <td>{msg("0, 0.1, 0.2, 0.3, 0.5, 0.75 ya da 1")}</td>
          </tr>
          <tr>
            <td>{msg("Günler")}</td>
            <td>{msg("0 = pazar … 6 = cumartesi; deneme günleri çalışma günleriyle çakışmaz")}</td>
          </tr>
        </tbody>
      </table>
      <H3 id="elle-mod">{msg("Elle yerleştirme")}</H3>
      <p>
        <code>{msg("\"mode\": \"manual\"")}</code> {msg(" ile ")}<code>{msg("weekPlan")}</code> {msg(" verilir: pazardan başlayan yedi liste, her biri o gün çalışılacak branşların\n        sırası (0’dan başlar). Her branş en az bir günde olmalıdır.\n      ")}</p>
      <Callout tone="info">{msg("Kamp her zaman eklendiği gün başlar; JSON’da başlangıç ya da hedef tarih yoktur.")}</Callout>
    </>
  );
}

export function Account() {
  return (
    <>
      <H2 id="senkron">{msg("Her cihazda aynı plan")}</H2>
      <p>
        {msg("\n        Kampların, ilerlemen ve notların hesabına kaydedilir. Hangi cihazdan giriş yaparsan yap planın seninle. İki cihaz aynı anda\n        kaydederse yenisi açılır, diğer cihazdaki kaydedilmemiş değişiklikler kaybolmaz; ayrıca saklanır.\n      ")}</p>
      <H2 id="profil">{msg("Profil ve ayarlar")}</H2>
      <p>
        {msg("\n        Kenar çubuğunun altındaki profil satırı ")}<strong>{msg("Profil ve ayarlar")}</strong> {msg(" sayfasını açar: profil resmin, görünen adın (Keşfet’te\n        yayınladığın kamplarda görünür), okul ve bölüm bilgilerin, Hakkında yazın, yapay zekâ bağlantıların, verilerin ve en altta çıkış.\n        Yanındaki dişli ")}<strong>{msg("Tercihler")}</strong> {msg(" penceresini açar: açık, koyu ya da cihazını izleyen görünüm buradan seçilir.\n      ")}</p>
      <p>
        {msg("\n        İlk girişte birkaç kısa soru sorulur: sekiz çizim arasından bir profil resmi (ya da kendi fotoğrafın), şu an ne yaptığın (lise,\n        sınava hazırlık, üniversite, mezun ya da çalışıyor) buna göre okulun, bölümün, sınıfın ya da mesleğin ve istersen hedeflerini anlatan kısa bir “Hakkında” yazısı. Hepsi isteğe bağlı;\n        sonra ")}<strong>{msg("Profili düzenle")}</strong> {msg(" ile değiştirebilirsin. Keşfet’te kamplarının yanında profil resmin, adın, durumun, bölümün ya da mesleğin ve Hakkında yazın görünür; okulun, sınıfın ve e-postan yalnızca sende kalır.\n      ")}</p>
      <H2 id="yedek">{msg("Yedek")}</H2>
      <p>
        <strong>{msg("Yedek indir")}</strong> {msg(" tüm kamplarını, tamamlananları, ritim güncellemelerini ve notları tek bir JSON dosyasına yazar.")}{msg(" ")}
        <strong>{msg("Yedekten geri yükle")}</strong> {msg(" dosyayı kontrol eder ve onayından sonra mevcut verilerin yerine koyar; bozuk bir dosya hiç\n        yüklenmez.\n      ")}</p>
      <H2 id="sifirla">{msg("Sıfırlama")}</H2>
      <p>
        <strong>{msg("Tüm verileri sıfırla")}</strong> {msg(" hesabındaki bütün kampları ve ilerlemeyi siler; giriş yaptığın her cihazdan gider ve geri\n        alınamaz. Emin değilsen önce yedek indir.\n      ")}</p>
      <H2 id="demo">{msg("Demo")}</H2>
      <p>{msg("Demo örnek bir kamp açar ve hiçbir şey kaydetmez; çıktığında kendi planın olduğu gibi durur.")}</p>
    </>
  );
}
