// ══════════════════════════════════════════════════════
//  CARDS BY CAMERA — no dealing machine needed
// ══════════════════════════════════════════════════════
// 1. Deal with the camera (the director, after loading a hand file): each card shown to the camera is read (Bridge
//    Table's js/photo.js, on the device) and the screen says, in big letters and aloud, which hand it goes to.
// 2. After each board the table sees the double-dummy table of that board (when its hands are known).
// Cards are numbered 0-51: suit * 13 + rank, suit 0 = ♣ 1 = ♦ 2 = ♥ 3 = ♠, rank 0 = 2 … 12 = A.
(function(){
'use strict';
const RK='23456789TJQKA', SYM=['♣','♦','♥','♠'];
const cName=c=>(RK[c%13]==='T'?'10':RK[c%13])+SYM[(c/13)|0];
const red=c=>((c/13)|0)===1||((c/13)|0)===2;
const SEAT_W={en:['North','East','South','West'],tr:['Kuzey','Doğu','Güney','Batı'],no:['Nord','Øst','Syd','Vest'],es:['Norte','Este','Sur','Oeste'],fr:['Nord','Est','Sud','Ouest'],it:['Nord','Est','Sud','Ovest'],de:['Nord','Ost','Süd','West'],ru:['Север','Восток','Юг','Запад'],pl:['Północ','Wschód','Południe','Zachód'],zh:['北','东','南','西']};
const lang=()=>{try{return localStorage.getItem('bricskor_language')||'en';}catch(e){return 'en';}};
const seatWord=s=>(SEAT_W[lang()]||SEAT_W.en)[s];
const SEAT_COL=['#2e7d32','#1565c0','#c62828','#6a1b9a'];
const esc=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));

// a PBN deal 'N:♠.♥.♦.♣ …' → four hands of card numbers, North first
function dealCards(deal){
  const m=String(deal||'').trim().match(/^([NESW]):(.*)$/i); if(!m) return null;
  const first='NESW'.indexOf(m[1].toUpperCase()), parts=m[2].trim().split(/\s+/); if(parts.length!==4) return null;
  const hands=[[],[],[],[]];
  parts.forEach((p,i)=>{ p.split('.').forEach((rs,k)=>{ for(const ch of rs.toUpperCase()){ const r=RK.indexOf(ch==='1'?'T':ch); if(r>=0) hands[(first+i)%4].push((3-k)*13+r); } }); });
  return hands;
}
function cardsDeal(hands){
  return 'N:'+hands.map(h=>[3,2,1,0].map(s=>h.filter(c=>((c/13)|0)===s).map(c=>c%13).sort((a,b)=>b-a).map(r=>RK[r]).join('')).join('.')).join(' ');
}
// the tournament's hands, whatever shape the database gave them
function handsList(){ const v=_cache['hands']; return (Array.isArray(v)?v:Object.values(v||{})).filter(Boolean); }
function handOf(board){ return handsList().find(h=>String(h.board)===String(board))||null; }
function ddOf(board){ return (_cache['dd']||{})[String(board)]||null; }
window.ccHandsList=handsList;

// ---- the full-screen layer ----
function layer(html){
  let el=document.getElementById('ccLayer');
  if(!el){ el=document.createElement('div'); el.id='ccLayer'; document.body.appendChild(el); }
  el.style.background=''; el.innerHTML=html; el.hidden=false; return el;
}
function closeLayer(){
  const el=document.getElementById('ccLayer'); if(el){ el.hidden=true; el.innerHTML=''; }
}
window.ccClose=closeLayer;
function say(text){
  try{ if(!window.speechSynthesis) return; speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); const l=lang(); u.lang={tr:'tr-TR',no:'nb-NO',es:'es-ES',fr:'fr-FR',it:'it-IT',de:'de-DE',ru:'ru-RU',pl:'pl-PL',zh:'zh-CN'}[l]||'en-GB'; u.rate=1.1; speechSynthesis.speak(u); }catch(e){}
}
// the 52 cards as buttons: on = in this hand, off = elsewhere (can't be tapped)
function gridHtml(on,off,act){
  return `<div class="cc-grid">${[3,2,1,0].map(s=>`<div class="cc-row"><span class="cc-sym${s===1||s===2?' cc-red':''}">${SYM[s]}</span>${[12,11,10,9,8,7,6,5,4,3,2,1,0].map(r=>{const c=s*13+r;return `<button class="cc-c${on.has(c)?' on':''}" ${off.has(c)?'disabled':''} onclick="${act}(${c})">${RK[r]==='T'?'10':RK[r]}</button>`;}).join('')}</div>`).join('')}</div>`;
}

