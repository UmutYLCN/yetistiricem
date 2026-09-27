import { Bot, CalendarCheck, Compass, Library, Sparkles } from 'lucide-react';
import { AiLogo } from '../ui/AiLogos';
import { Callout, Cards, CodeBlock, DocLink, H2, H3, PageCard, Steps } from './kit';

// The text of every docs page (listed in `content.ts`). It describes the app
// as it works; when a screen changes, change its page here.


const mcpUrl = () => `${window.location.origin}/mcp`;

export function Overview() {
  return (
    <>
      <p>
        <strong>Panik yok, yetişir.</strong> Yetişir, YouTube oynatma listelerindeki ders videolarını ve kendi yazdığın konuları günlük
        çalışma süreni aşmayacak şekilde günlere dağıtır. Her gün yalnızca bugünün görevlerine bakarsın; hedef tarihine yetişip
        yetişmediğini de takvim söyler.
      </p>
      <H2 id="kavramlar">Temel kavramlar</H2>
      <ul>
        <li>
          <strong>Kamp:</strong> büyük hedefin tamamı, örneğin “TYT 2027” ya da “İngilizce”. Her kampın kendi temposu ve takvimi vardır.
        </li>
        <li>
          <strong>Branş:</strong> kampın içindeki ders ya da konu grubu, örneğin Matematik. Genellikle tek bir oynatma listesidir.
        </li>
        <li>
          <strong>Görev:</strong> planlanan gündeki tek bir video ya da konu.
        </li>
        <li>
          <strong>Tempo:</strong> günlük süre, izleme hızı, tekrar payı ve çalışma günleri. Takvim bunlardan hesaplanır.
        </li>
      </ul>
      <H2 id="nereden-baslamali">Nereden başlamalı?</H2>
      <Cards>
        <PageCard to="hizli-baslangic" title="Hızlı başlangıç" icon={<Sparkles className="size-4 text-forest" />}>
          Hesabını aç, ilk kampını birkaç dakikada kur.
        </PageCard>
        <PageCard to="kamp-olusturma" title="Kamp oluşturma" icon={<Library className="size-4 text-forest" />}>
          Sihirbazın dört adımı ve her adımda neyi seçtiğin.
        </PageCard>
        <PageCard to="bugun" title="Her gün" icon={<CalendarCheck className="size-4 text-forest" />}>
          Bugün, Yol ve Haftalık ekranlarıyla günlük kullanım.
        </PageCard>
        <PageCard to="yapay-zeka" title="Yapay zekâ" icon={<Bot className="size-4 text-forest" />}>
          Claude, ChatGPT ya da Gemini’yi bağla; seni değerlendirsin, kampını kursun.
        </PageCard>
      </Cards>
    </>
  );
}

export function QuickStart() {
  return (
    <>
      <p>İlk kampını kurup ilk gününü görmek birkaç dakika sürer.</p>
      <Steps>
        {[
          <>
            <strong>Hesabını aç.</strong> Ana sayfadaki <strong>Giriş yap ve başla</strong> ile e-posta ve şifreyle hesap oluştur. Önce
            bakmak istersen <strong>Demo ile göz at</strong> örnek bir kampı açar; demoda hiçbir şey kaydedilmez.
          </>,
          <>
            <strong>Kaynaklarını ekle.</strong> Bir YouTube oynatma listesinin bağlantısını yapıştır; videolar adları ve gerçek süreleriyle
            gelir. Ayrıntılar: <DocLink to="kaynaklar">Branşlar ve kaynaklar</DocLink>.
          </>,
          <>
            <strong>Kampına ad ver</strong>, başlangıç tarihini seç. Hedef tarih isteğe bağlıdır.
          </>,
          <>
            <strong>Ritmini seç:</strong> günlük süreni ve çalışma günlerini söyle ya da branşları günlere kendin yerleştir. Bkz.{' '}
            <DocLink to="tempo">Tempo ve ritim</DocLink>.
          </>,
          <>
            <strong>Önizle ve kaydet.</strong> Takvimi, tahmini bitişi ve hedefe yetişip yetişmediğini gör. Kaydedince{' '}
            <strong>Bugün</strong> ekranı ilk günün görevleriyle açılır.
          </>,
        ]}
      </Steps>
      <Callout tone="tip" title="Uğraşmak istemiyor musun?">
        Yapay zekânı bağla, sohbette anlat; kampı o kursun. Bkz. <DocLink to="yapay-zeka">Yapay zekâ</DocLink>.
      </Callout>
    </>
  );
}

