// ══════════════════════════════════════════════════════
//  THE TD'S BRIDGESCORE: the whole tournament run from the same green screen as the tables
//  (set up with keys, start, the tables as tiles, each table's boards, names and corrections, the next round, the end)
//  The full admin panel stays one tap away (🖥).
// ══════════════════════════════════════════════════════
(function(){
const L=v=>window.i18nText?i18nText(v):v;
const TDC={v:'home',w:null,t:null,r:null};
window.TDC=TDC;
// on by default on a phone; the choice is kept on this device
window.tdcOn=()=>true;
window.tdcSet=on=>{ try{ localStorage.setItem('bg_tdc2',on?'1':'0'); }catch(e){} TDC.v='home'; TDC.w=null; TDC.arc=null; renderAdminPanel(); };

// the full panel and its tabs come only when chosen; the TD's screen is drawn again when the tournament changes
const _rap=window.renderAdminPanel||renderAdminPanel;
renderAdminPanel=window.renderAdminPanel=function(){
  if(role==='admin'&&tdcOn()&&!bgTestOn()){ if(typeof setupOnline!=='undefined'&&setupOnline){ setupOnline=false; window._tdcOnline=1; TDC.w=null; if(typeof tdcInitW==='function'){ tdcInitW(); TDC.v='setup'; } } return tdcDraw(); }
  _rap();
  const tabs=document.querySelector('.admin-tabs');
  if(tabs&&!document.getElementById('tdcBack')){ const b=document.createElement('button'); b.id='tdcBack'; b.className='admin-tab'; b.textContent='📱 BridgeScore'; b.onclick=()=>tdcSet(true); tabs.prepend(b); }
};
const _rat=window.renderAdminTab||renderAdminTab;
renderAdminTab=window.renderAdminTab=function(){
  if(role==='admin'&&tdcOn()&&!document.getElementById('adminContent')){ tdcLive(); return; }
  _rat();
};
const _tcs=window.tdCallsShow;
if(_tcs) window.tdCallsShow=function(v){ _tcs(v); tdcLive(); };
// drawn again by itself only where nothing is being typed or chosen
function tdcLive(){ if(role!=='admin'||!tdcOn()||!document.querySelector('.tdc')) return; if(document.getElementById('modalBg')?.classList.contains('open')) return; { const ae=document.activeElement, t=document.querySelector('.tdc'); if(ae&&t&&t.contains(ae)&&/^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) return; } if(['run','table','home','arc'].includes(TDC.v)) tdcDraw(); }

const num=x=>(x||'').replace(/[^0-9]/g,'')||'?';
const MOVS=[['mitchell','Mitchell','NS fixed, EW moves'],['howell','Howell','All pairs move'],['barometer','Barometer','Every table the same boards'],['swiss','Swiss','Pairings by the standings'],['social','Social Bridge','Pairs stay; any free board'],['team','Team match','Two teams, the same boards at two tables, IMP']];
// a member running a quick team match (not the club's admin): the tables, the score and Finish only — no club settings,
// no menu, no new tournament, no old tournaments
const qtMember=()=>role==='admin'&&!window._tdPw&&!!getState()._quickTeam&&typeof isClubAdmin==='function'&&!isClubAdmin();
function frame(title,body,actions,sub){
  const s=getState(), td=typeof tdName==='function'?tdName():'';
  document.getElementById('panelContent').innerHTML=`<div class="bm3 bm3w tdc"><div class="bm3-screen">
    <div class="bm3-bar">${qtMember()?'<span class="td tdbtn">🧑‍⚖️ TD</span>':`<button class="td tdbtn" onclick="tdcClub()" title="${L('Club settings')}">🧑‍⚖️ TD ⚙️</button>`}<div class="ev"><b>${cleanData(CLUB_NAME||'')}${td?' · '+cleanData(td):''}</b>${cleanData(title||'')}</div><span class="td" style="visibility:hidden" aria-hidden="true">🧑‍⚖️ TD ⚙️</span></div>
    ${sub||''}
    <div class="bm3-body">${body}</div>
    <div class="bm3-actions">${actions||''}</div></div></div>`;
  if(TDC.v!=='tab') tdcFill(false);   // the menu's chosen section, drawn into its box
}
window.tdcGo=(v,o)=>{ Object.assign(TDC,{v},o||{}); tdcDraw(); tdcFill(false); };
function tdcDraw(){
  const s=getState();
  if(qtMember()){
    // the tables taken now (shown 🔒, not offered): fetched again every few seconds while this screen is open
    if(!TDC.lkT) TDC.lkT=setInterval(()=>{ if(!qtMember()||!document.querySelector('.tdc-tiles')||getState().status!=='running') return; const before=JSON.stringify(_cache['tableLocks']||{});
      DB.get('tableLocks').then(()=>{ if(JSON.stringify(_cache['tableLocks']||{})!==before||!TDC.lkDrawn){ TDC.lkDrawn=1; drawRun(); } }).catch(()=>{}); },3000);
    if(s.status==='running'&&s.tableCount>0) return drawRun();   // the tables' progress only: correcting a score is the club TD's
    return frame(L('Team match'),`<div class="bm3-note" style="padding:16px 12px;text-align:center;font-size:1.05rem;">🏁 ${L('Tournament finished')}</div>`,`<button class="btn" onclick="tdcPwLogin()">🔑 ${L('Club password')}</button><button class="btn tdc-red" onclick="doLogout()">🚪 ${L('Log out')}</button>`);
  }
  if(TDC.v==='setup') return drawSetup();
  if(TDC.v==='table'&&TDC.t) return drawTable();
  if(TDC.v==='hist') return drawHist();
  if(TDC.v==='arc'&&getArchives()[TDC.arc]) return drawArc();
  if(TDC.v==='tab') return drawTab();
  if(s.status==='running'&&s.tableCount>0) return drawRun();
  return drawHome();
}
window.tdcDraw=function(){ tdcDraw(); tdcFill(false); };

// ── no tournament (the setup, all on this one screen), one set up, or one finished ──
function drawHome(){ TDC.arc=null;
  const s=getState(), set=s.status==='setup'&&s.roundCount>0, fin=s.status==='finished';
  if(!set){ if(!TDC.w) tdcInitW(); return drawSetup(fin); }
  const mv=(MOVS.find(m=>m[0]===s.movement)||[])[1]||s.movement||'';
  const sum=`<div class="bm3-sum"><div><span>${L('Tournament')}</span><b>${cleanData(s.name||'')}</b></div><div><span>${L('Movement')}</span><b>${L(mv)}</b></div><div><span>${L('Tables')}</span><b>${s.tableCount||'—'}</b></div><div><span>${L('Rounds')}</span><b>${s.roundCount||'—'}</b></div><div><span>${L('Boards')}</span><b>${s.totalBoards||'—'}</b></div></div>`;
  const body=`<div class="bm3-step">⏳ ${L('Ready to start')}</div>${sum}
    ${handsHtml()}${menuHtml()}`;
  frame(L('Ready to start'),body,`<button class="bm3-cancel tdc-red" onclick="tdcResetNow()" title="${L('Delete')}">🗑</button><button class="bm3-cancel" onclick="tdcSetupStart()">↺</button><button class="bm3-ok" onclick="tdcStart()">▶ ${L('Start round 1')}</button>`);   // the tournament set up: deleted from here at once (one question)
}
// the players as on the BridgeScore: each table a card (its pairs); tapped, its four seats round the table
function playersHtml(){
  const s=getState(), r=s.currentRound||1, M=getMovements(), P=getPairs(), n=s.tableCount||0;
  if(!n) return `<div class="bm3-note" style="padding:12px">${L('Create the tournament first')}</div>`;
  const pn=id=>{ const p=P[id]; return p?(p.isPhantom?'👻':cleanData(splitPairName(p.name||'').filter(Boolean).join(' – ')||'—')):'—'; };
  return `<div class="bm3-step">${L('Round')} ${r} · ${L('Tap a table to enter its players')}</div><div class="tdc-plist">${Array.from({length:n},(_,i)=>i+1).map(t=>{ const m=M[r+'_'+t]||{}; return `<button class="tdc-pcard" onclick="tdNames(${t},${r},'admin')"><b>${L('Table')} ${t}</b><span><i>NS ${num(m.ns)}</i>${pn(m.ns)}</span><span><i>EW ${num(m.ew)}</i>${pn(m.ew)}</span></button>`; }).join('')}</div>`;
}
const MENU=[
  ['Tournament',[['tables','🃏','Tables'],['players','👥','Players'],['boards','📊','Boards']]],
  ['Log',[['log','📋','Log']]]];
const menuHtml=()=>qtMember()?`<div class="tdc-menu"><button class="btn" onclick="tdcPwLogin()">🔑 ${L('Club password')}</button><button class="btn tdc-red" onclick="doLogout()">🚪 ${L('Log out')}</button></div>`:`<div class="bm3-step">${L('Menu')}</div><div class="tdc-menu"><select class="tdc-sel" onchange="tdcPick(this.value)"><option value="">— ${L('Choose')} —</option>${MENU.flatMap(([g,items])=>items).map(([k,i,n])=>`<option value="${k}"${TDC.tab===k?' selected':''}>${i} ${L(n)}</option>`).join('')}</select><button class="btn tdc-red" onclick="doLogout()">🚪 ${L('Log out')}</button></div>${TDC.tab?`<div id="adminContent" class="tdc-tab"></div>`:''}`;
// the chosen section drawn into its box (the full panel's own content and buttons)
function tdcFill(scroll){ const c=document.getElementById('adminContent'); if(!c||!TDC.tab) return; if(TDC.tab==='players'){ c.innerHTML=playersHtml(); } else if(TDC.tab==='log'){ c.innerHTML=resetHtml()+(typeof renderLog==='function'?renderLog():''); } else { adminTab=TDC.tab; _rat(); } if(scroll) c.scrollIntoView({behavior:'smooth',block:'start'}); }
const ACTS={screen:()=>tdcScreen(),link:()=>bgShowPlayersLink(),results:()=>ccResultsPage(),hands:()=>adminImportHandsOpen(),auto:()=>adminAutoBoardsOpen(),stall:()=>tdcStall(),export:()=>adminExport(),import:()=>adminImportOpen(),reset:()=>tdcReset()};
window.tdcPick=function(v){
  if(v&&v[0]==='!'){ const sel=document.querySelector('.tdc-menu select'); if(sel) sel.value=TDC.tab||''; (ACTS[v.slice(1)]||(()=>{}))(); return; }
  if(v==='hist'){ TDC.tab=null; tdcGo('hist'); return; }
  if(v==='plist'){ const sel=document.querySelector('.tdc-menu select'); if(sel) sel.value=TDC.tab||''; openPlayerRegistry(); return; }
  TDC.tab=v||null; tdcDraw(); tdcFill(true); };
// Reset deletes the tournament: asked twice
window.tdcReset=function(){ TDC.tab=null; tdcGo('reset'); };
window.tdcResetNow=async function(){ const had=getState().status; await adminReset(true); if(getState().status===had&&had) return; TDC.tab=null; TDC.v='home'; TDC.w=null; tdcDraw(); };   // deleted: straight to a new tournament's setup
window.tdcResetOld=async function(i){ const a0=getArchives()[i]; if(!a0) return; await adminDeleteArchive(i); tdcDraw(); };
// the hands: before round 1 (on the ready screen) and from the menu
const handsHtml=()=>{ const h=(_cache['hands']||[]).length; return `<div class="bm3-step">${L('Hands')}${h?' · '+h+' '+L('boards'):''}</div><div class="tdc-tools"><button class="btn" onclick="adminImportHandsOpen()">🃏 ${L('Load hand file')}</button><button class="btn" onclick="adminAutoBoardsOpen()">🎲 ${L('Make the boards automatically')}</button></div>`; };
window.tdcStall=function(){ const s=getState(); openModal('⚠️ '+L('Slow table'),`<div class="field"><label>${L('Alarm when a table has entered no score for this many minutes')}</label><input type="number" id="tdcStallMin" min="1" max="90" value="${s.stallAlertMinutes||15}"></div>`,`<button class="btn btn-ghost" onclick="closeModal()">${L('Cancel')}</button><button class="btn btn-gold" onclick="tdcStallOk()">OK</button>`); };
window.tdcStallOk=function(){ const v=parseInt(document.getElementById('tdcStallMin').value); if(!(v>=1&&v<=90)){ toast('❌ 1 – 90'); return; } const s=getState(); s.stallAlertMinutes=v; setState(s); closeModal(); tdcDraw(); };
window.tdcStart=async function(){ await adminStart(); TDC.v='run'; tdcDraw(); };

// ── the setup on one screen: the movement, the players, the boards (and the Swiss rounds), then Create ──
window.tdcInitW=function(){ const s=getState(), teamLink=new URLSearchParams(location.search).get('setup')==='team'&&s.status!=='running';   // from BridgePlay's Team match button
  TDC.w={ta:s._teamAName||'Team A',tb:s._teamBName||'Team B',tpp:+s._teamPairs||2,where:window._tdcOnline?'online':'club',mov:teamLink?'team':s.movement&&s.movement!=='team'?s.movement:'mitchell',players:+s._setupPlayers||16,bpr:s.boardsPerRound&&s.movement!=='social'?s.boardsPerRound:3,soc:s.movement==='social'?+s.totalBoards||24:24,swr:+s._setupSwissRounds||7}; };
window.tdcSetupStart=function(){ tdcInitW(); TDC.v='setup'; tdcDraw(); };
function calc(w){
  if(w.mov==='team'){ const n=+w.tpp||2; return {tables:n,ph:false,pc:n*2,rounds:n,total:n*(+w.bpr||0)}; }   // two teams of n pairs: n tables (two a match), n rounds
  const p=+w.players||0, t0=Math.floor(p/4), ph=p%4!==0, pc=t0*2+(ph?1:0), mT=t0+(ph?1:0);
  // Mitchell: an odd number of pairs adds a table (the phantom); an even number of tables plays one round fewer (skip)
  const tables=w.mov==='mitchell'?mT:t0;
  const rounds=w.mov==='social'?1:w.mov==='mitchell'?(mT%2?mT:mT-1):w.mov==='swiss'?(+w.swr||0):(pc%2?pc:pc-1);
  const total=w.mov==='social'?(+w.soc||0):w.mov==='mitchell'?mT*w.bpr:rounds*w.bpr;
  return {tables,ph,pc,rounds,total};
}
const LIM={players:[4,120],soc:[1,99],swr:[3,20]};
window.tdcSet1=(k,v)=>{ TDC.w[k]=v; drawSetup(); };
window.tdcInc=(k,dv)=>{ const [lo,hi]=LIM[k]; TDC.w[k]=Math.max(lo,Math.min(hi,(+TDC.w[k]||0)+dv)); drawSetup(); };
window.tdcTyped=(k,el)=>{ const v=parseInt(el.value,10); if(v>0){ TDC.w[k]=v; const x=document.getElementById('tdcSum'); if(x) x.outerHTML=sumHtml(); const b=document.getElementById('tdcCreateBtn'); if(b) b.disabled=!!setupErr(); } };
const stepper=(k,quick)=>`<div class="tdc-stepper"><button class="bm3-key" onclick="tdcInc('${k}',-1)">−</button><input type="number" inputmode="numeric" value="${TDC.w[k]}" min="${LIM[k][0]}" max="${LIM[k][1]}" oninput="tdcTyped('${k}',this)" onchange="drawSetupNow()"><button class="bm3-key" onclick="tdcInc('${k}',1)">+</button></div>${quick?`<div class="tdc-quick">${quick.map(n=>`<button class="${+TDC.w[k]===n?'on':''}" onclick="tdcSet1('${k}',${n})">${n}</button>`).join('')}</div>`:''}`;
window.drawSetupNow=()=>drawSetup();
window.tdcSumNow=()=>{ const x=document.getElementById('tdcSum'); if(x) x.outerHTML=sumHtml(); const b=document.getElementById('tdcCreateBtn'); if(b) b.disabled=!!setupErr(); };
function setupErr(){ const w=TDC.w, c=calc(w), p=+w.players||0;
  if(w.mov==='team') return (+w.tpp>=2&&+w.tpp<=12&&!(+w.tpp%2))?(String(w.ta||'').trim()&&String(w.tb||'').trim()?'':L('Teams')+'?'):L('Team Match: 2, 4, 6 … 12 pairs per team');
  if(p%2) return L('An even number of players: each pair is two players');
  if(w.mov==='social'&&p%4) return L('Social Bridge: full tables only (a half table: choose Howell)');
  if(p<8) return L('At least 8 players');
  if(w.mov==='mitchell'&&c.tables<3) return L('Mitchell needs at least 3 tables: choose Howell');
  if(w.mov==='social'&&!((+w.soc||0)>=1&&(+w.soc)<=99)) return '1 – 99';
  if(w.mov==='swiss'&&!((+w.swr)>=3&&(+w.swr)<=c.pc-1)) return L('Number of rounds')+': 3 – '+Math.max(3,c.pc-1);
  return ''; }
function sumHtml(){ const w=TDC.w, c=calc(w), e=setupErr();
  return `<div id="tdcSum" class="tdc-sumline${e?' bad':''}">${e?'⚠️ '+cleanData(e):`${w.mov==='team'?`<b>${cleanData(w.ta)}</b> – <b>${cleanData(w.tb)}</b> · `:''}<b>${c.tables}</b> ${L('tables')}${c.ph?' + 👻':''} · <b>${c.rounds}</b> ${L('rounds')} · <b>${c.total}</b> ${L('boards')}`}</div>`; }
function drawSetup(fin){
  if(!TDC.w) tdcInitW();
  const w=TDC.w, again=TDC.v==='setup', fs=getState().status==='finished';
  const body=`${fs&&!again?`<div class="tdc-finrow">🏁 ${L('Tournament finished')} <button class="btn" onclick="ccResultsPage()">📄 ${L('Results')}</button></div>`:''}
    <div class="bm3-keys k2 tdc-where">${[['club','🏛 '+L('At the club')],['online','🌐 '+L('Online (from home)')]].map(([k,n])=>`<button class="bm3-key${(w.where||'club')===k?' active':''}" onclick="tdcWhere('${k}')">${n}</button>`).join('')}</div>
    ${w.where==='online'?`<div class="bm3-note" style="padding:0 2px 6px">${L('Played in BridgePlay, starts now; robots in the empty seats')}</div>`:''}
    <div class="bm3-step">${L('Movement')}</div>
    <div class="tdc-pick"><select class="tdc-sel" onchange="tdcSet1('mov',this.value)">${MOVS.filter(m=>(m[0]!=='team'||w.mov==='team')&&(w.where!=='online'||['mitchell','howell','barometer','swiss'].includes(m[0]))).map(([k,n,d])=>`<option value="${k}"${w.mov===k?' selected':''}>${L(n)} — ${L(d)}</option>`).join('')}</select></div>
    ${w.mov==='team'?`<div class="bm3-step">${L('Teams')}</div><div class="tdc-teams"><input class="tdc-in" maxlength="30" value="${cleanData(w.ta)}" oninput="TDC.w.ta=this.value;tdcSumNow()" placeholder="Team A"><input class="tdc-in" maxlength="30" value="${cleanData(w.tb)}" oninput="TDC.w.tb=this.value;tdcSumNow()" placeholder="Team B"></div>
      <div class="bm3-step">${L('Pairs per team')}</div><div class="bm3-keys k4">${[2,4,6,8].map(n=>`<button class="bm3-key${+w.tpp===n?' active':''}" onclick="tdcSet1('tpp',${n})">${n}</button>`).join('')}</div>`
    :`<div class="bm3-step">${L('Number of players')}</div>${stepper('players',[8,12,16,20,24,28,32])}`}
    ${w.mov==='social'?`<div class="bm3-step">${L('Number of boards')}</div>${stepper('soc',[12,16,20,24,28,32])}`
      :`<div class="bm3-step">${L('Boards per round')}</div><div class="bm3-keys k4">${[1,2,3,4,5,6,7,8].map(n=>`<button class="bm3-key${w.bpr===n?' active':''}" onclick="tdcSet1('bpr',${n})">${n}</button>`).join('')}</div>`}
    ${w.mov==='swiss'?`<div class="bm3-step">${L('Number of rounds')}</div>${stepper('swr',null)}`:''}
    ${sumHtml()}
    ${again?'':menuHtml()}`;
  frame(again?L('Set up again'):L('New tournament'),body,(again?`<button class="bm3-cancel" onclick="TDC.v='home';TDC.w=null;tdcDraw()">‹ ${L('Back')}</button>`:'<span></span>')+`<button class="bm3-ok" id="tdcCreateBtn" onclick="tdcCreate()"${setupErr()?' disabled':''}>🚀 ${L('Create the tournament')}</button>`);
}
// the same setup as the full panel's form: its boxes, filled in out of sight
// at the club or online (from home): the movements both have; online keeps only those an online evening plays
window.tdcWhere=function(k){ const w=TDC.w; if(!w) return; w.where=k; if(k==='online'&&!['mitchell','howell','barometer','swiss'].includes(w.mov)) w.mov='howell'; tdcDraw(); };
window.tdcCreate=async function(){
  const w=TDC.w; if(!w) return;
  if(w.where==='online'){ const c=calc(w); if(typeof otStartQuick==='function'&&await otStartQuick({np:+w.players||8,bpr:+w.bpr||3,b:c.total,mov:w.mov})){ window._tdcOnline=0; TDC.w=null; TDC.v='home'; } tdcDraw(); return; }
  if(TDC.tab){ TDC.tab=null; const c=document.getElementById('adminContent'); if(c) c.remove(); }
  const box=document.createElement('div'); box.style.display='none'; box.id='tdcForm';
  box.innerHTML=`<input id="aName"><select id="aMovement"><option value="${w.mov}" selected>${w.mov}</option></select><input id="aBPR" value="${w.bpr}"><input id="aPlayers" value="${+w.players||0}"><input id="aSocBoards" value="${+w.soc||0}"><input id="aSwissRounds" value="${+w.swr||0}"><input id="aTeamA"><input id="aTeamB"><input id="aTeamPairs" value="${+w.tpp||2}">`;
  document.body.appendChild(box);
  box.querySelector('#aTeamA').value=String(w.ta||'Team A').trim().slice(0,30); box.querySelector('#aTeamB').value=String(w.tb||'Team B').trim().slice(0,30);
  try{ await adminSetup(); } finally{ box.remove(); }
  if(getState().status==='setup'&&getState().roundCount>0){ TDC.w=null; TDC.v='home'; }
  tdcDraw();
};

// ── the tournament running: the round, the tables as tiles, the next round ──
function tableInfo(t,s,B,A,calls,thr){
  const r=s.currentRound, m=getMovements()[r+'_'+t]||{}; let n=0,d=0,last=Date.parse(s._roundStartedAt||0)||Date.now(), pend=false;
  for(let b=m.boardStart||1;b<=(m.boardEnd||0);b++){ n++; const x=B[t+'_'+r+'_'+b]; if(x&&x.status==='done'){ d++; const tm=Date.parse(x.time||0); if(tm>last) last=tm; } if(A[t+'_'+r+'_'+b]) pend=true; }
  const call=!!(calls&&calls[t]), slow=false;
  return {m,n,d,pend,call,slow,done:n>0&&d>=n};
}
function drawRun(){ TDC.arc=null;
  const s=getState(), B=getBoards(), A=getApprovals(), calls=_cache['tdcalls']||{}, thr=s.stallAlertMinutes||15;
  let tot=0,dn=0; const tiles=[], legend=new Set();
  for(let t=1;t<=s.tableCount;t++){ const i=tableInfo(t,s,B,A,calls,thr); tot+=i.n; dn+=i.d;
    const st=i.call?'call':i.done?'done':i.slow?'slow':i.pend?'pend':''; if(st&&st!=='done') legend.add(st);
    tiles.push(`<button class="tdc-tile ${st}" ${qtMember()&&tdcTaken(s,t)?'disabled style="opacity:.55;cursor:default"':`onclick="${qtMember()?`tdcSit(${t})`:`tdcGo('table',{t:${t},r:${s.currentRound}})`}"`}><b>${t}</b><small>${qtMember()&&tdcTaken(s,t)?'🔒':''}${i.call?'📣 TD':i.done?'✓':i.slow?'⚠️ '+i.d+'/'+i.n:i.d+'/'+i.n}</small><i>${num(i.m.ns)}–${num(i.m.ew)}</i></button>`); }
  const all=tot>0&&dn>=tot, last=s.currentRound>=s.roundCount, social=s.movement==='social';
  const sub=`<div class="tdc-round"><b>${L('Round')} ${s.currentRound} / ${s.roundCount} · ${L((MOVS.find(m=>m[0]===s.movement)||[])[1]||s.movement||'')}</b><span>${dn}/${tot} ${L('boards')}</span><div class="tdc-bar"><i style="width:${tot?Math.round(dn/tot*100):0}%"></i></div></div>`;
  const body=`<div class="tdc-tiles">${tiles.join('')}</div>
    ${legend.size?`<div class="tdc-legend">${[['pend','⏳','Waiting for OK'],['slow','⚠️','Slow'],['call','📣','Calls the TD']].filter(x=>legend.has(x[0])).map(([c,i,n])=>`<span class="${c}">${i} ${L(n)}</span>`).join('')}</div>`:''}
    ${menuHtml()}`;
  const next=last||social?`<button class="bm3-ok${all?'':' tdc-dim'}" onclick="tdcFinish()">🏁 ${L('Finish the tournament')}</button>`:`<span class="tdc-auto">${L('The next round starts by itself when every table has finished.')}</span>`;
  frame(cleanData(s.name||'')+' · '+L((MOVS.find(m=>m[0]===s.movement)||[])[1]||s.movement||''),body,(qtMember()?'':`<button class="bm3-cancel tdc-red" onclick="tdcResetNow()" title="${L('Delete')}">🗑</button>`)+`<button class="bm3-cancel" onclick="tdcReload()">↻</button>`+next,sub);
}
window.tdcReload=async()=>{ try{ await Promise.all(['state','boards','approvals','movements','pairs','tdcalls','tableLocks'].map(k=>DB.get(k))); }catch(e){} tdcDraw(); };
// the TD button: the club's settings (its logo, its info, its password, the slow-table alarm); no screen (2026-11-27), no table codes or
// players' link any more (2026-11-27): a member signed in to BridgePlay sits at a table without a code
// a member at a team match's TD: a table tapped is a table to sit at (its players' names, then its BridgeScore)
const tdcTaken=(s,t)=>{ const l=(_cache['tableLocks']||{})[s.currentRound+'_'+t], t0=Date.parse(s._startedAt||0)||0; if(!l||(l.lockedAt||0)<t0) return false; const sv=bmSeatOf(CLUB_ID); return !(sv&&+sv.t===+t&&sv.sid===s._startedAt); };
window.tdcSit=t=>location.replace(location.pathname+'?club='+encodeURIComponent(CLUB_ID)+'&role=table&p=00&tn='+t);
// the club's real TD at a team match a member runs: signs in with the club's password, then the full panel
window.tdcPwLogin=function(){
  window._quickTeam=false; document.getElementById('app').style.display='none'; document.getElementById('loginScreen').style.display='flex';
  ['clubGate','playerEntry'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });
  document.getElementById('loginForm').style.display='block'; selRole('admin'); setTimeout(()=>document.getElementById('pwInput')?.focus(),80);
};
window.tdcClub=function(){ if(qtMember()) return;
  const b=(ic,t,fn)=>`<button class="btn tdc-set" onclick="closeModal();${fn}">${ic} ${L(t)}</button>`;
  openModal('⚙️ '+L('Club settings'),`<div class="tdc-setlist">${[
    b('🎴','Club logo','clubLogoPick()'),
    b('ℹ️','Club info','tdcInfo()'),
    b('🔑','Club password','tdcPw()'),
    b('⚠️','Slow table','tdcStall()')].join('')}</div>`,`<button class="btn btn-ghost" onclick="closeModal()">${L('Close')}</button>`);
};
// the club's info for BridgePlay's Clubs page: address (players open it in their maps), contact person, phone (call / SMS).
// Kept in the club's own data (gate/clubs/<id>/bm/info), like the logo
window.tdcInfo=async function(){
  // read first: a read that fails (no connection, the sign-in run out) opens no empty form — saved, it would wipe the info
  let x={}; try{ const r=await fetchT(await fbRootUrl('/clubs/'+CLUB_ID+'/bm/info.json'),{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); x=(await r.json())||{}; }catch(e){ toast('❌ '+L('Could not read the club info — check the connection and try again')+' ('+String(e&&e.message||e).slice(0,40)+')',6000); return; }
  window._tdcInfoHad=!!(x.adr||x.kp||x.tel||(x.sch&&x.sch.length)||x.tm||x.sb||x.ol);
  const v=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  openModal('ℹ️ '+L('Club info'),`<div style="font-size:0.85rem;color:var(--text2);margin-bottom:10px;">${L('Shown on BridgePlay\'s Clubs page: players open the address in their maps, and call or send an SMS to the number.')}</div>
    <div class="field"><label>${L('Address')}</label><textarea id="tdcAdr" rows="2" maxlength="150" style="width:100%;box-sizing:border-box;">${v(x.adr)}</textarea></div>
    <div class="field"><label>${L('Contact person')}</label><input id="tdcKp" maxlength="60" value="${v(x.kp)}"></div>
    <div class="field"><label>${L('Phone number')}</label><input id="tdcTel" type="tel" maxlength="25" placeholder="+47 …" value="${v(x.tel)}"></div>
    <div class="field"><label>📅 ${L('Tournament days')}</label><div id="tdcSch"></div><button type="button" class="btn btn-ghost btn-sm" style="margin-top:6px;" onclick="tdcSchAdd()">➕ ${L('Add a day')}</button></div>
    <label style="display:flex;gap:10px;align-items:center;font-size:0.95rem;margin-top:6px;cursor:pointer;"><input type="checkbox" id="tdcTm" ${x.tm?'checked':''} style="width:22px;height:22px;"> 🏆 ${L('Team match button on BridgePlay (members start a 2-table match)')}</label>
    <label style="display:flex;gap:10px;align-items:center;font-size:0.95rem;margin-top:6px;cursor:pointer;"><input type="checkbox" id="tdcSb" ${x.sb?'checked':''} style="width:22px;height:22px;"> 🤝 ${L('Social Bridge button on BridgePlay (members choose the players and the boards)')}</label>
    <label style="display:flex;gap:10px;align-items:center;font-size:0.95rem;margin-top:6px;cursor:pointer;"><input type="checkbox" id="tdcOl" ${x.ol?'checked':''} style="width:22px;height:22px;"> 🌐 ${L('Online button on BridgePlay (the TD starts an online tournament at once, robots in the empty seats)')}</label>`,
    `<button class="btn btn-ghost" onclick="closeModal()">${L('Cancel')}</button><button class="btn btn-gold" onclick="tdcInfoSave()">${L('Save')}</button>`);
  (Array.isArray(x.sch)?x.sch:[]).forEach(r=>tdcSchAdd(r));
};
/* one tournament day: when (0 every day, 8 weekdays, 9 the weekend, 1 Monday … 7 Sunday), the time, the kind of tournament
   (chosen from a list, so every player reads it in their own language) and a short free note (shown as typed) */
const TDC_DAYS=[0,8,9,1,2,3,4,5,6,7], TDC_KINDS=['','pairs','teams','indiv','begin','online'];
const TDC_KIND_TXT={pairs:'Pairs',teams:'Teams',indiv:'Individual',begin:'Beginners',online:'Online'};
const tdcDay=d=>d===0?L('Every day'):d===8?L('Weekdays'):d===9?L('Weekend'):(()=>{ try{ return new Date(2024,0,d).toLocaleDateString(window.getLanguage?.()||undefined,{weekday:'long'}); }catch(e){ return String(d); } })();
window.tdcSchAdd=function(r){
  const box=document.getElementById('tdcSch'); if(!box||box.children.length>=7) return; r=r||{};
  const row=document.createElement('div'); row.className='tdc-sch'; row.style.cssText='display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;';
  row.innerHTML=`<select class="tdc-d" style="flex:1 1 110px;padding:8px;border-radius:8px;">${TDC_DAYS.map(d=>`<option value="${d}"${(r.d==null?0:+r.d)===d?' selected':''}>${tdcDay(d)}</option>`).join('')}</select>
    <input class="tdc-t" type="time" value="${/^\d\d:\d\d$/.test(r.t||'')?r.t:'19:00'}" style="flex:0 0 100px;padding:8px;border-radius:8px;">
    <select class="tdc-k" style="flex:1 1 110px;padding:8px;border-radius:8px;">${TDC_KINDS.map(k=>`<option value="${k}"${(r.k||'')===k?' selected':''}>${k?L(TDC_KIND_TXT[k]):'— '+L('Kind')+' —'}</option>`).join('')}</select>
    <input class="tdc-n" maxlength="40" placeholder="${L('Other note (shown as written)')}" value="${String(r.n||'').replace(/"/g,'&quot;').replace(/</g,'&lt;')}" style="flex:2 1 140px;padding:8px;border-radius:8px;">
    <button type="button" class="btn btn-ghost btn-sm" onclick="this.parentNode.remove()" title="${L('Delete')}">✕</button>`;
  box.appendChild(row);
};
window.tdcInfoSave=async function(){
  const g=id=>(document.getElementById(id)?.value||'').trim();
  const x={adr:g('tdcAdr').slice(0,150),kp:g('tdcKp').slice(0,60),tel:g('tdcTel').slice(0,25)};
  const ord=d=>TDC_DAYS.indexOf(d);
  const sch=[...document.querySelectorAll('#tdcSch .tdc-sch')].map(r=>({d:+r.querySelector('.tdc-d').value,t:r.querySelector('.tdc-t').value||'',k:r.querySelector('.tdc-k').value||'',n:r.querySelector('.tdc-n').value.trim().slice(0,40)}))
    .filter(r=>TDC_DAYS.includes(r.d)&&/^\d\d:\d\d$/.test(r.t)).map(r=>{ const o={d:r.d,t:r.t}; if(TDC_KINDS.includes(r.k)&&r.k) o.k=r.k; if(r.n) o.n=r.n; return o; })
    .sort((a,b)=>ord(a.d)-ord(b.d)||a.t.localeCompare(b.t)).slice(0,7);
  if(sch.length) x.sch=sch;
  if(document.getElementById('tdcTm')?.checked) x.tm=1;
  if(document.getElementById('tdcSb')?.checked) x.sb=1;
  if(document.getElementById('tdcOl')?.checked) x.ol=1;   // the 🌐 Online button on BridgePlay's club card: only when the TD turns it on   // the Social Bridge button, the same way   // the Team match button on BridgePlay's club page: only when the admin turns it on
  if(x.tel&&!/^[+\d][\d\s\-()]{4,}$/.test(x.tel)){ toast('❌ '+L('Phone number')+'?'); return; }
  try{
    const empty=!(x.adr||x.kp||x.tel||x.sch||x.tm||x.sb||x.ol);
    if(empty&&window._tdcInfoHad&&!await confirmDialog(L('Delete all the club info?'),{title:'🗑 '+L('Delete'),confirmLabel:L('Delete'),cancelLabel:L('Cancel')})) return;   // an emptied form wipes the info only when asked
    const r=await fetch(await fbRootUrl('/clubs/'+CLUB_ID+'/bm/info.json'),!empty?{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(x)}:{method:'DELETE'});
    if(!r.ok) throw new Error(String(r.status));
  }catch(e){ toast('❌ '+L('Not saved — please log in again')); return; }
  closeModal(); toast('✅ '+L('Saved'));
};
// the club's password (the one the club's admins sign in with): the TD changes it; whoever signed in with the old one goes on
window.tdcPw=function(){
  openModal('🔑 '+L('Club password'),`<div style="font-size:0.85rem;color:var(--text2);margin-bottom:10px;">${L('The club\'s admins sign in with it. Give the new password to the other admins.')}</div><div class="field"><label>${L('New password (4 – 40)')}</label><input id="tdcNewPw" maxlength="40" autocomplete="off"></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">${L('Cancel')}</button><button class="btn btn-blue" onclick="document.getElementById('tdcNewPw').value=newClubPw()">🎲 ${L('New')}</button><button class="btn btn-gold" onclick="tdcPwSave()">${L('Save')}</button>`);
};
window.tdcPwSave=async function(){
  const pw=(document.getElementById('tdcNewPw').value||'').trim();
  if(pw.length<4||pw.length>40){ toast('❌ '+L('New password (4 – 40)')); return; }
  try{
    const r=await fetch(await fbRootUrl('/clubs/'+CLUB_ID+'/secret/pw.json'),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(pw)});
    if(!r.ok) throw new Error(String(r.status));
    // signed in with the club's password: this device's sign-in takes the new one
    try{ const token=await authToken(), uid=window._authUid; if(token&&uid) await fetch(FB_BASE+'/csess/'+uid+'.json?auth='+token,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({club:String(CLUB_ID),pw})}); }catch(e){}
  }catch(e){ toast('❌ '+L('Not saved — please log in again')); return; }
  closeModal(); toast('✅ '+L('Club password changed'));
};
window.tdcScreen=()=>{ window.open(location.origin+location.pathname+'?club='+encodeURIComponent(CLUB_ID)+'&role=screen','_blank'); };
const allDone=()=>{ const s=getState(), B=getBoards(); for(let t=1;t<=s.tableCount;t++){ const m=getMovements()[s.currentRound+'_'+t]||{}; for(let b=m.boardStart||1;b<=(m.boardEnd||0);b++) if(!(B[t+'_'+s.currentRound+'_'+b]||{}).status) return false; } return true; };
window.tdcNext=async function(){
  if(!allDone()&&!await confirmDialog(L('Not every table has finished this round. Start the next round anyway?'),{title:'⏭',confirmLabel:'OK',danger:false})) return;
  adminNextRound(); TDC.v='run'; tdcDraw();
};
window.tdcFinish=async function(){
  if(!allDone()&&!await confirmDialog(L('Not every table has finished. Finish the tournament anyway?'),{title:'🏁',confirmLabel:'OK'})) return;
  await adminFinish(); TDC.v='home'; tdcDraw();
};

