// the admin screen's refresh timer (it was used without being declared: starting a tournament stopped with an error)
var adminRefreshTimer=null;
//  ADMIN PANEL
// ══════════════════════════════════════════════════════
let adminTab='setup';

function renderAdminPanel(){
  const otq=new URLSearchParams(location.search).get('ot');
  if(otq&&!window._otOpened&&typeof OT!=='undefined'){ window._otOpened=1; adminTab='setup'; setupOnline=true; OT.edit=otq; }
  // the test page (Clubs → Test → Beykoz → Admin): only the online test with robots (cards played in BridgePlay)
  if(bgTestOn()){ document.getElementById('panelContent').innerHTML=`<div class="admin-wrap"><div id="adminContent">${typeof otTestCard==='function'?otTestCard():''}</div></div>`; return; }
  document.getElementById('panelContent').innerHTML=`
    <div class="admin-wrap">
      ${isSuper()?testBarHtml():''}
      <div class="admin-tabs">
        <button class="admin-tab" onclick="setAdminTab('setup',this)">⚙️ Setup</button>
        <button class="admin-tab" onclick="setAdminTab('players',this)">👥 Players</button>
        <button class="admin-tab" onclick="setAdminTab('movement',this)">🔄 Movement</button>
        <button class="admin-tab" onclick="setAdminTab('tables',this)">🃏 Tables</button>
        <button class="admin-tab" onclick="setAdminTab('boards',this)">📊 Boards</button>
        <button class="admin-tab" onclick="setAdminTab('history',this)">📜 History</button>
        <button class="admin-tab" onclick="setAdminTab('log',this)">📋 Log</button>
        <button class="admin-tab" onclick="clubLogoPick()">🎴 Logo</button>
      </div>
      <div id="adminContent"></div>
    </div>`;
  const tabs=document.querySelectorAll('.admin-tab');
  const idx=['setup','players','movement','tables','boards','history','log'].indexOf(adminTab);
  if(tabs[idx])tabs[idx].classList.add('active');
  renderAdminTab();
}
window.setAdminTab=function(tab,btn){
  adminTab=tab;
  document.querySelectorAll('.admin-tab').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active');
  renderAdminTab();
};
function renderAdminTab(){
  const c=document.getElementById('adminContent');if(!c)return;
  if(bgTestOn()){ c.innerHTML=typeof otTestCard==='function'?otTestCard():''; return; }   // the test page: the online test only
  // the online tournament's form being filled in is never drawn again: only the list of tournaments above it
  if(adminTab==='setup'&&typeof setupOnline!=='undefined'&&setupOnline&&document.getElementById('otFormBox')&&typeof OT!=='undefined'&&!OT.force){ otManageRefresh(); return; }
  if(typeof OT!=='undefined') OT.force=false;
  const ot=k=>typeof otTabSlot==='function'?otTabSlot(k):'';
  const m={setup:renderSetup,players:renderPlayersAdmin,movement:renderMovement,tables:()=>ot('tables')+renderTables(),boards:renderBoards,history:renderHistory,log:renderLog};
  const fin=getState().status==='finished';
  c.innerHTML=(fin?`<div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;"><b>🏁 <span>Tournament Finished</span></b><button class="btn btn-gold btn-sm" onclick="ccResultsPage()">📄 Results page</button></div>`:'')+(m[adminTab]||renderSetup)();
  if(adminTab==='setup') setTimeout(adminUpdateCalc, 0);
}

