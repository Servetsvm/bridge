// the admin screen's refresh timer (it was used without being declared: starting a tournament stopped with an error)
var adminRefreshTimer=null;
//  ADMIN PANEL
// ══════════════════════════════════════════════════════
let adminTab='setup';

function renderAdminPanel(){
  document.getElementById('panelContent').innerHTML=`
    <div class="admin-wrap">
      <div class="admin-tabs">
        <button class="admin-tab" onclick="setAdminTab('setup',this)">⚙️ Setup</button>
        <button class="admin-tab" onclick="setAdminTab('players',this)">👥 Players</button>
        <button class="admin-tab" onclick="setAdminTab('movement',this)">🔄 Movement</button>
        <button class="admin-tab" onclick="setAdminTab('tables',this)">🃏 Tables</button>
        <button class="admin-tab" onclick="setAdminTab('boards',this)">📊 Boards</button>
        <button class="admin-tab" onclick="setAdminTab('history',this)">📜 History</button>
        <button class="admin-tab" onclick="setAdminTab('log',this)">📋 Log</button>
        <button class="admin-tab" onclick="setAdminTab('security',this)">🔑 Table codes</button>
      </div>
      <div id="adminContent"></div>
    </div>`;
  const tabs=document.querySelectorAll('.admin-tab');
  const idx=['setup','players','movement','tables','boards','history','log','security'].indexOf(adminTab);
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
  const m={setup:renderSetup,players:renderPlayersAdmin,movement:renderMovement,tables:renderTables,boards:renderBoards,history:renderHistory,log:renderLog,security:renderSecurity};
  c.innerHTML=(m[adminTab]||renderSetup)();
  if(adminTab==='setup') setTimeout(adminUpdateCalc, 0);
}

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
function generateTeamMatch(pairCount, boardsPerRound, teamAName, teamBName){
  const movements={}, pairs={};
  for(let i=1;i<=pairCount;i++)pairs['p'+i]={id:'p'+i,name:'Pair '+i,dir:'',startTable:0,isPhantom:false,team:'A',teamName:teamAName,teamPair:i};
  for(let i=1;i<=pairCount;i++){const id='p'+(pairCount+i);pairs[id]={id,name:'Pair '+(pairCount+i),dir:'',startTable:0,isPhantom:false,team:'B',teamName:teamBName,teamPair:i};}
  const rounds=pairCount;
  const activeCount=pairCount%2===0?pairCount:pairCount-1;
  for(let r=0;r<rounds;r++){
    const boardStart=r*boardsPerRound+1,boardEnd=boardStart+boardsPerRound-1;
    const sitA=pairCount%2===1?((r%pairCount)+1):null;
    const sitB=pairCount%2===1?(((r+1)%pairCount)+1):null;
    const aList=Array.from({length:pairCount},(_,i)=>i+1).filter(i=>i!==sitA);
    const bList=Array.from({length:pairCount},(_,i)=>i+1).filter(i=>i!==sitB);
    for(let i=0;i<activeCount/2;i++){
      const aIndex=aList[2*i];
      const bIndex=bList[(2*i+r)%activeCount];
      const a='p'+aIndex,b='p'+(pairCount+bIndex),t1=2*i+1,t2=2*i+2;
      movements[(r+1)+'_'+t1]={ns:a,ew:b,boardStart,boardEnd,teamMatch:true,matchId:'M'+(i+1),teamA:a,teamB:b,mirrorTable:t2,sitoutA:sitA,sitoutB:sitB};
      movements[(r+1)+'_'+t2]={ns:b,ew:a,boardStart,boardEnd,teamMatch:true,matchId:'M'+(i+1),teamA:a,teamB:b,mirrorTable:t1,sitoutA:sitA,sitoutB:sitB};
    }
  }
  return{movements,pairs,rounds,tableCount:activeCount};
}