// ── one table: its round (‹ ›), its pairs, each board (tap: its BridgeScore), not played, ADJ, delete — the running
//    tournament or an archived one (TDC.arc) ──
const D=()=>{ const A=TDC.arc!=null?getArchives()[TDC.arc]:null; return A?{a:A,s:A.state||{},B:A.boards||{},M:A.movements||{},P:A.pairs||{},AP:{}}:{a:null,s:getState(),B:getBoards(),M:getMovements(),P:getPairs(),AP:getApprovals()}; };
const tdcPut=async(k,v)=>{ if(TDC.arc!=null){ const a0=getArchives()[TDC.arc]; if(!a0) return; const j=await archiveChange(arcKey(a0),(A,i)=>{ const x=A[i]; x.boards=x.boards||{}; if(v) x.boards[k]=v; else delete x.boards[k]; }); if(j>=0) TDC.arc=j; return; } bmTdPut(k,v); };
function drawTable(){
  const d=D(), s=d.s, t=TDC.t, top=d.a?(s.roundCount||1):(s.currentRound||1); TDC.r=Math.max(1,Math.min(top,TDC.r||top));
  const r=TDC.r, m=d.M[r+'_'+t]||{};
  const pn=id=>{ const p=d.P[id]; return p?(p.isPhantom?'👻':cleanData(splitPairName(p.name||'').filter(Boolean).join(' – ')||'—')):'—'; };
  let rows='';
  for(let b=m.boardStart||1;b<=(m.boardEnd||0);b++){
    const k=t+'_'+r+'_'+b, x=d.B[k], ap=d.AP[k];
    rows+=`<div class="bm3-tdrow"><b onclick="tdcEdit('${k}')">${b}</b><span onclick="tdcEdit('${k}')">${x?cleanData(bmTdText(x)):ap?'⏳ '+cleanData(ap.contract||''):'—'} <i class="tdgo">✏️ ${L('Correct')}</i></span><div>
      <button onclick="tdcNP('${k}')">${L('Not played')}</button><button onclick="tdcAdj('${k}',${b})">ADJ</button>${x||ap?`<button class="del" onclick="tdcDel('${k}',${b})">🗑</button>`:''}</div></div>`;
  }
  const calls=d.a?{}:(_cache['tdcalls']||{}), nT=s.tableCount||0;
  const sub=`<div class="bm3-tdnav"><button onclick="tdcGo('table',{r:${r-1}})"${r>1?'':' disabled'}>‹</button><b>${L('Table')} ${t} · ${L('Round')} ${r}</b><span>NS ${num(m.ns)} ${pn(m.ns)}<br>EW ${num(m.ew)} ${pn(m.ew)}</span><button onclick="tdcGo('table',{r:${r+1}})"${r<top?'':' disabled'}>›</button></div>
    ${d.a?`<div class="tdc-tnav">${Array.from({length:nT},(_,i)=>i+1).map(n=>`<button class="${n===t?'on':''}" onclick="tdcGo('table',{t:${n}})">${n}</button>`).join('')}</div>`:''}
    ${calls[t]?`<div class="tdc-callrow">📣 ${L('This table calls the TD')} <button onclick="tdCallDone(${t})">✓ ${L('Answered')}</button></div>`:''}`;
  const body=`<div class="bm3-tdlist">${rows||`<div class="bm3-note">${L('No boards')}</div>`}</div>
    <div class="tdc-tools"><button class="btn" onclick="tdNames(${t},${r},'admin',${d.a?TDC.arc:'undefined'})">👥 ${L('Players')}</button>${!d.a&&r===s.currentRound?`<button class="btn" onclick="tdcFree(${t})">🚪 ${L('Free the table')}</button>`:''}</div>`;
  frame((d.a?'📜 '+cleanData(s.name||'')+' · ':'')+L('Table')+' '+t,body,`<span></span><button class="bm3-ok" onclick="${d.a?"tdcGo('arc',{t:null,r:null})":"tdcGo('run',{t:null,r:null})"}">‹ ${d.a?L('Back'):L('All tables')}</button>`,sub);
}
window.tdcEdit=k=>{ const [t,r,b]=String(k).split('_').map(Number); if(TDC.arc!=null){ window._tdEdit={back:'admin',r,arc:TDC.arc}; bmTableNo=t; bmEnterBoard(b); return; } adminEditBoard(k); };
window.tdcNP=async k=>{ await tdcPut(k,{contract:'Not played',notPlayed:true,status:'done',td:true,time:new Date().toISOString()}); addLog('warn','TD: not played',k); tdcDraw(); };
window.tdcDel=async(k,b)=>{ if(!await confirmDialog(L('Delete this board result? It cannot be undone; the board is entered again.'),{title:L('Board')+' '+b,confirmLabel:L('Delete')})) return; await tdcPut(k,null); addLog('warn','TD: result deleted',k); tdcDraw(); };
window.tdcAdj=function(k,b){ const d=D(); bmAdjScreen(k,b,async(ns,ew)=>{ await tdcPut(k,{contract:`ADJ(${ns}/${ew})`,nsScore:ns,ewScore:ew,status:'done',adjusted:true,td:true,time:new Date().toISOString()}); addLog('warn','TD: adjusted score',k+' '+ns+'/'+ew); tdcDraw(); },()=>tdcDraw(),d.B[k]); };
// the full panel's table buttons (Boards, ADJ) open the table on the BridgeScore
{ const ret=f0=>function(t){ if(role==='admin'&&tdcOn()){ TDC.tab=null; tdcGo('table',{t:+t,r:getState().currentRound||1}); return; } return f0.apply(this,arguments); };
  if(window.adminEditTable) window.adminEditTable=ret(window.adminEditTable);
  if(window.adminAdjScore) window.adminAdjScore=ret(window.adminAdjScore); }
