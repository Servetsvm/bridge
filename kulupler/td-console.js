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
window.tdcOn=()=>{ try{ const v=localStorage.getItem('bg_tdc'); if(v!=null) return v==='1'; }catch(e){} return window.innerWidth<700; };
window.tdcSet=on=>{ try{ localStorage.setItem('bg_tdc',on?'1':'0'); }catch(e){} TDC.v='home'; TDC.w=null; renderAdminPanel(); };

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
function tdcLive(){ if(role!=='admin'||!tdcOn()||!document.querySelector('.tdc')) return; if(document.getElementById('modalBg')?.classList.contains('open')) return; if(['run','table','home'].includes(TDC.v)) tdcDraw(); }

const num=x=>(x||'').replace(/[^0-9]/g,'')||'?';
const MOVS=[['mitchell','Mitchell','NS fixed, EW moves'],['howell','Howell','All pairs move'],['barometer','Barometer','Every table the same boards'],['swiss','Swiss','Pairings by the standings'],['social','Social Bridge','Pairs stay; any free board']];
function frame(title,body,actions,sub){
  const s=getState(), td=typeof tdName==='function'?tdName():'';
  document.getElementById('panelContent').innerHTML=`<div class="bm3 bm3w tdc"><div class="bm3-screen">
    <div class="bm3-bar"><span class="td">🧑‍⚖️ TD</span><div class="ev"><b>${cleanData(CLUB_NAME||'')}${td?' · '+cleanData(td):''}</b>${cleanData(title||'')}</div><button type="button" class="tdc-full" onclick="tdcSet(false)" title="${L('Full panel')}">🖥</button></div>
    ${sub||''}
    <div class="bm3-body">${body}</div>
    <div class="bm3-actions">${actions||''}</div></div></div>`;
}
window.tdcGo=(v,o)=>{ Object.assign(TDC,{v},o||{}); tdcDraw(); };
function tdcDraw(){
  const s=getState();
  if(TDC.v==='setup') return drawSetup();
  if(TDC.v==='table'&&TDC.t) return drawTable();
  if(s.status==='running'&&s.tableCount>0) return drawRun();
  return drawHome();
}
window.tdcDraw=tdcDraw;

// ── no tournament, one set up, or one finished ──
function drawHome(){
  const s=getState(), set=s.status==='setup'&&s.roundCount>0, fin=s.status==='finished';
  const mv=(MOVS.find(m=>m[0]===s.movement)||[])[1]||s.movement||'';
  const sum=set||fin?`<div class="bm3-sum"><div><span>${L('Tournament')}</span><b>${cleanData(s.name||'')}</b></div><div><span>${L('Movement')}</span><b>${L(mv)}</b></div><div><span>${L('Tables')}</span><b>${s.tableCount}</b></div><div><span>${L('Rounds')}</span><b>${s.roundCount}</b></div><div><span>${L('Boards')}</span><b>${s.totalBoards}</b></div></div>`:'';
  const body=`${fin?`<div class="bm3-step">🏁 ${L('Tournament finished')}</div>`:set?`<div class="bm3-step">⏳ ${L('Ready to start')}</div>`:`<div class="bm3-step">${L('No tournament now')}</div>`}${sum}
    <div class="tdc-tools">${set?`<button class="btn" onclick="tdcSetupStart()">↺ ${L('Set up again')}</button>`:''}<button class="btn" onclick="ccResultsIndex()">📄 ${L('Results')}</button>${set?`<button class="btn" onclick="ccMovementPage()">🔀 ${L('Movement')}</button>`:''}</div>${set?moreHtml():''}`;
  frame(fin?L('Tournament finished'):set?L('Ready to start'):L('New tournament'),body,
    set?`<button class="bm3-cancel" onclick="tdcSetupStart()">↺</button><button class="bm3-ok" onclick="tdcStart()">▶ ${L('Start round 1')}</button>`
       :`<span></span><button class="bm3-ok" onclick="tdcSetupStart()">➕ ${L('New tournament')}</button>`);
}
const moreHtml=()=>{ const s=getState(), h=(_cache['hands']||[]).length; return `<div class="bm3-step">${L('Hands')}${h?' · '+h+' '+L('boards'):''}</div><div class="tdc-tools"><button class="btn" onclick="adminImportHandsOpen()">🃏 ${L('Load hand file')}</button><button class="btn" onclick="adminAutoBoardsOpen()">🎲 ${L('Make the boards automatically')}</button></div>
  <div class="bm3-step">${L('More')}</div><div class="tdc-tools"><button class="btn" onclick="tdcStall()">⚠️ ${L('Slow table')}: ${s.stallAlertMinutes||15} min</button><button class="btn" onclick="adminExport()">⬇ ${L('Export')}</button><button class="btn" onclick="adminImportOpen()">⬆ ${L('Import')}</button><button class="btn tdc-red" onclick="adminReset()">🗑 ${L('Reset')}</button></div>`; };
