// The hand of the day (/bridge/<lang>/daily/): every night a new deal, bid by the robots, solved double dummy, written
// as a page in each language, with the question "what do you bid as South?" and the answer below it; the list of the
// last days, the sitemap and a link from the language pages. Run by .github/workflows/daily.yml (or by hand:
// node .github/daily/daily.js [YYYY-MM-DD]).
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '../..') + '/';
const SITE = 'https://servetsvm.github.io/bridge/';
const LANGS = ['en', 'tr', 'no', 'es', 'fr', 'it', 'de', 'ru', 'pl', 'zh'];
const NAMES = { en: 'English', tr: 'Türkçe', no: 'Norsk', es: 'Español', fr: 'Français', it: 'Italiano', de: 'Deutsch', ru: 'Русский', pl: 'Polski', zh: '中文' };
const KEEP = 60;   // days kept in the sitemap and the list
const T = {
  en: { h: 'Hand of the day', home: 'Bridge Table', seats: 'NESW', nt: 'NT', pass: 'Pass', d: 'Daily bridge hand for {0}: what would you bid as South? The robots\' auction, the contract, the double-dummy result and every makeable contract.', board: 'Board {0}', dealer: 'Dealer', vul: 'Vulnerable', none: 'None', all: 'All', q: 'Your turn as South: what do you bid?', you: 'Your hand (South)', sofar: 'The auction so far', show: 'Show the answer', robot: 'The robot bid', full: 'The whole deal', auction: 'Auction', contract: 'Contract', passed: 'Passed out', lead: 'Opening lead', ddr: 'Double dummy, declarer takes {0} tricks: {1}.', made: 'made', over: 'made with {0} overtrick(s)', down: '{0} down', table: 'Makeable contracts (double dummy)', tricks: 'tricks', play: '▶ Play this deal against the robots', prev: 'Previous hands', learn: 'Learn bridge' },
  tr: { h: 'Günün eli', home: 'Briç Masası', seats: 'KDGB', nt: 'SA', pass: 'Pas', d: '{0} günün briç eli: Güney olarak ne derdin? Robotların deklarasyonu, kontrat, double dummy sonuç ve yapılabilen bütün kontratlar.', board: 'El {0}', dealer: 'Dağıtan', vul: 'Zon', none: 'Yok', all: 'Herkes', q: 'Sıra Güney\'de, yani sende: ne dersin?', you: 'Elin (Güney)', sofar: 'Şu ana kadar deklarasyon', show: 'Cevabı göster', robot: 'Robotun deklarasyonu', full: 'Bütün el', auction: 'Deklarasyon', contract: 'Kontrat', passed: 'Pas geçildi', lead: 'İlk atak', ddr: 'Double dummy deklaran {0} löve alır: {1}.', made: 'yapılır', over: '{0} fazlayla yapılır', down: '{0} batar', table: 'Yapılabilen kontratlar (double dummy)', tricks: 'löve', play: '▶ Bu eli robotlara karşı oyna', prev: 'Önceki eller', learn: 'Briç öğren' },
  no: { h: 'Dagens spill', home: 'Bridgebord', seats: 'NØSV', nt: 'NT', pass: 'Pass', d: 'Dagens bridgespill {0}: hva melder du som Syd? Robotenes meldinger, kontrakten, resultatet med åpne kort og alle kontrakter som står.', board: 'Spill {0}', dealer: 'Giver', vul: 'Sone', none: 'Ingen', all: 'Alle', q: 'Din tur som Syd: hva melder du?', you: 'Din hånd (Syd)', sofar: 'Meldingene så langt', show: 'Vis svaret', robot: 'Roboten meldte', full: 'Hele spillet', auction: 'Meldinger', contract: 'Kontrakt', passed: 'Passet rundt', lead: 'Utspill', ddr: 'Med åpne kort tar spilleføreren {0} stikk: {1}.', made: 'står', over: 'står med {0} overstikk', down: '{0} beit', table: 'Kontrakter som står (åpne kort)', tricks: 'stikk', play: '▶ Spill dette spillet mot robotene', prev: 'Tidligere spill', learn: 'Lær bridge' },
  es: { h: 'La mano del día', home: 'Mesa de Bridge', seats: 'NESO', nt: 'ST', pass: 'Paso', d: 'Mano de bridge del día {0}: ¿qué dirías como Sur? La subasta de los robots, el contrato, el resultado a doble muerto y todos los contratos que se cumplen.', board: 'Mano {0}', dealer: 'Reparte', vul: 'Vulnerables', none: 'Nadie', all: 'Todos', q: 'Te toca como Sur: ¿qué dices?', you: 'Tu mano (Sur)', sofar: 'La subasta hasta ahora', show: 'Ver la respuesta', robot: 'El robot dijo', full: 'La mano completa', auction: 'Subasta', contract: 'Contrato', passed: 'Pasada', lead: 'Salida', ddr: 'A doble muerto el declarante hace {0} bazas: {1}.', made: 'se cumple', over: 'se cumple con {0} de más', down: '{0} multa(s)', table: 'Contratos que se cumplen (doble muerto)', tricks: 'bazas', play: '▶ Juega esta mano contra los robots', prev: 'Manos anteriores', learn: 'Aprende bridge' },
  fr: { h: 'La donne du jour', home: 'Table de Bridge', seats: 'NESO', nt: 'SA', pass: 'Passe', d: 'Donne de bridge du {0} : que dites-vous en Sud ? Les enchères des robots, le contrat, le résultat à cartes ouvertes et tous les contrats gagnants.', board: 'Donne {0}', dealer: 'Donneur', vul: 'Vulnérables', none: 'Personne', all: 'Tous', q: 'À vous en Sud : que dites-vous ?', you: 'Votre main (Sud)', sofar: 'Les enchères jusqu’ici', show: 'Voir la réponse', robot: 'Le robot a dit', full: 'La donne complète', auction: 'Enchères', contract: 'Contrat', passed: 'Passe générale', lead: 'Entame', ddr: 'À cartes ouvertes le déclarant fait {0} levées : {1}.', made: 'contrat réussi', over: 'réussi avec {0} de mieux', down: '{0} de chute', table: 'Contrats gagnants (cartes ouvertes)', tricks: 'levées', play: '▶ Jouez cette donne contre les robots', prev: 'Donnes précédentes', learn: 'Apprendre le bridge' },
  it: { h: 'La smazzata del giorno', home: 'Tavolo di Bridge', seats: 'NESO', nt: 'SA', pass: 'Passo', d: 'Smazzata di bridge del {0}: cosa diresti da Sud? La licita dei robot, il contratto, il risultato a carte viste e tutti i contratti che si fanno.', board: 'Smazzata {0}', dealer: 'Mazziere', vul: 'In zona', none: 'Nessuno', all: 'Tutti', q: 'Tocca a te da Sud: cosa dichiari?', you: 'La tua mano (Sud)', sofar: 'La licita finora', show: 'Mostra la risposta', robot: 'Il robot ha dichiarato', full: 'La smazzata intera', auction: 'Licita', contract: 'Contratto', passed: 'Tutti passano', lead: 'Attacco', ddr: 'A carte viste il giocante fa {0} prese: {1}.', made: 'contratto fatto', over: 'fatto con {0} in più', down: '{0} down', table: 'Contratti che si fanno (carte viste)', tricks: 'prese', play: '▶ Gioca questa smazzata contro i robot', prev: 'Smazzate precedenti', learn: 'Impara il bridge' },
  de: { h: 'Das Board des Tages', home: 'Bridgetisch', seats: 'NOSW', nt: 'SA', pass: 'Passe', d: 'Bridge-Board des Tages vom {0}: Was bietest du als Süd? Die Reizung der Roboter, der Kontrakt, das Double-Dummy-Ergebnis und alle erfüllbaren Kontrakte.', board: 'Board {0}', dealer: 'Teiler', vul: 'In Gefahr', none: 'Niemand', all: 'Alle', q: 'Du bist als Süd dran: Was bietest du?', you: 'Dein Blatt (Süd)', sofar: 'Die Reizung bisher', show: 'Antwort zeigen', robot: 'Der Roboter bot', full: 'Das ganze Board', auction: 'Reizung', contract: 'Kontrakt', passed: 'Alle passen', lead: 'Ausspiel', ddr: 'Double Dummy macht der Alleinspieler {0} Stiche: {1}.', made: 'erfüllt', over: 'erfüllt mit {0} Überstich(en)', down: '{0} Faller', table: 'Erfüllbare Kontrakte (Double Dummy)', tricks: 'Stiche', play: '▶ Dieses Board gegen die Roboter spielen', prev: 'Frühere Boards', learn: 'Bridge lernen' },
  ru: { h: 'Сдача дня', home: 'Бридж-стол', seats: 'СВЮЗ', nt: 'БК', pass: 'Пас', d: 'Бриджевая сдача дня {0}: что бы вы заявили за Юга? Торговля роботов, контракт, результат в открытую и все выполнимые контракты.', board: 'Сдача {0}', dealer: 'Сдающий', vul: 'В зоне', none: 'Никто', all: 'Все', q: 'Ваша очередь за Юга: что вы заявите?', you: 'Ваша рука (Юг)', sofar: 'Торговля до вас', show: 'Показать ответ', robot: 'Робот заявил', full: 'Вся сдача', auction: 'Торговля', contract: 'Контракт', passed: 'Все пас', lead: 'Первый ход', ddr: 'В открытую разыгрывающий берёт {0} взяток: {1}.', made: 'контракт выполнен', over: 'выполнен с {0} лишними', down: 'без {0}', table: 'Выполнимые контракты (в открытую)', tricks: 'взяток', play: '▶ Сыграйте эту сдачу против роботов', prev: 'Прошлые сдачи', learn: 'Учим бридж' },
  pl: { h: 'Rozdanie dnia', home: 'Stół Brydżowy', seats: 'NESW', nt: 'BA', pass: 'Pas', d: 'Brydżowe rozdanie dnia {0}: co licytujesz jako S? Licytacja robotów, kontrakt, wynik w widne karty i wszystkie realne kontrakty.', board: 'Rozdanie {0}', dealer: 'Rozdaje', vul: 'Po partii', none: 'Nikt', all: 'Wszyscy', q: 'Twoja kolej jako S: co licytujesz?', you: 'Twoja ręka (S)', sofar: 'Dotychczasowa licytacja', show: 'Pokaż odpowiedź', robot: 'Robot zalicytował', full: 'Całe rozdanie', auction: 'Licytacja', contract: 'Kontrakt', passed: 'Wszyscy pasują', lead: 'Wist', ddr: 'W widne karty rozgrywający bierze {0} lew: {1}.', made: 'kontrakt ugrany', over: 'ugrany z {0} nadróbką', down: '{0} bez', table: 'Realne kontrakty (widne karty)', tricks: 'lew', play: '▶ Zagraj to rozdanie z robotami', prev: 'Poprzednie rozdania', learn: 'Nauka brydża' },
  zh: { h: '每日一牌', home: '桥牌桌', seats: '北东南西', nt: 'NT', pass: '不叫', d: '{0}的每日桥牌:你坐南家会叫什么?机器人的叫牌、定约、双明手结果以及所有能做成的定约。', board: '第{0}副', dealer: '发牌', vul: '有局', none: '双无', all: '双有', q: '轮到南家的你:你叫什么?', you: '你的牌(南)', sofar: '到目前为止的叫牌', show: '查看答案', robot: '机器人叫了', full: '全副牌', auction: '叫牌', contract: '定约', passed: '四家不叫', lead: '首攻', ddr: '双明手庄家拿{0}墩:{1}。', made: '完成', over: '超{0}墩完成', down: '宕{0}', table: '能做成的定约(双明手)', tricks: '墩', play: '▶ 与机器人打这副牌', prev: '往日牌例', learn: '学桥牌' },
};
const LT = {"en":{"tl":"Opening lead problem","sn":["North","East","South","West"],"ql":"You are {0}: what do you lead?","ya":"Your hand ({0})","al":"Only a {0} lead beats the contract: the defence needs {1} tricks.","cs":"Lead","cd":"This deal","cm":"On average","cmn":"Tricks for the defence after each suit’s lead: on this deal (double dummy) and on average over {0} deals that fit the auction.","rl":"The lead by the book, {0}, lets the contract make.","dl":"Daily bridge problem for {0}: what do you lead? The auction, your hand, and the only lead that beats the contract."},"tr":{"tl":"İlk atak problemi","sn":["Kuzey","Doğu","Güney","Batı"],"ql":"{0} sensin: ne atarsın?","ya":"Elin ({0})","al":"Kontratı yalnızca {0} atağı batırır: savunmanın {1} löve alması gerekir.","cs":"Atak","cd":"Bu elde","cm":"Ortalama","cmn":"Her rengin atağından sonra savunmanın lövesi: bu elde (double dummy) ve deklarasyona uyan {0} elin ortalamasında.","rl":"Kitaba göre atak, {0}, kontratın yapılmasına izin verir.","dl":"{0} günün briç problemi: ne atarsın? Deklarasyon, elin ve kontratı batıran tek atak."},"no":{"tl":"Utspillsproblem","sn":["Nord","Øst","Syd","Vest"],"ql":"Du er {0}: hva spiller du ut?","ya":"Din hånd ({0})","al":"Bare utspill i {0} beiter kontrakten: forsvaret trenger {1} stikk.","cs":"Utspill","cd":"Dette spillet","cm":"I snitt","cmn":"Forsvarets stikk etter utspill i hver farge: i dette spillet (åpne kort) og i snitt over {0} spill som passer med meldingene.","rl":"Utspillet etter boka, {0}, lar kontrakten stå.","dl":"Dagens bridgeproblem {0}: hva spiller du ut? Meldingene, hånden din og det eneste utspillet som beiter kontrakten."},"es":{"tl":"Problema de salida","sn":["Norte","Este","Sur","Oeste"],"ql":"Eres {0}: ¿con qué sales?","ya":"Tu mano ({0})","al":"Solo una salida a {0} derrota el contrato: la defensa necesita {1} bazas.","cs":"Salida","cd":"En esta mano","cm":"De media","cmn":"Bazas de la defensa tras salir de cada palo: en esta mano (doble muerto) y de media en {0} manos que encajan con la subasta.","rl":"La salida de manual, {0}, deja cumplir el contrato.","dl":"Problema de bridge del día {0}: ¿con qué sales? La subasta, tu mano y la única salida que derrota el contrato."},"fr":{"tl":"Problème d’entame","sn":["Nord","Est","Sud","Ouest"],"ql":"Vous êtes {0} : quelle est votre entame ?","ya":"Votre main ({0})","al":"Seule une entame {0} fait chuter le contrat : la défense a besoin de {1} levées.","cs":"Entame","cd":"Sur cette donne","cm":"En moyenne","cmn":"Levées de la défense après l’entame de chaque couleur : sur cette donne (cartes ouvertes) et en moyenne sur {0} donnes compatibles avec les enchères.","rl":"L’entame de manuel, {0}, laisse gagner le contrat.","dl":"Problème de bridge du {0} : quelle est votre entame ? Les enchères, votre main et la seule entame qui fait chuter le contrat."},"it":{"tl":"Problema d’attacco","sn":["Nord","Est","Sud","Ovest"],"ql":"Sei {0}: con cosa attacchi?","ya":"La tua mano ({0})","al":"Solo un attacco a {0} batte il contratto: alla difesa servono {1} prese.","cs":"Attacco","cd":"In questa smazzata","cm":"In media","cmn":"Prese della difesa dopo l’attacco in ogni seme: in questa smazzata (carte viste) e in media su {0} smazzate coerenti con la licita.","rl":"L’attacco da manuale, {0}, lascia fare il contratto.","dl":"Problema di bridge del {0}: con cosa attacchi? La licita, la tua mano e l’unico attacco che batte il contratto."},"de":{"tl":"Ausspielproblem","sn":["Nord","Ost","Süd","West"],"ql":"Du bist {0}: was spielst du aus?","ya":"Dein Blatt ({0})","al":"Nur ein Ausspiel in {0} schlägt den Kontrakt: die Verteidigung braucht {1} Stiche.","cs":"Ausspiel","cd":"In diesem Board","cm":"Im Schnitt","cmn":"Stiche der Verteidigung nach dem Ausspiel jeder Farbe: in diesem Board (Double Dummy) und im Schnitt über {0} Verteilungen, die zur Reizung passen.","rl":"Das Ausspiel nach Lehrbuch, {0}, lässt den Kontrakt erfüllen.","dl":"Bridgeproblem des Tages vom {0}: was spielst du aus? Die Reizung, dein Blatt und das einzige Ausspiel, das den Kontrakt schlägt."},"ru":{"tl":"Задача на первый ход","sn":["Север","Восток","Юг","Запад"],"ql":"Вы — {0}: с чего вы пойдёте?","ya":"Ваша рука ({0})","al":"Контракт подсаживает только ход в {0}: защите нужно {1} взяток.","cs":"Ход","cd":"В этой сдаче","cm":"В среднем","cmn":"Взятки защиты после хода в каждую масть: в этой сдаче (в открытую) и в среднем по {0} раскладам, согласным с торговлей.","rl":"Ход по учебнику, {0}, позволяет выполнить контракт.","dl":"Бриджевая задача дня {0}: с чего вы пойдёте? Торговля, ваша рука и единственный ход, который подсаживает контракт."},"pl":{"tl":"Problem wistu","sn":["N","E","S","W"],"ql":"Jesteś {0}: czym wistujesz?","ya":"Twoja ręka ({0})","al":"Tylko wist w {0} obkłada kontrakt: obrona potrzebuje {1} lew.","cs":"Wist","cd":"W tym rozdaniu","cm":"Średnio","cmn":"Lewy obrony po wiście w każdy kolor: w tym rozdaniu (w widne karty) i średnio w {0} rozkładach zgodnych z licytacją.","rl":"Wist podręcznikowy, {0}, pozwala ugrać kontrakt.","dl":"Brydżowy problem dnia {0}: czym wistujesz? Licytacja, twoja ręka i jedyny wist, który obkłada kontrakt."},"zh":{"tl":"首攻题","sn":["北","东","南","西"],"ql":"你是{0}家:你首攻什么?","ya":"你的牌({0})","al":"只有首攻{0}才能击败定约:防守方需要{1}墩。","cs":"首攻","cd":"本副牌","cm":"平均","cmn":"首攻各花色后防守方的墩数:本副牌(双明手)以及与叫牌相符的{0}副牌的平均值。","rl":"按常规的首攻{0}会让定约完成。","dl":"{0}的每日桥牌题:你首攻什么?叫牌、你的牌,以及唯一能击败定约的首攻。"}};
const PT = {"en":{"tp":"Declarer play problem","qp":"Trick one: {0} leads {1}. Which card do you play from dummy?","dmy":"Dummy ({0})","dcl":"You, declarer ({0})","ap":"Play {0} from dummy: the contract then makes against {1}% of the ways the defenders’ cards can lie.","np":"The natural {0} makes it only {1}% of the time.","ct":"From dummy","cp":"Makes","tn":"Each card tried against {0} deals of the defenders’ cards (the rest played double dummy).","dp":"Daily bridge problem for {0}: declarer play. The contract, dummy, your hand and the opening lead: which card from dummy at trick one?","act":"On this deal: {0}.","yes":"it makes","no":"it goes down"},"tr":{"tp":"Deklaran oyunu problemi","qp":"İlk löve: {0} {1} attı. Yerden hangi kartı oynarsın?","dmy":"Yer ({0})","dcl":"Sen, deklaran ({0})","ap":"Yerden {0} oyna: kontrat, rakip kartların dağılabileceği durumların %{1} kadarında yapılır.","np":"Akla gelen {0} ise sadece %{1} yapılır.","ct":"Yerden","cp":"Yapılır","tn":"Her kart, rakip kartların {0} farklı dağılımına karşı denendi (sonrası double dummy oynandı).","dp":"{0} günün briç problemi: deklaran oyunu. Kontrat, yer, senin elin ve ilk atak: ilk lövede yerden hangi kart?","act":"Bu elde: {0}.","yes":"yapılır","no":"batar"},"no":{"tp":"Spilleførerproblem","qp":"Første stikk: {0} spiller ut {1}. Hvilket kort tar du fra bordet?","dmy":"Blindemann ({0})","dcl":"Du, spillefører ({0})","ap":"Spill {0} fra bordet: da står kontrakten mot {1} % av måtene motspillernes kort kan sitte på.","np":"Det naturlige {0} står bare {1} % av gangene.","ct":"Fra bordet","cp":"Står","tn":"Hvert kort prøvd mot {0} fordelinger av motspillernes kort (resten spilt med åpne kort).","dp":"Dagens bridgeproblem {0}: spilleføring. Kontrakten, blindemann, hånden din og utspillet: hvilket kort fra bordet i første stikk?","act":"I dette spillet: {0}.","yes":"står","no":"går bet"},"es":{"tp":"Problema de carteo","qp":"Primera baza: {0} sale con {1}. ¿Qué carta juegas del muerto?","dmy":"Muerto ({0})","dcl":"Tú, declarante ({0})","ap":"Juega {0} del muerto: el contrato se cumple en el {1} % de las formas en que pueden estar las cartas de la defensa.","np":"La natural, {0}, solo lo cumple el {1} % de las veces.","ct":"Del muerto","cp":"Se cumple","tn":"Cada carta probada contra {0} repartos de las cartas de la defensa (el resto jugado a doble muerto).","dp":"Problema de bridge del día {0}: carteo. El contrato, el muerto, tu mano y la salida: ¿qué carta del muerto en la primera baza?","act":"En esta mano: {0}.","yes":"se cumple","no":"se multa"},"fr":{"tp":"Problème de jeu de la carte","qp":"Première levée : {0} entame {1}. Quelle carte jouez-vous du mort ?","dmy":"Le mort ({0})","dcl":"Vous, déclarant ({0})","ap":"Jouez {0} du mort : le contrat gagne alors contre {1} % des répartitions possibles des cartes adverses.","np":"La carte naturelle, {0}, ne gagne que {1} % des fois.","ct":"Du mort","cp":"Gagne","tn":"Chaque carte essayée contre {0} répartitions des cartes adverses (la suite jouée à cartes ouvertes).","dp":"Problème de bridge du {0} : jeu de la carte. Le contrat, le mort, votre main et l’entame : quelle carte du mort à la première levée ?","act":"Sur cette donne : {0}.","yes":"il gagne","no":"il chute"},"it":{"tp":"Problema di gioco col morto","qp":"Prima presa: {0} attacca {1}. Quale carta giochi dal morto?","dmy":"Morto ({0})","dcl":"Tu, giocante ({0})","ap":"Gioca {0} dal morto: il contratto si fa contro il {1}% delle possibili distribuzioni delle carte avversarie.","np":"La carta naturale, {0}, lo fa solo il {1}% delle volte.","ct":"Dal morto","cp":"Si fa","tn":"Ogni carta provata contro {0} distribuzioni delle carte avversarie (il resto giocato a carte viste).","dp":"Problema di bridge del {0}: gioco col morto. Il contratto, il morto, la tua mano e l’attacco: quale carta dal morto alla prima presa?","act":"In questa smazzata: {0}.","yes":"si fa","no":"va sotto"},"de":{"tp":"Alleinspielproblem","qp":"Erster Stich: {0} spielt {1} aus. Welche Karte spielst du vom Dummy?","dmy":"Dummy ({0})","dcl":"Du, Alleinspieler ({0})","ap":"Spiele {0} vom Dummy: dann gewinnt der Kontrakt gegen {1} % der möglichen Verteilungen der gegnerischen Karten.","np":"Die naheliegende {0} gewinnt nur in {1} % der Fälle.","ct":"Vom Dummy","cp":"Gewinnt","tn":"Jede Karte gegen {0} Verteilungen der gegnerischen Karten probiert (der Rest Double Dummy gespielt).","dp":"Bridgeproblem des Tages vom {0}: Alleinspiel. Der Kontrakt, der Dummy, dein Blatt und das Ausspiel: welche Karte vom Dummy im ersten Stich?","act":"In diesem Board: {0}.","yes":"er gewinnt","no":"er fällt"},"ru":{"tp":"Задача на розыгрыш","qp":"Первая взятка: {0} ходит {1}. Какую карту вы кладёте со стола?","dmy":"Болван ({0})","dcl":"Вы, разыгрывающий ({0})","ap":"Положите со стола {0}: тогда контракт выполняется при {1}% возможных раскладов карт защиты.","np":"Естественная карта, {0}, выполняет его лишь в {1}% случаев.","ct":"Со стола","cp":"Выполняется","tn":"Каждая карта проверена против {0} раскладов карт защиты (дальше розыгрыш в открытую).","dp":"Бриджевая задача дня {0}: розыгрыш. Контракт, болван, ваша рука и первый ход: какую карту со стола в первой взятке?","act":"В этой сдаче: {0}.","yes":"контракт выполнен","no":"контракт подсажен"},"pl":{"tp":"Problem rozgrywki","qp":"Pierwsza lewa: {0} wistuje {1}. Którą kartę dokładasz ze stołu?","dmy":"Dziadek ({0})","dcl":"Ty, rozgrywający ({0})","ap":"Dołóż ze stołu {0}: kontrakt wtedy wychodzi przy {1}% możliwych rozkładów kart obrońców.","np":"Naturalna karta, {0}, ugrywa go tylko w {1}% przypadków.","ct":"Ze stołu","cp":"Wychodzi","tn":"Każda karta sprawdzona na {0} rozkładach kart obrońców (dalej rozgrywka w widne karty).","dp":"Brydżowy problem dnia {0}: rozgrywka. Kontrakt, dziadek, twoja ręka i wist: którą kartę ze stołu w pierwszej lewie?","act":"W tym rozdaniu: {0}.","yes":"kontrakt wychodzi","no":"kontrakt pada"},"zh":{"tp":"坐庄题","qp":"第一墩:{0}首攻{1}。明手出哪张牌?","dmy":"明手({0})","dcl":"你,庄家({0})","ap":"明手出{0}:防守方牌型的各种可能中,有{1}%能完成定约。","np":"顺手的{0}只有{1}%能完成。","ct":"明手出","cp":"完成","tn":"每张牌都对防守方牌的{0}种分布试过(之后按双明手打)。","dp":"{0}的每日桥牌题:坐庄。定约、明手、你的牌和首攻:第一墩明手出哪张?","act":"本副牌:{0}。","yes":"定约完成","no":"定约宕了"}};
for (const l in PT) Object.assign(T[l], PT[l]);
for (const l in LT) Object.assign(T[l], LT[l], { sb: {"en":"The simulation of {0} deals that fit the auction finds the {1} lead best too.","tr":"Deklarasyona uyan {0} dağılımın simülasyonu da en iyi atak olarak {1} buluyor.","no":"Simuleringen av {0} spill som passer med meldingene finner også utspill i {1} best.","es":"La simulación de {0} manos que encajan con la subasta también encuentra mejor la salida a {1}.","fr":"La simulation de {0} donnes compatibles avec les enchères trouve aussi l’entame {1} la meilleure.","it":"Anche la simulazione di {0} smazzate coerenti con la licita trova migliore l’attacco a {1}.","de":"Auch die Simulation von {0} Verteilungen, die zur Reizung passen, findet das Ausspiel in {1} am besten.","ru":"Моделирование {0} раскладов, согласных с торговлей, тоже находит лучшим ход в {1}.","pl":"Symulacja {0} rozkładów zgodnych z licytacją również uznaje wist w {1} za najlepszy.","zh":"对{0}副与叫牌相符的牌进行模拟,同样认为首攻{1}最好。"}[l], dt: {"en":"Defence tricks","tr":"Savunma lövesi","no":"Forsvarets stikk","es":"Bazas de la defensa","fr":"Levées de la défense","it":"Prese della difesa","de":"Stiche der Verteidigung","ru":"Взятки защиты","pl":"Lewy obrony","zh":"防守墩数"}[l] });
const f = (s, ...a) => s.replace(/\{(\d)\}/g, (m, i) => a[i]);
const hl = l => l === 'no' ? 'nb' : l;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// the engine, as in the page (the fast solver too)
const ctx = { window: {}, console, performance, setTimeout, clearTimeout, WebAssembly, TextDecoder, TextEncoder, URL, crypto: globalThis.crypto, atob: globalThis.atob };
ctx.window.window = ctx.window; ctx.self = ctx.window; vm.createContext(ctx);
for (const file of ['dds.js', 'core.js', 'bidding.js', 'play.js', 'lang.js']) vm.runInContext(fs.readFileSync(root + 'js/' + file, 'utf8'), ctx, { filename: file });
const E = {}; for (const fn of ctx.window.BRIDGE) fn(E);
// the meanings of the calls in each language, as the app shows them (app.js bidTxt)
const BID_PH = vm.runInContext('BID_PH', ctx), BID_RE = {};
function bidTxt(t, L) {
  const col = LANGS.indexOf(L); if (col < 1 || !t) return t;
  let r = BID_RE[L];
  if (!r) {
    const map = new Map(BID_PH.map(p => [p[0].toLowerCase(), p[col]]));
    const keys = [...map.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    r = BID_RE[L] = { map, re: new RegExp('(?<!\\p{L})(' + keys.join('|') + ')(?!\\p{L})', 'giu') };
  }
  const out = String(t).replace(r.re, w => { const v = r.map.get(w.toLowerCase()); if (v == null) return w; return w[0] !== w[0].toLowerCase() && v ? v[0].toUpperCase() + v.slice(1) : v; });
  return out.replace(/ {2,}/g, ' ').replace(/ ([,:;)])/g, '$1').replace(/\( /g, '(').trim();
}

// the day (Istanbul time) and a deal of its own: the same date always gives the same deal
const today = process.argv[2] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
let s0 = 0; for (const ch of 'bridge-table-daily-' + today) s0 = (s0 * 31 + ch.charCodeAt(0)) >>> 0;
const rnd = () => { s0 = (s0 + 0x6D2B79F5) >>> 0; let t = s0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const dayNo = Math.round((Date.parse(today) - Date.parse(today.slice(0, 4) + '-01-01')) / 864e5);
const board = dayNo % 16 + 1, dealer = E.dealerOf(board);
const cards = [0, 1].map(() => ({ conv: { ...E.sysOf('twoone').conv }, agg: 0, sys: 'twoone' }));
const over = a => (a.length >= 4 && a.slice(-3).every(e => e.call === 'P') && a.some(e => e.call !== 'P')) || (a.length === 4 && a.every(e => e.call === 'P'));
const hcp = h => h.reduce((a, c) => a + Math.max(0, c % 13 - 8), 0);
const bidAll = deal => { const auc = []; let t = dealer; while (!over(auc) && auc.length < 60) { const r = E.aiBid(auc, t, deal[t], cards); auc.push({ seat: t, call: r.call, m: r.m }); t = (t + 1) % 4; } return auc; };
function contractOf(auc) {
  const bids = auc.filter(e => typeof e.call === 'number'); if (!bids.length) return null;
  const last = bids[bids.length - 1], strain = E.ST(last.call), side = last.seat & 1;
  const decl = auc.find(e => typeof e.call === 'number' && E.ST(e.call) === strain && (e.seat & 1) === side).seat;
  let dbl = 0; for (let i = auc.indexOf(last) + 1; i < auc.length; i++) { if (auc[i].call === 'X') dbl = 1; if (auc[i].call === 'XX') dbl = 2; }
  return { level: E.LV(last.call), strain, decl, dbl };
}
const gameLv = s => s === 4 ? 3 : s >= 2 ? 4 : 5;
/* a deal good enough to show (a page with a wrong answer is worse than none): South has a real decision (a bid at the
   first turn), every robot call fits the meaning it is given (its points within a point of the range), the contract is
   a game or more and makes double dummy, and the side misses no game or slam that makes double dummy */
function check(deal, auc, table) {
  const first = auc.findIndex(e => e.seat === 2);
  if (first < 0 || auc[first].call === 'P') return 'south passes';
  for (const e of auc) if (e.call !== 'P' && e.m) { const p = hcp(deal[e.seat]); if ((e.m.min != null && p < e.m.min - 1) || (e.m.max != null && p > e.m.max + 1)) return 'call off its meaning'; }
  const con = contractOf(auc); if (!con || con.level < 3) return 'part score';
  const side = con.decl & 1, best = s => Math.max(table[side][s], table[side + 2][s]);
  if (table[con.decl][con.strain] < con.level + 6) return 'goes down';
  for (let s = 0; s < 5; s++) {
    if (best(s) >= 12 && con.level < 6) return 'slam missed';
    if (best(s) >= gameLv(s) + 6 && con.level < gameLv(con.strain) && con.level < 6) return 'game missed';
  }
  return null;
}
/* a lead problem: the robots' auction to a game or more (every call within its stated points), led by declarer's
   left-hand opponent; on this deal (double dummy) the leads of one suit only beat the contract, at least two suits'
   leads let it make; the lead by the book (the rules the robots lead by without looking) is not that suit, and the
   simulation of the deals that fit the auction (the robots' own lead) finds that suit best too: the answer is reasoned,
   not lucky. Cheap tests first: the simulation takes seconds. */
const LOPT = { budget: 3000, maxSamples: 100, ddTricks: 12, lead: { budget: 8000, maxSamples: 160, minSamples: 80, evLim: 3000000, cap: 16000 } };
function leadProblem(deal, auc, keep) {
  for (const e of auc) if (e.call !== 'P' && e.m) { const p = hcp(deal[e.seat]); if ((e.m.min != null && p < e.m.min - 1) || (e.m.max != null && p > e.m.max + 1)) return 'call off its meaning'; }
  const con = contractOf(auc); if (!con || con.level < 3) return 'part score';
  if (con.level < gameLv(con.strain) && con.level < 6) return 'not a game';
  const L = (con.decl + 1) % 4, tr = con.strain < 4 ? con.strain : -1, need = 8 - con.level;
  const v = E.ddsValues(deal, [], L, tr); if (!v || !v.size) return 'no solver';
  const suitBest = [0, 1, 2, 3].map(s => { const c = deal[L].filter(x => (x / 13 | 0) === s); return c.length ? Math.max(...c.map(x => v.get(x))) : null; });
  const beat = [0, 1, 2, 3].filter(s => suitBest[s] != null && suitBest[s] >= need), fail = [0, 1, 2, 3].filter(s => suitBest[s] != null && suitBest[s] < need);
  if (!keep) { if (!beat.length) return 'nothing beats it'; if (beat.length > 1) return 'two suits beat it'; if (fail.length < 2) return 'too easy'; }
  const g0 = E.newPlayState(deal, con, auc, cards), rule = E.heurPlay(g0, L);
  if (!keep && beat.includes(rule / 13 | 0)) return 'the book lead beats it';
  const dbg = {}, g = E.newPlayState(deal, con, auc, cards), sim = E.aiPlay(g, L, { ...LOPT, lead: { ...LOPT.lead, dbg } });
  const avg = new Map(dbg.avg || []), simBest = [0, 1, 2, 3].map(s => { const c = [...avg].filter(([x]) => (x / 13 | 0) === s).map(([, a]) => a); return c.length ? Math.round(Math.max(...c) * 100) / 100 : null; });
  if (!keep && !beat.includes(sim / 13 | 0)) return 'the simulation leads another suit';
  { const top = simBest.filter(x => x != null).sort((a, b) => b - a); if (!keep && top.length > 1 && top[0] - top[1] < 0.2) return 'the simulation is not sure'; }
  return { L, need, beat, dd: suitBest, avg: simBest, n: dbg.n || 0, rule, sim, cards: [...v].filter(([, t]) => t >= need).map(([c]) => c) };
}
/* a declarer play problem: the robots' auction to a game or more, the opening lead by the book (declarer's left-hand
   opponent), and the decision at trick one: the card from dummy. Each card of dummy (touching cards as one) is tried
   on this deal and against SAMPLES deals of the defenders' cards (the 25 unseen cards dealt at random, the lead in the
   leader's hand): after it, the rest is played double dummy. A problem: one choice makes in 95% of them or more, the
   card a player plays without thinking (the robots' rules) clearly less often and goes down on this deal. */
const SAMPLES = 200;
function playProblem(deal, auc, keep) {
  for (const e of auc) if (e.call !== 'P' && e.m) { const p = hcp(deal[e.seat]); if ((e.m.min != null && p < e.m.min - 1) || (e.m.max != null && p > e.m.max + 1)) return 'call off its meaning'; }
  const con = contractOf(auc); if (!con || con.level < 3) return 'part score';
  if (con.level < gameLv(con.strain) && con.level < 6) return 'not a game';
  const D = con.decl, L = (D + 1) % 4, M = (D + 2) % 4, R = (D + 3) % 4, tr = con.strain < 4 ? con.strain : -1, need = con.level + 6;
  const g = E.newPlayState(deal, con, auc, cards), lead = E.heurPlay(g, L); E.applyCard(g, L, lead); g.dummyShown = true;
  const leg = E.legalFor(g, M), seen = new Set([...deal[D], ...deal[M], lead]);
  // dummy's cards, touching ones (no unseen card between them) as one
  const reps = []; for (const c of leg.slice().sort((a, b) => b - a)) { const p = reps[reps.length - 1]; let same = p != null && (p / 13 | 0) === (c / 13 | 0); if (same) for (let k = c + 1; k < p; k++) if (!seen.has(k)) { same = false; break; } if (same) reps[reps.length - 1] = c; else reps.push(c); }
  if (reps.length < 2) return 'one card only';
  const repOf = c => { const x = leg.slice().sort((a, b) => b - a).filter(k => (k / 13 | 0) === (c / 13 | 0)); let r = c; for (const k of reps) if ((k / 13 | 0) === (c / 13 | 0) && k <= c) { let ok = true; for (let j = k + 1; j < c; j++) if (!seen.has(j)) { ok = false; break; } if (ok) { r = k; break; } } return r; };
  const nat = repOf(E.heurPlay(g, M));
  const makes = (hands, c) => { const h = hands.map((x, i) => i === M ? x.filter(k => k !== c) : i === L ? x.filter(k => k !== lead) : x); const v = E.ddsValues(h, [{ s: L, c: lead }, { s: M, c }], R, tr); return v && v.size ? 13 - Math.max(...v.values()) >= need : null; };
  // this deal first (cheap): the natural card must go down and another card make
  const real = new Map(reps.map(c => [c, makes(deal, c)]));
  if (!keep && real.get(nat) !== false) return 'the natural card makes it';
  if (!keep && ![...real.values()].some(Boolean)) return 'nothing makes it';
  // the defenders' cards dealt again and again
  const unseen = [...Array(52).keys()].filter(c => !seen.has(c)), win = new Map(reps.map(c => [c, 0]));
  let rs = 0; for (const ch of JSON.stringify(deal)) rs = (rs * 31 + ch.charCodeAt(0)) >>> 0;
  const r = () => { rs = (rs + 0x6D2B79F5) >>> 0; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let n = 0; n < SAMPLES; n++) {
    const u = unseen.slice(); for (let i = u.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [u[i], u[j]] = [u[j], u[i]]; }
    const hands = []; hands[D] = deal[D]; hands[M] = deal[M]; hands[L] = [lead, ...u.slice(0, 12)]; hands[R] = u.slice(12);
    for (const c of reps) if (makes(hands, c)) win.set(c, win.get(c) + 1);
  }
  const pct = c => Math.round(win.get(c) / SAMPLES * 100), best = Math.max(...reps.map(pct)), good = reps.filter(c => pct(c) >= Math.max(95, best - 2));
  if (!keep && best < 95) return 'no sure line';
  if (!keep && (good.includes(nat) || pct(nat) > 80 || best - pct(nat) < 20)) return 'the natural card is good enough';
  if (!keep && !good.some(c => real.get(c))) return 'the sure line fails here';
  return { L, M, D, lead, need, nat, natPct: pct(nat), good, opts: reps.map(c => [c, pct(c), !!real.get(c)]), n: SAMPLES };
}
(async () => {
  const m = await vm.runInContext('ddsFactory', ctx)(); E.ddsUse(m);
  const ddTable = deal => [0, 1, 2, 3].map(d => [0, 1, 2, 3, 4].map(st => E.ddContract(deal, { level: 1, strain: st, decl: d, dbl: 0 })));
  let D = null; const why = {};
  // a day already written keeps its deal and its kind (written again after a change in the robots, the cards stay)
  const kept = path.join(root, 'daily', today + '.json'), old = fs.existsSync(kept) ? JSON.parse(fs.readFileSync(kept, 'utf8')) : null;
  let kind = old ? old.kind || 'bid' : ['bid', 'play', 'lead'][dayNo % 3];
  if (old) { const deal = old.deal; D = { deal, auc: bidAll(deal), table: ddTable(deal) }; if (kind === 'lead') D.lp = leadProblem(deal, D.auc, true); if (kind === 'play') D.pp = playProblem(deal, D.auc, true); }
  for (let k = 0; k < 6000 && !D && kind === 'play'; k++) {
    const p = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    const deal = [0, 1, 2, 3].map(s => p.slice(s * 13, s * 13 + 13)), auc = bidAll(deal), pp = playProblem(deal, auc);
    if (typeof pp === 'string') { why[pp] = (why[pp] || 0) + 1; continue; }
    D = { deal, auc, table: ddTable(deal), pp };
  }
  for (let k = 0; k < 4000 && !D && kind === 'lead'; k++) {
    const p = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    const deal = [0, 1, 2, 3].map(s => p.slice(s * 13, s * 13 + 13)), auc = bidAll(deal), lp = leadProblem(deal, auc);
    if (typeof lp === 'string') { why[lp] = (why[lp] || 0) + 1; continue; }
    D = { deal, auc, table: ddTable(deal), lp };
  }
  if (!D) kind = 'bid';   // no lead problem good enough today: a bidding question
  for (let k = 0; k < 2000 && !D; k++) {
    const p = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    const deal = [0, 1, 2, 3].map(s => p.slice(s * 13, s * 13 + 13)), auc = bidAll(deal);
    const f0 = auc.findIndex(e => e.seat === 2); if (f0 < 0 || auc[f0].call === 'P') { why['south passes'] = (why['south passes'] || 0) + 1; continue; }
    const table = ddTable(deal), bad = check(deal, auc, table);
    if (bad) { why[bad] = (why[bad] || 0) + 1; continue; }
    D = { deal, auc, table };
  }
  if (!D) throw new Error('no deal good enough: ' + JSON.stringify(why));
  const first = D.auc.findIndex(e => e.seat === 2), con = contractOf(D.auc), tricks = con ? D.table[con.decl][con.strain] : null;
  // the robot's opening lead
  let lead = null;
  if (con && kind === 'bid') { const g = E.newPlayState(D.deal, con, D.auc, cards); lead = E.aiPlay(g, (con.decl + 1) % 4, { budget: 3000, maxSamples: 100, ddTricks: 12, lead: { budget: 6000, maxSamples: 100, minSamples: 40, evLim: 3000000, cap: 12000 } }); }
  const code = (() => { const a = new Uint8Array(13); D.deal.forEach((h, s) => h.forEach(c => { a[c >> 2] |= s << ((c & 3) * 2); })); return Buffer.from(a).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); })();
  const expl = D.auc.map(e => (e.m && e.m.t) || '');
  const data = { date: today, kind, board, dealer, deal: D.deal, auc: D.auc.map(e => [e.seat, e.call]), expl, first, con, tricks, table: D.table, lead, code };
  if (kind === 'lead' && D.lp && typeof D.lp === 'object') { Object.assign(data, { lp: D.lp }); data.lead = D.lp.sim; }
  if (kind === 'play' && D.pp && typeof D.pp === 'object') { Object.assign(data, { pp: D.pp }); data.lead = D.pp.lead; }
  fs.mkdirSync(root + 'daily', { recursive: true });
  fs.writeFileSync(root + 'daily/' + today + '.json', JSON.stringify(data));
  writeAll();
  console.log(today, 'board', board, con ? 'contract ' + con.level + 'CDHSN'[con.strain] + ' by ' + 'NESW'[con.decl] + ' dd ' + tricks : 'passed out', 'skipped', JSON.stringify(why));
})().catch(e => { console.error(e); process.exit(1); });

// ---- the pages, from the days kept in daily/*.json ----
const RANK = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], SYM = ['♣', '♦', '♥', '♠'];
const sym = s => s === 1 || s === 2 ? `<span class="r">${SYM[s]}</span>` : SYM[s];
const suitRow = (h, s) => `<div>${sym(s)} ${h.filter(c => (c / 13 | 0) === s).sort((a, b) => b - a).map(c => RANK[c % 13]).join(' ') || '—'}</div>`;
const handHtml = (h, label) => `<div class="hand"><b>${label}</b>${[3, 2, 1, 0].map(s => suitRow(h, s)).join('')}</div>`;
const callTxt = (t, c) => c === 'P' ? t.pass : c === 'X' ? 'X' : c === 'XX' ? 'XX' : E.LV(c) + (E.ST(c) === 4 ? t.nt : sym(E.ST(c)));
const conTxt = (t, c) => c.level + (c.strain === 4 ? t.nt : sym(c.strain)) + (c.dbl === 1 ? 'X' : c.dbl === 2 ? 'XX' : '') + ' ' + t.seats[c.decl];
const vulTxt = (t, b) => { const n = E.vulOf(b, 0), e = E.vulOf(b, 1); return n && e ? t.all : n ? t.seats[0] + t.seats[2] : e ? t.seats[1] + t.seats[3] : t.none; };
function aucTable(t, auc, dealer, upto) {
  const cells = []; for (let i = 0; i < dealer; i++) cells.push('');
  auc.slice(0, upto).forEach(([, c]) => cells.push(callTxt(t, c)));
  if (upto < auc.length) cells.push('<b class="q">?</b>');
  const rows = []; for (let i = 0; i < cells.length; i += 4) rows.push('<tr>' + [0, 1, 2, 3].map(k => `<td>${cells[i + k] ?? ''}</td>`).join('') + '</tr>');
  return `<table class="auc"><tr>${[...t.seats].map(x => `<th>${x}</th>`).join('')}</tr>${rows.join('')}</table>`;
}
function page(l, d, days) {
  if (d.kind === 'lead' && d.lp) return leadPage(l, d, days);
  if (d.kind === 'play' && d.pp) return playPage(l, d, days);
  const t = T[l], date = new Date(d.date + 'T12:00:00Z').toLocaleDateString(l === 'no' ? 'nb-NO' : l, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const title = `${t.h}: ${date}`, desc = f(t.d, date), url = `${SITE}${l}/daily/${d.date}.html`;
  const res = d.con && d.tricks != null ? (() => { const need = d.con.level + 6, k = d.tricks - need; return f(t.ddr, d.tricks, k === 0 ? t.made : k > 0 ? f(t.over, k) : f(t.down, -k)); })() : '';
  const tbl = `<table class="dd"><tr><th></th>${[4, 3, 2, 1, 0].map(s => `<th>${s === 4 ? t.nt : sym(s)}</th>`).join('')}</tr>${[0, 2, 1, 3].map(p => `<tr><th>${t.seats[p]}</th>${[4, 3, 2, 1, 0].map(s => { const n = d.table[p][s]; return `<td${n >= 7 ? ' class="ok"' : ''}>${n >= 7 ? n - 6 : '–'}</td>`; }).join('')}</tr>`).join('')}</table>`;
  const i = days.indexOf(d.date), list = days.slice().reverse().filter(x => x !== d.date).slice(0, 14);
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc, inLanguage: hl(l), datePublished: d.date, dateModified: d.date, image: SITE + 'icons/og-' + l + '.png', author: { '@type': 'Organization', name: 'Bridge Table', url: SITE }, publisher: { '@type': 'Organization', name: 'Bridge Table', logo: { '@type': 'ImageObject', url: SITE + 'icons/icon-512.png' } }, mainEntityOfPage: url };
  return `<!doctype html>
<html lang="${hl(l)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(t.home)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${LANGS.map(k => `<link rel="alternate" hreflang="${hl(k)}" href="${SITE}${k}/daily/${d.date}.html">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${SITE}en/daily/${d.date}.html">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Bridge Table">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}icons/og-${l}.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0c1a14">
<link rel="icon" href="../../icons/icon-192.png">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
  :root{--ink:#1d241f;--muted:#5d6a60;--felt:#1f7a2e;--line:#dcdccf;--soft:#f3f6f1;--gold:#f2c230}
  *{box-sizing:border-box}
  body{margin:0;background:#fff;color:var(--ink);font:17px/1.55 "Segoe UI",Roboto,Arial,sans-serif}
  header{background:#0c1a14;padding:10px 16px}header a{color:var(--gold);text-decoration:none;font-weight:700}
  main{max-width:720px;margin:0 auto;padding:18px 16px 48px}
  h1{font-size:28px;margin:4px 0 4px;line-height:1.2}p.lead{color:var(--muted);margin:0 0 12px}
  h2{font-size:20px;margin:26px 0 8px;padding-top:10px;border-top:2px solid var(--felt)}
  .meta{display:flex;flex-wrap:wrap;gap:6px 16px;color:var(--muted);font-size:15px;margin-bottom:8px}.meta b{color:var(--ink)}
  .r{color:#c4122f}
  .hand{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:18px;line-height:1.5;min-width:150px}
  .hand b{display:block;font-size:14px;color:var(--muted)}
  .solo{display:inline-block}
  .compass{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:center;max-width:560px}
  .compass .n{grid-column:2}.compass .w{grid-column:1;grid-row:2}.compass .e{grid-column:3;grid-row:2}.compass .s{grid-column:2;grid-row:3}
  .compass .mid{grid-column:2;grid-row:2;text-align:center;color:var(--felt);font-weight:700}
  @media (max-width:520px){.compass{grid-template-columns:1fr 1fr}.compass .n{grid-column:1/3;justify-self:center}.compass .w{grid-column:1;grid-row:2}.compass .e{grid-column:2;grid-row:2}.compass .s{grid-column:1/3;grid-row:3;justify-self:center}.compass .mid{display:none}.hand{font-size:16px;min-width:0}}
  table.auc,table.dd{border-collapse:collapse;margin:6px 0;font-size:17px}
  table.auc th,table.auc td{width:64px;text-align:center;padding:4px;border-bottom:1px solid var(--line)}
  table.dd th,table.dd td{width:46px;text-align:center;padding:4px;border:1px solid var(--line)}table.dd td.ok{background:#e6f4e8;font-weight:700}
  .q{color:var(--felt);font-size:20px}
  .ask{font-size:20px;font-weight:700;color:var(--felt);margin:16px 0 6px}
  details{background:#fffdf3;border:1px solid #eadfae;border-radius:10px;padding:10px 14px;margin:14px 0}
  summary{cursor:pointer;font-weight:700;color:#8a6d00}
  .big{font-size:24px;font-weight:700}.ex{color:var(--muted);margin-left:6px}
  .cta{text-align:center;margin:26px 0}.cta a{display:inline-block;background:var(--gold);color:#1d1a0c;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:18px}
  ul.days{columns:2;padding-left:18px}ul.days a,.langs a,.nav a{color:var(--felt)}
  .nav{display:flex;justify-content:space-between;margin:16px 0}
  .langs{font-size:14px;color:var(--muted);margin-top:26px;border-top:1px solid var(--line);padding-top:12px;display:flex;flex-wrap:wrap;gap:6px 14px}
</style>
</head>
<body>
<header><a href="../">♠<span style="color:#ff6b6b">♥♦</span>♣ ${esc(t.home)}</a></header>
<main>
<h1>${esc(t.h)}</h1>
<p class="lead">${esc(date)}</p>
<div class="meta"><span>${f(t.board, d.board)}</span><span>${t.dealer}: <b>${t.seats[d.dealer]}</b></span><span>${t.vul}: <b>${vulTxt(t, d.board)}</b></span></div>
${handHtml(d.deal[2], t.you).replace('class="hand"', 'class="hand solo"')}
<h2>${t.sofar}</h2>
${aucTable(t, d.auc, d.dealer, d.first)}
<p class="ask">${t.q}</p>
<details><summary>${t.show}</summary>
<p>${t.robot}: <span class="big">${callTxt(t, d.auc[d.first][1])}</span>${d.expl && d.expl[d.first] ? ` <span class="ex">${esc(bidTxt(d.expl[d.first], l)).replace(/[♥♦]/g, m => `<span class="r">${m}</span>`)}</span>` : ''}</p>
<h2>${t.full}</h2>
<div class="compass">${handHtml(d.deal[0], t.seats[0]).replace('class="hand"', 'class="hand n"')}${handHtml(d.deal[3], t.seats[3]).replace('class="hand"', 'class="hand w"')}<div class="mid">${f(t.board, d.board)}</div>${handHtml(d.deal[1], t.seats[1]).replace('class="hand"', 'class="hand e"')}${handHtml(d.deal[2], t.seats[2]).replace('class="hand"', 'class="hand s"')}</div>
<h2>${t.auction}</h2>
${aucTable(t, d.auc, d.dealer, d.auc.length)}
<p>${t.contract}: <b>${d.con ? conTxt(t, d.con) : t.passed}</b>${d.lead != null ? ` · ${t.lead}: <b>${sym(d.lead / 13 | 0)}${RANK[d.lead % 13]}</b>` : ''}</p>
<p>${res}</p>
<h2>${t.table}</h2>
${tbl}
</details>
<div class="cta"><a href="../../?lang=${l}#d=${d.code}&b=${d.board}">${t.play}</a></div>
<div class="nav">${i > 0 ? `<a href="${days[i - 1]}.html">← ${days[i - 1]}</a>` : '<span></span>'}${i < days.length - 1 ? `<a href="${days[i + 1]}.html">${days[i + 1]} →</a>` : ''}</div>
${list.length ? `<h2>${t.prev}</h2><ul class="days">${list.map(x => `<li><a href="${x}.html">${x}</a></li>`).join('')}</ul>` : ''}
<p><a href="../learn/how-to-play.html" style="color:var(--felt)">${t.learn}</a></p>
<nav class="langs">${LANGS.filter(k => k !== l).map(k => `<a href="../../${k}/daily/${d.date}.html" hreflang="${hl(k)}">${NAMES[k]}</a>`).join('')}</nav>
</main>
</body>
</html>
`;
}
// the page of a lead problem: the auction to the contract, the leader's hand, the question; the answer below it
function leadPage(l, d, days) {
  const t = T[l], p = d.lp, me = t.sn[p.L], date = new Date(d.date + 'T12:00:00Z').toLocaleDateString(l === 'no' ? 'nb-NO' : l, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const card = c => sym(c / 13 | 0) + RANK[c % 13];
  const suits = p.beat.map(s => sym(s)).join(' / ');
  const rows = [3, 2, 1, 0].filter(s => p.dd[s] != null).map(s => `<tr${p.beat.includes(s) ? ' class="okr"' : ''}><td>${sym(s)}</td><td>${p.dd[s]}</td></tr>`).join('');
  let html = page(l, { ...d, kind: 'bid', lp: null, first: 0, expl: null }, days);
  const body = `<h1>${esc(t.h)}</h1>
<p class="lead">${esc(date)} · <b>${esc(t.tl)}</b></p>
<div class="meta"><span>${f(t.board, d.board)}</span><span>${t.dealer}: <b>${t.seats[d.dealer]}</b></span><span>${t.vul}: <b>${vulTxt(t, d.board)}</b></span></div>
<h2>${t.auction}</h2>
${aucTable(t, d.auc, d.dealer, d.auc.length)}
<p>${t.contract}: <b>${conTxt(t, d.con)}</b></p>
${handHtml(d.deal[p.L], f(t.ya, me)).replace('class="hand"', 'class="hand solo"')}
<p class="ask">${f(t.ql, me)}</p>
<details><summary>${t.show}</summary>
<p class="big">${f(t.al, suits, p.need)}</p>
<table class="dd"><tr><th>${t.cs}</th><th>${t.dt}</th></tr>${rows}</table>
<p>${f(t.sb, p.n, sym(p.sim / 13 | 0))}</p>
<p>${f(t.rl, card(p.rule))}</p>
<h2>${t.full}</h2>
<div class="compass">${handHtml(d.deal[0], t.seats[0]).replace('class="hand"', 'class="hand n"')}${handHtml(d.deal[3], t.seats[3]).replace('class="hand"', 'class="hand w"')}<div class="mid">${f(t.board, d.board)}</div>${handHtml(d.deal[1], t.seats[1]).replace('class="hand"', 'class="hand e"')}${handHtml(d.deal[2], t.seats[2]).replace('class="hand"', 'class="hand s"')}</div>
</details>`;
  // the bidding page's frame (head, links, list of days) with this problem in place of the question
  html = html.replace(/<h1>[\s\S]*?<\/details>/, () => body);
  const title = `${t.h}: ${date} · ${t.tl}`, desc = f(t.dl, date);
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)} · ${esc(t.home)}</title>`).replace(/(<meta name="description" content=")[^"]*/, (m, a) => a + esc(desc))
    .replace(/<script type="application\/ld\+json">[^<]*<\/script>/, m => m.replace(/"headline":"[^"]*"/, () => '"headline":' + JSON.stringify(title)).replace(/"description":"[^"]*"/, () => '"description":' + JSON.stringify(desc)))
    .replace(/(<meta property="og:title" content=")[^"]*/, (m, a) => a + esc(title)).replace(/(<meta property="og:description" content=")[^"]*/, (m, a) => a + esc(desc))
    .replace('table.dd td.ok{', 'table.dd tr.okr td{background:#e6f4e8;font-weight:700}table.dd td.ok{');
  return html;
}
// the page of a declarer play problem: the auction, dummy above your hand, the lead; which card from dummy
function playPage(l, d, days) {
  const t = T[l], p = d.pp, date = new Date(d.date + 'T12:00:00Z').toLocaleDateString(l === 'no' ? 'nb-NO' : l, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const card = c => sym(c / 13 | 0) + RANK[c % 13];
  const rows = p.opts.slice().sort((a, b) => b[1] - a[1]).map(([c, q, ok]) => `<tr${p.good.includes(c) ? ' class="okr"' : ''}><td>${card(c)}</td><td>${l === 'tr' ? '%' + q : q + '%'}</td><td>${ok ? '✓' : '✗'}</td></tr>`).join('');
  const pick = p.good.slice().sort((a, b) => b - a)[0], realOk = (p.opts.find(o => o[0] === pick) || [])[2];
  let html = page(l, { ...d, kind: 'bid', pp: null, first: 0, expl: null }, days);
  const body = `<h1>${esc(t.h)}</h1>
<p class="lead">${esc(date)} · <b>${esc(t.tp)}</b></p>
<div class="meta"><span>${f(t.board, d.board)}</span><span>${t.dealer}: <b>${t.seats[d.dealer]}</b></span><span>${t.vul}: <b>${vulTxt(t, d.board)}</b></span></div>
<h2>${t.auction}</h2>
${aucTable(t, d.auc, d.dealer, d.auc.length)}
<p>${t.contract}: <b>${conTxt(t, d.con)}</b></p>
<div class="pair">${handHtml(d.deal[p.M], f(t.dmy, t.sn[p.M]))}${handHtml(d.deal[p.D], f(t.dcl, t.sn[p.D]))}</div>
<p class="ask">${f(t.qp, t.sn[p.L], card(p.lead))}</p>
<details><summary>${t.show}</summary>
<p class="big">${f(t.ap, p.good.slice().sort((a, b) => b - a).map(card).join(' / '), Math.max(...p.good.map(c => (p.opts.find(o => o[0] === c) || [])[1])))}</p>
<p>${f(t.np, card(p.nat), p.natPct)}</p>
<table class="dd"><tr><th>${t.ct}</th><th>${t.cp}</th><th>${t.cd}</th></tr>${rows}</table>
<p class="ex">${f(t.tn, p.n)} ${f(t.act, realOk ? t.yes : t.no)}</p>
<h2>${t.full}</h2>
<div class="compass">${handHtml(d.deal[0], t.seats[0]).replace('class="hand"', 'class="hand n"')}${handHtml(d.deal[3], t.seats[3]).replace('class="hand"', 'class="hand w"')}<div class="mid">${f(t.board, d.board)}</div>${handHtml(d.deal[1], t.seats[1]).replace('class="hand"', 'class="hand e"')}${handHtml(d.deal[2], t.seats[2]).replace('class="hand"', 'class="hand s"')}</div>
</details>`;
  html = html.replace(/<h1>[\s\S]*?<\/details>/, () => body);
  const title = `${t.h}: ${date} · ${t.tp}`, desc = f(t.dp, date);
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)} · ${esc(t.home)}</title>`).replace(/(<meta name="description" content=")[^"]*/, (m, a) => a + esc(desc))
    .replace(/<script type="application\/ld\+json">[^<]*<\/script>/, m => m.replace(/"headline":"[^"]*"/, () => '"headline":' + JSON.stringify(title)).replace(/"description":"[^"]*"/, () => '"description":' + JSON.stringify(desc)))
    .replace(/(<meta property="og:title" content=")[^"]*/, (m, a) => a + esc(title)).replace(/(<meta property="og:description" content=")[^"]*/, (m, a) => a + esc(desc))
    .replace('table.dd td.ok{', 'table.dd tr.okr td{background:#e6f4e8;font-weight:700}.pair{display:flex;flex-direction:column;gap:8px;max-width:260px}table.dd td.ok{');
  return html;
}
function writeAll() {
  let days = fs.readdirSync(root + 'daily').filter(x => /^\d{4}-\d{2}-\d{2}\.json$/.test(x)).map(x => x.slice(0, 10)).sort();
  // only the last KEEP days stay; older days' data and pages are removed
  for (const x of days.slice(0, Math.max(0, days.length - KEEP))) { fs.rmSync(root + 'daily/' + x + '.json'); for (const l of LANGS) fs.rmSync(root + l + '/daily/' + x + '.html', { force: true }); }
  days = days.slice(-KEEP);
  for (const l of LANGS) {
    fs.mkdirSync(root + l + '/daily', { recursive: true });
    for (const x of days) {
      const d = JSON.parse(fs.readFileSync(root + 'daily/' + x + '.json', 'utf8'));
      fs.writeFileSync(root + l + '/daily/' + x + '.html', page(l, d, days));
    }
    // the newest day at /daily/ too (its address does not change, so it can be linked)
    const newest = days[days.length - 1];
    fs.writeFileSync(root + l + '/daily/index.html', fs.readFileSync(root + l + '/daily/' + newest + '.html', 'utf8'));
    // the language page: a link to the hand of the day
    const lp = root + l + '/index.html', t = T[l];
    if (fs.existsSync(lp)) {
      let s = fs.readFileSync(lp, 'utf8');
      const block = `<!--daily--><p class="more"><a href="daily/">🃏 ${esc(t.h)}</a></p><!--/daily-->`;
      s = s.includes('<!--daily-->') ? s.replace(/<!--daily-->[\s\S]*?<!--\/daily-->/, block) : s.replace('<p class="more">', block + '\n<p class="more">');
      fs.writeFileSync(lp, s);
    }
  }
  // the sitemap: the days kept and each language's /daily/
  let sm = fs.readFileSync(root + 'sitemap.xml', 'utf8').replace(/\s*<url><loc>[^<]*\/daily\/[^<]*<\/loc>.*?<\/url>/g, '');
  const add = LANGS.map(l => `  <url><loc>${SITE}${l}/daily/</loc><lastmod>${days[days.length - 1]}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`)
    .concat(days.flatMap(x => LANGS.map(l => `  <url><loc>${SITE}${l}/daily/${x}.html</loc><lastmod>${x}</lastmod><changefreq>yearly</changefreq><priority>0.5</priority></url>`)));
  fs.writeFileSync(root + 'sitemap.xml', sm.replace('</urlset>', add.join('\n') + '\n</urlset>'));
}