window.tdcFree=async t=>{ await adminKickTable(t); tdcDraw(); };

// ── Reset: the tournament now (its boards, pairs and movement) and the old tournaments, each deleted on its own ──
// the tournament now and the old tournaments, each with its own delete (shown at the top of Log)
function resetHtml(){
  if(Date.now()-(TDC.resAt||0)>3000){ TDC.resAt=Date.now(); Promise.all([archivesFresh(),DB.get('teamArch')]).then(()=>{ if(TDC.tab==='log') tdcFill(false); }); }
  const s=getState(), A=getArchives()||[], now=s&&s.status&&s.status!=='none'&&(s.tableCount>0||s.name);
  return `<div class="bm3-step">${L('The tournament now')}</div>
    ${now?`<div class="tdc-hist"><div class="tdc-hrow tdc-resrow"><b>${cleanData(s.name||'')}</b><span>${s.status==='running'?'🟢 '+L('Running'):s.status==='finished'?'🏁 '+L('Finished'):'⏳ '+L('Ready to start')}</span><button class="btn tdc-red" onclick="tdcResetNow()">🗑 ${L('Delete')}</button></div></div>`:`<div class="bm3-note" style="padding:0 12px">${L('No tournament now')}</div>`}
    <div class="bm3-step">${L('Old tournaments')}</div>
    ${A.length?`<div class="tdc-hist">${A.map((a,i)=>`<div class="tdc-hrow tdc-resrow"><b>${cleanData((a.state&&a.state.name)||L('Tournament'))}</b><span>${dd(a.finished)} · ${(a.state&&a.state.tableCount)||0} ${L('tables')}</span><button class="btn tdc-red" onclick="tdcResetOld(${i})">🗑 ${L('Delete')}</button></div>`).join('')}</div>`:`<div class="bm3-note" style="padding:0 12px">${L('No archived tournaments')}</div>`}
    ${(()=>{ const T=Object.entries(_cache['teamArch']||{}).filter(([,a])=>a&&a.state).sort((x,y)=>String(y[1].finished||'').localeCompare(String(x[1].finished||'')));
      return T.length?`<div class="bm3-step">🏆 ${L('Team match')} · 🤝 ${L('Social Bridge')}</div><div class="tdc-hist">${T.map(([id,a])=>{ const sc=a.state.movement==='team'&&typeof window.teamScoreOf==='function'?window.teamScoreOf(a):null;
        return `<div class="tdc-hrow tdc-resrow"><b>${sc?cleanData(sc.ta)+' '+sc.a+' – '+sc.b+' '+cleanData(sc.tb):cleanData(a.state.name||L('Team match'))}</b><span>${dd(a.finished)}</span><button class="btn tdc-red" onclick="tdcDelTeam('${String(id).replace(/[^A-Za-z0-9_-]/g,'')}')">🗑 ${L('Delete')}</button></div>`; }).join('')}</div>`:''; })()}
    <div class="bm3-step">${L('Log')}</div>`;
}
// a team match's result deleted (the club's TD: the rules let only the club's admins remove one)
window.tdcDelTeam=async function(id){
  if(!await confirmDialog(L('Delete the results of this tournament? Nobody can see them afterwards, and this cannot be undone.'),{title:'🗑',confirmLabel:L('Delete'),danger:true})) return;
  try{ const r=await fetch(await fbUrl('/teamArch/'+id+'.json'),{method:'DELETE'}); if(!r.ok) throw new Error(String(r.status)); }catch(e){ toast('❌ '+L('Not deleted — please log in again')); return; }
  const T={...(_cache['teamArch']||{})}; delete T[id]; _cache['teamArch']=T; toast('🗑 '+L('Deleted')); tdcFill(false);
};
// ── the old tournaments: each one opened, its boards and names corrected, its results, PBN, PDF, renamed, deleted ──
const dd=x=>{ const d=new Date(x||0); return isNaN(d)?'':String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear(); };
function drawHist(){
  TDC.arc=null;
  if(Date.now()-(TDC.histAt||0)>3000){ TDC.histAt=Date.now(); archivesFresh().then(()=>{ if(TDC.v==='hist') drawHist(); }); }
  const A=getArchives()||[];
  const body=A.length?`<div class="tdc-hist">${A.map((a,i)=>`<button class="tdc-hrow" onclick="tdcGo('arc',{arc:${i},t:null,r:null})"><b>${cleanData((a.state&&a.state.name)||L('Tournament'))}</b><span>${dd(a.finished)} · ${(a.state&&a.state.tableCount)||0} ${L('tables')} · ${(a.state&&a.state.roundCount)||0} ${L('rounds')}</span></button>`).join('')}</div>`:`<div class="bm3-note" style="padding:12px">${L('No archived tournaments')}</div>`;
  frame('📜 '+L('Old tournaments'),body,`<span></span><button class="bm3-ok" onclick="tdcGo('home')">‹ ${L('Back')}</button>`);
}
function drawArc(){
  const i=TDC.arc, a=getArchives()[i], s=a.state||{}, M=a.movements||{}, B=a.boards||{};
  let grid='';
  for(let r=1;r<=(s.roundCount||0);r++){
    let tiles='';
    for(let t=1;t<=(s.tableCount||0);t++){ const m=M[r+'_'+t]; if(!m) continue; let n=0,d=0; for(let b=m.boardStart||1;b<=(m.boardEnd||0);b++){ n++; if((B[t+'_'+r+'_'+b]||{}).status) d++; }
      tiles+=`<button class="tdc-tile${d>=n&&n?' done':''}" onclick="tdcGo('table',{t:${t},r:${r}})"><b>${t}</b><small>${d}/${n}</small><i>${num(m.ns)}–${num(m.ew)}</i></button>`; }
    grid+=`<div class="bm3-step">${L('Round')} ${r}</div><div class="tdc-tiles">${tiles}</div>`;
  }
  const sub=`<div class="bm3-sum"><div><span>${L('Date')}</span><b>${dd(a.finished)}</b></div><div><span>${L('Tables')}</span><b>${s.tableCount||0}</b></div><div><span>${L('Rounds')}</span><b>${s.roundCount||0}</b></div></div>
    <div class="tdc-tools"><button class="btn" onclick="ccResultsPage(${i})">📄 ${L('Results')}</button><button class="btn" onclick="exportArchivePBN(${i})">🃏 PBN</button><button class="btn" onclick="tdcArcName()">✏️ ${L('Rename')}</button><button class="btn tdc-red" onclick="tdcArcDel()">🗑 ${L('Delete')}</button></div>`;
  frame('📜 '+cleanData(s.name||''),`<div class="bm3-note" style="padding:0 12px">${L('Tap a table to correct its boards and names; the ranking is worked out again.')}</div>${grid}`,`<span></span><button class="bm3-ok" onclick="tdcGo('hist')">‹ ${L('Old tournaments')}</button>`,sub);
}
window.tdcArcName=function(){ const a=getArchives()[TDC.arc]; if(!a) return; openModal('✏️ '+L('Rename'),`<div class="field"><label>${L('Tournament')}</label><input id="tdcArcN" maxlength="40" value="${cleanData((a.state&&a.state.name)||'')}"></div>`,`<button class="btn btn-ghost" onclick="closeModal()">${L('Cancel')}</button><button class="btn btn-gold" onclick="tdcArcNameOk()">OK</button>`); };
window.tdcArcNameOk=async function(){ const v=(document.getElementById('tdcArcN').value||'').trim().slice(0,40); if(!v) return; const a0=getArchives()[TDC.arc]; if(!a0) return; const j=await archiveChange(arcKey(a0),(A,i)=>{ A[i].state=A[i].state||{}; A[i].state.name=v; }); if(j>=0) TDC.arc=j; addLog('ok','Archived tournament renamed',v); closeModal(); tdcDraw(); };
window.tdcArcDel=async function(){ const a0=getArchives()[TDC.arc]; if(!a0) return; const k=arcKey(a0); await adminDeleteArchive(TDC.arc); if(!(getArchives()||[]).some(x=>arcKey(x)===k)){ TDC.arc=null; tdcGo('hist'); } };

// ── every tab of the full panel, inside the BridgeScore (the same boxes and buttons) ──
const TABS={setup:['⚙️','Setup'],players:['👥','Players'],movement:['🔄','Movement'],tables:['🃏','Tables'],boards:['📊','Boards'],history:['📜','History'],log:['📋','Log']};
window.tdcTab=k=>{ TDC.v='home'; tdcPick(k); };
function drawTab(){
  const k=TDC.tab||'setup', t=TABS[k]||TABS.setup;
  frame(t[0]+' '+L(t[1]),`<div class="tdc-tabnav">${Object.entries(TABS).map(([x,[i,n]])=>`<button class="${x===k?'on':''}" onclick="tdcTab('${x}')">${i} ${L(n)}</button>`).join('')}</div><div id="adminContent" class="tdc-tab"></div>`,`<span></span><button class="bm3-ok" onclick="tdcGo('home')">‹ BridgeScore</button>`);
  adminTab=k; _rat();
}
})();
