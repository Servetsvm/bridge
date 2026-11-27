# BridgePlay — çalışma notları

Bu dosya her Claude Code oturumunun başında otomatik okunur. Oturum sonunda **"Kaldığımız yer"** ve
**"Oturum günlüğü"** bölümlerini güncelle ve commit'le (yerel `.claude/` klasörü gitignore'da, oradaki notlar
bilgisayar formatlanınca kaybolur — kalıcı notlar burada durur).

## Proje
Tarayıcıda üç robota karşı Bridge: konvansiyon kartı, deklarasyon açıklamaları, sanal robot masalarına karşı
IMP/MP. PWA (kurulabilir, çevrimdışı) + tek dosya sürüm `dist/bridge-table.html`. 10 dil.

| Yer | İçerik |
|---|---|
| `js/core.js` | sabitler, açık arttırma kuralları, puanlama, IMP tablosu |
| `js/bidding.js` | robotların deklarasyon sistemi ve konvansiyonlar |
| `js/play.js`, `js/dds.js` | robot kart oyunu, double-dummy çözücü |
| `js/field.js` | aynı eli oynayan robot masaları (IMP/MP) |
| `js/app.js` | ekran, oyun akışı, ayarlar, admin paneli |
| `js/net.js`, `js/social.js` | çevrimiçi masa, Firebase, sohbet, lobi |
| `js/bidprac.js` | deklarasyon pratiği |
| `js/club*.js`, `kulupler/`, `skor/` | kulüp programı / BridgeScore |
| `js/lang.js` → `js/lang/*.js` | çeviriler (`.github/lang/split.js` böler) |
| `.github/robots/` | sistem masaları (live-*.json, errors-*.json) — 2 saatte bir Actions |
| `.github/botchat/` | robot sohbeti: Cloudflare Worker, Gemini Flash Lite + Workers AI |
| `.github/daily/`, `daily/` | günün eli (her gün Actions commit'ler) |
| `tools/smoke/` | headless Chrome ile bir el oynatan smoke test |
| `tools/og/og.mjs` | paylaşım görselleri (icons/og-*.png) |
| `firebase-rules.json` | veritabanı kuralları |

## Kurallar / alışkanlıklar
- **Her zaman `main`'e gönder** (kullanıcının kalıcı izni, 2026-11-22): site GitHub Pages'te `main`'den yayınlanır.
  Oturum dalında çalışılıyorsa iş bitince `main`'e birleştir ve push et.
- Siteye ait bir dosya değişince **`sw.js` içindeki `VERSION`'u bir arttır** (`bridge-vNNN`).
- Ardından `dist/bridge-table.html`'i yeniden üret (`node tools/build.mjs` — build.ps1 ile birebir aynı çıktı;
  Windows'ta `build.ps1` de olur). Her site commit'i dist'i de içerir.
- Push öncesi smoke test: `git config core.hooksPath .githooks` (klon başına bir kez). Atlamak: `SKIP_SMOKE=1`.
- Commit mesajları İngilizce, tek satır, kullanıcının gözünden ne değiştiğini anlatır
  ("Home: …", "Robots: …", "Admin → …: …"). Robot düzeltmelerinde test sonucu yazılır
  (ör. "6000 deals: 24 contracts changed, +52 IMP") ve lesson entry sürümü / robot fix tarihi güncellenir.
- Arayüz metni değişirse en az EN / TR / NO çevirileri güncellenir.
- Sırlar (GEMINI_KEY vb.) asla depoya girmez; Cloudflare secret olarak tutulur.
- `lessons.json` (robot öğrenme kitabı) 2026-11-08'de durduruldu; değiştirme.

## Kaldığımız yer
_(2026-11-26 itibarıyla)_ Yarım iş yok. Sürümler: site `bridge-v708`, kulüpler `kulup-v211`.
- Kulüp programının sürümü ayrı: `kulupler/service-worker.js` → `CACHE_NAME` (kulupler/ değişince artır).
- Kulüp adı 4 yerde tutulur: `gate/clubs/<id>/info/name`, `gate/clubList/<id>/n`, `gate/owners/<sahip>/<id>`, `gate/live/<id>/c`.

- Kulüp talebi akışı: ana sayfa kartı `#hClubAsk` → form → `Net.clubAsk` → `destek/<oyuncu>/m` (mesajda `kl`), otomatik teşekkür (`kl:1`).
  Admin mesajda "Kulübü aç" → `kulupler/?sa=1&nc=&nf=&for=&forn=` → süper yönetici paneli dolu gelir; kulüp açılınca
  oyuncuya `kd:{n,id,pw}` mesajı (`saSendClubToPlayer`). Firebase kuralı değişmedi.

- **Robot sohbeti Worker'ı (2026-11-24'ten beri):** yeni Cloudflare hesabında, `https://bridge-bots.bridgeplay.workers.dev`
  (eski `bridgetable` hesabına erişim kayboldu). GitHub Actions `.github/workflows/botchat.yml` yükler (elle ya da
  `.github/botchat/**` değişince); repo secret `CLOUDFLARE_API_TOKEN` (Edit Cloudflare Workers şablonu), isteğe bağlı
  `REVIEW_KEY`, `GEMINI_KEY`. Yönetici, push için ayrı anahtarsız tanınır: uygulama `Authorization: Firebase <idToken>` yollar,
  Worker `sess/<uid>/k` == 'servet' okur (`fbAdmin`). D1 yok → sohbet kaydı/hata raporu tutulmuyor; bildirim abonelikleri KV `PUSH`'ta.