// ── the super admin's test tournament (opened as such from BridgePlay): the robots play it by themselves ──
function testBarHtml(){
  const L=v=>window.i18nText?i18nText(v):v;
  if(!bgTestOn()) return '';
  const s=getState(), mine=+(sessionStorage.getItem('bgTestMine:'+CLUB_ID)||0);
  return `<div class="card" style="border:2px dashed var(--gold);"><div class="card-title"><span>🧪</span> ${L('Test tournament')}</div>
    <div style="font-size:.8rem;color:var(--text2);margin-bottom:8px;">${L('Only you see it; the club\'s real tournament is not touched. The players\' names come from the TBF list; once the tournament starts the robots play every table by themselves, and each round starts when the last one ends.')}</div>
    ${s.status==='running'?`<div class="field"><label>${L('Sit at a table (the robots leave it to you)')}</label><div style="display:flex;flex-wrap:wrap;gap:6px;">${Array.from({length:s.tableCount||0},(_,i)=>`<button class="btn ${mine===i+1?'btn-gold':'btn-ghost'}" onclick="bgTestSit(${i+1})">🃏 ${i+1}</button>`).join('')}</div></div>`:''}
    ${s.status?`<button class="btn btn-ghost" onclick="bgTestDelete()">🗑 ${L('Delete the test tournament')}</button>`:`<div style="font-size:.8rem;color:var(--text3);">${L('No test tournament now.')}</div>`}</div>`;
}
window.bgTestMine=v=>{ try{ sessionStorage.setItem('bgTestMine:'+CLUB_ID,String(+v||0)); }catch(e){} };
// this device sits at a table of the test tournament, and comes back to the admin screen (no code: the director)
window.bgTestSit=function(n){
  bgTestMine(n); role='table'; window.bmCodeTable=n; bmTableNo=null;
  document.body.classList.add('bg-device'); const r=document.getElementById('topbarRole'); if(r) r.textContent=(window.i18nText?i18nText('Table'):'Table')+' '+n;
  renderPanel(); bgTestBack();
};
window.bgTestAdmin=function(){
  role='admin'; window.bmCodeTable=null; bmTableNo=null; if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
  document.body.classList.remove('bg-device'); const r=document.getElementById('topbarRole'); if(r) r.textContent='Admin';
  const b=document.getElementById('bgTestBack'); if(b) b.remove(); renderPanel();
};
function bgTestBack(){ if(document.getElementById('bgTestBack')) return; const b=document.createElement('button'); b.id='bgTestBack'; b.className='btn btn-gold'; b.style.cssText='position:fixed;right:10px;bottom:10px;z-index:50;'; b.textContent='⚙️ '+(window.i18nText?i18nText('Admin'):'Admin'); b.onclick=bgTestAdmin; document.body.appendChild(b); }
// the whole test tournament away (the club's real one is elsewhere)
window.bgTestDelete=async function(){
  if(!bgTestOn()) return;
  if(!await confirmDialog(window.i18nText?i18nText('Delete the test tournament?'):'Delete the test tournament?',{title:'🧪',confirmLabel:'🗑',danger:true})) return;
  // a delete the database refused is said, not shown as done
  try{ const r=await fetch(await fbUrl('.json'),{method:'DELETE'}); if(!r.ok) throw new Error(String(r.status)); }catch(e){ toast('❌ '+(window.i18nText?i18nText('Not deleted — please log in again'):'Not deleted — please log in again')); return; }
  for(const k of Object.keys(_cache)) delete _cache[k];
  try{ sessionStorage.removeItem('bgTestMine:'+CLUB_ID); }catch(e){}
  // the robots of another open page may have written once more: deleted again, then checked
  await new Promise(r=>setTimeout(r,3500));
  try{ const u=await fbUrl('/state.json'), r=await fetch(u,{cache:'no-store'}), v=r.ok?await r.json():null; if(v){ await fetch(await fbUrl('.json'),{method:'DELETE'}); } }catch(e){}
  for(const k of Object.keys(_cache)) delete _cache[k];
  toast('🗑 '+(window.i18nText?i18nText('No test tournament now.'):'No test tournament now.')); adminTab='setup'; renderAdminPanel();
};
// the pairs' names: two TBF members each (the whole list once)
let _tbfNames=null;
async function bgTestNames(){
  if(!_tbfNames){ try{ const r=await fetch(await fbRootUrl('/membersTbf.json')); const v=r.ok?await r.json():null; _tbfNames=Object.values(v||{}).filter(n=>typeof n==='string'&&n.trim()).map(n=>cleanData(n)); }catch(e){ _tbfNames=[]; } }
  const P=getPairs(), pool=_tbfNames.slice(); let i=0;
  const one=()=>pool.length?pool.splice(Math.floor(Math.random()*pool.length),1)[0]:(window.i18nText?i18nText('Test Player'):'Test Player')+' '+(++i);
  for(const p of Object.values(P)) if(!p.isPhantom) p.name=joinPairName(one(),one());
  setPairs(P); renderAdminPanel();
}
// a board's result at a table, as the robots would have it: the same contract at most tables (a board's own), now and
// then another, made exactly, with an overtrick or down one or two
function bgSimRnd(key){ let h=2166136261; for(const ch of key) h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0; return ()=>{ h=(h+0x6D2B79F5)>>>0; let t=h; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function bgSimResult(b,t,round){
  const CON=[[3,'NT'],[4,'♠'],[4,'♥'],[2,'♠'],[3,'♣'],[1,'NT'],[2,'♥'],[3,'♦'],[5,'♦'],[2,'NT'],[6,'♠'],[3,'NT'],[4,'♠']], D=['N','E','S','W'];
  const rb=bgSimRnd(CLUB_ID+':'+b), base=CON[Math.floor(rb()*CON.length)], decl=D[Math.floor(rb()*4)];
  const r=bgSimRnd(CLUB_ID+':'+b+':'+t+':'+round);
  let [level,suit]=r()<0.75?base:CON[Math.floor(r()*CON.length)]; let d=r()<0.85?decl:D[(D.indexOf(decl)+2)%4];
  let result=[0,0,0,1,1,-1,-1,2,-2][Math.floor(r()*9)]; result=Math.max(-(level+6),Math.min(7-level,result));
  const vuln=getVuln(b), nsScore=calcScore(level,suit,d,result,vuln,'');
  const ls=['♠','♥','♦','♣'][Math.floor(r()*4)], lr=['2','3','4','5','6','7','K','Q','J','10'][Math.floor(r()*10)];
  return {contract:level+suit+' '+d+(result>0?' +'+result:result===0?' =':' '+result),level,suit,declarer:d,result,doubled:'',lead:ls+lr,leadSuit:ls,leadRank:lr,vuln,nsScore,ewScore:-nsScore,adjusted:false,status:'done',time:new Date().toISOString(),sim:1};
}
// every few seconds: each robot table plays its next board of the round; a round played everywhere (my table too)
// starts the next one, the last one finishes the tournament
let _bgTestBusy=false;
async function bgTestTick(){
  if(_bgTestBusy||!CLUB_ID||!bgTestOn()) return;
  const s=_cache['state']; if(!s||s.status!=='running'||!s.currentRound) return;
  _bgTestBusy=true;
  try{
    // my table: the one this device sits at (kept when I go back to the admin screen), or the one chosen there
    if(typeof bmTableNo!=='undefined'&&bmTableNo) try{ sessionStorage.setItem('bgTestMine:'+CLUB_ID,String(+bmTableNo)); }catch(e){}
    // the scores as they are now (a table on another device may have entered one) and who sits where
    await Promise.all(['state','boards','approvals','tableLocks'].map(k=>DB.get(k)));
    if(!_cache['state']||_cache['state'].status!=='running'){ _bgTestBusy=false; return; }   // deleted meanwhile (here or on another device): nothing is written back
    const locks=_cache['tableLocks']||{}, aps=_cache['approvals']||{}, human=new Set();
    for(const v of Object.values(locks)) if(v&&v.tableNo) human.add(+v.tableNo);
    for(const [k,v] of Object.entries(_cache['boards']||{})) if(v&&!v.sim) human.add(+k.split('_')[0]);
    for(const k of Object.keys(aps)) human.add(+k.split('_')[0]);
    const mov=getMovements(), pairs=getPairs(), bs=getBoards(), mine=+(sessionStorage.getItem('bgTestMine:'+CLUB_ID)||0);
    if(!mine&&!human.size){ _bgTestBusy=false; return; }   // nobody sits yet: the tournament waits, as a real one
    let wrote=0, left=0;
    for(let t=1;t<=(s.tableCount||0);t++){
      const m=mov[s.currentRound+'_'+t]; if(!m) continue;
      if((pairs[m.ns]||{}).isPhantom||(pairs[m.ew]||{}).isPhantom) continue;
      for(let b=m.boardStart;b<=m.boardEnd;b++){
        const k=t+'_'+s.currentRound+'_'+b; if(bs[k]&&bs[k].status==='done') continue;
        left++;
        if(t!==mine&&!human.has(t)&&!wrote_t(t)&&Math.random()<0.2){ bs[k]=bgSimResult(b,t,s.currentRound); wroteT.add(t); wrote++; left--; }   // a board in about 15 seconds, as people play
      }
    }
    wroteT.clear();
    if(wrote){ setBoards(bs); if(typeof renderAdminTab==='function'&&document.getElementById('adminContent')) renderAdminTab(); }
    else if(!left){
      // the people at the tables have seen where they go next (OK at the round's end) before the round changes
      const ready=(await DB.get('ready'))||{}, seated=[...human].filter(t=>mov[s.currentRound+'_'+t]);
      if(seated.some(t=>!ready[s.currentRound+'_'+t])){ _bgTestBusy=false; return; }
      if(s.currentRound<s.roundCount){
        if(s.movement==='swiss'&&!mov[(s.currentRound+1)+'_1']){ try{ await maybeAdvanceSwissRound(); }catch(e){} }
        else { s.currentRound++; s._roundStartedAt=new Date().toISOString(); setState(s); addLog('ok','Round '+s.currentRound+' started','test'); toast('▶ '+(window.i18nText?i18nText('Round'):'Round')+' '+s.currentRound); refreshTopbar(); if(document.getElementById('adminContent')) renderAdminTab(); }
      }   // the last round played: the director finishes the tournament, as in a real one
    }
  }catch(e){}
  _bgTestBusy=false;
}
const wroteT=new Set(), wrote_t=t=>wroteT.has(t);
setInterval(bgTestTick,3000);
// ── Team Match helpers (2 teams, 2+ pairs per team) ──
function teamMatchPairCount(){
  const v=parseInt(document.getElementById('aTeamPairs')?.value||0);
  return isNaN(v)?0:v;
}
function teamMatchSettingsFromUI(){
  return {
    teamA:(document.getElementById('aTeamA')?.value||'Team A').trim()||'Team A',
    teamB:(document.getElementById('aTeamB')?.value||'Team B').trim()||'Team B',
    pairsPerTeam:teamMatchPairCount()
  };
}
/* A team match: N pairs a team (A: p1…pN, B: pN+1…p2N), played two tables at a time on the same boards (open and
   closed room). In each match of a round two A pairs and two B pairs play: at the first table A NS against B EW, at the
   second B NS against A EW — so team A holds every hand once, and the IMPs come from the two tables' scores of each board.
   N rounds; round r turns the B pairs by r, so each A pair meets each B pair once. With an odd N one pair of each team
   sits out each round (in turn). */
function generateTeamMatch(pairCount, boardsPerRound, teamAName, teamBName){
  const movements={}, pairs={}, N=pairCount;
  for(let i=1;i<=N;i++)pairs['p'+i]={id:'p'+i,name:'Pair '+i,dir:'',startTable:0,isPhantom:false,team:'A',teamName:teamAName,teamPair:i};
  for(let i=1;i<=N;i++){const id='p'+(N+i);pairs[id]={id,name:'Pair '+(N+i),dir:'',startTable:0,isPhantom:false,team:'B',teamName:teamBName,teamPair:i};}
  const active=N%2===0?N:N-1, rounds=N;
  for(let r=0;r<rounds;r++){
    const boardStart=r*boardsPerRound+1,boardEnd=boardStart+boardsPerRound-1;
    const sitA=N%2?(r%N)+1:null, sitB=N%2?((r+1)%N)+1:null;
    const A=Array.from({length:N},(_,i)=>i+1).filter(i=>i!==sitA), B0=Array.from({length:N},(_,i)=>i+1).filter(i=>i!==sitB);
    const B=B0.map((_,j)=>B0[(j+r)%active]);
    for(let m=0;m<active/2;m++){
      const a1='p'+A[2*m], a2='p'+A[2*m+1], b1='p'+(N+B[2*m]), b2='p'+(N+B[2*m+1]), t1=2*m+1, t2=2*m+2;
      const common={boardStart,boardEnd,teamMatch:true,matchId:'M'+(m+1),sitoutA:sitA,sitoutB:sitB};
      movements[(r+1)+'_'+t1]={...common,ns:a1,ew:b1,teamA:a1,teamB:b1,mirrorTable:t2};   // open room: A NS
      movements[(r+1)+'_'+t2]={...common,ns:b2,ew:a2,teamA:a2,teamB:b2,mirrorTable:t1};   // closed room: A EW
    }
  }
  return{movements,pairs,rounds,tableCount:active};
}

function calcTeamMatchIMP(){
  const s=getState();
  if(s.movement!=='team')return null;
  const boards=getBoards(), mv=getMovements();
  const rows=[];
  let totalA=0,totalB=0,impA=0,impB=0;
  for(let r=1;r<=s.roundCount;r++){
    for(let t=1;t<=s.tableCount;t+=2){
      const m1=mv[r+'_'+t], m2=mv[r+'_'+(t+1)];
      if(!m1||!m2)continue;
      let roundIMP=0,done=0;
      for(let b=m1.boardStart;b<=m1.boardEnd;b++){
        const d1=boards[t+'_'+r+'_'+b], d2=boards[(t+1)+'_'+r+'_'+b];
        if(!d1||!d2||d1.status!=='done'||d2.status!=='done'||typeof d1.nsScore!=='number'||typeof d2.nsScore!=='number')continue;
        // Team A is NS at table 1 and EW at table 2.
        const aScore=d1.nsScore-d2.nsScore;
        const imp=scoreToIMP(aScore);
        roundIMP+=imp; done++; if(imp>0) impA+=imp; else impB-=imp;
      }
      totalA+=roundIMP; totalB-=roundIMP;
      rows.push({round:r,match:m1.matchId||'',a:m1.teamA,b:m1.teamB,imp:roundIMP,done});
    }
  }
  return{rows,totalA,totalB,impA,impB};
}
function renderTeamMatchCard(){
  const s=getState();
  if(s.movement!=='team'||!s.teams)return'';
  const tm=calcTeamMatchIMP();
  const doneRows=(tm?.rows||[]).filter(x=>x.done>0);
  return`<div class="card">
    <div class="card-title"><span>🏆</span> Team Match — IMP</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
      <div style="flex:1;min-width:140px;padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);">
        <div style="font-size:.72rem;color:var(--text3);">${s.teams.A.name}</div>
        <div style="font-size:1.45rem;font-weight:800;color:var(--blue);">${tm?.impA||0} IMP</div>
      </div>
      <div style="flex:1;min-width:140px;padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);">
        <div style="font-size:.72rem;color:var(--text3);">${s.teams.B.name}</div>
        <div style="font-size:1.45rem;font-weight:800;color:var(--gold);">${tm?.impB||0} IMP</div>
      </div>
    </div>
    ${doneRows.length?`<div style="font-size:.76rem;color:var(--text2);">Completed match/round IMPs: ${doneRows.map(x=>`R${x.round} ${x.imp>=0?'+':''}${x.imp}`).join(' · ')}</div>`:'<div style="font-size:.76rem;color:var(--text3);">No complete two-table board comparison yet.</div>'}
  </div>`;
}

// the two teams' score for the results page and the screen: each team's IMPs, the team ahead lit
function teamScoreHtml(){
  const s=getState(); if(s.movement!=='team'||!s.teams) return '';
  const tm=calcTeamMatchIMP()||{impA:0,impB:0}, a=tm.impA||0, b=tm.impB||0;
  const box=(n,v,lead)=>`<div style="flex:1;min-width:130px;padding:12px 14px;border-radius:12px;background:${lead?'#1f5d36':'#f3f4f2'};color:${lead?'#fff':'#1b1b1b'};border:1px solid ${lead?'#174a2b':'#d9dee3'};text-align:center;"><div style="font-size:.85rem;font-weight:700;opacity:.85;">${cleanData(n)}</div><div style="font-size:1.8rem;font-weight:800;">${v} IMP</div></div>`;
  return `<div class="team-score" style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;">${box(s.teams.A.name,a,a>b)}${box(s.teams.B.name,b,b>a)}</div>`;
}
// ── Setup ──
function renderSetup(){
  if(bgTestOn()&&typeof setupOnline!=='undefined') setupOnline=false;   // the test tournament is played at the club (the BridgeScore): no online one from here
  // the numbers brought from the online setup (BridgeScore test): put in the form once, before a test tournament is set up
  if(bgTestOn()&&!window._bgPrefilled&&!(getState().tableCount>0)){ const q=new URLSearchParams(location.search); if(q.get('tp')){ window._bgPrefilled=1; setTimeout(()=>{ const set=(id,v)=>{ const e=document.getElementById(id); if(e&&v!=null&&v!=='') e.value=v; }; set('aPlayers',q.get('tp')); set('aBPR',q.get('tb')); if(['mitchell','howell','barometer','swiss'].includes(q.get('tm'))) set('aMovement',q.get('tm')); try{ adminUpdateCalc(); }catch(e){} },60); } }
  if(typeof setupOnline!=='undefined'&&setupOnline&&typeof otSetupCard==='function') return otSetupCard();
  const s=getState();
  const playerCount=parseInt(s._setupPlayers||0);
  const tableCount=playerCount>0?Math.floor(playerCount/4):0;
  const hasPhantom=playerCount>0&&playerCount%4!==0;
  const isTeam=s.movement==='team';
  const teamPairs=s._teamPairs||2;
  return(bgTestOn()&&typeof otTestCard==='function'?otTestCard():'')+`
  <div class="card">
    <div class="card-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${bgTestOn()?'<span>🧪</span> <span>Test tournament</span> · <span>Tournament Setup</span>':'<span>⚙️</span> Tournament Setup'}</div>
    <div class="field"><label>Tournament ID (auto)</label><input id="aName" value="${s.name||''}" readonly style="cursor:default;color:var(--text3);font-size:0.82rem;" placeholder="Assigned automatically when tournament is created"></div>
    <div class="field-row">
      <div class="field">
        <label>Number of Players</label>
        <input type="number" id="aPlayers" value="${isTeam?teamPairs*4:(s._setupPlayers||16)}" min="4" max="120" ${isTeam?'readonly':''} oninput="adminUpdateCalc()">
        <div style="font-size:0.72rem;color:var(--text3);margin-top:3px;" id="calcHint">→ ${isTeam?teamPairs+' pairs · 2 teams':tableCount+' tables'+(hasPhantom?' + 1 phantom':'')}</div>
      </div>
      <div class="field">
        <label>Boards per Round</label>
        <input type="number" id="aBPR" value="${s.movement==='social'?3:(s.boardsPerRound||3)}" min="1" max="8" oninput="adminUpdateCalc()">
        <div style="font-size:0.72rem;color:var(--text3);margin-top:3px;" id="bprHint"></div>
      </div>
    </div>
    <div class="field">
      <label>Movement</label>
      <select id="aMovement" onchange="adminUpdateCalc()">
        <option value="mitchell" ${s.movement==='mitchell'?'selected':''}>Mitchell — NS fixed, EW moves</option>
        <option value="howell" ${s.movement==='howell'?'selected':''}>Howell — all pairs move</option>
        <option value="barometer" ${s.movement==='barometer'?'selected':''}>Barometer — every table plays the same boards each round, then the pairs move</option>
        <option value="swiss" ${s.movement==='swiss'?'selected':''}>Swiss — pairings adapt to standings each round</option>
        <option value="social" ${s.movement==='social'?'selected':''}>Social Bridge — pairs stay at their table, each table plays any free board</option>
        <option value="team" ${isTeam?'selected':''}>Team Match — two teams, the same boards at two tables, IMP</option>
      </select>
      <div style="font-size:0.72rem;color:var(--text3);margin-top:3px;" id="movHint">${isTeam?'Team Match: 2 teams, 2 or more pairs per team, two-table mirrored boards and IMP scoring.':'Mitchell: NS fixed, EW moves; the boards go round the tables, so each table plays its own boards. Howell: everyone moves; the boards go round the tables too. Barometer: like Howell, but every round all the tables play the same boards at the same time (one copy of the boards per table). Swiss: the pairing is made again from the standings after every round; all the tables play the same boards. In Mitchell, Howell and Barometer the North-South pair of table 1 stays seated (e.g. for a player in a wheelchair).'}</div>
    </div>
    <div class="field" id="aTeamSettings" style="display:${isTeam?'block':'none'};">
      <label>Teams</label>
      <div class="field-row">
        <div class="field"><input type="text" id="aTeamA" maxlength="30" value="${(s._teamAName||'Team A').replace(/"/g,'&quot;')}" placeholder="Team A"></div>
        <div class="field"><input type="text" id="aTeamB" maxlength="30" value="${(s._teamBName||'Team B').replace(/"/g,'&quot;')}" placeholder="Team B"></div>
      </div>
      <label>Pairs per team</label>
      <input type="number" id="aTeamPairs" value="${teamPairs}" min="2" max="12" step="2" oninput="adminUpdateCalc()">
      <div style="font-size:0.72rem;color:var(--text3);margin-top:3px;">A classic match: 2 pairs per team (4 players each), open and closed room. Each pair meets each pair of the other team once; the result is in IMPs.</div>
    </div>
    <div class="field" id="aSocialField" style="display:${s.movement==='social'?'block':'none'};">
      <label>Number of boards</label>
      <input type="number" id="aSocBoards" value="${s.movement==='social'?(s.totalBoards||24):24}" min="1" max="99" oninput="adminUpdateCalc()">
      <div style="font-size:0.72rem;color:var(--text3);margin-top:3px;">Every pair stays at the same table in the same direction all evening. A table takes any board it has not played that no other table is playing, and plays it.</div>
    </div>
    <div class="field" id="aSwissRoundsField" style="display:${s.movement==='swiss'?'block':'none'};">
      <label>Number of Rounds (Swiss)</label>
      <input type="number" id="aSwissRounds" value="${s._setupSwissRounds||7}" min="3" max="20" oninput="adminUpdateCalc()">
      <div style="font-size:0.72rem;color:var(--text3);margin-top:3px;">Swiss note: v1 requires an even number of pairs (no bye/phantom support yet).</div>
    </div>
    <button class="btn btn-gold btn-full" onclick="adminSetup()" style="margin-bottom:6px;">🚀 Create Tournament</button>
  </div>
  ${renderTeamMatchCard()}
  <div class="card">
    <div class="card-title"><span>🎮</span> Round Control</div>
    ${(()=>{
      if(s.status!=='running')return '';
      const boards=getBoards();const movements=getMovements();
      let totalBoards=0,doneBoards=0;
      for(let t=1;t<=s.tableCount;t++){
        const m=movements[s.currentRound+'_'+t]||{};
        for(let b=m.boardStart||1;b<=(m.boardEnd||3);b++){
          totalBoards++;
          if(boards[t+'_'+s.currentRound+'_'+b]?.status==='done')doneBoards++;
        }
      }
      const allDone=totalBoards>0&&doneBoards>=totalBoards;
      if(allDone&&s.currentRound<s.roundCount)return`<div style="background:rgba(76,175,125,0.15);border:2px solid var(--green);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px;"><span style="font-size:1.5rem;">✅</span><div><div style="font-weight:700;color:var(--green);font-size:0.88rem;">All tables finished Round ${s.currentRound}!</div><div style="font-size:0.76rem;color:var(--text2);margin-top:2px;">${doneBoards}/${totalBoards} boards completed. You can start Round ${s.currentRound+1}.</div></div></div>`;
      if(allDone&&s.currentRound>=s.roundCount)return`<div style="background:rgba(201,168,76,0.15);border:2px solid var(--gold);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px;"><span style="font-size:1.5rem;">🏁</span><div><div style="font-weight:700;color:var(--gold);font-size:0.88rem;">Tournament finished!</div><div style="font-size:0.76rem;color:var(--text2);margin-top:2px;">All rounds are complete. You can finish the tournament.</div></div></div>`;
      return`<div style="font-size:0.78rem;color:var(--text2);margin-bottom:8px;">Round ${s.currentRound}: ${doneBoards}/${totalBoards} boards completed</div>`;
    })()}
    <div class="round-card"><div class="rc-head"><span class="rc-num">Round ${s.currentRound||0} / ${s.roundCount||0}</span><span class="rc-stat">${s.status==='running'?'🟢 Running':s.status==='setup'?'⏳ Setup':'🏁 Finished'} &nbsp;|&nbsp; ${scoringName(s)}</span></div><div class="round-progress"><div class="round-bar" style="width:${s.roundCount?(s.currentRound/s.roundCount*100):0}%"></div></div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
      ${s.online&&s.status==='running'?`<div style="font-size:0.78rem;color:var(--text2);">🌐 <span>Online evening: the rounds go on by themselves in BridgePlay.</span></div>`:''}
      ${!s.online&&s.status==='setup'&&s.roundCount>0?`<button class="btn btn-green btn-full" onclick="adminStart()">▶ Start Round 1</button>`:''}
      ${!s.online&&s.status==='running'&&s.currentRound<s.roundCount?`<button class="btn btn-gold" onclick="adminNextRound()">⏭ Next Round (${s.currentRound+1})</button>`:''}
      ${!s.online&&s.status==='running'&&s.currentRound>=s.roundCount?`<button class="btn btn-blue" onclick="adminFinish()">🏁 Finish Tournament</button>`:''}
    </div>
    ${s.status==='running'||s.status==='setup'?`<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);"></div><div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);"><div style="font-size:0.72rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">⚠️ Slow Table Alert</div><div style="font-size:0.72rem;color:var(--text2);margin-bottom:8px;">Beep + on-screen warning if a table hasn't entered a score in this many minutes.</div><div style="display:flex;gap:6px;align-items:center;"><input type="number" id="stallMinutesInput" value="${s.stallAlertMinutes||15}" min="1" max="120" style="width:80px;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);"><span style="font-size:0.76rem;color:var(--text2);">minutes</span><button class="btn btn-ghost btn-sm" onclick="saveStallMinutes()">Save</button></div></div>`:''}
  </div>
  <div class="card"><div class="card-title"><span>💾</span> Data</div><div style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn btn-blue" onclick="adminExport()">⬇ Export</button><button class="btn btn-purple" onclick="adminImportOpen()">⬆ Import</button><button class="btn btn-red" onclick="adminReset()">🗑 Reset</button></div></div>`;
}

window.adminUpdateCalc=function(){
  const mov=document.getElementById('aMovement')?.value||'mitchell';
  const bpr=parseInt(document.getElementById('aBPR')?.value||3);
  const swissField=document.getElementById('aSwissRoundsField');
  const teamField=document.getElementById('aTeamSettings');
  if(swissField)swissField.style.display=(mov==='swiss')?'block':'none';
  if(teamField)teamField.style.display=mov==='team'?'block':'none';
  { const mh=document.getElementById('movHint'); if(mh){ if(mh.dataset.gen==null) mh.dataset.gen=mh.textContent; const L=v=>window.i18nText?i18nText(v):v;
    mh.textContent=mov==='team'?L('Team Match: 2 teams, 2 or more pairs per team, two-table mirrored boards and IMP scoring.'):mh.dataset.gen; } }
  const socField=document.getElementById('aSocialField'); if(socField) socField.style.display=mov==='social'?'block':'none';
  const bprBox=document.getElementById('aBPR')?.closest('.field'); if(bprBox) bprBox.style.display=mov==='social'?'none':'';
  const playersEl=document.getElementById('aPlayers');
  let players=parseInt(playersEl?.value||0), rounds=0, tables=0;
  if(mov==='social'){
    if(playersEl)playersEl.readOnly=false;
    tables=Math.floor(players/4); rounds=1;
  }else if(mov==='team'){
    // two teams of N pairs: N rounds (each pair meets each of the other team once), tables two by two (open and closed room)
    const n=Math.max(2,Math.min(12,teamMatchPairCount()||2));
    players=n*4; if(playersEl){ playersEl.value=players; playersEl.readOnly=true; }
    tables=n%2?n-1:n; rounds=n;
  }else{
    if(playersEl)playersEl.readOnly=false;
    const phantom=players%4!==0;
    tables=Math.floor(players/4);
    const pairCount=tables*2+(phantom?1:0);
    if(mov==='mitchell')rounds=tables;
    else if(mov==='howell'||mov==='barometer')rounds=pairCount%2?pairCount:pairCount-1;   // an odd number of pairs: each pair sits out one round
    else rounds=parseInt(document.getElementById('aSwissRounds')?.value||7);
  }
  const totalBoards=mov==='social'?(parseInt(document.getElementById('aSocBoards')?.value)||0):rounds*bpr;
  const hint=document.getElementById('calcHint'), bprHint=document.getElementById('bprHint');
  if(hint)hint.textContent=mov==='team'?`→ 2 teams · ${players/4} pairs each · ${tables} tables${(players/4)%2?' · ⚠ an even number of pairs per team':''}`:mov==='social'?`→ ${tables} tables · ${tables*2} pairs`:`→ ${tables} table${tables!==1?'s':''}${players%4!==0?(mov==='howell'||mov==='barometer'?' + one pair sits out each round':' + phantom'):''}${mov==='barometer'||mov==='howell'&&(()=>{const pc=Math.floor(players/4)*2+(players%4!==0?1:0);return pc+pc%2;})()<=6?' · ⚠ every table plays the same boards each round: one copy of the boards per table':''}`;
  if(bprHint&&rounds>0)bprHint.textContent=`→ ${bpr} boards/round × ${rounds} rounds = ${totalBoards} total boards`;
  window._computedRounds=rounds;window._computedTotalBoards=totalBoards;
};

window.adminSetup=async function(){
  { const s0=getState(); if(s0.online&&s0.status==='running'&&!await confirmDialog(i18nText('An online evening is being played. Set up a tournament at the club anyway?'),{danger:true,title:'⚠️ '+i18nText('Are you sure?'),confirmLabel:i18nText('Yes'),cancelLabel:i18nText('Cancel')})) return; }
  const now=new Date();const pad=n=>String(n).padStart(2,'0');
  const autoName=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+' '+pad(now.getHours())+':'+pad(now.getMinutes());
  document.getElementById('aName').value=autoName;
  const name=autoName;
  const mov=document.getElementById('aMovement').value;
  const bpr=parseInt(document.getElementById('aBPR').value);
  let players=parseInt(document.getElementById('aPlayers').value),tables,phantom=false,pairCount,rounds,swissRounds;
  let result,teams=null;
  if(mov!=='social'&&(isNaN(bpr)||bpr<1||bpr>8)){toast('❌ Boards/round: 1-8');return;}
  if(mov==='social'){
    const nb=parseInt(document.getElementById('aSocBoards')?.value);
    if(isNaN(nb)||nb<1||nb>99){toast('❌ Boards: 1-99');return;}
    if(isNaN(players)||players<8||players%4!==0){toast('❌ Social Bridge: a number of players divisible by 4 (at least 8)');return;}
    tables=players/4; pairCount=tables*2; rounds=1;
    result={pairs:{},movements:{},rounds:1};
    for(let t=1;t<=tables;t++){ result.pairs['ns_'+t]={id:'ns_'+t,name:'NS '+t,dir:'NS',startTable:t,isPhantom:false}; result.pairs['ew_'+t]={id:'ew_'+t,name:'EW '+t,dir:'EW',startTable:t,isPhantom:false}; result.movements['1_'+t]={ns:'ns_'+t,ew:'ew_'+t,boardStart:1,boardEnd:nb,social:true}; }
    window._socialBoards=nb;
  }else if(mov==='team'){
    const tm=teamMatchSettingsFromUI();
    if(tm.pairsPerTeam<2||tm.pairsPerTeam>12||tm.pairsPerTeam%2){toast('❌ '+(window.i18nText?i18nText('Team Match: 2, 4, 6 … 12 pairs per team'):'Team Match: 2, 4, 6 … 12 pairs per team'));return;}
    players=tm.pairsPerTeam*4;pairCount=tm.pairsPerTeam*2;rounds=tm.pairsPerTeam;
    result=generateTeamMatch(tm.pairsPerTeam,bpr,tm.teamA,tm.teamB);
    tables=result.tableCount;
    teams={A:{id:'A',name:tm.teamA,pairs:Object.keys(result.pairs).filter(id=>result.pairs[id].team==='A')},B:{id:'B',name:tm.teamB,pairs:Object.keys(result.pairs).filter(id=>result.pairs[id].team==='B')}};
  }else{
    if(isNaN(players)||players<4){toast('❌ Min 4 players');return;}
    tables=Math.floor(players/4);phantom=players%4!==0;
    if(tables<2){toast('❌ Need at least 8 players (2 tables)');return;}
    pairCount=tables*2+(phantom?1:0);
    if(mov==='mitchell'){ const T=tables+(phantom?1:0); rounds=T%2?T:T-1; }   // an even number of tables: skip Mitchell, one round fewer
    else if(mov==='howell'||mov==='barometer')rounds=pairCount%2?pairCount:pairCount-1;
    else{swissRounds=parseInt(document.getElementById('aSwissRounds').value);if(isNaN(swissRounds)||swissRounds<3){toast('❌ Swiss: choose at least 3 rounds');return;}if(swissRounds>pairCount-1){toast(`❌ Swiss: max ${pairCount-1} rounds for ${pairCount} pairs`);return;}rounds=swissRounds;}
    const totalBoards=rounds*bpr;
    if(mov==='mitchell'){ result=generateMitchell(tables,bpr,phantom,totalBoards); tables=result.tableCount; rounds=result.rounds; }
    else if(mov==='howell'||mov==='barometer')result=generateHowell(tables,bpr,totalBoards,phantom,mov==='barometer');
    else result=generateSwissRound1(pairCount,bpr,rounds);
  }
  const totalBoards=mov==='social'?window._socialBoards:mov==='mitchell'&&result.totalBoards?result.totalBoards:rounds*bpr;
  // the last tournament's hands and double-dummy analysis go with it (they are kept in its archive); a tournament set up
  // again before it starts keeps the hand file already loaded for it
  if(getState().status&&getState().status!=='setup'){ _cache['hands']=[]; DB.set('hands',[]); _cache['dd']={}; DB.set('dd',{}); }
  setMovements(result.movements);setPairs(result.pairs);setBoards({});setApprovals({});
  setTableLocks({}); DB.set('ready',{}); DB.set('kicks',{}); DB.set('boardLocks',{});   // no table taken in a new tournament
  setLive(false);   // a new tournament is listed when it starts
  const s=getState();
  s.name=name;s.tableCount=tables;s.boardsPerRound=mov==='social'?totalBoards:bpr;s.totalBoards=totalBoards;s.roundCount=rounds;s.phantom=phantom;s.status='setup';s.currentRound=0;
  s.movement=mov;s.scoring=mov==='team'?'IMP':'BOTH';s._setupPlayers=players;s._setupSwissRounds=swissRounds||s._setupSwissRounds;
  if(mov==='team'){
    const tm=teamMatchSettingsFromUI();s.teams=teams;s._teamPairs=tm.pairsPerTeam;s._teamAName=tm.teamA;s._teamBName=tm.teamB;s._teamScoring='IMP';
  }else{delete s.teams;delete s._teamPairs;delete s._teamAName;delete s._teamBName;}
  setState(s);
  addLog('ok','Tournament created',`${players} players, ${tables} tables, ${result.rounds} rounds, ${mov}, ${scoringName(s)}`);
  toast('✅ Tournament created');
  adminTab='setup';refreshTopbar();renderAdminPanel();   // the names come from the tables after the start
  if(bgTestOn()) bgTestNames();
};

window.adminForceUnlock=function(tableNo){
  const s=getState();
  const locks=getTableLocks();
  delete locks[s.currentRound+'_'+tableNo];
  setTableLocks(locks);
  toast(`🔓 Table ${tableNo} unlocked`);
  renderAdminTab();
};
window.adminStart=async function(){
  const s=getState();if(s.status!=='setup'){toast('Already started');return;}
  s._startedAt=new Date().toISOString();
  // the names come from the tables (each table enters its players), so the tournament starts without them
  s.currentRound=1;s.status='running';s._roundStartedAt=new Date().toISOString();setState(s);
  await Promise.all([DB.set('tableLocks',{}),DB.set('approvals',{}),DB.del('kicks'),DB.del('tdcalls')]);
  setLive(true);
  addLog('ok','Round 1 started','Tournament begins');
  toast('▶ Round 1 started!');refreshTopbar();renderAdminTab();
  adminSetupAutoRefresh();

};
window.saveStallMinutes=function(){
  const v=parseInt(document.getElementById('stallMinutesInput').value);
  if(isNaN(v)||v<1){toast('❌ Enter a valid number of minutes');return;}
  const s=getState();s.stallAlertMinutes=v;setState(s);
  toast('✅ Alert threshold set to '+v+' min');
};
/* after the start: the players get BridgePlay's link (with this club and its table code prefix); there they tap
   Table No, type their member numbers or names and choose their table */
// the players get only BridgePlay's address: Table No there finds this tournament in the list of running ones
const playersLink=async()=>location.origin+location.pathname.replace(/(bridgegate|kulupler)\/[^/]*$/,'');
// the running tournament in that list (gate/live/<club>): its name, the club, the tables and the table code prefix
async function setLive(on){
  if(bgTestOn()) return;   // a test tournament is never listed
  try{
    const s=getState(), url=await fbRootUrl('/live/'+CLUB_ID+'.json');
    const p=await getTablePrefix();
    // the tables' codes go with it: a player's phone signs in at the table chosen without typing one
    if(on){ try{ await saveTablePrefix(p); }catch(e){} let k={}; try{ k=tableKeys(await makeTableCodes(s.tableCount||0)); }catch(e){} await fetch(url,{method:'PUT',body:JSON.stringify({n:String(s.name||'').slice(0,40),c:String(CLUB_NAME||'').slice(0,40),tb:s.tableCount||0,p,ts:Date.now(),k})}); }
    else await fetch(url,{method:'DELETE'});
  }catch(e){}
}
// this tournament's link for the players: BridgePlay opens this club's running tournament, its free tables only
// (the players can also find it under Clubs)
window.bgShowPlayersLink=async function(){
  const L=window.i18nText?i18nText:x=>x, p=await getTablePrefix();
  const link=location.origin+location.pathname.replace(/kulupler\/[^/]*$/,'')+'?kulup='+encodeURIComponent('?club='+CLUB_ID+'&role=table&p='+p);
  const msg=encodeURIComponent('🃏 '+(CLUB_NAME||'')+(getState().name?' — '+getState().name:'')+'\n'+link);
  openModal('🔗 '+L('The players’ link'),`<div style="font-size:0.85rem;color:var(--text2);margin-bottom:10px;">${L('It opens this tournament’s tables only: each player taps their table. They can also find it in BridgePlay under Clubs.')}</div>
    <input readonly value="${link}" onclick="this.select()" style="width:100%;font-size:0.76rem;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text2);box-sizing:border-box;">
    <div style="display:flex;gap:8px;margin-top:10px;"><a class="btn btn-full" style="background:#25d366;color:#fff;text-decoration:none;text-align:center;" href="https://wa.me/?text=${msg}" target="_blank" rel="noopener">WhatsApp</a><a class="btn btn-full btn-ghost" style="text-decoration:none;text-align:center;" href="sms:?&body=${msg}">SMS</a><button class="btn btn-full btn-ghost" onclick="navigator.clipboard&&navigator.clipboard.writeText('${link}').then(()=>toast('📋'))">📋 ${L('Copy')}</button></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">${L('Close')}</button>`);
};
// the tables' codes: each table's own; the admin gives each table its code (a player types it after choosing the table)
// table number → code (the running tournament's entry carries them)
const tableKeys=codes=>{ const k={}; for(const [c,t] of Object.entries(codes||{})) k['t'+t]=c; return k; };
async function liveCodes(codes){ if(getState().status!=='running'||bgTestOn()) return; try{ await fetch(await fbRootUrl('/live/'+CLUB_ID+'.json'),{method:'PATCH',body:JSON.stringify({k:tableKeys(codes)})}); }catch(e){} }
window.showTableCodes=async function(fresh){
  if(bgTestOn()){ toast(i18nText('Not in test mode: the table codes are the club\'s real ones')); return; }
  const s=getState(), n=s.tableCount||0;
  if(!n){ toast(i18nText('Set up the tournament first')); return; }
  let codes={};
  try{ codes=await makeTableCodes(n,!!fresh); }catch(e){ toast('❌ '+e.message); return; }
  if(fresh) liveCodes(codes);
  const byT={}; for(const [c,t] of Object.entries(codes)) byT[t]=c;
  openModal('Table codes',`<div style="font-size:0.85rem;color:var(--text2);margin-bottom:10px;">Type each table's code (4 digits, all different) and save: the players choose their table and type it.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;">${Array.from({length:n},(_,i)=>`<label class="card" style="margin:0;text-align:center;padding:10px;"><div style="font-size:0.75rem;color:var(--text3);">${i18nText('Table')} ${i+1}</div><input class="tcode-in" data-t="${i+1}" value="${byT[i+1]||''}" inputmode="numeric" maxlength="4" autocomplete="off" style="width:100%;box-sizing:border-box;font-size:1.5rem;font-weight:800;letter-spacing:3px;text-align:center;padding:6px;border-radius:8px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);"></label>`).join('')}</div>
    <div class="login-err" id="tcodeErr"></div>`,
    `<button class="btn btn-ghost" onclick="confirmDialog(i18nText('New codes for every table?'),{danger:false,title:'⚠️ '+i18nText('Are you sure?'),confirmLabel:i18nText('Yes'),cancelLabel:i18nText('Cancel')}).then(ok=>showTableCodes(ok))">🎲 New codes</button><button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-gold" onclick="saveTableCodes()">Save</button>`);
};
// the codes typed: 4 digits each, all different
window.saveTableCodes=async function(){
  const err=document.getElementById('tcodeErr'), codes={};
  for(const i of document.querySelectorAll('.tcode-in')){
    const c=i.value.trim(), t=+i.dataset.t;
    if(!/^\d{4}$/.test(c)){ err.textContent='❌ '+i18nText('Table')+' '+t+': '+i18nText('4 digits'); i.focus(); return; }
    if(codes[c]){ err.textContent='❌ '+i18nText('Table')+' '+t+': '+i18nText('the same code as table')+' '+codes[c]; i.focus(); return; }
    codes[c]=t;
  }
  try{ const r=await fetch(await fbRootUrl('/clubs/'+CLUB_ID+'/secret/tcodes.json'),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(codes)}); if(!r.ok) throw new Error('Firebase '+r.status); liveCodes(codes); closeModal(); toast('🔑 '+i18nText('Table codes saved')); }
  catch(e){ err.textContent='❌ '+e.message; }
};
window.adminNextRound=function(){
  const s=getState();
  if(s.currentRound>=s.roundCount){toast('Last round!');return;}
  if(s.movement==='swiss'){
    const nextR=s.currentRound+1;
    if(!getMovements()[nextR+'_1']){
      toast('⏳ Swiss pairing for the next round isn\'t ready yet — waiting for all tables to finish.');
      return;
    }
  }
  s.currentRound++;s._roundStartedAt=new Date().toISOString();setState(s);
  addLog('ok','Round '+s.currentRound+' started','');
  toast('▶ Round '+s.currentRound+' started!');refreshTopbar();renderAdminTab();
};