function calcTeamMatchIMP(){
  const s=getState();
  if(s.movement!=='team')return null;
  const boards=getBoards(), mv=getMovements();
  const rows=[];
  let totalA=0,totalB=0;
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
        roundIMP+=imp; done++;
      }
      totalA+=roundIMP; totalB-=roundIMP;
      rows.push({round:r,match:m1.matchId||'',a:m1.teamA,b:m1.teamB,imp:roundIMP,done});
    }
  }
  return{rows,totalA,totalB};
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
        <div style="font-size:1.45rem;font-weight:800;color:var(--blue);">${tm?.totalA||0} IMP</div>
      </div>
      <div style="flex:1;min-width:140px;padding:12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);">
        <div style="font-size:.72rem;color:var(--text3);">${s.teams.B.name}</div>
        <div style="font-size:1.45rem;font-weight:800;color:var(--gold);">${Math.abs(tm?.totalB||0)} IMP</div>
      </div>
    </div>
    ${doneRows.length?`<div style="font-size:.76rem;color:var(--text2);">Completed match/round IMPs: ${doneRows.map(x=>`R${x.round} ${x.imp>=0?'+':''}${x.imp}`).join(' · ')}</div>`:'<div style="font-size:.76rem;color:var(--text3);">No complete two-table board comparison yet.</div>'}
  </div>`;
}

// ── Setup ──
function renderSetup(){
  const s=getState();
  const playerCount=parseInt(s._setupPlayers||0);
  const tableCount=playerCount>0?Math.floor(playerCount/4):0;
  const hasPhantom=playerCount>0&&playerCount%4!==0;
  const isTeam=s.movement==='team';
  const teamPairs=s._teamPairs||2;
  return`
  <div class="card">
    <div class="card-title"><span>⚙️</span> Tournament Setup</div>
    <div class="field"><label>Tournament ID (auto)</label><input id="aName" value="${s.name||''}" readonly style="cursor:default;color:var(--text3);font-size:0.82rem;" placeholder="Assigned automatically when tournament is created"></div>
    <div class="field-row">
      <div class="field">
        <label>Number of Players</label>
        <input type="number" id="aPlayers" value="${isTeam?teamPairs*4:(s._setupPlayers||16)}" min="4" max="120" ${isTeam?'readonly':''} oninput="adminUpdateCalc()">
        <div style="font-size:0.72rem;color:var(--text3);margin-top:3px;" id="calcHint">→ ${isTeam?teamPairs+' pairs · 2 teams':tableCount+' tables'+(hasPhantom?' + 1 phantom':'')}</div>
      </div>
      <div class="field">
        <label>Boards per Round</label>
        <input type="number" id="aBPR" value="${s.boardsPerRound||3}" min="1" max="8" oninput="adminUpdateCalc()">
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
        <option value="team" ${s.movement==='team'?'selected':''}>Team Match — team-based match movement</option>
      </select>
      <div style="font-size:0.72rem;color:var(--text3);margin-top:3px;" id="movHint">${isTeam?'Team Match: 2 teams, 2 or more pairs per team, two-table mirrored boards and IMP scoring.':'Mitchell: NS fixed, EW moves. Howell: everyone moves. Barometer: like Howell, but every table plays the same boards at the same time (one copy of the boards per table). Swiss: pairing is re-computed automatically after every round. In every movement the North-South pair of table 1 stays seated (e.g. for a player in a wheelchair).'}</div>
    </div>
    <div id="aTeamSettings" style="display:${isTeam?'block':'none'};padding:10px 12px;margin:8px 0 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;">
      <div style="font-size:.76rem;font-weight:700;color:var(--gold);margin-bottom:8px;">🏆 Team Match Settings</div>
      <div class="field-row">
        <div class="field"><label>Team A</label><input id="aTeamA" value="${s._teamAName||'Team A'}" placeholder="Team A"></div>
        <div class="field"><label>Team B</label><input id="aTeamB" value="${s._teamBName||'Team B'}" placeholder="Team B"></div>
      </div>
      <div class="field"><label>Pairs per Team</label><input type="number" id="aTeamPairs" value="${teamPairs}" min="2" max="12" oninput="adminUpdateCalc()">
      <div style="font-size:.7rem;color:var(--text3);margin-top:3px;">${teamPairs} pairs/team = ${teamPairs*2} pairs = ${teamPairs*4} players. Each opponent pairing uses two tables and the same boards.</div></div>
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
      ${s.status==='setup'&&s.roundCount>0?`<button class="btn btn-green btn-full" onclick="adminStart()">▶ Start Round 1</button>`:''}
      ${s.status==='running'&&s.currentRound<s.roundCount?`<button class="btn btn-gold" onclick="adminNextRound()">⏭ Next Round (${s.currentRound+1})</button>`:''}
      ${s.status==='running'&&s.currentRound>=s.roundCount?`<button class="btn btn-blue" onclick="adminFinish()">🏁 Finish Tournament</button>`:''}
    </div>
    ${s.status==='running'||s.status==='setup'?`<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);"><button class="btn btn-green btn-full" onclick="showTableLinkModal()">📲 Send the players the link</button></div><div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);"><div style="font-size:0.72rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">⚠️ Slow Table Alert</div><div style="font-size:0.72rem;color:var(--text2);margin-bottom:8px;">Beep + on-screen warning if a table hasn't entered a score in this many minutes.</div><div style="display:flex;gap:6px;align-items:center;"><input type="number" id="stallMinutesInput" value="${s.stallAlertMinutes||15}" min="1" max="120" style="width:80px;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);"><span style="font-size:0.76rem;color:var(--text2);">minutes</span><button class="btn btn-ghost btn-sm" onclick="saveStallMinutes()">Save</button></div></div>`:''}
  </div>
  <div class="card"><div class="card-title"><span>💾</span> Data</div><div style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn btn-blue" onclick="adminExport()">⬇ Export</button><button class="btn btn-purple" onclick="adminImportOpen()">⬆ Import</button><button class="btn btn-red" onclick="adminReset()">🗑 Reset</button></div></div>`;
}

