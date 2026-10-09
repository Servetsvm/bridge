/* Bridge Table — screen, game flow, field comparison and settings. */
'use strict';
const E = {}; for (const f of window.BRIDGE) f(E);
const { SUIT, STR, RTXT, SEAT, S, R, pd, sideOf, B, LV, ST, isNum, vulOf, dealerOf, callTxt, legalCalls, isLegal, auctionOver, contractOf, ev, scoreOf } = E;

let SET = { style: "classic", seat: 2, speed: 1, expl: true, auto: true, mode: 'IMP', opp: 'same', conv: { ...E.ALL_ON } };
let G = null, HIST = [], BOARD = 0, timer = null;
/* ---- language: the screens are written in English; T() gives the Turkish, Norwegian, Spanish or French text ({0} = a value) ---- */
const I18N = {
  tr: {
    "All": "Tümü", "Registering": "Kayıt açık", "Running": "Oynanıyor", "Mine": "Benimkiler", "Tournament": "Turnuva", "Players": "Oyuncu", "Status": "Durum", "Ends in": "Kalan süre", "{0} d {1} h": "{0} g {1} sa", "{0} h {1} min": "{0} sa {1} dk", "Register": "Kaydol", "No tournaments here.": "Burada turnuva yok.", "Edit my card": "Kartımı düzenle",
    "Country/Region": "Ülke/Bölge", "Skill level": "Beceri düzeyi", "Joined": "Oluşturma tarihi", "Logins": "Girişler", "Title": "Ünvan", "Newcomer": "Yeni gelen", "Strategist": "Stratejist", "Master": "Usta", "Grandmaster": "Büyük usta",
    "At {0}'s table": "{0} masasında", "Country": "Ülke", "Level": "Seviye", "Not set": "Seçilmedi", "About me": "Hakkımda", "A few words about you (system, what you like…)": "Kendinden birkaç kelime (sistemin, sevdiklerin…)", "Beginner": "Başlangıç", "Intermediate": "Orta", "Advanced": "İleri", "Expert": "Uzman", "World class": "Dünya klasmanı",
    "Contract": "Kontrat", "Today": "Bugün", "last:": "son:", "New Deal": "Yeni El", "Sure?": "Emin misin?", "Undo": "Geri al", "Chat": "Sohbet", "Hint": "İpucu", "Claim": "Claim", "Online": "Online", "Help": "Yardım", "Settings": "Ayarlar", "Results": "Sonuçlar", "Home": "Ana sayfa",
    "Us": "Biz", "Them": "Onlar", "Pass": "Pas", "Double": "Kontr", "Redouble": "Sürkontr",
    "Your call": "Teklif sırası sende", "{0} is thinking…": "{0} düşünüyor…", "Gathering the trick…": "Löve toplanıyor…", "Your turn: play a card": "Sıra sende: kart oyna", "Play from {0}'s hand": "{0} elinden oyna", "{0} is playing…": "{0} oynuyor…",
    "Press Start to deal": "Dağıtmak için Başla'ya bas", "Waiting for the host to start": "Host'un başlatması bekleniyor", "Waiting for players — press Start when everyone is seated": "Oyuncular bekleniyor — herkes oturunca Başla'ya bas", "Board finished": "El bitti",
    "Tap a call to see what it means": "Anlamını görmek için bir teklife dokun", "Next deal": "Sonraki el", "Tap for details": "Ayrıntılar için dokun", "Tap here to see the last trick": "Son löveyi görmek için dokun",
    "Bridge Table": "Briç Masası", "Your name": "Adın", "Start": "Başla", "Continue": "Devam et", "Seat me at a table": "Beni uygun masaya al", "Open tables": "Açık masalar", "Lobby chat": "Lobi sohbeti", "Write a message…": "Mesaj yaz…", "Send": "Gönder",
    "Our convention card (with partner)": "Konvansiyon kartımız (partnerle)", "No messages yet — say hello!": "Henüz mesaj yok — merhaba de!", "{0} in the lobby": "Lobide {0} kişi", "Your last board is waiting.": "Son elin seni bekliyor.",
    "Play alone with robots, or join a table where a robot is playing.": "Robotlarla tek başına oyna ya da robotun oynadığı bir masaya katıl.", "Language": "Dil", "boards": "el", "Open a waiting room": "Bekleme salonu aç",
    "{0}'s table": "{0} masası", "playing with robots": "robotlarla oynuyor", "online": "online", "waiting to start": "başlamayı bekliyor", "board {0}": "{0}. el", "Ask to join": "Katılmak iste", "Robot": "Robot", "away · robot plays": "uzakta · robot oynuyor",
    "No other tables are open right now.": "Şu an başka açık masa yok.", "Looking for tables…": "Masalar aranıyor…", "Refresh the list": "Listeyi yenile", "Show open tables": "Açık masaları göster",
    "Online table": "Online masa", "Sit here": "Buraya otur", "Remove": "Kaldır", "(you)": "(sen)", "Waiting for the host to start.": "Host'un başlatması bekleniyor.", "“Sit here” asks the host to move you.": "“Buraya otur” host'tan yer değiştirme izni ister.",
    "Asking to join": "Katılmak istiyor", "Accept": "Kabul", "Decline": "Reddet", "(opponent)": "(rakip)", "(partner)": "(partner)", "Asking to change seats": "Yer değiştirmek istiyor", "asks for a new deal": "yeni el istiyor", "asks to reset the table score": "masa skorunun sıfırlanmasını istiyor",
    "Table score": "Masa skoru", "Reset the score": "Skoru sıfırla", "Ask to reset the score": "Skor sıfırlamayı iste", "Ask for a new deal": "Yeni el iste",
    "Join {0}'s table": "{0} masasına katıl", "Sit as": "Otur", "The host's partner": "Host'un partneri", "An opponent": "Rakip", "Any free seat": "Herhangi boş yer", "Join": "Katıl", "Not now": "Şimdi değil", "Cancel": "İptal",
    "Waiting for the host to accept you…": "Host'un kabul etmesi bekleniyor…", "{0} decides whether you can sit.": "Oturup oturamayacağına {0} karar verir.",
    "No table has a free seat right now.": "Şu an boş yeri olan masa yok.", "Asked {0} for a seat…": "{0} masasından yer istendi…", "Asked the host for a new deal": "Host'tan yeni el istendi", "The host said no": "Host kabul etmedi", "You are offline": "İnternet bağlantısı yok",
    "Watch": "İzle", "You are watching this table.": "Bu masayı izliyorsun.", "Tournaments": "Turnuvalar", "New tournament": "Yeni turnuva", "Play": "Oyna", "Standings": "Sıralama", "Close": "Kapat", "Player": "Oyuncu", "{0} boards": "{0} el", "{0} players": "{0} oyuncu", "you: {0}/{1}": "sen: {0}/{1}",
    "Nobody has played yet.": "Henüz kimse oynamadı.", "{0} boards · started by {1} · results arrive as the others play": "{0} el · başlatan {1} · diğerleri oynadıkça sonuçlar gelir", "No tournaments yet. Start one — everyone in the lobby gets the same deals.": "Henüz turnuva yok. Bir tane başlat — lobideki herkes aynı elleri oynar.",
    "Tournament board {0} of {1} — you sit South": "Turnuva eli {0}/{1} — South'ta oturuyorsun", "Close the online table first": "Önce online masayı kapat", "Finish this tournament board first": "Önce bu turnuva elini bitir",
    "Going back to your table…": "Masana geri dönülüyor…", "Your system": "Sistemin", "Play with robots, join a table or open your own.": "Robotlarla oyna, bir masaya katıl ya da kendi masanı aç.", "Convention card": "Konvansiyon kartı", "Close the table?": "Masa kapatılsın mı?", "Yes": "Evet", "No": "Hayır", "Play with robots": "Robotlarla oyna", "Against the tournament ({0} players): {1} IMP · {2}%": "Turnuvaya karşı ({0} oyuncu): {1} IMP · %{2}", "Leave the table you are at first": "Önce oturduğun masadan kalk", "No table to watch right now.": "Şu an izlenecek masa yok.", "Play as partners": "Partner olarak oyna", "Practice these boards": "Bu elleri tekrar oyna", "Practice: board {0} of {1}": "Alıştırma: el {0} / {1}", "Watch a table": "Bir masa izle", "wants to play with you as partners": "seninle partner olarak oynamak istiyor", "Add as friend": "Arkadaş ekle", "Alert": "Alert", "Alert your next call and say what it means": "Vereceğin teklifi alert et ve anlamını yaz", "Back to the list": "Listeye dön", "Bd": "El", "Boards played today — tap one to see the hands, the auction and the play.": "Bugün oynanan eller — elleri, açık artırmayı ve oyunu görmek için birine bas.", "Contract": "Kontrat", "Friend": "Arkadaş", "History": "Geçmiş", "Next deal": "Sonraki el", "No boards yet today.": "Bugün henüz el yok.", "Nobody has played this board yet.": "Bu eli henüz kimse oynamadı.", "Other tables": "Diğer masalar", "Player": "Oyuncu", "Previous deal": "Önceki el", "Robot reading": "Robotun yorumu", "Score": "Puan", "Tap your own row to replay the board.": "Eli tekrar izlemek için kendi satırına bas.", "Total": "Toplam", "What does your next call mean?": "Vereceğin teklif ne anlama geliyor?", "Your turn — the table is waiting ({0} s)": "Sıra sende — masa bekliyor ({0} sn)", "{0} has not played for {1} s — tap the name to remove": "{0} {1} sn’dir oynamıyor — çıkarmak için adına bas", "{0} is in the lobby": "{0} lobide", "{0} is not in the lobby — the message is delivered when they come": "{0} lobide değil — mesaj geldiğinde iletilecek", "Close table": "Masayı kapat", "Sound when it is your turn": "Sıra sende olunca ses", "Turn sound off": "Sıra sesi kapalı", "Turn sound on": "Sıra sesi açık", "Close the table for everyone?": "Masa herkes için kapatılsın mı?", "Remove {0} from the table? A robot plays the seat.": "{0} masadan çıkarılsın mı? Yerine robot oynar.", "Tournament board {0} of {1} — you sit {2}": "Turnuva eli {0} / {1} — {2} oturuyorsun", "Where do you sit?": "Nereye oturuyorsun?", "N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.": "K–G oyuncuları K–G ile, D–B oyuncuları D–B ile sıralanır. Bütün ellerde bu yerde oturursun.", "Against 10 robot tables": "10 robot masasına karşı", "= your score against 10 robot tables that played the same boards; it ranks the players until others have played.": "= aynı elleri oynayan 10 robot masasına karşı puanın; başkaları oynayana kadar sıralama buna göre yapılır.", "Leave": "Kalk", "Leave the table?": "Masadan kalkılsın mı?", "Leave the table": "Masadan kalk", "Your rating": "Puanın", "This week": "Bu hafta", "This month": "Bu ay", "This year": "Bu yıl", "All time": "Tümü", "System": "Sistem", "IMP / board": "IMP / el", "No rating yet — it shows once this player has played (with the new version).": "Henüz puan yok — bu oyuncu (yeni sürümle) oynayınca görünür.", "Close — answer later": "Kapat — sonra cevapla", "Cancel the tournament?": "Turnuva iptal edilsin mi?", "Remove from my list": "Listemden kaldır", "Join the tournament": "Turnuvaya katıl", "Join and play": "Katıl ve oyna", "{0} started a tournament — everyone can play it": "{0} bir turnuva başlattı — herkes oynayabilir", "This tournament has not reached you yet — try again in a moment": "Turnuva bilgisi henüz gelmedi — birazdan tekrar dene", "your robot partner bids it too": "robot partnerin de bunu oynar", "Base system": "Temel sistem", "Conventions": "Konvansiyonlar", "from the next deal": "sonraki elden itibaren", "In the lobby": "Lobide", "Claim": "Claim", "How many of the remaining {0} tricks do you take?": "Kalan {0} lövenin kaçını alıyorsun?", "All {0}": "Hepsi ({0})", "Claim sent — waiting for the other side": "Claim gönderildi — karşı taraf bekleniyor", "You": "Sen", "Could not work it out yet — play a little longer": "Henüz hesaplanamadı — biraz daha oyna", "The robots do not accept: {0} tricks at most": "Robotlar kabul etmiyor: en fazla {0} löve", "{0} claimed {1} of the last {2} tricks — accepted": "{0} son {2} lövenin {1} tanesini claim etti — kabul edildi", "{0} claimed {1} of the last {2} tricks — not accepted": "{0} son {2} lövenin {1} tanesini claim etti — kabul edilmedi", "Robots": "Robotlar", "The robots claimed the last {0} tricks — accepted": "Robotlar son {0} löveyi claim etti — kabul edildi", "The robots claimed the last {0} tricks — play goes on": "Robotlar son {0} löveyi claim etti — oyun devam ediyor", "{0} claims {1} of the last {2} tricks": "{0} son {2} lövenin {1} tanesini claim ediyor", "The robots claim all of the last {0} tricks": "Robotlar son {0} lövenin hepsini claim ediyor", "{0} wants to take back their last {1}": "{0} son {1} geri almak istiyor", "move": "hamlesini", "call": "teklifini", "Do you agree?": "Kabul ediyor musun?", "{0} wanted to take back their last {1} — not accepted": "{0} son {1} geri almak istedi — kabul edilmedi", "Nothing to take back, or the other side said no": "Geri alınacak bir şey yok ya da karşı taraf kabul etmedi", "Table": "Masa", "Lobby": "Lobi", "Alone with robots": "Robotlarla yalnız", "Shown in the lobby, nobody can join.": "Lobide görünür, kimse katılamaz.", "Open to others": "Herkese açık", "Shown in the lobby: players can ask to join, you accept.": "Lobide görünür: oyuncular katılmak isteyebilir, sen kabul edersin.", "Message": "Mesaj", "Write a private message to {0}.": "{0} kişisine özel mesaj yaz.", "Waiting for {0} to open the table": "{0} masayı açacak, bekleniyor", "Tournament board {0} of {1}": "Turnuva eli {0}/{1}", "Pair": "Çift", "Points": "Puan", "{0} tables": "{0} masa", "individual": "bireysel", "at tables": "masalarda", "ranked by {0}": "{0} ile sıralama", "started by {0}": "başlatan {0}", "table {0}, you sit {1}": "masa {0}, sen {1}", "Open table {0}": "{0}. masayı aç", "Join table {0}": "{0}. masaya katıl", "Table {0}": "Masa {0}", "Name": "Ad", "Tournament name": "Turnuva adı", "Boards": "El sayısı", "Format": "Biçim", "Tables": "Masalar", "Ranking": "Sıralama", "Keep the tournament for": "Turnuva saklama süresi", "{0} hours": "{0} saat", "1 day": "1 gün", "3 days": "3 gün", "Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.": "Oyuncular masalarda birlikte oturur; her masa aynı elleri oynar; boş koltuğu robot oynar. Masaya ilk yazılan oyuncu masayı açar.", "Players in the lobby": "Lobideki oyuncular", "Invite players": "Oyuncu davet et", "wants to join your table": "masana katılmak istiyor", "wants to watch your table": "masanı izlemek istiyor", "more waiting": "kişi daha bekliyor", "Open an online table first": "Önce online masa aç", "Invitation sent to {0}": "{0} davet edildi", "invites you to their table": "seni masasına davet ediyor", "Nobody else is in the lobby right now.": "Şu an lobide başka kimse yok.", "Invite to my table": "Masama davet et", "Open an online table to invite players to it.": "Oyuncu davet etmek için online masa aç.", "Public table": "Herkese açık masa", "Private table": "Kapalı masa", "Listed in the lobby: anyone can ask to join, you accept.": "Lobide listelenir: herkes katılmak isteyebilir, sen kabul edersin.", "Shown in the lobby with 🔒: invited players sit at once, others must ask you, no spectators.": "Lobide 🔒 ile görünür: davet ettiklerin hemen oturur, diğerleri sana sorar, izleyici olmaz.",     "Clear the chat": "Sohbeti temizle", "Open an online table": "Online masa aç", "Open your own online table (players ask to join and you accept them), or ask to join one of the tables below.": "Kendi online masanı aç (oyuncular katılmak ister, sen kabul edersin) ya da aşağıdaki masalardan birine katılmak iste.",
    "setting up": "hazırlanıyor", "{0} accepted": "{0} kabul etti", "Players and start": "Oyuncular ve başlat", "Waiting for {0} to start": "{0} başlatacak", "{0} invites you": "{0} seni davet ediyor", "{0} invites you to a tournament": "{0} seni turnuvaya davet ediyor",
    "No tournaments yet. Create one and invite the players you want.": "Henüz turnuva yok. Bir tane oluştur ve istediğin oyuncuları davet et.", "accepted": "kabul etti", "declined": "reddetti", "invited": "davet edildi", "organiser": "düzenleyen",
    "Everyone plays the same deals at their own table, sitting South. The tournament opens when you press Start.": "Herkes aynı elleri kendi masasında, South'ta oturarak oynar. Turnuva sen Başlat deyince açılır.", "Players to invite": "Davet edilecek oyuncular",
    "Nobody else is in the lobby right now — type a name below.": "Şu an lobide başka kimse yok — aşağıya bir isim yaz.", "Add a player by name": "İsimle oyuncu ekle", "Add": "Ekle", "Answers": "Cevaplar", "Send the invitations": "Davetleri gönder", "Start the tournament": "Turnuvayı başlat", "Cancel the tournament": "Turnuvayı iptal et",
    "Pick at least one player": "En az bir oyuncu seç", "Invitations sent": "Davetler gönderildi", "The tournament has started": "Turnuva başladı", "This tournament has not started yet": "Bu turnuva henüz başlamadı",
  },
  no: {
    "All": "Alle", "Registering": "Påmelding", "Running": "Pågår", "Mine": "Mine", "Tournament": "Turnering", "Players": "Spillere", "Status": "Status", "Ends in": "Slutter om", "{0} d {1} h": "{0} d {1} t", "{0} h {1} min": "{0} t {1} min", "Register": "Meld på", "No tournaments here.": "Ingen turneringer her.", "Edit my card": "Rediger kortet mitt",
    "Country/Region": "Land/region", "Skill level": "Ferdighetsnivå", "Joined": "Registrert", "Logins": "Innlogginger", "Title": "Tittel", "Newcomer": "Nykommer", "Strategist": "Strateg", "Master": "Mester", "Grandmaster": "Stormester",
    "At {0}'s table": "Ved bordet til {0}", "Country": "Land", "Level": "Nivå", "Not set": "Ikke valgt", "About me": "Om meg", "A few words about you (system, what you like…)": "Noen ord om deg (system, hva du liker …)", "Beginner": "Nybegynner", "Intermediate": "Middels", "Advanced": "Viderekommen", "Expert": "Ekspert", "World class": "Verdensklasse",
    "Contract": "Kontrakt", "Today": "I dag", "last:": "siste:", "New Deal": "Nytt spill", "Sure?": "Sikker?", "Undo": "Angre", "Chat": "Chat", "Hint": "Tips", "Claim": "Claim", "Online": "Online", "Help": "Hjelp", "Settings": "Innstillinger", "Results": "Resultater", "Home": "Hjem",
    "Us": "Vi", "Them": "De", "Pass": "Pass", "Double": "Dobl", "Redouble": "Redobl",
    "Your call": "Din melding", "{0} is thinking…": "{0} tenker…", "Gathering the trick…": "Stikket samles…", "Your turn: play a card": "Din tur: spill et kort", "Play from {0}'s hand": "Spill fra {0}", "{0} is playing…": "{0} spiller…",
    "Press Start to deal": "Trykk Start for å dele ut", "Waiting for the host to start": "Venter på at verten starter", "Waiting for players — press Start when everyone is seated": "Venter på spillere — trykk Start når alle sitter", "Board finished": "Spillet er ferdig",
    "Tap a call to see what it means": "Trykk på en melding for å se hva den betyr", "Next deal": "Neste spill", "Tap for details": "Trykk for detaljer", "Tap here to see the last trick": "Trykk her for å se siste stikk",
    "Bridge Table": "Bridgebord", "Your name": "Navnet ditt", "Start": "Start", "Continue": "Fortsett", "Seat me at a table": "Finn et bord til meg", "Open tables": "Åpne bord", "Lobby chat": "Lobbychat", "Write a message…": "Skriv en melding…", "Send": "Send",
    "Our convention card (with partner)": "Vårt konvensjonskort (med makker)", "No messages yet — say hello!": "Ingen meldinger ennå — si hei!", "{0} in the lobby": "{0} i lobbyen", "Your last board is waiting.": "Det siste spillet ditt venter.",
    "Play alone with robots, or join a table where a robot is playing.": "Spill alene med roboter, eller bli med ved et bord der en robot spiller.", "Language": "Språk", "boards": "spill", "Open a waiting room": "Åpne et venterom",
    "{0}'s table": "{0} sitt bord", "playing with robots": "spiller med roboter", "online": "online", "waiting to start": "venter på start", "board {0}": "spill {0}", "Ask to join": "Be om å bli med", "Robot": "Robot", "away · robot plays": "borte · robot spiller",
    "No other tables are open right now.": "Ingen andre bord er åpne nå.", "Looking for tables…": "Leter etter bord…", "Refresh the list": "Oppdater listen", "Show open tables": "Vis åpne bord",
    "Online table": "Online-bord", "Sit here": "Sitt her", "Remove": "Fjern", "(you)": "(deg)", "Waiting for the host to start.": "Venter på at verten starter.", "“Sit here” asks the host to move you.": "«Sitt her» ber verten om å flytte deg.",
    "Asking to join": "Vil bli med", "Accept": "Godta", "Decline": "Avslå", "(opponent)": "(motstander)", "(partner)": "(makker)", "Asking to change seats": "Vil bytte plass", "asks for a new deal": "ber om nytt spill", "asks to reset the table score": "ber om å nullstille bordets poeng",
    "Table score": "Bordets poeng", "Reset the score": "Nullstill poengene", "Ask to reset the score": "Be om nullstilling", "Ask for a new deal": "Be om nytt spill",
    "Join {0}'s table": "Bli med ved {0} sitt bord", "Sit as": "Sitt som", "The host's partner": "Vertens makker", "An opponent": "Motstander", "Any free seat": "Hvilken som helst ledig plass", "Join": "Bli med", "Not now": "Ikke nå", "Cancel": "Avbryt",
    "Waiting for the host to accept you…": "Venter på at verten godtar deg…", "{0} decides whether you can sit.": "{0} bestemmer om du kan sitte.",
    "No table has a free seat right now.": "Ingen bord har ledig plass nå.", "Asked {0} for a seat…": "Spurte {0} om en plass…", "Asked the host for a new deal": "Ba verten om nytt spill", "The host said no": "Verten sa nei", "You are offline": "Du er frakoblet",
    "Watch": "Se på", "You are watching this table.": "Du ser på dette bordet.", "Tournaments": "Turneringer", "New tournament": "Ny turnering", "Play": "Spill", "Standings": "Resultatliste", "Close": "Lukk", "Player": "Spiller", "{0} boards": "{0} spill", "{0} players": "{0} spillere", "you: {0}/{1}": "du: {0}/{1}",
    "Nobody has played yet.": "Ingen har spilt ennå.", "{0} boards · started by {1} · results arrive as the others play": "{0} spill · startet av {1} · resultatene kommer etter hvert som de andre spiller", "No tournaments yet. Start one — everyone in the lobby gets the same deals.": "Ingen turneringer ennå. Start en — alle i lobbyen får de samme spillene.",
    "Tournament board {0} of {1} — you sit South": "Turneringsspill {0} av {1} — du sitter Syd", "Close the online table first": "Lukk online-bordet først", "Finish this tournament board first": "Fullfør dette turneringsspillet først",
    "Going back to your table…": "Går tilbake til bordet ditt…", "Your system": "Systemet ditt", "Play with robots, join a table or open your own.": "Spill med roboter, bli med ved et bord eller åpne ditt eget.", "Convention card": "Konvensjonskort", "Close the table?": "Lukke bordet?", "Yes": "Ja", "No": "Nei", "Play with robots": "Spill med roboter", "Against the tournament ({0} players): {1} IMP · {2}%": "Mot turneringen ({0} spillere): {1} IMP · {2} %", "Leave the table you are at first": "Gå fra bordet du sitter ved først", "No table to watch right now.": "Ingen bord å se på akkurat nå.", "Play as partners": "Spill som makkere", "Practice these boards": "Spill disse spillene igjen", "Practice: board {0} of {1}": "Øving: spill {0} av {1}", "Watch a table": "Se på et bord", "wants to play with you as partners": "vil spille med deg som makker", "Add as friend": "Legg til som venn", "Alert": "Alert", "Alert your next call and say what it means": "Alert neste melding og skriv hva den betyr", "Back to the list": "Tilbake til listen", "Bd": "Sp", "Boards played today — tap one to see the hands, the auction and the play.": "Spill spilt i dag — trykk på ett for å se hendene, meldingene og spillet.", "Contract": "Kontrakt", "Friend": "Venn", "History": "Historikk", "Next deal": "Neste spill", "No boards yet today.": "Ingen spill i dag ennå.", "Nobody has played this board yet.": "Ingen har spilt dette spillet ennå.", "Other tables": "Andre bord", "Player": "Spiller", "Previous deal": "Forrige spill", "Robot reading": "Robotens tolkning", "Score": "Poeng", "Tap your own row to replay the board.": "Trykk på din egen rad for å se spillet igjen.", "Total": "Totalt", "What does your next call mean?": "Hva betyr neste melding?", "Your turn — the table is waiting ({0} s)": "Din tur — bordet venter ({0} s)", "{0} has not played for {1} s — tap the name to remove": "{0} har ikke spilt på {1} s — trykk på navnet for å fjerne", "{0} is in the lobby": "{0} er i lobbyen", "{0} is not in the lobby — the message is delivered when they come": "{0} er ikke i lobbyen — meldingen leveres når de kommer", "Close table": "Lukk bordet", "Sound when it is your turn": "Lyd når det er din tur", "Turn sound off": "Turlyd av", "Turn sound on": "Turlyd på", "Close the table for everyone?": "Lukke bordet for alle?", "Remove {0} from the table? A robot plays the seat.": "Fjerne {0} fra bordet? En robot spiller plassen.", "Tournament board {0} of {1} — you sit {2}": "Turneringsspill {0} av {1} — du sitter {2}", "Where do you sit?": "Hvor sitter du?", "N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.": "N–S-spillere rangeres mot N–S, Ø–V mot Ø–V. Du beholder plassen i alle spillene.", "Against 10 robot tables": "Mot 10 robotbord", "= your score against 10 robot tables that played the same boards; it ranks the players until others have played.": "= resultatet ditt mot 10 robotbord som spilte de samme spillene; det rangerer spillerne til andre har spilt.", "Leave": "Gå", "Leave the table?": "Forlate bordet?", "Leave the table": "Forlat bordet", "Your rating": "Rangeringen din", "This week": "Denne uken", "This month": "Denne måneden", "This year": "I år", "All time": "Totalt", "System": "System", "IMP / board": "IMP / spill", "No rating yet — it shows once this player has played (with the new version).": "Ingen rangering ennå — den vises når spilleren har spilt (med den nye versjonen).", "Close — answer later": "Lukk — svar senere", "Cancel the tournament?": "Avlyse turneringen?", "Remove from my list": "Fjern fra listen min", "Join the tournament": "Bli med i turneringen", "Join and play": "Bli med og spill", "{0} started a tournament — everyone can play it": "{0} startet en turnering — alle kan spille den", "This tournament has not reached you yet — try again in a moment": "Turneringen har ikke kommet fram ennå — prøv igjen om litt", "your robot partner bids it too": "robotmakkeren melder det også", "Base system": "Grunnsystem", "Conventions": "Konvensjoner", "from the next deal": "fra neste spill", "In the lobby": "I lobbyen", "Claim": "Claim", "How many of the remaining {0} tricks do you take?": "Hvor mange av de {0} siste stikkene tar du?", "All {0}": "Alle ({0})", "Claim sent — waiting for the other side": "Claim sendt — venter på den andre siden", "You": "Du", "Could not work it out yet — play a little longer": "Kan ikke regnes ut ennå — spill litt til", "The robots do not accept: {0} tricks at most": "Robotene godtar ikke: høyst {0} stikk", "{0} claimed {1} of the last {2} tricks — accepted": "{0} claimet {1} av de siste {2} stikkene — godtatt", "{0} claimed {1} of the last {2} tricks — not accepted": "{0} claimet {1} av de siste {2} stikkene — ikke godtatt", "Robots": "Roboter", "The robots claimed the last {0} tricks — accepted": "Robotene claimet de siste {0} stikkene — godtatt", "The robots claimed the last {0} tricks — play goes on": "Robotene claimet de siste {0} stikkene — spillet fortsetter", "{0} claims {1} of the last {2} tricks": "{0} claimer {1} av de siste {2} stikkene", "The robots claim all of the last {0} tricks": "Robotene claimer alle de siste {0} stikkene", "{0} wants to take back their last {1}": "{0} vil ta tilbake sitt siste {1}", "move": "trekk", "call": "melding", "Do you agree?": "Er du enig?", "{0} wanted to take back their last {1} — not accepted": "{0} ville ta tilbake sitt siste {1} — ikke godtatt", "Nothing to take back, or the other side said no": "Ingenting å ta tilbake, eller den andre siden sa nei", "Table": "Bord", "Lobby": "Lobby", "Alone with robots": "Alene med roboter", "Shown in the lobby, nobody can join.": "Vises i lobbyen, ingen kan bli med.", "Open to others": "Åpent for andre", "Shown in the lobby: players can ask to join, you accept.": "Vises i lobbyen: spillere kan be om å bli med, du godtar.", "Message": "Melding", "Write a private message to {0}.": "Skriv en privat melding til {0}.", "Waiting for {0} to open the table": "Venter på at {0} åpner bordet", "Tournament board {0} of {1}": "Turneringsspill {0} av {1}", "Pair": "Par", "Points": "Poeng", "{0} tables": "{0} bord", "individual": "individuell", "at tables": "ved bord", "ranked by {0}": "rangert etter {0}", "started by {0}": "startet av {0}", "table {0}, you sit {1}": "bord {0}, du sitter {1}", "Open table {0}": "Åpne bord {0}", "Join table {0}": "Gå til bord {0}", "Table {0}": "Bord {0}", "Name": "Navn", "Tournament name": "Turneringsnavn", "Boards": "Antall spill", "Format": "Form", "Tables": "Bord", "Ranking": "Rangering", "Keep the tournament for": "Behold turneringen i", "{0} hours": "{0} timer", "1 day": "1 dag", "3 days": "3 dager", "Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.": "Spillerne sitter sammen ved bord; alle bord spiller de samme spillene; roboter fyller tomme plasser. Den første spilleren ved et bord åpner det.", "Players in the lobby": "Spillere i lobbyen", "Invite players": "Inviter spillere", "wants to join your table": "vil bli med ved bordet ditt", "wants to watch your table": "vil se på bordet ditt", "more waiting": "venter til", "Open an online table first": "Åpne et online-bord først", "Invitation sent to {0}": "Invitasjon sendt til {0}", "invites you to their table": "inviterer deg til bordet sitt", "Nobody else is in the lobby right now.": "Ingen andre er i lobbyen nå.", "Invite to my table": "Inviter til mitt bord", "Open an online table to invite players to it.": "Åpne et online-bord for å invitere spillere.", "Public table": "Åpent bord", "Private table": "Lukket bord", "Listed in the lobby: anyone can ask to join, you accept.": "Vises i lobbyen: alle kan be om å bli med, du godtar.", "Shown in the lobby with 🔒: invited players sit at once, others must ask you, no spectators.": "Vises i lobbyen med 🔒: inviterte setter seg med en gang, andre må spørre deg, ingen tilskuere.",     "Clear the chat": "Tøm chatten", "Open an online table": "Åpne et online-bord", "Open your own online table (players ask to join and you accept them), or ask to join one of the tables below.": "Åpne ditt eget online-bord (spillere ber om å bli med og du godtar dem), eller be om å bli med ved et av bordene under.",
    "setting up": "settes opp", "{0} accepted": "{0} har takket ja", "Players and start": "Spillere og start", "Waiting for {0} to start": "Venter på at {0} starter", "{0} invites you": "{0} inviterer deg", "{0} invites you to a tournament": "{0} inviterer deg til en turnering",
    "No tournaments yet. Create one and invite the players you want.": "Ingen turneringer ennå. Lag en og inviter spillerne du vil.", "accepted": "takket ja", "declined": "takket nei", "invited": "invitert", "organiser": "arrangør",
    "Everyone plays the same deals at their own table, sitting South. The tournament opens when you press Start.": "Alle spiller de samme spillene ved sitt eget bord, som Syd. Turneringen åpner når du trykker Start.", "Players to invite": "Spillere som skal inviteres",
    "Nobody else is in the lobby right now — type a name below.": "Ingen andre er i lobbyen nå — skriv et navn under.", "Add a player by name": "Legg til en spiller med navn", "Add": "Legg til", "Answers": "Svar", "Send the invitations": "Send invitasjonene", "Start the tournament": "Start turneringen", "Cancel the tournament": "Avlys turneringen",
    "Pick at least one player": "Velg minst én spiller", "Invitations sent": "Invitasjonene er sendt", "The tournament has started": "Turneringen har startet", "This tournament has not started yet": "Denne turneringen har ikke startet ennå",
  },
  es: {
    "All": "Todos", "Registering": "Inscripción", "Running": "En juego", "Mine": "Míos", "Tournament": "Torneo", "Players": "Jugadores", "Status": "Estado", "Ends in": "Termina en", "{0} d {1} h": "{0} d {1} h", "{0} h {1} min": "{0} h {1} min", "Register": "Inscribirse", "No tournaments here.": "No hay torneos aquí.", "Edit my card": "Editar mi tarjeta",
    "Country/Region": "País/región", "Skill level": "Nivel", "Joined": "Fecha de alta", "Logins": "Accesos", "Title": "Título", "Newcomer": "Recién llegado", "Strategist": "Estratega", "Master": "Maestro", "Grandmaster": "Gran maestro",
    "At {0}'s table": "En la mesa de {0}", "Country": "País", "Level": "Nivel", "Not set": "Sin elegir", "About me": "Sobre mí", "A few words about you (system, what you like…)": "Unas palabras sobre ti (sistema, lo que te gusta…)", "Beginner": "Principiante", "Intermediate": "Intermedio", "Advanced": "Avanzado", "Expert": "Experto", "World class": "Clase mundial",
    "Contract": "Contrato", "Today": "Hoy", "last:": "última:", "New Deal": "Repartir", "Sure?": "¿Seguro?", "Undo": "Atrás", "Chat": "Chat", "Hint": "Pista", "Claim": "Reclamar", "Online": "En línea", "Help": "Ayuda", "Settings": "Ajustes", "Results": "Resultados", "Home": "Inicio",
    "Us": "Nos.", "Them": "Ellos", "Pass": "Paso", "Double": "Doblo", "Redouble": "Redoblo",
    "Your call": "Te toca declarar", "{0} is thinking…": "{0} está pensando…", "Gathering the trick…": "Recogiendo la baza…", "Your turn: play a card": "Tu turno: juega una carta", "Play from {0}'s hand": "Juega desde la mano de {0}", "{0} is playing…": "{0} está jugando…",
    "Press Start to deal": "Pulsa Empezar para repartir", "Waiting for the host to start": "Esperando a que el anfitrión empiece", "Waiting for players — press Start when everyone is seated": "Esperando jugadores — pulsa Empezar cuando todos estén sentados", "Board finished": "Mano terminada",
    "Tap a call to see what it means": "Toca una voz para ver qué significa", "Next deal": "Siguiente mano", "Tap for details": "Toca para ver detalles", "Tap here to see the last trick": "Toca aquí para ver la última baza",
    "Bridge Table": "Mesa de Bridge", "Your name": "Tu nombre", "Start": "Empezar", "Continue": "Continuar", "Seat me at a table": "Siéntame en una mesa", "Open tables": "Mesas abiertas", "Lobby chat": "Chat del salón", "Write a message…": "Escribe un mensaje…", "Send": "Enviar",
    "Our convention card (with partner)": "Nuestra tarjeta de convenciones (con el compañero)", "No messages yet — say hello!": "Aún no hay mensajes — ¡saluda!", "{0} in the lobby": "{0} en el salón", "Your last board is waiting.": "Tu última mano te espera.",
    "Play alone with robots, or join a table where a robot is playing.": "Juega solo con robots o únete a una mesa donde juega un robot.", "Language": "Idioma", "boards": "manos", "Open a waiting room": "Abrir una sala de espera",
    "{0}'s table": "Mesa de {0}", "playing with robots": "jugando con robots", "online": "en línea", "waiting to start": "esperando para empezar", "board {0}": "mano {0}", "Ask to join": "Pedir unirse", "Robot": "Robot", "away · robot plays": "ausente · juega un robot",
    "No other tables are open right now.": "Ahora no hay otras mesas abiertas.", "Looking for tables…": "Buscando mesas…", "Refresh the list": "Actualizar la lista", "Show open tables": "Mostrar mesas abiertas", "Online table": "Mesa en línea", "Sit here": "Sentarse aquí", "Remove": "Quitar", "(you)": "(tú)",
    "Waiting for the host to start.": "Esperando a que el anfitrión empiece.", "“Sit here” asks the host to move you.": "«Sentarse aquí» pide al anfitrión que te cambie de sitio.", "Asking to join": "Pide unirse", "Accept": "Aceptar", "Decline": "Rechazar", "(opponent)": "(rival)", "(partner)": "(compañero)",
    "Asking to change seats": "Pide cambiar de sitio", "asks for a new deal": "pide una nueva mano", "asks to reset the table score": "pide poner a cero el marcador", "Table score": "Marcador de la mesa", "Reset the score": "Poner a cero", "Ask to reset the score": "Pedir poner a cero", "Ask for a new deal": "Pedir una nueva mano",
    "Join {0}'s table": "Unirse a la mesa de {0}", "Sit as": "Sentarse como", "The host's partner": "Compañero del anfitrión", "An opponent": "Rival", "Any free seat": "Cualquier sitio libre", "Join": "Unirse", "Not now": "Ahora no", "Cancel": "Cancelar",
    "Waiting for the host to accept you…": "Esperando a que el anfitrión te acepte…", "{0} decides whether you can sit.": "{0} decide si puedes sentarte.", "No table has a free seat right now.": "Ahora ninguna mesa tiene sitio libre.", "Asked {0} for a seat…": "Has pedido sitio a {0}…",
    "Asked the host for a new deal": "Has pedido una nueva mano al anfitrión", "The host said no": "El anfitrión dijo que no", "You are offline": "Estás sin conexión", "Watch": "Mirar", "You are watching this table.": "Estás mirando esta mesa.",
    "Tournaments": "Torneos", "New tournament": "Nuevo torneo", "Play": "Jugar", "Standings": "Clasificación", "Close": "Cerrar", "Player": "Jugador", "{0} boards": "{0} manos", "{0} players": "{0} jugadores", "you: {0}/{1}": "tú: {0}/{1}", "Nobody has played yet.": "Nadie ha jugado todavía.",
    "{0} boards · started by {1} · results arrive as the others play": "{0} manos · iniciado por {1} · los resultados llegan cuando juegan los demás", "No tournaments yet. Start one — everyone in the lobby gets the same deals.": "Aún no hay torneos. Crea uno: todos en el salón reciben las mismas manos.",
    "Tournament board {0} of {1} — you sit South": "Mano de torneo {0} de {1} — te sientas en Sur", "Close the online table first": "Cierra primero la mesa en línea", "Finish this tournament board first": "Termina primero esta mano del torneo", "Going back to your table…": "Volviendo a tu mesa…",
    "Your system": "Tu sistema", "Play with robots, join a table or open your own.": "Juega con robots, únete a una mesa o abre la tuya.", "Convention card": "Convenciones", "Close the table?": "¿Cerrar la mesa?", "Yes": "Sí", "No": "No", "Play with robots": "Jugar con robots",
    "Against the tournament ({0} players): {1} IMP · {2}%": "Contra el torneo ({0} jugadores): {1} IMP · {2} %", "Leave the table you are at first": "Primero deja la mesa en la que estás", "No table to watch right now.": "Ahora no hay mesa para mirar.", "Play as partners": "Jugar como compañeros",
    "Practice these boards": "Practicar estas manos", "Practice: board {0} of {1}": "Práctica: mano {0} de {1}", "Watch a table": "Mirar una mesa", "wants to play with you as partners": "quiere jugar contigo como compañero", "Add as friend": "Añadir como amigo", "Alert": "Alerta",
    "Alert your next call and say what it means": "Alerta tu próxima voz y di qué significa", "Back to the list": "Volver a la lista", "Bd": "Mano", "Boards played today — tap one to see the hands, the auction and the play.": "Manos jugadas hoy — toca una para ver las manos, la subasta y el carteo.",
    "Friend": "Amigo", "History": "Historial", "No boards yet today.": "Hoy aún no hay manos.", "Nobody has played this board yet.": "Nadie ha jugado esta mano todavía.", "Other tables": "Otras mesas", "Previous deal": "Mano anterior", "Robot reading": "Lectura del robot", "Score": "Puntuación",
    "Tap your own row to replay the board.": "Toca tu fila para volver a ver la mano.", "Total": "Total", "What does your next call mean?": "¿Qué significa tu próxima voz?", "Your turn — the table is waiting ({0} s)": "Tu turno — la mesa espera ({0} s)",
    "{0} has not played for {1} s — tap the name to remove": "{0} no juega desde hace {1} s — toca el nombre para quitarlo", "{0} is in the lobby": "{0} está en el salón", "{0} is not in the lobby — the message is delivered when they come": "{0} no está en el salón — el mensaje se entregará cuando llegue",
    "Close table": "Cerrar mesa", "Sound when it is your turn": "Sonido cuando es tu turno", "Turn sound off": "Sonido de turno apagado", "Turn sound on": "Sonido de turno encendido", "Close the table for everyone?": "¿Cerrar la mesa para todos?",
    "Remove {0} from the table? A robot plays the seat.": "¿Quitar a {0} de la mesa? Un robot juega en su sitio.", "Tournament board {0} of {1} — you sit {2}": "Mano de torneo {0} de {1} — te sientas en {2}", "Where do you sit?": "¿Dónde te sientas?",
    "N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.": "Los jugadores N–S se clasifican con N–S y los E–O con E–O. Mantienes este sitio en todas las manos.", "Against 10 robot tables": "Contra 10 mesas de robots",
    "= your score against 10 robot tables that played the same boards; it ranks the players until others have played.": "= tu resultado contra 10 mesas de robots que jugaron las mismas manos; clasifica a los jugadores hasta que jueguen otros.",
    "Leave": "Salir", "Leave the table?": "¿Dejar la mesa?", "Leave the table": "Dejar la mesa", "Your rating": "Tu puntuación", "This week": "Esta semana", "This month": "Este mes", "This year": "Este año", "All time": "Todo", "System": "Sistema", "IMP / board": "IMP / mano",
    "No rating yet — it shows once this player has played (with the new version).": "Aún sin puntuación — aparece cuando este jugador haya jugado (con la nueva versión).", "Close — answer later": "Cerrar — responder más tarde", "Cancel the tournament?": "¿Cancelar el torneo?", "Remove from my list": "Quitar de mi lista",
    "Join the tournament": "Unirse al torneo", "Join and play": "Unirse y jugar", "{0} started a tournament — everyone can play it": "{0} ha empezado un torneo — todos pueden jugarlo", "This tournament has not reached you yet — try again in a moment": "Este torneo aún no te ha llegado — inténtalo de nuevo en un momento",
    "your robot partner bids it too": "tu compañero robot también lo juega", "Base system": "Sistema base", "Conventions": "Convenciones", "from the next deal": "desde la próxima mano", "In the lobby": "En el salón",
    "How many of the remaining {0} tricks do you take?": "¿Cuántas de las {0} bazas restantes haces?", "All {0}": "Todas ({0})", "Claim sent — waiting for the other side": "Reclamación enviada — esperando al otro bando", "You": "Tú",
    "Could not work it out yet — play a little longer": "Aún no se puede calcular — juega un poco más", "The robots do not accept: {0} tricks at most": "Los robots no aceptan: {0} bazas como máximo",
    "{0} claimed {1} of the last {2} tricks — accepted": "{0} reclamó {1} de las últimas {2} bazas — aceptado", "{0} claimed {1} of the last {2} tricks — not accepted": "{0} reclamó {1} de las últimas {2} bazas — no aceptado", "Robots": "Robots",
    "The robots claimed the last {0} tricks — accepted": "Los robots reclamaron las últimas {0} bazas — aceptado", "The robots claimed the last {0} tricks — play goes on": "Los robots reclamaron las últimas {0} bazas — el juego sigue",
    "{0} claims {1} of the last {2} tricks": "{0} reclama {1} de las últimas {2} bazas", "The robots claim all of the last {0} tricks": "Los robots reclaman todas las últimas {0} bazas", "{0} wants to take back their last {1}": "{0} quiere deshacer su última {1}",
    "move": "jugada", "call": "voz", "Do you agree?": "¿Estás de acuerdo?", "{0} wanted to take back their last {1} — not accepted": "{0} quería deshacer su última {1} — no aceptado", "Nothing to take back, or the other side said no": "No hay nada que deshacer, o el otro bando dijo que no",
    "Table": "Mesa", "Lobby": "Salón", "Alone with robots": "Solo con robots", "Shown in the lobby, nobody can join.": "Visible en el salón, nadie puede unirse.", "Open to others": "Abierta a otros", "Shown in the lobby: players can ask to join, you accept.": "Visible en el salón: los jugadores pueden pedir unirse y tú aceptas.",
    "Message": "Mensaje", "Write a private message to {0}.": "Escribe un mensaje privado a {0}.", "Waiting for {0} to open the table": "Esperando a que {0} abra la mesa", "Tournament board {0} of {1}": "Mano de torneo {0} de {1}", "Pair": "Pareja", "Points": "Puntos",
    "{0} tables": "{0} mesas", "individual": "individual", "at tables": "en mesas", "ranked by {0}": "clasificado por {0}", "started by {0}": "iniciado por {0}", "table {0}, you sit {1}": "mesa {0}, te sientas en {1}", "Open table {0}": "Abrir la mesa {0}", "Join table {0}": "Unirse a la mesa {0}", "Table {0}": "Mesa {0}",
    "Name": "Nombre", "Tournament name": "Nombre del torneo", "Boards": "Manos", "Format": "Formato", "Tables": "Mesas", "Ranking": "Clasificación", "Keep the tournament for": "Mantener el torneo durante", "{0} hours": "{0} horas", "1 day": "1 día", "3 days": "3 días",
    "Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.": "Los jugadores se sientan juntos en mesas; todas las mesas juegan las mismas manos; los robots ocupan los sitios vacíos. El primer jugador nombrado en una mesa la abre.",
    "Players in the lobby": "Jugadores en el salón", "Invite players": "Invitar jugadores", "wants to join your table": "quiere unirse a tu mesa", "wants to watch your table": "quiere mirar tu mesa", "more waiting": "más esperando", "Open an online table first": "Abre primero una mesa en línea",
    "Invitation sent to {0}": "Invitación enviada a {0}", "invites you to their table": "te invita a su mesa", "Nobody else is in the lobby right now.": "Ahora no hay nadie más en el salón.", "Invite to my table": "Invitar a mi mesa", "Open an online table to invite players to it.": "Abre una mesa en línea para invitar jugadores.",
    "Public table": "Mesa pública", "Private table": "Mesa privada", "Listed in the lobby: anyone can ask to join, you accept.": "Aparece en el salón: cualquiera puede pedir unirse y tú aceptas.", "Shown in the lobby with 🔒: invited players sit at once, others must ask you, no spectators.": "Visible en el salón con 🔒: los invitados se sientan enseguida, los demás deben pedírtelo, sin espectadores.",
    "Clear the chat": "Borrar el chat", "Open an online table": "Abrir una mesa en línea", "Open your own online table (players ask to join and you accept them), or ask to join one of the tables below.": "Abre tu propia mesa en línea (los jugadores piden unirse y tú los aceptas) o pide unirte a una de las mesas de abajo.",
    "setting up": "en preparación", "{0} accepted": "{0} aceptaron", "Players and start": "Jugadores e inicio", "Waiting for {0} to start": "Esperando a que {0} empiece", "{0} invites you": "{0} te invita", "{0} invites you to a tournament": "{0} te invita a un torneo",
    "No tournaments yet. Create one and invite the players you want.": "Aún no hay torneos. Crea uno e invita a quien quieras.", "accepted": "aceptado", "declined": "rechazado", "invited": "invitado", "organiser": "organizador",
    "Everyone plays the same deals at their own table, sitting South. The tournament opens when you press Start.": "Todos juegan las mismas manos en su propia mesa, sentados en Sur. El torneo se abre cuando pulsas Empezar.", "Players to invite": "Jugadores a invitar",
    "Nobody else is in the lobby right now — type a name below.": "Ahora no hay nadie más en el salón — escribe un nombre abajo.", "Add a player by name": "Añadir un jugador por nombre", "Add": "Añadir", "Answers": "Respuestas", "Send the invitations": "Enviar las invitaciones",
    "Start the tournament": "Empezar el torneo", "Cancel the tournament": "Cancelar el torneo", "Pick at least one player": "Elige al menos un jugador", "Invitations sent": "Invitaciones enviadas", "The tournament has started": "El torneo ha empezado", "This tournament has not started yet": "Este torneo aún no ha empezado",
  },
  fr: {
    "All": "Tous", "Registering": "Inscriptions", "Running": "En cours", "Mine": "Les miens", "Tournament": "Tournoi", "Players": "Joueurs", "Status": "État", "Ends in": "Fin dans", "{0} d {1} h": "{0} j {1} h", "{0} h {1} min": "{0} h {1} min", "Register": "S’inscrire", "No tournaments here.": "Aucun tournoi ici.", "Edit my card": "Modifier ma fiche",
    "Country/Region": "Pays/région", "Skill level": "Niveau", "Joined": "Inscrit le", "Logins": "Connexions", "Title": "Titre", "Newcomer": "Nouveau venu", "Strategist": "Stratège", "Master": "Maître", "Grandmaster": "Grand maître",
    "At {0}'s table": "À la table de {0}", "Country": "Pays", "Level": "Niveau", "Not set": "Non choisi", "About me": "À propos de moi", "A few words about you (system, what you like…)": "Quelques mots sur vous (système, ce que vous aimez…)", "Beginner": "Débutant", "Intermediate": "Intermédiaire", "Advanced": "Avancé", "Expert": "Expert", "World class": "Classe mondiale",
    "Contract": "Contrat", "Today": "Aujourd’hui", "last:": "dernière :", "New Deal": "Donner", "Sure?": "Sûr ?", "Undo": "Retour", "Chat": "Chat", "Hint": "Indice", "Claim": "Réclamer", "Online": "En ligne", "Help": "Aide", "Settings": "Réglages", "Results": "Résultats", "Home": "Accueil",
    "Us": "Nous", "Them": "Eux", "Pass": "Passe", "Double": "Contre", "Redouble": "Surcontre",
    "Your call": "À vous d’annoncer", "{0} is thinking…": "{0} réfléchit…", "Gathering the trick…": "On ramasse la levée…", "Your turn: play a card": "À vous : jouez une carte", "Play from {0}'s hand": "Jouez de la main de {0}", "{0} is playing…": "{0} joue…",
    "Press Start to deal": "Appuyez sur Commencer pour distribuer", "Waiting for the host to start": "En attente que l’hôte commence", "Waiting for players — press Start when everyone is seated": "En attente des joueurs — appuyez sur Commencer quand tout le monde est assis", "Board finished": "Donne terminée",
    "Tap a call to see what it means": "Touchez une enchère pour voir sa signification", "Next deal": "Donne suivante", "Tap for details": "Touchez pour les détails", "Tap here to see the last trick": "Touchez ici pour voir la dernière levée",
    "Bridge Table": "Table de Bridge", "Your name": "Votre nom", "Start": "Commencer", "Continue": "Continuer", "Seat me at a table": "Placez-moi à une table", "Open tables": "Tables ouvertes", "Lobby chat": "Chat du salon", "Write a message…": "Écrivez un message…", "Send": "Envoyer",
    "Our convention card (with partner)": "Notre feuille de conventions (avec le partenaire)", "No messages yet — say hello!": "Pas encore de messages — dites bonjour !", "{0} in the lobby": "{0} dans le salon", "Your last board is waiting.": "Votre dernière donne vous attend.",
    "Play alone with robots, or join a table where a robot is playing.": "Jouez seul avec des robots ou rejoignez une table où joue un robot.", "Language": "Langue", "boards": "donnes", "Open a waiting room": "Ouvrir une salle d’attente",
    "{0}'s table": "Table de {0}", "playing with robots": "joue avec des robots", "online": "en ligne", "waiting to start": "en attente de début", "board {0}": "donne {0}", "Ask to join": "Demander à rejoindre", "Robot": "Robot", "away · robot plays": "absent · un robot joue",
    "No other tables are open right now.": "Aucune autre table n’est ouverte pour l’instant.", "Looking for tables…": "Recherche de tables…", "Refresh the list": "Actualiser la liste", "Show open tables": "Afficher les tables ouvertes", "Online table": "Table en ligne", "Sit here": "S’asseoir ici", "Remove": "Retirer", "(you)": "(vous)",
    "Waiting for the host to start.": "En attente que l’hôte commence.", "“Sit here” asks the host to move you.": "« S’asseoir ici » demande à l’hôte de vous déplacer.", "Asking to join": "Demande à rejoindre", "Accept": "Accepter", "Decline": "Refuser", "(opponent)": "(adversaire)", "(partner)": "(partenaire)",
    "Asking to change seats": "Demande à changer de place", "asks for a new deal": "demande une nouvelle donne", "asks to reset the table score": "demande de remettre le score à zéro", "Table score": "Score de la table", "Reset the score": "Remettre à zéro", "Ask to reset the score": "Demander la remise à zéro", "Ask for a new deal": "Demander une nouvelle donne",
    "Join {0}'s table": "Rejoindre la table de {0}", "Sit as": "S’asseoir comme", "The host's partner": "Partenaire de l’hôte", "An opponent": "Adversaire", "Any free seat": "N’importe quelle place libre", "Join": "Rejoindre", "Not now": "Pas maintenant", "Cancel": "Annuler",
    "Waiting for the host to accept you…": "En attente que l’hôte vous accepte…", "{0} decides whether you can sit.": "{0} décide si vous pouvez vous asseoir.", "No table has a free seat right now.": "Aucune table n’a de place libre pour l’instant.", "Asked {0} for a seat…": "Place demandée à {0}…",
    "Asked the host for a new deal": "Nouvelle donne demandée à l’hôte", "The host said no": "L’hôte a refusé", "You are offline": "Vous êtes hors ligne", "Watch": "Regarder", "You are watching this table.": "Vous regardez cette table.",
    "Tournaments": "Tournois", "New tournament": "Nouveau tournoi", "Play": "Jouer", "Standings": "Classement", "Close": "Fermer", "Player": "Joueur", "{0} boards": "{0} donnes", "{0} players": "{0} joueurs", "you: {0}/{1}": "vous : {0}/{1}", "Nobody has played yet.": "Personne n’a encore joué.",
    "{0} boards · started by {1} · results arrive as the others play": "{0} donnes · lancé par {1} · les résultats arrivent au fur et à mesure", "No tournaments yet. Start one — everyone in the lobby gets the same deals.": "Pas encore de tournoi. Lancez-en un : tout le salon reçoit les mêmes donnes.",
    "Tournament board {0} of {1} — you sit South": "Donne de tournoi {0} sur {1} — vous êtes Sud", "Close the online table first": "Fermez d’abord la table en ligne", "Finish this tournament board first": "Terminez d’abord cette donne du tournoi", "Going back to your table…": "Retour à votre table…",
    "Your system": "Votre système", "Play with robots, join a table or open your own.": "Jouez avec des robots, rejoignez une table ou ouvrez la vôtre.", "Convention card": "Conventions", "Close the table?": "Fermer la table ?", "Yes": "Oui", "No": "Non", "Play with robots": "Jouer avec des robots",
    "Against the tournament ({0} players): {1} IMP · {2}%": "Contre le tournoi ({0} joueurs) : {1} IMP · {2} %", "Leave the table you are at first": "Quittez d’abord la table où vous êtes", "No table to watch right now.": "Aucune table à regarder pour l’instant.", "Play as partners": "Jouer en partenaires",
    "Practice these boards": "Rejouer ces donnes", "Practice: board {0} of {1}": "Entraînement : donne {0} sur {1}", "Watch a table": "Regarder une table", "wants to play with you as partners": "veut jouer avec vous en partenaire", "Add as friend": "Ajouter comme ami", "Alert": "Alerte",
    "Alert your next call and say what it means": "Alertez votre prochaine enchère et dites ce qu’elle signifie", "Back to the list": "Retour à la liste", "Bd": "Donne", "Boards played today — tap one to see the hands, the auction and the play.": "Donnes jouées aujourd’hui — touchez-en une pour voir les mains, les enchères et le jeu de la carte.",
    "Friend": "Ami", "History": "Historique", "No boards yet today.": "Pas encore de donne aujourd’hui.", "Nobody has played this board yet.": "Personne n’a encore joué cette donne.", "Other tables": "Autres tables", "Previous deal": "Donne précédente", "Robot reading": "Lecture du robot", "Score": "Score",
    "Tap your own row to replay the board.": "Touchez votre ligne pour revoir la donne.", "Total": "Total", "What does your next call mean?": "Que signifie votre prochaine enchère ?", "Your turn — the table is waiting ({0} s)": "À vous — la table attend ({0} s)",
    "{0} has not played for {1} s — tap the name to remove": "{0} n’a pas joué depuis {1} s — touchez le nom pour le retirer", "{0} is in the lobby": "{0} est dans le salon", "{0} is not in the lobby — the message is delivered when they come": "{0} n’est pas dans le salon — le message sera remis à son arrivée",
    "Close table": "Fermer la table", "Sound when it is your turn": "Son quand c’est votre tour", "Turn sound off": "Son de tour coupé", "Turn sound on": "Son de tour activé", "Close the table for everyone?": "Fermer la table pour tout le monde ?",
    "Remove {0} from the table? A robot plays the seat.": "Retirer {0} de la table ? Un robot prend sa place.", "Tournament board {0} of {1} — you sit {2}": "Donne de tournoi {0} sur {1} — vous êtes {2}", "Where do you sit?": "Où vous asseyez-vous ?",
    "N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.": "Les joueurs N–S sont classés avec les N–S, les E–O avec les E–O. Vous gardez cette place pour toutes les donnes.", "Against 10 robot tables": "Contre 10 tables de robots",
    "= your score against 10 robot tables that played the same boards; it ranks the players until others have played.": "= votre résultat contre 10 tables de robots qui ont joué les mêmes donnes ; il classe les joueurs tant que d’autres n’ont pas joué.",
    "Leave": "Quitter", "Leave the table?": "Quitter la table ?", "Leave the table": "Quitter la table", "Your rating": "Votre classement", "This week": "Cette semaine", "This month": "Ce mois-ci", "This year": "Cette année", "All time": "Depuis le début", "System": "Système", "IMP / board": "IMP / donne",
    "No rating yet — it shows once this player has played (with the new version).": "Pas encore de classement — il apparaît quand ce joueur a joué (avec la nouvelle version).", "Close — answer later": "Fermer — répondre plus tard", "Cancel the tournament?": "Annuler le tournoi ?", "Remove from my list": "Retirer de ma liste",
    "Join the tournament": "Rejoindre le tournoi", "Join and play": "Rejoindre et jouer", "{0} started a tournament — everyone can play it": "{0} a lancé un tournoi — tout le monde peut le jouer", "This tournament has not reached you yet — try again in a moment": "Ce tournoi ne vous est pas encore parvenu — réessayez dans un instant",
    "your robot partner bids it too": "votre partenaire robot l’annonce aussi", "Base system": "Système de base", "Conventions": "Conventions", "from the next deal": "à partir de la prochaine donne", "In the lobby": "Dans le salon",
    "How many of the remaining {0} tricks do you take?": "Combien des {0} levées restantes faites-vous ?", "All {0}": "Toutes ({0})", "Claim sent — waiting for the other side": "Réclamation envoyée — en attente de l’autre camp", "You": "Vous",
    "Could not work it out yet — play a little longer": "Impossible de calculer pour l’instant — jouez encore un peu", "The robots do not accept: {0} tricks at most": "Les robots refusent : {0} levées au plus",
    "{0} claimed {1} of the last {2} tricks — accepted": "{0} a réclamé {1} des {2} dernières levées — accepté", "{0} claimed {1} of the last {2} tricks — not accepted": "{0} a réclamé {1} des {2} dernières levées — refusé", "Robots": "Robots",
    "The robots claimed the last {0} tricks — accepted": "Les robots ont réclamé les {0} dernières levées — accepté", "The robots claimed the last {0} tricks — play goes on": "Les robots ont réclamé les {0} dernières levées — le jeu continue",
    "{0} claims {1} of the last {2} tricks": "{0} réclame {1} des {2} dernières levées", "The robots claim all of the last {0} tricks": "Les robots réclament les {0} dernières levées", "{0} wants to take back their last {1}": "{0} veut reprendre son dernier {1}",
    "move": "coup", "call": "enchère", "Do you agree?": "Êtes-vous d’accord ?", "{0} wanted to take back their last {1} — not accepted": "{0} voulait reprendre son dernier {1} — refusé", "Nothing to take back, or the other side said no": "Rien à reprendre, ou l’autre camp a refusé",
    "Table": "Table", "Lobby": "Salon", "Alone with robots": "Seul avec des robots", "Shown in the lobby, nobody can join.": "Visible dans le salon, personne ne peut rejoindre.", "Open to others": "Ouverte aux autres", "Shown in the lobby: players can ask to join, you accept.": "Visible dans le salon : les joueurs peuvent demander à rejoindre, vous acceptez.",
    "Message": "Message", "Write a private message to {0}.": "Écrivez un message privé à {0}.", "Waiting for {0} to open the table": "En attente que {0} ouvre la table", "Tournament board {0} of {1}": "Donne de tournoi {0} sur {1}", "Pair": "Paire", "Points": "Points",
    "{0} tables": "{0} tables", "individual": "individuel", "at tables": "aux tables", "ranked by {0}": "classé en {0}", "started by {0}": "lancé par {0}", "table {0}, you sit {1}": "table {0}, vous êtes {1}", "Open table {0}": "Ouvrir la table {0}", "Join table {0}": "Rejoindre la table {0}", "Table {0}": "Table {0}",
    "Name": "Nom", "Tournament name": "Nom du tournoi", "Boards": "Donnes", "Format": "Format", "Tables": "Tables", "Ranking": "Classement", "Keep the tournament for": "Garder le tournoi pendant", "{0} hours": "{0} heures", "1 day": "1 jour", "3 days": "3 jours",
    "Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.": "Les joueurs s’assoient ensemble aux tables ; toutes les tables jouent les mêmes donnes ; les robots occupent les places vides. Le premier joueur nommé à une table l’ouvre.",
    "Players in the lobby": "Joueurs dans le salon", "Invite players": "Inviter des joueurs", "wants to join your table": "veut rejoindre votre table", "wants to watch your table": "veut regarder votre table", "more waiting": "autres en attente", "Open an online table first": "Ouvrez d’abord une table en ligne",
    "Invitation sent to {0}": "Invitation envoyée à {0}", "invites you to their table": "vous invite à sa table", "Nobody else is in the lobby right now.": "Personne d’autre n’est dans le salon pour l’instant.", "Invite to my table": "Inviter à ma table", "Open an online table to invite players to it.": "Ouvrez une table en ligne pour y inviter des joueurs.",
    "Public table": "Table publique", "Private table": "Table privée", "Listed in the lobby: anyone can ask to join, you accept.": "Listée dans le salon : chacun peut demander à rejoindre, vous acceptez.", "Shown in the lobby with 🔒: invited players sit at once, others must ask you, no spectators.": "Visible dans le salon avec 🔒 : les invités s’assoient tout de suite, les autres doivent vous demander, pas de spectateurs.",
    "Clear the chat": "Effacer le chat", "Open an online table": "Ouvrir une table en ligne", "Open your own online table (players ask to join and you accept them), or ask to join one of the tables below.": "Ouvrez votre propre table en ligne (les joueurs demandent à rejoindre et vous les acceptez) ou demandez à rejoindre une des tables ci-dessous.",
    "setting up": "en préparation", "{0} accepted": "{0} ont accepté", "Players and start": "Joueurs et lancement", "Waiting for {0} to start": "En attente que {0} lance", "{0} invites you": "{0} vous invite", "{0} invites you to a tournament": "{0} vous invite à un tournoi",
    "No tournaments yet. Create one and invite the players you want.": "Pas encore de tournoi. Créez-en un et invitez qui vous voulez.", "accepted": "accepté", "declined": "refusé", "invited": "invité", "organiser": "organisateur",
    "Everyone plays the same deals at their own table, sitting South. The tournament opens when you press Start.": "Chacun joue les mêmes donnes à sa propre table, assis en Sud. Le tournoi s’ouvre quand vous appuyez sur Commencer.", "Players to invite": "Joueurs à inviter",
    "Nobody else is in the lobby right now — type a name below.": "Personne d’autre n’est dans le salon — tapez un nom ci-dessous.", "Add a player by name": "Ajouter un joueur par son nom", "Add": "Ajouter", "Answers": "Réponses", "Send the invitations": "Envoyer les invitations",
    "Start the tournament": "Lancer le tournoi", "Cancel the tournament": "Annuler le tournoi", "Pick at least one player": "Choisissez au moins un joueur", "Invitations sent": "Invitations envoyées", "The tournament has started": "Le tournoi a commencé", "This tournament has not started yet": "Ce tournoi n’a pas encore commencé",
  },
  it: {
    "All": "Tutti", "Registering": "Iscrizioni", "Running": "In corso", "Mine": "Miei", "Tournament": "Torneo", "Players": "Giocatori", "Status": "Stato", "Ends in": "Termina tra", "{0} d {1} h": "{0} g {1} h", "{0} h {1} min": "{0} h {1} min", "Register": "Iscriviti", "No tournaments here.": "Nessun torneo qui.", "Edit my card": "Modifica la mia scheda",
    "Country/Region": "Paese/regione", "Skill level": "Livello", "Joined": "Iscritto il", "Logins": "Accessi", "Title": "Titolo", "Newcomer": "Nuovo arrivato", "Strategist": "Stratega", "Master": "Maestro", "Grandmaster": "Gran maestro",
    "At {0}'s table": "Al tavolo di {0}", "Country": "Paese", "Level": "Livello", "Not set": "Non scelto", "About me": "Su di me", "A few words about you (system, what you like…)": "Qualche parola su di te (sistema, cosa ti piace…)", "Beginner": "Principiante", "Intermediate": "Intermedio", "Advanced": "Avanzato", "Expert": "Esperto", "World class": "Classe mondiale",
    "Contract": "Contratto", "Today": "Oggi", "last:": "ultima:", "New Deal": "Nuova", "Sure?": "Sicuro?", "Undo": "Indietro", "Chat": "Chat", "Hint": "Aiuto", "Claim": "Claim", "Online": "Online", "Help": "Guida", "Settings": "Impostazioni", "Results": "Risultati", "Home": "Home",
    "Us": "Noi", "Them": "Loro", "Pass": "Passo", "Double": "Contro", "Redouble": "Surcontro",
    "Your call": "Tocca a te dichiarare", "{0} is thinking…": "{0} sta pensando…", "Gathering the trick…": "Si raccoglie la presa…", "Your turn: play a card": "Tocca a te: gioca una carta", "Play from {0}'s hand": "Gioca dalla mano di {0}", "{0} is playing…": "{0} sta giocando…",
    "Press Start to deal": "Premi Inizia per distribuire", "Waiting for the host to start": "In attesa che l’host inizi", "Waiting for players — press Start when everyone is seated": "In attesa dei giocatori — premi Inizia quando tutti sono seduti", "Board finished": "Smazzata finita",
    "Tap a call to see what it means": "Tocca una dichiarazione per vederne il significato", "Next deal": "Prossima smazzata", "Tap for details": "Tocca per i dettagli", "Tap here to see the last trick": "Tocca qui per vedere l’ultima presa",
    "Bridge Table": "Tavolo di Bridge", "Your name": "Il tuo nome", "Start": "Inizia", "Continue": "Continua", "Seat me at a table": "Trovami un tavolo", "Open tables": "Tavoli aperti", "Lobby chat": "Chat della sala", "Write a message…": "Scrivi un messaggio…", "Send": "Invia",
    "Our convention card (with partner)": "La nostra carta delle convenzioni (con il compagno)", "No messages yet — say hello!": "Ancora nessun messaggio — saluta!", "{0} in the lobby": "{0} nella sala", "Your last board is waiting.": "La tua ultima smazzata ti aspetta.",
    "Play alone with robots, or join a table where a robot is playing.": "Gioca da solo con i robot o unisciti a un tavolo dove gioca un robot.", "Language": "Lingua", "boards": "smazzate", "Open a waiting room": "Apri una sala d’attesa",
    "{0}'s table": "Tavolo di {0}", "playing with robots": "gioca con i robot", "online": "online", "waiting to start": "in attesa di iniziare", "board {0}": "smazzata {0}", "Ask to join": "Chiedi di unirti", "Robot": "Robot", "away · robot plays": "assente · gioca un robot",
    "No other tables are open right now.": "Al momento non ci sono altri tavoli aperti.", "Looking for tables…": "Ricerca tavoli…", "Refresh the list": "Aggiorna l’elenco", "Show open tables": "Mostra i tavoli aperti", "Online table": "Tavolo online", "Sit here": "Siediti qui", "Remove": "Rimuovi", "(you)": "(tu)",
    "Waiting for the host to start.": "In attesa che l’host inizi.", "“Sit here” asks the host to move you.": "«Siediti qui» chiede all’host di spostarti.", "Asking to join": "Chiede di unirsi", "Accept": "Accetta", "Decline": "Rifiuta", "(opponent)": "(avversario)", "(partner)": "(compagno)",
    "Asking to change seats": "Chiede di cambiare posto", "asks for a new deal": "chiede una nuova smazzata", "asks to reset the table score": "chiede di azzerare il punteggio", "Table score": "Punteggio del tavolo", "Reset the score": "Azzera il punteggio", "Ask to reset the score": "Chiedi di azzerare", "Ask for a new deal": "Chiedi una nuova smazzata",
    "Join {0}'s table": "Unisciti al tavolo di {0}", "Sit as": "Siediti come", "The host's partner": "Compagno dell’host", "An opponent": "Avversario", "Any free seat": "Qualsiasi posto libero", "Join": "Unisciti", "Not now": "Non ora", "Cancel": "Annulla",
    "Waiting for the host to accept you…": "In attesa che l’host ti accetti…", "{0} decides whether you can sit.": "{0} decide se puoi sederti.", "No table has a free seat right now.": "Al momento nessun tavolo ha un posto libero.", "Asked {0} for a seat…": "Posto chiesto a {0}…",
    "Asked the host for a new deal": "Nuova smazzata chiesta all’host", "The host said no": "L’host ha detto di no", "You are offline": "Sei offline", "Watch": "Guarda", "You are watching this table.": "Stai guardando questo tavolo.",
    "Tournaments": "Tornei", "New tournament": "Nuovo torneo", "Play": "Gioca", "Standings": "Classifica", "Close": "Chiudi", "Player": "Giocatore", "{0} boards": "{0} smazzate", "{0} players": "{0} giocatori", "you: {0}/{1}": "tu: {0}/{1}", "Nobody has played yet.": "Nessuno ha ancora giocato.",
    "{0} boards · started by {1} · results arrive as the others play": "{0} smazzate · avviato da {1} · i risultati arrivano mentre gli altri giocano", "No tournaments yet. Start one — everyone in the lobby gets the same deals.": "Ancora nessun torneo. Avviane uno: tutti nella sala ricevono le stesse smazzate.",
    "Tournament board {0} of {1} — you sit South": "Smazzata di torneo {0} di {1} — sei Sud", "Close the online table first": "Chiudi prima il tavolo online", "Finish this tournament board first": "Finisci prima questa smazzata del torneo", "Going back to your table…": "Ritorno al tuo tavolo…",
    "Your system": "Il tuo sistema", "Play with robots, join a table or open your own.": "Gioca con i robot, unisciti a un tavolo o aprine uno tuo.", "Convention card": "Convenzioni", "Close the table?": "Chiudere il tavolo?", "Yes": "Sì", "No": "No", "Play with robots": "Gioca con i robot",
    "Against the tournament ({0} players): {1} IMP · {2}%": "Contro il torneo ({0} giocatori): {1} IMP · {2}%", "Leave the table you are at first": "Lascia prima il tavolo in cui sei", "No table to watch right now.": "Al momento nessun tavolo da guardare.", "Play as partners": "Gioca in coppia",
    "Practice these boards": "Rigioca queste smazzate", "Practice: board {0} of {1}": "Allenamento: smazzata {0} di {1}", "Watch a table": "Guarda un tavolo", "wants to play with you as partners": "vuole giocare in coppia con te", "Add as friend": "Aggiungi agli amici", "Alert": "Alert",
    "Alert your next call and say what it means": "Allerta la prossima dichiarazione e scrivi cosa significa", "Back to the list": "Torna all’elenco", "Bd": "Sm.", "Boards played today — tap one to see the hands, the auction and the play.": "Smazzate giocate oggi — toccane una per vedere le mani, la licita e il gioco.",
    "Friend": "Amico", "History": "Cronologia", "No boards yet today.": "Ancora nessuna smazzata oggi.", "Nobody has played this board yet.": "Nessuno ha ancora giocato questa smazzata.", "Other tables": "Altri tavoli", "Previous deal": "Smazzata precedente", "Robot reading": "Lettura del robot", "Score": "Punteggio",
    "Tap your own row to replay the board.": "Tocca la tua riga per rivedere la smazzata.", "Total": "Totale", "What does your next call mean?": "Cosa significa la tua prossima dichiarazione?", "Your turn — the table is waiting ({0} s)": "Tocca a te — il tavolo aspetta ({0} s)",
    "{0} has not played for {1} s — tap the name to remove": "{0} non gioca da {1} s — tocca il nome per rimuoverlo", "{0} is in the lobby": "{0} è nella sala", "{0} is not in the lobby — the message is delivered when they come": "{0} non è nella sala — il messaggio verrà consegnato al suo arrivo",
    "Close table": "Chiudi tavolo", "Sound when it is your turn": "Suono quando tocca a te", "Turn sound off": "Suono di turno spento", "Turn sound on": "Suono di turno acceso", "Close the table for everyone?": "Chiudere il tavolo per tutti?",
    "Remove {0} from the table? A robot plays the seat.": "Rimuovere {0} dal tavolo? Un robot prende il suo posto.", "Tournament board {0} of {1} — you sit {2}": "Smazzata di torneo {0} di {1} — sei {2}", "Where do you sit?": "Dove ti siedi?",
    "N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.": "I giocatori N–S sono classificati con i N–S, gli E–O con gli E–O. Mantieni questo posto per tutte le smazzate.", "Against 10 robot tables": "Contro 10 tavoli di robot",
    "= your score against 10 robot tables that played the same boards; it ranks the players until others have played.": "= il tuo risultato contro 10 tavoli di robot che hanno giocato le stesse smazzate; classifica i giocatori finché altri non hanno giocato.",
    "Leave": "Esci", "Leave the table?": "Lasciare il tavolo?", "Leave the table": "Lascia il tavolo", "Your rating": "Il tuo rendimento", "This week": "Questa settimana", "This month": "Questo mese", "This year": "Quest’anno", "All time": "Sempre", "System": "Sistema", "IMP / board": "IMP / smazzata",
    "No rating yet — it shows once this player has played (with the new version).": "Ancora nessun dato — appare quando questo giocatore avrà giocato (con la nuova versione).", "Close — answer later": "Chiudi — rispondi dopo", "Cancel the tournament?": "Annullare il torneo?", "Remove from my list": "Togli dal mio elenco",
    "Join the tournament": "Partecipa al torneo", "Join and play": "Partecipa e gioca", "{0} started a tournament — everyone can play it": "{0} ha avviato un torneo — tutti possono giocarlo", "This tournament has not reached you yet — try again in a moment": "Questo torneo non ti è ancora arrivato — riprova tra poco",
    "your robot partner bids it too": "anche il tuo compagno robot lo gioca", "Base system": "Sistema di base", "Conventions": "Convenzioni", "from the next deal": "dalla prossima smazzata", "In the lobby": "Nella sala",
    "How many of the remaining {0} tricks do you take?": "Quante delle {0} prese rimanenti fai?", "All {0}": "Tutte ({0})", "Claim sent — waiting for the other side": "Claim inviato — in attesa dell’altra linea", "You": "Tu",
    "Could not work it out yet — play a little longer": "Non si può ancora calcolare — gioca ancora un po’", "The robots do not accept: {0} tricks at most": "I robot non accettano: al massimo {0} prese",
    "{0} claimed {1} of the last {2} tricks — accepted": "{0} ha reclamato {1} delle ultime {2} prese — accettato", "{0} claimed {1} of the last {2} tricks — not accepted": "{0} ha reclamato {1} delle ultime {2} prese — non accettato", "Robots": "Robot",
    "The robots claimed the last {0} tricks — accepted": "I robot hanno reclamato le ultime {0} prese — accettato", "The robots claimed the last {0} tricks — play goes on": "I robot hanno reclamato le ultime {0} prese — il gioco continua",
    "{0} claims {1} of the last {2} tricks": "{0} reclama {1} delle ultime {2} prese", "The robots claim all of the last {0} tricks": "I robot reclamano tutte le ultime {0} prese", "{0} wants to take back their last {1}": "{0} vuole riprendere la sua ultima {1}",
    "move": "giocata", "call": "dichiarazione", "Do you agree?": "Sei d’accordo?", "{0} wanted to take back their last {1} — not accepted": "{0} voleva riprendere la sua ultima {1} — non accettato", "Nothing to take back, or the other side said no": "Niente da riprendere, oppure l’altra linea ha detto di no",
    "Table": "Tavolo", "Lobby": "Sala", "Alone with robots": "Da solo con i robot", "Shown in the lobby, nobody can join.": "Visibile nella sala, nessuno può unirsi.", "Open to others": "Aperto agli altri", "Shown in the lobby: players can ask to join, you accept.": "Visibile nella sala: i giocatori possono chiedere di unirsi, tu accetti.",
    "Message": "Messaggio", "Write a private message to {0}.": "Scrivi un messaggio privato a {0}.", "Waiting for {0} to open the table": "In attesa che {0} apra il tavolo", "Tournament board {0} of {1}": "Smazzata di torneo {0} di {1}", "Pair": "Coppia", "Points": "Punti",
    "{0} tables": "{0} tavoli", "individual": "individuale", "at tables": "a tavoli", "ranked by {0}": "classifica in {0}", "started by {0}": "avviato da {0}", "table {0}, you sit {1}": "tavolo {0}, sei {1}", "Open table {0}": "Apri il tavolo {0}", "Join table {0}": "Unisciti al tavolo {0}", "Table {0}": "Tavolo {0}",
    "Name": "Nome", "Tournament name": "Nome del torneo", "Boards": "Smazzate", "Format": "Formula", "Tables": "Tavoli", "Ranking": "Classifica", "Keep the tournament for": "Mantieni il torneo per", "{0} hours": "{0} ore", "1 day": "1 giorno", "3 days": "3 giorni",
    "Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.": "I giocatori siedono insieme ai tavoli; ogni tavolo gioca le stesse smazzate; i robot occupano i posti vuoti. Il primo giocatore indicato per un tavolo lo apre.",
    "Players in the lobby": "Giocatori nella sala", "Invite players": "Invita giocatori", "wants to join your table": "vuole unirsi al tuo tavolo", "wants to watch your table": "vuole guardare il tuo tavolo", "more waiting": "altri in attesa", "Open an online table first": "Apri prima un tavolo online",
    "Invitation sent to {0}": "Invito inviato a {0}", "invites you to their table": "ti invita al suo tavolo", "Nobody else is in the lobby right now.": "Al momento non c’è nessun altro nella sala.", "Invite to my table": "Invita al mio tavolo", "Open an online table to invite players to it.": "Apri un tavolo online per invitarci dei giocatori.",
    "Public table": "Tavolo pubblico", "Private table": "Tavolo privato", "Listed in the lobby: anyone can ask to join, you accept.": "Elencato nella sala: chiunque può chiedere di unirsi, tu accetti.", "Shown in the lobby with 🔒: invited players sit at once, others must ask you, no spectators.": "Visibile nella sala con 🔒: gli invitati si siedono subito, gli altri devono chiedertelo, niente spettatori.",
    "Clear the chat": "Cancella la chat", "Open an online table": "Apri un tavolo online", "Open your own online table (players ask to join and you accept them), or ask to join one of the tables below.": "Apri il tuo tavolo online (i giocatori chiedono di unirsi e tu li accetti) o chiedi di unirti a uno dei tavoli qui sotto.",
    "setting up": "in preparazione", "{0} accepted": "{0} hanno accettato", "Players and start": "Giocatori e avvio", "Waiting for {0} to start": "In attesa che {0} avvii", "{0} invites you": "{0} ti invita", "{0} invites you to a tournament": "{0} ti invita a un torneo",
    "No tournaments yet. Create one and invite the players you want.": "Ancora nessun torneo. Creane uno e invita chi vuoi.", "accepted": "accettato", "declined": "rifiutato", "invited": "invitato", "organiser": "organizzatore",
    "Everyone plays the same deals at their own table, sitting South. The tournament opens when you press Start.": "Ognuno gioca le stesse smazzate al proprio tavolo, seduto a Sud. Il torneo si apre quando premi Inizia.", "Players to invite": "Giocatori da invitare",
    "Nobody else is in the lobby right now — type a name below.": "Non c’è nessun altro nella sala — scrivi un nome qui sotto.", "Add a player by name": "Aggiungi un giocatore per nome", "Add": "Aggiungi", "Answers": "Risposte", "Send the invitations": "Invia gli inviti",
    "Start the tournament": "Avvia il torneo", "Cancel the tournament": "Annulla il torneo", "Pick at least one player": "Scegli almeno un giocatore", "Invitations sent": "Inviti inviati", "The tournament has started": "Il torneo è iniziato", "This tournament has not started yet": "Questo torneo non è ancora iniziato",
  },
  de: {
    "All": "Alle", "Registering": "Anmeldung", "Running": "Läuft", "Mine": "Meine", "Tournament": "Turnier", "Players": "Spieler", "Status": "Status", "Ends in": "Endet in", "{0} d {1} h": "{0} T {1} Std", "{0} h {1} min": "{0} Std {1} Min", "Register": "Anmelden", "No tournaments here.": "Keine Turniere hier.", "Edit my card": "Meine Karte bearbeiten",
    "Country/Region": "Land/Region", "Skill level": "Spielstärke", "Joined": "Dabei seit", "Logins": "Anmeldungen", "Title": "Titel", "Newcomer": "Neuling", "Strategist": "Stratege", "Master": "Meister", "Grandmaster": "Großmeister",
    "At {0}'s table": "Am Tisch von {0}", "Country": "Land", "Level": "Niveau", "Not set": "Nicht gewählt", "About me": "Über mich", "A few words about you (system, what you like…)": "Ein paar Worte über dich (System, was du magst …)", "Beginner": "Anfänger", "Intermediate": "Mittel", "Advanced": "Fortgeschritten", "Expert": "Experte", "World class": "Weltklasse",
    "Contract": "Kontrakt", "Today": "Heute", "last:": "letztes:", "New Deal": "Neu", "Sure?": "Sicher?", "Undo": "Zurück", "Chat": "Chat", "Hint": "Tipp", "Claim": "Claim", "Online": "Online", "Help": "Hilfe", "Settings": "Einstellungen", "Results": "Ergebnisse", "Home": "Start",
    "Us": "Wir", "Them": "Sie", "Pass": "Passe", "Double": "Kontra", "Redouble": "Rekontra",
    "Your call": "Du bist mit Reizen dran", "{0} is thinking…": "{0} überlegt…", "Gathering the trick…": "Stich wird eingesammelt…", "Your turn: play a card": "Du bist dran: spiele eine Karte", "Play from {0}'s hand": "Spiele aus der Hand von {0}", "{0} is playing…": "{0} spielt…",
    "Press Start to deal": "Drücke Start zum Geben", "Waiting for the host to start": "Warten, bis der Gastgeber startet", "Waiting for players — press Start when everyone is seated": "Warten auf Spieler — drücke Start, wenn alle sitzen", "Board finished": "Board beendet",
    "Tap a call to see what it means": "Tippe auf ein Gebot, um seine Bedeutung zu sehen", "Next deal": "Nächstes Board", "Tap for details": "Tippen für Details", "Tap here to see the last trick": "Hier tippen für den letzten Stich",
    "Bridge Table": "Bridgetisch", "Your name": "Dein Name", "Start": "Start", "Continue": "Weiter", "Seat me at a table": "Such mir einen Tisch", "Open tables": "Offene Tische", "Lobby chat": "Lobby-Chat", "Write a message…": "Nachricht schreiben…", "Send": "Senden",
    "Our convention card (with partner)": "Unsere Konventionskarte (mit Partner)", "No messages yet — say hello!": "Noch keine Nachrichten — sag Hallo!", "{0} in the lobby": "{0} in der Lobby", "Your last board is waiting.": "Dein letztes Board wartet.",
    "Play alone with robots, or join a table where a robot is playing.": "Spiele allein mit Robotern oder setz dich an einen Tisch, an dem ein Roboter spielt.", "Language": "Sprache", "boards": "Boards", "Open a waiting room": "Warteraum öffnen",
    "{0}'s table": "Tisch von {0}", "playing with robots": "spielt mit Robotern", "online": "online", "waiting to start": "wartet auf den Start", "board {0}": "Board {0}", "Ask to join": "Platz anfragen", "Robot": "Roboter", "away · robot plays": "weg · Roboter spielt",
    "No other tables are open right now.": "Gerade sind keine anderen Tische offen.", "Looking for tables…": "Suche Tische…", "Refresh the list": "Liste aktualisieren", "Show open tables": "Offene Tische zeigen", "Online table": "Online-Tisch", "Sit here": "Hier sitzen", "Remove": "Entfernen", "(you)": "(du)",
    "Waiting for the host to start.": "Warten, bis der Gastgeber startet.", "“Sit here” asks the host to move you.": "„Hier sitzen“ bittet den Gastgeber, dich umzusetzen.", "Asking to join": "Möchte mitspielen", "Accept": "Annehmen", "Decline": "Ablehnen", "(opponent)": "(Gegner)", "(partner)": "(Partner)",
    "Asking to change seats": "Möchte den Platz wechseln", "asks for a new deal": "bittet um ein neues Board", "asks to reset the table score": "bittet, den Spielstand zurückzusetzen", "Table score": "Spielstand am Tisch", "Reset the score": "Spielstand zurücksetzen", "Ask to reset the score": "Zurücksetzen anfragen", "Ask for a new deal": "Neues Board anfragen",
    "Join {0}'s table": "An den Tisch von {0}", "Sit as": "Sitzen als", "The host's partner": "Partner des Gastgebers", "An opponent": "Gegner", "Any free seat": "Beliebiger freier Platz", "Join": "Mitspielen", "Not now": "Nicht jetzt", "Cancel": "Abbrechen",
    "Waiting for the host to accept you…": "Warten, bis der Gastgeber dich annimmt…", "{0} decides whether you can sit.": "{0} entscheidet, ob du dich setzen darfst.", "No table has a free seat right now.": "Gerade hat kein Tisch einen freien Platz.", "Asked {0} for a seat…": "Platz bei {0} angefragt…",
    "Asked the host for a new deal": "Neues Board beim Gastgeber angefragt", "The host said no": "Der Gastgeber hat abgelehnt", "You are offline": "Du bist offline", "Watch": "Zuschauen", "You are watching this table.": "Du schaust an diesem Tisch zu.",
    "Tournaments": "Turniere", "New tournament": "Neues Turnier", "Play": "Spielen", "Standings": "Rangliste", "Close": "Schließen", "Player": "Spieler", "{0} boards": "{0} Boards", "{0} players": "{0} Spieler", "you: {0}/{1}": "du: {0}/{1}", "Nobody has played yet.": "Noch hat niemand gespielt.",
    "{0} boards · started by {1} · results arrive as the others play": "{0} Boards · gestartet von {1} · Ergebnisse kommen, während die anderen spielen", "No tournaments yet. Start one — everyone in the lobby gets the same deals.": "Noch keine Turniere. Starte eins — alle in der Lobby bekommen dieselben Boards.",
    "Tournament board {0} of {1} — you sit South": "Turnierboard {0} von {1} — du sitzt Süd", "Close the online table first": "Schließe zuerst den Online-Tisch", "Finish this tournament board first": "Beende zuerst dieses Turnierboard", "Going back to your table…": "Zurück zu deinem Tisch…",
    "Your system": "Dein System", "Play with robots, join a table or open your own.": "Spiele mit Robotern, setz dich an einen Tisch oder eröffne deinen eigenen.", "Convention card": "Konventionen", "Close the table?": "Tisch schließen?", "Yes": "Ja", "No": "Nein", "Play with robots": "Mit Robotern spielen",
    "Against the tournament ({0} players): {1} IMP · {2}%": "Gegen das Turnier ({0} Spieler): {1} IMP · {2} %", "Leave the table you are at first": "Verlasse zuerst deinen Tisch", "No table to watch right now.": "Gerade kein Tisch zum Zuschauen.", "Play as partners": "Als Partner spielen",
    "Practice these boards": "Diese Boards üben", "Practice: board {0} of {1}": "Übung: Board {0} von {1}", "Watch a table": "Tisch zuschauen", "wants to play with you as partners": "möchte mit dir als Partner spielen", "Add as friend": "Als Freund hinzufügen", "Alert": "Alert",
    "Alert your next call and say what it means": "Alertiere dein nächstes Gebot und schreibe, was es bedeutet", "Back to the list": "Zurück zur Liste", "Bd": "Bd", "Boards played today — tap one to see the hands, the auction and the play.": "Heute gespielte Boards — tippe auf eins, um Hände, Reizung und Spiel zu sehen.",
    "Friend": "Freund", "History": "Verlauf", "No boards yet today.": "Heute noch keine Boards.", "Nobody has played this board yet.": "Dieses Board hat noch niemand gespielt.", "Other tables": "Andere Tische", "Previous deal": "Vorheriges Board", "Robot reading": "Deutung des Roboters", "Score": "Score",
    "Tap your own row to replay the board.": "Tippe auf deine Zeile, um das Board nachzuspielen.", "Total": "Gesamt", "What does your next call mean?": "Was bedeutet dein nächstes Gebot?", "Your turn — the table is waiting ({0} s)": "Du bist dran — der Tisch wartet ({0} s)",
    "{0} has not played for {1} s — tap the name to remove": "{0} spielt seit {1} s nicht — tippe auf den Namen, um ihn zu entfernen", "{0} is in the lobby": "{0} ist in der Lobby", "{0} is not in the lobby — the message is delivered when they come": "{0} ist nicht in der Lobby — die Nachricht wird zugestellt, sobald er kommt",
    "Close table": "Tisch schließen", "Sound when it is your turn": "Ton, wenn du dran bist", "Turn sound off": "Ton aus", "Turn sound on": "Ton an", "Close the table for everyone?": "Tisch für alle schließen?",
    "Remove {0} from the table? A robot plays the seat.": "{0} vom Tisch entfernen? Ein Roboter übernimmt den Platz.", "Tournament board {0} of {1} — you sit {2}": "Turnierboard {0} von {1} — du sitzt {2}", "Where do you sit?": "Wo sitzt du?",
    "N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.": "N–S-Spieler werden mit N–S gewertet, O–W mit O–W. Du behältst diesen Platz für alle Boards.", "Against 10 robot tables": "Gegen 10 Robotertische",
    "= your score against 10 robot tables that played the same boards; it ranks the players until others have played.": "= dein Ergebnis gegen 10 Robotertische mit denselben Boards; es bestimmt die Rangliste, bis andere gespielt haben.",
    "Leave": "Gehen", "Leave the table?": "Tisch verlassen?", "Leave the table": "Tisch verlassen", "Your rating": "Deine Bilanz", "This week": "Diese Woche", "This month": "Diesen Monat", "This year": "Dieses Jahr", "All time": "Gesamt", "System": "System", "IMP / board": "IMP / Board",
    "No rating yet — it shows once this player has played (with the new version).": "Noch keine Bilanz — sie erscheint, sobald dieser Spieler gespielt hat (mit der neuen Version).", "Close — answer later": "Schließen — später antworten", "Cancel the tournament?": "Turnier absagen?", "Remove from my list": "Aus meiner Liste entfernen",
    "Join the tournament": "Am Turnier teilnehmen", "Join and play": "Teilnehmen und spielen", "{0} started a tournament — everyone can play it": "{0} hat ein Turnier gestartet — alle können mitspielen", "This tournament has not reached you yet — try again in a moment": "Dieses Turnier ist noch nicht bei dir angekommen — versuche es gleich noch einmal",
    "your robot partner bids it too": "dein Roboterpartner reizt es auch", "Base system": "Grundsystem", "Conventions": "Konventionen", "from the next deal": "ab dem nächsten Board", "In the lobby": "In der Lobby",
    "How many of the remaining {0} tricks do you take?": "Wie viele der restlichen {0} Stiche machst du?", "All {0}": "Alle ({0})", "Claim sent — waiting for the other side": "Claim gesendet — warten auf die Gegenseite", "You": "Du",
    "Could not work it out yet — play a little longer": "Noch nicht berechenbar — spiele noch etwas weiter", "The robots do not accept: {0} tricks at most": "Die Roboter lehnen ab: höchstens {0} Stiche",
    "{0} claimed {1} of the last {2} tricks — accepted": "{0} hat {1} der letzten {2} Stiche beansprucht — angenommen", "{0} claimed {1} of the last {2} tricks — not accepted": "{0} hat {1} der letzten {2} Stiche beansprucht — abgelehnt", "Robots": "Roboter",
    "The robots claimed the last {0} tricks — accepted": "Die Roboter beanspruchen die letzten {0} Stiche — angenommen", "The robots claimed the last {0} tricks — play goes on": "Die Roboter beanspruchen die letzten {0} Stiche — es wird weitergespielt",
    "{0} claims {1} of the last {2} tricks": "{0} beansprucht {1} der letzten {2} Stiche", "The robots claim all of the last {0} tricks": "Die Roboter beanspruchen alle letzten {0} Stiche", "{0} wants to take back their last {1}": "{0} möchte sein letztes {1} zurücknehmen",
    "move": "Spielzug", "call": "Gebot", "Do you agree?": "Bist du einverstanden?", "{0} wanted to take back their last {1} — not accepted": "{0} wollte sein letztes {1} zurücknehmen — abgelehnt", "Nothing to take back, or the other side said no": "Nichts zurückzunehmen, oder die Gegenseite hat abgelehnt",
    "Table": "Tisch", "Lobby": "Lobby", "Alone with robots": "Allein mit Robotern", "Shown in the lobby, nobody can join.": "In der Lobby sichtbar, niemand kann sich dazusetzen.", "Open to others": "Offen für andere", "Shown in the lobby: players can ask to join, you accept.": "In der Lobby sichtbar: Spieler können anfragen, du nimmst an.",
    "Message": "Nachricht", "Write a private message to {0}.": "Schreibe {0} eine private Nachricht.", "Waiting for {0} to open the table": "Warten, bis {0} den Tisch öffnet", "Tournament board {0} of {1}": "Turnierboard {0} von {1}", "Pair": "Paar", "Points": "Punkte",
    "{0} tables": "{0} Tische", "individual": "Einzel", "at tables": "an Tischen", "ranked by {0}": "Wertung nach {0}", "started by {0}": "gestartet von {0}", "table {0}, you sit {1}": "Tisch {0}, du sitzt {1}", "Open table {0}": "Tisch {0} öffnen", "Join table {0}": "An Tisch {0}", "Table {0}": "Tisch {0}",
    "Name": "Name", "Tournament name": "Turniername", "Boards": "Boards", "Format": "Form", "Tables": "Tische", "Ranking": "Wertung", "Keep the tournament for": "Turnier behalten für", "{0} hours": "{0} Stunden", "1 day": "1 Tag", "3 days": "3 Tage",
    "Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.": "Die Spieler sitzen gemeinsam an Tischen; alle Tische spielen dieselben Boards; Roboter besetzen leere Plätze. Der erste genannte Spieler eines Tisches eröffnet ihn.",
    "Players in the lobby": "Spieler in der Lobby", "Invite players": "Spieler einladen", "wants to join your table": "möchte an deinen Tisch", "wants to watch your table": "möchte an deinem Tisch zuschauen", "more waiting": "weitere warten", "Open an online table first": "Öffne zuerst einen Online-Tisch",
    "Invitation sent to {0}": "Einladung an {0} gesendet", "invites you to their table": "lädt dich an seinen Tisch ein", "Nobody else is in the lobby right now.": "Gerade ist sonst niemand in der Lobby.", "Invite to my table": "An meinen Tisch einladen", "Open an online table to invite players to it.": "Öffne einen Online-Tisch, um Spieler einzuladen.",
    "Public table": "Öffentlicher Tisch", "Private table": "Privater Tisch", "Listed in the lobby: anyone can ask to join, you accept.": "In der Lobby gelistet: jeder kann anfragen, du nimmst an.", "Shown in the lobby with 🔒: invited players sit at once, others must ask you, no spectators.": "In der Lobby mit 🔒 sichtbar: Eingeladene setzen sich sofort, andere müssen fragen, keine Zuschauer.",
    "Clear the chat": "Chat leeren", "Open an online table": "Online-Tisch eröffnen", "Open your own online table (players ask to join and you accept them), or ask to join one of the tables below.": "Eröffne deinen eigenen Online-Tisch (Spieler fragen an, du nimmst sie an) oder frage bei einem der Tische unten an.",
    "setting up": "in Vorbereitung", "{0} accepted": "{0} zugesagt", "Players and start": "Spieler und Start", "Waiting for {0} to start": "Warten, bis {0} startet", "{0} invites you": "{0} lädt dich ein", "{0} invites you to a tournament": "{0} lädt dich zu einem Turnier ein",
    "No tournaments yet. Create one and invite the players you want.": "Noch keine Turniere. Erstelle eins und lade ein, wen du möchtest.", "accepted": "zugesagt", "declined": "abgesagt", "invited": "eingeladen", "organiser": "Veranstalter",
    "Everyone plays the same deals at their own table, sitting South. The tournament opens when you press Start.": "Jeder spielt dieselben Boards an seinem eigenen Tisch, als Süd. Das Turnier öffnet, wenn du Start drückst.", "Players to invite": "Einzuladende Spieler",
    "Nobody else is in the lobby right now — type a name below.": "Gerade ist sonst niemand in der Lobby — gib unten einen Namen ein.", "Add a player by name": "Spieler mit Namen hinzufügen", "Add": "Hinzufügen", "Answers": "Antworten", "Send the invitations": "Einladungen senden",
    "Start the tournament": "Turnier starten", "Cancel the tournament": "Turnier absagen", "Pick at least one player": "Wähle mindestens einen Spieler", "Invitations sent": "Einladungen gesendet", "The tournament has started": "Das Turnier hat begonnen", "This tournament has not started yet": "Dieses Turnier hat noch nicht begonnen",
  },
  ru: {
    "All": "Все", "Registering": "Регистрация", "Running": "Идут", "Mine": "Мои", "Tournament": "Турнир", "Players": "Игроки", "Status": "Статус", "Ends in": "Окончание через", "{0} d {1} h": "{0} д {1} ч", "{0} h {1} min": "{0} ч {1} мин", "Register": "Записаться", "No tournaments here.": "Здесь турниров нет.", "Edit my card": "Изменить мою карточку",
    "Country/Region": "Страна/регион", "Skill level": "Уровень игры", "Joined": "Дата регистрации", "Logins": "Входы", "Title": "Звание", "Newcomer": "Новичок", "Strategist": "Стратег", "Master": "Мастер", "Grandmaster": "Гроссмейстер",
    "At {0}'s table": "За столом {0}", "Country": "Страна", "Level": "Уровень", "Not set": "Не выбрано", "About me": "Обо мне", "A few words about you (system, what you like…)": "Пара слов о себе (система, что вам нравится…)", "Beginner": "Новичок", "Intermediate": "Средний", "Advanced": "Продвинутый", "Expert": "Эксперт", "World class": "Мировой класс",
    "Contract": "Контракт", "Today": "Сегодня", "last:": "последняя:", "New Deal": "Сдать", "Sure?": "Точно?", "Undo": "Отмена", "Chat": "Чат", "Hint": "Подсказка", "Claim": "Клейм", "Online": "Онлайн", "Help": "Справка", "Settings": "Настройки", "Results": "Результаты", "Home": "Главная",
    "Us": "Мы", "Them": "Они", "Pass": "Пас", "Double": "Контра", "Redouble": "Реконтра",
    "Your call": "Ваша заявка", "{0} is thinking…": "{0} думает…", "Gathering the trick…": "Взятка собирается…", "Your turn: play a card": "Ваш ход: сыграйте карту", "Play from {0}'s hand": "Играйте из руки {0}", "{0} is playing…": "{0} играет…",
    "Press Start to deal": "Нажмите «Начать», чтобы сдать", "Waiting for the host to start": "Ждём, пока хозяин начнёт", "Waiting for players — press Start when everyone is seated": "Ждём игроков — нажмите «Начать», когда все сядут", "Board finished": "Сдача сыграна",
    "Tap a call to see what it means": "Нажмите на заявку, чтобы увидеть её значение", "Next deal": "Следующая сдача", "Tap for details": "Нажмите для подробностей", "Tap here to see the last trick": "Нажмите здесь, чтобы увидеть последнюю взятку",
    "Bridge Table": "Бриджевый стол", "Your name": "Ваше имя", "Start": "Начать", "Continue": "Продолжить", "Seat me at a table": "Найти мне стол", "Open tables": "Открытые столы", "Lobby chat": "Чат зала", "Write a message…": "Напишите сообщение…", "Send": "Отправить",
    "Our convention card (with partner)": "Наша конвенционная карта (с партнёром)", "No messages yet — say hello!": "Сообщений пока нет — поздоровайтесь!", "{0} in the lobby": "{0} в зале", "Your last board is waiting.": "Ваша последняя сдача ждёт.",
    "Play alone with robots, or join a table where a robot is playing.": "Играйте с роботами или садитесь за стол, где играет робот.", "Language": "Язык", "boards": "сдач", "Open a waiting room": "Открыть зал ожидания",
    "{0}'s table": "Стол {0}", "playing with robots": "играет с роботами", "online": "онлайн", "waiting to start": "ждёт начала", "board {0}": "сдача {0}", "Ask to join": "Попроситься", "Robot": "Робот", "away · robot plays": "нет на месте · играет робот",
    "No other tables are open right now.": "Других открытых столов сейчас нет.", "Looking for tables…": "Ищем столы…", "Refresh the list": "Обновить список", "Show open tables": "Показать открытые столы", "Online table": "Онлайн-стол", "Sit here": "Сесть сюда", "Remove": "Убрать", "(you)": "(вы)",
    "Waiting for the host to start.": "Ждём, пока хозяин начнёт.", "“Sit here” asks the host to move you.": "«Сесть сюда» просит хозяина пересадить вас.", "Asking to join": "Просится за стол", "Accept": "Принять", "Decline": "Отклонить", "(opponent)": "(соперник)", "(partner)": "(партнёр)",
    "Asking to change seats": "Просит пересесть", "asks for a new deal": "просит новую сдачу", "asks to reset the table score": "просит обнулить счёт", "Table score": "Счёт стола", "Reset the score": "Обнулить счёт", "Ask to reset the score": "Попросить обнулить", "Ask for a new deal": "Попросить новую сдачу",
    "Join {0}'s table": "За стол {0}", "Sit as": "Сесть как", "The host's partner": "Партнёр хозяина", "An opponent": "Соперник", "Any free seat": "Любое свободное место", "Join": "Сесть", "Not now": "Не сейчас", "Cancel": "Отмена",
    "Waiting for the host to accept you…": "Ждём, пока хозяин вас примет…", "{0} decides whether you can sit.": "{0} решает, можно ли вам сесть.", "No table has a free seat right now.": "Сейчас ни за одним столом нет свободного места.", "Asked {0} for a seat…": "Попросились за стол {0}…",
    "Asked the host for a new deal": "Попросили у хозяина новую сдачу", "The host said no": "Хозяин отказал", "You are offline": "Нет подключения", "Watch": "Смотреть", "You are watching this table.": "Вы смотрите за этим столом.",
    "Tournaments": "Турниры", "New tournament": "Новый турнир", "Play": "Играть", "Standings": "Таблица", "Close": "Закрыть", "Player": "Игрок", "{0} boards": "{0} сдач", "{0} players": "{0} игроков", "you: {0}/{1}": "вы: {0}/{1}", "Nobody has played yet.": "Пока никто не играл.",
    "{0} boards · started by {1} · results arrive as the others play": "{0} сдач · начал {1} · результаты приходят по мере игры", "No tournaments yet. Start one — everyone in the lobby gets the same deals.": "Турниров пока нет. Начните — все в зале получат одинаковые сдачи.",
    "Tournament board {0} of {1} — you sit South": "Турнирная сдача {0} из {1} — вы Юг", "Close the online table first": "Сначала закройте онлайн-стол", "Finish this tournament board first": "Сначала доиграйте эту турнирную сдачу", "Going back to your table…": "Возвращаемся за ваш стол…",
    "Your system": "Ваша система", "Play with robots, join a table or open your own.": "Играйте с роботами, садитесь за стол или откройте свой.", "Convention card": "Конвенции", "Close the table?": "Закрыть стол?", "Yes": "Да", "No": "Нет", "Play with robots": "Играть с роботами",
    "Against the tournament ({0} players): {1} IMP · {2}%": "Против турнира ({0} игроков): {1} IMP · {2}%", "Leave the table you are at first": "Сначала выйдите из-за своего стола", "No table to watch right now.": "Сейчас нет стола для просмотра.", "Play as partners": "Играть в паре",
    "Practice these boards": "Переиграть эти сдачи", "Practice: board {0} of {1}": "Тренировка: сдача {0} из {1}", "Watch a table": "Смотреть стол", "wants to play with you as partners": "хочет играть с вами в паре", "Add as friend": "Добавить в друзья", "Alert": "Алерт",
    "Alert your next call and say what it means": "Алертуйте следующую заявку и напишите её значение", "Back to the list": "Назад к списку", "Bd": "Сд.", "Boards played today — tap one to see the hands, the auction and the play.": "Сдачи, сыгранные сегодня, — нажмите, чтобы увидеть руки, торговлю и розыгрыш.",
    "Friend": "Друг", "History": "История", "No boards yet today.": "Сегодня сдач ещё не было.", "Nobody has played this board yet.": "Эту сдачу ещё никто не играл.", "Other tables": "Другие столы", "Previous deal": "Предыдущая сдача", "Robot reading": "Толкование робота", "Score": "Счёт",
    "Tap your own row to replay the board.": "Нажмите на свою строку, чтобы пересмотреть сдачу.", "Total": "Итого", "What does your next call mean?": "Что значит ваша следующая заявка?", "Your turn — the table is waiting ({0} s)": "Ваш ход — стол ждёт ({0} с)",
    "{0} has not played for {1} s — tap the name to remove": "{0} не играет уже {1} с — нажмите на имя, чтобы убрать", "{0} is in the lobby": "{0} в зале", "{0} is not in the lobby — the message is delivered when they come": "{0} нет в зале — сообщение придёт, когда он появится",
    "Close table": "Закрыть стол", "Sound when it is your turn": "Звук, когда ваш ход", "Turn sound off": "Звук выключен", "Turn sound on": "Звук включён", "Close the table for everyone?": "Закрыть стол для всех?",
    "Remove {0} from the table? A robot plays the seat.": "Убрать {0} из-за стола? Место займёт робот.", "Tournament board {0} of {1} — you sit {2}": "Турнирная сдача {0} из {1} — вы {2}", "Where do you sit?": "Где вы сидите?",
    "N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.": "Игроки С–Ю сравниваются с С–Ю, В–З с В–З. Вы сохраняете это место во всех сдачах.", "Against 10 robot tables": "Против 10 столов роботов",
    "= your score against 10 robot tables that played the same boards; it ranks the players until others have played.": "= ваш результат против 10 столов роботов, сыгравших те же сдачи; по нему ранжируют, пока не сыграют другие.",
    "Leave": "Выйти", "Leave the table?": "Выйти из-за стола?", "Leave the table": "Выйти из-за стола", "Your rating": "Ваш рейтинг", "This week": "На этой неделе", "This month": "В этом месяце", "This year": "В этом году", "All time": "За всё время", "System": "Система", "IMP / board": "IMP / сдача",
    "No rating yet — it shows once this player has played (with the new version).": "Рейтинга пока нет — он появится, когда игрок сыграет (в новой версии).", "Close — answer later": "Закрыть — ответить позже", "Cancel the tournament?": "Отменить турнир?", "Remove from my list": "Убрать из моего списка",
    "Join the tournament": "Участвовать", "Join and play": "Участвовать и играть", "{0} started a tournament — everyone can play it": "{0} начал турнир — играть могут все", "This tournament has not reached you yet — try again in a moment": "Турнир до вас ещё не дошёл — попробуйте чуть позже",
    "your robot partner bids it too": "ваш партнёр-робот тоже её играет", "Base system": "Базовая система", "Conventions": "Конвенции", "from the next deal": "со следующей сдачи", "In the lobby": "В зале",
    "How many of the remaining {0} tricks do you take?": "Сколько из оставшихся {0} взяток вы берёте?", "All {0}": "Все ({0})", "Claim sent — waiting for the other side": "Клейм отправлен — ждём другую линию", "You": "Вы",
    "Could not work it out yet — play a little longer": "Пока не посчитать — сыграйте ещё немного", "The robots do not accept: {0} tricks at most": "Роботы не согласны: не больше {0} взяток",
    "{0} claimed {1} of the last {2} tricks — accepted": "{0} заявил {1} из последних {2} взяток — принято", "{0} claimed {1} of the last {2} tricks — not accepted": "{0} заявил {1} из последних {2} взяток — не принято", "Robots": "Роботы",
    "The robots claimed the last {0} tricks — accepted": "Роботы заявили последние {0} взяток — принято", "The robots claimed the last {0} tricks — play goes on": "Роботы заявили последние {0} взяток — игра продолжается",
    "{0} claims {1} of the last {2} tricks": "{0} заявляет {1} из последних {2} взяток", "The robots claim all of the last {0} tricks": "Роботы заявляют все последние {0} взяток", "{0} wants to take back their last {1}": "{0} хочет отменить свой последний {1}",
    "move": "ход", "call": "заявку", "Do you agree?": "Вы согласны?", "{0} wanted to take back their last {1} — not accepted": "{0} хотел отменить свой последний {1} — не принято", "Nothing to take back, or the other side said no": "Отменять нечего, или другая линия отказала",
    "Table": "Стол", "Lobby": "Зал", "Alone with robots": "Один с роботами", "Shown in the lobby, nobody can join.": "Виден в зале, никто не может сесть.", "Open to others": "Открыт для других", "Shown in the lobby: players can ask to join, you accept.": "Виден в зале: игроки могут попроситься, вы принимаете.",
    "Message": "Сообщение", "Write a private message to {0}.": "Напишите личное сообщение {0}.", "Waiting for {0} to open the table": "Ждём, пока {0} откроет стол", "Tournament board {0} of {1}": "Турнирная сдача {0} из {1}", "Pair": "Пара", "Points": "Очки",
    "{0} tables": "{0} столов", "individual": "личный", "at tables": "за столами", "ranked by {0}": "зачёт по {0}", "started by {0}": "начал {0}", "table {0}, you sit {1}": "стол {0}, вы {1}", "Open table {0}": "Открыть стол {0}", "Join table {0}": "За стол {0}", "Table {0}": "Стол {0}",
    "Name": "Имя", "Tournament name": "Название турнира", "Boards": "Сдачи", "Format": "Формат", "Tables": "Столы", "Ranking": "Зачёт", "Keep the tournament for": "Хранить турнир", "{0} hours": "{0} ч", "1 day": "1 день", "3 days": "3 дня",
    "Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.": "Игроки сидят вместе за столами; все столы играют одни и те же сдачи; пустые места занимают роботы. Первый названный игрок стола открывает его.",
    "Players in the lobby": "Игроки в зале", "Invite players": "Пригласить игроков", "wants to join your table": "хочет сесть за ваш стол", "wants to watch your table": "хочет смотреть за вашим столом", "more waiting": "ещё ждут", "Open an online table first": "Сначала откройте онлайн-стол",
    "Invitation sent to {0}": "Приглашение отправлено {0}", "invites you to their table": "приглашает вас за свой стол", "Nobody else is in the lobby right now.": "Сейчас в зале больше никого нет.", "Invite to my table": "Пригласить за мой стол", "Open an online table to invite players to it.": "Откройте онлайн-стол, чтобы пригласить игроков.",
    "Public table": "Открытый стол", "Private table": "Закрытый стол", "Listed in the lobby: anyone can ask to join, you accept.": "Виден в зале: любой может попроситься, вы принимаете.", "Shown in the lobby with 🔒: invited players sit at once, others must ask you, no spectators.": "Виден в зале с 🔒: приглашённые садятся сразу, остальные просятся, без зрителей.",
    "Clear the chat": "Очистить чат", "Open an online table": "Открыть онлайн-стол", "Open your own online table (players ask to join and you accept them), or ask to join one of the tables below.": "Откройте свой онлайн-стол (игроки просятся, вы принимаете) или попроситесь за один из столов ниже.",
    "setting up": "подготовка", "{0} accepted": "согласились: {0}", "Players and start": "Игроки и старт", "Waiting for {0} to start": "Ждём, пока {0} начнёт", "{0} invites you": "{0} приглашает вас", "{0} invites you to a tournament": "{0} приглашает вас на турнир",
    "No tournaments yet. Create one and invite the players you want.": "Турниров пока нет. Создайте турнир и пригласите, кого хотите.", "accepted": "согласился", "declined": "отказался", "invited": "приглашён", "organiser": "организатор",
    "Everyone plays the same deals at their own table, sitting South. The tournament opens when you press Start.": "Каждый играет одни и те же сдачи за своим столом, сидя на Юге. Турнир откроется, когда вы нажмёте «Начать».", "Players to invite": "Кого пригласить",
    "Nobody else is in the lobby right now — type a name below.": "В зале больше никого нет — введите имя ниже.", "Add a player by name": "Добавить игрока по имени", "Add": "Добавить", "Answers": "Ответы", "Send the invitations": "Отправить приглашения",
    "Start the tournament": "Начать турнир", "Cancel the tournament": "Отменить турнир", "Pick at least one player": "Выберите хотя бы одного игрока", "Invitations sent": "Приглашения отправлены", "The tournament has started": "Турнир начался", "This tournament has not started yet": "Этот турнир ещё не начался",
  },
  pl: {
    "All": "Wszystkie", "Registering": "Zapisy", "Running": "Trwają", "Mine": "Moje", "Tournament": "Turniej", "Players": "Gracze", "Status": "Status", "Ends in": "Koniec za", "{0} d {1} h": "{0} d {1} godz.", "{0} h {1} min": "{0} godz. {1} min", "Register": "Zapisz się", "No tournaments here.": "Brak turniejów.", "Edit my card": "Edytuj moją kartę",
    "Country/Region": "Kraj/region", "Skill level": "Poziom gry", "Joined": "Data dołączenia", "Logins": "Logowania", "Title": "Tytuł", "Newcomer": "Nowicjusz", "Strategist": "Strateg", "Master": "Mistrz", "Grandmaster": "Arcymistrz",
    "At {0}'s table": "Przy stole {0}", "Country": "Kraj", "Level": "Poziom", "Not set": "Nie wybrano", "About me": "O mnie", "A few words about you (system, what you like…)": "Kilka słów o sobie (system, co lubisz…)", "Beginner": "Początkujący", "Intermediate": "Średniozaawansowany", "Advanced": "Zaawansowany", "Expert": "Ekspert", "World class": "Klasa światowa",
    "Contract": "Kontrakt", "Today": "Dziś", "last:": "ostatnie:", "New Deal": "Rozdaj", "Sure?": "Na pewno?", "Undo": "Cofnij", "Chat": "Czat", "Hint": "Podpowiedź", "Claim": "Claim", "Online": "Online", "Help": "Pomoc", "Settings": "Ustawienia", "Results": "Wyniki", "Home": "Start",
    "Us": "My", "Them": "Oni", "Pass": "Pas", "Double": "Kontra", "Redouble": "Rekontra",
    "Your call": "Twoja odzywka", "{0} is thinking…": "{0} myśli…", "Gathering the trick…": "Zbieranie lewy…", "Your turn: play a card": "Twój ruch: zagraj kartę", "Play from {0}'s hand": "Zagraj z ręki {0}", "{0} is playing…": "{0} gra…",
    "Press Start to deal": "Naciśnij Start, aby rozdać", "Waiting for the host to start": "Czekamy, aż gospodarz zacznie", "Waiting for players — press Start when everyone is seated": "Czekamy na graczy — naciśnij Start, gdy wszyscy usiądą", "Board finished": "Rozdanie zakończone",
    "Tap a call to see what it means": "Dotknij odzywki, aby zobaczyć jej znaczenie", "Next deal": "Następne rozdanie", "Tap for details": "Dotknij, aby zobaczyć szczegóły", "Tap here to see the last trick": "Dotknij tutaj, aby zobaczyć ostatnią lewę",
    "Bridge Table": "Stół brydżowy", "Your name": "Twoje imię", "Start": "Start", "Continue": "Kontynuuj", "Seat me at a table": "Znajdź mi stół", "Open tables": "Otwarte stoły", "Lobby chat": "Czat sali", "Write a message…": "Napisz wiadomość…", "Send": "Wyślij",
    "Our convention card (with partner)": "Nasza karta konwencyjna (z partnerem)", "No messages yet — say hello!": "Brak wiadomości — przywitaj się!", "{0} in the lobby": "{0} na sali", "Your last board is waiting.": "Twoje ostatnie rozdanie czeka.",
    "Play alone with robots, or join a table where a robot is playing.": "Graj sam z robotami albo dosiądź się do stołu, przy którym gra robot.", "Language": "Język", "boards": "rozdań", "Open a waiting room": "Otwórz poczekalnię",
    "{0}'s table": "Stół {0}", "playing with robots": "gra z robotami", "online": "online", "waiting to start": "czeka na start", "board {0}": "rozdanie {0}", "Ask to join": "Poproś o miejsce", "Robot": "Robot", "away · robot plays": "nieobecny · gra robot",
    "No other tables are open right now.": "Teraz nie ma innych otwartych stołów.", "Looking for tables…": "Szukam stołów…", "Refresh the list": "Odśwież listę", "Show open tables": "Pokaż otwarte stoły", "Online table": "Stół online", "Sit here": "Usiądź tutaj", "Remove": "Usuń", "(you)": "(ty)",
    "Waiting for the host to start.": "Czekamy, aż gospodarz zacznie.", "“Sit here” asks the host to move you.": "„Usiądź tutaj” prosi gospodarza o przesadzenie.", "Asking to join": "Prosi o miejsce", "Accept": "Akceptuj", "Decline": "Odrzuć", "(opponent)": "(przeciwnik)", "(partner)": "(partner)",
    "Asking to change seats": "Prosi o zmianę miejsca", "asks for a new deal": "prosi o nowe rozdanie", "asks to reset the table score": "prosi o wyzerowanie wyniku", "Table score": "Wynik stołu", "Reset the score": "Wyzeruj wynik", "Ask to reset the score": "Poproś o wyzerowanie", "Ask for a new deal": "Poproś o nowe rozdanie",
    "Join {0}'s table": "Do stołu {0}", "Sit as": "Usiądź jako", "The host's partner": "Partner gospodarza", "An opponent": "Przeciwnik", "Any free seat": "Dowolne wolne miejsce", "Join": "Dołącz", "Not now": "Nie teraz", "Cancel": "Anuluj",
    "Waiting for the host to accept you…": "Czekamy, aż gospodarz cię przyjmie…", "{0} decides whether you can sit.": "{0} decyduje, czy możesz usiąść.", "No table has a free seat right now.": "Teraz żaden stół nie ma wolnego miejsca.", "Asked {0} for a seat…": "Poproszono {0} o miejsce…",
    "Asked the host for a new deal": "Poproszono gospodarza o nowe rozdanie", "The host said no": "Gospodarz odmówił", "You are offline": "Jesteś offline", "Watch": "Kibicuj", "You are watching this table.": "Kibicujesz przy tym stole.",
    "Tournaments": "Turnieje", "New tournament": "Nowy turniej", "Play": "Graj", "Standings": "Klasyfikacja", "Close": "Zamknij", "Player": "Gracz", "{0} boards": "{0} rozdań", "{0} players": "{0} graczy", "you: {0}/{1}": "ty: {0}/{1}", "Nobody has played yet.": "Nikt jeszcze nie grał.",
    "{0} boards · started by {1} · results arrive as the others play": "{0} rozdań · rozpoczął {1} · wyniki spływają w miarę gry", "No tournaments yet. Start one — everyone in the lobby gets the same deals.": "Brak turniejów. Rozpocznij jeden — wszyscy na sali dostaną te same rozdania.",
    "Tournament board {0} of {1} — you sit South": "Rozdanie turniejowe {0} z {1} — siedzisz na S", "Close the online table first": "Najpierw zamknij stół online", "Finish this tournament board first": "Najpierw dokończ to rozdanie turniejowe", "Going back to your table…": "Wracam do twojego stołu…",
    "Your system": "Twój system", "Play with robots, join a table or open your own.": "Graj z robotami, dosiądź się do stołu lub otwórz własny.", "Convention card": "Konwencje", "Close the table?": "Zamknąć stół?", "Yes": "Tak", "No": "Nie", "Play with robots": "Graj z robotami",
    "Against the tournament ({0} players): {1} IMP · {2}%": "Na tle turnieju ({0} graczy): {1} IMP · {2}%", "Leave the table you are at first": "Najpierw opuść swój stół", "No table to watch right now.": "Teraz nie ma stołu do kibicowania.", "Play as partners": "Graj w parze",
    "Practice these boards": "Przećwicz te rozdania", "Practice: board {0} of {1}": "Trening: rozdanie {0} z {1}", "Watch a table": "Kibicuj przy stole", "wants to play with you as partners": "chce grać z tobą w parze", "Add as friend": "Dodaj do znajomych", "Alert": "Alert",
    "Alert your next call and say what it means": "Alertuj następną odzywkę i napisz, co znaczy", "Back to the list": "Wróć do listy", "Bd": "Rozd.", "Boards played today — tap one to see the hands, the auction and the play.": "Rozdania zagrane dziś — dotknij, aby zobaczyć ręce, licytację i rozgrywkę.",
    "Friend": "Znajomy", "History": "Historia", "No boards yet today.": "Dziś jeszcze nie było rozdań.", "Nobody has played this board yet.": "Nikt jeszcze nie zagrał tego rozdania.", "Other tables": "Inne stoły", "Previous deal": "Poprzednie rozdanie", "Robot reading": "Odczyt robota", "Score": "Zapis",
    "Tap your own row to replay the board.": "Dotknij swojego wiersza, aby obejrzeć rozdanie.", "Total": "Razem", "What does your next call mean?": "Co znaczy twoja następna odzywka?", "Your turn — the table is waiting ({0} s)": "Twój ruch — stół czeka ({0} s)",
    "{0} has not played for {1} s — tap the name to remove": "{0} nie gra od {1} s — dotknij imienia, aby usunąć", "{0} is in the lobby": "{0} jest na sali", "{0} is not in the lobby — the message is delivered when they come": "{0} nie ma na sali — wiadomość dotrze, gdy się pojawi",
    "Close table": "Zamknij stół", "Sound when it is your turn": "Dźwięk, gdy twój ruch", "Turn sound off": "Dźwięk wyłączony", "Turn sound on": "Dźwięk włączony", "Close the table for everyone?": "Zamknąć stół dla wszystkich?",
    "Remove {0} from the table? A robot plays the seat.": "Usunąć {0} ze stołu? Miejsce zajmie robot.", "Tournament board {0} of {1} — you sit {2}": "Rozdanie turniejowe {0} z {1} — siedzisz na {2}", "Where do you sit?": "Gdzie siedzisz?",
    "N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.": "Gracze NS są porównywani z NS, EW z EW. Zachowujesz to miejsce we wszystkich rozdaniach.", "Against 10 robot tables": "Przeciw 10 stołom robotów",
    "= your score against 10 robot tables that played the same boards; it ranks the players until others have played.": "= twój wynik przeciw 10 stołom robotów, które grały te same rozdania; ustala kolejność, dopóki nie zagrają inni.",
    "Leave": "Wyjdź", "Leave the table?": "Opuścić stół?", "Leave the table": "Opuść stół", "Your rating": "Twój bilans", "This week": "Ten tydzień", "This month": "Ten miesiąc", "This year": "Ten rok", "All time": "Od początku", "System": "System", "IMP / board": "IMP / rozdanie",
    "No rating yet — it shows once this player has played (with the new version).": "Brak bilansu — pojawi się, gdy ten gracz zagra (w nowej wersji).", "Close — answer later": "Zamknij — odpowiedz później", "Cancel the tournament?": "Odwołać turniej?", "Remove from my list": "Usuń z mojej listy",
    "Join the tournament": "Dołącz do turnieju", "Join and play": "Dołącz i graj", "{0} started a tournament — everyone can play it": "{0} rozpoczął turniej — każdy może zagrać", "This tournament has not reached you yet — try again in a moment": "Ten turniej jeszcze do ciebie nie dotarł — spróbuj za chwilę",
    "your robot partner bids it too": "twój partner robot też go gra", "Base system": "System bazowy", "Conventions": "Konwencje", "from the next deal": "od następnego rozdania", "In the lobby": "Na sali",
    "How many of the remaining {0} tricks do you take?": "Ile z pozostałych {0} lew bierzesz?", "All {0}": "Wszystkie ({0})", "Claim sent — waiting for the other side": "Claim wysłany — czekamy na drugą stronę", "You": "Ty",
    "Could not work it out yet — play a little longer": "Jeszcze nie da się policzyć — zagraj trochę dłużej", "The robots do not accept: {0} tricks at most": "Roboty nie zgadzają się: najwyżej {0} lew",
    "{0} claimed {1} of the last {2} tricks — accepted": "{0} zgłosił {1} z ostatnich {2} lew — przyjęte", "{0} claimed {1} of the last {2} tricks — not accepted": "{0} zgłosił {1} z ostatnich {2} lew — nieprzyjęte", "Robots": "Roboty",
    "The robots claimed the last {0} tricks — accepted": "Roboty zgłosiły ostatnie {0} lew — przyjęte", "The robots claimed the last {0} tricks — play goes on": "Roboty zgłosiły ostatnie {0} lew — gramy dalej",
    "{0} claims {1} of the last {2} tricks": "{0} zgłasza {1} z ostatnich {2} lew", "The robots claim all of the last {0} tricks": "Roboty zgłaszają wszystkie ostatnie {0} lew", "{0} wants to take back their last {1}": "{0} chce cofnąć swój ostatni {1}",
    "move": "ruch", "call": "odzywkę", "Do you agree?": "Zgadzasz się?", "{0} wanted to take back their last {1} — not accepted": "{0} chciał cofnąć swój ostatni {1} — nieprzyjęte", "Nothing to take back, or the other side said no": "Nie ma czego cofnąć albo druga strona odmówiła",
    "Table": "Stół", "Lobby": "Sala", "Alone with robots": "Sam z robotami", "Shown in the lobby, nobody can join.": "Widoczny na sali, nikt nie może dołączyć.", "Open to others": "Otwarty dla innych", "Shown in the lobby: players can ask to join, you accept.": "Widoczny na sali: gracze mogą prosić o miejsce, ty akceptujesz.",
    "Message": "Wiadomość", "Write a private message to {0}.": "Napisz prywatną wiadomość do {0}.", "Waiting for {0} to open the table": "Czekamy, aż {0} otworzy stół", "Tournament board {0} of {1}": "Rozdanie turniejowe {0} z {1}", "Pair": "Para", "Points": "Punkty",
    "{0} tables": "{0} stołów", "individual": "indywidualny", "at tables": "przy stołach", "ranked by {0}": "punktacja {0}", "started by {0}": "rozpoczął {0}", "table {0}, you sit {1}": "stół {0}, siedzisz na {1}", "Open table {0}": "Otwórz stół {0}", "Join table {0}": "Do stołu {0}", "Table {0}": "Stół {0}",
    "Name": "Imię", "Tournament name": "Nazwa turnieju", "Boards": "Rozdania", "Format": "Format", "Tables": "Stoły", "Ranking": "Punktacja", "Keep the tournament for": "Zachowaj turniej przez", "{0} hours": "{0} godz.", "1 day": "1 dzień", "3 days": "3 dni",
    "Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.": "Gracze siedzą razem przy stołach; każdy stół gra te same rozdania; puste miejsca zajmują roboty. Stół otwiera pierwszy wpisany przy nim gracz.",
    "Players in the lobby": "Gracze na sali", "Invite players": "Zaproś graczy", "wants to join your table": "chce dosiąść się do twojego stołu", "wants to watch your table": "chce kibicować przy twoim stole", "more waiting": "więcej czeka", "Open an online table first": "Najpierw otwórz stół online",
    "Invitation sent to {0}": "Zaproszenie wysłane do {0}", "invites you to their table": "zaprasza cię do swojego stołu", "Nobody else is in the lobby right now.": "Teraz nikogo więcej nie ma na sali.", "Invite to my table": "Zaproś do mojego stołu", "Open an online table to invite players to it.": "Otwórz stół online, aby zaprosić graczy.",
    "Public table": "Stół publiczny", "Private table": "Stół prywatny", "Listed in the lobby: anyone can ask to join, you accept.": "Na liście na sali: każdy może poprosić o miejsce, ty akceptujesz.", "Shown in the lobby with 🔒: invited players sit at once, others must ask you, no spectators.": "Widoczny na sali z 🔒: zaproszeni siadają od razu, inni muszą prosić, bez kibiców.",
    "Clear the chat": "Wyczyść czat", "Open an online table": "Otwórz stół online", "Open your own online table (players ask to join and you accept them), or ask to join one of the tables below.": "Otwórz własny stół online (gracze proszą o miejsce, ty ich przyjmujesz) albo poproś o miejsce przy jednym ze stołów poniżej.",
    "setting up": "przygotowanie", "{0} accepted": "zgodziło się: {0}", "Players and start": "Gracze i start", "Waiting for {0} to start": "Czekamy, aż {0} rozpocznie", "{0} invites you": "{0} cię zaprasza", "{0} invites you to a tournament": "{0} zaprasza cię na turniej",
    "No tournaments yet. Create one and invite the players you want.": "Brak turniejów. Utwórz turniej i zaproś, kogo chcesz.", "accepted": "przyjęte", "declined": "odrzucone", "invited": "zaproszony", "organiser": "organizator",
    "Everyone plays the same deals at their own table, sitting South. The tournament opens when you press Start.": "Każdy gra te same rozdania przy własnym stole, siedząc na S. Turniej otworzy się, gdy naciśniesz Start.", "Players to invite": "Kogo zaprosić",
    "Nobody else is in the lobby right now — type a name below.": "Nikogo więcej nie ma na sali — wpisz imię poniżej.", "Add a player by name": "Dodaj gracza po imieniu", "Add": "Dodaj", "Answers": "Odpowiedzi", "Send the invitations": "Wyślij zaproszenia",
    "Start the tournament": "Rozpocznij turniej", "Cancel the tournament": "Odwołaj turniej", "Pick at least one player": "Wybierz co najmniej jednego gracza", "Invitations sent": "Zaproszenia wysłane", "The tournament has started": "Turniej się rozpoczął", "This tournament has not started yet": "Ten turniej jeszcze się nie rozpoczął",
  },
  zh: {
    "All": "全部", "Registering": "报名中", "Running": "进行中", "Mine": "我的", "Tournament": "比赛", "Players": "玩家", "Status": "状态", "Ends in": "剩余时间", "{0} d {1} h": "{0}天{1}小时", "{0} h {1} min": "{0}小时{1}分", "Register": "报名", "No tournaments here.": "这里没有比赛。", "Edit my card": "编辑我的名片",
    "Country/Region": "国家/地区", "Skill level": "技术水平", "Joined": "注册日期", "Logins": "登录次数", "Title": "称号", "Newcomer": "新手", "Strategist": "策略家", "Master": "大师", "Grandmaster": "特级大师",
    "At {0}'s table": "在{0}的牌桌", "Country": "国家/地区", "Level": "水平", "Not set": "未选择", "About me": "关于我", "A few words about you (system, what you like…)": "介绍一下自己(体系、喜好…)", "Beginner": "初学", "Intermediate": "中级", "Advanced": "高级", "Expert": "专家", "World class": "世界级",
    "Contract": "定约", "Today": "今天", "last:": "上一副:", "New Deal": "新牌", "Sure?": "确定?", "Undo": "撤回", "Chat": "聊天", "Hint": "提示", "Claim": "摊牌", "Online": "在线", "Help": "帮助", "Settings": "设置", "Results": "成绩", "Home": "首页",
    "Us": "我方", "Them": "对方", "Pass": "不叫", "Double": "加倍", "Redouble": "再加倍",
    "Your call": "轮到你叫牌", "{0} is thinking…": "{0} 正在思考…", "Gathering the trick…": "正在收墩…", "Your turn: play a card": "轮到你:出一张牌", "Play from {0}'s hand": "从{0}的手中出牌", "{0} is playing…": "{0} 正在出牌…",
    "Press Start to deal": "按“开始”发牌", "Waiting for the host to start": "等待桌主开始", "Waiting for players — press Start when everyone is seated": "等待玩家 — 大家坐好后按“开始”", "Board finished": "本副结束",
    "Tap a call to see what it means": "点击叫品查看含义", "Next deal": "下一副", "Tap for details": "点击查看详情", "Tap here to see the last trick": "点击这里查看上一墩",
    "Bridge Table": "桥牌桌", "Your name": "你的名字", "Start": "开始", "Continue": "继续", "Seat me at a table": "帮我找座位", "Open tables": "开放的牌桌", "Lobby chat": "大厅聊天", "Write a message…": "输入消息…", "Send": "发送",
    "Our convention card (with partner)": "我们的约定卡(与同伴)", "No messages yet — say hello!": "还没有消息 — 打个招呼吧!", "{0} in the lobby": "大厅里 {0} 人", "Your last board is waiting.": "你上一副牌还在等你。",
    "Play alone with robots, or join a table where a robot is playing.": "与机器人单独打牌,或加入有机器人的牌桌。", "Language": "语言", "boards": "副", "Open a waiting room": "开一个等候室",
    "{0}'s table": "{0}的牌桌", "playing with robots": "与机器人打牌", "online": "在线", "waiting to start": "等待开始", "board {0}": "第{0}副", "Ask to join": "申请加入", "Robot": "机器人", "away · robot plays": "离开 · 机器人代打",
    "No other tables are open right now.": "目前没有其他开放的牌桌。", "Looking for tables…": "正在寻找牌桌…", "Refresh the list": "刷新列表", "Show open tables": "显示开放的牌桌", "Online table": "在线牌桌", "Sit here": "坐这里", "Remove": "移除", "(you)": "(你)",
    "Waiting for the host to start.": "等待桌主开始。", "“Sit here” asks the host to move you.": "“坐这里”会请求桌主为你换座。", "Asking to join": "申请加入", "Accept": "接受", "Decline": "拒绝", "(opponent)": "(对手)", "(partner)": "(同伴)",
    "Asking to change seats": "申请换座", "asks for a new deal": "请求新的一副", "asks to reset the table score": "请求清零比分", "Table score": "本桌比分", "Reset the score": "清零比分", "Ask to reset the score": "请求清零", "Ask for a new deal": "请求新的一副",
    "Join {0}'s table": "加入{0}的牌桌", "Sit as": "坐为", "The host's partner": "桌主的同伴", "An opponent": "对手", "Any free seat": "任意空位", "Join": "加入", "Not now": "以后再说", "Cancel": "取消",
    "Waiting for the host to accept you…": "等待桌主接受你…", "{0} decides whether you can sit.": "由{0}决定你能否入座。", "No table has a free seat right now.": "目前没有牌桌有空位。", "Asked {0} for a seat…": "已向{0}申请座位…",
    "Asked the host for a new deal": "已向桌主请求新的一副", "The host said no": "桌主拒绝了", "You are offline": "你已离线", "Watch": "观战", "You are watching this table.": "你正在观战这张牌桌。",
    "Tournaments": "比赛", "New tournament": "新比赛", "Play": "开始打", "Standings": "排名", "Close": "关闭", "Player": "玩家", "{0} boards": "{0}副", "{0} players": "{0}名玩家", "you: {0}/{1}": "你:{0}/{1}", "Nobody has played yet.": "还没有人打过。",
    "{0} boards · started by {1} · results arrive as the others play": "{0}副 · 由{1}发起 · 其他人打完后成绩陆续到来", "No tournaments yet. Start one — everyone in the lobby gets the same deals.": "还没有比赛。发起一个 — 大厅里每个人都打同样的牌。",
    "Tournament board {0} of {1} — you sit South": "比赛第{0}/{1}副 — 你坐南", "Close the online table first": "请先关闭在线牌桌", "Finish this tournament board first": "请先打完这副比赛牌", "Going back to your table…": "正在返回你的牌桌…",
    "Your system": "你的体系", "Play with robots, join a table or open your own.": "与机器人打牌、加入牌桌或开一张自己的牌桌。", "Convention card": "约定卡", "Close the table?": "关闭牌桌?", "Yes": "是", "No": "否", "Play with robots": "与机器人打牌",
    "Against the tournament ({0} players): {1} IMP · {2}%": "对比比赛({0}名玩家):{1} IMP · {2}%", "Leave the table you are at first": "请先离开你所在的牌桌", "No table to watch right now.": "目前没有可观战的牌桌。", "Play as partners": "结为同伴",
    "Practice these boards": "练习这些牌", "Practice: board {0} of {1}": "练习:第{0}/{1}副", "Watch a table": "观战", "wants to play with you as partners": "想和你结为同伴", "Add as friend": "加为好友", "Alert": "提醒",
    "Alert your next call and say what it means": "提醒你的下一个叫品并说明含义", "Back to the list": "返回列表", "Bd": "副", "Boards played today — tap one to see the hands, the auction and the play.": "今天打过的牌 — 点击查看四手牌、叫牌和打牌过程。",
    "Friend": "好友", "History": "记录", "No boards yet today.": "今天还没有打牌。", "Nobody has played this board yet.": "还没有人打过这副牌。", "Other tables": "其他牌桌", "Previous deal": "上一副", "Robot reading": "机器人的理解", "Score": "得分",
    "Tap your own row to replay the board.": "点击你自己的那一行回放这副牌。", "Total": "合计", "What does your next call mean?": "你的下一个叫品是什么意思?", "Your turn — the table is waiting ({0} s)": "轮到你 — 牌桌在等你({0}秒)",
    "{0} has not played for {1} s — tap the name to remove": "{0} 已 {1} 秒没有出牌 — 点击名字可移除", "{0} is in the lobby": "{0} 在大厅里", "{0} is not in the lobby — the message is delivered when they come": "{0} 不在大厅 — 消息将在其到来时送达",
    "Close table": "关闭牌桌", "Sound when it is your turn": "轮到你时提示音", "Turn sound off": "提示音已关", "Turn sound on": "提示音已开", "Close the table for everyone?": "为所有人关闭牌桌?",
    "Remove {0} from the table? A robot plays the seat.": "把{0}移出牌桌?由机器人代打。", "Tournament board {0} of {1} — you sit {2}": "比赛第{0}/{1}副 — 你坐{2}", "Where do you sit?": "你坐哪个方位?",
    "N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.": "南北玩家与南北比较,东西玩家与东西比较。每副牌你都坐这个方位。", "Against 10 robot tables": "对比10张机器人牌桌",
    "= your score against 10 robot tables that played the same boards; it ranks the players until others have played.": "= 你与打同样牌的10张机器人牌桌相比的成绩;在其他人打之前按此排名。",
    "Leave": "离开", "Leave the table?": "离开牌桌?", "Leave the table": "离开牌桌", "Your rating": "你的成绩", "This week": "本周", "This month": "本月", "This year": "今年", "All time": "全部", "System": "体系", "IMP / board": "IMP / 副",
    "No rating yet — it shows once this player has played (with the new version).": "还没有成绩 — 该玩家(用新版本)打牌后才会显示。", "Close — answer later": "关闭 — 稍后回复", "Cancel the tournament?": "取消比赛?", "Remove from my list": "从我的列表移除",
    "Join the tournament": "参加比赛", "Join and play": "参加并开始打", "{0} started a tournament — everyone can play it": "{0} 发起了比赛 — 人人都可以参加", "This tournament has not reached you yet — try again in a moment": "比赛信息尚未到达 — 请稍后再试",
    "your robot partner bids it too": "你的机器人同伴也用这个体系", "Base system": "基本体系", "Conventions": "约定", "from the next deal": "从下一副起", "In the lobby": "大厅里",
    "How many of the remaining {0} tricks do you take?": "剩下的 {0} 墩你能拿几墩?", "All {0}": "全部({0})", "Claim sent — waiting for the other side": "已摊牌 — 等待对方", "You": "你",
    "Could not work it out yet — play a little longer": "暂时算不出来 — 再打一会儿", "The robots do not accept: {0} tricks at most": "机器人不接受:最多 {0} 墩",
    "{0} claimed {1} of the last {2} tricks — accepted": "{0} 摊牌要剩下 {2} 墩中的 {1} 墩 — 已接受", "{0} claimed {1} of the last {2} tricks — not accepted": "{0} 摊牌要剩下 {2} 墩中的 {1} 墩 — 未接受", "Robots": "机器人",
    "The robots claimed the last {0} tricks — accepted": "机器人摊牌要剩下的 {0} 墩 — 已接受", "The robots claimed the last {0} tricks — play goes on": "机器人摊牌要剩下的 {0} 墩 — 继续打",
    "{0} claims {1} of the last {2} tricks": "{0} 摊牌要剩下 {2} 墩中的 {1} 墩", "The robots claim all of the last {0} tricks": "机器人摊牌要剩下的全部 {0} 墩", "{0} wants to take back their last {1}": "{0} 想撤回上一个{1}",
    "move": "出牌", "call": "叫品", "Do you agree?": "你同意吗?", "{0} wanted to take back their last {1} — not accepted": "{0} 想撤回上一个{1} — 未接受", "Nothing to take back, or the other side said no": "没有可撤回的,或对方拒绝了",
    "Table": "牌桌", "Lobby": "大厅", "Alone with robots": "单独与机器人", "Shown in the lobby, nobody can join.": "在大厅显示,无人可加入。", "Open to others": "向他人开放", "Shown in the lobby: players can ask to join, you accept.": "在大厅显示:玩家可申请加入,由你接受。",
    "Message": "消息", "Write a private message to {0}.": "给{0}发私信。", "Waiting for {0} to open the table": "等待{0}开桌", "Tournament board {0} of {1}": "比赛第{0}/{1}副", "Pair": "搭档", "Points": "分数",
    "{0} tables": "{0}桌", "individual": "个人赛", "at tables": "分桌赛", "ranked by {0}": "按{0}排名", "started by {0}": "由{0}发起", "table {0}, you sit {1}": "第{0}桌,你坐{1}", "Open table {0}": "开第{0}桌", "Join table {0}": "加入第{0}桌", "Table {0}": "第{0}桌",
    "Name": "名字", "Tournament name": "比赛名称", "Boards": "副数", "Format": "赛制", "Tables": "牌桌数", "Ranking": "排名方式", "Keep the tournament for": "比赛保留", "{0} hours": "{0}小时", "1 day": "1天", "3 days": "3天",
    "Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.": "玩家分桌就座;每桌打同样的牌;空位由机器人代打。每桌第一个填写的玩家负责开桌。",
    "Players in the lobby": "大厅里的玩家", "Invite players": "邀请玩家", "wants to join your table": "想加入你的牌桌", "wants to watch your table": "想观战你的牌桌", "more waiting": "人在等待", "Open an online table first": "请先开一张在线牌桌",
    "Invitation sent to {0}": "已向{0}发出邀请", "invites you to their table": "邀请你到他的牌桌", "Nobody else is in the lobby right now.": "目前大厅里没有其他人。", "Invite to my table": "邀请到我的牌桌", "Open an online table to invite players to it.": "开一张在线牌桌才能邀请玩家。",
    "Public table": "公开牌桌", "Private table": "私人牌桌", "Listed in the lobby: anyone can ask to join, you accept.": "在大厅列出:任何人都可申请,由你接受。", "Shown in the lobby with 🔒: invited players sit at once, others must ask you, no spectators.": "在大厅以 🔒 显示:受邀者直接入座,其他人需申请,不允许观战。",
    "Clear the chat": "清空聊天", "Open an online table": "开在线牌桌", "Open your own online table (players ask to join and you accept them), or ask to join one of the tables below.": "开一张自己的在线牌桌(玩家申请,你来接受),或申请加入下面的牌桌。",
    "setting up": "准备中", "{0} accepted": "已接受 {0} 人", "Players and start": "玩家与开始", "Waiting for {0} to start": "等待{0}开始", "{0} invites you": "{0} 邀请你", "{0} invites you to a tournament": "{0} 邀请你参加比赛",
    "No tournaments yet. Create one and invite the players you want.": "还没有比赛。创建一个并邀请你想邀请的玩家。", "accepted": "已接受", "declined": "已拒绝", "invited": "已邀请", "organiser": "组织者",
    "Everyone plays the same deals at their own table, sitting South. The tournament opens when you press Start.": "每人在自己的牌桌坐南打同样的牌。按“开始”后比赛开放。", "Players to invite": "要邀请的玩家",
    "Nobody else is in the lobby right now — type a name below.": "大厅里没有其他人 — 在下面输入名字。", "Add a player by name": "按名字添加玩家", "Add": "添加", "Answers": "回复", "Send the invitations": "发送邀请",
    "Start the tournament": "开始比赛", "Cancel the tournament": "取消比赛", "Pick at least one player": "至少选择一名玩家", "Invitations sent": "邀请已发送", "The tournament has started": "比赛已开始", "This tournament has not started yet": "比赛尚未开始",
  },
};
function T(s, ...a) { let r = (I18N[SET.lang] || {})[s] || s; a.forEach((v, i) => { r = r.split('{' + i + '}').join(v); }); return r; }

/* ---- the seats, the conventions and the systems in the chosen language (the English text stays in the engine;
   applyLang() swaps the names and descriptions shown on the screen) ---- */
// the languages of the app (code, name in that language)
const LANGS = [['en', 'English'], ['tr', 'Türkçe'], ['no', 'Norsk'], ['es', 'Español'], ['fr', 'Français'], ['it', 'Italiano'], ['de', 'Deutsch'], ['ru', 'Русский'], ['pl', 'Polski'], ['zh', '中文']];
const SEAT_T = { en: ['North', 'East', 'South', 'West'], tr: ['Kuzey', 'Doğu', 'Güney', 'Batı'], no: ['Nord', 'Øst', 'Syd', 'Vest'], es: ['Norte', 'Este', 'Sur', 'Oeste'], fr: ['Nord', 'Est', 'Sud', 'Ouest'], it: ['Nord', 'Est', 'Sud', 'Ovest'], de: ['Nord', 'Ost', 'Süd', 'West'], ru: ['Север', 'Восток', 'Юг', 'Запад'], pl: ['Północ', 'Wschód', 'Południe', 'Zachód'], zh: ['北', '东', '南', '西'] };
// one letter for each seat (in contracts such as "4♠ S"); Polish uses N E S W, as Polish players do
const SEAT_AB_T = { en: 'NESW', tr: 'KDGB', no: 'NØSV', es: 'NESO', fr: 'NESO', it: 'NESO', de: 'NOSW', ru: 'СВЮЗ', pl: 'NESW', zh: '北东南西' };
let SEAT_AB = 'NESW';
const CONV_T = {
  tr: {
    twoOverOne: ['2/1 Oyun Forsu', 'Pas geçmemiş el, partnerin bir seviyesindeki açışına iki seviyesinde yeni renk verirse (1♣–2♦ hariç; 1♠–2♥ beş kupa gösterir) oyuna forsingdir, 12+ HCP. 1♥/1♠ üzerine 1NT bir tur forsingdir (6-12 HCP): açan başka bir şeyi yoksa 3 kartlık minörünü söyler; cevaplayanın sonra majörde 3’e atlaması 3 kartlı limit artırmadır. Pas geçmiş elin iki seviyesi cevabı forsing değildir.'],
    rkc: ['RKCB 1430', '4NT beş anahtar kartı sorar (dört as + koz papazı). 5♣ = 1 ya da 4, 5♦ = 3 ya da 0, 5♥ = koz kızı olmadan 2, 5♠ = koz kızıyla 2.'],
    gerber: ['Gerber', 'Doğrudan 1NT/2NT üzerine 4♣ asları sorar. 4♦ = 0 ya da 4, 4♥ = 1, 4♠ = 2, 4NT = 3. Soran 4NT’de durabilir.'],
    bergen: ['Bergen artırmaları', '1♥/1♠ üzerine (kontr ya da araya girişten sonra değil): 3♣ = 4 kartlı destek, 7-9 puan; 3♦ = 4 kartlı destek, 10-12 (limit artırma); majörde 3 = 4 kartlı destek, 0-6 (engelleyici). 4 kartlı destek ve 13+ ile Jacoby 2NT ya da splinter kullanılır. Basit artırma 3 kartlı destek, 6-9 gösterir; 3 kartlı limit artırma forsing 1NT üzerinden gider.'],
    capp: ['Cappelletti', 'Rakiplerin 1NT’sine (doğrudan pozisyonda): X = ceza, 15+ HCP. 2♣ = tek renkli el (6+ kart): partner sormak için 2♦ der, araya giren karoysa pas geçer ya da rengini söyler. 2♦ = iki majör (5-4 ya da daha uzun): partner bir majör seçer (atlama davettir, 10-12). 2♥/2♠ = o majörde 5+ ve 4+ bir minör: partner pas geçer, artırır ya da minörü sormak için 2NT der. 2NT = iki minör (5-5): partner seçer.'],
    j2nt: ['Jacoby 2NT', 'Majör açışa 2NT = 4+ kartlı destek, 13+ puan, oyun forsing. Açan: yeni renkte 3 = tekli ya da renksizlik; yeni renkte 4 = iyi 5 kartlı yan renk; majörde 3 = 18+ kısalık yok; 3NT = 15-17 kısalık yok; majörde 4 = minimum.'],
    wjs: ['Zayıf atlamalı renk değişimi', 'Cevaplayanın yeni renkte tek atlaması (ör. 1♦–2♠, 1♣–2♥) 6+ kartlı renk ve zayıf el (0-5 HCP) gösterir. Oynamak içindir; açan pas geçer. Rakibin kontrundan sonra geçerli değil.'],
    stayman: ['Stayman', '1NT üzerine 2♣ (2NT üzerine 3♣) 4 kartlı majör sorar. Cevaplar: ♦ = 4 kartlı majör yok, ♥ = dört kupa, ♠ = dört pik ve dört kupa yok. 2♦’den sonra 2♥/2♠ = o majörde beş + diğerinde dört, davet. Cevaplayan 2♥ üzerine NT derse, dört piki olan açan onları da söyler.'],
    fourWay: ['4 yönlü transferler', '1NT üzerine: 2♦ → kupa, 2♥ → pik (Jacoby), 2♠ → sinek (açan 3♣ der), 2NT → karo (açan 3♦ der). Dengeli davetler 2♣ Stayman üzerinden gider.'],
    smolen: ['Smolen', '1NT–2♣–2♦’den sonra majörlerde 5-4 olan oyun forsing el, 4 kartlı majörünü üç seviyesinde söyler: 3♥ = 4♥ + 5♠, 3♠ = 4♠ + 5♥; böylece güçlü el oynar.'],
    michaels: ['Michaels cue bid / Unusual 2NT', 'Rakibin bir seviyesindeki açışına doğrudan cue bid 5-5 iki renkli el, 7+ HCP gösterir: minör üzerine iki majör; majör üzerine diğer majör ve bir minör (partner minörü sormak için 2NT der). 2NT’ye atlama (Unusual) söylenmemiş en düşük iki rengi gösterir. Partner rengi seçer; uyum ve 10+ ile oyuna atlayabilir.'],
    splinter: ['Splinter', 'Majör açışa yeni renkte çift atlama (ör. 1♠–4♥, 1♥–3♠) = 4+ kartlı destek, söylenen renkte tekli ya da renksizlik, 11-15 HCP, oyun forsing, şilem ilgisi. Açan majörde 4’te durur ya da şilemi araştırır.'],
    texas: ['Texas transferleri', '1NT/2NT üzerine: 4♦ → 4♥, 4♥ → 4♠. 6+ kartlı majör ve oyun değeri; güçlü el (açan) oynar.'],
    texasInt: ['Araya girişten sonra Texas', 'Rakipler 1NT’mize kontr verse ya da iki veya üç seviyesinde araya girse de Texas transferleri geçerlidir: 4♦ → kupa, 4♥ → pik. Rakibin kendi rengindeki teklif transfer değildir (2♥ araya girişinden sonra 4♥ cue bid’dir, 4♦ yine kupa gösterir). Açan transferi tamamlar.'],
    leb: ['Lebensohl', '1NT’mize iki seviyesinde araya girilince: 2NT açanı 3♣ demeye zorlar (bir renkte durmak ya da yavaş göstermek için). Doğrudan üç seviyesinde renk forsingdir. Doğrudan 3NT stoperi reddeder; önce 2NT sonra 3NT stoper gösterir. Rakibin rengine cue bid Stayman’dır: doğrudan = stoper yok, 2NT üzerinden = stoper var ("hızlı olan reddeder").'],
    lav: ['Lavinthal atışları', 'Savunma işaretleri. Attığın renk istemediğin renktir; yüksek kart diğer iki renkten yükseğini, düşük kart düşüğünü ister (koz ve oynanan renk sayılmaz). Partnerin atağında yüksek kart cesaretlendirir, en düşük kart cesaret kırar.'],
    invMin: ['Ters minör artırma', 'Pas geçmemiş el 1♣/1♦ üzerine: minörde 2’ye artırma güçlüdür (10+ puan, 4+ destek, sinekte 5+, 4 kartlı majör yok) ve bir tur forsingdir; açan dengeli minimumla 2NT der, fazlasıyla stoperlerini gösterir ya da minimumla minörde 3 der. 3’e atlamalı artırma engelleyicidir (0-9 puan, 5+ destek).'],
    drury: ['Drury', 'Ters Drury. Pas geçmiş el, partnerin üçüncü/dördüncü eldeki 1♥/1♠ açışına 2♣ ile cevap verir = 3+ kartlı destek ve 10-12 puan. Açan hafif ya da minimum açışla majörde 2 der (oyun yok), tam açışla majörde 4 der.'],
    nmf: ['Yeni minör forsing', '1m–1M–1NT’den sonra cevaplayanın diğer minörde 2 demesi yapay ve forsingdir (11+): açandan cevaplayanın majörüne 3 kartlı destek ya da diğer 4 kartlı majörü ister.'],
    fsf: ['Dördüncü renk forsing', 'Bizim taraf üç renk söylediğinde, cevaplayanın dördüncü rengi söylemesi yapay ve oyun forsingdir; açandan elini daha çok anlatmasını ister (stoper, destek ya da fazla uzunluk).'],
    ogust: ['Ogust', 'Partnerin zayıf ikilisine 2NT sorar: 3♣ = minimum, kötü renk; 3♦ = minimum, iyi renk; 3♥ = maksimum, kötü renk; 3♠ = maksimum, iyi renk; 3NT = sağlam renk (AKQ).'],
    supx: ['Destek kontru', '1m–(P)–1M–(2M’nin altında araya giriş)’ten sonra açanın kontru cevaplayanın majörüne tam üç kartlı destek gösterir; doğrudan artırma dört gösterir.'],
    respx: ['Cevap kontru', 'Rakibin açışı, partnerin takeout kontru ve rakibin artırmasından sonra partnerin kontru takeout’tur: 8+ puan ve söylenmemiş iki renk (genelde majörler), açık bir teklif yok.'],
    sjs: ['Güçlü atlamalı renk değişimi', 'Cevaplayanın yeni renkte tek atlaması güçlü el (19+ puan), iyi renk ve şilem ilgisi gösterir. Zayıf atlamalı renk değişiminin yerini alır.'],
    dont: ['DONT', 'Disturb Opponents’ Notrump (Marty Bergen). Rakibin 1NT’sine: X = tek renkli el (6+), partner sormak için 2♣ der; 2♣ = sinek ve daha yüksek bir renk; 2♦ = karo ve bir majör; 2♥ = iki majör; 2♠ = sadece pik (doğal). Partner tahammülle pas geçer ya da sonraki rengi söyler (pas ya da düzelt). Cappelletti’nin yerini alır.'],
    jtr: ['Jacoby transferi', '1NT üzerine 2♦ açandan kupa, 2♥ pik söylemesini ister; böylece güçlü el oynar. Dört kartlı destek ve maksimumla (17) açan üç seviyesinde süper kabul yapar. Transferden sonra üç seviyesinde yeni renk doğal ve oyun forsingdir.'],
    bw: ['Blackwood', '4NT asları sorar: 5♣ = 0 ya da 4, 5♦ = 1, 5♥ = 2, 5♠ = 3.'],
    q: ['Kantitatif 4NT', 'Bir sanzatu teklifinden sonra 4NT as sormaz; şileme davet eder. Partner maksimumla 6NT der.'],
    nego: ['Negatif kontr', 'Partner açıp rakip araya girince kontr ceza değildir: söylenmemiş majörde dört kart ve teklif verecek kadar değer gösterir.'],
    takeout: ['Takeout kontru', 'Açış teklifine kontr: açış değeri, rakibin renginde kısalık ve diğer renklerde destek. Partner teklif vermek zorundadır.'],
    weak2: ['Zayıf iki', '2♦/2♥/2♠ açışı: iyi 6 kartlı renk, 5-10 HCP. Engelleyici açış.'],
    strong2c: ['Güçlü 2♣', '2♣ açışı: 22+ HCP ya da eşdeğer oyun gücü, yapay ve oyun forsing. 2♦ bekleme cevabıdır. 2♣–2♦–2♥/2♠’den sonra 3♣ ikinci negatiftir (0-3 HCP); 2♣–2♦–2NT (22-24) 2NT açışı gibi oynanır (Stayman, transferler geçerli).'],
    cue: ['Cue bid', 'Rakibin rengini söylemek doğal değildir: partnere limit artırma ya da daha güçlü destek gösterir ve forsingdir.'],
    nt1: ['1NT açışı', '15-17 HCP, dengeli.'],
    pre: ['Engelleyici açış', 'Üç ya da dört seviyesinde açış: uzun renk (7+) ve zayıf el; rakiplerin teklif alanını daraltır.'],
    runout: ['1NT kontr edilince kaçış', '1NT’mize kontr verilince zayıf cevaplayan 5+ kartlı rengine kaçar; rekontr değer gösterir (9+).'],
  },
  no: {
    twoOverOne: ['2/1 utgangskrav', 'Fra en hånd som ikke har passet er en ny farge på totrinnet over makkers åpning på ett (unntatt 1♣–2♦; 1♠–2♥ viser fem hjerter) krav til utgang, 12+ HP. Over 1♥/1♠ er 1NT krav i én runde (6-12 HP): åpner melder en trekorts minor om han ikke har noe annet; svarers senere hopp til 3 i majoren viser en invitt med trekorts støtte. Totrinnssvar fra en passet hånd er ikke krav.'],
    rkc: ['RKCB 1430', '4NT spør etter fem nøkkelkort (fire ess + trumfkongen). 5♣ = 1 eller 4, 5♦ = 3 eller 0, 5♥ = 2 uten trumfdamen, 5♠ = 2 med trumfdamen.'],
    gerber: ['Gerber', 'Rett over 1NT/2NT spør 4♣ etter ess. 4♦ = 0 eller 4, 4♥ = 1, 4♠ = 2, 4NT = 3. Den som spør kan stoppe i 4NT.'],
    bergen: ['Bergen-høyninger', 'Over 1♥/1♠ (ikke etter dobling eller innmelding): 3♣ = firekorts støtte, 7-9 poeng; 3♦ = firekorts støtte, 10-12 (invitt); 3 i majoren = firekorts støtte, 0-6 (sperre). Med firekorts støtte og 13+ brukes Jacoby 2NT eller splinter. Enkel høyning viser trekorts støtte, 6-9; trekorts invitt går via krav-1NT.'],
    capp: ['Cappelletti', 'Over motpartens 1NT (direkte): X = straff, 15+ HP. 2♣ = enfarget (6+ kort): makker melder 2♦ for å spørre, innmelder passer med ruter eller viser fargen. 2♦ = begge majorer (5-4 eller lengre): makker velger major (hopp er invitt, 10-12). 2♥/2♠ = 5+ i den majoren og en 4+ minor: makker passer, høyer eller melder 2NT for å spørre om minoren. 2NT = begge minorer (5-5): makker velger.'],
    j2nt: ['Jacoby 2NT', '2NT over majoråpning = 4+ korts støtte, 13+ poeng, krav til utgang. Åpner: 3 i ny farge = singelton eller renons; 4 i ny farge = god femkorts sidefarge; 3 i majoren = 18+ uten korthet; 3NT = 15-17 uten korthet; 4 i majoren = minimum.'],
    wjs: ['Svake hoppskift', 'Et enkelt hopp i ny farge av svarer (f.eks. 1♦–2♠, 1♣–2♥) viser 6+ korts farge og svak hånd (0-5 HP). Det er for å spille; åpner passer. Ikke etter motpartens dobling.'],
    stayman: ['Stayman', '2♣ over 1NT (3♣ over 2NT) spør etter firekorts major. Svar: ♦ = ingen firekorts major, ♥ = fire hjerter, ♠ = fire spar og ikke fire hjerter. Etter 2♦ er 2♥/2♠ = fem i den majoren + fire i den andre, invitt. Melder svarer NT over 2♥, melder åpner med fire spar dem også.'],
    fourWay: ['Firevegs overføringer', 'Over 1NT: 2♦ → hjerter, 2♥ → spar (Jacoby), 2♠ → kløver (åpner melder 3♣), 2NT → ruter (åpner melder 3♦). Balanserte invitter går via 2♣ Stayman.'],
    smolen: ['Smolen', 'Etter 1NT–2♣–2♦ melder en hånd med utgangskrav og 5-4 i majorene firekortsmajoren på tretrinnet: 3♥ = 4♥ + 5♠, 3♠ = 4♠ + 5♥, slik at den sterke hånden blir spillefører.'],
    michaels: ['Michaels cue bid / Unusual 2NT', 'Direkte cue bid av motpartens åpning på ett viser 5-5 tofarget, 7+ HP: over minor begge majorer; over major den andre majoren og en minor (makker melder 2NT for å spørre om minoren). Hopp til 2NT (Unusual) viser de to laveste umeldte fargene. Makker velger farge; med tilpasning og 10+ kan han hoppe til utgang.'],
    splinter: ['Splinter', 'Dobbelt hopp i ny farge over majoråpning (f.eks. 1♠–4♥, 1♥–3♠) = 4+ korts støtte, singelton eller renons i fargen, 11-15 HP, krav til utgang, slaminteresse. Åpner stopper i 4 i majoren eller undersøker slem.'],
    texas: ['Texas-overføringer', 'Over 1NT/2NT: 4♦ → 4♥, 4♥ → 4♠. 6+ korts major med utgangsverdier; den sterke hånden (åpner) spiller.'],
    texasInt: ['Texas etter innblanding', 'Texas gjelder også når motparten dobler vår 1NT eller melder inn på to- eller tretrinnet: 4♦ → hjerter, 4♥ → spar. En melding i motpartens farge er ikke overføring (etter innmelding 2♥ er 4♥ cue bid og 4♦ viser fortsatt hjerter). Åpner fullfører overføringen.'],
    leb: ['Lebensohl', 'Når vår 1NT får innmelding på totrinnet: 2NT tvinger åpner til å melde 3♣ (for å stoppe i en farge eller vise sakte). Direkte farge på tretrinnet er krav. Direkte 3NT benekter stopper; 2NT og så 3NT viser stopper. Cue bid i deres farge er Stayman: direkte = uten stopper, via 2NT = med stopper («fast denies»).'],
    lav: ['Lavinthal-avkast', 'Forsvarsmarkering. Fargen du kaster er den du ikke vil ha; et høyt kort ber om den høyeste av de to andre fargene, et lavt kort om den laveste (trumf og fargen som spilles regnes ikke). På makkers utspill oppmuntrer et høyt kort, det laveste avviser.'],
    invMin: ['Omvendte minorhøyninger', 'Fra en hånd som ikke har passet over 1♣/1♦: høyning til 2 i minoren er sterk (10+ poeng, 4+ støtte, 5+ i kløver, ingen firekorts major) og krav i én runde; åpner melder 2NT med balansert minimum, viser stoppere med ekstra eller melder 3 i minoren med minimum. Hopphøyning til 3 er sperre (0-9 poeng, 5+ støtte).'],
    drury: ['Drury', 'Omvendt Drury. En passet hånd svarer på makkers 1♥/1♠ i tredje/fjerde hånd med 2♣ = 3+ korts støtte og 10-12 poeng. Åpner melder 2 i majoren med lett eller minimum åpning (ingen utgang) og 4 i majoren med full åpning.'],
    nmf: ['Ny minor krav', 'Etter 1m–1M–1NT er svarers 2 i den andre minoren kunstig og krav (11+): den spør åpner om trekorts støtte i svarers major eller den andre firekortsmajoren.'],
    fsf: ['Fjerde farge krav', 'Når vår side har meldt tre farger, er svarers melding i fjerde farge kunstig og krav til utgang; den ber åpner beskrive mer (stopper, støtte eller ekstra lengde).'],
    ogust: ['Ogust', 'Over makkers svake to spør 2NT: 3♣ = minimum, dårlig farge; 3♦ = minimum, god farge; 3♥ = maksimum, dårlig farge; 3♠ = maksimum, god farge; 3NT = solid farge (AKD).'],
    supx: ['Støttedobling', 'Etter 1m–(P)–1M–(innmelding under 2M) viser åpners dobling nøyaktig trekorts støtte i svarers major; direkte høyning viser fire.'],
    respx: ['Responsiv dobling', 'Etter deres åpning, makkers opplysningsdobling og deres høyning er en dobling fra makker opplysende: 8+ poeng og begge umeldte farger (vanligvis majorene), uten en klar melding.'],
    sjs: ['Sterke hoppskift', 'Et enkelt hopp i ny farge av svarer viser sterk hånd (19+ poeng) med god farge og slaminteresse. Erstatter svake hoppskift.'],
    dont: ['DONT', 'Disturb Opponents’ Notrump (Marty Bergen). Over deres 1NT: X = enfarget (6+), makker melder 2♣ for å spørre; 2♣ = kløver og en høyere farge; 2♦ = ruter og en major; 2♥ = begge majorer; 2♠ = bare spar (naturlig). Makker passer med toleranse eller melder neste farge (pass eller rett). Erstatter Cappelletti.'],
    jtr: ['Jacoby-overføring', 'Over 1NT ber 2♦ åpner melde hjerter og 2♥ spar, slik at den sterke hånden spiller. Med firekorts støtte og maksimum (17) superaksepterer åpner på tretrinnet. Etter overføringen er ny farge på tretrinnet naturlig og krav til utgang.'],
    bw: ['Blackwood', '4NT spør etter ess: 5♣ = 0 eller 4, 5♦ = 1, 5♥ = 2, 5♠ = 3.'],
    q: ['Kvantitativ 4NT', 'Etter en grandmelding spør ikke 4NT etter ess; den inviterer til slem. Makker melder 6NT med maksimum.'],
    nego: ['Negativ dobling', 'Når makker har åpnet og motparten melder inn, er dobling ikke straff: den viser fire kort i den umeldte majoren og nok verdier til å melde.'],
    takeout: ['Opplysningsdobling', 'Dobling av en åpning: åpningsverdier, korthet i deres farge og støtte i de andre fargene. Makker må melde.'],
    weak2: ['Svak to', 'Åpning 2♦/2♥/2♠: god sekskortsfarge, 5-10 HP. En sperreåpning.'],
    strong2c: ['Sterk 2♣', 'Åpning 2♣: 22+ HP eller tilsvarende spillestyrke, kunstig og krav til utgang. 2♦ er ventesvaret. Etter 2♣–2♦–2♥/2♠ er 3♣ andre negativ (0-3 HP); 2♣–2♦–2NT (22-24) meldes som en 2NT-åpning (Stayman og overføringer gjelder).'],
    cue: ['Cue bid', 'Å melde motpartens farge er ikke naturlig: det viser støtte for makker med invitt eller mer og er krav.'],
    nt1: ['1NT-åpning', '15-17 HP, balansert.'],
    pre: ['Sperremelding', 'Åpning på tre- eller firetrinnet: lang farge (7+) og svak hånd, som tar meldeplass fra motparten.'],
    runout: ['Flukt når 1NT dobles', 'Når vår 1NT dobles, flykter en svak svarer til en 5+ korts farge; redobling viser verdier (9+).'],
  },
  es: {
    twoOverOne: ['2/1 forcing a manga', 'Desde una mano que no ha pasado, un palo nuevo a nivel de dos sobre la apertura de uno del compañero (salvo 1♣–2♦; 1♠–2♥ muestra cinco corazones) es forcing a manga, 12+ PH. Sobre 1♥/1♠, 1SA es forcing una vuelta (6-12 PH): el abridor redeclara un menor de tres cartas si no tiene otra cosa; el salto posterior del respondedor a 3 del mayor muestra un apoyo límite de tres cartas. La respuesta a nivel de dos de una mano pasada no es forcing.'],
    rkc: ['RKCB 1430', '4SA pregunta por cinco cartas clave (cuatro ases + rey de triunfo). 5♣ = 1 o 4, 5♦ = 3 o 0, 5♥ = 2 sin la dama de triunfo, 5♠ = 2 con la dama de triunfo.'],
    gerber: ['Gerber', 'Directamente sobre 1SA/2SA, 4♣ pregunta por ases. 4♦ = 0 o 4, 4♥ = 1, 4♠ = 2, 4SA = 3. El que pregunta puede pararse en 4SA.'],
    bergen: ['Apoyos Bergen', 'Sobre 1♥/1♠ (no tras doblo o intervención): 3♣ = apoyo de cuatro cartas, 7-9 puntos; 3♦ = apoyo de cuatro cartas, 10-12 (apoyo límite); 3 del mayor = apoyo de cuatro cartas, 0-6 (preventivo). Con apoyo de cuatro y 13+, se usa Jacoby 2SA o un splinter. El apoyo simple muestra tres cartas, 6-9; el apoyo límite de tres cartas pasa por el 1SA forcing.'],
    capp: ['Cappelletti', 'Sobre el 1SA rival (en directa): X = castigo, 15+ PH. 2♣ = monocolor (6+ cartas): el compañero dice 2♦ para preguntar y el interventor pasa con diamantes o nombra su palo. 2♦ = ambos mayores (5-4 o más): el compañero elige mayor (un salto es invitación, 10-12). 2♥/2♠ = 5+ en ese mayor y un menor de 4+: el compañero pasa, apoya o dice 2SA para preguntar el menor. 2SA = ambos menores (5-5): el compañero elige.'],
    j2nt: ['Jacoby 2SA', '2SA sobre apertura de mayor = apoyo de 4+ cartas, 13+ puntos, forcing a manga. Abridor: 3 de un palo nuevo = semifallo o fallo; 4 de un palo nuevo = buen palo lateral de cinco; 3 del mayor = 18+ sin cortos; 3SA = 15-17 sin cortos; 4 del mayor = mínimo.'],
    wjs: ['Saltos débiles en palo nuevo', 'Un salto simple en palo nuevo del respondedor (p. ej. 1♦–2♠, 1♣–2♥) muestra un palo de 6+ cartas y mano débil (0-5 PH). Es para jugar; el abridor pasa. No tras un doblo rival.'],
    stayman: ['Stayman', '2♣ sobre 1SA (3♣ sobre 2SA) pregunta por un mayor de cuatro cartas. Respuestas: ♦ = sin mayor de cuatro, ♥ = cuatro corazones, ♠ = cuatro picas y no cuatro corazones. Tras 2♦, 2♥/2♠ = cinco en ese mayor + cuatro en el otro, invitación. Si el respondedor dice SA sobre 2♥, el abridor con cuatro picas también las dice.'],
    fourWay: ['Transferencias a cuatro palos', 'Sobre 1SA: 2♦ → corazones, 2♥ → picas (Jacoby), 2♠ → tréboles (el abridor dice 3♣), 2SA → diamantes (el abridor dice 3♦). Las invitaciones equilibradas pasan por 2♣ Stayman.'],
    smolen: ['Smolen', 'Tras 1SA–2♣–2♦, una mano forcing a manga con 5-4 en mayores dice su mayor de cuatro a nivel de tres: 3♥ = 4♥ + 5♠, 3♠ = 4♠ + 5♥, para que juegue la mano fuerte.'],
    michaels: ['Cue bid Michaels / 2SA inusual', 'Un cue bid directo de su apertura de uno muestra un bicolor 5-5, 7+ PH: sobre un menor, ambos mayores; sobre un mayor, el otro mayor y un menor (el compañero dice 2SA para preguntar el menor). Un salto a 2SA (inusual) muestra los dos palos más bajos no nombrados. El compañero elige palo; con ajuste y 10+ puede saltar a manga.'],
    splinter: ['Splinters', 'Doble salto en palo nuevo sobre apertura de mayor (p. ej. 1♠–4♥, 1♥–3♠) = apoyo de 4+ cartas, semifallo o fallo en el palo nombrado, 11-15 PH, forcing a manga, interés de slam. El abridor se para en 4 del mayor o explora el slam.'],
    texas: ['Transferencias Texas', 'Sobre 1SA/2SA: 4♦ → 4♥, 4♥ → 4♠. Mayor de 6+ cartas con valores de manga; juega la mano fuerte (el abridor).'],
    texasInt: ['Texas tras intervención', 'Las Texas siguen vigentes cuando los rivales doblan nuestro 1SA o intervienen a nivel de dos o tres: 4♦ → corazones, 4♥ → picas. Una voz en el palo rival no es transferencia (tras una intervención de 2♥, 4♥ es cue bid y 4♦ sigue mostrando corazones). El abridor completa la transferencia.'],
    leb: ['Lebensohl', 'Cuando intervienen a nivel de dos sobre nuestro 1SA: 2SA obliga al abridor a decir 3♣ (para pararse en un palo o mostrar despacio). Un palo directo a nivel de tres es forcing. 3SA directo niega parada; 2SA y luego 3SA la muestra. El cue bid de su palo es Stayman: directo = sin parada, vía 2SA = con parada («rápido niega»).'],
    lav: ['Descartes Lavinthal', 'Señales en defensa. El palo que descartas es el que no quieres; una carta alta pide el más alto de los otros dos palos, una baja el más bajo (no cuentan el triunfo ni el palo jugado). En la salida del compañero, una carta alta anima y la más baja desanima.'],
    invMin: ['Menores invertidos', 'Desde una mano no pasada sobre 1♣/1♦: el apoyo a 2 del menor es fuerte (10+ puntos, 4+ de apoyo, 5+ en tréboles, sin mayor de cuatro) y forcing una vuelta; el abridor dice 2SA con mínimo equilibrado, muestra paradas con extras o repite 3 del menor con mínimo. El apoyo con salto a 3 es preventivo (0-9 puntos, 5+ de apoyo).'],
    drury: ['Drury', 'Drury inverso. Una mano pasada responde al 1♥/1♠ del compañero en tercera/cuarta posición con 2♣ = apoyo de 3+ cartas y 10-12 puntos. El abridor repite 2 del mayor con una apertura ligera o mínima (sin manga) y dice 4 del mayor con una apertura completa.'],
    nmf: ['Nuevo menor forcing', 'Tras 1m–1M–1SA, 2 del otro menor del respondedor es artificial y forcing (11+): pide al abridor apoyo de tres cartas en el mayor del respondedor o el otro mayor de cuatro.'],
    fsf: ['Cuarto palo forcing', 'Cuando nuestro bando ha nombrado tres palos, la voz del respondedor en el cuarto palo es artificial y forcing a manga; pide al abridor que se describa más (parada, apoyo o longitud extra).'],
    ogust: ['Ogust', 'Sobre el dos débil del compañero, 2SA pregunta: 3♣ = mínimo, palo malo; 3♦ = mínimo, palo bueno; 3♥ = máximo, palo malo; 3♠ = máximo, palo bueno; 3SA = palo sólido (AKQ).'],
    supx: ['Doblo de apoyo', 'Tras 1m–(P)–1M–(intervención por debajo de 2M), el doblo del abridor muestra exactamente tres cartas de apoyo en el mayor del respondedor; el apoyo directo muestra cuatro.'],
    respx: ['Doblo responsivo', 'Tras su apertura, el doblo informativo del compañero y su apoyo, un doblo del compañero del doblador es informativo: 8+ puntos y los dos palos no nombrados (normalmente los mayores), sin una voz clara.'],
    sjs: ['Saltos fuertes en palo nuevo', 'Un salto simple en palo nuevo del respondedor muestra una mano fuerte (19+ puntos) con buen palo e interés de slam. Sustituye a los saltos débiles.'],
    dont: ['DONT', 'Disturb Opponents’ Notrump (Marty Bergen). Sobre su 1SA: X = monocolor (6+), el compañero dice 2♣ para preguntar; 2♣ = tréboles y un palo superior; 2♦ = diamantes y un mayor; 2♥ = ambos mayores; 2♠ = solo picas (natural). El compañero pasa con tolerancia o dice el palo siguiente (pasa o corrige). Sustituye a Cappelletti.'],
    jtr: ['Transferencia Jacoby', 'Sobre 1SA, 2♦ pide al abridor que diga corazones y 2♥ que diga picas, para que juegue la mano fuerte. Con apoyo de cuatro y máximo (17) el abridor superacepta a nivel de tres. Tras la transferencia, un palo nuevo a nivel de tres es natural y forcing a manga.'],
    bw: ['Blackwood', '4SA pregunta por ases: 5♣ = 0 o 4, 5♦ = 1, 5♥ = 2, 5♠ = 3.'],
    q: ['4SA cuantitativo', 'Tras una voz de sin triunfo, 4SA no pregunta ases; invita a slam. El compañero dice 6SA con máximo.'],
    nego: ['Doblo negativo', 'Cuando el compañero abre y el rival interviene, el doblo no es de castigo: muestra cuatro cartas en el mayor no nombrado y valores para hablar.'],
    takeout: ['Doblo informativo', 'Doblo de una apertura: valores de apertura, corto en su palo y apoyo en los otros palos. El compañero debe hablar.'],
    weak2: ['Dos débil', 'Apertura de 2♦/2♥/2♠: buen palo de seis cartas, 5-10 PH. Apertura preventiva.'],
    strong2c: ['2♣ fuerte', 'Apertura de 2♣: 22+ PH o fuerza de juego equivalente, artificial y forcing a manga. 2♦ es la respuesta de espera. Tras 2♣–2♦–2♥/2♠, 3♣ es el segundo negativo (0-3 PH); 2♣–2♦–2SA (22-24) se juega como una apertura de 2SA (Stayman y transferencias).'],
    cue: ['Cue bid', 'Nombrar el palo rival no es natural: muestra apoyo para el compañero con apoyo límite o más y es forcing.'],
    nt1: ['Apertura de 1SA', '15-17 PH, equilibrada.'],
    pre: ['Preventiva', 'Apertura a nivel de tres o cuatro: palo largo (7+) y mano débil, que quita espacio de subasta a los rivales.'],
    runout: ['Escape tras 1SA doblado', 'Cuando doblan nuestro 1SA, un respondedor débil escapa a un palo de 5+ cartas; el redoblo muestra valores (9+).'],
  },
  fr: {
    twoOverOne: ['2/1 forcing de manche', 'D’une main non passée, une couleur nouvelle au palier de deux sur l’ouverture d’un du partenaire (sauf 1♣–2♦ ; 1♠–2♥ montre cinq cœurs) est forcing de manche, 12+ H. Sur 1♥/1♠, 1SA est forcing un tour (6-12 H) : l’ouvreur annonce une mineure de trois cartes s’il n’a rien d’autre ; le saut ultérieur du répondant à 3 dans la majeure montre un soutien limite de trois cartes. La réponse au palier de deux d’une main passée n’est pas forcing.'],
    rkc: ['RKCB 1430', '4SA demande cinq clés (quatre as + roi d’atout). 5♣ = 1 ou 4, 5♦ = 3 ou 0, 5♥ = 2 sans la dame d’atout, 5♠ = 2 avec la dame d’atout.'],
    gerber: ['Gerber', 'Directement sur 1SA/2SA, 4♣ demande les as. 4♦ = 0 ou 4, 4♥ = 1, 4♠ = 2, 4SA = 3. Celui qui demande peut s’arrêter à 4SA.'],
    bergen: ['Soutiens Bergen', 'Sur 1♥/1♠ (pas après un contre ou une intervention) : 3♣ = soutien de quatre cartes, 7-9 points ; 3♦ = soutien de quatre cartes, 10-12 (soutien limite) ; 3 dans la majeure = soutien de quatre cartes, 0-6 (barrage). Avec quatre cartes et 13+, on utilise Jacoby 2SA ou un splinter. Le soutien simple montre trois cartes, 6-9 ; le soutien limite à trois cartes passe par le 1SA forcing.'],
    capp: ['Cappelletti', 'Sur le 1SA adverse (en direct) : X = punitif, 15+ H. 2♣ = unicolore (6+ cartes) : le partenaire dit 2♦ pour demander, l’intervenant passe avec les carreaux ou nomme sa couleur. 2♦ = les deux majeures (5-4 ou plus) : le partenaire choisit une majeure (un saut est invitationnel, 10-12). 2♥/2♠ = 5+ dans cette majeure et une mineure de 4+ : le partenaire passe, soutient ou dit 2SA pour demander la mineure. 2SA = les deux mineures (5-5) : le partenaire choisit.'],
    j2nt: ['Jacoby 2SA', '2SA sur une ouverture en majeure = soutien de 4+ cartes, 13+ points, forcing de manche. Ouvreur : 3 dans une couleur nouvelle = singleton ou chicane ; 4 dans une couleur nouvelle = belle couleur annexe de cinq ; 3 dans la majeure = 18+ sans courte ; 3SA = 15-17 sans courte ; 4 dans la majeure = minimum.'],
    wjs: ['Sauts faibles', 'Un saut simple du répondant dans une couleur nouvelle (p. ex. 1♦–2♠, 1♣–2♥) montre une couleur de 6+ cartes et une main faible (0-5 H). C’est pour jouer ; l’ouvreur passe. Pas après un contre adverse.'],
    stayman: ['Stayman', '2♣ sur 1SA (3♣ sur 2SA) demande une majeure de quatre cartes. Réponses : ♦ = pas de majeure quatrième, ♥ = quatre cœurs, ♠ = quatre piques et pas quatre cœurs. Après 2♦, 2♥/2♠ = cinq dans cette majeure + quatre dans l’autre, invitationnel. Si le répondant dit SA sur 2♥, l’ouvreur avec quatre piques les annonce aussi.'],
    fourWay: ['Transferts à quatre couleurs', 'Sur 1SA : 2♦ → cœurs, 2♥ → piques (Jacoby), 2♠ → trèfles (l’ouvreur dit 3♣), 2SA → carreaux (l’ouvreur dit 3♦). Les invitations régulières passent par 2♣ Stayman.'],
    smolen: ['Smolen', 'Après 1SA–2♣–2♦, une main forcing de manche avec 5-4 en majeures annonce sa majeure quatrième au palier de trois : 3♥ = 4♥ + 5♠, 3♠ = 4♠ + 5♥, pour que la main forte joue.'],
    michaels: ['Cue-bid Michaels / 2SA unusual', 'Un cue-bid direct de leur ouverture d’un montre un bicolore 5-5, 7+ H : sur une mineure, les deux majeures ; sur une majeure, l’autre majeure et une mineure (le partenaire dit 2SA pour demander la mineure). Un saut à 2SA (unusual) montre les deux couleurs non nommées les plus basses. Le partenaire choisit ; avec un fit et 10+ il peut sauter à la manche.'],
    splinter: ['Splinters', 'Double saut dans une couleur nouvelle sur une ouverture en majeure (p. ex. 1♠–4♥, 1♥–3♠) = soutien de 4+ cartes, singleton ou chicane dans la couleur nommée, 11-15 H, forcing de manche, intérêt de chelem. L’ouvreur s’arrête à 4 dans la majeure ou explore le chelem.'],
    texas: ['Texas', 'Sur 1SA/2SA : 4♦ → 4♥, 4♥ → 4♠. Majeure de 6+ cartes avec valeurs de manche ; la main forte (l’ouvreur) joue.'],
    texasInt: ['Texas après intervention', 'Les Texas restent en vigueur quand les adversaires contrent notre 1SA ou interviennent au palier de deux ou trois : 4♦ → cœurs, 4♥ → piques. Une enchère dans leur couleur n’est pas un transfert (après une intervention à 2♥, 4♥ est un cue-bid et 4♦ montre toujours les cœurs). L’ouvreur complète le transfert.'],
    leb: ['Lebensohl', 'Quand notre 1SA subit une intervention au palier de deux : 2SA oblige l’ouvreur à dire 3♣ (pour s’arrêter dans une couleur ou montrer lentement). Une couleur directe au palier de trois est forcing. 3SA direct nie l’arrêt ; 2SA puis 3SA le montre. Le cue-bid de leur couleur est un Stayman : direct = sans arrêt, via 2SA = avec arrêt (« vite nie »).'],
    lav: ['Défausses Lavinthal', 'Signalisation en défense. La couleur défaussée est celle que vous ne voulez pas ; une carte haute demande la plus haute des deux autres couleurs, une basse la plus basse (l’atout et la couleur jouée ne comptent pas). Sur l’entame du partenaire, une carte haute encourage, la plus basse décourage.'],
    invMin: ['Mineures inversées', 'D’une main non passée sur 1♣/1♦ : le soutien à 2 de la mineure est fort (10+ points, 4+ cartes de soutien, 5+ à trèfle, pas de majeure quatrième) et forcing un tour ; l’ouvreur dit 2SA avec un minimum régulier, montre ses arrêts avec du supplément ou répète 3 de la mineure avec un minimum. Le soutien à saut à 3 est un barrage (0-9 points, 5+ cartes de soutien).'],
    drury: ['Drury', 'Drury inversé. Une main passée répond au 1♥/1♠ du partenaire en troisième/quatrième position par 2♣ = soutien de 3+ cartes et 10-12 points. L’ouvreur répète 2 dans la majeure avec une ouverture légère ou minimale (pas de manche) et dit 4 dans la majeure avec une ouverture complète.'],
    nmf: ['Nouvelle mineure forcing', 'Après 1m–1M–1SA, 2 dans l’autre mineure du répondant est artificiel et forcing (11+) : il demande à l’ouvreur un soutien de trois cartes dans la majeure du répondant ou l’autre majeure quatrième.'],
    fsf: ['Quatrième couleur forcing', 'Quand notre camp a nommé trois couleurs, l’enchère du répondant dans la quatrième couleur est artificielle et forcing de manche ; elle demande à l’ouvreur de se décrire davantage (arrêt, soutien ou longueur supplémentaire).'],
    ogust: ['Ogust', 'Sur le deux faible du partenaire, 2SA demande : 3♣ = minimum, mauvaise couleur ; 3♦ = minimum, bonne couleur ; 3♥ = maximum, mauvaise couleur ; 3♠ = maximum, bonne couleur ; 3SA = couleur solide (ARD).'],
    supx: ['Contre de soutien', 'Après 1m–(P)–1M–(intervention sous 2M), le contre de l’ouvreur montre exactement trois cartes de soutien dans la majeure du répondant ; le soutien direct en montre quatre.'],
    respx: ['Contre spoutnik de réponse', 'Après leur ouverture, le contre d’appel du partenaire et leur soutien, un contre du partenaire du contreur est d’appel : 8+ points et les deux couleurs non nommées (en général les majeures), sans enchère claire.'],
    sjs: ['Sauts forts', 'Un saut simple du répondant dans une couleur nouvelle montre une main forte (19+ points) avec une belle couleur et un intérêt de chelem. Remplace les sauts faibles.'],
    dont: ['DONT', 'Disturb Opponents’ Notrump (Marty Bergen). Sur leur 1SA : X = unicolore (6+), le partenaire dit 2♣ pour demander ; 2♣ = trèfles et une couleur plus haute ; 2♦ = carreaux et une majeure ; 2♥ = les deux majeures ; 2♠ = piques seulement (naturel). Le partenaire passe avec une tolérance ou dit la couleur suivante (passe ou corrige). Remplace Cappelletti.'],
    jtr: ['Transfert Jacoby', 'Sur 1SA, 2♦ demande à l’ouvreur de dire cœur et 2♥ pique, pour que la main forte joue. Avec quatre cartes de soutien et un maximum (17), l’ouvreur super-accepte au palier de trois. Après le transfert, une couleur nouvelle au palier de trois est naturelle et forcing de manche.'],
    bw: ['Blackwood', '4SA demande les as : 5♣ = 0 ou 4, 5♦ = 1, 5♥ = 2, 5♠ = 3.'],
    q: ['4SA quantitatif', 'Après une enchère à sans-atout, 4SA ne demande pas les as ; il invite au chelem. Le partenaire dit 6SA avec un maximum.'],
    nego: ['Contre négatif', 'Quand le partenaire ouvre et que l’adversaire intervient, le contre n’est pas punitif : il montre quatre cartes dans la majeure non nommée et assez de valeurs pour parler.'],
    takeout: ['Contre d’appel', 'Contre d’une ouverture : valeurs d’ouverture, courte dans leur couleur et soutien dans les autres couleurs. Le partenaire doit parler.'],
    weak2: ['Deux faible', 'Ouverture de 2♦/2♥/2♠ : belle couleur de six cartes, 5-10 H. Une ouverture de barrage.'],
    strong2c: ['2♣ fort', 'Ouverture de 2♣ : 22+ H ou force de jeu équivalente, artificielle et forcing de manche. 2♦ est la réponse d’attente. Après 2♣–2♦–2♥/2♠, 3♣ est le second négatif (0-3 H) ; 2♣–2♦–2SA (22-24) se joue comme une ouverture de 2SA (Stayman et transferts).'],
    cue: ['Cue-bid', 'Nommer la couleur adverse n’est pas naturel : cela montre un soutien pour le partenaire avec un soutien limite ou plus, et c’est forcing.'],
    nt1: ['Ouverture de 1SA', '15-17 H, régulière.'],
    pre: ['Barrage', 'Ouverture au palier de trois ou quatre : couleur longue (7+) et main faible, qui prend de l’espace d’enchères aux adversaires.'],
    runout: ['Fuite après 1SA contré', 'Quand notre 1SA est contré, un répondant faible fuit dans une couleur de 5+ cartes ; le surcontre montre des valeurs (9+).'],
  },
  it: {
    twoOverOne: ['2/1 forzante manche', 'Da una mano non passata, un colore nuovo a livello di due sull’apertura a livello di uno del compagno (tranne 1♣–2♦; 1♠–2♥ mostra cinque cuori) è forzante manche, 12+ PO. Su 1♥/1♠, 1SA è forzante per un giro (6-12 PO): l’apritore ridichiara una minore di tre carte se non ha altro; il successivo salto del rispondente a 3 nella maggiore mostra un appoggio limite di tre carte. La risposta a livello di due di una mano passata non è forzante.'],
    rkc: ['RKCB 1430', '4SA chiede cinque carte chiave (quattro assi + re di atout). 5♣ = 1 o 4, 5♦ = 3 o 0, 5♥ = 2 senza la donna di atout, 5♠ = 2 con la donna di atout.'],
    gerber: ['Gerber', 'Direttamente su 1SA/2SA, 4♣ chiede gli assi. 4♦ = 0 o 4, 4♥ = 1, 4♠ = 2, 4SA = 3. Chi chiede può fermarsi a 4SA.'],
    bergen: ['Appoggi Bergen', 'Su 1♥/1♠ (non dopo contro o intervento): 3♣ = appoggio di quattro carte, 7-9 punti; 3♦ = appoggio di quattro, 10-12 (appoggio limite); 3 nella maggiore = appoggio di quattro, 0-6 (sbarramento). Con quattro carte e 13+ si usa Jacoby 2SA o uno splinter. L’appoggio semplice mostra tre carte, 6-9; l’appoggio limite con tre carte passa dall’1SA forzante.'],
    capp: ['Cappelletti', 'Sull’1SA avversario (in diretta): X = punitivo, 15+ PO. 2♣ = monocolore (6+ carte): il compagno dice 2♦ per chiedere, l’interveniente passa con i quadri o nomina il colore. 2♦ = entrambe le maggiori (5-4 o più): il compagno sceglie una maggiore (un salto è invitante, 10-12). 2♥/2♠ = 5+ in quella maggiore e una minore di 4+: il compagno passa, appoggia o dice 2SA per chiedere la minore. 2SA = entrambe le minori (5-5): il compagno sceglie.'],
    j2nt: ['Jacoby 2SA', '2SA su un’apertura di maggiore = appoggio di 4+ carte, 13+ punti, forzante manche. Apritore: 3 in un colore nuovo = singolo o vuoto; 4 in un colore nuovo = buon colore laterale di cinque; 3 nella maggiore = 18+ senza corte; 3SA = 15-17 senza corte; 4 nella maggiore = minimo.'],
    wjs: ['Salti deboli', 'Un salto semplice del rispondente in un colore nuovo (es. 1♦–2♠, 1♣–2♥) mostra un colore di 6+ carte e una mano debole (0-5 PO). È per giocare; l’apritore passa. Non dopo un contro avversario.'],
    stayman: ['Stayman', '2♣ su 1SA (3♣ su 2SA) chiede una maggiore quarta. Risposte: ♦ = nessuna maggiore quarta, ♥ = quattro cuori, ♠ = quattro picche e non quattro cuori. Dopo 2♦, 2♥/2♠ = cinque in quella maggiore + quattro nell’altra, invitante. Se il rispondente dice SA su 2♥, l’apritore con quattro picche le dichiara.'],
    fourWay: ['Transfer a quattro vie', 'Su 1SA: 2♦ → cuori, 2♥ → picche (Jacoby), 2♠ → fiori (l’apritore dice 3♣), 2SA → quadri (l’apritore dice 3♦). Gli inviti bilanciati passano per 2♣ Stayman.'],
    smolen: ['Smolen', 'Dopo 1SA–2♣–2♦, una mano forzante manche con 5-4 nelle maggiori dice la maggiore quarta a livello di tre: 3♥ = 4♥ + 5♠, 3♠ = 4♠ + 5♥, così gioca la mano forte.'],
    michaels: ['Cue bid Michaels / 2SA unusual', 'Una surlicita diretta della loro apertura a livello di uno mostra un bicolore 5-5, 7+ PO: su una minore, le due maggiori; su una maggiore, l’altra maggiore e una minore (il compagno dice 2SA per chiedere la minore). Un salto a 2SA (unusual) mostra i due colori più bassi non dichiarati. Il compagno sceglie; con fit e 10+ può saltare a manche.'],
    splinter: ['Splinter', 'Doppio salto in un colore nuovo su un’apertura di maggiore (es. 1♠–4♥, 1♥–3♠) = appoggio di 4+ carte, singolo o vuoto nel colore nominato, 11-15 PO, forzante manche, interesse di slam. L’apritore si ferma a 4 nella maggiore o esplora lo slam.'],
    texas: ['Texas', 'Su 1SA/2SA: 4♦ → 4♥, 4♥ → 4♠. Maggiore di 6+ carte con valori di manche; gioca la mano forte (l’apritore).'],
    texasInt: ['Texas dopo intervento', 'Le Texas restano valide quando gli avversari contrano il nostro 1SA o intervengono a livello di due o tre: 4♦ → cuori, 4♥ → picche. Una dichiarazione nel loro colore non è un transfer (dopo un intervento di 2♥, 4♥ è una surlicita e 4♦ mostra ancora cuori). L’apritore completa il transfer.'],
    leb: ['Lebensohl', 'Quando il nostro 1SA subisce un intervento a livello di due: 2SA obbliga l’apritore a dire 3♣ (per fermarsi in un colore o mostrare lentamente). Un colore diretto a livello di tre è forzante. 3SA diretto nega il fermo; 2SA e poi 3SA lo mostra. La surlicita del loro colore è Stayman: diretta = senza fermo, via 2SA = con fermo («fast denies»).'],
    lav: ['Scarti Lavinthal', 'Segnali in difesa. Il colore scartato è quello che non vuoi; una carta alta chiede il più alto degli altri due colori, una bassa il più basso (atout e colore giocato esclusi). Sull’attacco del compagno una carta alta incoraggia, la più bassa scoraggia.'],
    invMin: ['Minori invertite', 'Da una mano non passata su 1♣/1♦: l’appoggio a 2 della minore è forte (10+ punti, 4+ carte, 5+ a fiori, nessuna maggiore quarta) e forzante per un giro; l’apritore dice 2SA con un minimo bilanciato, mostra i fermi con extra o ripete 3 della minore con un minimo. L’appoggio a salto a 3 è di sbarramento (0-9 punti, 5+ carte).'],
    drury: ['Drury', 'Drury inverso. Una mano passata risponde all’1♥/1♠ del compagno in terza/quarta posizione con 2♣ = appoggio di 3+ carte e 10-12 punti. L’apritore ripete 2 nella maggiore con un’apertura leggera o minima (niente manche) e dice 4 nella maggiore con un’apertura piena.'],
    nmf: ['Nuova minore forzante', 'Dopo 1m–1M–1SA, 2 nell’altra minore del rispondente è artificiale e forzante (11+): chiede all’apritore un appoggio di tre carte nella maggiore del rispondente o l’altra maggiore quarta.'],
    fsf: ['Quarto colore forzante', 'Quando la nostra linea ha nominato tre colori, la dichiarazione del rispondente nel quarto colore è artificiale e forzante manche; chiede all’apritore di descriversi meglio (fermo, appoggio o lunghezza extra).'],
    ogust: ['Ogust', 'Sulla sottoapertura debole del compagno, 2SA chiede: 3♣ = minimo, colore brutto; 3♦ = minimo, colore buono; 3♥ = massimo, colore brutto; 3♠ = massimo, colore buono; 3SA = colore solido (AKQ).'],
    supx: ['Contro di appoggio', 'Dopo 1m–(P)–1M–(intervento sotto 2M), il contro dell’apritore mostra esattamente tre carte di appoggio nella maggiore del rispondente; l’appoggio diretto ne mostra quattro.'],
    respx: ['Contro responsivo', 'Dopo la loro apertura, il contro informativo del compagno e il loro appoggio, un contro del compagno del contrante è informativo: 8+ punti e i due colori non dichiarati (di solito le maggiori), senza una dichiarazione chiara.'],
    sjs: ['Salti forti', 'Un salto semplice del rispondente in un colore nuovo mostra una mano forte (19+ punti) con un buon colore e interesse di slam. Sostituisce i salti deboli.'],
    dont: ['DONT', 'Disturb Opponents’ Notrump (Marty Bergen). Sul loro 1SA: X = monocolore (6+), il compagno dice 2♣ per chiedere; 2♣ = fiori e un colore più alto; 2♦ = quadri e una maggiore; 2♥ = entrambe le maggiori; 2♠ = solo picche (naturale). Il compagno passa con tolleranza o dice il colore successivo (passo o correzione). Sostituisce Cappelletti.'],
    jtr: ['Transfer Jacoby', 'Su 1SA, 2♦ chiede all’apritore di dire cuori e 2♥ picche, così gioca la mano forte. Con quattro carte di appoggio e un massimo (17) l’apritore super-accetta a livello di tre. Dopo il transfer, un colore nuovo a livello di tre è naturale e forzante manche.'],
    bw: ['Blackwood', '4SA chiede gli assi: 5♣ = 0 o 4, 5♦ = 1, 5♥ = 2, 5♠ = 3.'],
    q: ['4SA quantitativo', 'Dopo una dichiarazione a senza atout, 4SA non chiede gli assi; invita allo slam. Il compagno dice 6SA con un massimo.'],
    nego: ['Contro negativo', 'Quando il compagno apre e l’avversario interviene, il contro non è punitivo: mostra quattro carte nella maggiore non dichiarata e valori sufficienti per parlare.'],
    takeout: ['Contro informativo', 'Contro di un’apertura: valori d’apertura, corta nel loro colore e appoggio negli altri colori. Il compagno deve dichiarare.'],
    weak2: ['Sottoapertura debole', 'Apertura di 2♦/2♥/2♠: buon colore di sei carte, 5-10 PO. Un’apertura di sbarramento.'],
    strong2c: ['2♣ forte', 'Apertura di 2♣: 22+ PO o forza di gioco equivalente, artificiale e forzante manche. 2♦ è la risposta d’attesa. Dopo 2♣–2♦–2♥/2♠, 3♣ è il secondo negativo (0-3 PO); 2♣–2♦–2SA (22-24) si gioca come un’apertura di 2SA (Stayman e transfer).'],
    cue: ['Surlicita', 'Dichiarare il colore avversario non è naturale: mostra appoggio per il compagno con un appoggio limite o più ed è forzante.'],
    nt1: ['Apertura di 1SA', '15-17 PO, bilanciata.'],
    pre: ['Sbarramento', 'Apertura a livello di tre o quattro: colore lungo (7+) e mano debole, che toglie spazio di licita agli avversari.'],
    runout: ['Fuga dopo 1SA contrato', 'Quando il nostro 1SA viene contrato, un rispondente debole fugge in un colore di 5+ carte; il surcontro mostra valori (9+).'],
  },
  de: {
    twoOverOne: ['2/1 Partieforcing', 'Aus nicht gepasster Hand ist eine neue Farbe auf Zweierstufe nach Partners Eröffnung auf Einerstufe (außer 1♣–2♦; 1♠–2♥ zeigt fünf Coeur) partieforcierend, 12+ FP. Über 1♥/1♠ ist 1SA für eine Runde forcierend (6-12 FP): der Eröffner reizt mangels anderer Wahl eine Dreierfarbe in Unterfarbe; der spätere Sprung des Antwortenden auf 3 in der Oberfarbe zeigt eine Limit-Hebung mit drei Karten. Eine Zweierantwort aus gepasster Hand ist nicht forcierend.'],
    rkc: ['RKCB 1430', '4SA fragt nach fünf Schlüsselkarten (vier Asse + Trumpfkönig). 5♣ = 1 oder 4, 5♦ = 3 oder 0, 5♥ = 2 ohne Trumpfdame, 5♠ = 2 mit Trumpfdame.'],
    gerber: ['Gerber', 'Direkt über 1SA/2SA fragt 4♣ nach Assen. 4♦ = 0 oder 4, 4♥ = 1, 4♠ = 2, 4SA = 3. Der Fragende kann in 4SA stoppen.'],
    bergen: ['Bergen-Hebungen', 'Über 1♥/1♠ (nicht nach Kontra oder Gegenreizung): 3♣ = Vierer-Unterstützung, 7-9 Punkte; 3♦ = Vierer-Unterstützung, 10-12 (Limit-Hebung); 3 in der Oberfarbe = Vierer-Unterstützung, 0-6 (präemptiv). Mit vier Karten und 13+ nimmt man Jacoby 2SA oder einen Splinter. Die einfache Hebung zeigt drei Karten, 6-9; eine Limit-Hebung mit drei Karten geht über das forcierende 1SA.'],
    capp: ['Cappelletti', 'Über das gegnerische 1SA (direkt): X = Strafe, 15+ FP. 2♣ = Einfärber (6+ Karten): Partner fragt mit 2♦, der Gegenreizer passt mit Karo oder nennt die Farbe. 2♦ = beide Oberfarben (5-4 oder länger): Partner wählt eine Oberfarbe (ein Sprung ist einladend, 10-12). 2♥/2♠ = 5+ in dieser Oberfarbe und eine 4+ Unterfarbe: Partner passt, hebt oder fragt mit 2SA nach der Unterfarbe. 2SA = beide Unterfarben (5-5): Partner wählt.'],
    j2nt: ['Jacoby 2SA', '2SA über eine Oberfarberöffnung = 4+ Unterstützung, 13+ Punkte, partieforcierend. Eröffner: 3 in neuer Farbe = Single oder Chicane; 4 in neuer Farbe = gute Fünfer-Nebenfarbe; 3 in der Oberfarbe = 18+ ohne Kürze; 3SA = 15-17 ohne Kürze; 4 in der Oberfarbe = Minimum.'],
    wjs: ['Schwache Sprungwechsel', 'Ein einfacher Sprung des Antwortenden in einer neuen Farbe (z. B. 1♦–2♠, 1♣–2♥) zeigt 6+ Karten und eine schwache Hand (0-5 FP). Zum Spielen; der Eröffner passt. Nicht nach gegnerischem Kontra.'],
    stayman: ['Stayman', '2♣ über 1SA (3♣ über 2SA) fragt nach einer Vierer-Oberfarbe. Antworten: ♦ = keine Vierer-Oberfarbe, ♥ = vier Coeur, ♠ = vier Pik und nicht vier Coeur. Nach 2♦ zeigen 2♥/2♠ fünf in dieser Oberfarbe + vier in der anderen, einladend. Reizt der Antwortende SA über 2♥, nennt der Eröffner mit vier Pik diese auch.'],
    fourWay: ['Vierfach-Transfers', 'Über 1SA: 2♦ → Coeur, 2♥ → Pik (Jacoby), 2♠ → Treff (Eröffner reizt 3♣), 2SA → Karo (Eröffner reizt 3♦). Ausgeglichene Einladungen gehen über 2♣ Stayman.'],
    smolen: ['Smolen', 'Nach 1SA–2♣–2♦ reizt eine partieforcierende Hand mit 5-4 in Oberfarben ihre Vierer-Oberfarbe auf Dreierstufe: 3♥ = 4♥ + 5♠, 3♠ = 4♠ + 5♥, damit die starke Hand spielt.'],
    michaels: ['Michaels-Cuebid / Unusual 2SA', 'Ein direktes Cuebid ihrer Einer-Eröffnung zeigt einen 5-5-Zweifärber, 7+ FP: über Unterfarbe beide Oberfarben; über Oberfarbe die andere Oberfarbe und eine Unterfarbe (Partner fragt mit 2SA nach der Unterfarbe). Ein Sprung auf 2SA (Unusual) zeigt die zwei niedrigsten ungereizten Farben. Partner wählt; mit Fit und 10+ kann er in die Partie springen.'],
    splinter: ['Splinter', 'Doppelsprung in neuer Farbe über eine Oberfarberöffnung (z. B. 1♠–4♥, 1♥–3♠) = 4+ Unterstützung, Single oder Chicane in der genannten Farbe, 11-15 FP, partieforcierend, Schleminteresse. Der Eröffner stoppt in 4 der Oberfarbe oder erkundet den Schlemm.'],
    texas: ['Texas-Transfers', 'Über 1SA/2SA: 4♦ → 4♥, 4♥ → 4♠. 6+ Oberfarbe mit Partiewerten; die starke Hand (Eröffner) spielt.'],
    texasInt: ['Texas nach Störung', 'Texas gilt weiter, wenn die Gegner unser 1SA kontrieren oder auf Zweier- oder Dreierstufe gegenreizen: 4♦ → Coeur, 4♥ → Pik. Ein Gebot in ihrer Farbe ist kein Transfer (nach 2♥-Gegenreizung ist 4♥ ein Cuebid und 4♦ zeigt weiter Coeur). Der Eröffner vervollständigt den Transfer.'],
    leb: ['Lebensohl', 'Nach Gegenreizung auf Zweierstufe über unser 1SA: 2SA zwingt den Eröffner zu 3♣ (um in einer Farbe zu stoppen oder langsam zu zeigen). Eine direkte Farbe auf Dreierstufe ist forcierend. Direktes 3SA verneint einen Stopper; erst 2SA, dann 3SA zeigt einen. Ein Cuebid ihrer Farbe ist Stayman: direkt = ohne Stopper, über 2SA = mit Stopper („fast denies“).'],
    lav: ['Lavinthal-Abwürfe', 'Markierung in der Verteidigung. Die abgeworfene Farbe ist unerwünscht; eine hohe Karte fragt nach der höheren der beiden anderen Farben, eine niedrige nach der niedrigeren (Trumpf und ausgespielte Farbe zählen nicht). Auf Partners Ausspiel ermutigt eine hohe Karte, die niedrigste entmutigt.'],
    invMin: ['Inverted Minors', 'Aus nicht gepasster Hand über 1♣/1♦: die Hebung auf 2 der Unterfarbe ist stark (10+ Punkte, 4+ Unterstützung, 5+ in Treff, keine Vierer-Oberfarbe) und eine Runde forcierend; der Eröffner reizt mit ausgeglichenem Minimum 2SA, zeigt mit Extras Stopper oder wiederholt mit Minimum 3 der Unterfarbe. Die Sprunghebung auf 3 ist präemptiv (0-9 Punkte, 5+ Unterstützung).'],
    drury: ['Drury', 'Reverse Drury. Eine gepasste Hand antwortet auf Partners 1♥/1♠ in dritter/vierter Hand mit 2♣ = 3+ Unterstützung und 10-12 Punkte. Der Eröffner reizt mit leichter oder minimaler Eröffnung 2 in der Oberfarbe (keine Partie) und mit voller Eröffnung 4.'],
    nmf: ['New Minor Forcing', 'Nach 1m–1M–1SA ist 2 in der anderen Unterfarbe des Antwortenden künstlich und forcierend (11+): es fragt den Eröffner nach Dreier-Unterstützung in der Oberfarbe des Antwortenden oder der anderen Vierer-Oberfarbe.'],
    fsf: ['Vierte Farbe forcierend', 'Haben wir drei Farben gereizt, ist das Gebot des Antwortenden in der vierten Farbe künstlich und partieforcierend; es bittet den Eröffner, seine Hand weiter zu beschreiben (Stopper, Unterstützung oder Zusatzlänge).'],
    ogust: ['Ogust', 'Über Partners Weak Two fragt 2SA: 3♣ = Minimum, schlechte Farbe; 3♦ = Minimum, gute Farbe; 3♥ = Maximum, schlechte Farbe; 3♠ = Maximum, gute Farbe; 3SA = feste Farbe (AKD).'],
    supx: ['Support-Kontra', 'Nach 1m–(P)–1M–(Gegenreizung unter 2M) zeigt das Kontra des Eröffners genau drei Karten Unterstützung für die Oberfarbe des Antwortenden; die direkte Hebung zeigt vier.'],
    respx: ['Responsive Kontra', 'Nach ihrer Eröffnung, Partners Informationskontra und ihrer Hebung ist ein Kontra des Partners informativ: 8+ Punkte und beide ungereizten Farben (meist die Oberfarben), ohne klares Gebot.'],
    sjs: ['Starke Sprungwechsel', 'Ein einfacher Sprung des Antwortenden in neuer Farbe zeigt eine starke Hand (19+ Punkte) mit guter Farbe und Schleminteresse. Ersetzt die schwachen Sprungwechsel.'],
    dont: ['DONT', 'Disturb Opponents’ Notrump (Marty Bergen). Über ihr 1SA: X = Einfärber (6+), Partner fragt mit 2♣; 2♣ = Treff und eine höhere Farbe; 2♦ = Karo und eine Oberfarbe; 2♥ = beide Oberfarben; 2♠ = nur Pik (natürlich). Partner passt mit Toleranz oder reizt die nächste Farbe (pass or correct). Ersetzt Cappelletti.'],
    jtr: ['Jacoby-Transfer', 'Über 1SA bittet 2♦ den Eröffner, Coeur zu reizen, und 2♥, Pik zu reizen, damit die starke Hand spielt. Mit vier Karten Unterstützung und Maximum (17) superakzeptiert der Eröffner auf Dreierstufe. Nach dem Transfer ist eine neue Farbe auf Dreierstufe natürlich und partieforcierend.'],
    bw: ['Blackwood', '4SA fragt nach Assen: 5♣ = 0 oder 4, 5♦ = 1, 5♥ = 2, 5♠ = 3.'],
    q: ['Quantitatives 4SA', 'Nach einem Sans-Atout-Gebot fragt 4SA nicht nach Assen; es lädt zum Schlemm ein. Partner reizt mit Maximum 6SA.'],
    nego: ['Negatives Kontra', 'Hat Partner eröffnet und der Gegner gegengereizt, ist Kontra kein Strafkontra: es zeigt vier Karten in der ungereizten Oberfarbe und genug Werte zum Reizen.'],
    takeout: ['Informationskontra', 'Kontra einer Eröffnung: Eröffnungswerte, Kürze in ihrer Farbe und Unterstützung in den anderen Farben. Partner muss reizen.'],
    weak2: ['Weak Two', 'Eröffnung 2♦/2♥/2♠: gute Sechserfarbe, 5-10 FP. Eine präemptive Eröffnung.'],
    strong2c: ['Starkes 2♣', 'Eröffnung 2♣: 22+ FP oder gleichwertige Spielstärke, künstlich und partieforcierend. 2♦ ist die Warteantwort. Nach 2♣–2♦–2♥/2♠ ist 3♣ das zweite Negativ (0-3 FP); 2♣–2♦–2SA (22-24) wird wie eine 2SA-Eröffnung gereizt (Stayman und Transfers).'],
    cue: ['Cuebid', 'Die Farbe der Gegner zu reizen ist nicht natürlich: es zeigt Unterstützung für Partner mit Limit-Hebung oder mehr und ist forcierend.'],
    nt1: ['1SA-Eröffnung', '15-17 FP, ausgeglichen.'],
    pre: ['Sperrgebot', 'Eröffnung auf Dreier- oder Viererstufe: lange Farbe (7+) und schwache Hand, nimmt den Gegnern Reizraum.'],
    runout: ['Flucht nach kontriertem 1SA', 'Wird unser 1SA kontriert, flüchtet ein schwacher Antwortender in eine 5+ Farbe; Rekontra zeigt Werte (9+).'],
  },
  ru: {
    twoOverOne: ['2/1 форсинг до гейма', 'Из непасовавшей руки новая масть на уровне двух после открытия партнёра на уровне одного (кроме 1♣–2♦; 1♠–2♥ показывает пять червей) — форсинг до гейма, 12+ О. На 1♥/1♠ ответ 1БК — форсинг на круг (6-12 О): открывший при отсутствии иного называет третью младшую; последующий прыжок отвечающего на 3 в мажоре показывает инвитную поддержку из трёх карт. Ответ на уровне двух из пасовавшей руки не форсирующий.'],
    rkc: ['RKCB 1430', '4БК спрашивает пять ключевых карт (четыре туза + король козыря). 5♣ = 1 или 4, 5♦ = 3 или 0, 5♥ = 2 без дамы козыря, 5♠ = 2 с дамой козыря.'],
    gerber: ['Гербер', 'Сразу после 1БК/2БК 4♣ спрашивает тузы. 4♦ = 0 или 4, 4♥ = 1, 4♠ = 2, 4БК = 3. Спрашивающий может остановиться в 4БК.'],
    bergen: ['Повышения Бергена', 'На 1♥/1♠ (не после контры или вмешательства): 3♣ = поддержка из четырёх карт, 7-9 очков; 3♦ = четыре карты, 10-12 (инвит); 3 в мажоре = четыре карты, 0-6 (блок). С четырьмя картами и 13+ — Якоби 2БК или сплинтер. Простое повышение показывает три карты, 6-9; инвит с тремя картами идёт через форсирующие 1БК.'],
    capp: ['Каппеллетти', 'Против 1БК соперников (в прямой позиции): X = штрафная, 15+ О. 2♣ = одномастка (6+ карт): партнёр спрашивает 2♦, вмешавшийся пасует с бубнами или называет масть. 2♦ = обе старшие (5-4 и длиннее): партнёр выбирает мажор (прыжок — инвит, 10-12). 2♥/2♠ = 5+ в этом мажоре и младшая из 4+: партнёр пасует, повышает или спрашивает младшую через 2БК. 2БК = обе младшие (5-5): партнёр выбирает.'],
    j2nt: ['Якоби 2БК', '2БК на открытие в мажоре = поддержка из 4+ карт, 13+ очков, форсинг до гейма. Открывший: 3 в новой масти = синглет или ренонс; 4 в новой масти = хорошая боковая пятёрка; 3 в мажоре = 18+ без коротких; 3БК = 15-17 без коротких; 4 в мажоре = минимум.'],
    wjs: ['Слабые прыжки', 'Одинарный прыжок отвечающего в новой масти (напр. 1♦–2♠, 1♣–2♥) показывает масть из 6+ карт и слабую руку (0-5 О). Это игровая заявка; открывший пасует. Не после контры соперника.'],
    stayman: ['Стейман', '2♣ после 1БК (3♣ после 2БК) спрашивает четвёртый мажор. Ответы: ♦ = нет четвёртого мажора, ♥ = четыре червы, ♠ = четыре пики и не четыре червы. После 2♦ 2♥/2♠ = пять в этом мажоре + четыре в другом, инвит. Если отвечающий говорит БК на 2♥, открывший с четырьмя пиками называет и их.'],
    fourWay: ['Четырёхсторонние трансферы', 'После 1БК: 2♦ → червы, 2♥ → пики (Якоби), 2♠ → трефы (открывший говорит 3♣), 2БК → бубны (открывший говорит 3♦). Равномерные инвиты идут через 2♣ Стейман.'],
    smolen: ['Смолен', 'После 1БК–2♣–2♦ рука с форсингом до гейма и 5-4 в мажорах называет свой четвёртый мажор на уровне трёх: 3♥ = 4♥ + 5♠, 3♠ = 4♠ + 5♥, чтобы играла сильная рука.'],
    michaels: ['Кью-бид Михаэльса / необычные 2БК', 'Прямой кью-бид их открытия на уровне одного показывает двухмастку 5-5, 7+ О: на младшую — обе старшие; на мажор — другой мажор и младшую (партнёр спрашивает младшую через 2БК). Прыжок в 2БК (необычные) показывает две младшие незаявленные масти. Партнёр выбирает; с фитом и 10+ может прыгнуть в гейм.'],
    splinter: ['Сплинтер', 'Двойной прыжок в новой масти на открытие в мажоре (напр. 1♠–4♥, 1♥–3♠) = поддержка из 4+ карт, синглет или ренонс в названной масти, 11-15 О, форсинг до гейма, интерес к шлему. Открывший останавливается в 4 мажора или исследует шлем.'],
    texas: ['Техас', 'После 1БК/2БК: 4♦ → 4♥, 4♥ → 4♠. Мажор из 6+ карт с силой на гейм; играет сильная рука (открывший).'],
    texasInt: ['Техас после вмешательства', 'Техас действует, когда соперники контрируют наши 1БК или вмешиваются на уровне двух-трёх: 4♦ → червы, 4♥ → пики. Заявка в их масти — не трансфер (после вмешательства 2♥ 4♥ — кью-бид, а 4♦ по-прежнему показывает червы). Открывший завершает трансфер.'],
    leb: ['Лебензол', 'После вмешательства на уровне двух в наши 1БК: 2БК заставляет открывшего сказать 3♣ (чтобы остановиться в масти или показать медленно). Прямая масть на уровне трёх форсирующая. Прямые 3БК отрицают остановку; 2БК, затем 3БК — показывают. Кью-бид их масти — Стейман: прямо = без остановки, через 2БК = с остановкой («быстро — отрицает»).'],
    lav: ['Сносы Лавинталя', 'Сигналы в защите. Снесённая масть не нужна; высокая карта просит старшую из двух других мастей, низкая — младшую (козырь и сыгранная масть не считаются). На ход партнёра высокая карта поощряет, самая низкая — нет.'],
    invMin: ['Обратные повышения в младших', 'Из непасовавшей руки на 1♣/1♦: повышение до 2 в младшей сильное (10+ очков, 4+ поддержки, 5+ в трефах, нет четвёртого мажора) и форсирует на круг; открывший с равномерным минимумом говорит 2БК, с избытком показывает остановки, с минимумом повторяет 3 в младшей. Прыжок до 3 — блок (0-9 очков, 5+ поддержки).'],
    drury: ['Друри', 'Обратный Друри. Пасовавшая рука отвечает на 1♥/1♠ партнёра в третьей/четвёртой руке 2♣ = поддержка из 3+ карт и 10-12 очков. Открывший с лёгким или минимальным открытием повторяет 2 в мажоре (без гейма), с полноценным говорит 4 в мажоре.'],
    nmf: ['Новая младшая форсинг', 'После 1m–1M–1БК 2 в другой младшей у отвечающего искусственно и форсирующее (11+): спрашивает у открывшего поддержку из трёх карт в мажоре отвечающего или другой четвёртый мажор.'],
    fsf: ['Четвёртая масть форсинг', 'Когда наша линия назвала три масти, заявка отвечающего в четвёртой масти искусственна и форсирует до гейма; она просит открывшего описать руку дальше (остановка, поддержка или дополнительная длина).'],
    ogust: ['Огуст', 'После слабых двух партнёра 2БК спрашивает: 3♣ = минимум, плохая масть; 3♦ = минимум, хорошая масть; 3♥ = максимум, плохая масть; 3♠ = максимум, хорошая масть; 3БК = сплошная масть (ТКД).'],
    supx: ['Контра поддержки', 'После 1m–(пас)–1M–(вмешательство ниже 2M) контра открывшего показывает ровно три карты поддержки мажора отвечающего; прямое повышение — четыре.'],
    respx: ['Ответная контра', 'После их открытия, вызывной контры партнёра и их повышения контра партнёра контрирующего — вызывная: 8+ очков и обе незаявленные масти (обычно мажоры), без ясной заявки.'],
    sjs: ['Сильные прыжки', 'Одинарный прыжок отвечающего в новой масти показывает сильную руку (19+ очков) с хорошей мастью и интересом к шлему. Заменяет слабые прыжки.'],
    dont: ['DONT', 'Disturb Opponents’ Notrump (Марти Берген). Против их 1БК: X = одномастка (6+), партнёр спрашивает 2♣; 2♣ = трефы и старшая масть; 2♦ = бубны и мажор; 2♥ = обе старшие; 2♠ = только пики (натурально). Партнёр пасует с терпимостью или называет следующую масть (пас или поправка). Заменяет Каппеллетти.'],
    jtr: ['Трансфер Якоби', 'После 1БК 2♦ просит открывшего назвать червы, а 2♥ — пики, чтобы играла сильная рука. С четырёхкартной поддержкой и максимумом (17) открывший делает суперакцепт на уровне трёх. После трансфера новая масть на уровне трёх натуральна и форсирует до гейма.'],
    bw: ['Блэквуд', '4БК спрашивает тузы: 5♣ = 0 или 4, 5♦ = 1, 5♥ = 2, 5♠ = 3.'],
    q: ['Количественные 4БК', 'После заявки в бескозырной 4БК не спрашивает тузы, а приглашает в шлем. С максимумом партнёр говорит 6БК.'],
    nego: ['Негативная контра', 'Когда партнёр открыл, а соперник вмешался, контра не штрафная: она показывает четыре карты в незаявленном мажоре и силу для заявки.'],
    takeout: ['Вызывная контра', 'Контра открытия: сила на открытие, короткость в их масти и поддержка в остальных мастях. Партнёр обязан заявить.'],
    weak2: ['Слабые два', 'Открытие 2♦/2♥/2♠: хорошая шестёрка, 5-10 О. Блокирующее открытие.'],
    strong2c: ['Сильные 2♣', 'Открытие 2♣: 22+ О или равная игровая сила, искусственно и форсирует до гейма. 2♦ — ответ-ожидание. После 2♣–2♦–2♥/2♠ 3♣ — второй негатив (0-3 О); 2♣–2♦–2БК (22-24) торгуется как открытие 2БК (Стейман и трансферы).'],
    cue: ['Кью-бид', 'Заявка в масти соперников не натуральна: показывает поддержку партнёра с инвитом или сильнее и форсирует.'],
    nt1: ['Открытие 1БК', '15-17 О, равномерный расклад.'],
    pre: ['Блок', 'Открытие на уровне трёх или четырёх: длинная масть (7+) и слабая рука, отнимает у соперников пространство торговли.'],
    runout: ['Бегство после контры на 1БК', 'Когда наши 1БК контрированы, слабый отвечающий убегает в масть из 5+ карт; реконтра показывает силу (9+).'],
  },
  pl: {
    twoOverOne: ['2/1 forsujące do końcówki', 'Z ręki niespasowanej nowy kolor na poziomie dwóch po otwarciu partnera na poziomie jednego (poza 1♣–2♦; 1♠–2♥ pokazuje pięć kierów) forsuje do końcówki, 12+ PC. Na 1♥/1♠ odpowiedź 1BA jest forsująca na jedno okrążenie (6-12 PC): otwierający bez innej odzywki powtarza trzykartowy młodszy; późniejszy skok odpowiadającego na 3 w starszym pokazuje inwitujące poparcie z trzema kartami. Odpowiedź na poziomie dwóch z ręki spasowanej nie forsuje.'],
    rkc: ['RKCB 1430', '4BA pyta o pięć kart kluczowych (cztery asy + król atutowy). 5♣ = 1 lub 4, 5♦ = 3 lub 0, 5♥ = 2 bez damy atutowej, 5♠ = 2 z damą atutową.'],
    gerber: ['Gerber', 'Bezpośrednio po 1BA/2BA 4♣ pyta o asy. 4♦ = 0 lub 4, 4♥ = 1, 4♠ = 2, 4BA = 3. Pytający może zatrzymać się na 4BA.'],
    bergen: ['Podniesienia Bergena', 'Na 1♥/1♠ (nie po kontrze ani wejściu): 3♣ = poparcie czterokartowe, 7-9 punktów; 3♦ = cztery karty, 10-12 (inwit); 3 w starszym = cztery karty, 0-6 (blok). Z czterema kartami i 13+ używa się Jacoby 2BA lub splintra. Proste podniesienie pokazuje trzy karty, 6-9; inwit z trzema kartami idzie przez forsujące 1BA.'],
    capp: ['Cappelletti', 'Na 1BA przeciwników (na pozycji bezpośredniej): X = karna, 15+ PC. 2♣ = jednokolorówka (6+ kart): partner pyta 2♦, wchodzący pasuje z karami lub nazywa kolor. 2♦ = oba starsze (5-4 lub dłużej): partner wybiera starszy (skok jest inwitem, 10-12). 2♥/2♠ = 5+ w tym starszym i młodszy 4+: partner pasuje, podnosi lub pyta o młodszy przez 2BA. 2BA = oba młodsze (5-5): partner wybiera.'],
    j2nt: ['Jacoby 2BA', '2BA na otwarcie w starszym = poparcie 4+ kart, 13+ punktów, forsuje do końcówki. Otwierający: 3 w nowym kolorze = singel lub renons; 4 w nowym kolorze = dobra boczna piątka; 3 w starszym = 18+ bez krótkości; 3BA = 15-17 bez krótkości; 4 w starszym = minimum.'],
    wjs: ['Słabe skoki', 'Pojedynczy skok odpowiadającego w nowym kolorze (np. 1♦–2♠, 1♣–2♥) pokazuje kolor 6+ i słabą rękę (0-5 PC). To do gry; otwierający pasuje. Nie po kontrze przeciwnika.'],
    stayman: ['Stayman', '2♣ po 1BA (3♣ po 2BA) pyta o czwórkę w starszym. Odpowiedzi: ♦ = brak czwórki w starszym, ♥ = cztery kiery, ♠ = cztery piki i nie cztery kiery. Po 2♦ 2♥/2♠ = pięć w tym starszym + cztery w drugim, inwit. Jeśli odpowiadający licytuje BA na 2♥, otwierający z czterema pikami też je zgłasza.'],
    fourWay: ['Transfery czterokierunkowe', 'Po 1BA: 2♦ → kiery, 2♥ → piki (Jacoby), 2♠ → trefle (otwierający mówi 3♣), 2BA → kara (otwierający mówi 3♦). Równe inwity idą przez 2♣ Stayman.'],
    smolen: ['Smolen', 'Po 1BA–2♣–2♦ ręka forsująca do końcówki z układem 5-4 w starszych zgłasza czwórkę w starszym na poziomie trzech: 3♥ = 4♥ + 5♠, 3♠ = 4♠ + 5♥, aby rozgrywała silna ręka.'],
    michaels: ['Cue bid Michaelsa / nietypowe 2BA', 'Bezpośredni cue bid ich otwarcia na poziomie jednego pokazuje dwukolorówkę 5-5, 7+ PC: na młodszy — oba starsze; na starszy — drugi starszy i młodszy (partner pyta o młodszy przez 2BA). Skok na 2BA (nietypowe) pokazuje dwa najniższe niezalicytowane kolory. Partner wybiera; z fitem i 10+ może skoczyć do końcówki.'],
    splinter: ['Splinter', 'Podwójny skok w nowym kolorze na otwarcie w starszym (np. 1♠–4♥, 1♥–3♠) = poparcie 4+ kart, singel lub renons w nazwanym kolorze, 11-15 PC, forsuje do końcówki, zainteresowanie szlemem. Otwierający zatrzymuje się na 4 w starszym lub bada szlema.'],
    texas: ['Teksas', 'Po 1BA/2BA: 4♦ → 4♥, 4♥ → 4♠. Starszy 6+ z siłą na końcówkę; rozgrywa silna ręka (otwierający).'],
    texasInt: ['Teksas po interwencji', 'Teksas obowiązuje, gdy przeciwnicy kontrują nasze 1BA lub wchodzą na poziomie dwóch-trzech: 4♦ → kiery, 4♥ → piki. Odzywka w ich kolorze nie jest transferem (po wejściu 2♥ 4♥ to cue bid, a 4♦ nadal pokazuje kiery). Otwierający kończy transfer.'],
    leb: ['Lebensohl', 'Po wejściu na poziomie dwóch w nasze 1BA: 2BA zmusza otwierającego do 3♣ (aby zatrzymać się w kolorze lub pokazać powoli). Bezpośredni kolor na poziomie trzech forsuje. Bezpośrednie 3BA zaprzecza zatrzymaniu; 2BA, a potem 3BA je pokazuje. Cue bid ich koloru to Stayman: bezpośrednio = bez zatrzymania, przez 2BA = z zatrzymaniem („szybko zaprzecza”).'],
    lav: ['Zrzutki Lavinthala', 'Sygnalizacja w obronie. Zrzucony kolor jest niechciany; wysoka karta prosi o wyższy z dwóch pozostałych kolorów, niska o niższy (atut i kolor wiodący się nie liczą). Na wist partnera wysoka karta zachęca, najniższa zniechęca.'],
    invMin: ['Odwrócone podniesienia młodszych', 'Z ręki niespasowanej na 1♣/1♦: podniesienie do 2 w młodszym jest silne (10+ punktów, 4+ poparcia, 5+ w treflach, bez czwórki w starszym) i forsuje na jedno okrążenie; otwierający z równym minimum mówi 2BA, z nadwyżką pokazuje zatrzymania, z minimum powtarza 3 w młodszym. Skokowe podniesienie do 3 to blok (0-9 punktów, 5+ poparcia).'],
    drury: ['Drury', 'Odwrócone Drury. Ręka spasowana odpowiada na 1♥/1♠ partnera z trzeciej/czwartej ręki 2♣ = poparcie 3+ kart i 10-12 punktów. Otwierający z lekkim lub minimalnym otwarciem powtarza 2 w starszym (bez końcówki), z pełnym mówi 4 w starszym.'],
    nmf: ['Nowy młodszy forsujący', 'Po 1m–1M–1BA 2 w drugim młodszym u odpowiadającego jest sztuczne i forsujące (11+): pyta otwierającego o trzykartowe poparcie starszego odpowiadającego lub o drugą czwórkę w starszym.'],
    fsf: ['Czwarty kolor forsujący', 'Gdy nasza strona zgłosiła trzy kolory, odzywka odpowiadającego w czwartym kolorze jest sztuczna i forsuje do końcówki; prosi otwierającego o dalszy opis (zatrzymanie, poparcie lub dodatkowa długość).'],
    ogust: ['Ogust', 'Po słabym dwa partnera 2BA pyta: 3♣ = minimum, słaby kolor; 3♦ = minimum, dobry kolor; 3♥ = maksimum, słaby kolor; 3♠ = maksimum, dobry kolor; 3BA = kolor zamknięty (AKD).'],
    supx: ['Kontra poparcia', 'Po 1m–(pas)–1M–(wejście poniżej 2M) kontra otwierającego pokazuje dokładnie trzy karty poparcia w starszym odpowiadającego; bezpośrednie podniesienie pokazuje cztery.'],
    respx: ['Kontra responsywna', 'Po ich otwarciu, wywoławczej kontrze partnera i ich podniesieniu kontra partnera kontrującego jest wywoławcza: 8+ punktów i oba niezalicytowane kolory (zwykle starsze), bez jasnej odzywki.'],
    sjs: ['Silne skoki', 'Pojedynczy skok odpowiadającego w nowym kolorze pokazuje silną rękę (19+ punktów) z dobrym kolorem i zainteresowaniem szlemem. Zastępuje słabe skoki.'],
    dont: ['DONT', 'Disturb Opponents’ Notrump (Marty Bergen). Na ich 1BA: X = jednokolorówka (6+), partner pyta 2♣; 2♣ = trefle i wyższy kolor; 2♦ = kara i starszy; 2♥ = oba starsze; 2♠ = tylko piki (naturalnie). Partner pasuje z tolerancją lub mówi następny kolor (pas lub popraw). Zastępuje Cappelletti.'],
    jtr: ['Transfer Jacoby', 'Po 1BA 2♦ prosi otwierającego o kiery, a 2♥ o piki, aby rozgrywała silna ręka. Z czterokartowym poparciem i maksimum (17) otwierający superakceptuje na poziomie trzech. Po transferze nowy kolor na poziomie trzech jest naturalny i forsuje do końcówki.'],
    bw: ['Blackwood', '4BA pyta o asy: 5♣ = 0 lub 4, 5♦ = 1, 5♥ = 2, 5♠ = 3.'],
    q: ['Ilościowe 4BA', 'Po odzywce bez atu 4BA nie pyta o asy, tylko zaprasza do szlema. Partner z maksimum mówi 6BA.'],
    nego: ['Kontra negatywna', 'Gdy partner otworzył, a przeciwnik wszedł, kontra nie jest karna: pokazuje cztery karty w niezalicytowanym starszym i siłę do licytacji.'],
    takeout: ['Kontra wywoławcza', 'Kontra otwarcia: siła otwarcia, krótkość w ich kolorze i poparcie w pozostałych kolorach. Partner musi licytować.'],
    weak2: ['Słabe dwa', 'Otwarcie 2♦/2♥/2♠: dobra szóstka, 5-10 PC. Otwarcie blokujące.'],
    strong2c: ['Silne 2♣', 'Otwarcie 2♣: 22+ PC lub równoważna siła lewowa, sztuczne i forsujące do końcówki. 2♦ to odpowiedź wyczekująca. Po 2♣–2♦–2♥/2♠ 3♣ to drugi negatyw (0-3 PC); 2♣–2♦–2BA (22-24) licytuje się jak otwarcie 2BA (Stayman i transfery).'],
    cue: ['Cue bid', 'Odzywka w kolorze przeciwników nie jest naturalna: pokazuje poparcie dla partnera z inwitem lub więcej i forsuje.'],
    nt1: ['Otwarcie 1BA', '15-17 PC, układ zrównoważony.'],
    pre: ['Blok', 'Otwarcie na poziomie trzech lub czterech: długi kolor (7+) i słaba ręka, zabiera przeciwnikom przestrzeń licytacyjną.'],
    runout: ['Ucieczka po skontrowanym 1BA', 'Gdy nasze 1BA zostanie skontrowane, słaby odpowiadający ucieka w kolor 5+; rekontra pokazuje siłę (9+).'],
  },
  zh: {
    twoOverOne: ['2/1 逼局', '未曾不叫的应叫人在同伴一阶开叫后于二阶叫新花色(1♣–2♦ 除外;1♠–2♥ 表示五张红心)为逼局,12+ 大牌点。1♥/1♠ 后应叫 1NT 逼叫一轮(6-12 点):开叫人没有其他叫品时叫三张低花;应叫人随后跳叫 3 阶高花表示三张支持的邀叫。已不叫过的一方二阶应叫不逼叫。'],
    rkc: ['RKCB 1430', '4NT 问五张关键张(四张 A + 将牌 K)。5♣ = 1 或 4,5♦ = 3 或 0,5♥ = 2 张且无将牌 Q,5♠ = 2 张且有将牌 Q。'],
    gerber: ['格伯', '直接在 1NT/2NT 之后,4♣ 问 A。4♦ = 0 或 4,4♥ = 1,4♠ = 2,4NT = 3。问叫者可停在 4NT。'],
    bergen: ['伯根加叫', '在 1♥/1♠ 后(不是在加倍或争叫之后):3♣ = 四张支持,7-9 点;3♦ = 四张支持,10-12(邀叫);3 阶高花 = 四张支持,0-6(阻击)。四张支持且 13+ 用雅可比 2NT 或爆裂叫。简单加叫表示三张支持,6-9;三张支持的邀叫经由逼叫性 1NT。'],
    capp: ['卡佩莱蒂', '对方开叫 1NT 后(直接位置):X = 惩罚,15+ 点。2♣ = 单套(6+ 张):同伴叫 2♦ 询问,争叫者有方块就不叫,否则叫出花色。2♦ = 两高花(5-4 或更长):同伴选高花(跳叫为邀叫,10-12)。2♥/2♠ = 该高花 5+ 加一个 4+ 低花:同伴不叫、加叫或叫 2NT 询问低花。2NT = 两低花(5-5):同伴选择。'],
    j2nt: ['雅可比 2NT', '高花开叫后应叫 2NT = 4+ 张支持,13+ 点,逼局。开叫人:3 阶新花 = 单张或缺门;4 阶新花 = 好的五张旁套;3 阶高花 = 18+ 无短门;3NT = 15-17 无短门;4 阶高花 = 低限。'],
    wjs: ['弱跳新花', '应叫人在新花色上的单跳(如 1♦–2♠、1♣–2♥)表示 6+ 张套和弱牌(0-5 点)。这是止叫;开叫人不叫。对方加倍后不适用。'],
    stayman: ['斯台曼', '1NT 后 2♣(2NT 后 3♣)问四张高花。回答:♦ = 无四张高花,♥ = 四张红心,♠ = 四张黑桃且没有四张红心。2♦ 之后 2♥/2♠ = 该高花五张 + 另一高花四张,邀叫。若应叫人在 2♥ 后叫 NT,有四张黑桃的开叫人也要叫出黑桃。'],
    fourWay: ['四路转移', '1NT 后:2♦ → 红心,2♥ → 黑桃(雅可比),2♠ → 梅花(开叫人叫 3♣),2NT → 方块(开叫人叫 3♦)。均型邀叫经由 2♣ 斯台曼。'],
    smolen: ['斯莫伦', '1NT–2♣–2♦ 之后,高花 5-4 的逼局牌在三阶叫出其四张高花:3♥ = 4♥ + 5♠,3♠ = 4♠ + 5♥,使强牌一方做庄。'],
    michaels: ['迈克尔斯扣叫 / 不寻常 2NT', '直接扣叫对方的一阶开叫表示 5-5 两套,7+ 点:对低花开叫为两高花;对高花开叫为另一高花加一个低花(同伴叫 2NT 询问低花)。跳叫 2NT(不寻常)表示未叫过的两个最低花色。同伴选择花色;有配合且 10+ 可跳到成局。'],
    splinter: ['爆裂叫', '高花开叫后在新花色上双跳(如 1♠–4♥、1♥–3♠)= 4+ 张支持,所叫花色单张或缺门,11-15 点,逼局,有满贯兴趣。开叫人停在 4 阶高花或探索满贯。'],
    texas: ['德州转移', '1NT/2NT 后:4♦ → 4♥,4♥ → 4♠。6+ 张高花且有成局实力;由强牌一方(开叫人)做庄。'],
    texasInt: ['干扰后的德州', '对方加倍我方 1NT 或在二、三阶争叫时德州转移仍然有效:4♦ → 红心,4♥ → 黑桃。叫对方的花色不是转移(对方 2♥ 争叫后,4♥ 是扣叫,4♦ 仍表示红心)。开叫人完成转移。'],
    leb: ['莱本索尔', '我方 1NT 被二阶争叫后:2NT 迫使开叫人叫 3♣(用于停在某花色或慢速表示)。直接三阶花色为逼叫。直接 3NT 否认止张;先 2NT 再 3NT 表示有止张。扣叫对方花色为斯台曼:直接 = 无止张,经由 2NT = 有止张(“快则否认”)。'],
    lav: ['拉文索尔垫牌', '防守信号。垫掉的花色是你不要的;大牌请求另外两门中较高的一门,小牌请求较低的一门(将牌和首攻花色不算)。同伴首攻时,大点子鼓励,最小的点子表示不鼓励。'],
    invMin: ['反向低花加叫', '未曾不叫的一方在 1♣/1♦ 后:加叫到 2 阶低花为强(10+ 点,4+ 张支持,梅花 5+,无四张高花)且逼叫一轮;开叫人均型低限叫 2NT,有余力就显示止张,低限则重复 3 阶低花。跳加到 3 阶为阻击(0-9 点,5+ 张支持)。'],
    drury: ['德鲁里', '反向德鲁里。已不叫过的一方在同伴第三/第四家开叫 1♥/1♠ 后应叫 2♣ = 3+ 张支持且 10-12 点。开叫人轻开叫或低限时重复 2 阶高花(不成局),足额开叫叫 4 阶高花。'],
    nmf: ['新低花逼叫', '1m–1M–1NT 之后,应叫人叫另一低花的 2 阶为人为逼叫(11+):询问开叫人是否对应叫人的高花有三张支持或另有四张高花。'],
    fsf: ['第四花色逼叫', '我方已叫过三个花色时,应叫人叫第四花色为人为逼局;要求开叫人进一步描述(止张、支持或额外长度)。'],
    ogust: ['奥格斯特', '同伴弱二开叫后,2NT 询问:3♣ = 低限,套差;3♦ = 低限,套好;3♥ = 高限,套差;3♠ = 高限,套好;3NT = 坚固套(AKQ)。'],
    supx: ['支持性加倍', '1m–(不叫)–1M–(低于 2M 的争叫)之后,开叫人加倍表示对应叫人的高花恰好三张支持;直接加叫表示四张。'],
    respx: ['应答性加倍', '对方开叫、同伴技术性加倍、对方加叫之后,加倍者同伴的加倍为技术性:8+ 点且持有两门未叫花色(通常是高花),没有明确叫品。'],
    sjs: ['强跳新花', '应叫人在新花色上的单跳表示强牌(19+ 点),好套且有满贯兴趣。取代弱跳新花。'],
    dont: ['DONT', 'Disturb Opponents’ Notrump(马蒂·伯根)。对方 1NT 后:X = 单套(6+),同伴叫 2♣ 询问;2♣ = 梅花加一门更高花色;2♦ = 方块加一门高花;2♥ = 两高花;2♠ = 只有黑桃(自然)。同伴有容忍就不叫,否则叫下一门花色(不叫或改正)。取代卡佩莱蒂。'],
    jtr: ['雅可比转移', '1NT 后 2♦ 要求开叫人叫红心,2♥ 要求叫黑桃,使强牌做庄。有四张支持且高限(17)时开叫人在三阶超接受。转移之后三阶新花色为自然且逼局。'],
    bw: ['黑木', '4NT 问 A:5♣ = 0 或 4,5♦ = 1,5♥ = 2,5♠ = 3。'],
    q: ['定量 4NT', '在无将叫品之后,4NT 不问 A,而是邀请满贯。同伴高限叫 6NT。'],
    nego: ['否定性加倍', '同伴开叫、对方争叫后,加倍不是惩罚性的:表示未叫高花有四张且有足够叫牌实力。'],
    takeout: ['技术性加倍', '对开叫的加倍:有开叫实力,对方花色短,其他花色有支持。同伴必须叫牌。'],
    weak2: ['弱二', '开叫 2♦/2♥/2♠:好的六张套,5-10 点。阻击性开叫。'],
    strong2c: ['强 2♣', '开叫 2♣:22+ 点或同等赢墩实力,人为且逼局。2♦ 为等待应叫。2♣–2♦–2♥/2♠ 之后 3♣ 为二次否定(0-3 点);2♣–2♦–2NT(22-24)按 2NT 开叫处理(斯台曼和转移)。'],
    cue: ['扣叫', '叫对方的花色不是自然叫:表示对同伴有邀叫或更强的支持,为逼叫。'],
    nt1: ['1NT 开叫', '15-17 点,均型。'],
    pre: ['阻击叫', '三阶或四阶开叫:长套(7+)且牌力弱,压缩对方的叫牌空间。'],
    runout: ['1NT 被加倍后的逃叫', '我方 1NT 被加倍时,弱牌应叫人逃到 5+ 张花色;再加倍表示有实力(9+)。'],
  },
};
const SYS_T = {
  tr: { twoone: '5 kartlı majörler, 15-17 1NT, zayıf ikiler, güçlü 2♣. Pas geçmemiş cevaplayanın iki seviyesindeki yeni rengi oyun forsingdir; majör üzerine 1NT forsingdir.', sayc: '5 kartlı majörler, 15-17 1NT, zayıf ikiler, güçlü 2♣, Jacoby transferleri ve Stayman, Blackwood. İki seviyesinde yeni renk bir tur forsingdir (10+); majör üzerine 1NT 6-10 ve forsing değildir; atlamalı renk değişimleri güçlüdür.', acol: '4 kartlı majörler, zayıf 1NT (12-14), güçlü 2♣ (23+ ya da oyun forsing), ♦ ♥ ♠’de zayıf ikiler, limit artırmalar (artırma dört kart vaat eder), 2NT 20-22, Stayman ve transferler, RKCB.', sef: 'Système d’Enseignement Français: 5 kartlı majörler, "en iyi minör" 1♣/1♦, 15-17 1NT, güçlü ve forsing 2♣, yapay oyun forsing 2♦, zayıf 2♥/2♠. İki seviyesinde yeni renk bir tur forsingdir; RKCB.', precision: 'Güçlü sinek: 1♣ = 16+ her dağılım (yapay, forsing; 1♦ = negatif 0-7). Diğer açışlar 11-15: 1♦ 2+ ♦ (genel), 1♥/1♠ 5+, 1NT 13-15, 2♣ 6+ ♣ (ya da 5♣ + 4 kartlı majör), 2♦ ♦’da kısa üç renkli (4-4-1-4 / 4-4-0-5), zayıf 2♥/2♠.', polish: 'Wspólny Język: 1♣ = (a) 12-14 dengeli, (b) uzun sinekli 15+ ya da (c) her türlü 18+ (1♦ = negatif 0-7 ya da bekleme). 1♦ 4+ ♦ dengesiz, 1♥/1♠ 5+, 1NT 15-17, 2♣ 6+ ♣ 11-15, 2♦ Multi (♥ ya da ♠’de zayıf iki), 2♥/2♠ zayıf.' },
  no: { twoone: 'Femkorts major, 15-17 1NT, svake to, sterk 2♣. Ny farge på totrinnet fra en svarer som ikke har passet er krav til utgang; 1NT over major er krav.', sayc: 'Femkorts major, 15-17 1NT, svake to, sterk 2♣, Jacoby-overføringer og Stayman, Blackwood. Ny farge på totrinnet er krav i én runde (10+); 1NT over major er 6-10 og ikke krav; hoppskift er sterke.', acol: 'Firekorts major, svak 1NT (12-14), sterk 2♣ (23+ eller utgangskrav), svake to i ♦ ♥ ♠, invitthøyninger (en høyning lover fire kort), 2NT 20-22, Stayman og overføringer, RKCB.', sef: 'Système d’Enseignement Français: femkorts major, «beste minor» 1♣/1♦, 15-17 1NT, sterk og krav 2♣, kunstig utgangskrav 2♦, svake 2♥/2♠. Ny farge på totrinnet er krav i én runde; RKCB.', precision: 'Sterk kløver: 1♣ = 16+ uansett fordeling (kunstig, krav; 1♦ = negativ 0-7). Andre åpninger 11-15: 1♦ 2+ ♦ (samlemelding), 1♥/1♠ 5+, 1NT 13-15, 2♣ 6+ ♣ (eller 5♣ + firekorts major), 2♦ trefarget kort i ♦ (4-4-1-4 / 4-4-0-5), svake 2♥/2♠.', polish: 'Wspólny Język: 1♣ = (a) 12-14 balansert, (b) 15+ med lange kløver eller (c) 18+ uansett (1♦ = negativ 0-7 eller ventesvar). 1♦ 4+ ♦ ubalansert, 1♥/1♠ 5+, 1NT 15-17, 2♣ 6+ ♣ 11-15, 2♦ Multi (svak to i ♥ eller ♠), svake 2♥/2♠.' },
  es: { twoone: 'Mayores de cinco, 1SA 15-17, doses débiles, 2♣ fuerte. Un palo nuevo a nivel de dos de un respondedor no pasado es forcing a manga; 1SA sobre mayor es forcing.', sayc: 'Mayores de cinco, 1SA 15-17, doses débiles, 2♣ fuerte, transferencias Jacoby y Stayman, Blackwood. Un palo nuevo a nivel de dos es forcing una vuelta (10+); 1SA sobre mayor es 6-10 y no forcing; los saltos en palo nuevo son fuertes.', acol: 'Mayores de cuatro, 1SA débil (12-14), 2♣ fuerte (23+ o forcing a manga), doses débiles en ♦ ♥ ♠, apoyos límite (un apoyo promete cuatro cartas), 2SA 20-22, Stayman y transferencias, RKCB.', sef: 'Système d’Enseignement Français: mayores de cinco, «mejor menor» 1♣/1♦, 1SA 15-17, 2♣ fuerte y forcing, 2♦ artificial forcing a manga, 2♥/2♠ débiles. Un palo nuevo a nivel de dos es forcing una vuelta; RKCB.', precision: 'Trébol fuerte: 1♣ = 16+ cualquier distribución (artificial, forcing; 1♦ = negativo 0-7). Otras aperturas 11-15: 1♦ 2+ ♦ (comodín), 1♥/1♠ 5+, 1SA 13-15, 2♣ 6+ ♣ (o 5♣ + mayor de cuatro), 2♦ tricolor corto en ♦ (4-4-1-4 / 4-4-0-5), 2♥/2♠ débiles.', polish: 'Wspólny Język: 1♣ = (a) 12-14 equilibrada, (b) 15+ con tréboles largos o (c) 18+ cualquiera (1♦ = negativo 0-7 o espera). 1♦ 4+ ♦ desequilibrada, 1♥/1♠ 5+, 1SA 15-17, 2♣ 6+ ♣ 11-15, 2♦ Multi (dos débil en ♥ o ♠), 2♥/2♠ débiles.' },
  fr: { twoone: 'Majeures cinquièmes, 1SA 15-17, deux faibles, 2♣ fort. Une couleur nouvelle au palier de deux d’un répondant non passé est forcing de manche ; 1SA sur une majeure est forcing.', sayc: 'Majeures cinquièmes, 1SA 15-17, deux faibles, 2♣ fort, transferts Jacoby et Stayman, Blackwood. Une couleur nouvelle au palier de deux est forcing un tour (10+) ; 1SA sur une majeure fait 6-10 et n’est pas forcing ; les sauts sont forts.', acol: 'Majeures quatrièmes, 1SA faible (12-14), 2♣ fort (23+ ou forcing de manche), deux faibles à ♦ ♥ ♠, soutiens limites (un soutien promet quatre cartes), 2SA 20-22, Stayman et transferts, RKCB.', sef: 'Système d’Enseignement Français : majeures cinquièmes, « meilleure mineure » 1♣/1♦, 1SA 15-17, 2♣ fort et forcing, 2♦ artificiel forcing de manche, 2♥/2♠ faibles. Une couleur nouvelle au palier de deux est forcing un tour ; RKCB.', precision: 'Trèfle fort : 1♣ = 16+ toute distribution (artificiel, forcing ; 1♦ = négatif 0-7). Autres ouvertures 11-15 : 1♦ 2+ ♦ (fourre-tout), 1♥/1♠ 5+, 1SA 13-15, 2♣ 6+ ♣ (ou 5♣ + majeure quatrième), 2♦ tricolore court à ♦ (4-4-1-4 / 4-4-0-5), 2♥/2♠ faibles.', polish: 'Wspólny Język : 1♣ = (a) 12-14 régulier, (b) 15+ avec des trèfles longs ou (c) 18+ quelconque (1♦ = négatif 0-7 ou attente). 1♦ 4+ ♦ irrégulier, 1♥/1♠ 5+, 1SA 15-17, 2♣ 6+ ♣ 11-15, 2♦ Multi (deux faible à ♥ ou ♠), 2♥/2♠ faibles.' },
  it: { twoone: 'Maggiori quinte, 1SA 15-17, sottoaperture deboli, 2♣ forte. Un colore nuovo a livello di due di un rispondente non passato è forzante manche; 1SA su una maggiore è forzante.', sayc: 'Maggiori quinte, 1SA 15-17, sottoaperture deboli, 2♣ forte, transfer Jacoby e Stayman, Blackwood. Un colore nuovo a livello di due è forzante per un giro (10+); 1SA su una maggiore è 6-10 e non forzante; i salti sono forti.', acol: 'Maggiori quarte, 1SA debole (12-14), 2♣ forte (23+ o forzante manche), sottoaperture deboli a ♦ ♥ ♠, appoggi limite (un appoggio promette quattro carte), 2SA 20-22, Stayman e transfer, RKCB.', sef: 'Système d’Enseignement Français: maggiori quinte, «miglior minore» 1♣/1♦, 1SA 15-17, 2♣ forte e forzante, 2♦ artificiale forzante manche, 2♥/2♠ deboli. Un colore nuovo a livello di due è forzante per un giro; RKCB.', precision: 'Fiori forte: 1♣ = 16+ qualsiasi distribuzione (artificiale, forzante; 1♦ = negativo 0-7). Altre aperture 11-15: 1♦ 2+ ♦ (di attesa), 1♥/1♠ 5+, 1SA 13-15, 2♣ 6+ ♣ (o 5♣ + maggiore quarta), 2♦ tricolore corto a ♦ (4-4-1-4 / 4-4-0-5), 2♥/2♠ deboli.', polish: 'Wspólny Język: 1♣ = (a) 12-14 bilanciata, (b) 15+ con fiori lunghe o (c) 18+ qualsiasi (1♦ = negativo 0-7 o attesa). 1♦ 4+ ♦ sbilanciata, 1♥/1♠ 5+, 1SA 15-17, 2♣ 6+ ♣ 11-15, 2♦ Multi (sottoapertura debole a ♥ o ♠), 2♥/2♠ deboli.' },
  de: { twoone: 'Fünfer-Oberfarben, 1SA 15-17, Weak Twos, starkes 2♣. Eine neue Farbe auf Zweierstufe aus nicht gepasster Hand ist partieforcierend; 1SA über eine Oberfarbe ist forcierend.', sayc: 'Fünfer-Oberfarben, 1SA 15-17, Weak Twos, starkes 2♣, Jacoby-Transfers und Stayman, Blackwood. Eine neue Farbe auf Zweierstufe ist eine Runde forcierend (10+); 1SA über eine Oberfarbe ist 6-10 und nicht forcierend; Sprungwechsel sind stark.', acol: 'Vierer-Oberfarben, schwaches 1SA (12-14), starkes 2♣ (23+ oder Partieforcing), Weak Twos in ♦ ♥ ♠, Limit-Hebungen (eine Hebung verspricht vier Karten), 2SA 20-22, Stayman und Transfers, RKCB.', sef: 'Système d’Enseignement Français: Fünfer-Oberfarben, „beste Unterfarbe“ 1♣/1♦, 1SA 15-17, 2♣ stark und forcierend, 2♦ künstlich partieforcierend, schwache 2♥/2♠. Eine neue Farbe auf Zweierstufe ist eine Runde forcierend; RKCB.', precision: 'Starkes Treff: 1♣ = 16+ beliebige Verteilung (künstlich, forcierend; 1♦ = negativ 0-7). Andere Eröffnungen 11-15: 1♦ 2+ ♦ (Sammelgebot), 1♥/1♠ 5+, 1SA 13-15, 2♣ 6+ ♣ (oder 5♣ + Vierer-Oberfarbe), 2♦ Dreifärber kurz in ♦ (4-4-1-4 / 4-4-0-5), schwache 2♥/2♠.', polish: 'Wspólny Język: 1♣ = (a) 12-14 ausgeglichen, (b) 15+ mit langen Treff oder (c) 18+ beliebig (1♦ = negativ 0-7 oder Warteantwort). 1♦ 4+ ♦ unausgeglichen, 1♥/1♠ 5+, 1SA 15-17, 2♣ 6+ ♣ 11-15, 2♦ Multi (Weak Two in ♥ oder ♠), schwache 2♥/2♠.' },
  ru: { twoone: 'Пятые мажоры, 1БК 15-17, слабые два, сильные 2♣. Новая масть на уровне двух у непасовавшего отвечающего — форсинг до гейма; 1БК на мажор форсирует.', sayc: 'Пятые мажоры, 1БК 15-17, слабые два, сильные 2♣, трансферы Якоби и Стейман, Блэквуд. Новая масть на уровне двух форсирует на круг (10+); 1БК на мажор 6-10 и не форсирует; прыжки в новой масти сильные.', acol: 'Четвёртые мажоры, слабые 1БК (12-14), сильные 2♣ (23+ или форсинг до гейма), слабые два в ♦ ♥ ♠, инвитные повышения (повышение обещает четыре карты), 2БК 20-22, Стейман и трансферы, RKCB.', sef: 'Système d’Enseignement Français: пятые мажоры, «лучшая младшая» 1♣/1♦, 1БК 15-17, сильные форсирующие 2♣, искусственные 2♦ — форсинг до гейма, слабые 2♥/2♠. Новая масть на уровне двух форсирует на круг; RKCB.', precision: 'Сильная трефа: 1♣ = 16+ любой расклад (искусственно, форсинг; 1♦ = негатив 0-7). Прочие открытия 11-15: 1♦ 2+ ♦ (сборное), 1♥/1♠ 5+, 1БК 13-15, 2♣ 6+ ♣ (или 5♣ + четвёртый мажор), 2♦ трёхмастка с короткими бубнами (4-4-1-4 / 4-4-0-5), слабые 2♥/2♠.', polish: 'Wspólny Język: 1♣ = (а) 12-14 равномерно, (б) 15+ с длинными трефами или (в) 18+ любая (1♦ = негатив 0-7 или ожидание). 1♦ 4+ ♦ неравномерно, 1♥/1♠ 5+, 1БК 15-17, 2♣ 6+ ♣ 11-15, 2♦ Мульти (слабые два в ♥ или ♠), слабые 2♥/2♠.' },
  pl: { twoone: 'Piątki w starszych, 1BA 15-17, słabe dwa, silne 2♣. Nowy kolor na poziomie dwóch u niespasowanego odpowiadającego forsuje do końcówki; 1BA na starszy forsuje.', sayc: 'Piątki w starszych, 1BA 15-17, słabe dwa, silne 2♣, transfery Jacoby i Stayman, Blackwood. Nowy kolor na poziomie dwóch forsuje na okrążenie (10+); 1BA na starszy to 6-10 i nie forsuje; skoki są silne.', acol: 'Czwórki w starszych, słabe 1BA (12-14), silne 2♣ (23+ lub do końcówki), słabe dwa w ♦ ♥ ♠, podniesienia limitowe (podniesienie obiecuje cztery karty), 2BA 20-22, Stayman i transfery, RKCB.', sef: 'Système d’Enseignement Français: piątki w starszych, „lepszy młodszy” 1♣/1♦, 1BA 15-17, silne i forsujące 2♣, sztuczne 2♦ forsujące do końcówki, słabe 2♥/2♠. Nowy kolor na poziomie dwóch forsuje na okrążenie; RKCB.', precision: 'Silny trefl: 1♣ = 16+ dowolny układ (sztuczne, forsujące; 1♦ = negatyw 0-7). Inne otwarcia 11-15: 1♦ 2+ ♦ (zbiorcze), 1♥/1♠ 5+, 1BA 13-15, 2♣ 6+ ♣ (lub 5♣ + czwórka w starszym), 2♦ trójkolorówka krótka w ♦ (4-4-1-4 / 4-4-0-5), słabe 2♥/2♠.', polish: 'Wspólny Język: 1♣ = (a) 12-14 zrównoważone, (b) 15+ z długimi treflami lub (c) 18+ dowolne (1♦ = negatyw 0-7 lub odpowiedź wyczekująca). 1♦ 4+ ♦ niezrównoważone, 1♥/1♠ 5+, 1BA 15-17, 2♣ 6+ ♣ 11-15, 2♦ Multi (słabe dwa w ♥ lub ♠), słabe 2♥/2♠.' },
  zh: { twoone: '五张高花,1NT 15-17,弱二,强 2♣。未不叫过的应叫人二阶新花逼局;高花开叫后 1NT 为逼叫。', sayc: '五张高花,1NT 15-17,弱二,强 2♣,雅可比转移与斯台曼,黑木。二阶新花逼叫一轮(10+);高花开叫后 1NT 为 6-10 且不逼叫;跳新花为强。', acol: '四张高花,弱 1NT(12-14),强 2♣(23+ 或逼局),♦ ♥ ♠ 弱二,限制性加叫(加叫保证四张),2NT 20-22,斯台曼和转移,RKCB。', sef: 'Système d’Enseignement Français:五张高花,“较好低花”开 1♣/1♦,1NT 15-17,2♣ 强且逼叫,2♦ 人为逼局,2♥/2♠ 弱。二阶新花逼叫一轮;RKCB。', precision: '强梅花:1♣ = 16+ 任意牌型(人为,逼叫;1♦ = 否定 0-7)。其他开叫 11-15:1♦ 2+ ♦(兜底),1♥/1♠ 5+,1NT 13-15,2♣ 6+ ♣(或 5♣ + 四张高花),2♦ 方块短的三套(4-4-1-4 / 4-4-0-5),2♥/2♠ 弱。', polish: 'Wspólny Język(波兰梅花):1♣ = (a) 12-14 均型,(b) 15+ 长梅花,或 (c) 18+ 任意(1♦ = 否定 0-7 或等待)。1♦ 4+ ♦ 非均型,1♥/1♠ 5+,1NT 15-17,2♣ 6+ ♣ 11-15,2♦ 多义(♥ 或 ♠ 弱二),2♥/2♠ 弱。' },
};
// put the chosen language's seats, convention names/descriptions and system descriptions on the screen
function applyLang() {
  const L = SET.lang || 'en';
  SEAT.splice(0, 4, ...(SEAT_T[L] || SEAT_T.en)); SEAT_AB = SEAT_AB_T[L] || 'NESW';
  const C = CONV_T[L] || {};
  for (const c of [...E.CONVS, ...Object.entries(E.XINFO).map(([k, v]) => Object.assign(v, { k: v.k || k }))]) {
    if (c._n == null) { c._n = c.n; c._d = c.d; }
    const t = C[c.k]; c.n = t ? t[0] : c._n; c.d = t ? t[1] : c._d;
  }
  const S = SYS_T[L] || {};
  for (const s of E.SYSTEMS) { if (s._d == null) s._d = s.d; s.d = S[s.k] || s._d; }
}
const ui = { selLvl: 0, hintBid: null, hintCard: null, lastExpl: null, toast: null, confirmNew: 0, overlay: null, resTab: 'stats' };
const online = () => typeof Net !== "undefined" && Net.on;
const guest = () => typeof Net !== "undefined" && Net.guest;
// your seat (a tournament is always played from South); a spectator has no seat of their own (meSeat -1)
const U = () => (guest() ? Net.st.seat : G && G.tour && G.tour.table == null ? (G.tour.seat ?? 2) : SET.seat);
const meSeat = () => (guest() && Net.st.watching ? -1 : U());
const delay = () => [1100, 650, 250][SET.speed];
const $ = id => document.getElementById(id);
const red = s => s === 1 || s === 2;
const symHtml = s => s === 4 ? 'NT' : `<span class="sym${red(s) ? ' red' : ''}">${STR[s]}</span>`;
const callHtml = c => isNum(c) ? LV(c) + symHtml(ST(c)) : callTxt(c);
/* enlarges and colours the suit symbols inside a text */
const symText = t => String(t || '').replace(/[♣♦♥♠]/g, ch => `<span class="sym${ch === '♥' || ch === '♦' ? ' red' : ''}">${ch}</span>`);
const conKey = c => c ? `${LV(B(c.level, c.strain))}${symHtml(c.strain)}${c.dbl === 1 ? 'X' : c.dbl === 2 ? 'XX' : ''} ${SEAT_AB[c.decl]}` : 'Pass';
const conId = c => c ? `${c.level}${c.strain}${c.dbl}${c.decl}` : 'P';
const fmtSigned = v => (v > 0 ? '+' : '') + v;

function sideCards() {
  // our side (you and your robot partner) bids our system; the opponents the same, or SAYC
  const ours = { conv: { ...SET.conv }, agg: 0, sys: SET.sys || 'twoone' }, opp = SET.opp === 'same' ? { conv: { ...SET.conv }, agg: 0, sys: SET.sys || 'twoone' } : { conv: { ...E.SAYC }, agg: 0, sys: 'sayc' };
  const c = [null, null]; c[sideOf(U())] = ours; c[1 - sideOf(U())] = opp;
  // at an online table the other side bids the system of the player sitting there (their robot partner too)
  if (typeof Net !== 'undefined' && online() && !guest()) {
    const side = 1 - sideOf(U()), s = [0, 1, 2, 3].find(x => sideOf(x) === side && Net.st.seats[x] && Net.st.seats[x] !== 'host' && Net.st.profs && Net.st.profs[x] && Net.st.profs[x].sys);
    if (s != null) { const p = Net.st.profs[s]; c[side] = { conv: { ...(p.conv || E.sysOf(p.sys).conv) }, agg: 0, sys: p.sys }; }
  }
  return c;
}

/* ================= persistence ================= */
const SEEN_KEY = 'bridge-table-seen';
let SEEN = new Set();
function loadSeen() { try { SEEN = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch (e) { SEEN = new Set(); } }
function saveSeen() { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...SEEN].slice(-30000))); } catch (e) {} }
function save() {
  if (online() && Net.host) Net.broadcast();
  const slim = HIST.map((h, i) => (i < HIST.length - 60 ? { ...h, deal: undefined, fieldList: undefined, auc: undefined, pl: undefined } : h));
  Store.saveLocal({ SET, G: guest() ? Net.st.savedG : (G && G.phase === "idle" ? ui.saved || null : G), HIST: slim, BOARD });
}
function load(d) {
  d = d || Store.loadLocal();
  if (d) { SET = Object.assign(SET, d.SET || {}); G = d.G || null; HIST = d.HIST || []; BOARD = d.BOARD || 0; }
  if (G && G.phase === "lobby") G = null; // an online waiting room is not restored after a restart
  SET.conv = { ...E.ALL_ON, ...(SET.conv || {}) };
  if (!SET.lang) { const l = (navigator.language || 'en').toLowerCase(); SET.lang = l.startsWith('tr') ? 'tr' : /^(nb|nn|no)/.test(l) ? 'no' : l.startsWith('es') ? 'es' : l.startsWith('fr') ? 'fr' : l.startsWith('it') ? 'it' : l.startsWith('de') ? 'de' : l.startsWith('ru') ? 'ru' : l.startsWith('pl') ? 'pl' : l.startsWith('zh') ? 'zh' : 'en'; }
  applyLang();
  // the player card's "joined" date (the first day this device played; from the oldest board for old players) and logins
  if (!SET.joined) { const t0 = Math.min(Date.now(), ...HIST.map(h => h.ts || Date.now())); SET.joined = new Date(t0).toISOString().slice(0, 10); }
  SET.logins = (SET.logins || 0) + 1;
  loadSeen();
  for (const h of HIST) if (h.deal) SEEN.add(E.dealKey(h.deal));
}
function mergeCloud(recs, settings) {
  const have = new Set(HIST.map(h => h.id)), inCloud = new Set(recs.map(r => r.id));
  for (const h of HIST) if (!inCloud.has(h.id)) Store.saveRec(h);
  for (const r of recs) if (!have.has(r.id)) HIST.push(r);
  HIST.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  if (settings) { SET = Object.assign(SET, settings); SET.conv = { ...E.ALL_ON, ...(SET.conv || {}) }; }
  BOARD = Math.max(BOARD, ...HIST.map(h => h.board || 0));
  save(); render();
}

/* ================= device sync (GitHub gist) ================= */
let syncTimer = null;
const syncState = { msg: "" };
function syncNow(quiet) {
  if (!GitSync.enabled) return;
  if (!navigator.onLine) { syncState.msg = "Offline — will sync when back online"; return; }
  syncState.msg = "Syncing…"; if (ui.overlay === "set") showSettings();
  GitSync.sync({ hist: HIST, seen: [...SEEN] }).then(m => {
    if (!m) return;
    HIST = m.hist; SEEN = new Set(m.seen); saveSeen();
    BOARD = Math.max(BOARD, ...HIST.map(h => h.board || 0));
    syncState.msg = "Synced " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    save(); renderBar(); if (ui.overlay === "set") showSettings(); else if (ui.overlay === "res") showResults();
  }).catch(e => { syncState.msg = e.message === "offline" ? "Offline — will sync when back online" : "Sync failed: " + e.message; if (ui.overlay === "set") showSettings(); });
}
function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(true), 2500); }

/* ================= virtual field (background worker) ================= */
/* the virtual field: 10 expert robot tables play the same deal in two background workers;
   double-dummy checks run in a third worker that is restarted for every new board, so nothing waits behind an old job */
const FIELD_N = 10, FIELD_PARTS = 2;
const Field = {
  live: {}, fw: [], dw: null, ddBoard: null, src: null,
  mk() {
    try {
      if (!this.src) this.src = URL.createObjectURL(new Blob(['const E={};\n' + window.BRIDGE.map(f => '(' + f.toString() + ')(E);').join('\n') + '\n(' + E.workerMain.toString() + ')(E);'], { type: 'text/javascript' }));
      const w = new Worker(this.src);
      w.onmessage = e => this.onmsg(e.data);
      return w;
    } catch (e) { return null; }
  },
  init() {},
  start(g) {
    const f = { tables: [], n: FIELD_N, done: false, dd: {}, normC: null, parts: 0, t0: Date.now() };
    g.field = f; this.live[g.id] = { f, deal: g.deal, board: g.board };
    this.fw.forEach(w => w && w.terminate()); this.fw = [];
    const per = Math.ceil(FIELD_N / FIELD_PARTS);
    for (let p = 0; p < FIELD_PARTS; p++) {
      const w = this.mk(), msg = { type: 'field', id: g.id, deal: g.deal, board: g.board, cards: g.cards, from: p * per, to: Math.min(FIELD_N, (p + 1) * per) };
      if (!w) { this.fallback(msg); continue; }
      w.onerror = () => this.partDone(g.id);
      this.fw.push(w); w.postMessage(msg);
    }
    // safety net: if a worker is stopped by the phone, finish with the tables we have
    clearTimeout(this.watch); this.watch = setTimeout(() => { const L = this.live[g.id]; if (L && !L.f.done) { L.f.parts = FIELD_PARTS - 1; this.partDone(g.id); } }, 6 * 60000);
  },
  partDone(id) {
    const L = this.live[id]; if (!L || L.f.done) return;
    if (++L.f.parts >= FIELD_PARTS) this.onmsg({ type: 'fieldDone', id });
  },
  dd(id, key, deal, c) {
    if (this.ddBoard !== id || !this.dw) { if (this.dw) this.dw.terminate(); this.dw = this.mk(); this.ddBoard = id; if (this.dw) this.dw.onerror = () => this.onmsg({ type: 'dd', id, key, t: null }); }
    if (this.dw) this.dw.postMessage({ type: 'dd', id, key, deal, c, limit: 4e7 });
    else setTimeout(() => this.onmsg({ type: 'dd', id, key, t: E.ddContract(deal, c, 1.5e6) }), 50);
  },
  fallback(msg) {
    let i = msg.from;
    const step = () => {
      if (i >= msg.to) { this.partDone(msg.id); return; }
      const r = E.simulateTable(msg.deal, msg.board, msg.cards, E.FIELD_AGG[i % E.FIELD_AGG.length]);
      this.onmsg({ type: 'table', id: msg.id, i, r }); i++; setTimeout(step, 30);
    };
    setTimeout(step, 500);
  },
  onmsg(m) {
    const L = this.live[m.id]; if (!L) return; const f = L.f;
    if (m.type === 'table') f.tables.push(m.r);
    if (m.type === 'part') { this.partDone(m.id); return; }
    if (m.type === 'fieldDone' && !f.done) {
      f.done = true;
      const cnt = {}; let best = null;
      for (const t of f.tables) { if (t.passed) continue; const k = conId(t.c); cnt[k] = (cnt[k] || 0) + 1; if (!best || cnt[k] > cnt[conId(best)]) best = t.c; }
      f.normC = best;
      if (best) this.dd(m.id, 'norm', L.deal, best);
      const e = HIST.find(h => h.id === m.id);
      if (e) { applyField(e, f); Store.saveRec(e); scheduleSync(); if (e.tour && e.tour.table == null) tourSend(e); }
    }
    if (m.type === 'dd') { f.dd[m.key] = m.t; const e = HIST.find(h => h.id === m.id); if (e) e.dd = { ...f.dd }; }
    if (m.type === 'error') this.partDone(m.id);
    if (G && G.id === m.id) { save(); if (ui.overlay === 'end') showEnd(); if (G.phase === 'done') render(); else renderBar(); }
  },
};
// an individual tournament board: your side's score, and your score against the robot tables once they are done
function tourSend(e) {
  const ew = sideOf(e.seat) === 1;
  Net.tourResult(e.tour.id, e.tour.b, ew ? -e.ns : e.ns, ew ? "EW" : "", e.imp != null ? [e.imp, e.mp] : null, conTxt(e));
}
// a contract and its result in a few characters, e.g. "4♠ S +1" or "3NT× W -2"
const conTxt = e => e.passed || !e.c ? "Pass" : e.c.level + STR[e.c.strain] + (e.c.dbl === 1 ? "X" : e.c.dbl === 2 ? "XX" : "") + " " + 'NESW'[e.c.decl] + " " + (d => d > 0 ? '+' + d : d === 0 ? '=' : String(d))(e.tricks - (e.c.level + 6));
function applyField(e, f) {
  if (!f || !f.done || !f.tables.length) return;
  const fus = f.tables.map(t => sideOf(e.seat) === 0 ? t.ns : -t.ns);
  const cmp = E.compare(e.us, fus); e.imp = cmp.imp; e.mp = cmp.mp;
  e.norm = f.normC ? conKey(f.normC) : 'Pass';
  e.fieldList = f.tables.map(t => ({ k: t.passed ? 'Pass' : conKey(t.c), t: t.tricks ?? null, ns: t.ns }));
}

/* ================= game flow ================= */
/* a never-seen deal; in practice mode, one where our side gets to use the chosen convention */
function freshDeal(dealer) {
  const want = SET.practice, cards = sideCards(), t0 = performance.now();
  let fallback = null;
  for (let i = 0; i < 20000; i++) {
    const d = E.shuffle([...Array(52).keys()]);
    const deal = [0, 1, 2, 3].map(k => d.slice(k * 13, k * 13 + 13));
    const key = E.dealKey(deal);
    if (SEEN.has(key)) continue;
    if (want) {
      const auc = [];
      while (!auctionOver(auc) && auc.length < 60) { const t = (dealer + auc.length) % 4; const r = E.aiBid(auc, t, deal[t], cards); auc.push({ seat: t, call: r.call, m: r.m }); }
      const mine = auc.some(e => e.seat === U() && e.m && e.m.cv === want);
      const ours = auc.some(e => sideOf(e.seat) === sideOf(U()) && e.m && e.m.cv === want);
      if (!mine && !ours) { if (performance.now() - t0 < 4000) continue; }
      else if (!mine) { if (!fallback) fallback = { deal, key }; if (performance.now() - t0 < 2500) continue; }
      if (!mine && !ours && fallback) { SEEN.add(fallback.key); saveSeen(); return fallback.deal; }
      if (!mine && !ours) flash('No practice deal found quickly — here is a normal deal', 2500);
    }
    SEEN.add(key); saveSeen(); return deal;
  }
  throw new Error('could not find an unseen deal');
}
/* replay: a deal to play again or an entered deal; boardNo: board number for an entered deal (sets dealer and vulnerability) */
function newBoard(replay, boardNo, tour) {
  clearTimeout(timer);
  if (!replay) BOARD++;
  const bn = boardNo || BOARD;
  const deal = replay ? replay.map(h => h.slice()) : freshDeal(dealerOf(bn));
  UNDO.length = 0;
  G = { id: Date.now().toString(36) + E.rnd(1e6).toString(36), board: bn, dealer: dealerOf(bn), deal, auction: [], phase: 'bid', play: null, result: null, claimed: false, field: null, tour: tour || null, cards: sideCards() };
  Object.assign(ui, { selLvl: 0, hintBid: null, hintCard: null, lastExpl: null, toast: null, overlay: null, photoMsg: null, photoHands: null, signal: null });
  $('ov').hidden = true;
  Field.start(G);
  save(); render(); tick();
}
const bidTurn = () => (G.dealer + G.auction.length) % 4;

/* ---- undo: a snapshot is taken right before each call or card of yours ---- */
const UNDO = [];
const ME = () => (online() ? Net.me : "local");
// who acted at a seat: a human id ("local" offline) or "robot"
const actor = seat => (online() ? Net.owner(seat) : (G.phase === "bid" ? (seat === U() ? "local" : "robot") : (userControls(seat) ? "local" : "robot")));
function pushUndo(by) { const { field, ...rest } = G; UNDO.push({ by: by || "local", s: JSON.stringify(rest) }); if (UNDO.length > 120) UNDO.shift(); }
/* take back the last call or card of player "who" (and everything played after it) */
function undo(who) {
  who = who || ME();
  if (guest()) { Net.send({ t: "undo" }); return; }
  let i = UNDO.length - 1; while (i >= 0 && UNDO[i].by !== who) i--;
  if (i < 0) return false;
  clearTimeout(timer);
  const wasDone = G.phase === "done", id = G.id, snap = UNDO[i];
  UNDO.length = i;
  G = JSON.parse(snap.s);
  G.field = Field.live[id] ? Field.live[id].f : null;
  if (wasDone) { HIST = HIST.filter(h => h.id !== id); closeOv(); }
  Object.assign(ui, { selLvl: 0, hintBid: null, hintCard: null, toast: null });
  save(); render(); tick();
  return true;
}
// al: an alert from a person at an online table (what the call means, shown to everyone when they tap it)
function makeCall(seat, call, m, al) {
  if (guest()) { if (bidTurn() === seat && userControls(seat)) { ui.selLvl = 0; ui.hintBid = null; Net.send({ t: "call", call, al }); } return; }
  if (G.phase !== "bid" || bidTurn() !== seat || !isLegal(G.auction, seat, call)) return;
  { const who = actor(seat); if (who !== "robot") pushUndo(who); }
  if (!m) m = E.explainCall(G.auction, seat, call, G.cards);
  G.auction.push(al ? { seat, call, m, al: String(al).slice(0, 120) } : { seat, call, m });
  ui.selLvl = 0; ui.hintBid = null;
  if (auctionOver(G.auction)) {
    const c = contractOf(G.auction);
    if (!c) { finishBoard(); return; }
    G.play = E.newPlayState(G.deal, c, G.auction, G.cards); G.phase = 'play';
    Field.dd(G.id, 'you', G.deal, c);
    const us = sideOf(c.decl) === sideOf(U());
    flash(us ? (c.decl === U() ? 'You are declarer' : 'Partner is declarer — you play both hands') : 'You are defending', 1800);
  }
  save(); render(); tick();
}
function userControls(seat) {
  if (online()) return Net.owner(seat) === Net.me;
  if (!G.play) return seat === U();
  return seat === U() || (sideOf(G.play.contract.decl) === sideOf(U()) && sideOf(seat) === sideOf(U()));
}
function playCard(seat, c) {
  const g = G.play;
  if (guest()) { if (userControls(seat)) Net.send({ t: "card", c }); return; }
  if (G.phase !== "play" || g.turn !== seat || g.trick.length >= 4 || !E.legalFor(g, seat).includes(c)) return;
  { const who = actor(seat); if (who !== "robot") pushUndo(who); }
  // explain the signal when your robot partner (on defence) discards or encourages
  if (!userControls(seat) && g.history.length < 3 && sideOf(seat) === sideOf(U()) && sideOf(g.contract.decl) !== sideOf(U())) { const t = E.signalText(g, seat, c); if (t) ui.signal = t; }
  else if (userControls(seat) && !g.trick.length) ui.signal = null;
  E.applyCard(g, seat, c); ui.hintCard = null; ui.showLast = false;
  save(); render(); tick();
}
function collectTrick() {
  const g = G.play; if (!g || g.trick.length < 4) return;
  E.collect(g);
  if (E.handsEmpty(g)) { finishBoard(); return; }
  save(); render(); tick();
}
function finishBoard() {
  const g = G.play; let e;
  if (!g) e = { id: G.id, ts: Date.now(), board: G.board, seat: U(), passed: true, ns: 0, us: 0 };
  else {
    const c = g.contract, dt = g.tricks[sideOf(c.decl)];
    const sc = scoreOf(c.level, c.strain, c.dbl, vulOf(G.board, c.decl), dt), ns = sideOf(c.decl) === 0 ? sc : -sc;
    e = { id: G.id, ts: Date.now(), board: G.board, seat: U(), c: { ...c }, tricks: dt, ns, us: sideOf(U()) === 0 ? ns : -ns };
  }
  e.deal = G.deal;
  // the auction and the cards played trick by trick, for looking back at the board from Results
  e.dealer = G.dealer;
  e.auc = G.auction.map(a => [a.seat, a.call]);
  if (g) { e.pl = g.history.map(t => t.cards.map(x => [x.s, x.c])); if (G.claimed) e.claimedAt = g.history.length; }
  if (G.field) { applyField(e, G.field); e.dd = { ...(G.field.dd || {}) }; }
  G.result = e; G.phase = 'done';
  if (online() && !guest()) Net.boardDone(e);
  if (G.tprac) { const c = tourCompare(G.tprac.id, G.tprac.b, e); if (c) { e.tprac = c; flash('🏆 ' + T('Against the tournament ({0} players): {1} IMP · {2}%', c.n, fmtSigned(c.imp), c.mp), 4500); } }
  if (G.tour && !online()) { e.tour = G.tour; tourSend(e); }
  else if (G.tour && G.tour.table != null && online() && !guest()) { e.tour = G.tour; Net.tourTableResult(G.tour.id, G.tour.table, G.tour.b, e.ns, conTxt(e)); }
  HIST = HIST.filter(h => h.id !== e.id); HIST.push(e);
  Store.saveRec(e);
  save(); render();
  scheduleSync();
}
function tick() {
  clearTimeout(timer); if (!G || guest()) return; // when you are a guest, the host runs the table
  const robot = s => online() ? Net.owner(s) === "robot" : (G.phase === "bid" ? s !== U() : !userControls(s));
  if (G.phase === "bid") {
    const t = bidTurn();
    if (robot(t)) timer = setTimeout(() => { const r = E.aiBid(G.auction, t, G.deal[t], G.cards); makeCall(t, r.call, r.m); }, delay());
  } else if (G.phase === 'play') {
    const g = G.play;
    if (g.trick.length === 4) timer = setTimeout(collectTrick, Math.max(700, delay() + 300));
    else if (robot(g.turn)) {
      const t = g.turn, left = g.hands[t].length;
      // a robot side about to lead may claim the rest (asked once per trick, near the end of the board)
      const mayClaim = !g.trick.length && g.rcl !== g.history.length && robot(pd(t)) && left >= 2 && left <= 8;
      timer = setTimeout(async () => { if (mayClaim && await robotClaim(g, t)) return; if (G && G.play === g && g.turn === t) playCard(t, E.aiPlay(g, t)); }, delay());
    }
    else if (!userControls(g.turn)) { /* a friend is to play */ }
    else { const leg = E.legalFor(g, g.turn); if (leg.length === 1 && g.trick.length > 0 && SET.auto) timer = setTimeout(() => playCard(g.turn, leg[0]), 450); }
  }
}
/* ---- claims: the claimer says how many of the remaining tricks they take; the other side accepts or not.
   Robots on the other side check the claim double dummy (they accept only what can really be made). ---- */
const tricksLeft = () => G.play.hands[G.play.leader].length;
// the claimer picks the number of tricks (all of them first)
function claim(seat) {
  const g = G.play; if (!g || G.phase !== "play" || g.trick.length) return;
  const left = tricksLeft();
  openOv('claim', `<h2>${T('Claim')}</h2><div class="muted">${T('How many of the remaining {0} tricks do you take?', left)}</div>
    <div class="claimn">${Array.from({ length: left + 1 }, (_, i) => left - i).map(n => `<button class="btn ${n === left ? 'new' : ''}" data-claimn="${n}">${n === left ? T('All {0}', n) : n}</button>`).join('')}</div>
    <div class="row2"><button class="btn" id="oClose">${T('Cancel')}</button></div>`);
}
function claimChosen(n) {
  closeOv();
  if (guest()) { Net.send({ t: "claim", n }); flash(T('Claim sent — waiting for the other side'), 2000); return; }
  requestClaim(G.play.turn, n);
}
// humans on the side that has to agree (online: their ids; "host" is this device)
function agreeOwners(side) {
  if (!online()) return [];
  return [...new Set([0, 1, 2, 3].filter(s => sideOf(s) !== side).map(s => Net.owner(s)).filter(o => o !== 'robot'))];
}
async function requestClaim(seat, n, who) {
  const g = G.play; if (!g || G.phase !== 'play' || g.trick.length) return;
  const side = sideOf(seat), left = tricksLeft(), id = G.id, name = who || (online() ? Net.st.names[seat] || SEAT[seat] : T('You'));
  const humans = agreeOwners(side);
  let ok;
  if (humans.length) ok = await Net.askOwners(humans, { kind: 'claim', who: name, n, left, hands: g.hands });
  else {
    const v = E.ddFull(g.hands, g.leader, side, g.trump, 3e6);
    ok = v != null && n <= v;
    if (!ok) flash(v == null ? T('Could not work it out yet — play a little longer') : T('The robots do not accept: {0} tricks at most', v), 2600);
  }
  if (!G || G.id !== id || G.phase !== 'play' || G.play !== g) return;
  if (online()) Net.note(ok ? T('{0} claimed {1} of the last {2} tricks — accepted', name, n, left) : T('{0} claimed {1} of the last {2} tricks — not accepted', name, n, left));
  if (ok) applyClaim(side, n);
}
function applyClaim(side, n) {
  const g = G.play, left = tricksLeft();
  g.tricks[side] += n; g.tricks[1 - side] += left - n; g.hands = g.hands.map(() => []); G.claimed = true;
  finishBoard();
}
/* a robot side that will surely take every remaining trick claims them and asks the humans on the other side */
async function robotClaim(g, seat) {
  g.rcl = g.history.length;
  const side = sideOf(seat), left = tricksLeft();
  const v = E.ddFull(g.hands, g.leader, side, g.trump, 1e6);
  if (v !== left) return false;
  const owners = online() ? agreeOwners(side) : ['host'];
  if (!owners.length) return false;
  const ok = await Net.askOwners(owners, { kind: 'rclaim', who: T('Robots'), n: left, left, hands: g.hands });
  if (!G || G.play !== g || G.phase !== 'play') return true;
  if (online()) Net.note(ok ? T('The robots claimed the last {0} tricks — accepted', left) : T('The robots claimed the last {0} tricks — play goes on', left));
  if (ok) applyClaim(side, left); else tick();
  return true;
}
/* an undo at an online table: the humans on the other side agree first (with robots there it happens at once) */
async function requestUndo(owner, name, seat) {
  const what = G.phase === 'bid' ? 'call' : 'move';
  const humans = seat == null ? [] : agreeOwners(sideOf(seat)).filter(o => o !== owner);
  if (humans.length && !(await Net.askOwners(humans, { kind: 'undo', who: name, what }))) return false;
  const ok = undo(owner);
  // no note in the table chat: the cards simply go back
  return ok;
}
// the text of a question to the other side (claim, robot claim, undo)
function askText(a) {
  if (a.kind === 'claim') return T('{0} claims {1} of the last {2} tricks', a.who, a.n, a.left);
  if (a.kind === 'rclaim') return T('The robots claim all of the last {0} tricks', a.left);
  return T('{0} wants to take back their last {1}', a.who, T(a.what || 'move'));
}
// a yes/no question inside the page (instead of the browser's own pop-up with the site's address)
function askYes(text, yes) {
  ui.yesFn = yes;
  openOv('yes', `<div class="big">${esc(text)}</div><div class="row2"><button class="btn new" id="yesOk">${T('Yes')}</button><button class="btn" id="oClose">${T('No')}</button></div>`);
}
// a question shown on this device: Accept / Decline
function askLocal(a, fin) {
  ui.askFin = fin;
  // a claim: every remaining card is shown open on the table itself, with a small Accept / Decline in the middle
  const hs = Array.isArray(a.hands) && a.hands.length === 4 ? a.hands.map(h => (Array.isArray(h) ? h : []).map(Number).filter(c => c >= 0 && c < 52)) : null;
  if (hs && G && G.phase === 'play') { ui.ask = { a, hands: hs }; render(); beep(); return; }
  openOv('ask', `<h2>❓ ${T('Do you agree?')}</h2><div class="big">${esc(askText(a))}</div>
    <div class="row2"><button class="btn new" data-askr="1">${T('Accept')}</button><button class="btn" data-askr="0">${T('Decline')}</button></div>`);
  beep();
}
// the question is over (answered here, answered by someone else, or timed out)
function askClose() {
  if (ui.ask) { ui.ask = null; render(); }
  if (ui.overlay === 'ask') closeOv();
}
/* play the same deal again (at an online table: for everyone) */
function replayDeal() {
  if (guest()) { Net.send({ t: "replay" }); HIST = HIST.filter(h => h.id !== G.id); closeOv(); return; }
  const d = G.deal; HIST = HIST.filter(h => h.id !== G.id); BOARD = G.board; newBoard(d);
}
function flash(msg, ms) { ui.toast = msg; render(); setTimeout(() => { if (ui.toast === msg) { ui.toast = null; render(); } }, ms); }

/* ================= rendering ================= */
// the seat drawn at the bottom: normally yours; while your robot partner declares and you play both hands,
// the declarer's hand (for that board only — it switches back when the board ends)
const viewSeat = () => { if (G && G.phase === 'play' && G.play) { const d = G.play.contract.decl; if (d === pd(U()) && userControls(d)) return d; } return U(); };
const rel = seat => (seat - viewSeat() + 4) % 4;
const ORDER = [3, 2, 0, 1];
const sortHand = h => h.slice().sort((a, b) => ORDER.indexOf(S(a)) - ORDER.indexOf(S(b)) || R(b) - R(a));
function cardHtml(c, cls) {
  const s = S(c), r = R(c), face = r >= 9 && r <= 11;
  return `<div class="card${red(s) ? ' rd' : ''}${face ? ' face' : ''}${cls ? ' ' + cls : ''}" data-c="${c}"><span class="ix"><b>${RTXT[r]}</b><i>${SUIT[s]}</i></span><span class="pip">${face ? `<em>${RTXT[r]}</em>` : ''}${SUIT[s]}</span></div>`;
}
const handsNow = () => G.phase === "play" ? (ui.ask && ui.ask.hands) || G.play.hands : G.deal;   // a claim being asked shows every remaining card
function isVisible(seat) {
  if (ui.ask && ui.ask.hands && G.phase === "play") return true;
  if (guest()) return handsNow()[seat].every(c => c >= 0); // the host only sends the cards you may see
  if (seat === U() || G.phase === "done") return true;
  if (G.phase !== 'play') return false;
  const g = G.play;
  if (seat === g.dummy && g.dummyShown) return true;
  return sideOf(g.contract.decl) === sideOf(U()) && seat === pd(U()) && g.dummyShown;
}
function ctlInfo(seat) {
  const g = G.play; const ctl = !ui.ask && G.phase === 'play' && g.turn === seat && userControls(seat) && g.trick.length < 4;
  return { ctl, leg: ctl ? E.legalFor(g, seat) : [] };
}
function fanHtml(seat, max) {
  const { ctl, leg } = ctlInfo(seat);
  const h = sortHand(handsNow()[seat]);
  return `<div class="fan" data-max="${max}">${h.map(c => cardHtml(c, (ctl ? (leg.includes(c) ? 'play' : 'dim') : '') + (c === ui.hintCard ? ' hint' : ''))).join('')}</div>`;
}
function dummyCols(seat) {
  const { ctl, leg } = ctlInfo(seat), h = handsNow()[seat];
  return `<div class="dcols">${ORDER.map(s => `<div class="dcol">${E.desc(E.inSuit(h, s)).map(c => cardHtml(c, 'dc' + (ctl ? (leg.includes(c) ? ' play' : ' dim') : '') + (c === ui.hintCard ? ' hint' : ''))).join('')}</div>`).join('')}</div>`;
}
function vHand(seat) {
  const { ctl, leg } = ctlInfo(seat);
  let o = '<div class="vh">';
  for (const s of ORDER) {
    const cs = E.desc(E.inSuit(handsNow()[seat], s));
    o += `<div class="row"><span class="sy${red(s) ? ' red' : ''}">${SUIT[s]}</span>${cs.map(c => `<span class="mini${red(s) ? " rd" : ""}${ctl ? (leg.includes(c) ? " play" : " dim") : ""}${c === ui.hintCard ? " hint" : ""}" data-c="${c}">${RTXT[R(c)]}<i>${SUIT[s]}</i></span>`).join('')}</div>`;
  }
  return o + '</div>';
}
function seatLabel(seat) {
  const g = G.play, tags = [];
  if (seat === G.dealer && G.phase === 'bid') tags.push('<span class="tag">D</span>');
  if (g && seat === g.contract.decl) tags.push('<span class="tag">Decl</span>');
  if (g && seat === g.dummy) tags.push('<span class="tag">Dummy</span>');
  const nm = online() && Net.st.names[seat];
  // your own seat shows your name (the one you use at online tables), other seats the player's name or "Robot"
  let myNm = ""; try { myNm = localStorage.getItem("bridge-table-name") || ""; } catch (e) {}
  const mine = (online() && Net.st.names[U()]) || myNm;
  let who = seat === meSeat() ? (mine || "You") : nm ? nm + (Net.st.away && Net.st.away[seat] ? " (" + T("away · robot plays") + ")" : g && userControls(seat) ? " (you play)" : "") : (g && userControls(seat) ? "You play" : "Robot");
  // the host can tap a player's name to remove them from the table (a robot takes the seat)
  if (online() && !guest() && nm && seat !== meSeat()) who = `<b class="pname" data-kickask="${seat}" title="${T('Remove')}">${esc(who)}</b>`;
  else if (seat === meSeat()) who = `<b class="pname" data-who="${esc(myNm() || T('You'))}">${esc(who)}</b>`;   // your own label opens your card (to change what the others see)
  const turn = (G.phase === 'bid' && bidTurn() === seat) || (G.phase === 'play' && g.turn === seat);
  return `<span class="lbl${turn ? ' turn' : ''}"><span class="${vulOf(G.board, seat) ? 'vn' : ''}">${SEAT[seat]}</span> ${who} ${tags.join('')}</span>`;
}
const backs = n => `<span class="backs">${'<i></i>'.repeat(Math.min(n, 13))}</span>`;
function renderBar() {
  if (!G) return;
  const b = G.board, u = U(), uNS = sideOf(u) === 0;
  const topbot = uNS ? vulOf(b, 0) : vulOf(b, 1), lr = uNS ? vulOf(b, 1) : vulOf(b, 0);
  const dst = ['bottom:-1px;left:50%;transform:translateX(-50%)', 'left:1px;top:50%;transform:translateY(-50%)', 'top:-1px;left:50%;transform:translateX(-50%)', 'right:1px;top:50%;transform:translateY(-50%)'][rel(G.dealer)];
  let con = '—', tr = '';
  if (G.play) { const c = G.play.contract; con = `${callHtml(B(c.level, c.strain))}${c.dbl === 1 ? ' X' : c.dbl === 2 ? ' XX' : ''} <span class="sm">${SEAT[c.decl]}</span>`; const us = sideOf(u); tr = `${T('Us')} <b class="tk">${G.play.tricks[us]}</b> · ${T('Them')} <b class="tk">${G.play.tricks[1 - us]}</b>`; }
  const g = G.play;
  const canClaim = G.phase === "play" && !g.trick.length && userControls(g.turn) && g.hands[g.turn].length <= 8 && g.hands[g.turn].length > 0;
  const last = HIST.length ? HIST[HIST.length - 1] : null;
  const lastTxt = last ? (last.imp != null ? (SET.mode === 'IMP' ? fmtSigned(last.imp) + ' IMP' : last.mp + '%') : fmtSigned(last.us || 0)) : '&nbsp;';
  const per = Store.periods(HIST)[0];
  const dayTxt = SET.mode === 'IMP' ? (per.scored ? fmtSigned(per.impSum) + ' IMP' : '—') : (per.mpAvg != null ? per.mpAvg + '%' : '—');
  $('bar').innerHTML = `
   <div class="vulbox" title="Board ${b}" style="border-color:${topbot ? 'var(--vul)' : '#f4f4f0'} ${lr ? 'var(--vul)' : '#f4f4f0'}">${b}<span class="dl" style="${dst}">D</span></div>
   <button class="box" id="bAuc" title="Show the auction"><small>${T('Contract')}</small><b>${con}</b><span class="tr">${tr || '&nbsp;'}</span></button>
   <div class="box"><small>${T('Today')}</small><b>${dayTxt}</b><span class="tr">${T('last:')} ${lastTxt}</span></div>
   <div class="spacer"></div>
   <div class="tools">
     <button class="btn" id="bHome" title="${T('Home')}">⌂</button>
     <button class="btn new${ui.confirmNew > Date.now() ? ' warn' : ''}" id="bNew">${ui.confirmNew > Date.now() ? T('Sure?') : T('New Deal')}</button>
     <button class="btn" id="bUndo" ${(guest() ? G.phase !== "done" || true : UNDO.some(u => u.by === ME())) ? "" : "disabled"}>${T('Undo')}</button>
     <button class="btn gold" id="bHint">${T('Hint')}</button>
     <button class="btn" id="bClaim" ${canClaim ? '' : 'disabled'}>${T('Claim')}</button>
     ${guest() ? `<button class="btn" id="nLeave" title="${T("Leave")}">🚪<span class="lbt"> ${T("Leave")}</span></button>` : online() ? `<button class="btn" id="nStop" title="${T("Close table")}">🚪<span class="lbt"> ${T("Close table")}</span></button>` : `<button class="btn" id="bLeave" title="${T("Leave")}">🚪<span class="lbt"> ${T("Leave")}</span></button>`}
     ${typeof Net !== "undefined" ? (n => `<button class="btn${n ? " gold" : ""}" id="bChat" title="${T('Chat')}">💬<span class="cbl"> ${T('Chat')}</span>${n ? `<span class="cbn">${n}</span>` : ""}</button>`)((Net.st.unread || 0) + (Net.st.lunread || 0)) : ""}
     <span class="menuwrap"><button class="btn" id="bMenu" title="${T('Menu')}" aria-expanded="${ui.menu ? 'true' : 'false'}">☰</button>${ui.menu ? `<div class="menu" role="menu">
       <button class="btn${online() ? " gold" : ""}" id="bNet">${online() ? T("Online") + " ●" : T("Online")}</button>
       <button class="btn" id="bBell" title="${T("Sound when it is your turn")}">${(SET.alert || "online") === "off" ? "🔕 " + T("Turn sound off") : "🔔 " + T("Turn sound on")}</button>
       <button class="btn" id="bHist">📜 ${T('History')}</button>
       <button class="btn" id="bRes">📊 ${T('Results')}</button>
       <button class="btn" id="bSet">⚙ ${T('Settings')}</button>
       <button class="btn" id="bHelp">❔ ${T('Help')}</button>
     </div>` : ''}</span>
   </div>`;
}
function explHtml(e, prefix) {
  if (!e) return 'Tap any call to see what it means.';
  const m = e.m || {}, ci = m.cv ? E.convInfo(m.cv) : null;
  if (e.al) return `<b>${prefix || SEAT[e.seat] + ':'} ${callHtml(e.call)}</b> <span class="al">⚠ ${T('Alert')}</span> ${esc(e.al)}<div class="muted">${T('Robot reading')}: ${symText(m.t)}</div>`;
  return `<b>${prefix || SEAT[e.seat] + ':'} ${callHtml(e.call)}</b> — ${symText(m.t)}${ci ? `<div class="cv"><span>${ci.n}</span>${symText(ci.d)}</div>` : ''}`;
}
// rv: a finished board from Results ({ board, dealer, seat, sel }): its calls are tapped with data-ri
function auctionTable(auction, phaseBid, rv) {
  const cols = [3, 0, 1, 2], board = rv ? rv.board : G.board, me = rv ? rv.seat : U(), sel = rv ? rv.sel : ui.lastExpl;
  let o = '<table><thead><tr>' + cols.map(s => `<th class="${vulOf(board, s) ? 'v' : ''} ${s === me ? 'me' : ''}">${SEAT[s]}</th>`).join('') + '</tr></thead><tbody><tr>';
  let col = cols.indexOf(rv ? rv.dealer : G.dealer); for (let i = 0; i < col; i++) o += '<td></td>';
  auction.forEach((e, i) => { o += `<td><span class="c${i === sel ? ' sel' : ''}${e.m && e.m.cv ? ' cvb' : ''}${e.al ? ' alrt' : ''}" ${rv ? 'data-ri' : 'data-ai'}="${i}">${callHtml(e.call)}${e.al ? '!' : ''}</span></td>`; col++; if (col === 4) { o += '</tr><tr>'; col = 0; } });
  if (phaseBid) o += '<td>?</td>';
  return o + '</tr></tbody></table>';
}
function auctionPanel() {
  // the explanation appears only when you tap a call (or ask for a hint); tap again to close it
  const e = ui.hintBid ? { call: ui.hintBid.call, m: ui.hintBid.m } : (ui.lastExpl != null ? G.auction[ui.lastExpl] : null);
  const ex = e ? explHtml(e, ui.hintBid ? 'Suggestion:' : null) : '';
  return `<div class="auction">${auctionTable(G.auction, G.phase === 'bid')}</div>${e && SET.expl ? `<div class="expl" id="dExpl" role="button" tabindex="0">${ex}</div>` : `<div class="muted tap">${T("Tap a call to see what it means")}</div>`}`;
}
/* online waiting room: who sits where, free seats to take, and the host's Start button */
const esc = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
// start screen: shown when the app opens, before anything is dealt
function idleG() { const g = lobbyG(); g.id = "idle"; g.phase = "idle"; return g; }
// Start on the start screen: carry on with the saved board, or deal a new one
function resume() {
  const s = ui.saved; ui.saved = null;
  if (!s || s.phase === "done") { newBoard(); return; }
  G = s; if (!G.field || !G.field.done) Field.start(G); else Field.live[G.id] = { f: G.field, deal: G.deal, board: G.board };
  render(); tick();
}
function idleHtml() {
  const cont = ui.saved && ui.saved.phase !== "done";
  return `<div class="lobby"><h3>Bridge Table</h3><div class="muted">Nothing is dealt yet. ${cont ? "Your last board is waiting." : ""}</div>
    <div class="row2"><button class="btn new" id="bGo">${cont ? "Continue" : "Start"}</button><button class="btn" id="bNet">Online</button></div>
    ${typeof Net !== "undefined" ? Net.pendHtml() + `<h3>Open tables</h3>` + Net.tablesHtml() : ""}</div>`;
}
function lobbyG() {
  const bn = BOARD + 1;
  return { id: "lobby-" + Date.now().toString(36), board: bn, dealer: dealerOf(bn), deal: [[], [], [], []], auction: [], phase: "lobby", play: null, result: null, claimed: false, field: null, cards: sideCards() };
}
/* a small card table: who sits at each side (cells by seat) and something on the felt in the middle;
   bottom: the seat drawn at the bottom */
function seatTable(cells, mid, bottom) {
  const pos = s => ["s", "w", "n", "e"][(s - bottom + 4) % 4];
  return `<div class="tbl">${[0, 1, 2, 3].map(s => `<div class="tseat ${pos(s)}"><small>${SEAT[s]}</small>${cells[s]}</div>`).join("")}<div class="tmid">${mid}</div></div>`;
}
// the waiting room of an online table, drawn as the table itself
function lobbyHtml() {
  const nm = Net.st.names || {}, me = U(), away = Net.st.away || {};
  const cell = s => {
    const who = nm[s];
    if (!who) return `<i>${T("Robot")}</i>${guest() ? `<button class="btn" data-sit="${s}">${T("Sit here")}</button>` : ""}`;
    return `<b>${esc(who)}${s === me ? " " + T("(you)") : ""}</b>${away[s] ? `<em>${T("away · robot plays")}</em>` : ""}${!guest() && s !== me ? `<button class="btn" data-kick="${s}">${T("Remove")}</button>` : ""}`;
  };
  const mid = guest() ? `<div class="muted">${T("Waiting for the host to start.")}<br>${T("“Sit here” asks the host to move you.")}</div><button class="btn" id="nLeave">🚪 ${T("Leave the table")}</button>`
    : `<button class="btn new" id="bStart">${T("Start")}</button><button class="btn" id="bNet">${T("Online")}</button>`;
  const inv = guest() ? "" : `<div class="grp"><span>👥 ${T("Invite players")}${Net.st.priv ? " · 🔒 " + T("Private table") : ""}</span>${Net.peopleHtml()}</div>`;
  return `<div class="lobby"><h3>${T("Online table")}</h3>${guest() ? "" : Net.pendHtml()}${seatTable([0, 1, 2, 3].map(cell), mid, me)}${inv}${Net.scoreHtml()}</div>`;
}
function renderTable() {
  for (let seat = 0; seat < 4; seat++) {
    const r = rel(seat), el = $('pos' + r);
    if (r === 0) { el.innerHTML = fanHtml(seat, 78) + seatLabel(seat); continue; }
    let inner = '';
    // dummy opposite you is laid out as on a real table: one column per suit
    if (isVisible(seat)) inner = r === 2 ? (G.phase === 'play' && seat === G.play.dummy ? dummyCols(seat) : fanHtml(seat, 78)) : vHand(seat);
    else if (G.phase === 'play') inner = backs(G.play.hands[seat].length);
    el.innerHTML = seatLabel(seat) + inner;
  }
  $('table').classList.toggle('bidding', G.phase === 'bid');
  const C = $('center');
  $("table").classList.toggle("lobby", G.phase === "lobby" || G.phase === "idle"); document.body.classList.toggle("inlobby", G.phase === "lobby" || G.phase === "idle");
  if (G.phase === "lobby" || G.phase === "idle") { C.innerHTML = G.phase === "idle" ? idleHtml() : lobbyHtml(); return; }
  if (G.phase === 'bid') C.innerHTML = auctionPanel();
  else if (G.phase === 'play' && ui.ask) C.innerHTML = `<div class="askbox"><div>❓ ${esc(askText(ui.ask.a))}</div><div class="row2"><button class="btn new" data-askr="1">${T('Accept')}</button><button class="btn" data-askr="0">${T('Decline')}</button></div></div>`;   // a claim: the hands are open, the question sits in the middle
  else if (G.phase === 'play') {
    // tap the table to look at the last finished trick; tap again (or wait) to come back
    const H = G.play.history, last = ui.showLast && H.length ? H[H.length - 1] : null;
    const tr = last ? last.cards : G.play.trick, w = last ? last.w : (tr.length === 4 ? E.trickWinner(tr, G.play.trump) : -1);
    // the card just played slides in from its player; a full trick then slides to the side that won it
    const akey = G.id + ':' + H.length + ':' + G.play.trick.length, fresh = ui.animKey !== akey; ui.animKey = akey;
    C.innerHTML = `<div class="trick${last ? " lasttrick" : ""}" id="trickArea">` + tr.map((x, i) => cardHtml(x.c, "tc p" + rel(x.s) + (x.s === w ? " win" : "") + (!last && i === tr.length - 1 && fresh ? " fly" : "") + (!last && tr.length === 4 ? " gather g" + rel(w) : ""))).join("") + (last ? `<div class="lastlbl">Last trick (${H.length}) — won by ${SEAT[last.w]}</div>` : (H.length && !tr.length ? `<div class="lasthint">${T("Tap here to see the last trick")}</div>` : "")) + "</div>";
  } else {
    // end of board: all four hands stay open on the table, the result sits in a banner in the middle
    const e = G.result;
    C.innerHTML = e ? `<button class="donebanner" id="oShow">${resultLine(e)}${e.imp != null ? `<small>${fmtSigned(e.imp)} IMP · ${e.mp}% MP</small>` : (G.field && !G.field.done ? `<small>Robot tables: ${G.field.tables.length}/${G.field.n || 10}…</small>` : "")}<small>${T("Tap for details")}</small></button><button class="btn new" id="oNext2" style="align-self:center;margin-top:8px">${T("Next deal")}</button>` : '';
  }
  if (ui.toast) C.insertAdjacentHTML('beforeend', `<div class="toast" id="toast">${ui.toast}</div>`);
  layoutFans();
}
function layoutFans() {
  document.querySelectorAll('.fan').forEach(el => {
    const n = el.children.length; if (!n) return;
    const W = el.clientWidth, max = +el.dataset.max || 70;
    // classic cards: as wide as fits, and on short screens low enough for the hand to stay in view
    if (SET.style !== "modern") { const cw = Math.max(20, Math.min(60, (W - (n - 1)) / n, innerHeight * 0.2 / 1.95)); el.style.setProperty("--cw", cw + "px"); el.style.setProperty("--ov", "1px"); return; }
    const cw = Math.max(28, Math.min(max, W / (1 + (n - 1) * 0.44)));
    const step = n > 1 ? Math.min(cw * 1.04, (W - cw) / (n - 1)) : 0;
    el.style.setProperty('--cw', cw + 'px'); el.style.setProperty('--ov', (step - cw) + 'px');
  });
}
function renderBidbox() {
  const bb = $('bidbox');
  if (G.phase !== 'bid' || bidTurn() !== meSeat()) { bb.innerHTML = ''; bb.dataset.k = ''; bb.hidden = true; return; }
  bb.hidden = false; const L = legalCalls(G.auction, U());
  const lv = [1, 2, 3, 4, 5, 6, 7].map(l => `<button data-lvl="${l}" class="${ui.selLvl === l ? 'sel' : ''}" ${L.some(c => isNum(c) && LV(c) === l) ? '' : 'disabled'}>${l}</button>`).join('');
  const sts = [0, 1, 2, 3, 4].map(s => { const c = ui.selLvl ? B(ui.selLvl, s) : -1; return `<button data-call="${c}" class="st${red(s) ? ' r' : ''}${s === 4 ? ' nt' : ''}" ${ui.selLvl && L.includes(c) ? '' : 'disabled'}>${STR[s]}</button>`; }).join('');
  const html = `<div class="row"><button data-call="P" class="pass">${T('Pass')}</button><button data-call="X" class="dbl" ${L.includes('X') ? '' : 'disabled'}>${T('Double')}</button><button data-call="XX" class="rdbl" ${L.includes('XX') ? '' : 'disabled'}>${T('Redouble')}</button></div><div class="row">${lv}</div><div class="row">${sts}</div>`;
  // redraw only when something changed, so the alert text being typed keeps its focus
  if (bb.dataset.k !== html) { bb.dataset.k = html; bb.innerHTML = html; const i = $('alTxt'); if (i) i.value = ui.alertTxt || ''; }
}
function renderStatus() {
  let s = "";
  // at an online table the player's name is shown when a friend (not a robot) is to act
  const nameOf = seat => { if (!online()) return SEAT[seat]; const o = Net.owner(seat), at = Object.keys(Net.st.names).find(k => (Net.guest ? Net.st.ctl[k] : (Net.st.seats[k] || "robot")) === o); return o !== "robot" && at != null ? Net.st.names[at] : SEAT[seat]; };
  if (G.phase === 'bid') s = bidTurn() === meSeat() ? T('Your call') : T('{0} is thinking…', nameOf(bidTurn()));
  else if (G.phase === "play" && ui.ask) s = T("Do you agree?");
  else if (G.phase === 'play') { const g = G.play; if (g.trick.length === 4) s = T('Gathering the trick…'); else if (userControls(g.turn)) s = g.turn === U() ? T('Your turn: play a card') : T("Play from {0}'s hand", SEAT[g.turn]); else s = T('{0} is playing…', nameOf(g.turn)); }
  else if (G.phase === "idle") s = T("Press Start to deal");
  else if (G.phase === "lobby") s = guest() ? T("Waiting for the host to start") : T("Waiting for players — press Start when everyone is seated");
  else s = T('Board finished');
  $("status").innerHTML = s + (ui.signal && G.phase === "play" ? `<div class="sig">${symText(ui.signal)}</div>` : "");
}
function render() {
  if (!G) return; document.body.classList.toggle("classic", SET.style !== "modern");
  const home = G.phase === 'idle';
  document.body.classList.toggle('athome', home); $('home').hidden = !home;
  if (home) { renderHome(); renderDock(); return; }
  renderBar(); renderTable(); renderBidbox(); renderStatus(); turnAlert(); renderDock();
}
/* ---- chat while playing: a column on the right on a wide screen; on a phone (or a narrow window) a panel that
   opens from the bottom with 💬 and closes after Send. At an online table there are two tabs: table and lobby. ---- */
// who is in the lobby: tap a name to write to that player privately
function whoHtml() {
  friendsCheck();
  const names = Net.knownNames().sort((a, b) => isFriend(b) - isFriend(a)), un = n => { const c = Object.entries(Net.st.dmUnread).find(([k, v]) => v && Net.st.dms[k] && Net.st.dms[k].name.toLowerCase() === n.toLowerCase()); return c ? ` <span class="badge">${c[1]}</span>` : ''; };
  return names.length ? `<small>${T('In the lobby')}:</small> ${names.map(n => `<button class="whob" data-who="${esc(n)}">${isFriend(n) ? '★' : '●'} ${esc(n)}${(s => s ? ` <small>${s}</small>` : '')(Net.sysShort(Net.profOf(n)))} 💬${un(n)}</button>`).join('')}` : `<small>${T('Nobody else is in the lobby right now.')}</small>`;
}
const dockWide = () => window.matchMedia('(min-width:1100px)').matches;
function toggleDock() {
  if (dockWide()) { const i = $('dMsg'); if (i) i.focus(); return; }
  ui.dockOpen = !ui.dockOpen; renderDock();
  if (ui.dockOpen) setTimeout(() => { const i = $('dMsg'); if (i) i.focus(); }, 50);
}
// the new-message count on 💬 in the top bar
function chatBadge() {
  const bc = $('bChat'), n = (Net.st.unread || 0) + (Net.st.lunread || 0); if (!bc) return;
  let s = bc.querySelector('.cbn');
  if (n) { if (!s) { s = document.createElement('span'); s.className = 'cbn'; bc.appendChild(s); } s.textContent = n; } else if (s) s.remove();
  bc.classList.toggle('gold', !!n);
}
function renderDock() {
  const d = $('dock'); if (!d || typeof Net === 'undefined' || !G) return;
  const athome = G.phase === 'idle', wide = dockWide();
  chatBadge();
  const cb = $('chatBtn'); if (cb) { cb.hidden = athome || wide; const n = (Net.st.unread || 0) + (Net.st.lunread || 0); const s = $('chatBtnN'); if (s) s.textContent = n ? '(' + n + ')' : ''; }
  const show = !athome && (wide || ui.dockOpen);
  document.body.classList.toggle('withdock', !athome && wide);
  d.hidden = !show; if (!show) return;
  const tbl = online(), tab = tbl ? (ui.dockTab || 'table') : 'lobby';
  const key = tab + ':' + tbl + ':' + SET.lang;
  if (d.dataset.key !== key) {
    d.dataset.key = key;
    const tabs = tbl ? `<div class="dtabs"><button data-dtab="table" class="${tab === 'table' ? 'on' : ''}">${T('Table')} <span id="dTn"></span></button><button data-dtab="lobby" class="${tab === 'lobby' ? 'on' : ''}">${T('Lobby')} <span id="dLn"></span></button></div>` : `<b>💬 ${T('Lobby chat')}</b>`;
    d.innerHTML = `<div class="dhead">${tabs}<span class="dbtns"><button class="btn mini-btn" id="dClear" title="${T('Clear the chat')}">🗑</button><button class="btn mini-btn dclose" id="dClose">✕</button></span></div>${tab === "lobby" ? `<div class="who" id="dWho"></div>` : ""}<div class="lmsgs" id="dList"></div>
      ${tab === 'table' ? `<div class="quick">${Net.QUICK.map(q => `<button data-dq="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}
      <div class="row2"><input class="tok" id="dMsg" maxlength="200" placeholder="${T('Write a message…')}"><button class="btn gold" id="dSend">${T('Send')}</button></div>`;
  }
  const html = tab === 'table' ? Net.tchatHtml() : Net.lchatHtml(), L = $('dList');
  if (L && L.innerHTML !== html) { L.innerHTML = html; L.scrollTop = L.scrollHeight; }
  { const w = $('dWho'), h = whoHtml(); if (w && w.innerHTML !== h) w.innerHTML = h; }
  if (tab === 'table') Net.st.unread = 0; else Net.st.lunread = 0;
  const tn = $('dTn'), ln = $('dLn');
  if (tn) tn.textContent = Net.st.unread ? '(' + Net.st.unread + ')' : '';
  if (ln) ln.textContent = Net.st.lunread ? '(' + Net.st.lunread + ')' : '';
  chatBadge();
}
function dockSend(text) {
  text = String(text || '').trim(); if (!text) return;
  if (online() && (ui.dockTab || 'table') === 'table') Net.sendChat(text); else Net.lsend(text);
  // the panel stays open after sending; it is closed with ✕
  renderDock();
}
window.addEventListener('resize', () => renderDock());
// "Start": play alone (not listed in the lobby) or open to others (listed; players can ask to join, you accept)
function showStartChoice() {
  openOv('start', `<h2>${T('Start')}</h2>
    <button class="btn new choice" data-solo="priv"><b>🤖 ${T('Alone with robots')}</b><small>${T('Shown in the lobby, nobody can join.')}</small></button>
    <button class="btn choice" data-solo="pub"><b>🌍 ${T('Open to others')}</b><small>${T('Shown in the lobby: players can ask to join, you accept.')}</small></button>
    <div class="row2"><button class="btn" id="oClose">${T('Cancel')}</button></div>`);
}
/* the table is waiting for you: a sound and a note even with the turn sound off */
function nudged(secs) {
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  beep(); flash('⏰ ' + T('Your turn — the table is waiting ({0} s)', secs), 3500);
}
/* the host keeps an eye on the clock: a player who has not called or played for 45 seconds is reminded, again
   at 90; the host is told and can tap the name to remove a player who has gone */
setInterval(() => {
  if (!G || !online() || guest() || (G.phase !== 'bid' && G.phase !== 'play')) { ui.slow = null; return; }
  const g = G.play, s = G.phase === 'bid' ? bidTurn() : g.turn;
  if (G.phase === 'play' && g.trick.length === 4) return;
  const id = Net.owner(s), key = G.id + ':' + G.auction.length + ':' + (g ? g.history.length * 4 + g.trick.length : 0);
  if (id === 'robot') { ui.slow = null; return; }
  if (!ui.slow || ui.slow.key !== key) { ui.slow = { key, t0: Date.now(), n: 0 }; return; }
  const secs = Math.round((Date.now() - ui.slow.t0) / 1000);
  if ((secs >= 45 && ui.slow.n === 0) || (secs >= 90 && ui.slow.n === 1)) {
    ui.slow.n++; Net.nudge(id, secs);
    const who = Net.st.names[s] || SEAT[s];
    if (id !== Net.me && id !== 'host') flash('⏰ ' + T('{0} has not played for {1} s — tap the name to remove', who, secs), 4000);
  }
}, 5000);
/* a short sound and a buzz when it becomes your turn to bid or play (Settings: at online tables, always, or off) */
let AC = null;
function beep() {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1175, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + 0.24);
  } catch (e) {}
  try { navigator.vibrate && navigator.vibrate(90); } catch (e) {}
}
// browsers only allow sound after a tap: unlock it on the first one
document.addEventListener('pointerdown', () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {} }, { once: true });
function turnAlert() {
  const mode = SET.alert || 'online';
  const g = G.play, me = meSeat();
  const mine = me >= 0 && ((G.phase === 'bid' && bidTurn() === me) || (G.phase === 'play' && g.trick.length < 4 && userControls(g.turn)));
  const key = mine ? G.id + ':' + G.auction.length + ':' + (g ? g.history.length * 4 + g.trick.length : 0) : '';
  if (mine && key !== ui.alertKey && mode !== 'off' && (mode === 'always' || online())) beep();
  ui.alertKey = key;
}

/* ================= home page: start, open tables, our convention card and the lobby chat ================= */
const myNm = () => { try { return localStorage.getItem('bridge-table-name') || ''; } catch (e) { return ''; } };
function homeShell() {
  const langs = LANGS;
  const sec = (k, label) => `<button class="hsec" data-hsec="${k}">${label}</button>`;
  return `<div class="home">
  <header class="hhead"><div class="brand"><span class="suits">♠<i>♥</i><i>♦</i>♣</span>${T('Bridge Table')}</div>
    <div class="hhr"><label class="hlang" title="${T('Language')}">🌐 <select id="hLang" class="sel" aria-label="${T('Language')}">${langs.map(([v, l]) => `<option value="${v}" ${SET.lang === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button class="hico" id="bSet" title="${T('Settings')}" aria-label="${T('Settings')}">⚙︎</button><button class="hico" id="bHelp" title="${T('Help')}" aria-label="${T('Help')}">?</button></div></header>
  <div class="hgrid">
    <section class="hmain">
      <div class="hcard hero">
        <div class="hname hrow"><label><span>${T('Name')}</span><input id="hName" class="tok" maxlength="20" autocomplete="nickname" value="${esc(myNm())}" placeholder="${T('Name')}"></label>
        <label><span>${T('System')}</span><select id="hSys" class="sel">${E.SYSTEMS.map(s => `<option value="${s.k}" ${(SET.sys || 'twoone') === s.k ? 'selected' : ''}>${esc(({ twoone: '2/1 GF', sayc: 'SAYC', acol: 'Acol', sef: 'SEF', precision: 'Precision', polish: 'Polish Club' })[s.k] || s.n)}</option>`).join('')}</select></label><button class="btn hpeople" data-hsec="people" title="${T('Players in the lobby')}">👥<span class="hpl"> ${T('Players in the lobby')}</span> <b id="hPeopleN"></b></button></div>
        <div class="muted">${T('Play with robots, join a table or open your own.')}</div>
        <div class="hbtns"><button class="btn new" id="bGo"><span id="hGo"></span></button><button class="btn hopen" id="hOpen">🌐 ${T('Open an online table')}</button><button class="btn gold hquick" id="hQuick">${T('Seat me at a table')}</button><button class="btn htour" data-hsec="tours">🏆 ${T('Tournaments')}</button><div class="hrow3"><button class="btn hwatch" id="hWatch">👁 ${T('Watch a table')}</button><button class="btn hconv" data-hsec="conv">📋 ${T('Convention card')}</button></div></div>
        <div class="hsecs"><button class="hsec phoneonly" data-hsec="chat">💬 ${T('Lobby chat')} <span id="hChatN"></span></button></div>
        
        <button class="hstats" id="hStats" title="${T('Your rating')}"></button>
      </div>
      <div id="hSec"></div>
      <div id="hPend"></div>
      <div class="hcard"><h3>${T('Open tables')}</h3><div id="hTables"></div></div>
    </section>
    <aside class="hcard hchat"><h3>${T('Lobby chat')} <small id="hCount"></small><button class="btn mini-btn" id="lClear" title="${T('Clear the chat')}">🗑</button></h3><div class="who" id="hWho"></div><div class="lmsgs" id="hChat"></div>
      <div class="row2"><input class="tok" id="lMsg" maxlength="200" placeholder="${T('Write a message…')}"><button class="btn gold" id="lSend">${T('Send')}</button></div></aside>
  </div><div id="hSheet"></div></div>`;
}
// the section opened with the buttons at the top of the home page (tournaments, our card, players, chat on a phone)
function homeSection(k) {
  if (k === 'tours') return `<div class="hcard"><h3>🏆 ${T('Tournaments')}<button class="btn mini-btn" data-hsec="">✕</button></h3><div id="hTours"></div></div>`;
  if (k === 'conv') return `<div class="hcard"><h3>📋 ${T('Our convention card (with partner)')}<button class="btn mini-btn" data-hsec="">✕</button></h3><div id="hConv"></div></div>`;
  if (k === 'people') return `<div class="hcard"><h3>👥 ${T('Players in the lobby')}<button class="btn mini-btn" data-hsec="">✕</button></h3><div id="hPeople"></div></div>`;
  if (k === 'chat') return `<div class="hcard pchat"><h3>💬 ${T('Lobby chat')} <small id="pCount"></small><button class="btn mini-btn" data-hsec="">✕</button><button class="btn mini-btn" id="lClear">🗑</button></h3><div class="lmsgs" id="pChat"></div>
    <div class="row2"><input class="tok" id="lMsg2" maxlength="200" placeholder="${T('Write a message…')}"><button class="btn gold" id="lSend2">${T('Send')}</button></div></div>`;
  return '';
}
// our card: every convention with a switch; tap a name for its description
function convCardHtml() {
  // first the base system (your robot partner bids it too), then the conventions within it
  const cur = E.sysOf(SET.sys);
  return `<div class="grp"><span>${T('Base system')}</span><div class="seg sysseg" data-seg="sys">${E.SYSTEMS.map(s => `<button data-v="${s.k}" class="${cur.k === s.k ? 'on' : ''}">${esc(s.n.replace(/ \(.*\)/, ''))}</button>`).join('')}</div>
    <div class="muted">${symText(cur.d)}</div></div>
    <div class="grp"><span>${T('Conventions')}</span><div class="convs">${E.CONVS.map(c => `<label class="cvchip${SET.conv[c.k] ? ' on' : ''}" title="${esc(c.d)}"><input type="checkbox" data-conv="${c.k}" ${SET.conv[c.k] ? 'checked' : ''}>${esc(c.n)}</label>`).join('')}</div></div>`;
}
function renderHome() {
  const h = $('home'), N = typeof Net !== 'undefined' ? Net : null;
  if (h.dataset.lang !== SET.lang) { h.dataset.lang = SET.lang; h.innerHTML = homeShell(); }
  const set = (id, html) => { const el = $(id); if (el && el.innerHTML !== html) { el.innerHTML = html; return true; } return false; };
  const cont = ui.saved && ui.saved.phase !== 'done';
  set('hGo', cont ? T('Continue') : '🤖 ' + T('Play with robots'));
  { const hs = $('hSys'), v = SET.sys || 'twoone'; if (hs && hs.value !== v) hs.value = v; }   // also when it was changed on the convention card
  const per = Store.periods(HIST)[0];
  set('hStats', `${T('Today')}: ${per.n} ${T('boards')}${per.scored ? ' · ' + fmtSigned(per.impSum) + ' IMP' : ''}${per.mpAvg != null ? ' · ' + per.mpAvg + '% MP' : ''}${cont ? ' · ' + T('Your last board is waiting.') : ''}`);
  // the open section is rebuilt only when it changes (so typing in it is not lost); its contents are refreshed
  // the chat opens as a panel at the bottom of the screen (phones and narrow windows); the others under the buttons
  const hs = $('hSec'), want = ui.hsec || '', top = want === 'chat' ? '' : want;
  if (hs && hs.dataset.sec !== top) { hs.dataset.sec = top; hs.innerHTML = homeSection(top); }
  const sh = $('hSheet'), bot = want === 'chat' ? 'chat' : '';
  if (sh && sh.dataset.sec !== bot) { sh.dataset.sec = bot; sh.innerHTML = bot ? homeSection('chat') : ''; }
  document.querySelectorAll('[data-hsec]').forEach(b => b.classList.toggle('on', !!want && b.dataset.hsec === want));
  if (N) {
    set('hPend', N.pendHtml() ? `<div class="hcard">${N.pendHtml()}</div>` : '');
    set('hTables', N.tablesHtml());
    if (set('hChat', N.lchatHtml())) { const c = $('hChat'); c.scrollTop = c.scrollHeight; }
    if (set('pChat', N.lchatHtml())) { const c = $('pChat'); c.scrollTop = c.scrollHeight; }
    set('hCount', T('{0} in the lobby', N.lobbyCount())); set('pCount', T('{0} in the lobby', N.lobbyCount()));
    set('hChatN', want !== 'chat' && N.st.lunread ? '(' + N.st.lunread + ')' : '');
    if (want === 'chat') N.st.lunread = 0;
    set('hTours', toursHtml()); set('hPeople', N.peopleHtml());
    set('hWho', whoHtml());
    set('hPeopleN', String(N.lobbyCount()));   // how many are in the lobby, on the Players button
  }
  set('hConv', convCardHtml());
}
/* ---- tournaments: the deals come from the tournament's number, so every player and table gets the same boards ---- */
function tourDeal(t, b) {
  E.seed((t.seed ^ Math.imul(b, 2654435761)) >>> 0 || 1);
  const d = E.shuffle([...Array(52).keys()]);
  E.seed(null);
  return [0, 1, 2, 3].map(k => d.slice(k * 13, k * 13 + 13));
}
const myTour = id => ((Net.st.tres[id] || {})[Net.devId()] || { ns: {} }).ns;
const tableDone = (id, ti) => ((Net.st.tres[id] || {})['T' + ti + 'NS'] || { ns: {} }).ns;
// individual format: play the next board you have not played yet (or show the ranking when all are done)
function playTour(id) {
  const t = Net.st.tours[id]; if (!t) return;
  if (t.state !== 'live') { flash(T('This tournament has not started yet'), 2000); return; }
  if (t.format === 'tables') { if (t.joined[Net.devId()]) tableBoard(); return; }
  if (!t.joined[Net.devId()]) Net.tourAnswer(id, true);   // an individual tournament: anyone in the lobby can join it
  if (online()) { flash(T('Close the online table first'), 2000); return; }
  const done = myTour(id); let b = 1; while (b <= t.n && done[b] != null) b++;
  if (b > t.n) { showStandings(id); return; }
  // the first time you play a tournament you choose your seat; you keep it for all its boards
  const seat = tourSeats()[id] ?? (Object.keys(done).length ? 2 : null);   // boards already played from South keep South
  if (seat == null) { showTourSeat(id); return; }
  ui.saved = null; closeOv();
  newBoard(tourDeal(t, b), b, { id, b, n: t.n, seat });
  Net.shareInfo();   // the lobby sees this table with the tournament on it
  flash(T('Tournament board {0} of {1} — you sit {2}', b, t.n, SEAT[seat]), 2200);
}
const tourSeats = () => { try { return JSON.parse(localStorage.getItem('bridge-tour-seats') || '{}') || {}; } catch (e) { return {}; } };
function showTourSeat(id) {
  const t = Net.st.tours[id]; if (!t) return;
  openOv('tseat', `<h2>🏆 ${esc(t.name)}</h2><div class="big">${T('Where do you sit?')}</div>
    <div class="muted">${T('N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.')}</div>
    <div class="row2">${[0, 1, 2, 3].map(s => `<button class="btn${s === 2 ? ' new' : ''}" data-tsit="${s}" data-tid="${t.id}">${SEAT[s]}</button>`).join('')}</div>
    <div class="row2"><button class="btn" id="oClose">${T('Cancel')}</button></div>`);
}
// tables format: the table's host deals the next board this table has not played
function tableBoard() {
  const tt = Net.st.tour; if (!tt || !Net.host) return;
  const t = Net.st.tours[tt.id]; if (!t) return;
  const done = tableDone(tt.id, tt.ti); let b = 1; while (b <= t.n && done[b] != null) b++;
  if (b > t.n) { showStandings(tt.id); return; }
  closeOv();
  newBoard(tourDeal(t, b), b, { id: tt.id, b, n: t.n, table: tt.ti });
  Net.note(T('Tournament board {0} of {1}', b, t.n));
}
// the next deal after a board: tournaments go on with their own boards
function nextDeal() { if (G && G.tour) nextTourBoard(); else if (G && G.tprac) practiceTour(G.tprac.id, G.tprac.b + 1); else newBoard(); }
/* practice a tournament's boards again (yours or one you did not play): nothing is recorded in the tournament;
   after each board your score is compared with everyone who played it there */
function practiceTour(id, b) {
  const t = Net.st.tours[id]; if (!t) return;
  if (b > t.n) { G = idleG(); ui.saved = null; render(); showStandings(id); return; }
  if (online()) { flash(T('Close the online table first'), 2000); return; }
  ui.saved = null; closeOv();
  newBoard(tourDeal(t, b), b);
  G.tprac = { id, b, n: t.n }; save();
  flash('🔁 ' + T('Practice: board {0} of {1}', b, t.n), 2000);
}
// your result on a tournament board against the results of the players who played it in the tournament
function tourCompare(id, b, e) {
  const R = Net.st.tres[id] || {}, me = Net.devId(), ns = sideOf(e.seat) === 0;
  const L = Object.entries(R).filter(([k, r]) => k !== me && !(k[0] === 'T' && r.dir === 'EW') && r.ns && r.ns[b] != null).map(([, r]) => { const v = r.dir === 'EW' ? -r.ns[b] : r.ns[b]; return ns ? v : -v; });
  if (!L.length) return null;
  const c = E.compare(e.us, L); return { imp: c.imp, mp: c.mp, n: L.length };
}
// the ranking: matchpoints between the entries on each board, and cross-IMPs (average over the others).
// At tables, N-S pairs are compared with N-S pairs and E-W pairs with E-W pairs.
function tourRank(id) {
  const t = Net.st.tours[id], R = Net.st.tres[id] || {}, keys = Object.keys(R);
  const rows = keys.map(k => ({ k, name: R[k].name, dir: R[k].dir || '', n: 0, mp: 0, mpMax: 0, imp: 0, pts: 0 }));
  for (let b = 1; b <= t.n; b++) {
    for (const dir of [...new Set(rows.map(r => r.dir))]) {
      const P = rows.filter(r => r.dir === dir && R[r.k].ns[b] != null);
      for (const r of P) {
        r.n++; const me = R[r.k].ns[b]; r.pts += me;
        const others = P.filter(o => o !== r); if (!others.length) continue;
        let imp = 0;
        for (const o of others) { const v = R[o.k].ns[b]; r.mp += me > v ? 2 : me === v ? 1 : 0; r.mpMax += 2; imp += E.imps(me - v); }
        r.imp += imp / others.length;
      }
    }
  }
  rows.forEach(r => { r.pct = r.mpMax ? Math.round(r.mp / r.mpMax * 1000) / 10 : null; r.imp = Math.round(r.imp * 10) / 10; });
  // every board is also played at 10 robot tables: each entry's average IMPs and MP % against them, so there
  // is a ranking even before anyone else has played
  rows.forEach(r => {
    const F = Object.values(R[r.k].f || {});
    r.fn = F.length; r.fImp = F.length ? Math.round(F.reduce((a, x) => a + x[0], 0) / F.length * 100) / 100 : null;
    r.fMp = F.length ? Math.round(F.reduce((a, x) => a + x[1], 0) / F.length * 10) / 10 : null;
  });
  const byImp = t.scoring === 'imp', vsOthers = rows.some(r => r.mpMax);
  const field = (a, b) => byImp ? (b.fImp ?? -99) - (a.fImp ?? -99) : (b.fMp ?? -1) - (a.fMp ?? -1);
  return rows.sort((a, b) => (vsOthers ? (byImp ? b.imp - a.imp : (b.pct ?? -1) - (a.pct ?? -1)) || (byImp ? (b.pct ?? -1) - (a.pct ?? -1) : b.imp - a.imp) : 0) || field(a, b) || b.pts - a.pts);
}
function standingsHtml(id) {
  const t = Net.st.tours[id], me = Net.devId(), rows = tourRank(id);
  if (!rows.length) return `<div class="muted">${T('Nobody has played yet.')}</div>`;
  const dirs = [...new Set(rows.map(r => r.dir))];
  return dirs.map(dir => {
    const L = rows.filter(r => r.dir === dir);
    return `${dir ? `<h3>${dir === 'NS' ? 'N–S' : 'E–W'}</h3>` : ''}<div class="resscroll"><table class="res"><thead><tr><th>#</th><th>${T(t.format === 'tables' ? 'Pair' : 'Player')}</th><th class="n">${T('boards')}</th><th class="n">MP %</th><th class="n">IMP</th><th class="n">${T('Points')}</th><th class="n" title="${T('Against 10 robot tables')}">🤖 IMP</th><th class="n" title="${T('Against 10 robot tables')}">🤖 MP %</th></tr></thead><tbody>${L.map((r, i) => `<tr class="${r.k === me ? 'meRow' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td class="n">${r.n}/${t.n}</td><td class="n">${r.pct ?? '—'}</td><td class="n">${r.mpMax ? fmtSigned(r.imp) : '—'}</td><td class="n">${fmtSigned(r.pts)}</td><td class="n">${r.fImp == null ? '…' : fmtSigned(r.fImp)}</td><td class="n">${r.fMp == null ? '…' : r.fMp}</td></tr>`).join('')}</tbody></table></div>`;
  }).join('');
}
function showStandings(id) {
  const t = Net.st.tours[id]; if (!t) return;
  // boards you played before the robot scores were shared: send them now from your own results
  const mine = (Net.st.tres[id] || {})[Net.devId()];
  for (const e of HIST) if (e.tour && e.tour.id === id && e.tour.table == null && e.imp != null && !(mine && mine.f && mine.f[e.tour.b] && mine.c && mine.c[e.tour.b])) tourSend(e);
  const done = t.format === 'tables' ? 0 : Object.keys(myTour(id)).length;
  openOv('tour', `<h2>🏆 ${esc(t.name)}</h2><div class="muted">${T('{0} boards', t.n)} · ${t.format === 'tables' ? T('{0} tables', t.tables.length) : T('individual')} · ${T('ranked by {0}', t.scoring === 'imp' ? 'IMP' : 'MP %')} · ${T('started by {0}', esc(t.by))}</div>
    ${standingsHtml(id)}<div class="muted">🤖 ${T('= your score against 10 robot tables that played the same boards; it ranks the players until others have played.')}</div>
    ${otherTablesHtml(id)}
    <div class="row2">${t.format !== 'tables' && t.state === 'live' && done < t.n ? `<button class="btn new" data-tplay="${t.id}">${done ? T('Continue') : T('Play')}</button>` : ''}${t.format === 'tables' || done >= t.n ? `<button class="btn" data-tprac="${t.id}">🔁 ${T('Practice these boards')}</button>` : ''}<button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
/* "Other tables": pick a board and see what everyone did on it (contract, result, score, IMPs against the robots);
   your own board opens in the replay */
function otherTablesHtml(id) {
  const t = Net.st.tours[id], R = Net.st.tres[id] || {}, me = Net.devId();
  const played = b => Object.values(R).some(r => r.ns && r.ns[b] != null);
  const bd = ui.tbd && ui.tbd.id === id ? ui.tbd.b : ([...Array(t.n).keys()].map(i => i + 1).find(played) || 1);
  const L = Object.entries(R).filter(([, r]) => r.ns && r.ns[bd] != null).sort((a, b) => b[1].ns[bd] - a[1].ns[bd]);
  const myE = HIST.slice().reverse().find(e => e.tour && e.tour.id === id && e.tour.b === bd);
  const rows = L.map(([k, r]) => `<tr class="${k === me ? 'meRow' : ''}${k === me && myE ? ' rev' : ''}"${k === me && myE ? ` data-rev="${myE.id}"` : ''}><td>${esc(r.name)}${r.dir === 'EW' ? ' <small>E–W</small>' : ''}</td><td>${esc((r.c || {})[bd] || '—')}</td><td class="n">${fmtSigned(r.ns[bd])}</td><td class="n">${r.f && r.f[bd] ? fmtSigned(r.f[bd][0]) : '…'}</td></tr>`).join('');
  return `<div class="grp"><span>${T('Other tables')}</span>
    <div class="seg tbds">${[...Array(t.n).keys()].map(i => i + 1).map(b => `<button data-tbd="${b}" data-tid="${t.id}" class="${b === bd ? 'on' : ''}${played(b) ? '' : ' dim'}">${b}</button>`).join('')}</div>
    ${L.length ? `<div class="resscroll"><table class="res"><thead><tr><th>${T('Player')}</th><th>${T('Contract')}</th><th class="n">${T('Score')}</th><th class="n">🤖 IMP</th></tr></thead><tbody>${rows}</tbody></table></div>${myE ? `<div class="muted">${T('Tap your own row to replay the board.')}</div>` : ''}`
      : `<div class="muted">${T('Nobody has played this board yet.')}</div>`}</div>`;
}
// the tournaments you organise, have joined, or are invited to
// tournaments removed from this player's list (with ✕)
const tourHidden = () => { try { return JSON.parse(localStorage.getItem('bridge-tours-hidden') || '[]') || []; } catch (e) { return []; } };
function toursHtml() {
  const me = Net.devId();
  const L = Object.values(Net.st.tours).filter(t => t.state !== 'off' && !tourHidden().includes(t.id) && (Net.isMine(t) || t.joined[me] || Net.invitedTo(t) || Net.openTour(t))).sort((a, b) => b.ts - a.ts);
  // a tournament list as on the big bridge sites: tabs, then one row per tournament with its details and actions
  const tab = ui.ttab || 'all';
  const inTab = t => tab === 'all' || (tab === 'reg' && t.state === 'setup') || (tab === 'run' && t.state === 'live') || (tab === 'mine' && (Net.isMine(t) || t.joined[me]));
  const left = t => { const ms = t.ts + t.hours * 3600e3 - Date.now(), h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3); return ms <= 0 ? '—' : h >= 24 ? T('{0} d {1} h', Math.floor(h / 24), h % 24) : T('{0} h {1} min', h, m); };
  const tabs = `<div class="seg ttabs">${[['all', T('All')], ['reg', T('Registering')], ['run', T('Running')], ['mine', T('Mine')]].map(([v, l]) => `<button data-tlist="${v}" class="${tab === v ? 'on' : ''}">${l} <small>${L.filter(t => v === 'all' || (v === 'reg' && t.state === 'setup') || (v === 'run' && t.state === 'live') || (v === 'mine' && (Net.isMine(t) || t.joined[me]))).length}</small></button>`).join('')}</div>`;
  const rows = L.filter(inTab).map(t => {
    const players = Math.max(Object.keys(t.joined).length, Object.keys(Net.st.tres[t.id] || {}).length);
    const status = t.state === 'setup' ? `<span class="tst reg">${T('Registering')}</span>` : `<span class="tst run">${T('Running')}</span>`;
    const r = tourRowBtns(t, me);
    return `<tr><td data-l=""><b>🏆 ${esc(t.name)}</b><small>${T('started by {0}', esc(t.by))}</small>${r.note ? `<small class="tnote">${r.note}</small>` : ''}</td>
      <td data-l="${T('Format')}">${t.format === 'tables' ? T('{0} tables', t.tables.length) : T('individual')}</td><td data-l="${T('Boards')}" class="n">${t.n}</td><td data-l="${T('Ranking')}">${t.scoring === 'imp' ? 'IMP' : 'MP %'}</td>
      <td data-l="${T('Players')}" class="n">${players}</td><td data-l="${T('Status')}">${status}</td><td data-l="${T('Ends in')}">${left(t)}</td>
      <td data-l="" class="tact">${r.btns}${Net.isMine(t) ? `<button class="btn tdel" data-tdel="${t.id}" title="${T('Cancel the tournament')}">✕</button>` : ''}</td></tr>`;
  }).join('');
  const table = rows ? `<div class="ttwrap"><table class="ttab"><thead><tr><th>${T('Tournament')}</th><th>${T('Format')}</th><th class="n">${T('Boards')}</th><th>${T('Ranking')}</th><th class="n">${T('Players')}</th><th>${T('Status')}</th><th>${T('Ends in')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="muted">${L.length ? T('No tournaments here.') : T('No tournaments yet. Create one and invite the players you want.')}</div>`;
  return `${tabs}${table}<div class="row2 tnew"><button class="btn gold" id="tNew">➕ ${T('New tournament')}</button></div>`;
}
// the action buttons of one tournament row (and a short note: an invitation, your table, how far you are)
function tourRowBtns(t, me) {
  const r = { btns: '', note: '' };
  if (t.state === 'setup') {
    r.btns = Net.isMine(t) ? `<button class="btn gold" data-tset="${t.id}">${T('Players and start')}</button>`
      : Net.invitedTo(t) ? `<button class="btn new" data-tyes="${t.id}">${T('Accept')}</button><button class="btn" data-tno="${t.id}">${T('Decline')}</button>`
      : Net.openTour(t) && !t.joined[me] ? `<button class="btn new" data-tyes="${t.id}">${T('Register')}</button>`
      : `<span class="muted">${T('Waiting for {0} to start', esc(t.by))}</span>`;
    if (Net.invitedTo(t)) r.note = `<b class="inv">${T('{0} invites you', esc(t.by))}</b>`;
  } else if (t.format === 'tables') {
    const seat = Net.myTourSeat(t), done = seat ? Object.keys(tableDone(t.id, seat.ti)).length : 0;
    if (seat) r.note = `${T('table {0}, you sit {1}', seat.ti + 1, SEAT[seat.seat])} · ${done}/${t.n}`;
    r.btns = (seat && done < t.n ? (seat.host && seat.seat === seat.hostSeat ? `<button class="btn new" data-ttab="${t.id}">${T('Open table {0}', seat.ti + 1)}</button>` : `<button class="btn new" data-tjtab="${t.id}">${T('Join table {0}', seat.ti + 1)}</button>`) : '') + `<button class="btn" data-tstand="${t.id}">${T('Standings')}</button>`;
  } else {
    const done = Object.keys(myTour(t.id)).length;
    if (t.joined[me]) r.note = T('you: {0}/{1}', done, t.n);
    r.btns = `${done < t.n ? `<button class="btn new" data-tplay="${t.id}">${done ? T('Continue') : t.joined[me] ? T('Play') : T('Register')}</button>` : ''}<button class="btn" data-tstand="${t.id}">${T('Standings')}</button>`;
  }
  return r;
}
/* the organiser's set-up: name, number of boards, format (individual, or tables with the players' seats named
   in advance), ranking, how long it is kept, and the players; then the invitations and Start */
function showTourSetup(id) {
  const t = Net.st.tours[id]; if (!t || !Net.isMine(t)) return;
  if (ui.overlay === 'tsetup' && ui.tsetId === id) readTourSeats();   // keep what was typed when the screen is redrawn
  ui.tsetId = id;
  const sel = ui.tsel && ui.tsel.id === id ? ui.tsel : (ui.tsel = { id, names: new Set(t.inv) });
  const known = [...new Set([...Net.knownNames(), ...sel.names])];
  const st = n => {
    const lk = String(n).toLowerCase();
    return Object.values(t.joined).some(v => v.toLowerCase() === lk) ? '<span class="ok">✓</span>' : Object.values(t.declined).some(v => v.toLowerCase() === lk) ? '<span class="no">✗</span>' : t.inv.some(x => x.toLowerCase() === lk) ? '<span class="wait">…</span>' : '';
  };
  const opt = (name, opts, cur) => `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tables = t.format === 'tables' ? (t.tables.length ? t.tables : [['', '', '', '']]) : [];
  const seatGrid = tables.map((row, ti) => `<div class="tsetrow"><b>${T('Table {0}', ti + 1)}</b>${[0, 1, 2, 3].map(s => `<label><small>${SEAT[s]}</small><input class="tok" list="tNames" maxlength="20" data-tseat="${ti}:${s}" value="${esc(row[s])}" placeholder="${T('Robot')}">${row[s] ? st(row[s]) : ''}</label>`).join('')}</div>`).join('');
  const accepted = Object.keys(t.joined).length - 1;
  openOv('tsetup', `<h2>🏆 ${T('New tournament')}</h2>
    <div class="grp"><span>${T('Tournament name')}</span><input class="tok wide" id="tName" maxlength="40" value="${esc(t.name)}"></div>
    <div class="grp"><span>${T('Boards')}</span>${opt('tn', [4, 6, 8, 10, 12, 16, 20, 24].map(n => [n, n]), t.n)}</div>
    <div class="grp"><span>${T('Format')}</span>${opt('tformat', [['ind', '👤 ' + T('individual')], ['tables', '🃏 ' + T('at tables')]], t.format)}
      <div class="muted">${t.format === 'tables' ? T('Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.') : T('Everyone plays the same deals at their own table, sitting South.')}</div></div>
    ${t.format === 'tables' ? `<div class="grp"><span>${T('Tables')}</span>${opt('ttables', [1, 2, 3, 4, 5, 6].map(n => [n, n]), tables.length)}<datalist id="tNames">${known.map(n => `<option value="${esc(n)}">`).join('')}</datalist>${seatGrid}</div>`
      : `<div class="grp"><span>${T('Players to invite')}</span>
      <div class="invlist">${known.length ? known.map(n => `<label class="invrow"><input type="checkbox" data-tinv="${esc(n)}" ${sel.names.has(n) ? 'checked' : ''}><b>${esc(n)}</b>${st(n)}</label>`).join('') : `<div class="muted">${T('Nobody else is in the lobby right now — type a name below.')}</div>`}</div>
      <div class="row2"><input class="tok" id="tAdd" maxlength="20" placeholder="${T('Add a player by name')}"><button class="btn" id="tAddBtn">${T('Add')}</button></div></div>`}
    <div class="grp"><span>${T('Ranking')}</span>${opt('tscoring', [['mp', 'MP %'], ['imp', 'IMP']], t.scoring)}</div>
    <div class="grp"><span>${T('Keep the tournament for')}</span>${opt('thours', [[3, T('{0} hours', 3)], [24, T('1 day')], [72, T('3 days')]], t.hours)}</div>
    <div class="grp"><span>${T('Answers')}</span><div>${esc(t.by)} <span class="ok">✓ ${T('organiser')}</span>${Object.values(t.joined).filter(n => n !== t.by).map(n => ` · ${esc(n)} <span class="ok">✓</span>`).join('')}${Object.values(t.declined).map(n => ` · ${esc(n)} <span class="no">✗</span>`).join('')}</div></div>
    <div class="row2"><button class="btn gold" id="tSend">${T('Send the invitations')}</button><button class="btn new" id="tGo">${T('Start the tournament')}</button></div>
    <div class="row2"><button class="btn" id="tCancel">${T('Cancel the tournament')}</button><button class="btn" id="oClose">${T('Close')}</button></div>`);
}
// read the seat names typed in the set-up into the tournament (organiser only)
function readTourSeats() {
  const t = Net.st.tours[ui.tsetId]; if (!t) return;
  document.querySelectorAll('[data-tseat]').forEach(i => { const [ti, s] = i.dataset.tseat.split(':').map(Number); if (t.tables[ti]) t.tables[ti][s] = i.value.trim().slice(0, 20); });
  const nm = $('tName'); if (nm && nm.value.trim()) t.name = nm.value.trim().slice(0, 40);
}
// a player's card: tap a name in the lobby to see their system and rating (your own Results stay on your device)
function showPlayer(name) {
  const me = name === T('You') || name.trim().toLowerCase() === (myNm() || '').trim().toLowerCase();
  const p = me ? Net.prof() : Net.profOf(name);
  const shown = me ? (myNm() || T('You')) : name, lvl = p && p.lvl, ctry = p && p.ctry;
  const w = me ? null : Net.whereIs(name);
  const where = me ? '' : !w ? '' : w.lobby ? T('In the lobby') : w.online ? T("At {0}'s table", w.host) : T('playing with robots');
  // all-time results only: boards, IMPs per board, MP %
  const tot = p && p.per ? p.per[4] : p ? [p.n, p.imp, p.mp] : null;
  const boards = tot ? tot[0] || 0 : 0;
  const fields = [
    [T('Country/Region'), ctry ? `${flagOf(ctry)} ${esc(ctryName(ctry))}` : '—'],
    [T('Skill level'), lvl ? `<span class="plvl l-${lvl}">${T(LEVEL_N[lvl])}</span>` : '—'],
    [T('Joined'), p && p.joined ? esc(p.joined) : '—'],
    [T('Logins'), p && p.logins ? loginsTxt(p.logins) : '—'],
    [T('Title'), `<b>${T(titleOf(boards))}</b>`],
  ];
  const conv = p ? convLine(p) : '';
  // your own card: change what the others see (name, system, level, country; the conventions on the card itself)
  const edit = me ? `<div class="pedit"><div class="pedh">✏️ ${T('Edit my card')}</div>
      <label><span>${T('Name')}</span><input id="pName" class="tok" maxlength="20" value="${esc(myNm())}" placeholder="${T('Name')}"></label>
      <label><span>${T('System')}</span><select id="pSys" class="sel">${E.SYSTEMS.map(s => `<option value="${s.k}" ${(SET.sys || 'twoone') === s.k ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select></label>
      <label><span>${T('Skill level')}</span><select id="pLvl" class="sel"><option value="">${T('Not set')}</option>${LEVELS.map(l => `<option value="${l}" ${SET.lvl === l ? 'selected' : ''}>${T(LEVEL_N[l])}</option>`).join('')}</select></label>
      <label><span>${T('Country/Region')}</span><select id="pCtry" class="sel"><option value="">${T('Not set')}</option>${COUNTRIES.map(c => [c, ctryName(c)]).sort((x, y) => x[1].localeCompare(y[1])).map(([c, n]) => `<option value="${c}" ${SET.ctry === c ? 'selected' : ''}>${flagOf(c)} ${esc(n)}</option>`).join('')}</select></label>
      <button class="btn pconvb" data-hsec="conv">📋 ${T('Convention card')}</button></div>` : '';
  openOv('player', `<div class="pcard">
    <div class="phead"><div class="pav">${esc((shown.trim()[0] || '?').toUpperCase())}</div>
      <div class="pmain"><div class="pnm">${esc(shown)}${!me && isFriend(name) ? ' <span class="pstar">★</span>' : ''}</div>
        <div class="psub">${where ? `<span class="pwhere">● ${esc(where)}</span>` : ''}</div></div></div>
    <table class="pfields">${fields.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
    ${conv ? `<div class="pconv">${conv}</div>` : ''}
    ${edit}
    ${tot ? `<table class="res ptot"><thead><tr><th></th><th class="n">${T('boards')}</th><th class="n">${T('IMP / board')}</th><th class="n">MP %</th></tr></thead><tbody><tr><td>${T('Total')}</td><td class="n">${boards}</td><td class="n">${tot[1] == null ? '—' : fmtSigned(tot[1])}</td><td class="n">${tot[2] == null ? '—' : tot[2] + '%'}</td></tr></tbody></table>`
      : `<div class="muted">${T('No rating yet — it shows once this player has played (with the new version).')}</div>`}
    </div>
    <div class="row2">${me ? '' : `<button class="btn gold" data-dm="${esc(name)}">💬 ${T('Message')}</button><button class="btn new" data-pairwith="${esc(name)}">🤝 ${T('Play as partners')}</button><button class="btn" data-friend="${esc(name)}">${isFriend(name) ? '★ ' + T('Friend') : '☆ ' + T('Add as friend')}</button>`}<button class="btn" id="oClose">${T('Close')}</button></div>`);
}
// how many times the app was opened, rounded the way profiles show it (5000+, 1000+, 500+ …)
function loginsTxt(n) { for (const s of [10000, 5000, 1000, 500, 100, 50]) if (n >= s) return s + '+'; return String(n); }
// a title from the boards played
function titleOf(n) { return n >= 5000 ? 'Grandmaster' : n >= 2000 ? 'Master' : n >= 500 ? 'Strategist' : n >= 100 ? 'Player' : 'Newcomer'; }
// the convention card in one line: system, notrump range and the conventions switched on (short names)
const CONV_SHORT = { rkc: 'RKCB 1430', gerber: 'Gerber', bergen: 'Bergen', capp: 'Capp', j2nt: 'Jacoby 2NT', wjs: 'WJS', stayman: 'Stayman', fourWay: '4-way transfers', smolen: 'Smolen', michaels: 'Michaels', splinter: 'Splinter', texas: 'Texas', texasInt: 'Texas over interference', leb: 'Lebensohl', lav: 'Lavinthal', invMin: 'Inverted minors', drury: 'Drury', nmf: 'NMF', fsf: '4th suit forcing', ogust: 'Ogust', supx: 'Support X', respx: 'Responsive X', sjs: 'Strong jump shifts', dont: 'DONT', gamb: 'Gambling 3NT' };
function convLine(p) {
  const y = p.sys ? E.sysOf(p.sys) : null;
  const head = y ? [{ twoone: '2/1', sayc: 'SAYC', acol: 'Acol', sef: 'SEF', precision: 'Precision', polish: 'Polish Club' }[y.k] || y.k, y.maj5 ? '5-card majors' : '4-card majors', '1NT ' + y.nt[0] + '-' + y.nt[1]] : [];
  const on = p.conv ? Object.keys(CONV_SHORT).filter(k => p.conv[k]).map(k => CONV_SHORT[k]) : [];
  return esc([...head, ...on].join(', '));
}
// the player card's level and country lists
const LEVELS = ['beg', 'int', 'adv', 'exp', 'wc'];
const LEVEL_N = { beg: 'Beginner', int: 'Intermediate', adv: 'Advanced', exp: 'Expert', wc: 'World class' };
const COUNTRIES = ['TR', 'NO', 'SE', 'DK', 'FI', 'IS', 'GB', 'IE', 'FR', 'DE', 'NL', 'BE', 'LU', 'CH', 'AT', 'IT', 'ES', 'PT', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'CY', 'HR', 'SI', 'RS', 'BA', 'UA', 'RU', 'EE', 'LV', 'LT', 'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CN', 'TW', 'HK', 'JP', 'KR', 'IN', 'ID', 'PK', 'AU', 'NZ', 'ZA', 'EG', 'IL', 'MA', 'AZ', 'GE', 'KZ'];
const flagOf = c => /^[A-Z]{2}$/.test(c || '') ? String.fromCodePoint(...[...c].map(x => 127397 + x.charCodeAt(0))) : '';
function ctryName(c) { try { return new Intl.DisplayNames([SET.lang || 'en'], { type: 'region' }).of(c) || c; } catch (e) { return c; } }
/* friends: ★ on a player's card; friends come first in the lobby list and you hear when one arrives */
const friends = () => { try { return JSON.parse(localStorage.getItem('bridge-friends') || '[]') || []; } catch (e) { return []; } };
const isFriend = n => friends().some(f => f.toLowerCase() === String(n).trim().toLowerCase());
function toggleFriend(n) {
  const L = friends().filter(f => f.toLowerCase() !== n.trim().toLowerCase());
  if (!isFriend(n)) L.push(n.trim().slice(0, 20));
  try { localStorage.setItem('bridge-friends', JSON.stringify(L.slice(-100))); } catch (e) {}
}
// the players at a table in the lobby right now (from the tables' information)
function lobbyNow() {
  const s = new Set();
  for (const t of (Net.st.tables || [])) for (const n of [t.host, ...Object.values(t.names || {})]) if (n) s.add(n.trim().toLowerCase());
  return s;
}
function friendsCheck() {
  const now = lobbyNow(), seen = ui.friendsHere || (ui.friendsHere = new Set());
  for (const f of friends()) {
    const k = f.toLowerCase();
    if (now.has(k) && !seen.has(k)) { seen.add(k); setTimeout(() => flash('★ ' + T('{0} is in the lobby', f), 3000), 0); }
    else if (!now.has(k)) seen.delete(k);
  }
}
// a private conversation with one player in the lobby
function showDm(name) {
  ui.dmWith = name; Net.st.dmUnread[name.trim().toLowerCase()] = 0;
  for (const k in Net.st.dmUnread) if (Net.st.dms[k] && Net.st.dms[k].name === name) Net.st.dmUnread[k] = 0;
  const conv = Object.values(Net.st.dms).find(c => c.name.toLowerCase() === name.toLowerCase());
  const t = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const list = conv && conv.list.length ? conv.list.map(m => `<div class="cm${m.me ? ' me' : ''}"><b>${esc(m.from)}</b> ${esc(m.text)}<small>${t(m.ts)}${m.me && m.id ? (m.ok ? ' ✓' : ' ⏳') : ''}</small></div>`).join('') : `<div class="muted">${T('Write a private message to {0}.', esc(name))}</div>`;
  const draft = $('dmMsg') ? $('dmMsg').value : '';
  openOv('dm', `<h2>✉ ${esc(name)}</h2><div class="lmsgs pop" id="dmList">${list}</div>
    <div class="row2"><input class="tok" id="dmMsg" maxlength="300" placeholder="${T('Write a message…')}" value="${esc(draft)}"><button class="btn gold" id="dmSend">${T('Send')}</button></div>
    <div class="row2"><button class="btn" id="oClose">${T('Close')}</button></div>`);
  const L = $('dmList'); if (L) L.scrollTop = L.scrollHeight;
  const i = $('dmMsg'); if (i) i.focus();
}
// lobby chat as a pop-up window (on phones the chat column is hidden)
function showLChat() {
  Net.st.lunread = 0;
  const draft = $('lMsg2') ? $('lMsg2').value : '';
  openOv('lchat', `<h2>💬 ${T('Lobby chat')} <small class="muted">${T('{0} in the lobby', Net.lobbyCount())}</small></h2><div class="lmsgs pop" id="ovLChat">${Net.lchatHtml()}</div>
    <div class="row2"><input class="tok" id="lMsg2" maxlength="200" placeholder="${T('Write a message…')}" value="${esc(draft)}"><button class="btn gold" id="lSend2">${T('Send')}</button></div>
    <div class="row2"><button class="btn" id="lClear">🗑 ${T('Clear the chat')}</button><button class="btn" id="oClose">${T('Close')}</button></div>`);
  const c = $('ovLChat'); if (c) c.scrollTop = c.scrollHeight;
  if (document.activeElement !== $('lMsg2') && draft) $('lMsg2').focus();
}
// after a tournament board: the next one, or the ranking when you have played them all
function nextTourBoard() {
  const id = G.tour.id, t = Net.st.tours[id];
  if (G.tour.table != null) { const left = t ? t.n - Object.keys(tableDone(id, G.tour.table)).length : 0; if (left > 0) tableBoard(); else { G = lobbyG(); render(); showStandings(id); } return; }
  const left = t ? t.n - Object.keys(myTour(id)).length : 0;
  if (left > 0) playTour(id); else { const s = G; G = idleG(); ui.saved = null; render(); showStandings(id); if (s) save(); }
}
// opening an online table always asks first: public (listed in the lobby) or private (only invited players)
function showOpenChoice() {
  if (online()) { Net.panel(); return; }
  openOv('open', `<h2>🌐 ${T('Open an online table')}</h2>
    <button class="btn new choice" data-open="pub"><b>🌍 ${T('Public table')}</b><small>${T('Listed in the lobby: anyone can ask to join, you accept.')}</small></button>
    <button class="btn choice" data-open="priv"><b>🔒 ${T('Private table')}</b><small>${T('Shown in the lobby with 🔒: invited players sit at once, others must ask you, no spectators.')}</small></button>
    <div class="row2"><button class="btn" id="oClose">${T('Cancel')}</button></div>`);
}
// back to the home page from a board played alone (the board is kept for Continue)
function goHome() {
  if (online()) { flash(T('Online') + ' ●', 1200); Net.panel(); return; }
  // leaving the table ends the board: the home page is fresh (no "Continue"), as when the app is opened
  clearTimeout(timer); ui.saved = null;
  G = idleG(); closeOv(); save(); render();
}

/* ================= overlays ================= */
function suitLine(cards, s) { const cs = E.desc(E.inSuit(cards, s)); return `${symHtml(s)} ${cs.length ? cs.map(c => RTXT[R(c)]).join(' ') : '—'}`; }
function dealHtml(deal, u) {
  const pos = ['s', 'w', 'n', 'e'];
  return '<div class="deal">' + [0, 1, 2, 3].map(seat => { const r = (seat - u + 4) % 4; return `<div class="h ${pos[r]}"><b>${SEAT[seat]}${seat === u ? ' (you)' : ''} · ${ev(deal[seat]).hcp} HCP</b>${ORDER.map(s => suitLine(deal[seat], s)).join('<br>')}</div>`; }).join('') + '</div>';
}
function resultLine(e) {
  if (e.passed) return 'Passed out';
  const c = e.c, d = e.tricks - (c.level + 6);
  return `${conKey(c)} · ${e.tricks} tricks (${d >= 0 ? (d ? '+' + d : '=') : d}) · <span class="${e.us >= 0 ? 'pos' : 'neg'}">${fmtSigned(e.us)}</span>`;
}
function openOv(name, html) { ui.overlay = name; $('ov').innerHTML = `<div class="sheet">${html}</div>`; $('ov').hidden = false; }
function closeOv() { if (ui.overlay === 'deal') { ui.photoHands = null; ui.photoMsg = null; } if (ui.overlay === 'rev') stopRev(); ui.overlay = null; $('ov').hidden = true; }
function showEnd() {
  const e = G.result; if (!e) return;
  const f = G.field || { tables: [], done: false, dd: {} };
  const ddTxt = (k, c) => { const v = f.dd[k]; if (v === undefined) return 'calculating…'; if (v === null) return 'not available'; const d = v - (c.level + 6); return `${v} tricks (${d >= 0 ? 'makes' : 'down ' + -d})`; };
  let fieldHtml;
  if (!f.done) fieldHtml = `<div class="muted">The robot tables are playing this deal… (${f.tables.length}/${f.n || 10})</div>`;
  else {
    const fus = t => sideOf(e.seat) === 0 ? t.ns : -t.ns;
    fieldHtml = `<table class="res"><thead><tr><th>Table</th><th>Contract</th><th>Tricks</th><th class="n">Score</th><th class="n">IMP</th></tr></thead><tbody>${f.tables.map((t, i) => `<tr><td>${i + 1}</td><td>${t.passed ? 'Pass' : conKey(t.c)}</td><td>${t.tricks ?? ''}</td><td class="n">${fmtSigned(fus(t))}</td><td class="n">${fmtSigned(E.imps(e.us - fus(t)))}</td></tr>`).join('')}</tbody></table>`;
  }
  const scoreTxt = e.imp != null ? `<div class="score2"><div class="${SET.mode === 'IMP' ? 'on' : ''}"><small>IMP</small><b>${fmtSigned(e.imp)}</b></div><div class="${SET.mode === 'MP' ? 'on' : ''}"><small>MP</small><b>${e.mp}%</b></div></div>` : '';
  const norm = f.normC;
  openOv('end', `<h2>Board ${e.board}</h2><div class="big">${resultLine(e)}</div>${G.claimed ? '<div class="muted">The remaining tricks were settled by claim.</div>' : ''}
   ${scoreTxt}
   <div class="grp"><span>Par check</span><div>Normal contract (most common at the robot tables): ${f.done ? (norm ? conKey(norm) + ' — double dummy ' + ddTxt('norm', norm) : 'Pass') : '…'}</div>
   ${e.c ? `<div>Your contract ${conKey(e.c)} — double dummy ${ddTxt('you', e.c)}</div>` : ''}</div>
   <div class="grp"><span>Robot tables</span>${fieldHtml}</div>
   ${dealHtml(G.deal, U())}
   <div class="row2"><button class="btn gold" id="oNext">Next deal</button><button class="btn" id="oReplay">Replay this deal</button><button class="btn" id="oClose">Close</button></div>`);
}
function showAuction() {
  if (!G.auction.length) return;
  openOv('auc', `<h2>Auction</h2><div class="auction">${auctionTable(G.auction, false)}</div><div class="expl">${explHtml(ui.lastExpl != null ? G.auction[ui.lastExpl] : null)}</div><div class="row2"><button class="btn gold" id="oClose">Close</button></div>`);
}
function showSettings() {
  const seg = (name, opts, cur) => `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const convs = E.CONVS.map(c => `<label class="cvrow"><input type="checkbox" data-conv="${c.k}" ${SET.conv[c.k] ? 'checked' : ''}><span><b>${c.n}</b>${c.x ? `<em class="xo">replaces ${E.CONVS.find(y => y.k === c.x).n}</em>` : ''}<small>${symText(c.d)}</small></span></label>`).join('');
  openOv('set', `<h2>Settings</h2>
   <button class="btn gold guide" id="bHelp2">📘 User guide — English · Norsk · Türkçe</button>
   <div class="grp"><span>Practice a convention</span><select id="sPractice" class="sel"><option value="">Off — normal random deals</option>${E.CONVS.map(c => `<option value="${c.k}" ${SET.practice === c.k ? 'selected' : ''}>${c.n}</option>`).join('')}</select><div class="muted">New deals are chosen so that you (or your partner) get to use this convention. It is switched on in your card automatically.</div></div>
   <div class="grp"><span>Play a specific deal</span><button class="btn" id="sDeal">Enter a deal (from a photo or a hand record)</button></div>
   <div class="grp"><span>Card style</span>${seg("style", [["classic", "Classic tiles"], ["modern", "Modern fan"]], SET.style || "classic")}</div>
   <div class="grp"><span>Your seat</span>${seg('seat', [[0, 'North'], [1, 'East'], [2, 'South'], [3, 'West']], SET.seat)}</div>
   <div class="grp"><span>Scoring</span>${seg('mode', [['IMP', 'IMP'], ['MP', 'Matchpoints (%)']], SET.mode)}</div>
   <div class="grp"><span>Opponents' system</span>${seg('opp', [['same', 'Same as ours'], ['sayc', 'Standard (SAYC)']], SET.opp)}</div>
   <div class="grp"><span>Robot speed</span>${seg('speed', [[0, 'Slow'], [1, 'Normal'], [2, 'Fast']], SET.speed)}</div>
   <div class="grp"><span>Bid explanations</span>${seg('expl', [[1, 'Show'], [0, 'Hide']], SET.expl ? 1 : 0)}</div>
   <div class="grp"><span>Play a forced card automatically</span>${seg('auto', [[1, 'On'], [0, 'Off']], SET.auto ? 1 : 0)}</div>
   <div class="grp"><span>Sound and buzz when it is your turn</span>${seg('alert', [['online', 'At online tables'], ['always', 'Always'], ['off', 'Off']], SET.alert || 'online')}</div>
   <div class="grp"><span>Our convention card (with partner)</span>${convCardHtml()}</div>
   <div class="grp"><span>Sync between devices (GitHub)</span><div class="muted">Scores, statistics and the list of deals you have seen are kept in a private gist on your GitHub account. Play offline on any device; everything merges when it is online again.</div>
   ${GitSync.enabled ? `<div><b>Connected.</b> ${syncState.msg || (GitSync.last ? "Last sync " + new Date(GitSync.last).toLocaleString() : "")}</div><div class="row2"><button class="btn gold" id="sNow">Sync now</button><button class="btn" id="sOff">Disconnect</button></div>` : `<div class="muted">1. Open <a href="https://github.com/settings/tokens/new?scopes=gist&description=Bridge%20Table" target="_blank" rel="noopener">github.com → new token</a> (scope: <b>gist</b> only, expiration: no expiration) and copy the token.<br>2. Paste it here on each device (PC and phone).</div><div class="row2"><input id="syncToken" type="password" autocomplete="off" placeholder="ghp_…" class="tok"><button class="btn gold" id="sSave">Connect</button></div>${syncState.msg ? `<div class="muted">${syncState.msg}</div>` : ""}`}</div>
   <div class="muted">Changes apply from the next deal.${Store.online ? ' Settings and scores are saved to your account.' : ' Scores are saved on this device.'} Every deal you get is new — a deal is never dealt to you twice.</div>
   <div class="row2"><button class="btn gold" id="oClose">Close</button><button class="btn" id="sReset">Delete score history</button></div>`);
}
/* ---- user guide in three languages: open it, or download it to read offline ---- */
function showHelp() {
  const base = /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname) ? "" : "https://servetsvm.github.io/bridge/";
  const row = (file, name, flag) => `<div class="helprow"><span>${flag} <b>${name}</b></span><a class="btn" href="${base}${file}" target="_blank" rel="noopener">Open</a><a class="btn gold" href="${base}${file}" download="${file.replace(".html", "")}-bridge-table.html">Download</a></div>`;
  openOv("help", `<h2>User guide</h2>
   <div class="muted">Explains every button and every option in Settings, the convention card, reading a deal from a photo, and syncing your phone and PC. Download it to keep it on your device and read it offline.</div>
   ${[["en", "guide-en.html", "English", "🇬🇧"], ["tr", "guide.html", "Türkçe", "🇹🇷"], ["no", "guide-no.html", "Norsk", "🇳🇴"], ["es", "guide-es.html", "Español", "🇪🇸"], ["fr", "guide-fr.html", "Français", "🇫🇷"], ["it", "guide-it.html", "Italiano", "🇮🇹"], ["de", "guide-de.html", "Deutsch", "🇩🇪"], ["ru", "guide-ru.html", "Русский", "🇷🇺"], ["pl", "guide-pl.html", "Polski", "🇵🇱"], ["zh", "guide-zh.html", "中文", "🇨🇳"]].sort((a, b) => (b[0] === SET.lang) - (a[0] === SET.lang)).map(([, f, n, fl]) => row(f, n, fl)).join("")}
   <div class="row2"><button class="btn gold" id="oClose">Close</button></div>`);
}
/* ---- entering a deal (hand record, PBN, or the code Claude reads from a photo) ---- */
const RANKS = { A: 12, K: 11, Q: 10, J: 9, T: 8, '9': 7, '8': 6, '7': 5, '6': 4, '5': 3, '4': 2, '3': 1, '2': 0 };
/* "AKQ2.K73.J5.T942" (spades.hearts.diamonds.clubs) or "S AKQ2 H K73 D J5 C T942" / "♠AKQ2 ♥K73 …" */
function parseHand(txt) {
  txt = String(txt || '').toUpperCase().replace(/10/g, 'T').trim();
  if (!txt) return null;
  const out = [], put = (s, str) => { for (const ch of str.replace(/[^AKQJT2-9]/g, '')) out.push(s * 13 + RANKS[ch]); };
  if (txt.includes('.')) { const parts = txt.split('.'); if (parts.length !== 4) throw new Error('Use four groups separated by dots: spades.hearts.diamonds.clubs'); [3, 2, 1, 0].forEach((s, i) => put(s, parts[i])); }
  else {
    const map = { S: 3, '♠': 3, H: 2, '♥': 2, D: 1, '♦': 1, C: 0, '♣': 0 };
    const re = /([SHDC♠♥♦♣])\s*:?\s*([AKQJT2-9\-—]*)/g; let m, any = false;
    while ((m = re.exec(txt))) { any = true; put(map[m[1]], m[2]); }
    if (!any) throw new Error('Could not read "' + txt + '"');
  }
  return out;
}
function parsePBN(txt) {
  const m = String(txt).match(/([NESW])\s*:\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/i); if (!m) return null;
  const first = 'NESW'.indexOf(m[1].toUpperCase()), hands = [[], [], [], []];
  for (let i = 0; i < 4; i++) hands[(first + i) % 4] = m[i + 2] === '-' ? null : parseHand(m[i + 2]);
  return hands;
}
function showDealEntry(err) {
  const v = ui.dealForm || { pbn: '', h: ['', '', '', ''], dealer: 0, vul: 0 };
  ui.dealForm = v;
  const seg = (name, opts, cur) => `<div class="seg" data-seg="${name}">${opts.map(([val, l]) => `<button data-v="${val}" class="${String(cur) === String(val) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  openOv('deal', `<h2>Enter a deal</h2>
   <div class="row2"><label class="btn gold" for="dPhoto" role="button">📷 Read from a photo or screenshot</label><input type="file" id="dPhoto" accept="image/*" hidden></div>
   <div class="muted">Works with the end-of-board screen of your bridge app (four open hands) and with hand records that list ♠ ♥ ♦ ♣ for each hand. The picture is only read on this device: it is not saved or uploaded, and it is cleared from memory as soon as the cards are read. The cards it reads appear below as a code — check them before you play. You can also type the hands: spades.hearts.diamonds.clubs, e.g. <b>AKQ2.K73.J5.T942</b> (T = 10). Leave one hand empty and it is filled with the remaining cards.</div>
   ${ui.photoMsg ? `<div class="${ui.photoErr ? "err" : "okmsg"}">${ui.photoMsg}</div>` : ""}
   ${ui.photoHands ? dealHtml(ui.photoHands.map(h => h || []), U()) : ""}
   <div class="grp"><span>PBN code (optional)</span><input id="dPbn" class="tok wide" placeholder="N:AKQ2.K73.J5.T942 ..." value="${v.pbn.replace(/"/g, '&quot;')}"></div>
   ${[0, 1, 2, 3].map(s => `<div class="grp"><span>${SEAT[s]}</span><input id="dH${s}" class="tok wide" placeholder="AKQ2.K73.J5.T942" value="${v.h[s].replace(/"/g, '&quot;')}"></div>`).join('')}
   <div class="grp"><span>Dealer</span>${seg('ddealer', [[0, 'North'], [1, 'East'], [2, 'South'], [3, 'West']], v.dealer)}</div>
   <div class="grp"><span>Vulnerable</span>${seg('dvul', [[0, 'None'], [1, 'N-S'], [2, 'E-W'], [3, 'Both']], v.vul)}</div>
   ${err ? `<div class="err">${err}</div>` : ''}
   <div class="row2"><button class="btn gold" id="dPlay">Play this deal</button><button class="btn" id="oClose">Cancel</button></div>`);
}
async function readPhoto(file) {
  readDealForm();
  ui.photoMsg = "Reading the picture…"; ui.photoErr = false; ui.photoHands = null; showDealEntry();
  await new Promise(r => setTimeout(r, 30));
  try {
    const r = await Photo.read(file);
    const counts = r.hands.map((h, s) => SEAT[s] + ' ' + (h ? h.length : 0));
    const total = r.hands.reduce((a, h) => a + (h ? h.length : 0), 0);
    ui.dealForm.pbn = r.pbn; ui.dealForm.h = ["", "", "", ""]; ui.photoHands = r.hands;
    const full = r.hands.filter(h => h && h.length === 13).length;
    ui.photoErr = full < 3;
    ui.photoMsg = (full >= 3 ? `Read ${total} cards (${counts.join(', ')}). Check the code, then press Play this deal.` : `Only part of the deal could be read (${counts.join(', ')}). Fix the code below before playing.`);
  } catch (e) { ui.photoErr = true; ui.photoMsg = e.message; }
  showDealEntry();
}
function readDealForm() {
  const v = ui.dealForm; if (!$('dPbn')) return v;
  v.pbn = $('dPbn').value; for (let s = 0; s < 4; s++) v.h[s] = $('dH' + s).value; return v;
}
function startEnteredDeal() {
  const v = readDealForm();
  try {
    let hands = v.pbn.trim() ? parsePBN(v.pbn) : v.h.map(parseHand);
    if (!hands) throw new Error('Could not read the PBN code. It should look like N:AKQ2.K73.J5.T942 … with four hands.');
    const used = new Set(), empty = [];
    hands.forEach((h, s) => { if (!h) { empty.push(s); return; } for (const c of h) { if (used.has(c)) throw new Error('The card ' + RTXT[R(c)] + SUIT[S(c)] + ' appears twice.'); used.add(c); } });
    if (empty.length === 1) hands[empty[0]] = [...Array(52).keys()].filter(c => !used.has(c));
    else if (empty.length) throw new Error('Enter at least three hands.');
    hands.forEach((h, s) => { if (h.length !== 13) throw new Error(SEAT[s] + ' has ' + h.length + ' cards, it needs 13.'); });
    let bn = 1; for (let b = 1; b <= 16; b++) if (dealerOf(b) === v.dealer && vulOf(b, 0) === (v.vul === 1 || v.vul === 3) && vulOf(b, 1) === (v.vul === 2 || v.vul === 3)) { bn = b; break; }
    ui.photoHands = null; ui.photoMsg = null; ui.dealForm = null;
    closeOv(); newBoard(hands, bn);
  } catch (e) { showDealEntry(e.message); }
}

function showResults() {
  const per = Store.periods(HIST), isImp = SET.mode === 'IMP', tab = ui.resTab;
  let body;
  if (tab === 'stats') {
    body = `<div class="resscroll"><table class="res"><thead><tr><th>Period</th><th class="n">Boards</th><th class="n">IMPs</th><th class="n">IMP/bd</th><th class="n">MP %</th><th class="n">Points</th></tr></thead><tbody>${per.map(p => `<tr><td>${p.name}</td><td class="n">${p.n}</td><td class="n">${p.scored ? fmtSigned(p.impSum) : "—"}</td><td class="n">${p.impAvg != null ? fmtSigned(p.impAvg) : "—"}</td><td class="n">${p.mpAvg != null ? p.mpAvg : "—"}</td><td class="n">${fmtSigned(p.pts)}</td></tr>`).join("")}</tbody></table></div>
     <div class="muted">Every board is also played at 10 expert robot tables. IMP: your result against each table, averaged (cross-IMPs). MP: the percentage of the field you beat.</div>`;
  } else {
    const rows = HIST.slice(-100).reverse().map(e => `<tr class="rev" data-rev="${e.id}"><td>${new Date(e.ts || 0).toLocaleDateString()}</td><td>${e.board}</td><td>${e.passed ? 'Pass' : conKey(e.c)}</td><td>${e.passed ? '' : e.tricks}</td><td class="n">${fmtSigned(e.us || 0)}</td><td class="n">${e.imp == null ? "—" : fmtSigned(e.imp)}</td><td class="n">${e.mp == null ? "—" : e.mp + "%"}</td></tr>`).join('');
    body = `<div class="muted">Tap a board to see the auction and how it was played.</div><div class="resscroll"><table class="res"><thead><tr><th>Date</th><th>Bd</th><th>Contract</th><th>Tr</th><th class="n">Score</th><th class="n">IMP</th><th class="n">MP</th></tr></thead><tbody>${rows || "<tr><td colspan=\"7\">No boards played yet.</td></tr>"}</tbody></table></div>`;
  }
  openOv('res', `<h2>Results</h2><div class="seg" data-seg="restab"><button data-v="stats" class="${tab === 'stats' ? 'on' : ''}">Statistics</button><button data-v="list" class="${tab === 'list' ? 'on' : ''}">Boards</button></div>${body}<div class="row2"><button class="btn gold" id="oClose">Close</button></div>`);
}

/* replay of a finished board, one card at a time: ui.revStep cards have been played.
   The hands sit round the table (you at the bottom) and the current trick lies in the middle. */
function revPlayHtml(e) {
  const flat = e.pl.flat(), n = flat.length, k = Math.max(0, Math.min(ui.revStep || 0, n));
  const trump = e.c.strain < 4 ? e.c.strain : -1, decl = sideOf(e.c.decl);
  const win = t => E.trickWinner(t.map(([s, c]) => ({ s, c })), trump);
  const played = new Set(flat.slice(0, k).map(x => x[1]));
  const ti = k ? Math.floor((k - 1) / 4) : -1, trick = ti < 0 ? [] : e.pl[ti].slice(0, k - ti * 4);
  let t1 = 0, t2 = 0;
  for (let i = 0; i < e.pl.length && (i + 1) * 4 <= k; i++) { if (sideOf(win(e.pl[i])) === decl) t1++; else t2++; }
  const w = trick.length === 4 ? win(trick) : -1, next = k < n ? flat[k][0] : -1;
  const pos = ['s', 'w', 'n', 'e'], rel_ = s => (s - e.seat + 4) % 4;
  const hand = s => {
    const left = e.deal[s].filter(c => !played.has(c));
    const tag = s === e.c.decl ? ' · Decl' : s === pd(e.c.decl) ? ' · Dummy' : '';
    return `<div class="h ${pos[rel_(s)]}${s === next ? ' turn' : ''}"><b>${SEAT[s]}${s === e.seat ? ' (you)' : ''}${tag}</b>${ORDER.map(su => { const cs = E.desc(E.inSuit(left, su)); return `${symHtml(su)} ${cs.length ? cs.map(c => RTXT[R(c)]).join(' ') : '—'}`; }).join('<br>')}</div>`;
  };
  const mid = `<div class="rtrick" data-rs="next">${trick.map(([s, c]) => `<span class="rc ${pos[rel_(s)]}${s === w ? ' win' : ''}">${RTXT[R(c)]}${symHtml(S(c))}</span>`).join('')}</div>`;
  const status = k === 0 ? `Opening lead: ${SEAT[next]}` : k >= n ? `End of play · declarer ${t1}, defence ${t2}${n < 52 ? ' · the rest was claimed' : ''}`
    : `Trick ${ti + 1} of ${e.pl.length} · declarer ${t1}, defence ${t2}${w >= 0 ? ` · won by ${SEAT[w]}` : ''}`;
  return `<div class="deal replay">${[0, 1, 2, 3].map(hand).join('')}${mid}</div>
    <div class="rstat">${status}</div>
    <div class="rctl"><button class="btn" data-rs="first" ${k ? '' : 'disabled'}>⏮</button><button class="btn" data-rs="prev" ${k ? '' : 'disabled'}>◀</button>
      <button class="btn gold" data-rs="auto">${ui.revTimer ? 'Pause' : 'Play'}</button>
      <button class="btn" data-rs="next" ${k < n ? '' : 'disabled'}>▶</button><button class="btn" data-rs="last" ${k < n ? '' : 'disabled'}>⏭</button></div>`;
}
function revStep(a) {
  const e = HIST.find(h => h.id === ui.revId); if (!e || !e.pl) return;
  const n = e.pl.flat().length, k = ui.revStep || 0;
  if (a === 'auto') { if (ui.revTimer) stopRev(); else { if (k >= n) ui.revStep = 0; ui.revTimer = setInterval(() => { if ((ui.revStep || 0) >= n || ui.overlay !== 'rev') { stopRev(); return; } ui.revStep++; revDraw(); }, 900); } }
  else { stopRev(); ui.revStep = a === 'first' ? 0 : a === 'last' ? n : a === 'prev' ? Math.max(0, k - 1) : Math.min(n, k + 1); }
  revDraw();
}
function stopRev() { clearInterval(ui.revTimer); ui.revTimer = null; }
function revDraw() { const e = HIST.find(h => h.id === ui.revId), el = $('revPlay'); if (e && el) el.innerHTML = revPlayHtml(e); }

/* a finished board from Results: the four hands, the auction (tap a call for its meaning) and every trick */
function showReview(id, sel) {
  const e = HIST.find(h => h.id === id); if (!e) return;
  ui.revId = id; const hi = HIST.findIndex(h => h.id === id);
  const dealer = e.dealer != null ? e.dealer : dealerOf(e.board);
  const auc = (e.auc || []).map(([seat, call]) => ({ seat, call }));
  const cards = sideCards();
  auc.forEach((a, i) => { a.m = E.explainCall(auc.slice(0, i), a.seat, a.call, cards); });
  const aucHtml = e.auc
    ? `<div class="auction">${auctionTable(auc, false, { board: e.board, dealer, seat: e.seat, sel })}</div>` +
      (sel != null && auc[sel] ? `<div class="expl">${explHtml(auc[sel])}</div>` : '<div class="muted tap">Tap a call to see what it means</div>')
    : '<div class="muted">The auction was not saved for this board (played before this feature was added).</div>';
  const canPlay = e.pl && e.pl.length && e.c && e.deal;
  const playHtml = canPlay ? `<div class="grp"><span>The play — tap ▶ (or the table) to play the next card</span><div id="revPlay">${revPlayHtml(e)}</div></div>`
    : (e.passed ? '' : '<div class="muted">The play was not saved for this board (played before this feature was added).</div>');
  openOv('rev', `<h2>Board ${e.board}</h2><div class="big">${resultLine(e)}</div>
    ${canPlay ? '' : e.deal ? dealHtml(e.deal, e.seat) : ''}
    ${playHtml}
    <div class="grp"><span>Auction</span>${aucHtml}</div>
    <div class="row2"><button class="btn" data-revgo="-1" ${hi > 0 ? '' : 'disabled'}>◀ ${T('Previous deal')}</button><button class="btn" data-revgo="1" ${hi >= 0 && hi < HIST.length - 1 ? '' : 'disabled'}>${T('Next deal')} ▶</button></div>
    <div class="row2"><button class="btn" id="oRevBack">${T('Back to the list')}</button><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}
/* the boards played today, from the table: contract, result, score, IMPs and MP against the
   robot field, with the totals; tap a board to replay it */
function showHist() {
  const sod = new Date(); sod.setHours(0, 0, 0, 0);
  const L = HIST.filter(e => (e.ts || 0) >= sod.getTime()).slice(-60);
  const sc = L.filter(e => e.imp != null), imp = Math.round(sc.reduce((a, e) => a + e.imp, 0) * 10) / 10;
  const mp = sc.length ? Math.round(sc.reduce((a, e) => a + e.mp, 0) / sc.length * 10) / 10 : null;
  const pts = L.reduce((a, e) => a + (e.us || 0), 0);
  const rows = L.slice().reverse().map(e => `<tr class="rev" data-rev="${e.id}" data-from="hist"><td>${e.board}</td><td>${e.passed ? T('Pass') : conKey(e.c)}</td><td>${e.passed ? '' : (e => { const d = e.tricks - (e.c.level + 6); return d >= 0 ? (d ? '+' + d : '=') : d; })(e)}</td><td class="n">${fmtSigned(e.us || 0)}</td><td class="n">${e.imp != null ? fmtSigned(e.imp) : '…'}</td><td class="n">${e.mp != null ? e.mp + '%' : '…'}</td></tr>`).join('');
  openOv('hist', `<h2>📜 ${T('History')}</h2><div class="muted">${T('Boards played today — tap one to see the hands, the auction and the play.')}</div>
    ${L.length ? `<div class="resscroll"><table class="res"><thead><tr><th>${T('Bd')}</th><th>${T('Contract')}</th><th></th><th class="n">${T('Score')}</th><th class="n">IMP</th><th class="n">MP</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3"><b>${T('Total')}</b> · ${L.length}</td><td class="n"><b>${fmtSigned(pts)}</b></td><td class="n"><b>${sc.length ? fmtSigned(imp) : '—'}</b></td><td class="n"><b>${mp != null ? mp + '%' : '—'}</b></td></tr></tfoot></table></div>`
      : `<div class="muted">${T('No boards yet today.')}</div>`}
    <div class="row2"><button class="btn gold" id="oClose">${T('Close')}</button></div>`);
}

/* ================= events ================= */
// what you type as an alert is kept while the bidding box is redrawn
document.addEventListener('input', e => { if (e.target && e.target.id === 'alTxt') ui.alertTxt = e.target.value; });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.conv) {
    const k = t.dataset.conv, c = E.CONVS.find(y => y.k === k);
    SET.conv[k] = t.checked;
    if (t.checked && c && c.x) SET.conv[c.x] = false;
    if (!t.checked && SET.practice === k) SET.practice = "";
    Store.saveSettings(SET); save(); if (ui.overlay === "set") showSettings(); else render();
  }
  if (t.dataset.tinv != null && ui.tsel) { if (t.checked) ui.tsel.names.add(t.dataset.tinv); else ui.tsel.names.delete(t.dataset.tinv); return; }
  // your own player card: level, country and a few words, sent with your profile
  if (t.id === 'pName') { const v = t.value.trim().slice(0, 20); if (v) { try { localStorage.setItem('bridge-table-name', v); } catch (e) {} Net.shareInfo(); render(); showPlayer(v); } return; }
  if (t.id === 'pSys') { SET.sys = t.value; SET.conv = { ...E.sysOf(t.value).conv }; SET.practice = ''; Store.saveSettings(SET); save(); Net.shareInfo(); render(); showPlayer(myNm() || T('You')); return; }
  if (t.id === 'pLvl' || t.id === 'pCtry' || t.id === 'pAbout') { SET[{ pLvl: 'lvl', pCtry: 'ctry', pAbout: 'about' }[t.id]] = t.id === 'pAbout' ? t.value.trim().slice(0, 80) : t.value; Store.saveSettings(SET); save(); Net.shareInfo(); if (t.id !== 'pAbout') showPlayer(myNm() || T('You')); return; }
  if (t.id === 'hLang') { SET.lang = t.value; applyLang(); Store.saveSettings(SET); save(); render(); return; }
  if (t.id === 'hSys') { SET.sys = t.value; SET.conv = { ...E.sysOf(t.value).conv }; SET.practice = ''; Store.saveSettings(SET); save(); render(); flash(E.sysOf(t.value).n + ' — ' + T('your robot partner bids it too'), 2400); return; }
  if (t.id === 'hName') { try { localStorage.setItem('bridge-table-name', t.value.trim().slice(0, 20)); } catch (e) {} return; }
  if (t.id === 'dPhoto' && t.files && t.files[0]) { readPhoto(t.files[0]); t.value = ''; return; }
  if (t.id === "sPractice") { SET.practice = t.value; if (t.value) { SET.conv[t.value] = true; const c = E.CONVS.find(y => y.k === t.value); if (c && c.x) SET.conv[c.x] = false; } Store.saveSettings(SET); save(); showSettings(); }
});
document.addEventListener('click', ev_ => {
  // the ☰ menu closes after any tap outside its button (a menu item still does its job)
  if (ui.menu && !ev_.target.closest('#bMenu')) { ui.menu = false; setTimeout(() => { if (G && G.phase !== 'idle') renderBar(); }, 0); }
  if (G && G.phase === "play" && ev_.target.closest("#center") && !ev_.target.closest("[data-c].play,button")) {
    if (G.play.history.length) { ui.showLast = !ui.showLast; clearTimeout(ui.lastTimer); if (ui.showLast) ui.lastTimer = setTimeout(() => { ui.showLast = false; render(); }, 4000); render(); }
    return;
  }
  // Results: open a finished board, tap its calls, or go back to the list
  const hsb = ev_.target.closest('[data-hsec]'); if (hsb && hsb.dataset.hsec === 'chat') { const c = document.querySelector('.hchat'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'end' }); const i = $('lMsg'); if (i) setTimeout(() => i.focus(), 300); return; }
  if (hsb && hsb.closest('#ov')) closeOv();   // from the player card: close it and open the section
  if (hsb) { const v = hsb.dataset.hsec; ui.hsec = !v || ui.hsec === v ? null : v; render(); if (ui.hsec === 'chat') { const i = $('lMsg2'); if (i) i.focus(); } return; }
  const opb = ev_.target.closest('[data-open]'); if (opb) { closeOv(); ui.saved = null; Net.openTable(opb.dataset.open === 'priv'); return; }
  const ar = ev_.target.closest('[data-askr]'); if (ar) { const f = ui.askFin; ui.askFin = null; askClose(); if (f) f(ar.dataset.askr === '1'); return; }
  const cn = ev_.target.closest('[data-claimn]'); if (cn) { claimChosen(+cn.dataset.claimn); return; }
  const tp = ev_.target.closest('[data-tplay]'); if (tp) { playTour(tp.dataset.tplay); return; }
  const tbd = ev_.target.closest('[data-tbd]'); if (tbd) { ui.tbd = { id: tbd.dataset.tid, b: +tbd.dataset.tbd }; showStandings(tbd.dataset.tid); return; }
  const tpr = ev_.target.closest('[data-tprac]'); if (tpr) { practiceTour(tpr.dataset.tprac, 1); return; }
  if (ev_.target.closest('#yesOk')) { const f = ui.yesFn; ui.yesFn = null; closeOv(); if (f) f(); return; }
  const tsit = ev_.target.closest('[data-tsit]'); if (tsit) { const S = tourSeats(); S[tsit.dataset.tid] = +tsit.dataset.tsit; try { localStorage.setItem('bridge-tour-seats', JSON.stringify(S)); } catch (e) {} closeOv(); playTour(tsit.dataset.tid); return; }
  const tl = ev_.target.closest('[data-tlist]'); if (tl) { ui.ttab = tl.dataset.tlist; render(); return; }   // the tournament list's tabs
  const tt = ev_.target.closest('[data-ttab],[data-tjtab]'); if (tt) { if (tt.dataset.ttab) Net.openTourTable(tt.dataset.ttab); else Net.joinTourTable(tt.dataset.tjtab); return; }
  const pw = ev_.target.closest('[data-who]'); if (pw) { showPlayer(pw.dataset.who); return; }
  const pwx = ev_.target.closest('[data-pairwith]'); if (pwx) { closeOv(); Net.playWith(pwx.dataset.pairwith); return; }
  const fr = ev_.target.closest('[data-friend]'); if (fr) { toggleFriend(fr.dataset.friend); showPlayer(fr.dataset.friend); render(); return; }
  const ka = ev_.target.closest('[data-kickask]'); if (ka) { const s = +ka.dataset.kickask, n = Net.st.names[s] || SEAT[s]; askYes(T('Remove {0} from the table? A robot plays the seat.', n), () => Net.kick(s)); return; }
  if (ev_.target.closest('#hStats')) { showPlayer(myNm() || T('You')); return; }   // your own rating (the Results of this device)
  const dmb = ev_.target.closest('[data-dm]'); if (dmb) { showDm(dmb.dataset.dm); return; }
  const tq = ev_.target.closest('[data-tset],[data-tyes],[data-tno]'); if (tq) { if (tq.dataset.tset) { ui.tsel = null; showTourSetup(tq.dataset.tset); } else Net.tourAnswer(tq.dataset.tyes || tq.dataset.tno, !!tq.dataset.tyes); return; }
  // ✕ on a tournament (shown to its organiser only): cancel it for everyone
  const td = ev_.target.closest('[data-tdel]'); if (td) { const t = Net.st.tours[td.dataset.tdel]; if (!t) return; if (Net.isMine(t)) askYes(T('Cancel the tournament?'), () => { Net.tourCancel(t.id); render(); }); return; }
  const ts = ev_.target.closest('[data-tstand]'); if (ts) { showStandings(ts.dataset.tstand); return; }
  const rv = ev_.target.closest('[data-rev]'); if (rv) { ui.revFrom = rv.dataset.from || 'res'; ui.revSel = null; ui.revStep = 0; stopRev(); showReview(rv.dataset.rev); return; }
  // previous / next deal in the replay
  const rg = ev_.target.closest('[data-revgo]'); if (rg) { const i = HIST.findIndex(h => h.id === ui.revId) + +rg.dataset.revgo; if (HIST[i]) { ui.revSel = null; ui.revStep = 0; stopRev(); showReview(HIST[i].id); } return; }
  const rs = ev_.target.closest('[data-rs]'); if (rs) { if (!rs.disabled) revStep(rs.dataset.rs); return; }
  const ri = ev_.target.closest('[data-ri]'); if (ri) { const i = +ri.dataset.ri; showReview(ui.revId, ui.revSel === i ? null : i); ui.revSel = ui.revSel === i ? null : i; return; }
  if (ev_.target.closest('#oRevBack')) { stopRev(); if (ui.revFrom === 'hist') showHist(); else { ui.resTab = 'list'; showResults(); } return; }
  const t = ev_.target.closest('button,[data-c],[data-ai],#toast,#dExpl'); if (!t) return;
  if (t.id === 'dExpl') { ui.lastExpl = null; ui.hintBid = null; render(); return; }
  if (t.id === 'toast') { ui.toast = null; render(); return; }
  if (t.dataset.sit != null) { Net.sit(+t.dataset.sit); return; }
  // Start: you play with robots; your table shows in the lobby and others can ask to join (you accept)
  if (t.id === "bGo") { Net.st.soloPub = true; closeOv(); resume(); return; }
  const sol = ev_.target.closest("[data-solo]"); if (sol) { Net.st.soloPub = sol.dataset.solo === "pub"; closeOv(); resume(); return; }
  const dtb = ev_.target.closest("[data-dtab]"); if (dtb) { ui.dockTab = dtb.dataset.dtab; renderDock(); return; }
  const dq = ev_.target.closest("[data-dq]"); if (dq) { dockSend(dq.dataset.dq); return; }
  if (t.id === "dSend") { const i = $("dMsg"); if (i) { dockSend(i.value); i.value = ""; } return; }
  if (t.id === "dClose") { ui.dockOpen = false; renderDock(); return; }
  // clear the chat shown in the panel on this device (the lobby chat stays cleared; the table chat until new messages)
  if (t.id === "dClear") { if (online() && (ui.dockTab || "table") === "table") { Net.st.chat.length = 0; Net.st.unread = 0; renderDock(); } else Net.lclear(); return; }
  if (t.id === "chatBtn") { toggleDock(); return; }
  if (t.id === "bStart") { if (online() && !guest() && G.phase === "lobby") { Net.note((Net.st.names[SET.seat] || "Host") + " started the game"); if (Net.st.tour) tableBoard(); else newBoard(); } return; }
  if (t.dataset.ai != null) { ui.lastExpl = ui.lastExpl === +t.dataset.ai ? null : +t.dataset.ai; ui.hintBid = null; if (ui.overlay === 'auc') showAuction(); else render(); return; }
  if (t.dataset.lvl) { ui.selLvl = +t.dataset.lvl; renderBidbox(); return; }
  if (t.dataset.call != null && G.phase === 'bid' && bidTurn() === U()) { const v = t.dataset.call; const c = (v === 'P' || v === 'X' || v === 'XX') ? v : +v; if (c !== -1) { const al = ui.alertOn ? (ui.alertTxt || '').trim() || T('Alert') : null; ui.alertOn = false; ui.alertTxt = ''; makeCall(U(), c, undefined, al); } return; }
  if (t.dataset.c != null && t.classList.contains('play')) { const c = +t.dataset.c; const seat = G.play.turn; if (G.play.hands[seat].includes(c)) playCard(seat, c); return; }
  if (t.closest('.seg')) {
    const seg = t.closest('.seg').dataset.seg, v = t.dataset.v;
    if (seg === 'lang') { SET.lang = v; applyLang(); Store.saveSettings(SET); save(); render(); return; }
    if (seg === 'sys') { SET.sys = v; SET.conv = { ...E.sysOf(v).conv }; SET.practice = ''; Store.saveSettings(SET); save(); if (ui.overlay === 'set') showSettings(); else render(); flash(E.sysOf(v).n + ' — ' + T('from the next deal'), 2200); return; }
    if (ui.overlay === 'tsetup' && ['tn', 'tformat', 'ttables', 'tscoring', 'thours'].includes(seg)) {
      readTourSeats(); const t = Net.st.tours[ui.tsetId]; if (!t) return;
      if (seg === 'tn') t.n = +v; if (seg === 'tscoring') t.scoring = v; if (seg === 'thours') t.hours = +v;
      if (seg === 'tformat') { t.format = v; if (v === 'tables' && !t.tables.length) t.tables = [[Net.st.tours[ui.tsetId].by, '', '', '']]; }
      if (seg === 'ttables') { const n = +v; while (t.tables.length < n) t.tables.push(['', '', '', '']); t.tables.length = n; }
      showTourSetup(ui.tsetId); return;
    }
    if (seg === 'restab') { ui.resTab = v; showResults(); return; }
    if (seg === 'ddealer' || seg === 'dvul') { readDealForm(); ui.dealForm[seg === 'ddealer' ? 'dealer' : 'vul'] = +v; showDealEntry(); return; }
    if (seg === "seat" && online()) { flash("Close the online table before changing your seat", 2000); return; }
    if (seg === "seat") SET.seat = +v; if (seg === 'speed') SET.speed = +v; if (seg === 'expl') SET.expl = v === '1'; if (seg === 'auto') SET.auto = v === '1';
    if (seg === 'alert') { SET.alert = v; if (v !== 'off') beep(); }
    if (seg === "style") SET.style = v;
    if (seg === "mode") SET.mode = v; if (seg === 'opp') SET.opp = v;
    Store.saveSettings(SET); save(); showSettings(); render(); return;
  }
  switch (t.id) {
    case "bNew": case "oNext2":
      if (G && G.tour && !guest()) { if (G.phase === 'done') nextTourBoard(); else flash(T('Finish this tournament board first'), 2000); break; }
      if (guest()) { if (G.phase === "done") Net.send({ t: "next" }); else Net.askNewDeal(); break; }
      if (t.id === "oNext2" || G.phase === "done" || ui.confirmNew > Date.now()) { ui.confirmNew = 0; newBoard(); }
      else { ui.confirmNew = Date.now() + 3000; renderBar(); setTimeout(renderBar, 3100); }
      break;
    case 'bAuc': showAuction(); break;
    case 'oShow': showEnd(); break;
    case 'bHint':
      if (guest() && G.phase === "play") { if (userControls(G.play.turn) && G.play.trick.length < 4) Net.send({ t: "hint" }); break; } // the host works it out
      if (G.phase === 'bid' && bidTurn() === U()) { ui.hintBid = E.aiBid(G.auction, U(), G.deal[U()], G.cards); SET.expl = true; render(); }
      else if (G.phase === 'play' && userControls(G.play.turn) && G.play.trick.length < 4) { ui.hintCard = E.aiPlay(G.play, G.play.turn); render(); }
      break;
    case "bClaim": claim(); break;
    case "bUndo": {
      if (online() && !guest()) { requestUndo("host", Net.st.names[SET.seat] || "Host", SET.seat).then(ok => { if (ok === false) flash(T("Nothing to take back, or the other side said no"), 1800); }); break; }
      const ok = undo(); if (ok === false) flash("Nothing of yours to take back", 1500); break;
    }
    case "sDeal": showDealEntry(); break;
    case "dPlay": startEnteredDeal(); break;
    case "dExpl": ui.lastExpl = null; ui.hintBid = null; render(); break;
    case "bHelp": case "bHelp2": showHelp(); break;
    case "bHist": showHist(); break;
    case "bMenu": ui.menu = !ui.menu; renderBar(); break;
    case "bLeave": askYes(T("Leave the table?"), goHome); break;   // playing alone with robots: back to a fresh home page
    case "bAlert": ui.alertOn = !ui.alertOn; renderBidbox(); if (ui.alertOn) setTimeout(() => { const i = $('alTxt'); if (i) i.focus(); }, 30); break;
    // the turn sound on and off from the top bar
    case "bBell": { const on = (SET.alert || "online") !== "off"; if (on) { SET.alertOn = SET.alert || "online"; SET.alert = "off"; } else { SET.alert = SET.alertOn || "online"; beep(); } Store.saveSettings(SET); save(); render(); flash(on ? "🔕 " + T("Turn sound off") : "🔔 " + T("Turn sound on"), 1400); break; }
    case "bSet": showSettings(); break;
    case 'bRes': showResults(); break;
    case 'bHome': goHome(); break;
    case 'hQuick': Net.quickJoin(); break;
    case 'hWatch': Net.quickWatch(); break;
    case 'hOpen': showOpenChoice(); break;
    case 'lSend': { const i = $('lMsg'); if (i && i.value.trim()) { Net.lsend(i.value); i.value = ''; } break; }
    case 'lSend2': { const i = $('lMsg2'); if (i && i.value.trim()) { Net.lsend(i.value); i.value = ''; } if (ui.hsec === 'chat') { ui.hsec = null; render(); } break; }
    case 'lClear': Net.lclear(); break;
    case 'dmSend': { const i = $('dmMsg'); if (i && i.value.trim() && ui.dmWith) { Net.dmSend(ui.dmWith, i.value); i.value = ''; showDm(ui.dmWith); } break; }
    case 'lFab': showLChat(); break;
    case 'oClose': closeOv(); break;
    case 'sReset': HIST = []; save(); showSettings(); render(); break;
    case "sSave": { const v = ($("syncToken") || {}).value; if (v) { GitSync.setToken(v); syncState.msg = ""; syncNow(); showSettings(); } break; }
    case "sNow": syncNow(); break;
    case "sOff": GitSync.setToken(null); syncState.msg = ""; showSettings(); break;
    case "oNext": if (guest()) { Net.send({ t: "next" }); closeOv(); } else if (G && G.tour) { closeOv(); nextTourBoard(); } else newBoard(); break;
    case 'tNew': { const t = Net.newTour(8); ui.tsel = null; render(); showTourSetup(t.id); break; }
    case 'tAddBtn': { const i = $('tAdd'), v = i && i.value.trim().slice(0, 20); if (v && ui.tsel) { ui.tsel.names.add(v); showTourSetup(ui.tsetId); } break; }
    case 'tSend': { readTourSeats(); const t = Net.st.tours[ui.tsetId]; const names = t && t.format === 'tables' ? [].concat(...t.tables).filter(n => n && n.toLowerCase() !== (myNm() || '').toLowerCase()) : [...((ui.tsel && ui.tsel.names) || [])]; if (!names.length) { flash(T('Pick at least one player'), 1800); break; } Net.tourInvite(ui.tsetId, names); flash(T('Invitations sent'), 1800); showTourSetup(ui.tsetId); break; }
    case 'tGo': { readTourSeats(); const id = ui.tsetId, t = Net.st.tours[id]; Net.tourStart(id); closeOv(); flash(T('The tournament has started'), 2000); render();
      // you can start alone: robots take the empty seats; at tables, your own table opens at once
      if (t && t.format === 'tables') { const me = Net.myTourSeat(t); if (me && me.seat === me.hostSeat) Net.openTourTable(id); } else if (t) playTour(id);
      break; }
    case 'tCancel': Net.tourCancel(ui.tsetId); closeOv(); render(); break;
    case "oReplay": replayDeal(); break;
  }
});
$('ov').addEventListener('click', e => { if (e.target.id === 'ov') closeOv(); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'dMsg') { e.preventDefault(); const v = e.target.value; e.target.value = ''; dockSend(v); return; } if (e.key === 'Enter' && e.target && e.target.id === 'dmMsg') { e.preventDefault(); $('dmSend').click(); return; } if (e.key === 'Enter' && e.target && e.target.id === 'tAdd') { e.preventDefault(); $('tAddBtn').click(); return; } if (e.key === 'Enter' && e.target && (e.target.id === 'lMsg' || e.target.id === 'lMsg2') && e.target.value.trim()) { e.preventDefault(); Net.lsend(e.target.value); e.target.value = ''; if (e.target.id === 'lMsg2' && ui.hsec === 'chat') { ui.hsec = null; render(); } } });
window.addEventListener('resize', layoutFans);

/* ================= boot ================= */
function start(data) {
  load(data && data.G ? data : null);
  Field.init();
  // the app opens on a quiet start screen: nothing is dealt until you press Start (a board in progress is kept for it)
  // every opening starts fresh on the home page (an unfinished board is not kept)
  ui.saved = null;
  G = idleG(); render();
  Store.initCloud(mergeCloud);
  syncNow(true);
  window.addEventListener("online", () => syncNow(true));
  // installable/offline app when served from a normal web address
  if ('serviceWorker' in navigator && document.querySelector('link[rel=manifest]') && /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname)) {
    // when a new version has been installed, switch to it right away (the game in progress is kept)
    const hadController = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; save(); location.reload(); } });
    navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
  }
}
window.claude?.hot?.snapshot?.(() => ({ SET, G, HIST, BOARD }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