// Simple beep using Web Audio API — no audio file needed.
let _audioCtx=null;
function playAlertBeep(){
  try{
    if(!_audioCtx)_audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    const ctx=_audioCtx;
    [0,0.18].forEach(delay=>{
      const osc=ctx.createOscillator();const gain=ctx.createGain();
      osc.type='sine';osc.frequency.value=880;
      gain.gain.setValueAtTime(0,ctx.currentTime+delay);
      gain.gain.linearRampToValueAtTime(0.25,ctx.currentTime+delay+0.02);
      gain.gain.linearRampToValueAtTime(0,ctx.currentTime+delay+0.15);
      osc.connect(gain);gain.connect(ctx.destination);
      osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+0.16);
    });
  }catch(e){ /* audio not available — visual badge still shows */ }
}

let _stalledTablesAlerted={}; // key: `${round}_${table}` -> true once beeped
let _stalledBannerDismissed=false;
function checkStalledTables(){ return;   // the slow-table warning is gone (asked by the clubs)
}
function checkStalledTablesOld(){
  const s=getState();
  if(s.status!=='running'||!s.tableCount)return;
  const thresholdMin=s.stallAlertMinutes||15;
  const boards=getBoards();
  const movements=getMovements();
  const roundStart=s._roundStartedAt?new Date(s._roundStartedAt).getTime():Date.now();
  const now=Date.now();
  const stalled=[];
  let hasNew=false;
  for(let t=1;t<=s.tableCount;t++){
    const m=movements[s.currentRound+'_'+t]||{};
    let lastActivity=roundStart;
    let allDone=true,anyBoard=false;
    for(let b=m.boardStart||1;b<=(m.boardEnd||3);b++){
      anyBoard=true;
      const bd=boards[t+'_'+s.currentRound+'_'+b];
      if(bd?.status==='done'&&bd.time){
        const bt=new Date(bd.time).getTime();
        if(bt>lastActivity)lastActivity=bt;
      } else allDone=false;
    }
    if(!anyBoard||allDone)continue; // nothing assigned yet, or table already finished
    const elapsedMin=(now-lastActivity)/60000;
    if(elapsedMin>=thresholdMin){
      stalled.push({table:t,elapsedMin});
      const key=s.currentRound+'_'+t;
      if(!_stalledTablesAlerted[key]){
        _stalledTablesAlerted[key]=true;
        playAlertBeep();
        hasNew=true;
      }
    }
  }
  if(hasNew)_stalledBannerDismissed=false;
  updateStalledBanner(stalled);
  return stalled;
}