window.tdcStall=function(){ const s=getState(); openModal('⚠️ '+L('Slow table'),`<div class="field"><label>${L('Alarm when a table has entered no score for this many minutes')}</label><input type="number" id="tdcStallMin" min="1" max="90" value="${s.stallAlertMinutes||15}"></div>`,`<button class="btn btn-ghost" onclick="closeModal()">${L('Cancel')}</button><button class="btn btn-gold" onclick="tdcStallOk()">OK</button>`); };
window.tdcStallOk=function(){ const v=parseInt(document.getElementById('tdcStallMin').value); if(!(v>=1&&v<=90)){ toast('❌ 1 – 90'); return; } const s=getState(); s.stallAlertMinutes=v; setState(s); closeModal(); tdcDraw(); };
window.tdcStart=async function(){ await adminStart(); TDC.v='run'; tdcDraw(); };

// ── the setup with keys: the movement, the players, the boards (and the Swiss rounds) ──
window.tdcSetupStart=function(){ const s=getState(); TDC.w={step:'mov',mov:s.movement&&s.movement!=='team'?s.movement:'mitchell',players:String(s._setupPlayers||16),bpr:s.boardsPerRound&&s.movement!=='social'?s.boardsPerRound:3,soc:String(s.movement==='social'?s.totalBoards:24),swr:String(s._setupSwissRounds||7)}; TDC.v='setup'; tdcDraw(); };
function calc(w){
  const p=+w.players||0, tables=Math.floor(p/4), ph=p%4!==0, pc=tables*2+(ph?1:0);
  const rounds=w.mov==='social'?1:w.mov==='mitchell'?tables:w.mov==='swiss'?(+w.swr||0):(pc%2?pc:pc-1);
  const total=w.mov==='social'?(+w.soc||0):rounds*w.bpr;
  return {tables,ph,pc,rounds,total};
}
const STEPS=w=>['mov','players',w.mov==='social'?'soc':'bpr',...(w.mov==='swiss'?['swr']:[]),'ok'];
function pad(k){ return `<div class="bm3-keys k3 tdc-pad">${['1','2','3','4','5','6','7','8','9','⌫','0','C'].map(d=>`<button class="bm3-key" onclick="tdcKey('${k}','${d}')">${d}</button>`).join('')}</div>`; }
window.tdcKey=function(k,d){ const w=TDC.w; let v=String(w[k]||''); if(d==='⌫') v=v.slice(0,-1); else if(d==='C') v=''; else if(v.length<3) v=(v==='0'?'':v)+d; w[k]=v; drawSetup(); };
window.tdcSet1=(k,v)=>{ TDC.w[k]=v; if(k==='mov'||k==='bpr'){ tdcStep(1); return; } drawSetup(); };
window.tdcStep=function(d){ const w=TDC.w, S=STEPS(w), i=S.indexOf(w.step)+d; if(i<0){ TDC.v='home'; TDC.w=null; tdcDraw(); return; } w.step=S[Math.min(S.length-1,i)]; drawSetup(); };
function drawSetup(){
  const w=TDC.w; if(!w) return tdcSetupStart();
  const c=calc(w); let body='', ok=true;
  const info=`<div class="bm3-display tdc-disp"><div class="bm3-contract">${L((MOVS.find(m=>m[0]===w.mov)||[])[1]||'')}</div><div class="bm3-sub"><span>${+w.players||0} ${L('players')}</span><span>${c.tables} ${L('tables')}${c.ph?' + 👻':''}</span><span>${c.rounds} ${L('rounds')}</span><span>${c.total} ${L('boards')}</span></div></div>`;
  if(w.step==='mov') body=`<div class="bm3-step">${L('Movement')}</div><div class="tdc-movs">${MOVS.map(([k,n,d])=>`<button class="bm3-key${w.mov===k?' active':''}" onclick="tdcSet1('mov','${k}')"><b>${L(n)}</b><small>${L(d)}</small></button>`).join('')}</div>`;
  else if(w.step==='players'){ const p=+w.players||0; ok=w.mov==='social'?p>=8&&p%4===0:w.mov==='swiss'?p>=8&&p%4===0:p>=8; body=`<div class="bm3-step">${L('Number of players')}</div><div class="tdc-big">${w.players||'—'}</div>${ok?'':`<div class="bm3-note tdc-warn">${w.mov==='social'||w.mov==='swiss'?L('At least 8, divisible by 4'):L('At least 8 players')}</div>`}${pad('players')}`; }
  else if(w.step==='bpr') body=`<div class="bm3-step">${L('Boards per round')}</div><div class="bm3-keys k4">${[1,2,3,4,5,6,7,8].map(n=>`<button class="bm3-key${w.bpr===n?' active':''}" onclick="tdcSet1('bpr',${n})">${n}</button>`).join('')}</div>`;
  else if(w.step==='soc'){ ok=(+w.soc||0)>=1&&(+w.soc)<=99; body=`<div class="bm3-step">${L('Number of boards')}</div><div class="tdc-big">${w.soc||'—'}</div>${pad('soc')}`; }
  else if(w.step==='swr'){ const n=+w.swr||0; ok=n>=3&&n<=c.pc-1; body=`<div class="bm3-step">${L('Number of rounds')}</div><div class="tdc-big">${w.swr||'—'}</div>${ok?'':`<div class="bm3-note tdc-warn">3 – ${Math.max(3,c.pc-1)}</div>`}${pad('swr')}`; }
  else body=`<div class="bm3-step">${L('Create the tournament?')}</div><div class="bm3-sum"><div><span>${L('Movement')}</span><b>${L((MOVS.find(m=>m[0]===w.mov)||[])[1])}</b></div><div><span>${L('Players')}</span><b>${w.players}</b></div><div><span>${L('Tables')}</span><b>${c.tables}${c.ph?' + 👻':''}</b></div><div><span>${L('Rounds')}</span><b>${c.rounds}</b></div><div><span>${L('Boards')}</span><b>${c.total}${w.mov==='social'?'':' ('+w.bpr+' × '+c.rounds+')'}</b></div></div>`;
  frame(L('New tournament'),info+body,`<button class="bm3-cancel" onclick="tdcStep(-1)">‹ ${L('Back')}</button>`+(w.step==='ok'?`<button class="bm3-ok" onclick="tdcCreate()">🚀 ${L('Create')}</button>`:`<button class="bm3-ok" onclick="tdcStep(1)"${ok?'':' disabled'}>${L('Next')} ›</button>`));
}
// the same setup as the full panel's form: its boxes, filled in out of sight
window.tdcCreate=async function(){
  const w=TDC.w; if(!w) return;
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
function drawRun(){
  const s=getState(), B=getBoards(), A=getApprovals(), calls=_cache['tdcalls']||{}, thr=s.stallAlertMinutes||15;
  let tot=0,dn=0; const tiles=[];
  for(let t=1;t<=s.tableCount;t++){ const i=tableInfo(t,s,B,A,calls,thr); tot+=i.n; dn+=i.d;
    const st=i.call?'call':i.done?'done':i.slow?'slow':i.pend?'pend':'';
    tiles.push(`<button class="tdc-tile ${st}" onclick="tdcGo('table',{t:${t},r:${s.currentRound}})"><b>${t}</b><small>${i.call?'📣 TD':i.done?'✓':i.slow?'⚠️ '+i.d+'/'+i.n:i.d+'/'+i.n}</small><i>${num(i.m.ns)}–${num(i.m.ew)}</i></button>`); }
  const all=tot>0&&dn>=tot, last=s.currentRound>=s.roundCount, social=s.movement==='social';
  const sub=`<div class="tdc-round"><b>${L('Round')} ${s.currentRound} / ${s.roundCount}</b><span>${dn}/${tot} ${L('boards')}</span><div class="tdc-bar"><i style="width:${tot?Math.round(dn/tot*100):0}%"></i></div></div>`;
  const body=`<div class="tdc-tiles">${tiles.join('')}</div>
    <div class="tdc-legend"><span class="done">✓ ${L('Finished')}</span><span class="pend">⏳ ${L('Waiting for OK')}</span><span class="slow">⚠️ ${L('Slow')}</span><span class="call">📣 ${L('Calls the TD')}</span></div>
    <div class="tdc-tools"><button class="btn" onclick="ccMovementPage()">🔀 ${L('Movement')}</button><button class="btn" onclick="tdcScreen()">📺 ${L('Screen')}</button><button class="btn" onclick="bgShowPlayersLink()">🔗 ${L('Link')}</button><button class="btn" onclick="ccResultsPage()">📄 ${L('Results')}</button></div>${moreHtml()}`;
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

// ── one table: its round (‹ ›), its pairs, each board with ✏️ (the BridgeScore steps), not played, ADJ, delete ──
function drawTable(){
  const s=getState(), t=TDC.t; TDC.r=Math.max(1,Math.min(s.currentRound||1,TDC.r||s.currentRound||1));
  const r=TDC.r, m=getMovements()[r+'_'+t]||{}, B=getBoards(), A=getApprovals(), P=getPairs();
  const pn=id=>{ const p=P[id]; return p?(p.isPhantom?'👻':cleanData(splitPairName(p.name||'').filter(Boolean).join(' – ')||'—')):'—'; };
  let rows='';
  for(let b=m.boardStart||1;b<=(m.boardEnd||0);b++){
    const k=t+'_'+r+'_'+b, d=B[k], ap=A[k];
    rows+=`<div class="bm3-tdrow"><b onclick="tdcEdit('${k}')">${b}</b><span onclick="tdcEdit('${k}')">${d?cleanData(bmTdText(d)):ap?'⏳ '+cleanData(ap.contract||''):'—'} <i class="tdgo">✏️ ${L('Correct')}</i></span><div>
      <button onclick="tdcEdit('${k}')">✏️</button><button onclick="tdcNP('${k}')">${L('Not played')}</button><button onclick="tdcAdj('${k}',${b})">ADJ</button>${d||ap?`<button class="del" onclick="tdcDel('${k}',${b})">🗑</button>`:''}</div></div>`;
  }
  const calls=_cache['tdcalls']||{};
  const sub=`<div class="bm3-tdnav"><button onclick="tdcGo('table',{r:${r-1}})"${r>1?'':' disabled'}>‹</button><b>${L('Table')} ${t} · ${L('Round')} ${r}</b><span>NS ${num(m.ns)} ${pn(m.ns)}<br>EW ${num(m.ew)} ${pn(m.ew)}</span><button onclick="tdcGo('table',{r:${r+1}})"${r<s.currentRound?'':' disabled'}>›</button></div>
    ${calls[t]?`<div class="tdc-callrow">📣 ${L('This table calls the TD')} <button onclick="tdCallDone(${t})">✓ ${L('Answered')}</button></div>`:''}`;
  const body=`<div class="bm3-tdlist">${rows||`<div class="bm3-note">${L('No boards')}</div>`}</div>
    <div class="tdc-tools"><button class="btn" onclick="tdNames(${t},${r},'admin')">👥 ${L('Players')}</button>${r===s.currentRound?`<button class="btn" onclick="tdcFree(${t})">🚪 ${L('Free the table')}</button>`:''}</div>`;
  frame(L('Table')+' '+t,body,`<span></span><button class="bm3-ok" onclick="tdcGo('run',{t:null,r:null})">‹ ${L('All tables')}</button>`,sub);
}
window.tdcEdit=k=>{ adminEditBoard(k); };
window.tdcNP=k=>{ bmTdPut(k,{contract:'Not played',notPlayed:true,status:'done',td:true,time:new Date().toISOString()}); addLog('warn','TD: not played',k); tdcDraw(); };
window.tdcDel=async(k,b)=>{ if(!await confirmDialog(L('Delete this board result? It cannot be undone; the board is entered again.'),{title:L('Board')+' '+b,confirmLabel:L('Delete')})) return; bmTdPut(k,null); addLog('warn','TD: result deleted',k); tdcDraw(); };
window.tdcAdj=function(k,b){
  const o=v=>['A+','A','A-'].map(x=>`<option value="${x}"${x===v?' selected':''}>${x==='A+'?L('Average plus')+' (60%)':x==='A'?L('Average')+' (50%)':L('Average minus')+' (40%)'}</option>`).join('');
  openModal(L('Adjusted score')+' · '+L('Board')+' '+b,`<div class="field"><label>NS</label><select id="tdAdjNS">${o('A')}</select></div><div class="field"><label>EW</label><select id="tdAdjEW">${o('A')}</select></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">${L('Cancel')}</button><button class="btn btn-gold" onclick="tdcAdjOk('${k}')">OK</button>`);
};
window.tdcAdjOk=function(k){ const ns=document.getElementById('tdAdjNS').value, ew=document.getElementById('tdAdjEW').value; bmTdPut(k,{contract:`ADJ(${ns}/${ew})`,nsScore:ns,ewScore:ew,status:'done',adjusted:true,td:true,time:new Date().toISOString()}); addLog('warn','TD: adjusted score',k+' '+ns+'/'+ew); closeModal(); tdcDraw(); };
window.tdcFree=async t=>{ await adminKickTable(t); tdcDraw(); };
})();
