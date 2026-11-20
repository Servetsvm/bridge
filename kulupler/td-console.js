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
window.tdcOn=()=>{ try{ const v=localStorage.getItem('bg_tdc2'); if(v!=null) return v==='1'; }catch(e){} return true; };
window.tdcSet=on=>{ try{ localStorage.setItem('bg_tdc2',on?'1':'0'); }catch(e){} TDC.v='home'; TDC.w=null; TDC.arc=null; renderAdminPanel(); };

// the full panel and its tabs come only when chosen; the TD's screen is drawn again when the tournament changes
const _rap=window.renderAdminPanel||renderAdminPanel;
renderAdminPanel=window.renderAdminPanel=function(){
  if(role==='admin'&&tdcOn()&&!bgTestOn()&&!(typeof setupOnline!=='undefined'&&setupOnline)) return tdcDraw();
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
const MOVS=[['mitchell','Mitchell','NS fixed, EW moves'],['howell','Howell','All pairs move'],['barometer','Barometer','Every table the same boards'],['swiss','Swiss','Pairings by the standings'],['social','Social Bridge','Pairs stay; any free board']];
function frame(title,body,actions,sub){
  const s=getState(), td=typeof tdName==='function'?tdName():'';
  document.getElementById('panelContent').innerHTML=`<div class="bm3 bm3w tdc"><div class="bm3-screen">
    <div class="bm3-bar"><span class="td">🧑‍⚖️ TD</span><div class="ev"><b>${cleanData(CLUB_NAME||'')}${td?' · '+cleanData(td):''}</b>${cleanData(title||'')}</div><button type="button" class="tdc-full" onclick="tdcSet(false)" title="${L('Full panel')}">🖥</button></div>
    ${sub||''}
    <div class="bm3-body">${body}</div>
    <div class="bm3-actions">${actions||''}</div></div></div>`;
  if(TDC.v!=='tab') tdcFill(false);   // the menu's chosen section, drawn into its box
}
window.tdcGo=(v,o)=>{ Object.assign(TDC,{v},o||{}); tdcDraw(); tdcFill(false); };
function tdcDraw(){
  const s=getState();
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
    <div class="tdc-tools"><button class="btn" onclick="tdcSetupStart()">↺ ${L('Set up again')}</button><button class="btn" onclick="ccMovementPage()">🔀 ${L('Movement')}</button><button class="btn" onclick="ccResultsIndex()">📄 ${L('Results')}</button></div>${moreHtml()}${menuHtml()}`;
  frame(L('Ready to start'),body,`<button class="bm3-cancel" onclick="tdcSetupStart()">↺</button><button class="bm3-ok" onclick="tdcStart()">▶ ${L('Start round 1')}</button>`);
}
// the players as on the BridgeScore: each table a card (its pairs); tapped, its four seats round the table
function playersHtml(){
  const s=getState(), r=s.currentRound||1, M=getMovements(), P=getPairs(), n=s.tableCount||0;
  if(!n) return `<div class="bm3-note" style="padding:12px">${L('Create the tournament first')}</div>`;
  const pn=id=>{ const p=P[id]; return p?(p.isPhantom?'👻':cleanData(splitPairName(p.name||'').filter(Boolean).join(' – ')||'—')):'—'; };
  return `<div class="bm3-step">${L('Round')} ${r} · ${L('Tap a table to enter its players')}</div><div class="tdc-plist">${Array.from({length:n},(_,i)=>i+1).map(t=>{ const m=M[r+'_'+t]||{}; return `<button class="tdc-pcard" onclick="tdNames(${t},${r},'admin')"><b>${L('Table')} ${t}</b><span><i>NS ${num(m.ns)}</i>${pn(m.ns)}</span><span><i>EW ${num(m.ew)}</i>${pn(m.ew)}</span></button>`; }).join('')}</div>`;
}
const MENU=[['setup','⚙️','Setup'],['players','👥','Players'],['movement','🔄','Movement'],['tables','🃏','Tables'],['boards','📊','Boards'],['history','📜','History'],['log','📋','Log']];
const menuHtml=()=>`<div class="bm3-step">${L('Menu')}</div><div class="tdc-menu"><select class="tdc-sel" onchange="tdcPick(this.value)"><option value="">— ${L('Choose')} —</option>${MENU.map(([k,i,n])=>`<option value="${k}"${TDC.tab===k?' selected':''}>${i} ${L(n)}</option>`).join('')}<option value="hist">✏️ ${L('Old tournaments')}</option><option value="plist">📇 ${L('Player list')}</option></select><button class="btn tdc-red" onclick="doLogout()">🚪 ${L('Log out')}</button></div>${TDC.tab?`<div id="adminContent" class="tdc-tab"></div>`:''}`;
// the chosen section drawn into its box (the full panel's own content and buttons)
function tdcFill(scroll){ const c=document.getElementById('adminContent'); if(!c||!TDC.tab) return; if(TDC.tab==='players'){ c.innerHTML=playersHtml(); } else { adminTab=TDC.tab; _rat(); } if(scroll) c.scrollIntoView({behavior:'smooth',block:'start'}); }
window.tdcPick=function(v){ if(v==='hist'){ TDC.tab=null; tdcGo('hist'); return; } if(v==='plist'){ openPlayerRegistry(); tdcDraw(); return; } TDC.tab=v||null; tdcDraw(); tdcFill(true); };
const moreHtml=()=>{ const s=getState(), h=(_cache['hands']||[]).length; return `<div class="bm3-step">${L('Hands')}${h?' · '+h+' '+L('boards'):''}</div><div class="tdc-tools"><button class="btn" onclick="adminImportHandsOpen()">🃏 ${L('Load hand file')}</button><button class="btn" onclick="adminAutoBoardsOpen()">🎲 ${L('Make the boards automatically')}</button></div>
  <div class="bm3-step">${L('More')}</div><div class="tdc-tools"><button class="btn" onclick="tdcStall()">⚠️ ${L('Slow table')}: ${s.stallAlertMinutes||15} min</button><button class="btn" onclick="adminExport()">⬇ ${L('Export')}</button><button class="btn" onclick="adminImportOpen()">⬆ ${L('Import')}</button><button class="btn tdc-red" onclick="adminReset()">🗑 ${L('Reset')}</button></div>`; };
window.tdcStall=function(){ const s=getState(); openModal('⚠️ '+L('Slow table'),`<div class="field"><label>${L('Alarm when a table has entered no score for this many minutes')}</label><input type="number" id="tdcStallMin" min="1" max="90" value="${s.stallAlertMinutes||15}"></div>`,`<button class="btn btn-ghost" onclick="closeModal()">${L('Cancel')}</button><button class="btn btn-gold" onclick="tdcStallOk()">OK</button>`); };
window.tdcStallOk=function(){ const v=parseInt(document.getElementById('tdcStallMin').value); if(!(v>=1&&v<=90)){ toast('❌ 1 – 90'); return; } const s=getState(); s.stallAlertMinutes=v; setState(s); closeModal(); tdcDraw(); };
window.tdcStart=async function(){ await adminStart(); TDC.v='run'; tdcDraw(); };

// ── the setup on one screen: the movement, the players, the boards (and the Swiss rounds), then Create ──
window.tdcInitW=function(){ const s=getState(); TDC.w={mov:s.movement&&s.movement!=='team'?s.movement:'mitchell',players:+s._setupPlayers||16,bpr:s.boardsPerRound&&s.movement!=='social'?s.boardsPerRound:3,soc:s.movement==='social'?+s.totalBoards||24:24,swr:+s._setupSwissRounds||7}; };
window.tdcSetupStart=function(){ tdcInitW(); TDC.v='setup'; tdcDraw(); };
function calc(w){
  const p=+w.players||0, tables=Math.floor(p/4), ph=p%4!==0, pc=tables*2+(ph?1:0);
  const rounds=w.mov==='social'?1:w.mov==='mitchell'?tables:w.mov==='swiss'?(+w.swr||0):(pc%2?pc:pc-1);
  const total=w.mov==='social'?(+w.soc||0):rounds*w.bpr;
  return {tables,ph,pc,rounds,total};
}
const LIM={players:[4,120],soc:[1,99],swr:[3,20]};
window.tdcSet1=(k,v)=>{ TDC.w[k]=v; drawSetup(); };
window.tdcInc=(k,dv)=>{ const [lo,hi]=LIM[k]; TDC.w[k]=Math.max(lo,Math.min(hi,(+TDC.w[k]||0)+dv)); drawSetup(); };
window.tdcTyped=(k,el)=>{ const v=parseInt(el.value,10); if(v>0){ TDC.w[k]=v; const x=document.getElementById('tdcSum'); if(x) x.outerHTML=sumHtml(); const b=document.getElementById('tdcCreateBtn'); if(b) b.disabled=!!setupErr(); } };
const stepper=(k,quick)=>`<div class="tdc-stepper"><button class="bm3-key" onclick="tdcInc('${k}',-1)">−</button><input type="number" inputmode="numeric" value="${TDC.w[k]}" min="${LIM[k][0]}" max="${LIM[k][1]}" oninput="tdcTyped('${k}',this)" onchange="drawSetupNow()"><button class="bm3-key" onclick="tdcInc('${k}',1)">+</button></div>${quick?`<div class="tdc-quick">${quick.map(n=>`<button class="${+TDC.w[k]===n?'on':''}" onclick="tdcSet1('${k}',${n})">${n}</button>`).join('')}</div>`:''}`;
window.drawSetupNow=()=>drawSetup();
function setupErr(){ const w=TDC.w, c=calc(w), p=+w.players||0;
  if((w.mov==='social'||w.mov==='swiss')&&!(p>=8&&p%4===0)) return L('At least 8, divisible by 4');
  if(p<8) return L('At least 8 players');
  if(w.mov==='social'&&!((+w.soc||0)>=1&&(+w.soc)<=99)) return '1 – 99';
  if(w.mov==='swiss'&&!((+w.swr)>=3&&(+w.swr)<=c.pc-1)) return L('Number of rounds')+': 3 – '+Math.max(3,c.pc-1);
  return ''; }
function sumHtml(){ const w=TDC.w, c=calc(w), e=setupErr();
  return `<div id="tdcSum" class="tdc-sumline${e?' bad':''}">${e?'⚠️ '+cleanData(e):`<b>${c.tables}</b> ${L('tables')}${c.ph?' + 👻':''} · <b>${c.rounds}</b> ${L('rounds')} · <b>${c.total}</b> ${L('boards')}`}</div>`; }
function drawSetup(fin){
  if(!TDC.w) tdcInitW();
  const w=TDC.w, again=TDC.v==='setup', fs=getState().status==='finished';
  const body=`${fs&&!again?`<div class="tdc-finrow">🏁 ${L('Tournament finished')} <button class="btn" onclick="ccResultsPage()">📄 ${L('Results')}</button></div>`:''}
    <div class="bm3-step">${L('Movement')}</div>
    <div class="tdc-pick"><select class="tdc-sel" onchange="tdcSet1('mov',this.value)">${MOVS.map(([k,n,d])=>`<option value="${k}"${w.mov===k?' selected':''}>${L(n)} — ${L(d)}</option>`).join('')}</select></div>
    <div class="bm3-step">${L('Number of players')}</div>${stepper('players',[8,12,16,20,24,28,32])}
    ${w.mov==='social'?`<div class="bm3-step">${L('Number of boards')}</div>${stepper('soc',[12,16,20,24,28,32])}`
      :`<div class="bm3-step">${L('Boards per round')}</div><div class="bm3-keys k4">${[1,2,3,4,5,6,7,8].map(n=>`<button class="bm3-key${w.bpr===n?' active':''}" onclick="tdcSet1('bpr',${n})">${n}</button>`).join('')}</div>`}
    ${w.mov==='swiss'?`<div class="bm3-step">${L('Number of rounds')}</div>${stepper('swr',null)}`:''}
    ${sumHtml()}
    ${again?'':menuHtml()}`;
  frame(again?L('Set up again'):L('New tournament'),body,(again?`<button class="bm3-cancel" onclick="TDC.v='home';TDC.w=null;tdcDraw()">‹ ${L('Back')}</button>`:'<span></span>')+`<button class="bm3-ok" id="tdcCreateBtn" onclick="tdcCreate()"${setupErr()?' disabled':''}>🚀 ${L('Create the tournament')}</button>`);
}
// the same setup as the full panel's form: its boxes, filled in out of sight
window.tdcCreate=async function(){
  const w=TDC.w; if(!w) return;
  if(TDC.tab){ TDC.tab=null; const c=document.getElementById('adminContent'); if(c) c.remove(); }
  const box=document.createElement('div'); box.style.display='none'; box.id='tdcForm';
  box.innerHTML=`<input id="aName"><select id="aMovement"><option value="${w.mov}" selected>${w.mov}</option></select><input id="aBPR" value="${w.bpr}"><input id="aPlayers" value="${+w.players||0}"><input id="aSocBoards" value="${+w.soc||0}"><input id="aSwissRounds" value="${+w.swr||0}">`;
  document.body.appendChild(box);
  try{ await adminSetup(); } finally{ box.remove(); }
  if(getState().status==='setup'&&getState().roundCount>0){ TDC.w=null; TDC.v='home'; }
  tdcDraw();
};

// ── the tournament running: the round, the tables as tiles, the next round ──
function tableInfo(t,s,B,A,calls,thr){
  const r=s.currentRound, m=getMovements()[r+'_'+t]||{}; let n=0,d=0,last=Date.parse(s._roundStartedAt||0)||Date.now(), pend=false;
  for(let b=m.boardStart||1;b<=(m.boardEnd||0);b++){ n++; const x=B[t+'_'+r+'_'+b]; if(x&&x.status==='done'){ d++; const tm=Date.parse(x.time||0); if(tm>last) last=tm; } if(A[t+'_'+r+'_'+b]) pend=true; }
  const call=!!(calls&&calls[t]), slow=d<n&&Date.now()-last>thr*60e3;
  return {m,n,d,pend,call,slow,done:n>0&&d>=n};
}
function drawRun(){ TDC.arc=null;
  const s=getState(), B=getBoards(), A=getApprovals(), calls=_cache['tdcalls']||{}, thr=s.stallAlertMinutes||15;
  let tot=0,dn=0; const tiles=[];
  for(let t=1;t<=s.tableCount;t++){ const i=tableInfo(t,s,B,A,calls,thr); tot+=i.n; dn+=i.d;
    const st=i.call?'call':i.done?'done':i.slow?'slow':i.pend?'pend':'';
    tiles.push(`<button class="tdc-tile ${st}" onclick="tdcGo('table',{t:${t},r:${s.currentRound}})"><b>${t}</b><small>${i.call?'📣 TD':i.done?'✓':i.slow?'⚠️ '+i.d+'/'+i.n:i.d+'/'+i.n}</small><i>${num(i.m.ns)}–${num(i.m.ew)}</i></button>`); }
  const all=tot>0&&dn>=tot, last=s.currentRound>=s.roundCount, social=s.movement==='social';
  const sub=`<div class="tdc-round"><b>${L('Round')} ${s.currentRound} / ${s.roundCount}</b><span>${dn}/${tot} ${L('boards')}</span><div class="tdc-bar"><i style="width:${tot?Math.round(dn/tot*100):0}%"></i></div></div>`;
  const body=`<div class="tdc-tiles">${tiles.join('')}</div>
    <div class="tdc-legend"><span class="done">✓ ${L('Finished')}</span><span class="pend">⏳ ${L('Waiting for OK')}</span><span class="slow">⚠️ ${L('Slow')}</span><span class="call">📣 ${L('Calls the TD')}</span></div>
    <div class="tdc-tools"><button class="btn" onclick="ccMovementPage()">🔀 ${L('Movement')}</button><button class="btn" onclick="tdcScreen()">📺 ${L('Screen')}</button><button class="btn" onclick="bgShowPlayersLink()">🔗 ${L('Link')}</button><button class="btn" onclick="ccResultsPage()">📄 ${L('Results')}</button></div>${moreHtml()}${menuHtml()}`;
  const next=last||social?`<button class="bm3-ok${all?'':' tdc-dim'}" onclick="tdcFinish()">🏁 ${L('Finish the tournament')}</button>`:`<button class="bm3-ok${all?'':' tdc-dim'}" onclick="tdcNext()">⏭ ${L('Round')} ${s.currentRound+1}</button>`;
  frame(cleanData(s.name||''),body,`<button class="bm3-cancel" onclick="tdcReload()">↻</button>`+next,sub);
}
window.tdcReload=async()=>{ try{ await Promise.all(['state','boards','approvals','movements','pairs','tdcalls'].map(k=>DB.get(k))); }catch(e){} tdcDraw(); };
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
const tdcPut=(k,v)=>{ if(TDC.arc!=null){ const A=getArchives(), x=A[TDC.arc]; if(!x) return; x.boards=x.boards||{}; if(v) x.boards[k]=v; else delete x.boards[k]; setArchives(A); return; } bmTdPut(k,v); };
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
window.tdcNP=k=>{ tdcPut(k,{contract:'Not played',notPlayed:true,status:'done',td:true,time:new Date().toISOString()}); addLog('warn','TD: not played',k); tdcDraw(); };
window.tdcDel=async(k,b)=>{ if(!await confirmDialog(L('Delete this board result? It cannot be undone; the board is entered again.'),{title:L('Board')+' '+b,confirmLabel:L('Delete')})) return; tdcPut(k,null); addLog('warn','TD: result deleted',k); tdcDraw(); };
window.tdcAdj=function(k,b){ const d=D(); bmAdjScreen(k,b,(ns,ew)=>{ tdcPut(k,{contract:`ADJ(${ns}/${ew})`,nsScore:ns,ewScore:ew,status:'done',adjusted:true,td:true,time:new Date().toISOString()}); addLog('warn','TD: adjusted score',k+' '+ns+'/'+ew); tdcDraw(); },()=>tdcDraw(),d.B[k]); };
// the full panel's table buttons (Boards, ADJ) open the table on the BridgeScore
{ const ret=f0=>function(t){ if(role==='admin'&&tdcOn()){ TDC.tab=null; tdcGo('table',{t:+t,r:getState().currentRound||1}); return; } return f0.apply(this,arguments); };
  if(window.adminEditTable) window.adminEditTable=ret(window.adminEditTable);
  if(window.adminAdjScore) window.adminAdjScore=ret(window.adminAdjScore); }
window.tdcFree=async t=>{ await adminKickTable(t); tdcDraw(); };

// ── the old tournaments: each one opened, its boards and names corrected, its results, PBN, PDF, renamed, deleted ──
const dd=x=>{ const d=new Date(x||0); return isNaN(d)?'':String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear(); };
function drawHist(){
  TDC.arc=null;
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
    <div class="tdc-tools"><button class="btn" onclick="ccResultsPage(${i})">📄 ${L('Results')}</button><button class="btn" onclick="exportArchivePBN(${i})">🃏 PBN</button><button class="btn" onclick="archivePDF(${i})">🖨 PDF</button><button class="btn" onclick="tdcArcName()">✏️ ${L('Rename')}</button><button class="btn tdc-red" onclick="tdcArcDel()">🗑 ${L('Delete')}</button></div>`;
  frame('📜 '+cleanData(s.name||''),`<div class="bm3-note" style="padding:0 12px">${L('Tap a table to correct its boards and names; the ranking is worked out again.')}</div>${grid}`,`<span></span><button class="bm3-ok" onclick="tdcGo('hist')">‹ ${L('Old tournaments')}</button>`,sub);
}
window.tdcArcName=function(){ const a=getArchives()[TDC.arc]; if(!a) return; openModal('✏️ '+L('Rename'),`<div class="field"><label>${L('Tournament')}</label><input id="tdcArcN" maxlength="40" value="${cleanData((a.state&&a.state.name)||'')}"></div>`,`<button class="btn btn-ghost" onclick="closeModal()">${L('Cancel')}</button><button class="btn btn-gold" onclick="tdcArcNameOk()">OK</button>`); };
window.tdcArcNameOk=function(){ const v=(document.getElementById('tdcArcN').value||'').trim().slice(0,40); if(!v) return; const A=getArchives(), a=A[TDC.arc]; if(!a) return; a.state=a.state||{}; a.state.name=v; setArchives(A); addLog('ok','Archived tournament renamed',v); closeModal(); tdcDraw(); };
window.tdcArcDel=async function(){ const n=(getArchives()||[]).length; await adminDeleteArchive(TDC.arc); if((getArchives()||[]).length<n){ TDC.arc=null; tdcGo('hist'); } };

// ── every tab of the full panel, inside the BridgeScore (the same boxes and buttons) ──
const TABS={setup:['⚙️','Setup'],players:['👥','Players'],movement:['🔄','Movement'],tables:['🃏','Tables'],boards:['📊','Boards'],history:['📜','History'],log:['📋','Log']};
window.tdcTab=k=>{ TDC.v='home'; tdcPick(k); };
function drawTab(){
  const k=TDC.tab||'setup', t=TABS[k]||TABS.setup;
  frame(t[0]+' '+L(t[1]),`<div class="tdc-tabnav">${Object.entries(TABS).map(([x,[i,n]])=>`<button class="${x===k?'on':''}" onclick="tdcTab('${x}')">${i} ${L(n)}</button>`).join('')}</div><div id="adminContent" class="tdc-tab"></div>`,`<span></span><button class="bm3-ok" onclick="tdcGo('home')">‹ BridgeScore</button>`);
  adminTab=k; _rat();
}
})();