function updateStalledBanner(stalled){
  let el=document.getElementById('stalledTableAlert');
  if(!stalled||stalled.length===0){
    if(el)el.remove();
    return;
  }
  if(_stalledBannerDismissed){ if(el)el.remove(); return; }
  if(!el){
    el=document.createElement('div');
    el.id='stalledTableAlert';
    el.style.cssText='position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:8999;max-width:380px;width:90%;background:var(--surface);border:2px solid var(--red);border-radius:var(--radius);padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
    document.body.appendChild(el);
  }
  const lines=stalled.map(x=>`Table ${x.table} — ${Math.floor(x.elapsedMin)} min without a score`).join('<br>');
  el.innerHTML=`
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:1.6rem;">⚠️</span>
      <div style="flex:1;">
        <div style="font-weight:700;color:var(--red);font-size:0.86rem;margin-bottom:4px;">Slow Table${stalled.length>1?'s':''}</div>
        <div style="font-size:0.76rem;color:var(--text2);line-height:1.5;">${lines}</div>
      </div>
      <button onclick="_stalledBannerDismissed=true;document.getElementById('stalledTableAlert')?.remove();" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:1rem;">✕</button>
    </div>`;
}


// the TD is typing in the setup form (a box or a list has the focus): it is not drawn again now
function setupBusy(){ const a=document.activeElement, c=document.getElementById('adminContent'); return !!(a&&c&&c.contains(a)&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)); }
function adminSetupAutoRefresh(){
  if(adminRefreshTimer)clearInterval(adminRefreshTimer);
  adminRefreshTimer=setInterval(()=>{
    if(role==='admin'){
      if(adminTab==='setup'&&getState().status==='running'&&!setupBusy()){ const c=document.getElementById('adminContent'); if(c)c.innerHTML=renderSetup(); }
      checkRoundComplete();
    }
  },4000);
}