window.adminUpdateCalc=function(){
  const mov=document.getElementById('aMovement')?.value||'mitchell';
  const bpr=parseInt(document.getElementById('aBPR')?.value||3);
  const swissField=document.getElementById('aSwissRoundsField');
  const teamField=document.getElementById('aTeamSettings');
  if(swissField)swissField.style.display=(mov==='swiss')?'block':'none';
  if(teamField)teamField.style.display=(mov==='team')?'block':'none';
  const playersEl=document.getElementById('aPlayers');
  let players=parseInt(playersEl?.value||0), rounds=0, tables=0;
  if(mov==='team'){
    const pp=teamMatchPairCount()||2;
    players=pp*4;tables=pp;rounds=pp;
    if(playersEl){playersEl.value=players;playersEl.readOnly=true;}
  }else{
    if(playersEl)playersEl.readOnly=false;
    const phantom=players%4!==0;
    tables=Math.floor(players/4);
    const pairCount=tables*2+(phantom?1:0);
    if(mov==='mitchell')rounds=tables;
    else if(mov==='howell'||mov==='barometer')rounds=pairCount%2?pairCount:pairCount-1;   // an odd number of pairs: each pair sits out one round
    else rounds=parseInt(document.getElementById('aSwissRounds')?.value||7);
  }
  const totalBoards=rounds*bpr;
  const hint=document.getElementById('calcHint'), bprHint=document.getElementById('bprHint');
  if(hint)hint.textContent=mov==='team'?`→ ${tables} tables · 2 teams · ${tables} pairs/team`:`→ ${tables} table${tables!==1?'s':''}${players%4!==0?(mov==='howell'||mov==='barometer'?' + one pair sits out each round':' + phantom'):''}${mov==='barometer'||mov==='howell'&&(()=>{const pc=Math.floor(players/4)*2+(players%4!==0?1:0);return pc+pc%2;})()<=6?' · ⚠ every table plays the same boards each round: one copy of the boards per table':''}`;
  if(bprHint&&rounds>0)bprHint.textContent=`→ ${bpr} boards/round × ${rounds} rounds = ${totalBoards} total boards`;
  window._computedRounds=rounds;window._computedTotalBoards=totalBoards;
};