// (dealing with the camera was removed on 2026-11-25: the hand file is enough)

// ══════ 3. Double dummy after a board ══════
function ccAnalyse(board,h,done){
  if(ddOf(board)){ done&&done(); return; }
  let w; try{ w=new Worker('dd.js'); }catch(e){ done&&done(); return; }
  w.onmessage=async m=>{
    const d=m.data||{};
    if(d.res){ _cache['dd']={...(_cache['dd']||{}),[String(board)]:d.res}; try{ const url=await fbUrl('/dd/'+String(board).replace(/[^0-9A-Za-z]/g,'')+'.json'); fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d.res)}).catch(()=>{}); }catch(e){} }
    if(d.done){ w.terminate(); done&&done(); }
  };
  w.onerror=()=>{ w.terminate(); done&&done(); };
  w.postMessage({boards:[{board:h.board,deal:h.deal,vulnerable:h.vulnerable}]});
}
window.ccShowDD=function(board){
  const h=handOf(board); if(!h) return;
  const a=ddOf(board);
  if(!a){ layer(`<div class="cc-wrap"><div class="cc-top"><button class="btn btn-ghost btn-sm" onclick="ccClose()">✕</button><b class="cc-title">Board <span>${esc(board)}</span></b><span></span></div><div class="cc-hint">⏳ <span>Double dummy…</span></div></div>`); ccAnalyse(board,h,()=>{ if(ddOf(board)) ccShowDD(board); }); return; }
  layer(`<div class="cc-wrap"><div class="cc-top"><button class="btn btn-ghost btn-sm" onclick="ccClose()">✕</button><b class="cc-title">Board <span>${esc(board)}</span></b><span></span></div>
    ${ddBoardHtml(h,a,board)}
    <button class="btn btn-gold btn-full" onclick="ccClose()">OK</button></div>`);
};
// what this table played on the board: the contract and result, the score, the opening lead, against double dummy
let ccTableNo=null;
function playedHtml(board,a){
  try{
    const t=(typeof bmTableNo!=='undefined'&&bmTableNo)||ccTableNo; if(!t) return '';
    const bs=getBoards(), s=getState(), d=bs[t+'_'+s.currentRound+'_'+board]||Object.entries(bs).filter(([k,v])=>k.startsWith(t+'_')&&k.endsWith('_'+board)&&v&&v.status==='done').map(x=>x[1])[0];
    if(!d||d.status!=='done') return '';
    const ns=typeof d.nsScore==='number'?(d.nsScore>0?'+':'')+d.nsScore:'0', ld=String(d.lead||'');
    const lead=ld?`<b class="${/[♥♦]/.test(ld)?'cc-red':''}">${esc(ld)}</b>`:'—';
    const cmp=typeof ddCompare==='function'?ddCompare(d,a):'';
    return `<div class="ccd-play"><div><span>This table</span>: <b>${esc(d.contract||'PASS')}</b> · NS <b>${ns}</b></div><div><span>Lead</span>: ${lead}${cmp?' · '+cmp:''}</div></div>`;
  }catch(e){ return ''; }
}
// a board as it lay on the table: the four hands (white cards, red ♥ ♦) round a compass with the dealer and the
// vulnerability, the par, and for each seat and strain the level it makes (games and slams marked)
function ddBoardHtml(h,a,board){
  const hands=dealCards(h.deal)||[[],[],[],[]], v=String(h.vulnerable||'').toLowerCase(), dealer='NESW'.indexOf(String(h.dealer||'').toUpperCase()[0]);
  const vul=s=>v==='all'||v==='both'||(v==='ns'&&s%2===0)||(v==='ew'&&s%2===1);
  const hand=s=>`<div class="ccd-h ccd-h${s}"><div class="ccd-who" style="background:${vul(s)?'#c62828':'#2e7d32'}">${seatWord(s)}${s===dealer?' · D':''}</div>${[3,2,1,0].map(su=>{ const rs=hands[s].filter(c=>((c/13)|0)===su).sort((x,y)=>y-x).map(c=>RK[c%13]==='T'?'10':RK[c%13]); return `<div class="ccd-l"><span class="ccd-sym${su===1||su===2?' cc-red':''}">${SYM[su]}</span><span class="ccd-r">${rs.length?rs.join(' '):'—'}</span></div>`; }).join('')}</div>`;
  const mid=`<div class="ccd-mid"><div class="ccd-comp">${['N','E','S','W'].map((L,s)=>`<span class="ccd-c${s}${vul(s)?' vul':''}${s===dealer?' dl':''}">${L}</span>`).join('')}<b>${esc(board)}</b></div></div>`;
  const game=(n,st)=>n-6>=(st===4?3:st>=2?4:5), slam=n=>n>=12;
  const row=d=>`<tr><th style="color:${SEAT_COL[d]}">${seatWord(d)}</th>${[4,3,2,1,0].map(st=>{ const n=a.t&&a.t[d]?a.t[d][st]:null; return `<td class="${n>=7?(slam(n)?'sl':game(n,st)?'gm':'ok'):''}">${n>=7?n-6:'–'}</td>`; }).join('')}</tr>`;
  // what this table played first, then the hands; the par just above the double-dummy table
  return `<div class="ccd">${playedHtml(board,a)}<div class="ccd-tbl">${hand(0)}${hand(3)}${mid}${hand(1)}${hand(2)}</div>
    <div class="ccd-par">Par <b>${esc(a.par&&a.par.text||'')}</b></div>
    <table class="ccd-dd"><thead><tr><th></th>${['NT','♠','♥','♦','♣'].map((x,i)=>`<th class="${i===2||i===3?'cc-red':''}">${x}</th>`).join('')}</tr></thead><tbody>${[0,2,1,3].map(row).join('')}</tbody></table>
    <div class="ccd-key"><span class="gm">■</span> <span>Game</span> <span class="sl">■</span> <span>Slam</span> · <span>– = not even 1</span></div></div>`;
}

// the table's screen: for each board played in this round, its double dummy or a button to record its hands; the
// board just finished opens its double dummy once by itself
let lastFetch=0;
window.ccTableSection=function(tableNo,doneBoards){
  ccTableNo=tableNo;
  const box=document.getElementById('ccTable'); if(!box) return;
  const draw=()=>{
    const el=document.getElementById('ccTable'); if(!el) return;
    if(!doneBoards.length){ el.innerHTML=''; return; }
    const dds=doneBoards.filter(b=>handOf(b));
    el.innerHTML=dds.length?`<div class="cc-tbl"><div class="cc-tbtns">${dds.map(b=>`<button class="btn btn-ghost btn-sm" onclick="ccShowDD('${esc(b)}')">🎯 DD · ${esc(b)}</button>`).join('')}</div></div>`:'';
  };
  draw();
  if(Date.now()-lastFetch>8000){ lastFetch=Date.now(); Promise.all([DB.get('hands'),DB.get('dd')]).then(draw).catch(()=>{}); }
};
})();