let _lastRoundCompleteNotified = -1;
function checkRoundComplete(){
  const s = getState();
  if(s.status !== 'running' || s.online) return;   // an online evening: BridgePlay moves the rounds
  checkStalledTables();
  const boards = getBoards();
  const movements = getMovements();
  let total=0, done=0;
  for(let t=1;t<=s.tableCount;t++){
    const m = movements[s.currentRound+'_'+t]||{};
    for(let b=m.boardStart||1;b<=(m.boardEnd||3);b++){
      total++;
      if(boards[t+'_'+s.currentRound+'_'+b]?.status==='done') done++;
    }
  }
  const allDone = total>0 && done>=total;
  if(allDone && s.movement==='swiss'){
    maybeAdvanceSwissRound(); // idempotent — safe to call repeatedly
  }
  // the round played everywhere: the next one starts by itself; the director is asked only to finish the last
  if(!bgTestOn() && s.currentRound<s.roundCount) bgAutoNextRound();
  if(allDone && _lastRoundCompleteNotified !== s.currentRound && !bgTestOn() && s.currentRound>=s.roundCount){
    _lastRoundCompleteNotified = s.currentRound;
    showRoundCompleteAlert(s.currentRound, s.roundCount, done, total);
  }
}

function showRoundCompleteAlert(round, totalRounds, done, total){
  // Play a beep
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    [440,550,660].forEach((f,i)=>{
      const o=ctx.createOscillator(); const g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value=f; g.gain.setValueAtTime(0.3,ctx.currentTime+i*0.15);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.15+0.25);
      o.start(ctx.currentTime+i*0.15); o.stop(ctx.currentTime+i*0.15+0.3);
    });
  }catch(e){}

  const isLast = round >= totalRounds;
  const el = document.getElementById('roundCompleteAlert');
  if(el) el.remove();

  const div = document.createElement('div');
  div.id = 'roundCompleteAlert';
  div.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:9000;max-width:380px;width:90%;background:var(--surface);border:2px solid var(--green);border-radius:var(--radius);padding:16px 18px;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:fadeUp 0.3s ease;';
  div.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;">
      <span style="font-size:2rem;">${isLast?'🏁':'✅'}</span>
      <div style="flex:1;">
        <div style="font-weight:700;color:var(--green);font-size:0.95rem;margin-bottom:4px;">
          ${isLast ? 'Tournament Complete!' : `Round ${round} Complete!`}
        </div>
        <div style="font-size:0.78rem;color:var(--text2);margin-bottom:12px;">
          ${done}/${total} boards done${isLast?'. All rounds finished!':'. Ready for Round '+(round+1)+'.'}
        </div>
        <div style="display:flex;gap:8px;">
          ${isLast
            ? `<button class="btn btn-blue btn-sm" onclick="adminFinish();document.getElementById('roundCompleteAlert')?.remove()">🏁 Finish Tournament</button>`
            : `<button class="btn btn-green btn-sm" onclick="adminNextRound();document.getElementById('roundCompleteAlert')?.remove()">▶ Start Round ${round+1}</button>`}
          <button class="btn btn-ghost btn-sm" onclick="this.closest('#roundCompleteAlert').remove()">Dismiss</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(div);
  // Auto-dismiss after 30s
  setTimeout(()=>div.remove(), 30000);
}
window.adminFinish=async function(){
  if(!await confirmDialog('Finish tournament and archive results?',{title:'Finish Tournament',confirmLabel:'Finish',danger:false}))return;
  const s=getState();
  s.status='finished';
  s._finishedAt=new Date().toISOString();
  setState(s);
  setLive(false);
  setTableLocks({});   // the tables are free again
  const arc=await archivesFresh();   // the newest copy: an older one could bring deleted tournaments back
  arc.unshift({state:{...s},boards:getBoards(),pairs:getPairs(),movements:getMovements(),hands:_cache['hands']||[],dd:_cache['dd']||{},finished:s._finishedAt});
  setArchives(arc);
  addLog('ok','Tournament finished & archived','');
  toast('🏁 Tournament finished!');
  renderAdminTab();
  showFinalScoreboard();
};
function showFinalScoreboard(){
  const s=getState();
  const mpData=calcMP();
  const pairs=getPairs();
  const rows=Object.keys(pairs).filter(k=>!pairs[k].isPhantom).map(k=>{
    const p=pairs[k];
    const mp=mpData[k]||{mp:0,top:0,imp:0};
    const pct=mp.top>0?parseFloat((mp.mp/mp.top*100).toFixed(1)):0;
    return{id:k,name:p.name||k,mp:mp.mp,top:mp.top,pct,imp:mp.imp||0};
  }).sort((a,b)=>scoringShows().byImp?b.imp-a.imp:b.pct-a.pct);
  const sh=scoringShows();
  if(!rows.length)return;
  const startedAt=s._startedAt?new Date(s._startedAt):null;
  const finishedAt=s._finishedAt?new Date(s._finishedAt):null;
  const dur=startedAt&&finishedAt?Math.round((finishedAt-startedAt)/60000):null;
  openModal('🏁 Tournament Complete',`
    <div style="text-align:center;margin-bottom:16px;">
      <div style="font-size:2.5rem;margin-bottom:6px;">🏆</div>
      <div style="font-size:1.1rem;font-weight:700;color:var(--gold);">${s.name}</div>
      ${dur?`<div style="font-size:0.78rem;color:var(--text3);margin-top:4px;">Duration: ${Math.floor(dur/60)}h ${dur%60}m</div>`:''}
    </div>
    <table class="mv-table" style="margin-bottom:12px;">
      <thead><tr><th>#</th><th>Pair</th>${sh.mp?'<th>MP</th><th>%</th>':''}${sh.imp?'<th>IMP</th>':''}</tr></thead>
      <tbody>${rows.map((r,i)=>{
        const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
        const col=r.pct>=60?'var(--green)':r.pct>=45?'var(--gold)':'var(--red)';
        return`<tr>
          <td>${medal||i+1}</td>
          <td style="font-weight:${i<3?700:400};">${r.name}</td>
          ${sh.mp?`<td style="color:var(--text2);">${r.mp}/${r.top}</td>
          <td style="font-weight:700;color:${col};">${r.pct}%</td>`:''}${sh.imp?`<td style="font-weight:700;">${fmtImp(r.imp)}</td>`:''}
        </tr>`;
      }).join('')}</tbody>
    </table>`,
    `<button class="btn btn-gold" onclick="closeModal();ccResultsPage()">📄 Results page</button><button class="btn btn-blue" onclick="adminExport();closeModal()">⬇ Export Results</button>
     <button class="btn btn-ghost" onclick="closeModal()">Close</button>`);
}
window.adminExport=function(){
  const data={state:getState(),pairs:getPairs(),boards:getBoards(),movements:getMovements(),logs:getLogs()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='bridgescore_'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);
  toast('✅ Exported');
};
window.adminImportOpen=function(){
  openModal('Import Data',`
    <p style="font-size:0.82rem;color:var(--text2);margin-bottom:12px;">Import a previously exported JSON file.</p>
    <div class="import-drop" onclick="document.getElementById('impFile').click()">
      <div style="font-size:2rem;margin-bottom:6px;">📂</div>
      <div style="font-weight:600;">Choose JSON File</div>
      <input type="file" id="impFile" accept=".json" onchange="adminImportFile(this)" style="display:none;">
    </div>
    <div class="field"><label>Or paste JSON:</label><textarea id="impJson" rows="4" placeholder='{"state":...}'></textarea></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-purple" onclick="adminImportJson()">Import</button>`);
};
window.adminImportFile=function(inp){
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();r.onload=e=>{try{applyImport(JSON.parse(e.target.result));}catch{toast('❌ Invalid JSON');}};r.readAsText(f);
};
window.adminImportJson=function(){
  const raw=document.getElementById('impJson').value.trim();
  if(!raw){toast('❌ Paste JSON first');return;}
  try{applyImport(JSON.parse(raw));}catch{toast('❌ Invalid JSON');}
};
function applyImport(data){
  if(!data.state){toast('❌ Invalid file');return;}
  if(data.state)setState(data.state);if(data.pairs)setPairs(data.pairs);
  if(data.boards)setBoards(data.boards);if(data.movements)setMovements(data.movements);
  addLog('ok','Data imported','');closeModal();toast('✅ Imported!');refreshTopbar();renderAdminTab();
}
window.adminReset=async function(){
  if(!await confirmDialog('DELETE ALL DATA?\n\nThis will erase the current tournament.\nPlayer Registry will NOT be deleted.\n\nContinue?',{title:'Reset Tournament',confirmLabel:'Delete Everything'}))return;
  // Offer player data backup before reset
  const players=PlayerDB.getAll();
  if(players.length>0){
    if(await confirmDialog(`Export ${players.length} players to backup file before reset?`,{title:'Backup Players?',confirmLabel:'Export',danger:false})){
      PlayerDB.export();
      await new Promise(r=>setTimeout(r,500));
    }
  }
  await Promise.all(['state','pairs','boards','movements','logs','approvals','hands','dd'].map(k=>DB.del(k)));
  setLive(false);
  Object.keys(_cache).filter(k=>k!=='playerdb').forEach(k=>delete _cache[k]);
  toast('🗑 Reset complete — Player Registry preserved');refreshTopbar();renderAdminTab();
};