export function CampWizard() {
  return (
    <>
      <p>
        Yeni kamp sihirbazı kenar çubuğundaki <strong>Yeni kamp</strong> ile açılır. Kaydetmeden önce her şeyi önizler; istediğin adıma
        geri dönebilirsin ve kapatsan bile taslak durur.
      </p>
      <H2 id="adimlar">Dört adım</H2>
      <Steps>
        {[
          <>
            <strong>Kaynaklar.</strong> Oynatma listesi, video bağlantıları ya da elle yazılan konular. Her kaynak kendi branş kartı olur;
            branşın adını, rengini ve videolarını düzenleyebilirsin. Devam etmek için en az bir branş gerekir.
          </>,
          <>
            <strong>Kamp.</strong> Ad (en çok 80 karakter) ve başlangıç tarihi gerekir. Hedef bitiş tarihi isteğe bağlıdır; +1, +3 ve +6 ay
            kısayolları vardır.
          </>,
          <>
            <strong>Ritim.</strong> Otomatik dağıtım ya da branşları günlere elle yerleştirme. Bkz. <DocLink to="tempo">Tempo ve ritim</DocLink>.
          </>,
          <>
            <strong>Önizleme.</strong> İlk çalışma günü, tahmini bitiş, toplam çalışma, hedef tarih durumu ve gün gün takvim. Hiçbir şey
            henüz kaydedilmemiştir.
          </>,
        ]}
      </Steps>
      <H2 id="brans-ekleme">Çalışan kampa branş eklemek</H2>
      <p>
        <strong>Kamplar</strong> sayfasındaki <strong>Branş ekle</strong> yeni kamp açmaz; açık kampa branş ekler. Kampın adı, tarihleri ve
        temposu korunur. Geçmiş günlere düşecek yeni görevler yarından başlar, böylece yeni branş ilk videosundan başlar.
      </p>
      <H2 id="birden-fazla-kamp">Birden fazla kamp</H2>
      <p>
        İki ya da daha fazla kampın olduğunda Bugün, Haftalık ve İlerleme ekranları <strong>Tüm Kamplar</strong> görünümünü açar: görevler
        tek akışta, her biri kamp ve branş adıyla. Her kamp kendi temposuyla planlanır; bir kampı değiştirmek diğerini etkilemez.
      </p>
    </>
  );
}

export function Sources() {
  return (
    <>
      <p>Bir branşın videoları üç yoldan gelir. Başlık ve süreler hiçbir zaman tahmin edilmez: ya YouTube’dan okunur ya da sen yazarsın.</p>
      <H2 id="oynatma-listesi">Oynatma listesi</H2>
      <p>
        Herkese açık ya da liste dışı bir YouTube oynatma listesinin bağlantısını yapıştır. Videolar sırasıyla, gerçek süreleri ve kanal
        adlarıyla gelir; eklemeden önce listeyi gözden geçirirsin. Her oynatma listesi ayrı bir branş olur.
      </p>
      <p>Uygulama bazı videoları kendiliğinden dışarıda bırakır ve nedenini gösterir:</p>
      <ul>
        <li>gizli, silinmiş ya da kaldırılmış videolar,</li>
        <li>canlı yayınlar ve henüz yayınlanmamış videolar,</li>
        <li>listede ikinci kez geçen videolar,</li>
        <li>10 saatten uzun videolar,</li>
        <li>Türkiye’de engelli olabilecek videolar (istersen yine seçebilirsin).</li>
      </ul>
      <Callout tone="info">Özel (private) oynatma listeleri ve “Daha sonra izle” gibi kişisel listeler YouTube tarafından paylaşılmadığı için okunamaz.</Callout>
      <H2 id="videolar">Video bağlantıları</H2>
      <p>Bir ya da birden çok video bağlantısını yapıştır; başlık ve süre yine YouTube’dan okunur. Yeni bir branşa ya da var olana eklenebilirler.</p>
      <H2 id="konular">Elle eklenen konular</H2>
      <p>
        YouTube dışındaki dersler için konu adını ve süresini yaz; Enter bir sonrakini ekler, yapıştırdığın satırlar ayrı konulara bölünür.
        Bu görevler bağlantısız başlar; video bağlantısını sonra plandaki <strong>Bağlantı ekle</strong> ile ekleyebilirsin.
      </p>
      <H2 id="yeni-videolar">Listeye eklenen yeni videolar</H2>
      <p>
        Oynatma listesiyle eklenen branşlar günde en fazla bir kez kontrol edilir. Listeye yeni ders eklendiyse sağ üstteki zilde görünür;{' '}
        <strong>Planımın sonuna ekle</strong> ile branşın sonuna eklenir, <strong>Göz ardı et</strong> ile bir daha sorulmaz.
      </p>
    </>
  );
}