## Oturum günlüğü
(En yeni en üstte. Her oturumda 2–5 satır: ne yapıldı, ne yarım kaldı, sıradaki fikirler.)

### 2026-11-27
- Kullanıcının listesi (v708): Ayarlar'dan Yön, Deklarasyon açıklamaları, Robotları düzelt, Zorunlu kartı oyna ve "uçakta internetsiz" satırı kalktı;
  her açılışta `SET.seat=2, auto=true, expl=true, fixBot=false` (start + acctLoad). Online penceresi: yön sormaz (yalnız 🪑 Otur → Güney),
  WhatsApp/SMS yok (`convCardHtml(true)`). Açık masalar'da 🔌 saat satırı gösterilmez. Otur → önce 🤝 Ortak / ⚔️ Rakip (`data-jsw`).
  Masadan çıkarma ✕ (`.kickx`) büyük kırmızı. Online olunca robotlar eski adlarını korur (`st.botNames`, becomeHost'ta seatName; `v.bots` ile misafire).
- Açık masalar satırı artık yalnız oyuncunun adı + **🪑 Otur** (`data-jsit`; kapalı masa 🔒 ad, düğmesiz). Otur → `hello` içinde `sit:1`;
  açık masada (soloPub ya da açık online) ev sahibi sormadan boş koltuğa oturtur (`seatPlayer`), ev sahibine "… masana oturdu (✕ ile
  çıkarabilirsin)" uyarısı; ✕ isim yanında (`data-kickask`). Online penceresindeki liste de Otur. P2P burada denenemedi. v707.