// ── Player Database (shared via Firebase — all devices see same name pool) ──
const PlayerDB = {
  getAll(){ return _cache['playerdb'] || []; },
  save(names){
    const db = this.getAll().slice();
    let changed = false;
    names.forEach(n=>{
      n = (n||'').trim();
      if(!n || n.length<2) return;
      // Case-insensitive duplicate check
      const exists = db.some(existing => existing.toLowerCase()===n.toLowerCase());
      if(!exists){ db.unshift(n); changed = true; }
    });
    if(db.length>300) db.splice(300);
    if(changed){ _cache['playerdb'] = db; DB.set('playerdb', db); }
  },
  export(){
    const data = { exported: new Date().toISOString(), players: this.getAll() };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'bridgescore-players-'+new Date().toISOString().slice(0,10)+'.json';
    a.click();
  },
  import(json){
    try{
      const data = JSON.parse(json);
      const names = Array.isArray(data) ? data : (data.players||[]);
      this.save(names);
      return names.length;
    } catch(e){ return 0; }
  },
  clear(){ _cache['playerdb'] = []; DB.set('playerdb', []); }
};

// Save names from pairs to PlayerDB
function syncNamesToPlayerDB(){
  const pairs = getPairs();
  const names = [];
  Object.values(pairs).forEach(p=>{
    if(p.isPhantom||!p.name)return;
    const [p1,p2] = splitPairName(p.name);
    if(p1)names.push(p1);
    if(p2)names.push(p2);
  });
  PlayerDB.save(names);
}

