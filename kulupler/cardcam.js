// ══════════════════════════════════════════════════════
//  CARDS BY CAMERA — no dealing machine needed
// ══════════════════════════════════════════════════════
// 1. Deal with the camera (the director, after loading a hand file): each card shown to the camera is read (Bridge
//    Table's js/photo.js, on the device) and the screen says, in big letters and aloud, which hand it goes to.
// 2. Record the hands (the table's device, North, after a board): photos of three hands laid out on the table, each
//    read and checked by the player; the fourth hand is the cards left. The board is then saved for every table (the
//    next tables are not asked again) and analysed double dummy.
// 3. After each board the table sees the double-dummy table of that board.
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
  stopCam();
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

// ---- the camera ----
let cam=null, camTimer=null;
async function startCam(video){
  stopCam();
  cam=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}},audio:false});
  video.srcObject=cam; await video.play().catch(()=>{});
}
function stopCam(){
  if(camTimer){ clearInterval(camTimer); camTimer=null; }
  if(cam){ cam.getTracks().forEach(t=>t.stop()); cam=null; }
}

// ══════ 1. Deal with the camera ══════
let D=null;   // { list: the boards, i, placed: Set, last }
window.ccDealStart=async function(){
  const list=handsList().slice().sort((a,b)=>(+a.board||0)-(+b.board||0)).map(h=>({board:h.board,hands:dealCards(h.deal)})).filter(x=>x.hands&&x.hands.every(h=>h.length===13));
  if(!list.length){ toast('❌ Load the hand file first'); return; }
  if(typeof Photo==='undefined'||!Photo.readCardsCanvas){ toast('❌ The card reader is not loaded'); return; }
  D={list,i:0,placed:new Set(),last:null,shown:null,manual:false};
  dealDraw();
  const v=document.getElementById('ccVideo');
  try{ await startCam(v); }catch(e){ D.manual=true; dealDraw(); toast('📷 The camera could not be opened: tap the cards'); return; }
  const cv=document.createElement('canvas');
  camTimer=setInterval(()=>{
    if(!D||!v.videoWidth) return;
    const sc=Math.min(1,960/v.videoWidth); cv.width=Math.round(v.videoWidth*sc); cv.height=Math.round(v.videoHeight*sc);
    cv.getContext('2d').drawImage(v,0,0,cv.width,cv.height);
    let got=[]; try{ got=Photo.readCardsCanvas(cv).filter(x=>x.d<60).sort((a,b)=>a.d-b.d); }catch(e){}
    const c=got.length?got[0].c:null;
    if(c==null){ D.last=null; return; }
    if(D.placed.has(c)){ if(D.shown!==c){ D.shown=c; dealInfo(c,true); } D.last=null; return; }
    if(D.last===c){ D.last=null; dealPlace(c); } else D.last=c;   // the same card in two frames running: sure
  },350);
};
function seatOf(c){ const b=D.list[D.i]; return b.hands.findIndex(h=>h.includes(c)); }
function dealPlace(c){
  if(!D||D.placed.has(c)) return;
  D.placed.add(c); D.shown=c;
  const s=seatOf(c);
  try{ navigator.vibrate&&navigator.vibrate(60); }catch(e){}
  say(seatWord(s));
  dealInfo(c,false);
  if(D.placed.size===52){ say(seatWord(s)); setTimeout(()=>{ if(D&&D.placed.size===52) dealDraw(); },900); }
}
window.ccDealTap=function(c){ if(!D) return; if(D.placed.has(c)){ D.placed.delete(c); dealDraw(); return; } dealPlace(c); dealDraw(); };
window.ccDealMove=function(d){ if(!D) return; const n=D.i+d; if(n<0||n>=D.list.length) return; D.i=n; D.placed=new Set(); D.last=null; D.shown=null; dealDraw(); };
window.ccDealManual=function(){ if(!D) return; D.manual=!D.manual; dealDraw(); };
function counts(){ const b=D.list[D.i], n=[0,0,0,0]; for(const c of D.placed) n[b.hands.findIndex(h=>h.includes(c))]++; return n; }
function dealInfo(c,again){
  const el=document.getElementById('ccBig'); if(!el) return;
  const s=seatOf(c);
  el.style.background=SEAT_COL[s];
  el.innerHTML=`<div class="cc-card${red(c)?' cc-red':''}">${cName(c)}</div><div class="cc-seat">${seatWord(s)}</div>${again?'<div class="cc-again">✓</div>':''}`;
  const n=counts(), cnt=document.getElementById('ccCnt');
  if(cnt) cnt.innerHTML=[0,1,2,3].map(k=>`<span style="color:${SEAT_COL[k]}">${seatWord(k)} <b>${n[k]}</b>/13</span>`).join('');
  const g=document.getElementById('ccGridBox'); if(g&&D.manual) g.innerHTML=gridHtml(D.placed,new Set(),'ccDealTap');
}
function dealDraw(){
  const b=D.list[D.i], n=counts(), all=D.placed.size===52;
  const keep=document.getElementById('ccVideo');
  const html=`<div class="cc-top"><button class="btn btn-ghost btn-sm" onclick="ccClose()">✕</button><b class="cc-title">Board <span>${esc(b.board)}</span></b>
      <span class="cc-nav"><button class="btn btn-ghost btn-sm" onclick="ccDealMove(-1)" ${D.i?'':'disabled'}>◀</button><button class="btn btn-ghost btn-sm" onclick="ccDealMove(1)" ${D.i<D.list.length-1?'':'disabled'}>▶</button></span></div>
    <div class="cc-cnt" id="ccCnt">${[0,1,2,3].map(k=>`<span style="color:${SEAT_COL[k]}">${seatWord(k)} <b>${n[k]}</b>/13</span>`).join('')}</div>
    ${all?`<div class="cc-done">✅ <span>Board complete</span> <b>${esc(b.board)}</b>${D.i<D.list.length-1?`<button class="btn btn-gold" onclick="ccDealMove(1)">▶ <span>Next board</span></button>`:''}</div>`:''}
    <div class="cc-big" id="ccBig"><div class="cc-hint">Show a card to the camera, its corner in view</div></div>
    <div class="cc-vbox"></div>
    <div class="cc-foot"><button class="btn btn-ghost btn-sm" onclick="ccDealManual()">${D.manual?'📷 Camera':'👆 Tap the cards'}</button></div>
    <div id="ccGridBox">${D.manual?gridHtml(D.placed,new Set(),'ccDealTap'):''}</div>`;
  layer(`<div class="cc-wrap">${html}</div>`);
  const box=document.querySelector('#ccLayer .cc-vbox');
  const v=keep||Object.assign(document.createElement('video'),{id:'ccVideo',muted:true,playsInline:true});
  v.setAttribute('playsinline',''); box.appendChild(v); if(keep&&cam) v.play().catch(()=>{});
  if(D.shown!=null&&!all) dealInfo(D.shown,true);
}