export function Tempo() {
  return (
    <>
      <p>
        Tempo kampa aittir ve <strong>Kamplar → Tempoyu düzenle</strong> ile değişir. Takvim tempodan yeniden hesaplanır; tamamladığın
        görevler ve ritim güncellemelerin korunur.
      </p>
      <H2 id="ayarlar">Tempo ayarları</H2>
      <table>
        <thead>
          <tr>
            <th>Ayar</th>
            <th>Ne yapar</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Günlük süre</td>
            <td>Bir çalışma gününe sığacak toplam süre: video, not ve soru çözme dahil. 0,5–16 saat.</td>
          </tr>
          <tr>
            <td>İzleme hızı</td>
            <td>Videoları kaç kat hızla izlediğin: 1x, 1,25x, 1,5x, 1,75x ya da 2x. Süreler buna göre kısalır.</td>
          </tr>
          <tr>
            <td>Tekrar payı</td>
            <td>Her videoya not ve pratik için eklenen süre, %0–100. %20, 30 dakikalık bir videoya 6 dakika ekler.</td>
          </tr>
          <tr>
            <td>Günde kaç branş</td>
            <td>Otomatik dağıtımda bir güne en çok kaç farklı branş gelsin.</td>
          </tr>
        </tbody>
      </table>
      <H2 id="otomatik">Otomatik dağıtım</H2>
      <p>
        Hafif, Dengeli ya da Yoğun ön ayarından birini seçmen yeter; çalışma günleri, günlük süre ve günlük branş sayısını istersen tek tek
        değiştirirsin. Branşlar çalışma günlerine sırayla dağılır. İsteğe bağlı bir deneme günü o günü boş tutar.
      </p>
      <H2 id="elle">Elle yerleştirme</H2>
      <p>
        Haftanın her gününü Ders, Deneme ya da Dinlenme yaparsın; ders günlerine branş seçersin. Önerilen bir dağılımla başlar. Hiçbir güne
        konmamış branş olursa uygulama uyarır ve “En boş günlere yerleştir” önerir.
      </p>
      <H2 id="yetisir-mi">“Yetişir mi?” hesabı</H2>
      <p>
        Hedef tarih seçtiğinde son görevin günü hedefle karşılaştırılır. Yetişiyorsa <strong>Panik yok, yetişir.</strong> ve kaç gün
        erken bittiği yazar. Yetişmiyorsa kaç gün geride olduğunu ve günlük süreyi ne kadar yaparsan yetişeceğini söyler; tek dokunuşla
        uygulayabilirsin.
      </p>
      <Callout tone="info">Hedef tarih planı sıkıştırmaz: hiçbir video atlanmaz, günler taşırılmaz. Öneriler yalnızca günlük süreyi değiştirir.</Callout>
    </>
  );
}