// ── Players Admin ──
function splitPairName(name){
  if(!name)return['',''];
  // Treat default placeholder names as blank
  if(/^(NS|EW|Pair)\s*\d+$/.test(name.trim()))return['',''];
  const parts=name.split(' & ');
  return[parts[0]||'',parts[1]||''];
}
function joinPairName(p1,p2){
  const a=(p1||'').trim();const b=(p2||'').trim();
  if(a&&b)return a+' & '+b;
  return a||b||'';
}

function renderPlayersAdmin(){
  const pairs=getPairs();
  const keys=Object.keys(pairs).filter(k=>!pairs[k].isPhantom);
  if(!keys.length)return`<div class="empty-state"><div class="empty-icon">👥</div>Create tournament first to manage players.</div>`;
  const ns=keys.filter(k=>k.startsWith('ns_')).sort((a,b)=>parseInt(a.split('_')[1])-parseInt(b.split('_')[1]));
  const ew=keys.filter(k=>k.startsWith('ew_')).sort((a,b)=>parseInt(a.split('_')[1])-parseInt(b.split('_')[1]));
  const pw=keys.filter(k=>k.startsWith('p')&&!k.startsWith('phantom')).sort((a,b)=>parseInt(a.slice(1))-parseInt(b.slice(1)));
  const allKeys=[...ns,...ew,...pw];

  const dirLabel=k=>{const p=pairs[k];if(p?.team)return `${p.team==='A'?'Team A':'Team B'} · Pair ${p.teamPair||k.slice(1)}`;return k.startsWith('ns_')?`NS ${k.split('_')[1]}`:k.startsWith('ew_')?`EW ${k.split('_')[1]}`:`Pair ${k.slice(1)}`;};
  const dirColor=k=>pairs[k]?.team==='A'?'var(--blue)':pairs[k]?.team==='B'?'var(--gold)':k.startsWith('ns_')?'var(--blue)':k.startsWith('ew_')?'var(--gold)':'var(--text3)';

  // the names come from the tables: the players enter them (member number or name) when they sit down
  const mkRow=k=>{
    const [p1,p2]=splitPairName(pairs[k].name);
    return`<div class="card" style="margin-bottom:6px;padding:10px 14px;display:flex;gap:12px;align-items:center;">
      <span style="font-size:0.72rem;font-weight:700;color:${dirColor(k)};min-width:70px;">${dirLabel(k)}</span>
      <span style="font-size:0.88rem;">${p1||p2?[p1,p2].filter(Boolean).join(' & '):'<span style="color:var(--text3);">—</span>'}</span>
    </div>`;};

  return`
    <div style="font-size:0.82rem;color:var(--text2);margin-bottom:4px;">${allKeys.length} pairs · ${allKeys.length*2} players</div>
    <div style="font-size:0.75rem;color:var(--text3);margin-bottom:12px;">The names come from the tables: the players enter them when they sit down.</div>

    ${allKeys.map(mkRow).join('')}

    <div class="card">
      <div class="card-title"><span>📂</span> Board File Upload</div>
      <p style="font-size:0.8rem;color:var(--text2);margin-bottom:8px;">Load the boards dealt for this session: the file of your dealing machine (Duplimate BRI / DUP, Dealer4 / Dealmaster DLM, DGE) or a PBN / LIN file, as it is — no converting.</p>
      <div class="import-drop" onclick="document.getElementById('handsFile0').click()" ondragover="event.preventDefault()" ondrop="event.preventDefault();const f=event.dataTransfer.files[0];if(f){const i=document.getElementById('handsFile0');const d=new DataTransfer();d.items.add(f);i.files=d.files;adminLoadHandsFile(i);}">
        <div style="font-size:2rem;">🃏</div><div style="font-weight:600;">Select or drop the hand file</div><div style="font-size:0.72rem;color:var(--text3);">BRI · DUP · DLM · DGE · PBN · LIN</div>
        <input type="file" id="handsFile0" accept=".bri,.dup,.dlm,.dge,.pbn,.lin,.txt" onchange="adminLoadHandsFile(this)" style="display:none;">
      </div>
      <div class="login-err" id="handsErr"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
        <button class="btn btn-ghost btn-sm" onclick="adminImportHandsOpen()">📋 Paste PBN / LIN</button>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('boardFile').click()">📄 Results backup (JSON)</button>
        <button class="btn btn-ghost btn-sm" onclick="toast('Continuing without a board file...')">▶ Skip</button>
        <input type="file" id="boardFile" accept=".json" onchange="adminLoadBoardsFile(this)" style="display:none;">
      </div>
    </div>`;
}