// ══════ 2. Record the hands at the table ══════
let H=null;   // { board, hands: [Set|null ×4], seat: the hand being checked, cur: Set }
window.ccRecordStart=function(board){
  if(handOf(board)){ ccShowDD(board); return; }
  if(typeof Photo==='undefined'||!Photo.readCardsFile){ toast('❌ The card reader is not loaded'); return; }
  H={board,hands:[null,null,null,null],seat:null,cur:null,busy:false,auto:null};
  recDraw();
};
const doneHands=()=>H.hands.filter(Boolean).length;
const usedElse=seat=>{ const u=new Set(); H.hands.forEach((h,k)=>{ if(h&&k!==seat) h.forEach(c=>u.add(c)); }); return u; };
window.ccRecSeat=function(s){ if(!H) return; H.seat=s; H.cur=null; recDraw(); setTimeout(()=>document.getElementById('ccFile')?.click(),50); };
window.ccRecFile=async function(inp){
  const f=inp.files&&inp.files[0]; inp.value=''; if(!f||!H||H.seat==null) return;
  H.busy=true; recDraw();
  let got=[]; try{ got=await Photo.readCardsFile(f); }catch(e){ got=[]; }
  const off=usedElse(H.seat);
  H.cur=new Set(got.sort((a,b)=>a.d-b.d).map(x=>x.c).filter(c=>!off.has(c)).slice(0,13));
  H.busy=false; recDraw();
};
window.ccRecTap=function(c){ if(!H||!H.cur) return; if(H.cur.has(c)) H.cur.delete(c); else if(H.cur.size<13) H.cur.add(c); recDraw(); };
window.ccRecOk=function(){
  if(!H||!H.cur||H.cur.size!==13) return;
  H.hands[H.seat]=H.cur; H.seat=null; H.cur=null;
  if(doneHands()===3){ const k=H.hands.findIndex(h=>!h), u=usedElse(k); H.hands[k]=new Set([...Array(52).keys()].filter(c=>!u.has(c))); H.auto=k; }
  recDraw();
};
// a photographed hand taken again: the worked-out fourth hand goes with it
window.ccRecRedo=function(s){ if(!H) return; H.hands[s]=null; if(H.auto!=null){ H.hands[H.auto]=null; H.auto=null; } recDraw(); };
window.ccRecSave=async function(){
  if(!H||doneHands()!==4) return;
  const b=+H.board, deal=cardsDeal(H.hands.map(h=>[...h]));
  const entry={board:b,deal,dealer:typeof dfDealer==='function'?dfDealer(b):'NESW'[(b-1)%4],vulnerable:typeof dfVul==='function'?dfVul(b):'None'};
  const cur=_cache['hands'], arr=Array.isArray(cur)?cur:null;
  let key=null;
  if(arr){ const i=arr.findIndex(h=>h&&String(h.board)===String(b)); if(i>=0) key=String(i); }
  if(key==null) key='b'+b;
  // only this board is written: the other tables' records are never overwritten
  try{
    const url=await fbUrl('/hands/'+key+'.json');
    const r=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)});
    if(!r.ok) throw new Error(String(r.status));
  }catch(e){ toast('❌ Not saved — check the connection and try again'); return; }
  if(arr){ if(/^\d+$/.test(key)) arr[+key]=entry; else arr.push(entry); } else _cache['hands']={...(cur||{}),[key]:entry};
  addLog('ok','Hands recorded by photo','Board '+b);
  toast('✅ Saved');
  const board=H.board; H=null;
  ccAnalyse(board,entry,()=>ccShowDD(board));
  layer(`<div class="cc-wrap"><div class="cc-top"><b class="cc-title">Board <span>${esc(board)}</span></b></div><div class="cc-hint">⏳ <span>Double dummy…</span></div></div>`);
};
function recDraw(){
  const n=doneHands(), b=H.board;
  let body='';
  if(H.busy) body=`<div class="cc-hint">⏳ <span>Reading the cards…</span></div>`;
  else if(H.seat!=null&&H.cur){
    const off=usedElse(H.seat);
    body=`<div class="cc-step"><b style="color:${SEAT_COL[H.seat]}">${seatWord(H.seat)}</b> · <b>${H.cur.size}</b>/13</div>
      <div class="cc-note">Check the cards: tap a card to add or remove it.</div>
      ${gridHtml(H.cur,off,'ccRecTap')}
      <div class="cc-acts"><button class="btn btn-ghost" onclick="ccRecSeat(${H.seat})">📷 <span>Photo again</span></button><button class="btn btn-gold" onclick="ccRecOk()" ${H.cur.size===13?'':'disabled'}>✔ <span>This hand is right</span></button></div>`;
  } else if(n===4){
    body=`<div class="cc-step">✅ <span>All four hands</span></div>${typeof ddDiagram==='function'?ddDiagram(cardsDeal(H.hands.map(h=>[...h]))):''}
      <div class="cc-acts">${[0,1,2,3].filter(s=>s!==H.auto).map(s=>`<button class="btn btn-ghost btn-sm" onclick="ccRecRedo(${s})">↺ ${seatWord(s)}</button>`).join('')}</div>
      <button class="btn btn-gold btn-full" onclick="ccRecSave()">💾 <span>Save the board</span></button>`;
  } else {
    body=`<div class="cc-note">Three players lay their cards face up in front of them. Choose whose hand you photograph; the fourth hand is worked out.</div>
      <div class="cc-step"><span>Photo</span> ${n+1} / 3</div>
      <div class="cc-seats">${[0,1,2,3].map(s=>H.hands[s]?`<button class="btn btn-ghost cc-s${s}" disabled>✓ ${seatWord(s)}</button>`:`<button class="btn cc-s${s}" style="background:${SEAT_COL[s]};color:#fff" onclick="ccRecSeat(${s})">📷 ${seatWord(s)}</button>`).join('')}<div class="cc-smid">🃏</div></div>
      ${n?`<div class="cc-acts">${[0,1,2,3].filter(s=>H.hands[s]).map(s=>`<button class="btn btn-ghost btn-sm" onclick="ccRecRedo(${s})">↺ ${seatWord(s)}</button>`).join('')}</div>`:''}`;
  }
  layer(`<div class="cc-wrap"><div class="cc-top"><button class="btn btn-ghost btn-sm" onclick="ccClose()">✕</button><b class="cc-title">Board <span>${esc(b)}</span></b><span></span></div>
    <div class="cc-sub">Record the hands</div>${body}
    <input type="file" id="ccFile" accept="image/*" capture="environment" style="display:none" onchange="ccRecFile(this)"></div>`);
}

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
window.ccSkipBoard=function(b){ let L=[]; try{ L=JSON.parse(sessionStorage.getItem('ccSkip:'+CLUB_ID)||'[]'); }catch(e){} if(!L.includes(String(b))) L.push(String(b)); try{ sessionStorage.setItem('ccSkip:'+CLUB_ID,JSON.stringify(L)); }catch(e){} if(typeof renderTableDetail==='function'&&typeof bmTableNo!=='undefined'&&bmTableNo) renderTableDetail(bmTableNo); };
window.ccTableSection=function(tableNo,doneBoards){
  ccTableNo=tableNo;
  const box=document.getElementById('ccTable'); if(!box) return;
  const draw=()=>{
    const el=document.getElementById('ccTable'); if(!el) return;
    if(!doneBoards.length){ el.innerHTML=''; return; }
    let skip=[]; try{ skip=JSON.parse(sessionStorage.getItem('ccSkip:'+CLUB_ID)||'[]'); }catch(e){}
    const missing=doneBoards.filter(b=>!handOf(b)&&!skip.includes(String(b)));
    const ask=missing.length?`<div class="cc-ask2"><div class="cc-askt">📷 <span>The hands of this board are not recorded yet.</span></div>${missing.map(b=>`<div class="cc-askrow"><button class="btn btn-gold cc-big" onclick="ccRecordStart('${esc(b)}')">📷 <span>Record the hands</span> · ${esc(b)}</button><button class="btn btn-ghost cc-skip" onclick="ccSkipBoard('${esc(b)}')">⏭ <span>Continue without</span></button></div>`).join('')}</div>`:'';
    const dds=doneBoards.filter(b=>handOf(b));
    el.innerHTML=`<div class="cc-tbl">${ask}${dds.length?`<div class="cc-tbtns">${dds.map(b=>`<button class="btn btn-ghost btn-sm" onclick="ccShowDD('${esc(b)}')">🎯 DD · ${esc(b)}</button>`).join('')}</div>`:''}</div>`;
    // the board just finished: its double dummy once, by itself
    window._ccSeen=window._ccSeen||new Set();
    const lastB=doneBoards[doneBoards.length-1], k=tableNo+'_'+lastB;
    if(handOf(lastB)&&ddOf(lastB)&&!window._ccSeen.has(k)&&!document.querySelector('#modalBg.open')&&document.getElementById('ccLayer')?.hidden!==false){ window._ccSeen.add(k); ccShowDD(lastB); }
  };
  draw();
  if(Date.now()-lastFetch>8000){ lastFetch=Date.now(); Promise.all([DB.get('hands'),DB.get('dd')]).then(draw).catch(()=>{}); }
};
})();
