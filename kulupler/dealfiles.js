// ══════════════════════════════════════════════════════
//  HAND RECORD FILES — from dealing machines and bridge programs
// ══════════════════════════════════════════════════════
// Reads PBN, LIN (BBO), DLM (Dealer4 / Dealmaster), DUP (Duplimate), BRI and DGE files and gives every board
// as { board, deal: 'N:spades.hearts.diamonds.clubs …', vulnerable, dealer }. A deal is kept only when the four
// hands hold 13 cards each and all 52 cards once, so a damaged file never shows wrong hands.
// (File layouts as read by the open-source deal-convert by Michał Klichowicz.)
const DF_RANKS='AKQJT98765432';          // the order used inside these files
const DF_SEATS='NESW';
const DF_VUL16=['None','NS','EW','Both','NS','EW','Both','None','Both','EW','NS','None','Both','NS','EW','None'];
const dfDealer=b=>DF_SEATS[(b-1)%4];
const dfVul=b=>DF_VUL16[(b-1)%16];

// hands[seat][suit 0=♠ 1=♥ 2=♦ 3=♣] = 'AKQ…' → PBN deal string (or null when the cards are not a full deal)
function dfDeal(hands){
  const seen=new Set();
  for(const h of hands){
    if(h.some(s=>[...s].some(r=>!DF_RANKS.includes(r))))return null;
    if(h.reduce((a,s)=>a+s.length,0)!==13)return null;
    h.forEach((s,suit)=>{for(const r of s)seen.add(suit*13+DF_RANKS.indexOf(r));});
  }
  if(seen.size!==52||seen.has(-1))return null;
  const sorted=s=>[...s].sort((a,b)=>DF_RANKS.indexOf(a)-DF_RANKS.indexOf(b)).join('');
  return 'N:'+hands.map(h=>h.map(sorted).join('.')).join(' ');
}
const dfEmpty=()=>[0,1,2,3].map(()=>[[],[],[],[]].map(()=>''));
function dfFillWest(h){
  for(let suit=0;suit<4;suit++){let left='';for(const r of DF_RANKS)if(![0,1,2].some(s=>h[s][suit].includes(r)))left+=r;h[3][suit]=left;}
  return h;
}
function dfBoard(list,board,hands,extra){
  const deal=dfDeal(hands);
  if(!deal){list.bad=(list.bad||0)+1;return;}
  const v=String((extra&&extra.vulnerable)||'').toLowerCase(), dl=String((extra&&extra.dealer)||'').toUpperCase();
  const vul=v==='ns'?'NS':v==='ew'?'EW':v==='all'||v==='both'?'Both':v==='none'||v==='love'||v==='-'?'None':dfVul(+board||1);
  list.push({board:String(board).replace(/[^0-9A-Za-z]/g,'').slice(0,6),deal,vulnerable:vul,dealer:DF_SEATS.includes(dl)&&dl.length===1?dl:dfDealer(+board||1)});
}

