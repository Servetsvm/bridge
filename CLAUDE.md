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
- Ardından `dist/bridge-table.html`'i yeniden üret (`build.ps1`; Linux'ta pwsh yoksa aynı adımları node ile yap:
  split.js → index.html'e css/js/lang gömülür, ikon base64). Her site commit'i dist'i de içerir.
- Push öncesi smoke test: `git config core.hooksPath .githooks` (klon başına bir kez). Atlamak: `SKIP_SMOKE=1`.
- Commit mesajları İngilizce, tek satır, kullanıcının gözünden ne değiştiğini anlatır
  ("Home: …", "Robots: …", "Admin → …: …"). Robot düzeltmelerinde test sonucu yazılır
  (ör. "6000 deals: 24 contracts changed, +52 IMP") ve lesson entry sürümü / robot fix tarihi güncellenir.
- Arayüz metni değişirse en az EN / TR / NO çevirileri güncellenir.
- Sırlar (GEMINI_KEY vb.) asla depoya girmez; Cloudflare secret olarak tutulur.
- `lessons.json` (robot öğrenme kitabı) 2026-11-08'de durduruldu; değiştirme.

## Kaldığımız yer
_(2026-11-22 itibarıyla)_ Yarım iş yok. Sürümler: site `bridge-v628`, kulüpler `kulup-v161`.
- Kulüp programının sürümü ayrı: `kulupler/service-worker.js` → `CACHE_NAME` (kulupler/ değişince artır).
- Kulüp adı 4 yerde tutulur: `gate/clubs/<id>/info/name`, `gate/clubList/<id>/n`, `gate/owners/<sahip>/<id>`, `gate/live/<id>/c`.

## Oturum günlüğü
(En yeni en üstte. Her oturumda 2–5 satır: ne yapıldı, ne yarım kaldı, sıradaki fikirler.)

### 2026-11-22
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