export function Daily() {
  return (
    <>
      <p>Her gün yalnızca bugünün görevlerine bakarsın. Bir görevi işaretlemek planı değiştirmez; işareti geri alabilirsin.</p>
      <H2 id="bugun">Bugün</H2>
      <p>
        Seçili günün görevleri, tahmini çalışma süresi ve haftanın kısa görünümü. Hafta şeridinden başka bir güne geçebilirsin. Sağ
        tarafta genel ilerleme, tahmini bitiş ve hedef tarihin durur.
      </p>
      <H2 id="yol">Yol</H2>
      <p>
        Günün görevleri kıvrılan bir yol üzerinde durak durak. Bir durağa dokununca video yandaki panelde açılır; <strong>İzledim</strong>{' '}
        görevi tamamlar ve yol sıradaki durağa ilerler.
      </p>
      <H2 id="haftalik">Haftalık</H2>
      <p>Hafta rotası ve kaydırılabilir gün kartları. Görevleri buradan da işaretleyebilirsin.</p>
      <Callout tone="tip">
        Geride kaldıysan görevler kırmızıyla öne çıkar. Ne yapacağın: <DocLink to="ritmi-guncelle">Ritmi güncelle</DocLink>.
      </Callout>
    </>
  );
}

export function Reschedule() {
  return (
    <>
      <p>
        Bir gün aksadıysa suçluluk yok. Plan sen istemedikçe değişmez; geride kalan görevleri <strong>Ritmi güncelle</strong> ile sonraki
        uygun çalışma günlerine yayarsın. Tamamladıkların yerinde kalır.
      </p>
      <H2 id="nasil">Nasıl yapılır?</H2>
      <Steps>
        {[
          <>Geçmiş bir günde tamamlanmamış görev varsa kırmızı kartta <strong>Ritmi güncelle</strong>’ye bas.</>,
          <>
            <strong>Neden yetişmedi?</strong> sorusunda bir neden seç: sosyal medya / dikkat dağınıklığı, ders ağır geldi, yorgunluk, zaman
            yetmedi ya da isteksizlik. İstersen <strong>Belirtmeden güncelle</strong> ile geçebilirsin.
          </>,
          <>Kalanlar yarından itibaren yeniden dağılır. Seçtiğin nedene göre küçük bir öneri görürsün; <strong>Geri al</strong> ile vazgeçebilirsin.</>,
        ]}
      </Steps>
      <H2 id="oneriler">Öneriler</H2>
      <p>
        Öneriler küçük ve somuttur. Ders ağır geldiyse “2 dakika kuralı” (videonun yalnızca ilk 5 dakikası); dikkat dağıldıysa telefonu
        uzaklaştırıp <DocLink to="focus">Yetişir Focus</DocLink>; yorgunsan günü tek kısa bir videoyla kapatmak.
      </p>
      <H2 id="kritik">Defalarca ertelenen görevler</H2>
      <p>Bir görev üç kez ertelendiğinde üzerinde “Kritik” rozeti çıkar. Bugün ilk iş onu ele almayı dene.</p>
      <p>
        Nedenlerin <DocLink to="ilerleme" section="erteleme">İlerleme</DocLink> ekranında dağılım olarak görünür; seni en çok neyin
        zorladığını orada görürsün.
      </p>
    </>
  );
}

export function Focus() {
  return (
    <>
      <p>
        <strong>Yetişir Focus</strong>, videoyu YouTube’a gitmeden, önerisiz bir oynatıcıda izlemen için. Bir görevdeki{' '}
        <strong>Odaklan</strong> ile açılır.
      </p>
      <ul>
        <li>Video sonuna kadar izlendiğinde görev kendiliğinden tamamlanır ve sıradaki göreve geçebilirsin.</li>
        <li>İzleme süresi, duraklatma sayısı ve oynatma hızı kaydedilir; bağlı yapay zekân seni değerlendirirken bunları da görür.</li>
        <li>Duraklattığında öneriler gizlenir; notunu alıp hazır olunca devam edersin.</li>
      </ul>
      <Callout tone="info">
        Bazı kanallar videolarının başka sitelerde oynatılmasını kapatır. O zaman Focus bunu söyler ve <strong>YouTube’da aç</strong>{' '}
        bağlantısını gösterir.
      </Callout>
    </>
  );
}