window.adminSetup=function(){
  const now=new Date();const pad=n=>String(n).padStart(2,'0');
  const autoName=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+' '+pad(now.getHours())+':'+pad(now.getMinutes());
  document.getElementById('aName').value=autoName;
  const name=autoName;
  const mov=document.getElementById('aMovement').value;
  const bpr=parseInt(document.getElementById('aBPR').value);
  let players=parseInt(document.getElementById('aPlayers').value),tables,phantom=false,pairCount,rounds,swissRounds;
  let result,teams=null;
  if(isNaN(bpr)||bpr<1||bpr>8){toast('❌ Boards/round: 1-8');return;}
  if(mov==='team'){
    const tm=teamMatchSettingsFromUI();
    if(tm.pairsPerTeam<2||tm.pairsPerTeam>12){toast('❌ Team Match: 2-12 pairs per team');return;}
    players=tm.pairsPerTeam*4;pairCount=tm.pairsPerTeam*2;rounds=tm.pairsPerTeam;
    result=generateTeamMatch(tm.pairsPerTeam,bpr,tm.teamA,tm.teamB);
    tables=result.tableCount;
    teams={A:{id:'A',name:tm.teamA,pairs:Object.keys(result.pairs).filter(id=>result.pairs[id].team==='A')},B:{id:'B',name:tm.teamB,pairs:Object.keys(result.pairs).filter(id=>result.pairs[id].team==='B')}};
  }else{
    if(isNaN(players)||players<4){toast('❌ Min 4 players');return;}
    tables=Math.floor(players/4);phantom=players%4!==0;
    if(tables<2){toast('❌ Need at least 8 players (2 tables)');return;}
    pairCount=tables*2+(phantom?1:0);
    if(mov==='swiss'&&phantom){toast('❌ Swiss (v1) needs a player count divisible by 4 — no bye/phantom support yet');return;}
    if(mov==='mitchell')rounds=tables;
    else if(mov==='howell'||mov==='barometer')rounds=pairCount%2?pairCount:pairCount-1;
    else{swissRounds=parseInt(document.getElementById('aSwissRounds').value);if(isNaN(swissRounds)||swissRounds<3){toast('❌ Swiss: choose at least 3 rounds');return;}if(swissRounds>pairCount-1){toast(`❌ Swiss: max ${pairCount-1} rounds for ${pairCount} pairs`);return;}rounds=swissRounds;}
    const totalBoards=rounds*bpr;
    if(mov==='mitchell')result=generateMitchell(tables,bpr,phantom,totalBoards);
    else if(mov==='howell'||mov==='barometer')result=generateHowell(tables,bpr,totalBoards,phantom,mov==='barometer');
    else result=generateSwissRound1(pairCount,bpr,rounds);
  }
  const totalBoards=rounds*bpr;
  setMovements(result.movements);setPairs(result.pairs);setBoards({});setApprovals({});
  const s=getState();
  s.name=name;s.tableCount=tables;s.boardsPerRound=bpr;s.totalBoards=totalBoards;s.roundCount=rounds;s.phantom=phantom;s.status='setup';s.currentRound=0;
  s.movement=mov;s.scoring=mov==='team'?'IMP':'BOTH';s._setupPlayers=players;s._setupSwissRounds=swissRounds||s._setupSwissRounds;
  if(mov==='team'){
    const tm=teamMatchSettingsFromUI();s.teams=teams;s._teamPairs=tm.pairsPerTeam;s._teamAName=tm.teamA;s._teamBName=tm.teamB;s._teamScoring='IMP';
  }else{delete s.teams;delete s._teamPairs;delete s._teamAName;delete s._teamBName;}
  setState(s);
  addLog('ok','Tournament created',`${players} players, ${tables} tables, ${result.rounds} rounds, ${mov}, ${scoringName(s)}`);
  toast(mov==='team'?`✅ Team Match created: ${s.teams.A.name} vs ${s.teams.B.name}`:'✅ Tournament created');
  adminTab='setup';refreshTopbar();renderAdminPanel();   // the names come from the tables after the start
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
  addLog('ok','Round 1 started','Tournament begins');
  toast('▶ Round 1 started!');refreshTopbar();renderAdminTab();
  adminSetupAutoRefresh();
  showTableLinkModal();
};
window.saveStallMinutes=function(){
  const v=parseInt(document.getElementById('stallMinutesInput').value);
  if(isNaN(v)||v<1){toast('❌ Enter a valid number of minutes');return;}
  const s=getState();s.stallAlertMinutes=v;setState(s);
  toast('✅ Alert threshold set to '+v+' min');
};
/* after the start: the players get Bridge Table's link (with this club and its table code prefix); there they tap
   Table No, type their member numbers or names and choose their table */
