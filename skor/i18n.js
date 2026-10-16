// BricSkor bilingual interface (English / Turkish)
// Keeps the original English UI as the source of truth and translates only
// visible interface text. Tournament data, player names and bridge codes remain
// untouched.
(function(){
  'use strict';

  const STORAGE_KEY='bg_language';
  const SUPPORTED=['en','tr'];

  const TR={
    'BricSkor · Tournament System':'BricSkor · Turnuva Sistemi',
    'Tournament Control System':'Turnuva Kontrol Sistemi',
    'Enter ↵':'Gir ↵',
    'Sign in to Bridge Table first (name and PIN), then come back here.':'Önce Bridge Table’a isim ve PIN ile giriş yap, sonra buraya dön.',
    'Bridge Table':'Bridge Table',
    'My clubs':'Kulüplerim',
    'Open another club':'Başka bir kulüp aç',
    'Open your club':'Kulübünü aç',
    'Club name':'Kulüp adı',
    'Create club':'Kulüp oluştur',
    'Join a club\'s tournament (table or screen)':'Bir kulübün turnuvasına katıl (masa ya da ekran)',
    'Club created':'Kulüp oluşturuldu',
    'Enter the club name':'Kulüp adını yaz',
    'Sign in to Bridge Table first':'Önce Bridge Table’a giriş yap',
    'This club is switched off':'Bu kulüp kapatılmış',
    'Table code (4 digits)':'Masa kodu (4 hane)',
    'Your Bridge Table PIN':'Bridge Table PIN’in',
    'Wrong table code':'Hatalı masa kodu',
    'Wrong PIN':'Hatalı PIN',
    'You are not this club\'s admin':'Bu kulübün yöneticisi değilsin',
    'Only the super admin can sign in here':'Buradan sadece süper yönetici girebilir',
    'The results appear here when the director finishes the tournament.':'Sonuçlar, yönetici turnuvayı bitirince burada görünür.',
    'The results appear when the director finishes the tournament.':'Sonuçlar, yönetici turnuvayı bitirince görünür.',
    'Table codes':'Masa kodları',
    'Each table signs in with a 4-digit code: the 2-digit prefix below and its table number. With 00, table 1 is 0001, table 2 is 0002 and so on. Change the prefix to make the old codes stop working.':'Her masa 4 haneli bir kodla girer: aşağıdaki 2 haneli ön ek ve masa numarası. 00 ile 1. masa 0001, 2. masa 0002 olur. Ön eki değiştirince eski kodlar çalışmaz.',
    'Prefix (2 digits)':'Ön ek (2 hane)',
    'Link for the table devices':'Masa cihazları için link',
    'Open this link on each table\'s phone or tablet and type that table\'s code.':'Bu linki her masanın telefonunda ya da tabletinde aç ve o masanın kodunu yaz.',
    'Table codes saved':'Masa kodları kaydedildi',
    'Two digits, e.g. 00':'İki hane, ör. 00',
    'Opening lead':'İlk çıkış',
    '(optional)':'(isteğe bağlı)',
    'Passed out':'Pas geçildi',
    'Choose the contract first':'Önce kontratı seç',
    'editing':'düzenleniyor',
    'No clubs yet. A player opens a club from the club page.':'Henüz kulüp yok. Kulübü bir oyuncu kulüp sayfasından açar.',
    'MP + IMP':'MP + IMP',
    'Tournament':'Turnuva',
    'Bridge Tournament':'Briç Turnuvası',
    'Tournament Results':'Turnuva Sonuçları',
    'Choose your language':'Dilinizi seçin',
    'Language':'Dil',
    'English':'İngilizce',
    'Turkish':'Türkçe',
    'Club ID':'Kulüp Kimliği',
    'Continue':'Devam Et',
    'Change club':'Kulüp değiştir',
    'Super Admin Login':'Süper Yönetici Girişi',
    'Admin':'Yönetici',
    'Table':'Masa',
    'Screen':'Ekran',
    'Password':'Parola',
    'Login':'Giriş Yap',
    'Logout':'Çıkış',
    'Log Out':'Çıkış Yap',
    'Back':'Geri',
    'Online':'Çevrimiçi',
    'Offline':'Çevrimdışı',
    'Checking...':'Kontrol ediliyor...',
    'Loading...':'Yükleniyor...',
    'Saved tournament found':'Kayıtlı turnuva bulundu',
    'New Tournament':'Yeni Turnuva',
    'Round':'Tur',
    'Setup':'Kurulum',
    'Players':'Oyuncular',
    'Movement':'Hareket',
    'Tables':'Masalar',
    'Boards':'Boardlar',
    'History':'Geçmiş',
    'Log':'Kayıtlar',
    'Security':'Güvenlik',
    'Tournament Setup':'Turnuva Kurulumu',
    'Tournament ID (auto)':'Turnuva Kimliği (otomatik)',
    'Assigned automatically when tournament is created':'Turnuva oluşturulduğunda otomatik atanır',
    'Number of Players':'Oyuncu Sayısı',
    'Boards per Round':'Tur Başına Board',
    'Scoring':'Skorlama',
    'Matchpoints (MP)':'Maç Puanı (MP)',
    'IMPs':'IMP',
    'Mitchell — NS fixed, EW moves':'Mitchell — NS sabit, EW hareket eder',
    'Howell — all pairs move':'Howell — tüm çiftler hareket eder',
    'Swiss — pairings adapt to standings each round':'İsviçre — eşleşmeler her tur sıralamaya göre yenilenir',
    'Mitchell: pair count is double the table count. Howell: everyone plays everyone. Swiss: pairing is re-computed automatically after every round.':'Mitchell: çift sayısı masa sayısının iki katıdır. Howell: herkes herkesle oynar. İsviçre: eşleşmeler her turdan sonra otomatik yeniden hesaplanır.',
    'Number of Rounds (Swiss)':'Tur Sayısı (İsviçre)',
    'Swiss note: v1 requires an even number of pairs (no bye/phantom support yet).':'İsviçre notu: v1 çift sayısının çift olmasını gerektirir (bay/hayalet desteği henüz yoktur).',
    'Create Tournament':'Turnuva Oluştur',
    'Round Control':'Tur Kontrolü',
    'Tournament finished!':'Turnuva tamamlandı!',
    'All rounds are complete. You can finish the tournament.':'Tüm turlar tamamlandı. Turnuvayı bitirebilirsiniz.',
    'Running':'Devam Ediyor',
    'Finished':'Tamamlandı',
    'Elapsed':'Geçen Süre',
    'Start Round 1':'1. Turu Başlat',
    'Next Round':'Sonraki Tur',
    'Finish Tournament':'Turnuvayı Bitir',
    'Table Link':'Masa Bağlantısı',
    'Send this to whoever is opening a table — it skips straight to the Table password screen for this club.':'Bunu masa açacak kişiye gönderin; doğrudan bu kulübün masa parolası ekranına gider.',
    'Send this link to whoever is opening a table. It skips straight to the Table password screen.':'Bu bağlantıyı masa açacak kişiye gönderin. Doğrudan masa parolası ekranına gider.',
    'Copy':'Kopyala',
    'Slow Table Alert':'Yavaş Masa Uyarısı',
    "Beep + on-screen warning if a table hasn't entered a score in this many minutes.":'Bir masa bu süre boyunca skor girmediyse sesli ve ekranda uyarı verir.',
    'minutes':'dakika',
    'Save':'Kaydet',
    'Data':'Veri',
    'Export':'Dışa Aktar',
    'Import':'İçe Aktar',
    'Reset':'Sıfırla',
    'Share Table Link':'Masa Bağlantısını Paylaş',
    'Close':'Kapat',
    'Last round!':'Son tur!',
    'Slow Table':'Yavaş Masa',
    'Slow Tables':'Yavaş Masalar',
    'Tournament Complete!':'Turnuva Tamamlandı!',
    'Dismiss':'Kapat',
    'Tournament Complete':'Turnuva Tamamlandı',
    'Duration':'Süre',
    'Pair':'Çift',
    'Export Results':'Sonuçları Dışa Aktar',
    'Import Data':'Verileri İçe Aktar',
    'Import a previously exported JSON file.':'Daha önce dışa aktarılmış bir JSON dosyasını içe aktarın.',
    'Choose JSON File':'JSON Dosyası Seç',
    'Or paste JSON:':'Veya JSON verisini yapıştırın:',
    'Cancel':'İptal',
    'Delete Everything':'Her Şeyi Sil',
    'Reset Tournament':'Turnuvayı Sıfırla',
    'Backup Players?':'Oyuncular Yedeklensin mi?',
    'Player 1':'Oyuncu 1',
    'Player 2':'Oyuncu 2',
    'Player 1 — Full Name':'Oyuncu 1 — Ad Soyad',
    'Player 2 — Full Name':'Oyuncu 2 — Ad Soyad',
    'Full Name':'Ad Soyad',
    'First Last':'Ad Soyad',
    'Remove':'Kaldır',
    'Add Pair':'Çift Ekle',
    'Player Registry':'Oyuncu Kayıtları',
    'Clear All Names':'Tüm İsimleri Temizle',
    'Board File Upload':'Board Dosyası Yükleme',
    'Load pre-dealt boards from a file.':'Önceden dağıtılmış boardları bir dosyadan yükleyin.',
    'Skip':'Atla',
    'Drag / Select boards.json':'boards.json dosyasını sürükleyin veya seçin',
    'Continuing without a board file...':'Board dosyası olmadan devam ediliyor...',
    'No players found':'Oyuncu bulunamadı',
    'New':'Yeni',
    'Backup downloaded':'Yedek indirildi',
    'Clear All':'Tümünü Temizle',
    'No archived tournaments yet.':'Henüz arşivlenmiş turnuva yok.',
    'No archived tournaments':'Arşivlenmiş turnuva yok',
    'No player data found in archives.':'Arşivlerde oyuncu verisi bulunamadı.',
    'Player':'Oyuncu',
    'Played':'Oynama',
    'Avg%':'Ort.%',
    'Best%':'En İyi%',
    'Worst%':'En Kötü%',
    'Add Player':'Oyuncu Ekle',
    'NS Player Name':'NS Oyuncu Adı',
    'EW Player Name':'EW Oyuncu Adı',
    'Player Name':'Oyuncu Adı',
    'Add':'Ekle',
    'Load PBN / LIN Hand File':'PBN / LIN El Dosyası Yükle',
    'Upload a hand file in .pbn or .lin format.':'.pbn veya .lin biçiminde bir el dosyası yükleyin.',
    'Select .pbn / .lin / .txt':'.pbn / .lin / .txt seçin',
    'Or paste file contents:':'Veya dosya içeriğini yapıştırın:',
    'Load':'Yükle',
    'Movement Chart':'Hareket Şeması',
    'Print PDF':'PDF Yazdır',
    'NS Pair':'NS Çifti',
    'EW Pair':'EW Çifti',
    'Contract':'Kontrat',
    'NS Score':'NS Skoru',
    'EW Score':'EW Skoru',
    'Note':'Not',
    'Board':'Board',
    'Save ADJ':'ADJ Kaydet',
    'Export JSON':'JSON Dışa Aktar',
    'Export PBN':'PBN Dışa Aktar',
    'Key':'Anahtar',
    'Lead':'Çıkış',
    'Archived Tournaments':'Arşivlenmiş Turnuvalar',
    'View Results':'Sonuçları Gör',
    'Rankings':'Sıralama',
    'Board Results':'Board Sonuçları',
    'PDF Output':'PDF Çıktısı',
    'Overall Rankings':'Genel Sıralama',
    'Table/Round/B':'Masa/Tur/B',
    'Table/R/B':'Masa/Tur/B',
    'Opening Lead':'Açılış Çıkışı',
    'Passwords are stored in Firebase and apply to all devices immediately.':'Parolalar Firebase üzerinde saklanır ve anında tüm cihazlara uygulanır.',
    'Admin Password':'Yönetici Parolası',
    'Admin password':'Yönetici parolası',
    'Current Admin Password':'Mevcut Yönetici Parolası',
    'Current password':'Mevcut parola',
    'New Admin Password':'Yeni Yönetici Parolası',
    'New password (min 4 chars)':'Yeni parola (en az 4 karakter)',
    'Confirm New Password':'Yeni Parolayı Onayla',
    'Repeat new password':'Yeni parolayı tekrar girin',
    'Save Admin Password':'Yönetici Parolasını Kaydet',
    'Table Password':'Masa Parolası',
    'Table password':'Masa parolası',
    'Current Admin Password (to authorise)':'Yetkilendirme İçin Yönetici Parolası',
    'New Table Password':'Yeni Masa Parolası',
    'New table password (min 4 chars)':'Yeni masa parolası (en az 4 karakter)',
    'Save Table Password':'Masa Parolasını Kaydet',
    'Clear':'Temizle',
    'System Log':'Sistem Kayıtları',
    'No logs yet':'Henüz kayıt yok',
    'Tournament not started':'Turnuva başlamadı',
    'Ask the director to start the tournament':'Turnuva yöneticisinden turnuvayı başlatmasını isteyin',
    'Select your table number':'Masa numaranızı seçin',
    'NS Side':'NS Tarafı',
    'EW Side':'EW Tarafı',
    'SELECT TABLE →':'MASA SEÇ →',
    'OK':'Tamam',
    'Enter':'Gir',
    'Round Complete — Continue':'Tur Tamamlandı — Devam Et',
    'Tournament Finished':'Turnuva Tamamlandı',
    'All boards completed':'Tüm boardlar tamamlandı',
    'Results can be viewed on the Screen display':'Sonuçlar Ekran görünümünden izlenebilir',
    'Matchpoint Scoring':'Maç Puanı Skorlaması',
    'IMP Scoring':'IMP Skorlaması',
    'MP + IMP Scoring':'MP + IMP Skorlaması',
    'BOARDS THIS ROUND':'BU TURDAKİ BOARDLAR',
    'All Boards Complete ✓':'Tüm Boardlar Tamamlandı ✓',
    'Awaiting Approval...':'Onay Bekleniyor...',
    'Ready':'Hazır',
    'Next Board:':'Sonraki Board:',
    'Phantom pair — sit out':'Hayalet çift — bu tur bekleyin',
    'Same board — other results':'Aynı board — diğer sonuçlar',
    'Move instructions below':'Hareket talimatları aşağıdadır',
    'OK — Show Waiting Screen →':'Tamam — Bekleme Ekranını Göster →',
    'Stay at Table':'Masada Kal',
    'Waiting for Players':'Oyuncular Bekleniyor',
    'Waiting for players':'Oyuncular bekleniyor',
    'Players seated →':'Oyuncular oturdu →',
    'Please confirm or enter your names':'Lütfen adlarınızı doğrulayın veya girin',
    'North-South':'Kuzey-Güney',
    'East-West':'Doğu-Batı',
    'Boards to play':'Oynanacak boardlar',
    'Confirm — Start Playing':'Onayla — Oyuna Başla',
    'Edit Pair Names':'Çift Adlarını Düzenle',
    'Contract:':'Kontrat:',
    'Lead:':'Çıkış:',
    'Result:':'Sonuç:',
    'Level & Status':'Seviye ve Durum',
    'Suit':'Renk',
    'Declarer':'Deklaran',
    'Result':'Sonuç',
    'Adjusted Score':'Ayarlanmış Skor',
    'NO VUL':'ZON YOK',
    'BOTH VUL':'İKİ TARAF ZON',
    'PASS':'PAS',
    'passed out':'pas geçildi',
    'made exactly':'tam yapıldı',
    'NS SCORE PREVIEW':'NS SKOR ÖNİZLEMESİ',
    'Send to Opponent':'Rakibe Gönder',
    'Awaiting Approval':'Onay Bekleniyor',
    'Waiting for opponent to confirm...':'Rakibin onayı bekleniyor...',
    'Waiting for opponent to confirm':'Rakibin onayı bekleniyor',
    'Waiting for opponent device to confirm...':'Rakip cihazın onayı bekleniyor...',
    'Both Agreed':'İki Taraf da Onayladı',
    'Score confirmed!':'Skor onaylandı!',
    'Approval cancelled':'Onay iptal edildi',
    'Approved! Next board.':'Onaylandı! Sonraki board.',
    'Score saved!':'Skor kaydedildi!',
    'Select level, suit and declarer':'Seviye, renk ve deklaranı seçin',
    'Overall':'Genel',
    'Live':'Canlı',
    'Pairs':'Çiftler',
    'Boards Done':'Tamamlanan Board',
    'No scores entered yet':'Henüz skor girilmedi',
    'Pair / Player':'Çift / Oyuncu',
    'Dir':'Yön',
    'Score %':'Skor %',
    'Tournament not set up':'Turnuva kurulmadı',
    'Occupied':'Dolu',
    'Free':'Boş',
    'Force Unlock':'Kilidi Zorla Aç',
    'No completed boards yet':'Henüz tamamlanmış board yok',
    'No boards entered yet':'Henüz board girilmedi',
    'Tournament not created':'Turnuva oluşturulmadı',
    'Tournament not created yet':'Turnuva henüz oluşturulmadı',
    'Create tournament first to manage players.':'Oyuncuları yönetmek için önce turnuva oluşturun.',
    'All Completed Board Results':'Tamamlanan Tüm Board Sonuçları',
    'Loading clubs…':'Kulüpler yükleniyor…',
    'Failed to load clubs.':'Kulüpler yüklenemedi.',
    'inactive':'pasif',
    'Created:':'Oluşturulma:',
    'Reset Passwords':'Parolaları Sıfırla',
    'Deactivate':'Devre Dışı Bırak',
    'Activate':'Etkinleştir',
    'Delete':'Sil',
    'No clubs yet. Create the first one below.':'Henüz kulüp yok. İlk kulübü aşağıdan oluşturun.',
    'New Club':'Yeni Kulüp',
    'Change Super Admin Password':'Süper Yönetici Parolasını Değiştir',
    'Club ID (used in the shareable URL — letters/numbers only, no spaces)':'Kulüp Kimliği (paylaşılabilir bağlantıda kullanılır — yalnızca harf/rakam, boşluk yok)',
    'Tip: adding a random suffix (e.g. -7k2p) makes the club harder to find by guessing.':'İpucu: rastgele bir son ek (örn. -7k2p) kulübün tahmin edilerek bulunmasını zorlaştırır.',
    'Club Name':'Kulüp Adı',
    'Club Passwords':'Kulüp Parolaları',
    'Admin Password (min 4 characters)':'Yönetici Parolası (en az 4 karakter)',
    'Generate':'Oluştur',
    'Table Password (min 4 characters)':'Masa Parolası (en az 4 karakter)',
    'Passwords are required — write them down, there is no default fallback.':'Parolalar zorunludur; not edin, varsayılan yedek parola yoktur.',
    'Create':'Oluştur',
    'New Admin Password (min 4 characters)':'Yeni Yönetici Parolası (en az 4 karakter)',
    'New Table Password (min 4 characters)':'Yeni Masa Parolası (en az 4 karakter)',
    'Delete Club':'Kulübü Sil',
    'Delete Permanently':'Kalıcı Olarak Sil',
    'New Password (min 4 characters)':'Yeni Parola (en az 4 karakter)',
    'Change Passwords':'Parolaları Değiştir',
    'New password':'Yeni parola',
    'Please Confirm':'Lütfen Onaylayın',
    'Confirm':'Onayla',
    'Missing Names':'Eksik İsimler',
    'Start Anyway':'Yine de Başlat',
    'Table Already Open':'Masa Zaten Açık',
    'Enter Anyway':'Yine de Gir',
    'Export backup first?':'Önce yedek dışa aktarılsın mı?',
    'Export Backup':'Yedeği Dışa Aktar',
    'Just Log Out':'Yalnızca Çıkış Yap',
    'Final Results':'Nihai Sonuçlar',
    'No results yet':'Henüz sonuç yok',
    'Wrong password':'Hatalı parola',
    'No club selected':'Kulüp seçilmedi',
    'Enter a Club ID':'Kulüp kimliği girin',
    'Club not found':'Kulüp bulunamadı',
    'Enter a valid Club ID':'Geçerli bir kulüp kimliği girin',
    'Enter a club name':'Kulüp adı girin',
    'Admin password must be at least 4 characters':'Yönetici parolası en az 4 karakter olmalıdır',
    'Table password must be at least 4 characters':'Masa parolası en az 4 karakter olmalıdır',
    'Admin and table passwords must be different':'Yönetici ve masa parolaları farklı olmalıdır',
    'Club created:':'Kulüp oluşturuldu:',
    'Club deactivated':'Kulüp devre dışı bırakıldı',
    'Club activated':'Kulüp etkinleştirildi',
    'Set new admin and table passwords for':'Şu kulüp için yeni yönetici ve masa parolalarını belirleyin:',
    'Passwords updated':'Parolalar güncellendi',
    'This permanently deletes':'Bu işlem şu kulübü kalıcı olarak siler:',
    'and all of its tournament data. This cannot be undone.':'ve tüm turnuva verileri. Bu işlem geri alınamaz.',
    'Club deleted':'Kulüp silindi',
    'Use at least 4 characters':'En az 4 karakter kullanın',
    'Super Admin password updated':'Süper Yönetici parolası güncellendi',
    'ACTIVE':'ETKİN',
    'Back online — syncing...':'Yeniden çevrimiçi — eşitleniyor...',
    'Offline — changes queued locally':'Çevrimdışı — değişiklikler cihazda sıraya alındı',
    'Min 4 players':'En az 4 oyuncu',
    'Boards/round: 1-8':'Tur başına board: 1-8',
    'Need at least 8 players (2 tables)':'En az 8 oyuncu (2 masa) gerekir',
    'Swiss (v1) needs a player count divisible by 4 — no bye/phantom support yet':'İsviçre (v1), 4’e bölünebilen oyuncu sayısı gerektirir — bay/hayalet desteği henüz yoktur',
    'Swiss: choose at least 3 rounds':'İsviçre: en az 3 tur seçin',
    'Cannot compute rounds — check player count':'Turlar hesaplanamadı — oyuncu sayısını kontrol edin',
    'Tournament created! Enter player names in the Players tab.':'Turnuva oluşturuldu! Oyuncular sekmesinden oyuncu adlarını girin.',
    'Already started':'Zaten başlatıldı',
    'Enter a valid number of minutes':'Geçerli bir dakika değeri girin',
    'Link copied!':'Bağlantı kopyalandı!',
    "Swiss pairing for the next round isn't ready yet — waiting for all tables to finish.":'Sonraki turun İsviçre eşleşmesi henüz hazır değil — tüm masaların bitmesi bekleniyor.',
    'Tournament finished & archived':'Turnuva tamamlandı ve arşivlendi',
    'Exported':'Dışa aktarıldı',
    'Paste JSON first':'Önce JSON verisini yapıştırın',
    'Invalid JSON':'Geçersiz JSON',
    'Invalid file':'Geçersiz dosya',
    'Imported!':'İçe aktarıldı!',
    'Reset complete — Player Registry preserved':'Sıfırlama tamamlandı — oyuncu kayıtları korundu',
    'Enter a name':'Bir ad girin',
    'Saved:':'Kaydedildi:',
    'Registry cleared':'Kayıt listesi temizlendi',
    'All names cleared':'Tüm isimler temizlendi',
    'NS/EW counts mismatch — cannot add':'NS/EW sayıları eşleşmiyor — eklenemedi',
    'Added:':'Eklendi:',
    'Removed:':'Kaldırıldı:',
    'Boards loaded':'Boardlar yüklendi',
    'Invalid file format':'Geçersiz dosya biçimi',
    'File is empty':'Dosya boş',
    'Format not recognised':'Biçim tanınmadı',
    'hands loaded!':'el yüklendi!',
    'No completed boards to export':'Dışa aktarılacak tamamlanmış board yok',
    'PBN file downloaded':'PBN dosyası indirildi',
    'Saved':'Kaydedildi',
    'ADJ saved':'ADJ kaydedildi',
    'Fill all fields':'Tüm alanları doldurun',
    'Min 4 characters':'En az 4 karakter',
    'Passwords do not match':'Parolalar eşleşmiyor',
    'Current password incorrect':'Mevcut parola hatalı',
    'Admin password updated':'Yönetici parolası güncellendi',
    'Admin password incorrect':'Yönetici parolası hatalı',
    'Table password updated':'Masa parolası güncellendi',
    'Firebase error:':'Firebase hatası:',
    'Failed:':'Başarısız:',
    'Online Only':'Yalnızca Çevrimiçi',
    'BricSkor requires an internet connection.':'BricSkor internet bağlantısı gerektirir.',
    'Please use the GitHub Pages URL.':'Lütfen GitHub Pages bağlantısını kullanın.',
    'Load Hand Records':'El Kayıtlarını Yükle',
    'Load the hands of this session: the file from your dealing machine or bridge program. The double-dummy analysis starts by itself.':'Bu oturumun ellerini yükleyin: dağıtım makinenizin ya da briç programınızın dosyası. Double-dummy analizi kendiliğinden başlar.',
    'Supported:':'Desteklenen:',
    'Select a hand file':'Bir el dosyası seçin',
    'Or paste file contents (PBN or LIN):':'Ya da dosya içeriğini yapıştırın (PBN veya LIN):',
    'Load':'Yükle',
    'Hands & Double-Dummy Analysis':'Eller ve Double-Dummy Analizi',
    'Load hand file':'El dosyası yükle',
    'Analyse again':'Yeniden analiz et',
    'Load the file from your dealing machine (Dealer4 .dlm, Duplimate .dup/.bri/.dge) or a PBN / LIN file: every board then shows its hands, what each player can make and the par score.':'Dağıtım makinenizin dosyasını (Dealer4 .dlm, Duplimate .dup/.bri/.dge) ya da bir PBN / LIN dosyasını yükleyin: her board için eller, her oyuncunun neyi yapabileceği ve par sonucu görünür.',
    'The numbers are the level each player can make as declarer (– = not even 1); all four hands open, best play on both sides.':'Sayılar her oyuncunun deklaran olarak yapabileceği seviyedir (– = 1 bile yapılamaz); dört el açık, iki taraf da en iyi oynar.',
    'The analysis of this board is not ready yet.':'Bu boardun analizi henüz hazır değil.',
    'Par:':'Par:',
    'Tricks':'Löve',
    'NS score':'NS skoru',
    'Analysis is not available on this device':'Bu cihazda analiz yapılamıyor',
    'Analysis stopped':'Analiz durdu',
    'No complete boards found in this file':'Bu dosyada tam bir board bulunamadı',
    'This file is locked (crypto key). Save the boards unlocked or as PBN in the dealer program.':'Bu dosya kilitli (şifre anahtarı). Boardları dağıtım programında kilitsiz ya da PBN olarak kaydedin.'
  };

  const PATTERNS=[
    [/^→ (\d+) tables?( \+ phantom| \+ one pair sits out each round)?( · ⚠ every table plays the same boards each round: one copy of the boards per table)?$/,(_,n,a,b)=>`→ ${n} masa${a?(a.includes('phantom')?' + hayalet':' + her turda bir çift bekler'):''}${b?' · ⚠ her turda tüm masalar aynı boardları oynar: her masaya bir board kopyası gerekir':''}`],
    [/^(\d+) boards loaded( — (\d+) damaged boards skipped)?$/,(_,n,a,d)=>`${n} board yüklendi${a?' — '+d+' hasarlı board atlandı':''}`],
    [/^Analysing (\d+) boards…$/,(_,n)=>`${n} board analiz ediliyor…`],
    [/^Analysis ready: (\d+) boards$/,(_,n)=>`Analiz hazır: ${n} board`],
    [/^(\d+) \/ (\d+) analysed$/,(_,a,b)=>`${a} / ${b} analiz edildi`],
    [/^Board (\d+)$/,(_,n)=>`Board ${n}`],
    [/^Dealer ([NESW?]) · Vulnerable: (.*)$/,(_,d,v)=>`Dağıtan ${d} · Zon: ${v}`],
    [/^(\+|-)(\d+) vs DD$/,(_,s,n)=>`${s}${n} löve (DD'ye göre)`],
    [/^→ (\d+) tables$/,(_,n)=>`→ ${n} masa`],
    [/^→ (\d+) tables \+ phantom pair \(not supported for Swiss yet\)$/,(_,n)=>`→ ${n} masa + hayalet çift (İsviçre için henüz desteklenmiyor)`],
    [/^→ (\d+) boards\/round × (\d+) rounds = (\d+) total boards · each pair plays (\d+) boards$/,(_,b,r,t,p)=>`→ Tur başına ${b} board × ${r} tur = toplam ${t} board · her çift ${p} board oynar`],
    [/^Round (\d+) \/ (\d+)$/,(_,a,b)=>`Tur ${a} / ${b}`],
    [/^Round (\d+) Complete!?$/,(_,n)=>`Tur ${n} Tamamlandı!`],
    [/^Round (\d+) started!?$/,(_,n)=>`Tur ${n} başlatıldı!`],
    [/^Round (\d+)$/,(_,n)=>`Tur ${n}`],
    [/^Next Round \((\d+)\)$/,(_,n)=>`Sonraki Tur (${n})`],
    [/^Start Round (\d+)$/,(_,n)=>`${n}. Turu Başlat`],
    [/^All tables finished Round (\d+)!$/,(_,n)=>`Tüm masalar ${n}. turu tamamladı!`],
    [/^(\d+)\/(\d+) boards completed\. You can start Round (\d+)\.$/,(_,a,b,n)=>`${a}/${b} board tamamlandı. ${n}. turu başlatabilirsiniz.`],
    [/^Round (\d+): (\d+)\/(\d+) boards completed$/,(_,n,a,b)=>`Tur ${n}: ${a}/${b} board tamamlandı`],
    [/^Round (\d+) progress: (\d+)\/(\d+) boards · (\d+)%$/,(_,n,a,b,p)=>`Tur ${n} ilerlemesi: ${a}/${b} board · %${p}`],
    [/^Round (\d+)  ·  Table (\d+)  ·  Boards (.+)$/,(_,r,t,b)=>`Tur ${r}  ·  Masa ${t}  ·  Boardlar ${b}`],
    [/^Round (\d+)  \|  NS: (.+)  EW: (.+)  \|  Board (\d+)$/,(_,r,ns,ew,b)=>`Tur ${r}  |  NS: ${ns}  EW: ${ew}  |  Board ${b}`],
    [/^Round (\d+) — Table (\d+)$/,(_,r,t)=>`Tur ${r} — Masa ${t}`],
    [/^Table (\d+)  ·  Round (\d+)$/,(_,t,r)=>`Masa ${t}  ·  Tur ${r}`],
    [/^Table\s+(\d+)\s+·\s+Round\s+(\d+)$/,(_,t,r)=>`Masa ${t} · Tur ${r}`],
    [/^Table (\d+) — Round (\d+)$/,(_,t,r)=>`Masa ${t} — Tur ${r}`],
    [/^Table (\d+) — Adjusted Score$/,(_,t)=>`Masa ${t} — Ayarlanmış Skor`],
    [/^Table (\d+)$/,(_,n)=>`Masa ${n}`],
    [/^Board (\d+) — Awaiting Approval$/,(_,n)=>`Board ${n} — Onay Bekleniyor`],
    [/^Board (\d+) — Other tables \((\d+)\)$/,(_,b,n)=>`Board ${b} — Diğer masalar (${n})`],
    [/^Board (\d+)$/,(_,n)=>`Board ${n}`],
    [/^Boards (.+)$/,(_,range)=>`Boardlar ${range}`],
    [/^Next Round (\d+) — Boards$/,(_,n)=>`Sonraki Tur ${n} — Boardlar`],
    [/^Stay at Table (\d+)$/,(_,n)=>`Masa ${n}'de Kal`],
    [/^→ Table (\d+)$/,(_,n)=>`→ Masa ${n}`],
    [/^Please take your seats at Table (\d+)$/,(_,n)=>`Lütfen Masa ${n}'de yerlerinizi alın`],
    [/^(\d+) boards this round$/,(_,n)=>`Bu tur ${n} board`],
    [/^(\d+) tables$/,(_,n)=>`${n} masa`],
    [/^(\d+) rounds$/,(_,n)=>`${n} tur`],
    [/^(\d+) boards\/round$/,(_,n)=>`Tur başına ${n} board`],
    [/^(\d+) boards completed$/,(_,n)=>`${n} board tamamlandı`],
    [/^(\d+) boards$/,(_,n)=>`${n} board`],
    [/^(\d+) pairs$/,(_,n)=>`${n} çift`],
    [/^(\d+) players$/,(_,n)=>`${n} oyuncu`],
    [/^(\d+) pairs · (\d+) players$/,(_,a,b)=>`${a} çift · ${b} oyuncu`],
    [/^(\d+) pairs · (\d+) boards completed$/,(_,a,b)=>`${a} çift · ${b} board tamamlandı`],
    [/^Search (\d+) players\.\.\.$/,(_,n)=>`${n} oyuncuda ara...`],
    [/^Table (\d+) — NS \+ EW pair$/,(_,n)=>`Masa ${n} — NS + EW çifti`],
    [/^Pair (\d+)$/,(_,n)=>`Çift ${n}`],
    [/^Player (\d+)$/,(_,n)=>`Oyuncu ${n}`],
    [/^(\d+) min without a score$/,(_,n)=>`${n} dakikadır skor yok`],
    [/^Table (\d+) — (\d+) min without a score$/,(_,t,n)=>`Masa ${t} — ${n} dakikadır skor yok`],
    [/^Elapsed: (.+)$/,(_,v)=>`Geçen süre: ${v}`],
    [/^Duration: (.+)$/,(_,v)=>`Süre: ${v}`],
    [/^Alert threshold set to (\d+) min$/,(_,n)=>`Uyarı eşiği ${n} dakika olarak ayarlandı`],
    [/^Table (\d+) unlocked$/,(_,n)=>`Masa ${n} kilidi açıldı`],
    [/^Enter a valid table number \(1-(\d+)\)$/,(_,n)=>`Geçerli bir masa numarası girin (1-${n})`],
    [/^The director has not started Round (\d+) yet\. Please wait\.\.\.$/,(_,n)=>`Turnuva yöneticisi ${n}. turu henüz başlatmadı. Lütfen bekleyin...`],
    [/^Waiting for other tables to finish so Round (\d+)'s pairing can be calculated…$/,(_,n)=>`${n}. turun eşleşmesinin hesaplanabilmesi için diğer masaların bitmesi bekleniyor…`],
    [/^(\d+) hands loaded!$/,(_,n)=>`${n} el yüklendi!`],
    [/^Super Admin — Clubs \((\d+)\)$/,(_,n)=>`Süper Yönetici — Kulüpler (${n})`],
    [/^All Completed Boards \((\d+)\)$/,(_,n)=>`Tamamlanan Tüm Boardlar (${n})`],
    [/^Archived Tournaments \((\d+)\)$/,(_,n)=>`Arşivlenmiş Turnuvalar (${n})`],
    [/^System Log \((\d+)\)$/,(_,n)=>`Sistem Kayıtları (${n})`],
    [/^Board Results \((\d+) boards\)$/,(_,n)=>`Board Sonuçları (${n} board)`],
    [/^(.+) — Final Results$/,(_,name)=>`${name} — Nihai Sonuçlar`],
    [/^(.+) — Tournament Results$/,(_,name)=>`${name} — Turnuva Sonuçları`],
    [/^(.+) — Movement$/,(_,name)=>`${name} — Hareket`],
    [/^(.+) — Movement Chart$/,(_,name)=>`${name} — Hareket Şeması`],
    [/^(.+) Results$/,(_,name)=>`${name} Sonuçları`],
    [/^(\d+) pair\(s\) don't have names entered yet\.$/,(_,n)=>`${n} çiftin adı henüz girilmemiş.`],
    [/^Do you still want to start Round 1\?$/,()=>`Yine de 1. turu başlatmak istiyor musunuz?`],
    [/^Table (\d+) already appears open on another device\.$/,(_,n)=>`Masa ${n} başka bir cihazda açık görünüyor.`],
    [/^Do you still want to enter this table\?$/,()=>`Yine de bu masaya girmek istiyor musunuz?`],
    [/^Swiss: max (\d+) rounds for (\d+) pairs \(can't avoid repeat pairings beyond that\)$/,(_,r,p)=>`İsviçre: ${p} çift için en fazla ${r} tur (bundan sonra tekrar eşleşmeler önlenemez)`],
    [/^Export (\d+) players to backup file before reset\?$/,(_,n)=>`Sıfırlamadan önce ${n} oyuncu yedek dosyasına aktarılsın mı?`],
    [/^Added: (.+)$/,(_,name)=>`Eklendi: ${name}`],
    [/^Saved: (.+)$/,(_,name)=>`Kaydedildi: ${name}`],
    [/^Removed: (.+)$/,(_,name)=>`Kaldırıldı: ${name}`],
    [/^Club created: (.+)$/,(_,name)=>`Kulüp oluşturuldu: ${name}`],
    [/^Finished: (.+)$/,(_,date)=>`Tamamlanma: ${date}`],
    [/^Printed: (.+)$/,(_,date)=>`Yazdırma: ${date}`],
    [/^NS Pair \((.+)\)$/,(_,id)=>`NS Çifti (${id})`],
    [/^EW Pair \((.+)\)$/,(_,id)=>`EW Çifti (${id})`],
    [/^Table (\d+) has finished$/,(_,n)=>`${n}. masa bitirdi`],
    [/^Table (\d+) is not in this tournament$/,(_,n)=>`${n}. masa bu turnuvada yok`],
    [/^Table (\d+) – Round (\d+)$/,(_,t,r)=>`Masa ${t} – Tur ${r}`],
    [/^Round (\d+)\/(\d+)$/,(_,a,b)=>`Tur ${a}/${b}`],
    [/^Next Board: (\d+)$/,(_,n)=>`Sıradaki board: ${n}`],
    [/^(\d+) of (\d+) \(next\)$/,(_,a,b)=>`${a} / ${b} (sıradaki)`],
    [/^Board\s+(\d+) — Awaiting Approval$/,(_,n)=>`Board ${n} — Onay bekleniyor`],
    [/^Contract: (.+)$/,(_,v)=>`Kontrat: ${v==='PASS'?'PAS':v}`],
    [/^Lead: (.+)$/,(_,v)=>`Çıkış: ${v}`],
    [/^Result: (.+)$/,(_,v)=>`Sonuç: ${v==='PASS'?'PAS':v}`],
    [/^NS Score: (.+)$/,(_,v)=>`NS Skoru: ${v}`],
    [/^(NS|EW) VUL$/,(_,side)=>`${side} ZON`],
    [/^\+(\d+) overtricks?$/,(_,n)=>`+${n} fazla löve`],
    [/^(\d+) down$/,(_,n)=>`${n} batık`]
  ];

  let currentLanguage=readSavedLanguage()||'en';
  let languageSwitching=false;
  const originalText=new WeakMap();
  const originalAttrs=new WeakMap();

  function readSavedLanguage(){
    try{
      const saved=localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.includes(saved)?saved:null;
    }catch(e){return null;}
  }

  function translateCore(value){
    if(Object.prototype.hasOwnProperty.call(TR,value))return TR[value];
    for(const [pattern,replacer] of PATTERNS){
      if(pattern.test(value)){
        pattern.lastIndex=0;
        return value.replace(pattern,replacer);
      }
    }
    if(value.includes(' · ')){
      const translated=value.split(' · ').map(part=>translateCore(part));
      if(translated.some((part,i)=>part!==value.split(' · ')[i]))return translated.join(' · ');
    }
    return value;
  }

  function translateEnglish(value){
    if(typeof value!=='string'||!value)return value;
    const leading=value.match(/^\s*/)?.[0]||'';
    const trailing=value.match(/\s*$/)?.[0]||'';
    const core=value.slice(leading.length,value.length-trailing.length);
    if(!core)return value;

    let translated=translateCore(core);
    if(translated===core){
      const prefixMatch=core.match(/^([^A-Za-z0-9ÇĞİÖŞÜçğıöşü]*)(.+)$/s);
      if(prefixMatch){
        const restTranslated=translateCore(prefixMatch[2]);
        if(restTranslated!==prefixMatch[2])translated=prefixMatch[1]+restTranslated;
      }
    }
    return leading+translated+trailing;
  }

  function isSkippedTextNode(node){
    const parent=node.parentElement;
    return !parent||!!parent.closest('script,style,noscript,[data-i18n-ignore]');
  }

  function setTranslatedText(node){
    if(isSkippedTextNode(node))return;
    const current=node.nodeValue;
    const previousOriginal=originalText.get(node);
    const expected=previousOriginal===undefined
      ?undefined
      :(currentLanguage==='tr'?translateEnglish(previousOriginal):previousOriginal);

    if(previousOriginal===undefined||(!languageSwitching&&current!==expected))originalText.set(node,current);
    const original=originalText.get(node);
    const next=currentLanguage==='tr'?translateEnglish(original):original;
    if(node.nodeValue!==next)node.nodeValue=next;
  }

  function setTranslatedAttributes(el){
    if(!(el instanceof Element)||el.closest('[data-i18n-ignore]'))return;
    const names=['placeholder','title','aria-label'];
    let originals=originalAttrs.get(el);
    if(!originals){originals={};originalAttrs.set(el,originals);}
    for(const name of names){
      if(!el.hasAttribute(name))continue;
      const current=el.getAttribute(name);
      const old=originals[name];
      const expected=old===undefined?undefined:(currentLanguage==='tr'?translateEnglish(old):old);
      if(old===undefined||(!languageSwitching&&current!==expected))originals[name]=current;
      const next=currentLanguage==='tr'?translateEnglish(originals[name]):originals[name];
      if(current!==next)el.setAttribute(name,next);
    }
  }

  function applyTranslationsTo(root){
    if(!root)return;
    const doc=root.nodeType===9?root:(root.ownerDocument||document);
    const start=root.nodeType===9?root.documentElement:root;
    if(!start)return;

    if(start.nodeType===Node.TEXT_NODE)setTranslatedText(start);
    else if(start.nodeType===Node.ELEMENT_NODE)setTranslatedAttributes(start);

    const walker=doc.createTreeWalker(
      start,
      NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT
    );
    let node=walker.currentNode;
    while(node){
      if(node.nodeType===Node.TEXT_NODE)setTranslatedText(node);
      else setTranslatedAttributes(node);
      node=walker.nextNode();
    }

    if(root.nodeType===9){
      root.documentElement.lang=currentLanguage;
      const title=root.querySelector('title');
      if(title)setTranslatedText(title.firstChild);
    }
  }

  function updateLanguageControls(){
    document.documentElement.lang=currentLanguage;
    document.documentElement.dataset.language=currentLanguage;
    const manifest=document.querySelector('link[rel="manifest"]');
    if(manifest)manifest.setAttribute('href',currentLanguage==='tr'?'manifest-tr.json':'manifest.json');
    document.querySelectorAll('[data-language-toggle]').forEach(btn=>{
      btn.textContent=currentLanguage==='tr'?'EN':'TR';
      btn.setAttribute('aria-label',currentLanguage==='tr'?'Dili İngilizce yap':'Switch language to Turkish');
      btn.setAttribute('title',currentLanguage==='tr'?'English':'Türkçe');
    });
  }

  function setLanguage(language,{remember=true,closeGate=true}={}){
    if(!SUPPORTED.includes(language))language='en';
    currentLanguage=language;
    if(remember){
      try{localStorage.setItem(STORAGE_KEY,language);}catch(e){}
    }
    if(closeGate){
      const gate=document.getElementById('languageGate');
      if(gate)gate.classList.add('language-gate-hidden');
    }
    updateLanguageControls();
    languageSwitching=true;
    try{applyTranslationsTo(document);}
    finally{languageSwitching=false;}
    window.dispatchEvent(new CustomEvent('bridgegate:languagechange',{detail:{language}}));
  }

  window.setLanguage=language=>setLanguage(language);
  window.toggleLanguage=()=>setLanguage(currentLanguage==='tr'?'en':'tr');
  window.getLanguage=()=>currentLanguage;
  window.isTurkish=()=>currentLanguage==='tr';
  window.i18nText=value=>currentLanguage==='tr'?translateEnglish(String(value)):String(value);
  window.applyTranslationsTo=applyTranslationsTo;
  window.localizePrintWindow=(printWindow)=>{
    if(!printWindow||!printWindow.document)return;
    applyTranslationsTo(printWindow.document);
    setTimeout(()=>printWindow.print(),80);
  };

  function init(){
    const saved=readSavedLanguage();
    const gate=document.getElementById('languageGate');
    if(saved&&gate)gate.classList.add('language-gate-hidden');
    setLanguage(saved||'en',{remember:false,closeGate:!!saved});

    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations){
        if(mutation.type==='characterData'){
          setTranslatedText(mutation.target);
          continue;
        }
        if(mutation.type==='attributes'){
          setTranslatedAttributes(mutation.target);
          continue;
        }
        mutation.addedNodes.forEach(node=>applyTranslationsTo(node));
      }
    });
    observer.observe(document.documentElement,{
      subtree:true,
      childList:true,
      characterData:true,
      attributes:true,
      attributeFilter:['placeholder','title','aria-label']
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