export function Progress() {
  return (
    <>
      <p>İlerleme ekranı hedefe ne kadar kaldığını ve çalışma alışkanlıklarını gösterir.</p>
      <H2 id="genel">Genel durum</H2>
      <p>Tamamlanan videolar, kalan çalışma süresi, tahmini bitiş ve hedef tarih durumu; kamp ve branş bazında ilerleme.</p>
      <H2 id="seri">Yetişir serisi</H2>
      <p>
        En az bir görev tamamladığın her çalışma günü seriyi uzatır. Dinlenme ve deneme günleri seriyi bozmaz; bugün henüz görev
        tamamlamadıysan seri kaybolmaz, gün bitene kadar bekler.
      </p>
      <H2 id="sorumluluk">Sorumluluk skoru</H2>
      <p>
        Görevlerin ne kadarını planlandığı gün ya da daha önce bitirdiğin. Ertelenen ya da gününden sonra biten görevler skoru düşürür;
        bugünün açık görevleri henüz sayılmaz.
      </p>
      <H2 id="isi-haritasi">Çalışma ısı haritası</H2>
      <p>Son 13 haftada gün gün kaç video ve kaç dakika çalıştığın. Üzerine gelince o günün ayrıntısı görünür.</p>
      <H2 id="erteleme">Erteleme analizi</H2>
      <p>
        Ritmi güncellerken seçtiğin nedenlerin dağılımı ve en çok ertelenen branş. Örneğin “Ertelemelerinin %55’i sosyal medya kaynaklı”
        ya da bir branşın diğerlerinden belirgin biçimde daha çok ertelendiği.
      </p>
    </>
  );
}

