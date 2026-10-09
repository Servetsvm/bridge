/* Bridge Table — screen, game flow, field comparison and settings. */
'use strict';
const E = {}; for (const f of window.BRIDGE) f(E);
const { SUIT, STR, RTXT, SEAT, S, R, pd, sideOf, B, LV, ST, isNum, vulOf, dealerOf, callTxt, legalCalls, isLegal, auctionOver, contractOf, ev, scoreOf } = E;

let SET = { style: "classic", seat: 2, speed: 1, expl: true, auto: true, mode: 'IMP', opp: 'same', conv: { ...E.ALL_ON } };
let G = null, HIST = [], BOARD = 0, timer = null;
/* ---- language: the screens are written in English; T() gives the Turkish or Norwegian text ({0} = a value) ---- */
const I18N = {
  tr: {
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
    "Going back to your table…": "Masana geri dönülüyor…", "Your system": "Sistemin", "Close the table?": "Masa kapatılsın mı?", "Yes": "Evet", "No": "Hayır", "Play with robots": "Robotlarla oyna", "Against the tournament ({0} players): {1} IMP · {2}%": "Turnuvaya karşı ({0} oyuncu): {1} IMP · %{2}", "Leave the table you are at first": "Önce oturduğun masadan kalk", "No table to watch right now.": "Şu an izlenecek masa yok.", "Play as partners": "Partner olarak oyna", "Practice these boards": "Bu elleri tekrar oyna", "Practice: board {0} of {1}": "Alıştırma: el {0} / {1}", "Watch a table": "Bir masa izle", "wants to play with you as partners": "seninle partner olarak oynamak istiyor", "Add as friend": "Arkadaş ekle", "Alert": "Alert", "Alert your next call and say what it means": "Vereceğin teklifi alert et ve anlamını yaz", "Back to the list": "Listeye dön", "Bd": "El", "Boards played today — tap one to see the hands, the auction and the play.": "Bugün oynanan eller — elleri, açık artırmayı ve oyunu görmek için birine bas.", "Contract": "Kontrat", "Friend": "Arkadaş", "History": "Geçmiş", "Next deal": "Sonraki el", "No boards yet today.": "Bugün henüz el yok.", "Nobody has played this board yet.": "Bu eli henüz kimse oynamadı.", "Other tables": "Diğer masalar", "Player": "Oyuncu", "Previous deal": "Önceki el", "Robot reading": "Robotun yorumu", "Score": "Puan", "Tap your own row to replay the board.": "Eli tekrar izlemek için kendi satırına bas.", "Total": "Toplam", "What does your next call mean?": "Vereceğin teklif ne anlama geliyor?", "Your turn — the table is waiting ({0} s)": "Sıra sende — masa bekliyor ({0} sn)", "{0} has not played for {1} s — tap the name to remove": "{0} {1} sn’dir oynamıyor — çıkarmak için adına bas", "{0} is in the lobby": "{0} lobide", "{0} is not in the lobby — the message is delivered when they come": "{0} lobide değil — mesaj geldiğinde iletilecek", "Close table": "Masayı kapat", "Sound when it is your turn": "Sıra sende olunca ses", "Turn sound off": "Sıra sesi kapalı", "Turn sound on": "Sıra sesi açık", "Close the table for everyone?": "Masa herkes için kapatılsın mı?", "Remove {0} from the table? A robot plays the seat.": "{0} masadan çıkarılsın mı? Yerine robot oynar.", "Tournament board {0} of {1} — you sit {2}": "Turnuva eli {0} / {1} — {2} oturuyorsun", "Where do you sit?": "Nereye oturuyorsun?", "N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.": "K–G oyuncuları K–G ile, D–B oyuncuları D–B ile sıralanır. Bütün ellerde bu yerde oturursun.", "Against 10 robot tables": "10 robot masasına karşı", "= your score against 10 robot tables that played the same boards; it ranks the players until others have played.": "= aynı elleri oynayan 10 robot masasına karşı puanın; başkaları oynayana kadar sıralama buna göre yapılır.", "Leave": "Kalk", "Leave the table?": "Masadan kalkılsın mı?", "Leave the table": "Masadan kalk", "Your rating": "Puanın", "This week": "Bu hafta", "This month": "Bu ay", "This year": "Bu yıl", "All time": "Tümü", "System": "Sistem", "IMP / board": "IMP / el", "No rating yet — it shows once this player has played (with the new version).": "Henüz puan yok — bu oyuncu (yeni sürümle) oynayınca görünür.", "Close — answer later": "Kapat — sonra cevapla", "Cancel the tournament?": "Turnuva iptal edilsin mi?", "Remove from my list": "Listemden kaldır", "Join the tournament": "Turnuvaya katıl", "Join and play": "Katıl ve oyna", "{0} started a tournament — everyone can play it": "{0} bir turnuva başlattı — herkes oynayabilir", "This tournament has not reached you yet — try again in a moment": "Turnuva bilgisi henüz gelmedi — birazdan tekrar dene", "your robot partner bids it too": "robot partnerin de bunu oynar", "Base system": "Temel sistem", "Conventions": "Konvansiyonlar", "from the next deal": "sonraki elden itibaren", "In the lobby": "Lobide", "Claim": "Claim", "How many of the remaining {0} tricks do you take?": "Kalan {0} lövenin kaçını alıyorsun?", "All {0}": "Hepsi ({0})", "Claim sent — waiting for the other side": "Claim gönderildi — karşı taraf bekleniyor", "You": "Sen", "Could not work it out yet — play a little longer": "Henüz hesaplanamadı — biraz daha oyna", "The robots do not accept: {0} tricks at most": "Robotlar kabul etmiyor: en fazla {0} löve", "{0} claimed {1} of the last {2} tricks — accepted": "{0} son {2} lövenin {1} tanesini claim etti — kabul edildi", "{0} claimed {1} of the last {2} tricks — not accepted": "{0} son {2} lövenin {1} tanesini claim etti — kabul edilmedi", "Robots": "Robotlar", "The robots claimed the last {0} tricks — accepted": "Robotlar son {0} löveyi claim etti — kabul edildi", "The robots claimed the last {0} tricks — play goes on": "Robotlar son {0} löveyi claim etti — oyun devam ediyor", "{0} claims {1} of the last {2} tricks": "{0} son {2} lövenin {1} tanesini claim ediyor", "The robots claim all of the last {0} tricks": "Robotlar son {0} lövenin hepsini claim ediyor", "{0} wants to take back their last {1}": "{0} son {1} geri almak istiyor", "move": "hamlesini", "call": "teklifini", "Do you agree?": "Kabul ediyor musun?", "{0} wanted to take back their last {1} — not accepted": "{0} son {1} geri almak istedi — kabul edilmedi", "Nothing to take back, or the other side said no": "Geri alınacak bir şey yok ya da karşı taraf kabul etmedi", "Table": "Masa", "Lobby": "Lobi", "Alone with robots": "Robotlarla yalnız", "Shown in the lobby, nobody can join.": "Lobide görünür, kimse katılamaz.", "Open to others": "Herkese açık", "Shown in the lobby: players can ask to join, you accept.": "Lobide görünür: oyuncular katılmak isteyebilir, sen kabul edersin.", "Message": "Mesaj", "Write a private message to {0}.": "{0} kişisine özel mesaj yaz.", "Waiting for {0} to open the table": "{0} masayı açacak, bekleniyor", "Tournament board {0} of {1}": "Turnuva eli {0}/{1}", "Pair": "Çift", "Points": "Puan", "{0} tables": "{0} masa", "individual": "bireysel", "at tables": "masalarda", "ranked by {0}": "{0} ile sıralama", "started by {0}": "başlatan {0}", "table {0}, you sit {1}": "masa {0}, sen {1}", "Open table {0}": "{0}. masayı aç", "Join table {0}": "{0}. masaya katıl", "Table {0}": "Masa {0}", "Name": "Ad", "Boards": "El sayısı", "Format": "Biçim", "Tables": "Masalar", "Ranking": "Sıralama", "Keep the tournament for": "Turnuva saklama süresi", "{0} hours": "{0} saat", "1 day": "1 gün", "3 days": "3 gün", "Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.": "Oyuncular masalarda birlikte oturur; her masa aynı elleri oynar; boş koltuğu robot oynar. Masaya ilk yazılan oyuncu masayı açar.", "Players in the lobby": "Lobideki oyuncular", "Invite players": "Oyuncu davet et", "wants to join your table": "masana katılmak istiyor", "wants to watch your table": "masanı izlemek istiyor", "more waiting": "kişi daha bekliyor", "Open an online table first": "Önce online masa aç", "Invitation sent to {0}": "{0} davet edildi", "invites you to their table": "seni masasına davet ediyor", "Nobody else is in the lobby right now.": "Şu an lobide başka kimse yok.", "Invite to my table": "Masama davet et", "Open an online table to invite players to it.": "Oyuncu davet etmek için online masa aç.", "Public table": "Herkese açık masa", "Private table": "Kapalı masa", "Listed in the lobby: anyone can ask to join, you accept.": "Lobide listelenir: herkes katılmak isteyebilir, sen kabul edersin.", "Shown in the lobby with 🔒: invited players sit at once, others must ask you, no spectators.": "Lobide 🔒 ile görünür: davet ettiklerin hemen oturur, diğerleri sana sorar, izleyici olmaz.",     "Clear the chat": "Sohbeti temizle", "Open an online table": "Online masa aç", "Open your own online table (players ask to join and you accept them), or ask to join one of the tables below.": "Kendi online masanı aç (oyuncular katılmak ister, sen kabul edersin) ya da aşağıdaki masalardan birine katılmak iste.",
    "setting up": "hazırlanıyor", "{0} accepted": "{0} kabul etti", "Players and start": "Oyuncular ve başlat", "Waiting for {0} to start": "{0} başlatacak", "{0} invites you": "{0} seni davet ediyor", "{0} invites you to a tournament": "{0} seni turnuvaya davet ediyor",
    "No tournaments yet. Create one and invite the players you want.": "Henüz turnuva yok. Bir tane oluştur ve istediğin oyuncuları davet et.", "accepted": "kabul etti", "declined": "reddetti", "invited": "davet edildi", "organiser": "düzenleyen",
    "Everyone plays the same deals at their own table, sitting South. The tournament opens when you press Start.": "Herkes aynı elleri kendi masasında, South'ta oturarak oynar. Turnuva sen Başlat deyince açılır.", "Players to invite": "Davet edilecek oyuncular",
    "Nobody else is in the lobby right now — type a name below.": "Şu an lobide başka kimse yok — aşağıya bir isim yaz.", "Add a player by name": "İsimle oyuncu ekle", "Add": "Ekle", "Answers": "Cevaplar", "Send the invitations": "Davetleri gönder", "Start the tournament": "Turnuvayı başlat", "Cancel the tournament": "Turnuvayı iptal et",
    "Pick at least one player": "En az bir oyuncu seç", "Invitations sent": "Davetler gönderildi", "The tournament has started": "Turnuva başladı", "This tournament has not started yet": "Bu turnuva henüz başlamadı",
  },
  no: {
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
    "Going back to your table…": "Går tilbake til bordet ditt…", "Your system": "Systemet ditt", "Close the table?": "Lukke bordet?", "Yes": "Ja", "No": "Nei", "Play with robots": "Spill med roboter", "Against the tournament ({0} players): {1} IMP · {2}%": "Mot turneringen ({0} spillere): {1} IMP · {2} %", "Leave the table you are at first": "Gå fra bordet du sitter ved først", "No table to watch right now.": "Ingen bord å se på akkurat nå.", "Play as partners": "Spill som makkere", "Practice these boards": "Spill disse spillene igjen", "Practice: board {0} of {1}": "Øving: spill {0} av {1}", "Watch a table": "Se på et bord", "wants to play with you as partners": "vil spille med deg som makker", "Add as friend": "Legg til som venn", "Alert": "Alert", "Alert your next call and say what it means": "Alert neste melding og skriv hva den betyr", "Back to the list": "Tilbake til listen", "Bd": "Sp", "Boards played today — tap one to see the hands, the auction and the play.": "Spill spilt i dag — trykk på ett for å se hendene, meldingene og spillet.", "Contract": "Kontrakt", "Friend": "Venn", "History": "Historikk", "Next deal": "Neste spill", "No boards yet today.": "Ingen spill i dag ennå.", "Nobody has played this board yet.": "Ingen har spilt dette spillet ennå.", "Other tables": "Andre bord", "Player": "Spiller", "Previous deal": "Forrige spill", "Robot reading": "Robotens tolkning", "Score": "Poeng", "Tap your own row to replay the board.": "Trykk på din egen rad for å se spillet igjen.", "Total": "Totalt", "What does your next call mean?": "Hva betyr neste melding?", "Your turn — the table is waiting ({0} s)": "Din tur — bordet venter ({0} s)", "{0} has not played for {1} s — tap the name to remove": "{0} har ikke spilt på {1} s — trykk på navnet for å fjerne", "{0} is in the lobby": "{0} er i lobbyen", "{0} is not in the lobby — the message is delivered when they come": "{0} er ikke i lobbyen — meldingen leveres når de kommer", "Close table": "Lukk bordet", "Sound when it is your turn": "Lyd når det er din tur", "Turn sound off": "Turlyd av", "Turn sound on": "Turlyd på", "Close the table for everyone?": "Lukke bordet for alle?", "Remove {0} from the table? A robot plays the seat.": "Fjerne {0} fra bordet? En robot spiller plassen.", "Tournament board {0} of {1} — you sit {2}": "Turneringsspill {0} av {1} — du sitter {2}", "Where do you sit?": "Hvor sitter du?", "N–S players are ranked with N–S players, E–W with E–W. You keep this seat for every board.": "N–S-spillere rangeres mot N–S, Ø–V mot Ø–V. Du beholder plassen i alle spillene.", "Against 10 robot tables": "Mot 10 robotbord", "= your score against 10 robot tables that played the same boards; it ranks the players until others have played.": "= resultatet ditt mot 10 robotbord som spilte de samme spillene; det rangerer spillerne til andre har spilt.", "Leave": "Gå", "Leave the table?": "Forlate bordet?", "Leave the table": "Forlat bordet", "Your rating": "Rangeringen din", "This week": "Denne uken", "This month": "Denne måneden", "This year": "I år", "All time": "Totalt", "System": "System", "IMP / board": "IMP / spill", "No rating yet — it shows once this player has played (with the new version).": "Ingen rangering ennå — den vises når spilleren har spilt (med den nye versjonen).", "Close — answer later": "Lukk — svar senere", "Cancel the tournament?": "Avlyse turneringen?", "Remove from my list": "Fjern fra listen min", "Join the tournament": "Bli med i turneringen", "Join and play": "Bli med og spill", "{0} started a tournament — everyone can play it": "{0} startet en turnering — alle kan spille den", "This tournament has not reached you yet — try again in a moment": "Turneringen har ikke kommet fram ennå — prøv igjen om litt", "your robot partner bids it too": "robotmakkeren melder det også", "Base system": "Grunnsystem", "Conventions": "Konvensjoner", "from the next deal": "fra neste spill", "In the lobby": "I lobbyen", "Claim": "Claim", "How many of the remaining {0} tricks do you take?": "Hvor mange av de {0} siste stikkene tar du?", "All {0}": "Alle ({0})", "Claim sent — waiting for the other side": "Claim sendt — venter på den andre siden", "You": "Du", "Could not work it out yet — play a little longer": "Kan ikke regnes ut ennå — spill litt til", "The robots do not accept: {0} tricks at most": "Robotene godtar ikke: høyst {0} stikk", "{0} claimed {1} of the last {2} tricks — accepted": "{0} claimet {1} av de siste {2} stikkene — godtatt", "{0} claimed {1} of the last {2} tricks — not accepted": "{0} claimet {1} av de siste {2} stikkene — ikke godtatt", "Robots": "Roboter", "The robots claimed the last {0} tricks — accepted": "Robotene claimet de siste {0} stikkene — godtatt", "The robots claimed the last {0} tricks — play goes on": "Robotene claimet de siste {0} stikkene — spillet fortsetter", "{0} claims {1} of the last {2} tricks": "{0} claimer {1} av de siste {2} stikkene", "The robots claim all of the last {0} tricks": "Robotene claimer alle de siste {0} stikkene", "{0} wants to take back their last {1}": "{0} vil ta tilbake sitt siste {1}", "move": "trekk", "call": "melding", "Do you agree?": "Er du enig?", "{0} wanted to take back their last {1} — not accepted": "{0} ville ta tilbake sitt siste {1} — ikke godtatt", "Nothing to take back, or the other side said no": "Ingenting å ta tilbake, eller den andre siden sa nei", "Table": "Bord", "Lobby": "Lobby", "Alone with robots": "Alene med roboter", "Shown in the lobby, nobody can join.": "Vises i lobbyen, ingen kan bli med.", "Open to others": "Åpent for andre", "Shown in the lobby: players can ask to join, you accept.": "Vises i lobbyen: spillere kan be om å bli med, du godtar.", "Message": "Melding", "Write a private message to {0}.": "Skriv en privat melding til {0}.", "Waiting for {0} to open the table": "Venter på at {0} åpner bordet", "Tournament board {0} of {1}": "Turneringsspill {0} av {1}", "Pair": "Par", "Points": "Poeng", "{0} tables": "{0} bord", "individual": "individuell", "at tables": "ved bord", "ranked by {0}": "rangert etter {0}", "started by {0}": "startet av {0}", "table {0}, you sit {1}": "bord {0}, du sitter {1}", "Open table {0}": "Åpne bord {0}", "Join table {0}": "Gå til bord {0}", "Table {0}": "Bord {0}", "Name": "Navn", "Boards": "Antall spill", "Format": "Form", "Tables": "Bord", "Ranking": "Rangering", "Keep the tournament for": "Behold turneringen i", "{0} hours": "{0} timer", "1 day": "1 dag", "3 days": "3 dager", "Players sit together at tables; every table plays the same boards; robots fill empty seats. The first player named at a table opens it.": "Spillerne sitter sammen ved bord; alle bord spiller de samme spillene; roboter fyller tomme plasser. Den første spilleren ved et bord åpner det.", "Players in the lobby": "Spillere i lobbyen", "Invite players": "Inviter spillere", "wants to join your table": "vil bli med ved bordet ditt", "wants to watch your table": "vil se på bordet ditt", "more waiting": "venter til", "Open an online table first": "Åpne et online-bord først", "Invitation sent to {0}": "Invitasjon sendt til {0}", "invites you to their table": "inviterer deg til bordet sitt", "Nobody else is in the lobby right now.": "Ingen andre er i lobbyen nå.", "Invite to my table": "Inviter til mitt bord", "Open an online table to invite players to it.": "Åpne et online-bord for å invitere spillere.", "Public table": "Åpent bord", "Private table": "Lukket bord", "Listed in the lobby: anyone can ask to join, you accept.": "Vises i lobbyen: alle kan be om å bli med, du godtar.", "Shown in the lobby with 🔒: invited players sit at once, others must ask you, no spectators.": "Vises i lobbyen med 🔒: inviterte setter seg med en gang, andre må spørre deg, ingen tilskuere.",     "Clear the chat": "Tøm chatten", "Open an online table": "Åpne et online-bord", "Open your own online table (players ask to join and you accept them), or ask to join one of the tables below.": "Åpne ditt eget online-bord (spillere ber om å bli med og du godtar dem), eller be om å bli med ved et av bordene under.",
    "setting up": "settes opp", "{0} accepted": "{0} har takket ja", "Players and start": "Spillere og start", "Waiting for {0} to start": "Venter på at {0} starter", "{0} invites you": "{0} inviterer deg", "{0} invites you to a tournament": "{0} inviterer deg til en turnering",
    "No tournaments yet. Create one and invite the players you want.": "Ingen turneringer ennå. Lag en og inviter spillerne du vil.", "accepted": "takket ja", "declined": "takket nei", "invited": "invitert", "organiser": "arrangør",
    "Everyone plays the same deals at their own table, sitting South. The tournament opens when you press Start.": "Alle spiller de samme spillene ved sitt eget bord, som Syd. Turneringen åpner når du trykker Start.", "Players to invite": "Spillere som skal inviteres",
    "Nobody else is in the lobby right now — type a name below.": "Ingen andre er i lobbyen nå — skriv et navn under.", "Add a player by name": "Legg til en spiller med navn", "Add": "Legg til", "Answers": "Svar", "Send the invitations": "Send invitasjonene", "Start the tournament": "Start turneringen", "Cancel the tournament": "Avlys turneringen",
    "Pick at least one player": "Velg minst én spiller", "Invitations sent": "Invitasjonene er sendt", "The tournament has started": "Turneringen har startet", "This tournament has not started yet": "Denne turneringen har ikke startet ennå",
  },
};
function T(s, ...a) { let r = (I18N[SET.lang] || {})[s] || s; a.forEach((v, i) => { r = r.split('{' + i + '}').join(v); }); return r; }
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
const conKey = c => c ? `${LV(B(c.level, c.strain))}${symHtml(c.strain)}${c.dbl === 1 ? 'X' : c.dbl === 2 ? 'XX' : ''} ${SEAT[c.decl][0]}` : 'Pass';
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
  if (!SET.lang) { const l = (navigator.language || 'en').toLowerCase(); SET.lang = l.startsWith('tr') ? 'tr' : /^(nb|nn|no)/.test(l) ? 'no' : 'en'; }
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
const conTxt = e => e.passed || !e.c ? "Pass" : e.c.level + STR[e.c.strain] + (e.c.dbl === 1 ? "X" : e.c.dbl === 2 ? "XX" : "") + " " + SEAT[e.c.decl][0] + " " + (d => d > 0 ? '+' + d : d === 0 ? '=' : String(d))(e.tricks - (e.c.level + 6));
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
     ${guest() ? `<button class="btn" id="nLeave">🚪 ${T("Leave")}</button>` : online() ? `<button class="btn" id="nStop">🚪 ${T("Close table")}</button>` : `<button class="btn" id="bLeave">🚪 ${T("Leave")}</button>`}
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
  const langs = [['en', 'English'], ['tr', 'Türkçe'], ['no', 'Norsk']];
  const sec = (k, label) => `<button class="hsec" data-hsec="${k}">${label}</button>`;
  return `<div class="home">
  <header class="hhead"><div class="brand"><span class="suits">♠<i>♥</i><i>♦</i>♣</span>${T('Bridge Table')}</div>
    <div class="seg" data-seg="lang">${langs.map(([v, l]) => `<button data-v="${v}" class="${SET.lang === v ? 'on' : ''}">${l}</button>`).join('')}</div></header>
  <div class="hgrid">
    <section class="hmain">
      <div class="hcard hero">
        <div class="hname hrow"><label><span>${T('Your name')}</span><input id="hName" class="tok" maxlength="20" autocomplete="nickname" value="${esc(myNm())}" placeholder="${T('Your name')}"></label>
        <label><span>${T('Your system')}</span><select id="hSys" class="sel">${E.SYSTEMS.map(s => `<option value="${s.k}" ${(SET.sys || 'twoone') === s.k ? 'selected' : ''}>${esc(({ twoone: '2/1 GF', sayc: 'SAYC', acol: 'Acol', sef: 'SEF', precision: 'Precision', polish: 'Polish Club' })[s.k] || s.n)}</option>`).join('')}</select></label></div>
        <div class="muted">${T('Play alone with robots, or join a table where a robot is playing.')}</div>
        <div class="hbtns"><button class="btn new" id="bGo"><span id="hGo"></span></button><button class="btn hopen" id="hOpen">🌐 ${T('Open an online table')}</button><button class="btn gold hquick" id="hQuick">${T('Seat me at a table')}</button><button class="btn htour" data-hsec="tours">🏆 ${T('Tournaments')}</button><div class="hrow3"><button class="btn hwatch" id="hWatch">👁 ${T('Watch a table')}</button><button class="btn" id="bSet">⚙ ${T('Settings')}</button><button class="btn" id="bHelp">❔ ${T('Help')}</button></div></div>
        <div class="hsecs">${sec('conv', '📋 ' + T('Our convention card (with partner)'))}${sec('people', '👥 ' + T('Players in the lobby'))}<button class="hsec phoneonly" data-hsec="chat">💬 ${T('Lobby chat')} <span id="hChatN"></span></button></div>
        
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
  const list = L.length ? L.map(t => {
    const players = Object.keys(t.joined).length, kind = t.format === 'tables' ? T('{0} tables', t.tables.length) : T('individual');
    let info, btns;
    if (t.state === 'setup') {
      info = `${T('{0} boards', t.n)} · ${kind} · ${T('setting up')} · ${T('{0} accepted', players)}`;
      btns = Net.isMine(t) ? `<button class="btn gold" data-tset="${t.id}">${T('Players and start')}</button>`
        : Net.invitedTo(t) ? `<button class="btn new" data-tyes="${t.id}">${T('Accept')}</button><button class="btn" data-tno="${t.id}">${T('Decline')}</button>`
        : Net.openTour(t) && !t.joined[me] ? `<button class="btn new" data-tyes="${t.id}">🏆 ${T('Join the tournament')}</button>`
        : `<span class="muted">${T('Waiting for {0} to start', esc(t.by))}</span>`;
      if (Net.invitedTo(t)) info = `<b class="inv">${T('{0} invites you', esc(t.by))}</b> · ` + info;
    } else if (t.format === 'tables') {
      const seat = Net.myTourSeat(t), done = seat ? Object.keys(tableDone(t.id, seat.ti)).length : 0;
      info = `${T('{0} boards', t.n)} · ${kind}${seat ? ` · ${T('table {0}, you sit {1}', seat.ti + 1, SEAT[seat.seat])} · ${done}/${t.n}` : ''}`;
      btns = (seat && done < t.n ? (seat.host && seat.seat === seat.hostSeat ? `<button class="btn new" data-ttab="${t.id}">${T('Open table {0}', seat.ti + 1)}</button>` : `<button class="btn new" data-tjtab="${t.id}">${T('Join table {0}', seat.ti + 1)}</button>`) : '') + `<button class="btn" data-tstand="${t.id}">${T('Standings')}</button>`;
    } else {
      const done = Object.keys(myTour(t.id)).length;
      info = `${T('{0} boards', t.n)} · ${kind} · ${T('{0} players', players)} · ${T('you: {0}/{1}', done, t.n)}`;
      btns = `${done < t.n ? `<button class="btn new" data-tplay="${t.id}">${done ? T('Continue') : t.joined[me] ? T('Play') : '🏆 ' + T('Join and play')}</button>` : ''}<button class="btn" data-tstand="${t.id}">${T('Standings')}</button>`;
    }
    return `<div class="tourrow"><div><b>🏆 ${esc(t.name)}</b><small>${info}</small></div><div class="tbtns">${btns}${Net.isMine(t) ? `<button class="btn tdel" data-tdel="${t.id}" title="${T('Cancel the tournament')}">✕</button>` : ''}</div></div>`;
  }).join('') : `<div class="muted">${T('No tournaments yet. Create one and invite the players you want.')}</div>`;
  return `${list}<div class="row2 tnew"><button class="btn gold" id="tNew">➕ ${T('New tournament')}</button></div>`;
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
    <div class="grp"><span>${T('Name')}</span><input class="tok wide" id="tName" maxlength="40" value="${esc(t.name)}"></div>
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
  const p = me ? Net.prof() : Net.profOf(name), sys = p && p.sys ? E.sysOf(p.sys).n : '';
  const PN = ['Today', 'This week', 'This month', 'This year', 'All time'];
  const per = p && p.per ? p.per : p ? [[p.n, p.imp, p.mp]] : [];
  const rows = per.map((r, i) => `<tr><td>${T(PN[i])}</td><td class="n">${r[0] || 0}</td><td class="n">${r[1] == null ? '—' : fmtSigned(r[1])}</td><td class="n">${r[2] == null ? '—' : r[2] + '%'}</td></tr>`).join('');

  openOv('player', `<h2>👤 ${esc(name)}</h2>${sys ? `<div class="muted">${T('System')}: <b>${esc(sys)}</b></div>` : ''}
    ${rows ? `<div class="resscroll"><table class="res"><thead><tr><th></th><th class="n">${T('boards')}</th><th class="n">${T('IMP / board')}</th><th class="n">MP %</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="muted">${T('No rating yet — it shows once this player has played (with the new version).')}</div>`}
    <div class="row2">${me ? '' : `<button class="btn gold" data-dm="${esc(name)}">💬 ${T('Message')}</button><button class="btn new" data-pairwith="${esc(name)}">🤝 ${T('Play as partners')}</button><button class="btn" data-friend="${esc(name)}">${isFriend(name) ? '★ ' + T('Friend') : '☆ ' + T('Add as friend')}</button>`}<button class="btn" id="oClose">${T('Close')}</button></div>`);
}
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
   ${row("guide-en.html", "English", "🇬🇧")}${row("guide-no.html", "Norsk", "🇳🇴")}${row("guide.html", "Türkçe", "🇹🇷")}
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
  if (hsb) { const v = hsb.dataset.hsec; ui.hsec = !v || ui.hsec === v ? null : v; render(); if (ui.hsec === 'chat') { const i = $('lMsg2'); if (i) i.focus(); } return; }
  const opb = ev_.target.closest('[data-open]'); if (opb) { closeOv(); ui.saved = null; Net.openTable(opb.dataset.open === 'priv'); return; }
  const ar = ev_.target.closest('[data-askr]'); if (ar) { const f = ui.askFin; ui.askFin = null; askClose(); if (f) f(ar.dataset.askr === '1'); return; }
  const cn = ev_.target.closest('[data-claimn]'); if (cn) { claimChosen(+cn.dataset.claimn); return; }
  const tp = ev_.target.closest('[data-tplay]'); if (tp) { playTour(tp.dataset.tplay); return; }
  const tbd = ev_.target.closest('[data-tbd]'); if (tbd) { ui.tbd = { id: tbd.dataset.tid, b: +tbd.dataset.tbd }; showStandings(tbd.dataset.tid); return; }
  const tpr = ev_.target.closest('[data-tprac]'); if (tpr) { practiceTour(tpr.dataset.tprac, 1); return; }
  if (ev_.target.closest('#yesOk')) { const f = ui.yesFn; ui.yesFn = null; closeOv(); if (f) f(); return; }
  const tsit = ev_.target.closest('[data-tsit]'); if (tsit) { const S = tourSeats(); S[tsit.dataset.tid] = +tsit.dataset.tsit; try { localStorage.setItem('bridge-tour-seats', JSON.stringify(S)); } catch (e) {} closeOv(); playTour(tsit.dataset.tid); return; }
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
    if (seg === 'lang') { SET.lang = v; Store.saveSettings(SET); save(); render(); return; }
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
