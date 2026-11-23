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
_(2026-11-22 itibarıyla)_ Yarım iş yok. Sürümler: site `bridge-v635`, kulüpler `kulup-v165`.
- Kulüp programının sürümü ayrı: `kulupler/service-worker.js` → `CACHE_NAME` (kulupler/ değişince artır).
- Kulüp adı 4 yerde tutulur: `gate/clubs/<id>/info/name`, `gate/clubList/<id>/n`, `gate/owners/<sahip>/<id>`, `gate/live/<id>/c`.

- Kulüp talebi akışı: ana sayfa kartı `#hClubAsk` → form → `Net.clubAsk` → `destek/<oyuncu>/m` (mesajda `kl`), otomatik teşekkür (`kl:1`).
  Admin mesajda "Kulübü aç" → `kulupler/?sa=1&nc=&nf=&for=&forn=` → süper yönetici paneli dolu gelir; kulüp açılınca
  oyuncuya `kd:{n,id,pw}` mesajı (`saSendClubToPlayer`). Firebase kuralı değişmedi.

## Oturum günlüğü
(En yeni en üstte. Her oturumda 2–5 satır: ne yapıldı, ne yarım kaldı, sıradaki fikirler.)

### 2026-11-23
- Kulüp bilgisi: kulüp yöneticisi BridgeScore'da TD → Kulüp ayarları → ℹ️ Kulüp bilgisi (adres, irtibat kişisi, telefon) →
  `gate/clubs/<id>/bm/info {adr,kp,tel}`. BridgePlay Kulüpler'de kulübe basınca kart (`clubInfoHtml`): adres → Google Maps yol
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