export function Kesfet() {
  return (
    <>
      <p>
        <strong>Keşfet</strong>, öğrencilerin yayınladığı kampların rafıdır. Bir kampın içine bakar, kimin hazırladığını görür, beğendiğini
        tek tıkla kendi planına kopyalarsın. Kopya eklendiği gün başlar; yayınlayanın ilerlemesi gelmez.
      </p>
      <H2 id="yayinlama">Kampını yayınlamak</H2>
      <Steps>
        {[
          <><strong>Kamplar</strong> sayfasında kampının kartındaki ⋯ menüsünden <strong>Keşfet’te yayınla</strong>’yı seç.</>,
          <>İstersen bir <strong>kapak fotoğrafı</strong> yükle (yüklemezsen branş renklerinden bir kapak çizilir), adı ve açıklamayı düzenle; kampın Keşfet’te <strong>görünen adınla</strong> çıkar.</>,
          <>Kampının konusunu anlatan en fazla 5 <strong>ilgi etiketi</strong> ekle (#yks, #matematik gibi); Keşfet’te arayanlar kampını bu etiketlerle bulur.</>,
          <>Yayınla. Yayındaki kampın kartında “Keşfet’te yayında” yazar; aynı ⋯ menüsünden <strong>Yayını güncelle</strong> ile içeriğini yenileyebilir, <strong>Yayından kaldır</strong> ile kaldırabilirsin.</>,
        ]}
      </Steps>
      <p>Yayınlanan: kampın adı, kapağı, etiketleri, temposu, branşları ve videoları. Yayınlanmayan: ilerlemen, notların, ritim güncellemelerin ve e-postan.</p>
      <H2 id="kaydetmek">Kaydetmek</H2>
      <p>
        Hemen eklemek istemediğin bir kampı kartındaki kalple <strong>kaydet</strong>; Keşfet’in üstündeki <strong>Favoriler</strong>’de toplanır. Kendi yayınladıkların <strong>Paylaştıklarım</strong>’da.
        Kalbin yanındaki sayı kampı kaç kişinin kaydettiğini gösterir; kimin kaydettiği görünmez.
      </p>
      <Callout tone="warn" title="Yalnızca kendi kampın">
        Keşfet’ten ya da bir paylaşım linkinden eklediğin kamplar başkasının emeğidir; bunları kendi adınla yayınlayamazsın. Aynı videolardan
        oluşan bir kampı başka biri zaten yayınladıysa ikinci yayın da reddedilir.
      </Callout>
      <H2 id="paylasim-linki">Paylaşım linki</H2>
      <p>
        Bir kamp, <code>/app?import=…</code> biçiminde bir linkle de gelebilir. Linki açınca “Yeni kampı içe aktarmak istiyor musun?” diye
        sorulur; onaylarsan kamp o gün başlar. Bozuk ya da eksik bir link hiçbir şey eklemez.
      </p>
    </>
  );
}

export function AiOverview() {
  return (
    <>
      <p>
        Yetişir bir <strong>MCP</strong> (Model Context Protocol) sunucusu sunar. Claude, ChatGPT ya da Gemini’yi hesabına bağladığında
        yapay zekân:
      </p>
      <ul>
        <li>
          <strong>seni değerlendirir:</strong> “Nasıl gidiyorum?” dediğinde ilerlemeni, serini, sorumluluk skorunu ve erteleme nedenlerini
          okuyup yorumlar;
        </li>
        <li>
          <strong>günlerini anlatır:</strong> “Bu hafta neyi yetiştirmem lazım?” dediğinde geciken ve sıradaki görevlerini sayar;
        </li>
        <li>
          <strong>kampını kurar:</strong> hedefini, süreni ve oynatma listelerini sohbette konuşursunuz; kampı yazar, bitiş tarihini gösterir
          ve onayınla planına ekler;
        </li>
        <li>
          <strong>Keşfet’te arar</strong> ve beğendiğin kampı planına ekler.
        </li>
      </ul>
      <H2 id="baglan">Bağlan</H2>
      <Cards>
        <PageCard to="claude" title="Claude" icon={<AiLogo client="claude" size={18} />}>
          claude.ai, masaüstü ve mobil uygulama; Claude Code.
        </PageCard>
        <PageCard to="chatgpt" title="ChatGPT" icon={<AiLogo client="chatgpt" size={18} />}>
          Geliştirici modunda özel bağlayıcı olarak.
        </PageCard>
        <PageCard to="gemini" title="Gemini" icon={<AiLogo client="gemini" size={18} />}>
          Gemini CLI’da MCP sunucusu olarak.
        </PageCard>
        <PageCard to="kamp-json" title="Kamp JSON formatı" icon={<Compass className="size-4 text-forest" />}>
          Yapay zekânın kampı yazarken uyduğu sınırlar.
        </PageCard>
      </Cards>
      <H2 id="adres">Bağlantı adresi</H2>
      <CodeBlock label="MCP adresi">{mcpUrl()}</CodeBlock>
      <H2 id="guvenlik">Güvenlik</H2>
      <ul>
        <li>Bağlanırken Yetişir’in onay sayfası açılır; giriş yapıp <strong>İzin ver</strong> dersin. Onay vermeden hiçbir şey okunamaz.</li>
        <li>Yapay zekâ yalnızca kendi planını görür ve yalnızca kamp ekleyebilir: bir şey silemez, Keşfet’te yayın yapamaz, şifrene ulaşamaz.</li>
        <li>Kamptaki her video YouTube’dan yeniden okunur; başlık ve süre YouTube’dan gelir, uydurma bir video plana giremez.</li>
        <li>
          Bağlı uygulamalarını <strong>Profil ve ayarlar</strong>’da görür, istediğini oradan kaldırırsın.
        </li>
      </ul>
    </>
  );
}

export function ClaudeDoc() {
  return (
    <>
      <p>Claude web, masaüstü ve mobil uygulamada özel bağlayıcı (custom connector) olarak eklenir. Bir kez bağlaman yeter.</p>
      <H2 id="claude-ai">claude.ai ve Claude uygulaması</H2>
      <Steps>
        {[
          <>Claude’da <strong>Ayarlar → Connectors</strong>’a gir ve <strong>Add custom connector</strong>’a bas.</>,
          <>
            Ad olarak <strong>Yetişir</strong>, URL olarak aşağıdaki adresi yaz ve <strong>Add</strong> de.
            <div className="mt-3">
              <CodeBlock label="URL">{mcpUrl()}</CodeBlock>
            </div>
          </>,
          <>Bağlayıcının yanındaki <strong>Connect</strong>’e bas. Yetişir’in onay sayfası açılır: giriş yap ve <strong>İzin ver</strong>’e bas.</>,
          <>Sohbette araçlar menüsünden Yetişir’in açık olduğundan emin ol ve sor: “Nasıl gidiyorum?”</>,
        ]}
      </Steps>
      <H2 id="claude-code">Claude Code</H2>
      <CodeBlock label="Terminal">{`claude mcp add --transport http yetisir ${mcpUrl()}`}</CodeBlock>
      <p>
        Ardından Claude Code’da <code>/mcp</code> komutuyla Yetişir’i seçip giriş yap.
      </p>
      <Callout tone="tip">Bağlandıktan sonra Profil ve ayarlar sayfasında Claude logosunun çevresi yeşil olur.</Callout>
    </>
  );
}

export function ChatGptDoc() {
  return (
    <>
      <p>ChatGPT, özel MCP bağlayıcılarını geliştirici modunda ekler.</p>
      <Steps>
        {[
          <>ChatGPT’de <strong>Ayarlar → Apps &amp; Connectors → Advanced</strong>’a gir ve <strong>Developer mode</strong>’u aç.</>,
          <>
            <strong>Create</strong> ile yeni bir bağlayıcı oluştur: ad <strong>Yetişir</strong>, URL aşağıdaki adres, kimlik doğrulama{' '}
            <strong>OAuth</strong>.
            <div className="mt-3">
              <CodeBlock label="URL">{mcpUrl()}</CodeBlock>
            </div>
          </>,
          <>Açılan Yetişir sayfasında giriş yap ve <strong>İzin ver</strong>’e bas.</>,
          <>Yeni bir sohbette bağlayıcıyı seç ve sor: “Bu hafta neyi yetiştirmem lazım?”</>,
        ]}
      </Steps>
      <Callout tone="info">Menü adları ChatGPT sürümüne göre biraz farklı olabilir; aradığın bölüm “Connectors” ya da “Apps”.</Callout>
    </>
  );
}

export function GeminiDoc() {
  return (
    <>
      <p>Gemini, MCP sunucularını <strong>Gemini CLI</strong>’da destekler.</p>
      <Steps>
        {[
          <>
            <code>~/.gemini/settings.json</code> dosyasına Yetişir’i ekle:
            <div className="mt-3">
              <CodeBlock label="settings.json">{`{\n  "mcpServers": {\n    "yetisir": { "httpUrl": "${mcpUrl()}" }\n  }\n}`}</CodeBlock>
            </div>
          </>,
          <>
            Gemini CLI’ı aç ve <code>/mcp auth yetisir</code> komutunu çalıştır.
          </>,
          <>Açılan Yetişir sayfasında giriş yap ve <strong>İzin ver</strong>’e bas.</>,
        ]}
      </Steps>
      <Callout tone="info">Gemini web ve mobil uygulamasının özel MCP sunucusu desteği henüz doğrulanmadı.</Callout>
    </>
  );
}

export function CampJson() {
  return (
    <>
      <p>
        Yapay zekâ bir kampı <code>send_camp</code> aracıyla, aşağıdaki JSON biçiminde gönderir. Sınırlar uygulamanın kendi formlarıyla
        aynıdır; bir sorun olursa yeriyle birlikte bildirilir (<code>camp.branches[2].videos[5].youtubeId</code> gibi) ve yarım kamp
        eklenmez.
      </p>
      <CodeBlock label="Örnek">{`{
  "name": "TYT 2027",
  "schedule": {
    "mode": "auto",
    "dailyStudyHours": 3,
    "playbackSpeed": 1.5,
    "practiceMultiplier": 0.2,
    "maxSubjectsPerDay": 2,
    "activeDays": [1, 2, 3, 4, 5, 6],
    "mockExamDays": [0]
  },
  "branches": [
    {
      "subject": "Matematik",
      "title": "TYT Matematik Kampı",
      "videos": [{ "title": "Temel Kavramlar", "minutes": 42, "youtubeId": "xxxxxxxxxxx" }]
    },
    { "subject": "Türkçe", "videos": [{ "title": "Paragraf çalışması", "minutes": 60 }] }
  ]
}`}</CodeBlock>
      <H2 id="sinirlar">Sınırlar</H2>
      <table>
        <tbody>
          <tr>
            <td>Kamp adı</td>
            <td>1–80 karakter</td>
          </tr>
          <tr>
            <td>Branşlar</td>
            <td>1–40; toplam en çok 5.000 video ve konu</td>
          </tr>
          <tr>
            <td>Branş adı</td>
            <td>1–40 karakter</td>
          </tr>
          <tr>
            <td>Video / konu</td>
            <td>başlık 1–200 karakter; süre 0’dan büyük, en çok 600 dakika</td>
          </tr>
          <tr>
            <td>youtubeId</td>
            <td>11 karakterlik video id’si; yoksa öğe linksiz bir konudur</td>
          </tr>
          <tr>
            <td>Günlük süre</td>
            <td>0,5–16 saat</td>
          </tr>
          <tr>
            <td>İzleme hızı</td>
            <td>1, 1.25, 1.5, 1.75 ya da 2</td>
          </tr>
          <tr>
            <td>Tekrar payı</td>
            <td>0, 0.1, 0.2, 0.3, 0.5, 0.75 ya da 1</td>
          </tr>
          <tr>
            <td>Günler</td>
            <td>0 = pazar … 6 = cumartesi; deneme günleri çalışma günleriyle çakışmaz</td>
          </tr>
        </tbody>
      </table>
      <H3 id="elle-mod">Elle yerleştirme</H3>
      <p>
        <code>"mode": "manual"</code> ile <code>weekPlan</code> verilir: pazardan başlayan yedi liste, her biri o gün çalışılacak branşların
        sırası (0’dan başlar). Her branş en az bir günde olmalıdır.
      </p>
      <Callout tone="info">Kamp her zaman eklendiği gün başlar; JSON’da başlangıç ya da hedef tarih yoktur.</Callout>
    </>
  );
}

export function Account() {
  return (
    <>
      <H2 id="senkron">Her cihazda aynı plan</H2>
      <p>
        Kampların, ilerlemen ve notların hesabına kaydedilir. Hangi cihazdan giriş yaparsan yap planın seninle. İki cihaz aynı anda
        kaydederse yenisi açılır, diğer cihazdaki kaydedilmemiş değişiklikler kaybolmaz; ayrıca saklanır.
      </p>
      <H2 id="profil">Profil ve ayarlar</H2>
      <p>
        Kenar çubuğunun altındaki profil satırı <strong>Profil ve ayarlar</strong> sayfasını açar: profil resmin, görünen adın (Keşfet’te
        yayınladığın kamplarda görünür), okul ve bölüm bilgilerin, Hakkında yazın, yapay zekâ bağlantıların, verilerin ve en altta çıkış.
      </p>
      <p>
        İlk girişte birkaç kısa soru sorulur: sekiz çizim arasından bir profil resmi (ya da kendi fotoğrafın), şu an ne yaptığın (lise,
        sınava hazırlık, üniversite, mezun ya da çalışıyor) buna göre okulun, bölümün, sınıfın ya da mesleğin ve istersen hedeflerini anlatan kısa bir “Hakkında” yazısı. Hepsi isteğe bağlı;
        sonra <strong>Profili düzenle</strong> ile değiştirebilirsin. Keşfet’te kamplarının yanında profil resmin, adın, durumun, bölümün ya da mesleğin ve Hakkında yazın görünür; okulun, sınıfın ve e-postan yalnızca sende kalır.
      </p>
      <H2 id="yedek">Yedek</H2>
      <p>
        <strong>Yedek indir</strong> tüm kamplarını, tamamlananları, ritim güncellemelerini ve notları tek bir JSON dosyasına yazar.{' '}
        <strong>Yedekten geri yükle</strong> dosyayı kontrol eder ve onayından sonra mevcut verilerin yerine koyar; bozuk bir dosya hiç
        yüklenmez.
      </p>
      <H2 id="sifirla">Sıfırlama</H2>
      <p>
        <strong>Tüm verileri sıfırla</strong> hesabındaki bütün kampları ve ilerlemeyi siler; giriş yaptığın her cihazdan gider ve geri
        alınamaz. Emin değilsen önce yedek indir.
      </p>
      <H2 id="demo">Demo</H2>
      <p>Demo örnek bir kamp açar ve hiçbir şey kaydetmez; çıktığında kendi planın olduğu gibi durur.</p>
    </>
  );
}