- Nora'nın tableti 18:33'ten beri `online/nora` yazmıyor (Emin'in telefonu yazıyor, `tbi` dolu). Kod tablet boyutunda çalışıyor (mock);
  neden bilinmiyor; v706 (oturum hatasında yeniden deneme) sonrası tablet yeniden yazdı, iki cihaz birbirinin masasını gördü (kullanıcı onayladı). Açık masalar'ın altında küçük durum satırı `🔌 ss:dd ✓ / ⚠️ <neden>` (`st.beatSt`: out/offline/nopin/session/err…);
  oturum hatası artık kalıcı sessiz değil (`st.sess = null`, sonra yeniden dener). Bu oturumda ortam `bridge` (Firebase okuma izni). v706.
- Ana sayfada sarı sistem düğmesi (🤖 SAYC…) de artık 🌐 Online gibi kart seçimi + oturma açar (`data-rtopen` → `rtOnline`); robot
  sistem masasını izleme ana sayfadan kalktı (`rtWatch` başka yerden çağrılmıyor). v705.
- **GitHub kulüp robotu** (`.github/clubs/runner.js`, 5 dk'da bir) açık akşamın kimsenin oturmadığı masalarını da oynuyor ve akşamı
  kulübe kopyalıyordu (akşam kendi kendine "Tamamlandı", silince geri geliyordu). Artık koltukları uygular (`ctSeatsApply`), `ctIdle`
  masaları oynamaz/beklemez; silinmiş akşamı kopyalamaz. TD silince `bm/otGone/<tid>` (kural: üye yazar) → ne TD sayfası (`otMirror`)
  ne runner bir daha kopyalar. kulup-v211.
- Tablet/PC'de (geniş ekran `#hRobot` Sistem masası kartı) de her sistemin altında 🌐 Online; kart artık 2 MB live dosyasını beklemeden çizilir. v704.
- TD konsolunda online akşamı 🗑 ile silmek yalnız kulüpteki kopyayı siliyordu, online turnuva (`ot/<kulüp>/<id>`) kalıyordu → geri geliyordu.
  `adminReset` artık `state.online.tid` varsa online turnuvayı da siler (tek tuş + bir onay). kulup-v210.
- Açık masa başka telefonda görünmüyordu: masalar PeerJS odalarıyla aranıyor, mobil ağda çoğu zaman ulaşılamıyor. Artık dakikalık
  `online/<ad>` kaydı `tbi {k,pub,ph,b,ct,n}` taşır; `tablesHtml` doğrudan bulunamayan masaları bundan aynı ayrıntıyla çizer (katıl düğmesi
  yalnız açık + oda no varsa). Online'da oturunca hemen `Cloud.beat()`, Listeyi yenile de okur. v703.
- Açık masalar (`Net.tablesHtml`, önce örnek resim gösterildi, onaylandı): masada ne oynandığı — 🌐 online / 🤖 robotlarla, el no,
  "Deklarasyon sürüyor" ya da "Kontrat: 4♠ Doğu, löve 7/13" (tableInfo `ct`), sistem + açık konvansiyonlar (prof.sys/conv, 6'dan fazlası +n),
  oyuncular yönleriyle. v702.
- **Kimsenin olmadığı masa oynanmaz** (kullanıcının isteği): (1) Kulüp açık online turnuvasında hiç oyuncu oturmamış masa (`ctIdle`: plan
  açık + masadaki dört koltukta anahtar yok) robotlarca oynanmaz, tur onu beklemez (`ctCurRound`, `ctTablesOf`); hiç kimse yoksa akşam
  bekler. Oturmuş ama sonra ayrılmış oyuncuların masasını robotlar bitirir (tur donmasın diye). kulupler `otRobots` da koltukları uygular.
  (2) Robot sistem masaları (`robots.yml`) artık yalnız son 3 saatte bakılan sistemleri oynar: 🤖 düğmesi `rtw/<sistem> = zaman` yazar
  (`rtWant`, 20 dk'da bir; kural `rtw/$sys` herkese okunur, girişli yazar), `want` işi jq ile seçer; elle/push çalıştırma hepsini oynar.
  Matristen eski 'claude' çıkarıldı. Bakılmayan masada "Bu masada kimse yoktu… bir saat içinde" uyarısı. v699 / kulup-v209.
- Robot partner deklarer olunca eli robot oynar, oyuncu yalnız yalancı (`userControls`: decl === pd(U()) → false; test: partnerin
  deklarer olduğu el kendiliğinden bitti). Masadan kalkınca (`goHome`) el artık saklanmaz → hep "▶ Başla" (konvansiyon seçimi açılır). v698.
- 🌐 Online artık hiçbir şey indirmez (eskiden ~2 MB live-*.json): pencere hemen açılır, basılan sistem kartın temel sistemi olur,
  koltuk seçilince (`rtOnSit`) oyun başlar (robot adları varsayılan, masa açık `soloPub`). v697.
- Sistem masası izleme ekranında 📊 Masalar düğmesi kalktı. 🌐 Online penceresinde o sistemde oynayıp başkalarını kabul eden
  oyuncular "Katılmak iste" ile (`rtOthers`, Net.st.tables, host'un prof.sys'i). Oturan oyuncunun masası zaten Açık masalar'da açık (soloPub). v696.
- Ana sayfa: kulübün açık online turnuvası artık Açık masalar'da değil, yalnız Kulüpler içinde (`ctCardHtml` ana sayfadan çıktı).
  Her sistem düğmesinin altında **🌐 Online** (`data-rton` → `rtOnline(k)`): önce konvansiyon kartı (`convCardHtml`, sistem/konvansiyon
  değişince pencere yeniden çizilir), sonra o sistemin sürekli robot masasında koltuk (`rtSit`; robotlar oyuncunun kartıyla oynar). v695.
- Ana sayfa: üstteki 🧩 Bulmaca düğmesi kalktı; 🎯 Teklif alıştırması kutusu artık **🧩 Bulmaca** (puan/✅ alt satırında, `#hPuzzle`).
  Basınca Günün problemi açılır; pencerenin üstünde iki sekme (`pzTabs`: 🧩 Günün problemi / 🎯 Teklif alıştırması). v694.
- **Kulüp bilgisi / logosu açılmıyordu** (TD şifresiyle, her kulüpte): kulüp programı 8 canlı akış (EventSource) açıyordu; telefon bir adrese en çok 6
  bağlantı açar → okuma isteği hiç cevap almıyordu. Artık yalnız `state`, `boards`, `tdcalls` akış (`_LIVE`, core.js), diğerleri 5 sn'de bir okunur
  (playerdb 60 sn). Bilgi/logo okuması 12 sn'de cevap gelmezse uyarı (`fetchT`). kulup-v208.
- **Masa kodu kalktı** (kullanıcının kararı): BridgePlay'e girmiş üye her turnuvada kodsuz oturur (`bgPlayerSit` → `_quickSeat`,
  club-auth 167 koşulu `_quickTeam||me()`, setLive her zaman `q:1`). TD → Kulüp ayarları'ndan 🔢 Masa kodları ve 🔗 Oyuncu bağlantısı
  kaldırıldı (sonra 📺 Ekran da, kulup-v205; BridgePlay kulüp kartındaki 📺 Ekran düğmesi duruyor). Firebase kuralı: bm/{state,movements,pairs,boards,approvals,tableLocks,boardLocks,ready,kicks,tdcalls,logs,hands,dd,archives,playerdb}
  her üyeye yazılabilir (eskiden yalnız turnuva yokken/hızlı maçta). Bedeli: giriş yapmış herhangi bir üye bir kulübün skorlarını
  teknik olarak değiştirebilir (kullanıcıya söylendi). bm/info ve bm/logo yalnız sahip/TD'de kaldı. kulup-v201.
- Kulüp bilgisi/logosu boş geliyor (kullanıcı, 27.11): okuma başarısız olunca pencere boş açılıyor, boş formu Kaydet bilgiyi DELETE ediyordu
  (olası silinme yolu). Artık okuma hatasında pencere açılmaz (uyarı), dolu bilgi boşaltılınca önce sorulur (`_tdcInfoHad`). kulup-v203.
- Kullanıcı kulüp bilgisi + logosunun kaybolduğunu söyledi; kodda bunları silen yol bulunamadı (td-console tdcInfoSave boş formda
  DELETE eder; logo seçicide "yok" DELETE eder). Hangi kulüp olduğu soruldu.
- **🌐 Online, hemen başlayan açık turnuva** (v691/kulup-v202): BridgePlay kulüp kartında turnuva yokken `data-clubonline` →
  kulupler `?role=admin&online=1` (setupOnline) → formda "▶ Hemen başlat — boş koltuklarda robotlar oynar" (`otStartOpen`: info.open=true,
  plan `ctMakePlan` open dalı: np/2 (çift) boş çift, kayıt yok). Oyuncu: kulüp kartı/ana sayfa kartı → `ctShowOpen` (bu turun masaları,
  koltuk adı ya da 🤖 → 🪑 Otur) → `ctTakeSeat` `run/<d>/seats/<çift>_<a|b> = {n,k,ts}` → `ctSit`. Plan her yerde `ctSeatsApply(plan, seats)`
  ile okunur (ctList, sonuçlar, kulupler canlı/ayna). Boş koltuk = robot (ctPresent), boş masaları oturan oyuncuların uygulaması oynar
  (`ctHeadTest` artık `i.test || i.open`). Masadayken `ctBeat` koltukları yeniden okur (sonradan gelen robotun yerini alır).
  🌐 Online düğmesi yalnız TD kulüp ayarlarından açarsa görünür: TD → Kulüp bilgisi → "BridgePlay'de Online düğmesi" (`bm/info/ol:1`, v693);
  basan sahip PIN'siz doğrudan online kuruluma girer (`_ownerAuto` → bridgeSession, `setupOnline=true` club-auth'ta, kulup-v206),
  diğerlerine TD girişi (kulüp şifresi) sorulur, sonra yine online kurulum açılır.
  Kurallar: ot run t/a, t/res açık turnuvada her üyeye; seats: boşsa, kendininse ya da sahibi 10 dk yoksa (hb). Test: iki oyunculu mock (Nora G, sonra Emin K).

### 2026-11-26
- **Yeni BridgePlay (/yeni/) silindi**: kullanıcı görünüşü, kullanımı, eksikleri ve fikrin kendisini beğenmedi; eski programla devam.
  Kod git geçmişinde (son hali commit a40f456). `yeni/` klasörü de tamamen silindi (kimse kullanmamıştı). Eski program hiç değişmedi.
  Ders: büyük yeniden yazım yerine eski programı adım adım iyileştir; büyük işe başlamadan küçük bir örnek ekranı göster, onay al.
- **Claude sistemi silindi** (SYSTEMS 'claude', CONVS 'claudex', bidding.js kontrası, app.js Claude penceresi/robot masası/meydan okuma,
  {en,tr,no}/learn/claude-system.html, sitemap, index.html bağlantıları, robots.js). Kayıtlı `SET.sys/opp === 'claude'` → 2/1 (`start()`).
- **10 yeni konvansiyon** (hepsi `off`, kullanıcı işaretleyince robotlar oynar; kullanıcı Walsh ve Baron için yaygın şekli seçti):
  Flannery (`flan`, xs multi), Voidwood/Minorwood (anahtar kart cevapları artık sorunun 4 basamak üstü: `stp(k)`, `pm.void`),
  Ghestem (`gh`, xs michaels), Jordan 2NT, Landy (`landy`, xs capp+dont), Kokish (`kok`/`kokr`, virt2N 2♣-2♦-2♥-2♠-2NT'yi de 2NT açışı sayar),
  Walsh, Baron (1NT-2♠/2NT-3♠, xs fourWay+minorTr), Gazilli (`gaz`/`gazr`). Yeni `xs` (birden çok dışlama) + `E.convOff(k)`.
  DD ölçümü (scratchpad fnt/cmp2.js: aynı motor, konvansiyon kapalı/açık): Flannery +314, Gazilli +161, Walsh +121, Minorwood +74,
  Landy +72 (2/1'de Capp yerine +170), Voidwood +48, Baron +44 (4 yollu yerine −8), Ghestem +19 (Michaels yerine −97), Jordan −37, Kokish −110.
  CONV_T 9 dil, BID_PH 15 yeni ifade, ROBOT_LEARNED v689.
- **Bütün konvansiyonlar ölçüldü** (cmp2.js her biri açık/kapalı 20000 el; cmpold.js = HEAD motoruna karşı). Düzeltmeler (v690):
  RKCB belirsiz cevap (0/3, 1/4, 2+Q=5) yüksek okunur `mine+alt<=total`; koz kızı yüzünden 5'te durma yalnız cevap kızı reddettiyse ve
  uyum 8'liyse; grand: tüm anahtar + kız + 8'li uyum + est≥34 + HCP≥31; Inverted Minors 3m baraj artırmasına açıcı pas (18+ 3NT, 5m);
  Ogust cevabından sonra soran yapay cevabı pas geçmez (19+ normal şlem yolu); Gambling 3NT pası bir minörde de stoper ister.
  HEAD'e karşı 240000 el: 2/1 +864, SAYC +319, Acol +911, SEF +793, Precision +634, Polish +807 = +4328 IMP.
  Hâlâ kaybettirenler (değiştirilmedi, kullanıcıya önerildi): SJS (WJS'e göre −211 / SAYC −136), Kokish −110, Forsing 1NT −87 (2/1'in parçası).
  Denenip geri alınan: NT oyununda uzun rengi puana saymak (SAYC −320).
- Kulüp sonuçları (`kulupler/results-page.js` ddHtml): double dummy artık löve sayısı değil seviye (löve−6, '–'), NT ♠ ♥ ♦ ♣, K/G/D/B dört satır,
  par satırı '4♥ E +1 −450' (ana uygulamanın `ddTabHtml` gibi). kulup-v200.

### 2026-11-25
- **Yeni BridgePlay beta** (`/yeni/`, kullanıcının kararıyla sıfırdan; ad BridgePlay, fotoğraftan el kalır, el sonu koçu/geri alma/el geçmişi/Haftam,
  QR, ses, otomatik kulüp algılama, WhatsApp ile oturma, kamera, grafik/rozet, bildirim, mağaza YOK). Aynı Firebase ve hesaplar
  (eski programdaki giriş `bridge-table-name` + `bric-masasi-v2.SET.pinH` otomatik devralınır; `sess/<uid>` PIN kontrolü aynı).
  Kulüp verisi aynı yollarda (eski/yeni birlikte çalışır). Yapılan: giriş/kayıt, ana sayfa, ayarlar (dil TR/NO/EN, tema, büyük yazı),
  kulüp listesi, kulüp sayfası + bilgi, canlı Ekran (SSE), sonuçlar + board seyahat kartı, robotlarla oyna (6 sistem, teklif kutusu,
  açıklama, 💡 öneri, kart oyunu, DD karşılaştırma, fotoğraftan el). **Sıradaki:** kulüpte masa/skor girişi ve TD (şimdilik eski programa link),
  online masa/lobi/sohbet, diğer 7 dil, puan/reyting kaydı.
- **BridgePlay beta: kulüpte masa + skor + TD** (`yeni/app/tourn.js`, `table.js`, `td.js`; `bp2-v2`): Masaya otur (dolu masa yok, telefonun masası
  `bp2-seat`; hızlı maçta kodsuz, yoksa `gate/live.k`/önek ile `tsess`), 4 isim → pairs, board listesi (canlı), tek sayfada skor
  (seviye/renk/X/oynayan/sonuç/atak; eski kayıt biçimi, PATCH), sosyal/takımda `boardLocks`, tur sonu hareket rehberi, bütün masalar
  bitince sonraki tur / son turda otomatik bitiş + arşiv. TD: sahibi şifresiz, diğerleri kulüp şifresi (`csess`); hızlı Takım maçı /
  Sosyal Bridge (`quickStart`), masa boşalt, board düzelt/ADJ/oynanmadı/sil, sonraki tur, bitir, sil.
- BridgePlay beta (`bp2-v3`, 26.11): TD → Yeni turnuva (Mitchell/Howell/Barometre; `movements.js` = kulupler/core.js üreteçleri, `clubStart`,
  masa kodları `secret/tcodes` + live.k), 🔑 Masa kodları; 10 dil (i18n.js); Online masa/lobi/sohbet kutusu şimdilik eski BridgePlay'i açar (`../`).
  **Sıradaki:** online masa/lobi/sohbet'i yeni programa yazmak, İsviçre (Swiss) hareketi, robot oyunu puan kaydı.
- Kulüp programından **kamerayla dağıtma** kaldırıldı (cardcam.js'in kamera kısmı, TD 'Kamerayla dağıt' düğmesi, kulupler'de photo.js); DD analizi kalıyor. BridgePlay'deki 'fotoğraftan el oku' duruyor (sorulacak).
- **Kulüp programı canlı akış:** `DB.subscribe` artık Firebase SSE (EventSource; put/patch `_setPath`, `auth_revoked`→yeni token, kesilince
  yeniden bağlanır, açılamazsa 4 sn/15 sn (gizli) yoklama). Eskiden her cihaz 8 anahtarı (üye listesi dahil) 2 sn'de bir indiriyordu.
  **Çevrimdışı:** `setBoards/setApprovals/setTableLocks` → `DB.setDiff` (yalnız değişen kayıtlar PATCH; başka masanın skoru ezilmez);
  kuyruk 8 sn'de bir + açılışta + ekrana dönünce denenir, "⏳ Bağlantı bekleniyor: n gönderilecek" (`#bmQueue`).
  **Hareket rehberi:** tur sonu ekranında `bgMoveGuideHtml` (➜ Masa n / bu masada kal, KG/DB pusula, alınacak board'lar, bu masanın board'ları → Masa m).
- **Unutulan turnuva (kullanıcının isteği):** `.github/workflows/close-stale.yml` 15 dk'da bir `.github/stale/close.js` (FIREBASE_DB_SECRET):
  1 saat skor yoksa başlatana (`state._by`, adminStart'ta; yoksa kulüp sahibi) `destek/<k>/m` yönetici mesajı (TR/NO/EN) + `_idleWarnAt`;
  30 dk sonra hâlâ skor yoksa turnuvayı bitirir, arşivler (hızlı → teamArch), live'ı siler (`_autoFinished:'idle'`). Elle çalıştırma: dry=1 yalnız yazdırır.
- Ekran: sıralama telefonda tam sayfa ve ekrana sığar (`.sb-scroll`/`.sb-rank`, yön ve çift no sütunu gizli); "● Canlı" rozeti
  BridgePlay'in Kulüpler çubuğunda (`postMessage {bpLive}` → `#cvLive`); Masalar'da yalnız oynanan board numaraları (skor yok).
  Turnuvayı başlatan telefon (`localStorage bp_myTourn`, adminStart) 20 dk skor girilmezse "Turnuva bitti mi?" sorar
  (`myTournCheck`, 3 dk'da bir; 🏁 TD'yi açar, "Devam ediyor" 20 dk erteler). Yalnız BridgePlay açıkken çalışır.
- Ekran (role=screen): üstte yalnız kulüp + "● Canlı" rozeti + tur; çevrimiçi/dil/tema/çıkış ve 🏆 başlık yok (`body.screen-role`).
  Sonuçlar artık uygulama içinde (`openClubs('?club=..&results=1')`, eskiden yeni sekme). Masalar sekmesinde masanın oynadığı
  board'lar + KG skoru (`.tc-played`). Son turun bütün board'ları (oynamış her masada) bitince son skoru giren masa turnuvayı
  kapatıp arşivler (`bgQuickFinish` artık hızlı olmayan turnuvalar için de; `_autoFinished`). Yönetici → Tüm oyuncular: ✉️ herkese /
  işaretlenenlere mesaj (`playersMsg`, `Net.supReply`). Unutulan turnuva görevi kullanıcı onayıyla eklendi (yukarıda).
- GitHub Pages yayını (pages build and deployment) 25.11 öğleden sonra üst üste 500 hatası verdi (GitHub kesintisi): site v680'de kaldı; düzelince yeni bir commit yayını yeniden tetikler.
- Kullanıcının sistem/konvansiyon tanımlarıyla karşılaştırıldı; farklı olanlar onun tanımına çekildi (motor + CONVS + CONV_T 9 dil):
  WJS 3-6, SJS 17+, Drury 9-11, Multi 5-10, Inverted Minors baraj 6-9, NMF 10+, SAYC/Acol 2 seviyesi yeni renk 10+.
  Ölçüm (12000 el her biri): SAYC +20, Acol −19, invMin +23, SJS +14, NMF −3, Drury −10, Multi 0, Muiderberg 6-10 −168 → kullanıcı onayıyla 5-10'a geri alındı.
  Claude Sistemi/Kontrası ve Multi'nin "güçlü dengeli" seçeneği kullanıcının metnine göre değiştirilmedi.
- **Forsing 1NT** ayrı konvansiyon (`fnt`, core.js CONVS; 2/1'de açık, SAYC/Acol/diğerlerinde kapalı; eski kayıtlı kartta `fnt` yoksa
  2/1'i izler). bidding.js: `suitResponses` 1NT 6-11 (2/1 ile 6-12), 3'lü 10-11 doğrudan 3M değil önce 1NT; cevapçının ikinci teklifi
  (`tag 'nt1f'` → 3M davet / zayıf uzun renk oynamak için / ikinci renge uyumla pas / 2M tercih / 2NT 10-11); pas geçmiş elin 2 seviyesi
  yeni rengi 9-11 forsingsiz. Test: eski/yeni motor DD karşılaştırması 24000 el, 113 kontrat değişti, +136 IMP; SAYC 0 değişiklik.
- TD BridgeScore: "Başlamaya hazır" ve oynanan turnuva ekranında altta 🗑 (tam yetkili TD) → tek soru, siler ve yeni turnuva kurulumuna geçer (`tdcResetNow`).
- **Hızlı Sosyal Bridge:** kulüp kartında 🤝 Sosyal Bridge (kulüp bilgisi `bm/info/sb:1` açıksa) → `?role=admin&quick=social` →
  `quickSocialPick()` (oyuncu 8–40, board 8–36; varsayılan 12/12) → `quickSocialGo()`; takım maçının bütün altyapısını kullanır (`_quickTeam` bayrağı
  + `_quickKind:'social'`: şifresiz, kodsuz masa, kilit, geri dönüş, bitince `teamArch`). BridgeScore takım maçıyla aynı: atak sorulmaz (`_noLead`).

### 2026-11-24
- TD → Menü → Kayıtlar: "🏆 Takım maçı" listesi, her sonuç 🗑 ile silinir (`tdcDelTeam`, yalnız kulüp yöneticisi; kural bm .write).
  Konvansiyon çalışırken (`pracList()`) açılışta ve hesap değişince de yarım el saklanmaz → hep "Başla".
- **Takım maçı kendiliğinden biter:** son board'u giren masa (`bgQuickFinish`, core.js; table-play allDone) iki masada 16 board
  bitince durumu finished yapar, `teamArch/q<_startedAt>`'a yazar (aynı id → iki telefon bir kez ekler), live'ı siler.
  Hiç board oynanmamış takım maçı arşivlenmez ve sonuçlarda gizlenir (`resArc`). Bitmeyen takım maçı live'da 5 saat sonra görünmez (`t.q`).
- Takım maçı kurulunca sayfa yeniden yüklenmiyor: `quickEntry()` masa listesini aynı sayfada çizer (yeniden yüklemede bazen kod
  kutusu çıkıyordu). Kurulmuş ama başlamamış turnuva (status setup) takım maçını engellemez, yerine geçer. Hızlı takım maçında TD: üye (`qtMember()`, td-console) masaların durumu (masaya basınca o masaya oturma ekranı `tdcSit`; dolu masa 🔒 `tdcTaken`, doğrudan açılışta `bgTableTaken` "Bu masa dolu"; skor düzeltme yok) + Turnuvayı bitir + Çıkış görür (⚙️ ve menü yok; 🔑 Kulüp şifresi → `tdcPwLogin`, şifreyle giren `_tdPw` = tam panel); sahibi tam panel, ikisi de şifresiz; üye `role=admin` → şifresiz (state `_quickTeam` running).
- **Açılışta her zaman güncel sürüm:** app.js `updatefound` (açılıştan sonraki 20 sn içinde ya da sakin ekranda) → tam ekran
  "Güncelleniyor…" (`#updWait`), yeni SW devralınca hemen yeniden yüklenir; 20 sn'de bitmezse eski sürüm sürer, şerit önerir.
  Kulüp programı (kulupler/) zaten network-first.
- **Hız:** telefonda gizli robot masası kartı (#hRobot) için her açılışta inen ~2 MB live-*.json artık yalnız kart görünürse
  (`rtShown`); Google Fonts sayfayı bekletmiyor (media=print onload) ve sw.js'de `fonts-v1` önbelleğinde. Web Push hafif (günde bir abonelik) → kaldı.
- Kulüpte süren takım maçı varken üye kulübe girince masa kodu ekranı yerine masa numaraları (`bgPlayerEntry('00')`).
- Takım maçı Hareket listelerinden kalktı (yalnız 🏆 düğmesiyle). 🏆 düğmesi BridgePlay'de yalnız kulüp yöneticisi açarsa
  görünür: TD → Kulüp bilgisi → "Takım maçı düğmesi" (`bm/info/tm:1` yalnız düğmeyi gösterir; düğmeye basan her üye şifresiz başlatır; masa kodsuz oturma `state._quickTeam`'dan da anlaşılır). Takım maçında telefon kapanınca
  aynı masaya döner — yalnız oturan kişi (`bg_seat` içinde `u`; aynı telefonda başka isim kendi masasını seçer) (koltuk `c:'Q<masa>'`, `?role=table&qt=<masa>`). BridgeScore'da turnuva Sil tek soru (`adminReset(true)`).
  Ana sayfa sistem adları büyük/kalın. Konvansiyon çalışırken masadan kalkınca el saklanmaz → "Başla" (`goHome`, `pracList()`).
- **Üye takım maçı:** BridgePlay'e giriş yapmış her üye (`me()`, `sess/<uid>/k` var) kulüpte başka turnuva yoksa 🏆 Takım maçını
  şifresiz başlatır; Firebase kuralı: bm/{state,movements,pairs,boards,approvals,tableLocks,boardLocks,ready,kicks,tdcalls,logs,hands,dd}
  üyeye yazılabilir yalnız `state.status !== 'running' || state._quickTeam`; `gate/live/<club>` aynı koşulla; `bm/teamArch/<id>` yalnız ekleme.
  Live kaydında `q:1` → oyuncu masa kodu girmeden oturur (`window._quickSeat`). Bitince sonuç `teamArch`'a (archives'a değil);
  sonuçlar sayfası `resArc()` ikisini birleştirir. Kurallar `.github/workflows/fb-rules.yml` (mode deploy) ile yüklendi.
- Ana sayfadan **Online masa aç** ve **Sosyal Bridge** kutuları kaldırıldı (kod duruyor, yalnız kutular yok).
- **Hızlı takım maçı:** kulüp sayfasında 🏆 Takım maçı → `?role=admin&setup=team&quick=team`; kulübün sahibi/süper için şifresiz
  (`_quickTeam`, BridgePlay oturumu yeter) `quickTeamMatch()`: 2 takım × 2 çift, 2 masa, 1 tur, board 1–8, hemen başlar;
  `s._noLead` (atak sorulmaz), `s._quickTeam`. Masalar 1–8 arası istediği board'u seçer; 2. masa 5'ten başlar, aynı maçın açık
  board'u diğer masada 🔒 (`boardLocks` anahtarı `M1_<board>`). Sonuçlarda ayrı **🏆 Takım maçı** sekmesi (`IDXT`, `teamScoreOf`),
  kulüp reytingine takım maçları girmez.
- **Takım maçı** kulüplerde geri açıldı (BridgeScore → Kurulum → Hareket: Takım maçı; takım adları, takım başına 2/4/6… çift).
  `generateTeamMatch` düzeltildi (eskiden aynı çift iki masaya oturuyordu): maç başına 1. masa A(KG)–B(DB), 2. masa B(KG)–A(DB),
  aynı eller; N tur, her A çifti her B çiftiyle bir kez. Skor `calcTeamMatchIMP` (impA/impB brüt), `teamScoreHtml` sonuç sayfası
  ve ekranda. Tek sayıda çift engelli. TD konsolu (`td-console.js` MOVS, "Yeni turnuva") da takım maçını
  içeriyor (takım adları, 2/4/6/8 çift); BridgePlay kulüp sayfasındaki 🏆 Takım maçı → `?role=admin&setup=team` seçili açar.
- Web Push yeni Cloudflare hesabında çalışıyor (abonelik KV, yönetici Firebase oturumuyla). Ayarlar'da durum + 🔔 Deneme.
  Kullanıcının Xiaomi telefonunda FCM 201 dönüyor ama bildirim görünmedi → telefonun pil/otomatik başlatma ayarları (yarım).

### 2026-11-23
- **Yeni sürüm şeridi** (`#updBar`, controllerchange'de sakin an değilse), **Ayarlar'da çevrimdışı hazır** (`offReadyCheck`),
  **smoke test çevrimdışı adım** (sunucu kapanır, uygulama önbellekten açılıp el dağıtmalı), **kulüp listesinde sıradaki turnuva**
  (`clubNext`), **takvime ekle** (Google Takvim linki + .ics, `clubCalGoogle`/`clubIcs`).
- **Web Push** (uygulama kapalıyken bildirim): Worker `/push/key|sub|unsub|send|last`, D1 tablosu `push`, secret `VAPID_JWK`
  (`.github/botchat/vapid.mjs`). Push boş gelir, sw.js `/push/last`'tan türünü alıp telefonun dilinde gösterir.
  Uygulama: `pushSetup` (izin varsa günde bir abone), `pushSend` (supSend→admin 'msg', clubAsk→admin 'club', supReply→oyuncu
  'reply' review key ile; kulupler saSendClubToPlayer→'clubopen'). **Kurulum kullanıcıda**: README'deki 3 komut (D1, secret, deploy).
- Claim savunmada da çalışır: `claimSeat()` (löve senin elinde değilse kendi koltuğun), claim her zaman senin tarafına sayılır;
  online masada misafirin claim'i de kendi koltuğu için (net.js `d.t === "claim"`).
- Kulüp bilgisi: kulüp yöneticisi BridgeScore'da TD → Kulüp ayarları → ℹ️ Kulüp bilgisi (adres, irtibat kişisi, telefon) →
  `gate/clubs/<id>/bm/info {adr,kp,tel,sch:[{d,t:'19:00',k,n}]}` (sch = turnuva günleri, en çok 7;
  d: 0 her gün, 8 hafta içi, 9 hafta sonu, 1–7 Pzt–Paz; k: pairs/teams/indiv/begin/online — okuyanın dilinde; n serbest not, çevrilmez). BridgePlay Kulüpler'de kulübe basınca Sonuçlar'ın altında "ℹ️ Kulüp bilgisi" düğmesi
  (bilgi varsa), basınca tam ekran sayfa (`openOv('clubinfo')`, `.ciPage`, kulübün rengi ve logosu, ‹ Geri kulübe döner; `clubInfoHtml`): adres → Google Maps yol
  tarifi, telefon → `tel:` Ara / `sms:` SMS.
- **Açılış hızı:** sw.js artık FILES listesindeki dosyaları önce önbellekten verir (eskiden her açılışta her dosya internetten
  istenirdi: kötü bağlantıda ~4,7 s → 0,1 s). Güncelleme: yeni VERSION → arka planda iner, bir sonraki açılışta yeni sürüm.
  Bu yüzden VERSION'u artırmayı UNUTMA — artırılmazsa telefonlar eski dosyada kalır.
- **Çevrimdışı hata düzeltildi** (uçakta açılmadı): `js/lang/*.js` sw.js önbellek listesinde yoktu → internetsiz boş sayfa
  ("LANGS is not defined"). Artık 10 dil dosyası önbellekte, önbellek dosya dosya dolar, bir önceki sürüm yedek kalır.
  Test: Playwright ile çevrimiçi aç → `context.setOffline(true)` → yeniden aç → el başlat. Yeni dosya eklenince sw.js FILES'a ekle!
- Ana sayfa: Açık masaların altında "🏛️ Kendi kulübünü kur" kartı; form (ad + federasyon zorunlu, şehir/not isteğe bağlı),
  talep yöneticinin mesajlarına; "Kulübü aç" ile süper yönetici paneli dolu açılır, ID + şifre oyuncuya otomatik gider.
  Bir oyuncu 14 gün içinde cevapsız ikinci talep gönderemez; aynı adda kulüp varsa uyarı. 10 dil.
- Yeni kulüp talebi yöneticiye: ekranda uyarı + arka planda telefon bildirimi (`supCheck`, `SET.klSeen`); ana sayfada
  cevapsız her talep için kart + "Kulübü aç" (`Net.klReq`). Yönetici o oyuncuya herhangi bir mesaj yazınca talep listeden düşer.
- "Kulübü aç" her zaman süper yönetici şifresini sorar (şifresiz geçiş geri alındı). Panelde talep ayrı kutuda; form boş kalır,
  "Bu talepten doldur" ile dolar — ID/şifre oyuncuya yalnızca o zaman gider. Talep 🗑 ile silinir (`Net.clubAskDelete`:
  talep + otomatik teşekkür; başka mesaj yoksa tüm konuşma).

### 2026-11-22
- Deklarasyon pratiği: robotların deklarasyonu sonucun hemen altında, açık (kapalı "details" değil). `tools/build.mjs` eklendi.
- Süper yönetici paneli: her kulüpte ✏️ Name — kulübün adı değişir (4 yerde; ID ve link aynı kalır). TR + 8 dil çeviri.
- Admin → All players: oyuncu bayrağı/ülkesi (son girişin IP'sinden), günlük ülke.
- Robot notları pop-up yerine Admin → What the robots learned listesinde.
- Kulüpler: Kapat düğmesi üstte.
- PC formatı sonrası bu `CLAUDE.md` oluşturuldu (önceki oturum notları kayıptı; özet commit geçmişinden çıkarıldı).

### 2026-11-21
- İsim değişikliği: Bridge Table → **BridgePlay** (tüm diller, rehberler, og görselleri).
- Ana sayfa: sistem düğmeleri (SAYC, 2/1, Acol, SEF, Precision, Polish), PC'de iki sütun.
- Robot deklarasyonu: RKCB sonrası slem (+52 IMP), 8'li fit + ~32 puanla slem arama (+32 IMP),
  minör manş daveti kabulü (+62 IMP).
- Yeni: deklarasyon pratiği, el sonu koçu, Results → My week, öğretmen modu (PBN/LIN turnuva),
  herkese el kaydı yükleme, robotlara karşı undo, gizlilik sayfası + hesap silme talebi,
  cihaz hata raporları, Admin → Usage and limits.
- Robot sohbeti: Gemini Flash Lite, dil algılama, hava durumu (Open-Meteo), lobi robotu.
- Smoke test (pre-push hook + GitHub Actions).