/* The club's logo: a playing card the club's admin picks (rank + suit, e.g. "AS", "TH"); BridgePlay's Clubs page shows
   it before the club's name. Kept in the club's own data (gate/clubs/<id>/bm/logo), which the club's admin may write. */
const LOGO_SU={S:'♠',H:'♥',D:'♦',C:'♣'}, LOGO_RK='AKQJT98765432';
const LOGO_IMG=/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/;
function clubLogoHtml(code){
  if(LOGO_IMG.test(code||'')) return `<img class="clogo clogo-img" src="${code}" alt="">`;
  if(!/^[AKQJT2-9][SHDC]$/.test(code||'')) return '';
  const r=code[0]==='T'?'10':code[0], red=code[1]==='H'||code[1]==='D';
  return `<span class="clogo${red?' r':''}"><span class="cr">${r}</span><span class="cs">${LOGO_SU[code[1]]}</span></span>`;
}
window.clubLogoPick=async function(){
  if(!CLUB_ID) return;
  let cur=null; try{ const r=await fetch(await fbRootUrl('/clubs/'+CLUB_ID+'/bm/logo.json'),{cache:'no-store'}); cur=r.ok?await r.json():null; }catch(e){}
  const t=s=>window.i18nText?i18nText(s):s;
  const grid=['S','H','D','C'].map(su=>`<div class="clogo-row">${[...LOGO_RK].map(rk=>`<button class="clogo-btn${cur===rk+su?' on':''}" onclick="clubLogoSave('${rk+su}')">${clubLogoHtml(rk+su)}</button>`).join('')}</div>`).join('');
  openModal(t('Club logo'), `<div style="font-size:0.85rem;color:var(--text2);margin-bottom:10px;">${t("Choose a card: it is shown before your club's name in BridgePlay's Clubs.")}</div><div class="clogo-up">${LOGO_IMG.test(cur||'')?`<span class="clogo-cur">${clubLogoHtml(cur)}</span>`:''}<label class="btn">📷 ${t('Upload a picture')}<input type="file" accept="image/*" style="display:none" onchange="clubLogoFile(this)"></label><span>${t('or choose a card:')}</span></div><div class="clogo-grid">${grid}</div>`,
    `<button class="btn" onclick="clubLogoSave(null)">${t('Default')}</button><button class="btn btn-gold" onclick="closeModal()">${t('Close')}</button>`);
};
// a picture from the device: made square (128 px, the whole picture in it) and kept small, in the club's data
window.clubLogoFile=function(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  const t=s=>window.i18nText?i18nText(s):s;
  const img=new Image(), url=URL.createObjectURL(f);
  img.onload=()=>{
    const N=128, c=document.createElement('canvas'); c.width=c.height=N; const g=c.getContext('2d');
    const k=Math.min(N/img.width,N/img.height), w=img.width*k, h=img.height*k;
    g.drawImage(img,(N-w)/2,(N-h)/2,w,h); URL.revokeObjectURL(url);
    let d=c.toDataURL('image/png'); if(d.length>60000) d=c.toDataURL('image/webp',0.85); if(d.length>60000||!LOGO_IMG.test(d)) d=c.toDataURL('image/jpeg',0.85);
    if(d.length>60000){ toast('❌ '+t('The picture is too large')); return; }
    clubLogoSave(d);
  };
  img.onerror=()=>{ URL.revokeObjectURL(url); toast('❌ '+t('Not a picture')); };
  img.src=url;
};
window.clubLogoSave=async function(code){
  const t=s=>window.i18nText?i18nText(s):s;
  try{
    const r=await fetch(await fbRootUrl('/clubs/'+CLUB_ID+'/bm/logo.json'),code?{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(code)}:{method:'DELETE'});
    if(!r.ok) throw new Error(String(r.status));
  }catch(e){ toast('❌ '+t('Not saved — please log in again')); return; }
  toast('✅ '+t('Saved')); clubLogoPick();
};