const playersLink=async()=>location.origin+location.pathname.replace(/bridgegate\/[^/]*$/,'')+'#bg='+encodeURIComponent(CLUB_ID||'')+'.'+(await getTablePrefix());
window.showTableLinkModal=async function(){
  const s=getState(), link=await playersLink();
  const text=`🃏 ${CLUB_NAME||'BridgeGate'}${s.name?' — '+s.name:''}\n${link}`;
  window._playersMsg=encodeURIComponent(text);
  openModal('Send the players the link', `
    <div style="font-size:0.85rem;color:var(--text2);margin-bottom:10px;">The players open Bridge Table with this link, tap Table No, type their member numbers (or names) and choose their table.</div>
    <input readonly value="${link}" onclick="this.select()" style="width:100%;font-size:0.76rem;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text2);box-sizing:border-box;">
    <div style="display:flex;gap:8px;margin-top:10px;"><a class="btn btn-full" style="background:#25d366;color:#fff;text-decoration:none;text-align:center;" href="https://wa.me/?text=${window._playersMsg}" target="_blank" rel="noopener">💬 WhatsApp</a><a class="btn btn-ghost btn-full" style="text-decoration:none;text-align:center;" href="sms:?&body=${window._playersMsg}">✉️ SMS</a></div>
  `, `<button class="btn btn-ghost" onclick="closeModal()">Close</button>`);
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
function checkStalledTables(){
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


function adminSetupAutoRefresh(){
  if(adminRefreshTimer)clearInterval(adminRefreshTimer);
  adminRefreshTimer=setInterval(()=>{
    if(role==='admin'){
      if(adminTab==='setup'){ const c=document.getElementById('adminContent'); if(c)c.innerHTML=renderSetup(); }
      checkRoundComplete();
    }
  },4000);
}

let _lastRoundCompleteNotified = -1;
function checkRoundComplete(){
  const s = getState();
  if(s.status !== 'running') return;
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
  if(allDone && _lastRoundCompleteNotified !== s.currentRound){
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
  const arc=getArchives();
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
    `<button class="btn btn-blue" onclick="adminExport();closeModal()">⬇ Export Results</button>
     <button class="btn btn-ghost" onclick="closeModal()">Close</button>`);
}
window.adminExport=function(){
  const data={state:getState(),pairs:getPairs(),boards:getBoards(),movements:getMovements(),logs:getLogs()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='bridgemate_'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);
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
    a.download = 'bridgemate-players-'+new Date().toISOString().slice(0,10)+'.json';
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
      <p style="font-size:0.8rem;color:var(--text2);margin-bottom:8px;">Load pre-dealt boards from a file.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
        <button class="btn btn-gold btn-sm" onclick="document.getElementById('boardFile').click()">📄 JSON</button>
        <button class="btn btn-blue btn-sm" onclick="adminImportHandsOpen()">🃏 PBN/LIN</button>
        <button class="btn btn-ghost btn-sm" onclick="toast('Continuing without a board file...')">▶ Skip</button>
      </div>
      <div class="import-drop" onclick="document.getElementById('boardFile').click()">
        <div style="font-size:2rem;">📂</div><div style="font-weight:600;">Drag / Select boards.json</div>
        <input type="file" id="boardFile" accept=".json" onchange="adminLoadBoardsFile(this)" style="display:none;">
      </div>
    </div>`;
}