// ── PBN ──
function dfPBN(text){
  const out=[];
  for(const bl of text.split(/(?=\[Board\s)/i)){
    const tag=k=>{const m=bl.match(new RegExp('\\['+k+'\\s+"([^"]*)"\\]','i'));return m?m[1]:null;};
    const b=tag('Board'),d=tag('Deal');if(!b||!d)continue;
    const n=parseInt(b,10);
    const hands=dfFromPBNDeal(d);if(!hands){out.bad=(out.bad||0)+1;continue;}
    dfBoard(out,isNaN(n)?b:n,hands,{vulnerable:tag('Vulnerable'),dealer:tag('Dealer')});
  }
  return out;
}
function dfFromPBNDeal(d){
  const m=String(d).trim().match(/^([NESW])\s*:\s*(.*)$/i);if(!m)return null;
  const first=DF_SEATS.indexOf(m[1].toUpperCase()),parts=m[2].trim().split(/\s+/),h=dfEmpty();let missing=-1;
  for(let i=0;i<4;i++){
    const seat=(first+i)%4,p=parts[i];
    if(p==null||p==='-'){missing=seat;continue;}
    const sp=p.toUpperCase().replace(/10/g,'T').split('.');if(sp.length!==4)return null;
    h[seat]=sp;
  }
  if(missing>=0){   // one hand left out: it holds the cards nobody else has
    for(let suit=0;suit<4;suit++){let left='';for(const r of DF_RANKS)if(![0,1,2,3].some(s=>s!==missing&&h[s][suit].includes(r)))left+=r;h[missing][suit]=left;}
  }
  return h;
}

// ── LIN (BBO): md|<dealer 1=S 2=W 3=N 4=E><South>,<West>,<North>,<East>| ──
function dfLIN(text){
  const out=[];let idx=0;
  for(const m of text.matchAll(/md\|(\d)([^|]*)\|([\s\S]*?)(?=md\||$)/g)){
    idx++;
    const parts=m[2].split(','),order=[2,3,0,1],h=dfEmpty();let missing=-1;
    for(let i=0;i<4;i++){
      const seat=order[i],p=(parts[i]||'').toUpperCase();
      if(!p){missing=seat;continue;}
      let suit=-1;
      for(const ch of p){const k='SHDC'.indexOf(ch);if(k>=0){suit=k;continue;}if(suit>=0&&DF_RANKS.includes(ch))h[seat][suit]+=ch;}
    }
    if(missing>=0){for(let suit=0;suit<4;suit++){let left='';for(const r of DF_RANKS)if(![0,1,2,3].some(s=>s!==missing&&h[s][suit].includes(r)))left+=r;h[missing][suit]=left;}}
    const rest=m[3];
    const bm=rest.match(/ah\|Board\s*(\d+)/i)||rest.match(/qx\|[oc](\d+)/i);
    const board=bm?+bm[1]:idx;
    const sv=(rest.match(/sv\|(\w)/)||[])[1];
    dfBoard(out,board,h,{vulnerable:sv?({o:'None',n:'NS',e:'EW',b:'Both'})[sv.toLowerCase()]:null,dealer:'SWNE'[(+m[1]-1)%4]});
  }
  return out;
}

// ── DLM (Dealer4 / Dealmaster): "Board 01=" + 26 letters + checksum; each letter holds the owners of two cards ──
function dfDLM(text){
  const out=[],f={};
  for(const ln of text.split(/\r?\n/)){const i=ln.indexOf('=');if(i>0)f[ln.slice(0,i).trim()]=ln.slice(i+1).trim();}
  const from=parseInt(f['From board'],10),to=parseInt(f['To board'],10);
  if(isNaN(from)||isNaN(to))return out;
  // a locked file (crypto key set): its letters are scrambled, so it is refused instead of read wrongly
  if(f['Crypto key']&&f['Crypto key']!=='0'){out.crypt=true;return out;}
  for(let b=from;b<=to;b++){
    const s=f['Board '+String(b).padStart(2,'0')]||f['Board '+b];
    if(!s||s.length<26){out.bad=(out.bad||0)+1;continue;}
    const owners=[];let sum=b;
    for(const ch of s.slice(0,26)){const v=ch.charCodeAt(0)-97;sum^=ch.charCodeAt(0);owners.push(v>>2,v&3);}
    if(owners.some(o=>o<0||o>3)){out.bad=(out.bad||0)+1;continue;}
    if(s.length>26&&parseInt(s.slice(26),10)!==sum){out.bad=(out.bad||0)+1;continue;}   // a board that does not add up
    const h=dfEmpty();
    for(let suit=0;suit<4;suit++)for(let r=0;r<13;r++)h[owners[suit*13+r]][suit]+=DF_RANKS[r];
    dfBoard(out,b,h);
  }
  return out;
}

// ── BRI: 128 characters per board; 39 two-digit card numbers (1–52) for North, East and South, West has the rest ──
function dfBRIHands(s){
  const h=dfEmpty();
  for(let i=0;i<39;i++){
    const n=parseInt(s.slice(i*2,i*2+2),10);if(isNaN(n)||n<1||n>52)return null;
    const c=n-1;h[(i/13)|0][(c/13)|0]+=DF_RANKS[c%13];
  }
  return dfFillWest(h);
}
function dfBRI(bin){
  const out=[];
  for(let i=0,b=1;i+78<=bin.length;i+=128,b++){
    const rec=bin.slice(i,i+128);if(!rec.trim())break;
    const h=dfBRIHands(rec);if(!h){out.bad=(out.bad||0)+1;continue;}
    dfBoard(out,b,h);
  }
  return out;
}
// ── DGE: 128 characters per board; for each hand four suits, each started by a mark (\x06 ♠ \x03 ♥ \x04 ♦ \x05 ♣) ──
function dfDGEHands(s){
  const marks={'\x06':0,'\x03':1,'\x04':2,'\x05':3},h=dfEmpty();let hand=-1,n=0,suit=-1;
  for(const ch of s.slice(0,68)){
    if(ch in marks){if(n%4===0)hand++;n++;suit=marks[ch];if(hand>3)return null;continue;}
    if(suit<0||!DF_RANKS.includes(ch))continue;
    h[hand][suit]+=ch;
  }
  return h;
}
function dfDGE(bin){
  const out=[];
  for(let i=0,b=1;i+68<=bin.length;i+=128,b++){
    const rec=bin.slice(i,i+128);if(!rec.replace(/\x00/g,'').trim())break;
    const h=dfDGEHands(rec);if(!h){out.bad=(out.bad||0)+1;continue;}
    dfBoard(out,b,h);
  }
  return out;
}
// ── DUP (Duplimate): 156 characters per board = BRI part (78) + DGE part (68) + 10; the first board's last 10 hold
//    the first board number and the number of boards ──
function dfDUP(bin){
  const out=[];
  if(bin.length<156)return out;
  const head=bin.slice(146,156);
  let start=parseInt(head.slice(2,4),10),count=parseInt(head.slice(7,9),10);
  if(isNaN(start))start=1;
  const recs=Math.floor(bin.length/156);if(isNaN(count)||count>recs)count=recs;
  for(let i=0;i<count;i++){
    const rec=bin.slice(i*156,i*156+156);
    const h=dfBRIHands(rec.slice(0,78))||dfDGEHands(rec.slice(78,146));
    if(!h){out.bad=(out.bad||0)+1;continue;}
    dfBoard(out,start+i,h);
  }
  return out;
}

/* a file chosen by the director: name + bytes → { hands, format, bad } */
function readDealFile(name,bytes){
  const ext=String(name||'').toLowerCase().split('.').pop();
  const latin=Array.from(bytes,b=>String.fromCharCode(b)).join('');
  let text=latin; try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(e){}
  let hands=[],format='';
  if(ext==='dlm'||/^\s*\[Document\]/i.test(text)){hands=dfDLM(text);format='DLM';}
  else if(ext==='dup'){hands=dfDUP(latin);format='DUP';}
  else if(ext==='bri'){hands=dfBRI(latin);format='BRI';}
  else if(ext==='dge'){hands=dfDGE(latin);format='DGE';}
  else if(/\[Board\s/i.test(text)){hands=dfPBN(text);format='PBN';}
  else if(/md\|/.test(text)){hands=dfLIN(text);format='LIN';}
  return {hands,format,bad:hands.bad||0,crypt:!!hands.crypt};
}
window.readDealFile=readDealFile;
