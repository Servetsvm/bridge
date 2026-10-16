//  TABLE LOCK SYSTEM — Soft warning only
//  tableLocks: { "round_tableNo": { lockedAt } }
// ══════════════════════════════════════════════════════
const getTableLocks=()=>_cache['tableLocks']||{};
const setTableLocks=l=>DB.set('tableLocks',l);

function tableLockKey(tableNo){
  return getState().currentRound+'_'+tableNo;
}
function lockTable(tableNo){
  const locks=getTableLocks();
  locks[tableLockKey(tableNo)]={lockedAt:Date.now(),tableNo};
  setTableLocks(locks);
}
function unlockTable(tableNo){
  const locks=getTableLocks();
  delete locks[tableLockKey(tableNo)];
  setTableLocks(locks);
}
function unlockAllMyTables(){
  // No device ID — just clear any lock this session placed
  if(bmTableNo)unlockTable(bmTableNo);
}
function isTableLocked(tableNo){
  const locks=getTableLocks();
  return!!locks[tableLockKey(tableNo)];
}
let bmTableNo=null;
let bmSide='ns'; // 'ns' or 'ew' — which side is this device
let boardForm={level:null,suit:null,declarer:null,result:0,doubled:'',leadSuit:'',leadRank:'',isPass:false};
let bmPollInterval=null;
let bmTableState='select'; // 'select'|'confirm'|'play'|'approve'|'round_over'|'waiting'|'new_players'

function renderTablePanel(){
  const s=getState();
  const c=document.getElementById('panelContent');
  // If already in a table session, just refresh that table
  // But not if we're in new players / name entry screen
  if(bmTableNo){
    const inNameScreen=!!document.getElementById('ns1inp');
    if(inNameScreen) return; // don't disturb name entry
    renderTableDetail(bmTableNo);
    return;
  }
  // Release lock on current table if any
  bmTableState='select';
  if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
  if(s.status==='setup'){
    c.innerHTML=`<div class="empty-state"><div class="empty-icon">⏳</div><div style="font-weight:600;margin-bottom:4px;">Tournament not started</div><div style="font-size:0.82rem;">Ask the director to start the tournament</div>${window.bmCodeTable?`<div style="margin-top:10px;font-size:1.4rem;font-weight:700;color:var(--gold);">Table ${window.bmCodeTable}</div>`:''}</div>`;
    return;
  }
  if(window.bmCodeTable){
    const n=window.bmCodeTable;
    if(n<1||n>s.tableCount){ c.innerHTML=`<div class="empty-state"><div class="empty-icon">❌</div><div style="font-weight:600;">Table ${n} is not in this tournament</div></div>`; return; }
    lockTable(n); bmTableNo=n; bmShowNewPlayers(n, s.currentRound);
    return;
  }
  c.innerHTML=`
    <div class="bm-device">
      <div class="bm-lcd" style="text-align:center;">
        <div class="bm-lcd-row inv" style="display:inline-block;margin-bottom:6px;">BridgeGate · Round ${String(s.currentRound).padStart(2,'0')}</div>
        <div class="bm-lcd-row" style="text-align:center;color:var(--text);">Select your table number</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
        <input type="number" id="tableInput" min="1" max="${s.tableCount}" inputmode="numeric"
          style="font-size:2rem;text-align:center;padding:12px;width:140px;background:var(--surface2);border:2px solid var(--border2);border-radius:var(--radius);color:var(--text);outline:none;font-family:'DM Sans',sans-serif;">
        <div style="display:flex;gap:8px;">
          <button class="btn btn-ghost" onclick="bmSetSide('ns');bmSelectTable()">🔵 NS Side</button>
          <button class="btn btn-ghost" onclick="bmSetSide('ew');bmSelectTable()">🟡 EW Side</button>
        </div>
        <button class="btn btn-gold" style="min-width:180px;" onclick="bmSelectTable()">SELECT TABLE →</button>
      </div>
    </div>`;
  setTimeout(()=>document.getElementById('tableInput')?.focus(),80);
}

/* A player's phone, from Bridge Table's "Table No" (the organiser's link brings the club and the table code prefix):
   first the four players (member number or name), then the table number; the table signs in with prefix + number
   and its names go to the pairs sitting there, so the admin's Players list fills itself. */
const BG_PENDING='bg-pending-names';
// the tournament now running: its table numbers; a tap asks for the four players at that table
window.bgPlayerEntry=async function(prefix){
  const box=document.querySelector('#loginScreen .login-box'); if(!box) return;
  ['clubGate','loginForm'].forEach(id=>{const el=document.getElementById(id); if(el) el.style.display='none';});
  let pe=document.getElementById('playerEntry');
  if(!pe){ pe=document.createElement('div'); pe.id='playerEntry'; box.appendChild(pe); }
  const s=await DB.get('state')||{};
  if(s.status!=='running'){ pe.innerHTML=`<div class="empty-state"><div class="empty-icon">⏳</div><div style="font-weight:600;margin-bottom:4px;">Tournament not started</div><div style="font-size:0.82rem;">Ask the director to start the tournament</div></div><button class="btn-primary" onclick="bgPlayerEntry('${prefix}')">↻</button>`; return; }
  pe.innerHTML=`<div class="bm-lcd" style="text-align:center;margin-bottom:10px;"><div class="bm-lcd-row inv" style="display:inline-block;">${s.name||'BridgeGate'}</div><div class="bm-lcd-row" style="text-align:center;color:var(--text);">Select your table number</div></div>
    <div class="bm3-keys k4" style="padding:0;">${Array.from({length:s.tableCount||0},(_,i)=>`<button class="bm3-key" onclick="bgPlayerNames('${prefix}',${i+1})">${i+1}</button>`).join('')}</div>`;
};
// the four players at the chosen table, drawn as the table: North at the top, South at the bottom, West and East at the sides
const BG_SEATS={N:'North',S:'South',E:'East',W:'West'};
window.bgPlayerNames=function(prefix,n){
  const pe=document.getElementById('playerEntry'); if(!pe) return;
  if(!window._bgEntry||window._bgEntry.n!==n) window._bgEntry={prefix,n,seats:{N:'',S:'',E:'',W:''}};
  const st=window._bgEntry.seats;
  const seat=k=>`<button class="pe-pos pe-${k}" onclick="bgSeatEdit('${k}')"><small>${BG_SEATS[k]}</small><b>${st[k]?cleanData(st[k]):'＋'}</b></button>`;
  pe.innerHTML=`<div class="pe-table">${seat('N')}${seat('W')}<div class="pe-mid">Table ${n}</div>${seat('E')}${seat('S')}</div>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:12px;"><button class="btn btn-ghost" onclick="window._bgEntry=null;bgPlayerEntry('${prefix}')">← Back</button><button class="btn-primary" style="margin:0;" onclick="bgPlayerSit()">Continue →</button></div>`;
};
// one seat: a member number (its name is shown at once) or a name; OK goes back to the table
window.bgSeatEdit=function(k){
  const pe=document.getElementById('playerEntry'), e=window._bgEntry; if(!pe||!e) return;
  pe.innerHTML=`<div class="bm-lcd" style="text-align:center;margin-bottom:10px;"><div class="bm-lcd-row inv" style="display:inline-block;">Table ${e.n}</div><div class="bm-lcd-row" style="text-align:center;color:var(--text);">${BG_SEATS[k]}</div></div>
    <input id="peInput" class="pe-input" maxlength="40" autocomplete="off" placeholder="Member number or name" value="${cleanData(e.seats[k]||'')}" oninput="bgSeatLook()" onkeydown="if(event.key==='Enter')bgSeatOk('${k}')">
    <div id="peFound" class="pe-found"></div>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:12px;"><button class="btn btn-ghost" onclick="bgPlayerNames('${e.prefix}',${e.n})">✕ Cancel</button><button class="btn-primary" style="margin:0;" onclick="bgSeatOk('${k}')">✓ OK</button></div>`;
  setTimeout(()=>document.getElementById('peInput')?.focus(),80);
};
// a member number typed: its name under the box (or that it is unknown, so a name can be typed instead)
let _bgLookT=0;
window.bgSeatLook=function(){
  clearTimeout(_bgLookT);
  _bgLookT=setTimeout(async()=>{
    const v=(document.getElementById('peInput')?.value||'').trim(), out=document.getElementById('peFound'); if(!out) return;
    if(!/^\d{1,8}$/.test(v)){ out.textContent=''; return; }
    const name=await memberName(v);
    if((document.getElementById('peInput')?.value||'').trim()!==v) return;
    out.textContent=name?'👤 '+name:'❓ '+v; out.className='pe-found'+(name?' ok':' no');
  },250);
};
window.bgSeatOk=async function(k){
  const e=window._bgEntry; if(!e) return;
  let v=(document.getElementById('peInput')?.value||'').trim();
  if(/^\d{1,8}$/.test(v)){ const name=await memberName(v); if(!name){ bgSeatLook(); return; } v=name; }   // an unknown number: type the name instead
  e.seats[k]=v.slice(0,40);
  bgPlayerNames(e.prefix,e.n);
};
// sign this phone in at that table (prefix + number); its names go to the pairs sitting there
window.bgPlayerSit=function(){
  const e=window._bgEntry; if(!e) return;
  try{ sessionStorage.setItem(BG_PENDING,JSON.stringify({t:e.n,...e.seats})); }catch(err){}
  window._bgEntry=null;
  document.getElementById('playerEntry')?.remove();
  document.getElementById('loginForm').style.display='block';
  selRole('table');
  document.getElementById('pwInput').value=e.prefix+String(e.n).padStart(2,'0');
  doLogin();
};

// this phone moves to another table (its player changes tables after a round): the table number again, then the players
window.bgChangeTable=async function(){
  const p=window.bmCodePrefix; if(!p) return;
  try{ await unlockAllMyTables(); }catch(e){}
  if(bmPollInterval){ clearInterval(bmPollInterval); bmPollInterval=null; }
  bmTableNo=null; window.bmCodeTable=null; window._bgEntry=null;
  document.getElementById('app').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
  bgPlayerEntry(p);
};

window.bmSetSide=function(side){bmSide=side;};
window.bmSelectTable=async function(){
  const s=getState();
  const n=parseInt(document.getElementById('tableInput')?.value||'');
  if(isNaN(n)||n<1||n>s.tableCount){toast('❌ Enter a valid table number (1-'+s.tableCount+')');return;}
  if(isTableLocked(n)){
    if(!await confirmDialog(`Table ${n} already appears open on another device.\n\nDo you still want to enter this table?`,{title:'Table Already Open',confirmLabel:'Enter Anyway'}))return;
  }
  lockTable(n);
  bmTableNo=n;
  bmShowNewPlayers(n, s.currentRound);
};

function renderTableDetail(tableNo){
  const s=getState();
  const movements=getMovements();const pairs=getPairs();const boards=getBoards();
  const mk=s.currentRound+'_'+tableNo;
  const m=movements[mk]||{};
  const nsPair=pairs[m.ns]||{name:'—',id:m.ns};
  const ewPair=pairs[m.ew]||{name:'—',id:m.ew};
  const isPhantom=nsPair.isPhantom||ewPair.isPhantom;

  const boardList=[];
  for(let b=m.boardStart||1;b<=(m.boardEnd||3);b++){
    const key=tableNo+'_'+s.currentRound+'_'+b;
    boardList.push({boardNo:b,key,data:boards[key]||null});
  }
  const doneCount=boardList.filter(x=>x.data&&x.data.status==='done').length;
  const totalBoards=boardList.length;
  const nsNum=m.ns?m.ns.replace(/[^0-9]/g,''):'?';
  const ewNum=m.ew?m.ew.replace(/[^0-9]/g,''):'?';
  const lcdLine1=`RND ${String(s.currentRound).padStart(2,' ')}  NS:${nsNum.padStart(2,' ')} EW:${ewNum.padStart(2,' ')} B${m.boardStart||'?'}-${m.boardEnd||'?'}`;

  const approvals=getApprovals();
  // Find the next (first un-done) board to play
  const nextBoard=boardList.find(bl=>!(bl.data&&bl.data.status==='done'));
  const approvalPending=boardList.find(bl=>{
    const apk=tableNo+'_'+s.currentRound+'_'+bl.boardNo;
    const ap=approvals[apk];
    return ap&&ap.status==='pending';
  });

  let boardsHTML='';
  if(approvalPending){
    const apk=tableNo+'_'+s.currentRound+'_'+approvalPending.boardNo;
    const ap=approvals[apk];
    boardsHTML=`<div class="board-item pending">
      <span class="bi-num">Board ${approvalPending.boardNo}</span>
      <span class="bi-contract">${ap.contract||'—'}</span>
      <span style="font-size:0.72rem;color:var(--gold);">⏳ Awaiting approval</span>
      ${bmSide!==ap.side
        ?`<button class="btn btn-green btn-sm" onclick="bmApproveScore('${apk}')">✅ OK</button>`
        :`<button class="btn btn-red btn-sm" onclick="bmCancelApproval('${apk}')">✕</button>`}
    </div>`;
  } else if(nextBoard){
    boardsHTML=`<div class="board-item pending" style="border-color:var(--gold);cursor:pointer;" onclick="bmEnterBoard(${nextBoard.boardNo})">
      <span class="bi-num" style="color:var(--gold);font-size:1rem;">Board ${nextBoard.boardNo}</span>
      <span class="bi-contract" style="color:var(--text2);font-size:0.8rem;">${doneCount+1} of ${totalBoards} (next)</span>
      <span style="font-size:0.78rem;color:var(--text3);"></span>
      <button class="btn btn-gold btn-sm" onclick="event.stopPropagation();bmEnterBoard(${nextBoard.boardNo})">Enter ↵</button>
    </div>`;
  }
  // Board status overview for this table
  const allBoardsHtml=boardList.map(bl=>{
    const done=bl.data&&bl.data.status==='done';
    const pending=bl.data&&bl.data.status!=='done'&&bl.data;
    const isNext=nextBoard&&nextBoard.boardNo===bl.boardNo&&!approvalPending;
    const col=done?'var(--green)':isNext?'var(--gold)':'var(--border2)';
    const icon=done?'✅':isNext?'▶':'⭕';
    const score=done&&typeof bl.data.nsScore==='number'?(bl.data.nsScore>=0?'+':'')+bl.data.nsScore+' NS':'';
    // the board's MP % and IMP against the other tables that have finished it (from this table's side: NS or EW)
    let cmp='';
    if(done&&typeof bl.data.nsScore==='number'){
      const o=getOtherTablesSameBoard(bl.boardNo,tableNo,s.currentRound);
      if(o.length){
        let mp=0,imp=0; o.forEach(x=>{mp+=bl.data.nsScore>x.nsScore?2:bl.data.nsScore===x.nsScore?1:0; imp+=scoreToIMP(bl.data.nsScore-x.nsScore);});
        let pct=Math.round(mp/(2*o.length)*1000)/10, im=imp/o.length;
        if(bmSide==='ew'){ pct=Math.round((100-pct)*10)/10; im=-im; }
        cmp=`MP ${pct}% · IMP ${fmtImp(im)}`;
      }
    }
    return`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:1rem;">${icon}</span>
      <span style="font-size:0.82rem;font-weight:${isNext?700:400};color:${col};">Board ${bl.boardNo}</span>
      ${score?`<span style="font-size:0.72rem;color:var(--text3);margin-left:auto;">${score}</span>`:''}
      ${cmp?`<span style="font-size:0.72rem;font-weight:700;color:var(--gold);">${cmp}</span>`:''}
      ${done&&bl.data.durationSec?`<span style="font-size:0.65rem;color:var(--text3);">${bl.data.durationSec<60?bl.data.durationSec+'s':Math.floor(bl.data.durationSec/60)+'m'}</span>`:''}
    </div>`;
  }).join('');

  const allDone=doneCount===totalBoards&&totalBoards>0;
  if(allDone)unlockTable(tableNo); // Remove lock — table finished
  let actionHTML='';
  if(allDone){
    if(s.currentRound<s.roundCount){
      actionHTML=`<button class="btn btn-gold btn-full" style="margin-top:10px;" onclick="bmShowRoundOver(${tableNo})">▶ Round Complete — Continue</button>`;
    } else {
      actionHTML=`<div class="next-round-card">
        <div class="nr-title">🏁 Tournament Finished</div>
        <div class="nr-main" style="font-size:1rem;margin-bottom:8px;">All boards completed</div>
        <div class="nr-detail" style="margin-bottom:14px;">Results can be viewed on the Screen display</div>
        <button class="btn btn-ghost btn-full" onclick="doLogout()" style="font-size:0.82rem;">← Log Out</button>
      </div>`;
    }
  }

  document.getElementById('panelContent').innerHTML=`
    <div class="bm-device" style="max-width:360px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <button class="btn btn-ghost btn-sm" onclick="renderTablePanel()">← Back</button>
        <button class="btn btn-gold btn-sm" style="margin-left:auto;font-weight:700;" onclick="bgChangeTable()">🔄 Change table</button>
        <span style="font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:700;color:var(--gold);">Table ${tableNo}</span>
        <span style="font-size:0.72rem;color:var(--text3);">${doneCount}/${totalBoards}</span>
        <span style="font-size:0.68rem;color:${bmSide==='ns'?'var(--blue)':'var(--gold)'};">${bmSide==='ns'?'🔵 NS':'🟡 EW'}</span>
        ${isPhantom?'<span class="phantom-badge">PHANTOM</span>':''}
      </div>
      <div class="bm-lcd">
        <div class="bm-lcd-row inv">Round ${s.currentRound}  ·  Table ${tableNo}  ·  Boards ${m.boardStart||'?'}–${m.boardEnd||'?'}</div>
        <div class="bm-lcd-row">🔵 NS: ${nsPair.name.slice(0,30)}</div>
        <div class="bm-lcd-row">🟡 EW: ${ewPair.name.slice(0,30)}</div>
        <div class="bm-lcd-row" style="color:var(--gold);font-size:0.72rem;">${scoringName(s)==='IMP'?'IMP Scoring':'MP + IMP Scoring'}</div>
      </div>
      <div style="padding:4px 0 8px;">
        <div style="font-size:0.7rem;color:var(--text3);font-weight:600;margin-bottom:4px;letter-spacing:0.05em;">BOARDS THIS ROUND</div>
        ${allBoardsHtml}
      </div>
      <div id="boardsSection">
        <div class="card">
          <div class="card-title"><span>🃏</span> ${allDone?'All Boards Complete ✓':nextBoard?'Next Board: '+nextBoard.boardNo:approvalPending?'Awaiting Approval...':'Ready'}</div>
          <div id="boardsList">${boardsHTML}</div>
          ${isPhantom?`<div style="margin-top:8px;text-align:center;font-size:0.8rem;color:var(--purple);">👻 Phantom pair — sit out</div>`:''}
        </div>
        ${actionHTML}
      </div>
    </div>`;

  // Other tables — same boards (all rounds, all tournament types)
  function buildDetailOtherHTML(){
    const boards2=getBoards();const movements2=getMovements();const pairs2=getPairs();const approvals2=getApprovals();
    const myBoards=[];
    for(let b=m.boardStart||1;b<=(m.boardEnd||3);b++)myBoards.push(b);
    if(!myBoards.length)return '';
    let html='';
    myBoards.forEach(function(boardNo){
      // Only show other results if THIS table has already completed this board
      const myKey=tableNo+'_'+s.currentRound+'_'+boardNo;
      const myBoard=boards2[myKey];
      if(!myBoard||myBoard.status!=='done')return; // not yet played by us → hide

      const results=[];
      Object.entries(movements2).forEach(function([mk,mv]){
        const parts=mk.split('_');if(parts.length!==2)return;
        const r=parseInt(parts[0]);const t=parseInt(parts[1]);
        if(t===tableNo&&r===s.currentRound)return;
        if(boardNo>=(mv.boardStart||1)&&boardNo<=(mv.boardEnd||999)){
          const bkey=t+'_'+r+'_'+boardNo;
          const bd=boards2[bkey];
          if(bd&&bd.status==='done'&&typeof bd.nsScore==='number'){
            results.push({table:t,round:r,nsScore:bd.nsScore,contract:bd.contract||'?'});return;
          }
        }
      });
      if(!results.length)return;
      html+='<div style="margin-top:6px;margin-bottom:2px;font-size:0.65rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px;">Board '+boardNo+' — Other tables ('+results.length+')</div>';
      // this table's result against them, in MP and IMP together (N-S; E-W is the other side of it)
      if(typeof myBoard.nsScore==='number'){
        let mp=0,imp=0;
        results.forEach(function(o){mp+=myBoard.nsScore>o.nsScore?2:myBoard.nsScore===o.nsScore?1:0;imp+=scoreToIMP(myBoard.nsScore-o.nsScore);});
        const pct=Math.round(mp/(2*results.length)*1000)/10,im=imp/results.length;
        const side=(d,p,v)=>'<span><b>'+d+'</b> MP '+p+'% · IMP '+fmtImp(v)+'</span>';
        html+='<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;background:var(--golddim);border:1px solid var(--gold);border-radius:6px;padding:5px 10px;margin-bottom:4px;font-size:0.77rem;">'+side('NS',pct,im)+side('EW',Math.round((100-pct)*10)/10,-im)+'</div>';
      }
      results.forEach(function(o){
        const sc=o.nsScore>0?'var(--green)':o.nsScore<0?'var(--red)':'var(--gold)';
        html+='<div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface2);border-radius:6px;padding:5px 10px;margin-bottom:3px;font-size:0.77rem;">'
          +'<span style="color:var(--text3);white-space:nowrap;">T'+o.table+' R'+o.round+'</span>'
          +'<span style="font-family:\'Share Tech Mono\',monospace;flex:1;text-align:center;padding:0 6px;">'+(o.contract!=='?'?o.contract:'—')+'</span>'
          +'<span style="font-weight:700;color:'+sc+';white-space:nowrap;">'+(o.nsScore>0?'+':'')+o.nsScore+'</span>'
          +'</div>';
      });
    });
    if(!html)return '';
    return '<div class="card" style="margin-top:10px;"><div class="card-title"><span>📊</span> Same board — other results</div>'+html+'</div>';
  }

  document.getElementById('panelContent').querySelector('#boardsSection')?.insertAdjacentHTML('beforeend',buildDetailOtherHTML());

  // Auto-poll for approvals
  if(bmPollInterval)clearInterval(bmPollInterval);
  bmPollInterval=setInterval(()=>bmPollApprovals(tableNo),1500);
}

function bmPollApprovals(tableNo){
  const s=getState();
  const m=getMovements()[s.currentRound+'_'+tableNo]||{};
  const approvals=getApprovals();
  const boards=getBoards();
  let needRefresh=false;
  for(let b=m.boardStart||1;b<=(m.boardEnd||3);b++){
    const apk=tableNo+'_'+s.currentRound+'_'+b;
    const ap=approvals[apk];
    if(ap&&ap.status==='approved'&&!(boards[apk]?.status==='done')){
      // Approval came in — save the board
      const bs=getBoards();
      bs[apk]={...ap,status:'done',time:new Date().toISOString()};
      setBoards(bs);
      // Remove approval
      const aps=getApprovals();
      delete aps[apk];
      setApprovals(aps);
      needRefresh=true;
    }
  }
  if(needRefresh)renderTableDetail(tableNo);
}

window.bmApproveScore=function(apk){
  const aps=getApprovals();
  if(!aps[apk]||aps[apk].status!=='pending')return;
  aps[apk].status='approved';
  setApprovals(aps);
  const [tableNo,round,boardNo]=apk.split('_');
  const bs=getBoards();
  bs[apk]={...aps[apk],status:'done',time:new Date().toISOString()};
  setBoards(bs);
  delete aps[apk];setApprovals(aps);
  addLog('ok',`Board ${boardNo} approved`,`Table ${tableNo} Round ${round}`);
  toast('✅ Score confirmed!');
  renderTableDetail(parseInt(tableNo));
};

window.bmCancelApproval=function(apk){
  const aps=getApprovals();
  delete aps[apk];setApprovals(aps);
  const [tableNo]=apk.split('_');
  toast('Approval cancelled');
  renderTableDetail(parseInt(tableNo));
};

window.bmShowRoundOver=function(tableNo){
  if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
  const s=getState();
  const movements=getMovements();const pairs=getPairs();
  const nextR=s.currentRound+1;
  if(nextR>s.roundCount){
    showTableFinalResults(tableNo);
    return;
  }

  // Current round info for who's playing right now at this table
  const curM=movements[s.currentRound+'_'+tableNo]||{};
  const curNS=pairs[curM.ns]||{name:'—'};
  const curEW=pairs[curM.ew]||{name:'—'};

  // Swiss: next round's pairing may not exist yet (still waiting on other
  // tables to finish). Show a polling "waiting for pairing" screen instead
  // of the move instructions until it's ready.
  if(s.movement==='swiss'&&!movements[nextR+'_1']){
    document.getElementById('panelContent').innerHTML=`
      <div class="bm-device" style="max-width:360px;">
        <div class="round-over-screen">
          <div class="ro-badge">⏳</div>
          <div class="ro-title">Round ${s.currentRound} Complete</div>
          <div class="ro-sub">Waiting for other tables to finish so Round ${nextR}'s pairing can be calculated…</div>
        </div>
      </div>`;
    if(bmPollInterval)clearInterval(bmPollInterval);
    bmPollInterval=setInterval(()=>{
      maybeAdvanceSwissRound(); // redundant trigger — safe/idempotent
      if(getMovements()[nextR+'_1']){
        clearInterval(bmPollInterval);bmPollInterval=null;
        bmShowRoundOver(tableNo); // re-render now that pairing exists
      }
    },2000);
    return;
  }

  // Find each pair's own next-round table by searching for their ID directly
  // (movement-agnostic — works whether they land as NS or EW, at any table).
  function findNextTable(pairId){
    if(!pairId)return null;
    for(const mk in movements){
      if(!mk.startsWith(nextR+'_'))continue;
      const mv=movements[mk];
      if(mv.ns===pairId||mv.ew===pairId)return parseInt(mk.split('_')[1]);
    }
    return null;
  }
  const nsNextTable=findNextTable(curM.ns);
  const ewNextTable=findNextTable(curM.ew);
  const nsStays=nsNextTable===tableNo;
  const ewStays=ewNextTable===tableNo;
  const nextM=movements[nextR+'_'+tableNo]||{};

  document.getElementById('panelContent').innerHTML=`
    <div class="bm-device" style="max-width:360px;">
      <div class="round-over-screen">
        <div class="ro-badge">🔔</div>
        <div class="ro-title">Round ${s.currentRound} Complete</div>
        <div class="ro-sub">Move instructions below</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0;">
          <div class="ro-move-card">
            <div class="ro-move-label">🔵 NS Pair</div>
            <div class="ro-move-main">${nsStays?'Stay at Table '+tableNo:'→ Table '+(nsNextTable||'?')}</div>
            <div style="font-size:0.75rem;color:var(--text2);">${curNS.name}</div>
          </div>
          <div class="ro-move-card">
            <div class="ro-move-label">🟡 EW Pair</div>
            <div class="ro-move-main">${ewStays?'Stay at Table '+tableNo:'→ Table '+(ewNextTable||'?')}</div>
            <div style="font-size:0.75rem;color:var(--text2);">${curEW.name}</div>
          </div>
        </div>
        <div class="ro-move-card" style="margin-bottom:14px;">
          <div class="ro-move-label">📋 Next Round ${nextR} — Boards</div>
          <div class="ro-move-boards">B${nextM.boardStart||'?'} – B${nextM.boardEnd||'?'}</div>
        </div>
        <button class="btn btn-gold btn-full" onclick="bmShowWaiting(${tableNo},${nextR})">OK — Show Waiting Screen →</button>
        <button class="btn btn-ghost btn-full" style="margin-top:8px;" onclick="bgChangeTable()">🔄 Change table</button>
      </div>
    </div>`;
};

window.bmShowWaiting=function(tableNo,nextR){
  // nextR is passed explicitly — never computed from currentRound (which may already have advanced)
  const movements=getMovements();const pairs=getPairs();
  const nextM=movements[nextR+'_'+tableNo]||{};
  const nextNS=pairs[nextM.ns]||{name:'—',isPhantom:false};
  const nextEW=pairs[nextM.ew]||{name:'—',isPhantom:false};

  document.getElementById('panelContent').innerHTML=`
    <div class="bm-device" style="max-width:360px;">
      <div class="bm-lcd">
        <div class="bm-lcd-row inv">Table ${String(tableNo).padStart(2,' ')}  ·  Round ${String(nextR).padStart(2,' ')}</div>
        <div class="bm-lcd-row">Waiting for Players</div>
        <div class="bm-lcd-row blink">🔵 ${(nextNS.name||'').slice(0,12)}  🟡 ${(nextEW.name||'').slice(0,12)}</div>
        <div class="bm-lcd-row">Boards ${nextM.boardStart||'?'} – ${nextM.boardEnd||'?'}</div>
      </div>
      <div class="waiting-screen">
        <div class="waiting-icon">⏳</div>
        <div class="waiting-title">Waiting for players</div>
        <div class="waiting-sub">Please take your seats at Table ${tableNo}</div>
      </div>
      <button class="btn btn-gold btn-full" style="margin-top:16px;" onclick="bmShowNewPlayers(${tableNo},${nextR})">Players seated →</button>
      <button class="btn btn-ghost btn-full" style="margin-top:8px;" onclick="bgChangeTable()">🔄 Change table</button>
    </div>`;
};

window.bmShowNewPlayers=function(tableNo,roundNo){
  bmTableNo=tableNo; // ensure set before subscribe fires
  const movements=getMovements();const pairs=getPairs();const s=getState();
  const m=movements[roundNo+'_'+tableNo]||{};
  // the players came in through "Table No" and gave their names first: they sit down at once
  let pend=null; try{ pend=JSON.parse(sessionStorage.getItem(BG_PENDING)||'null'); sessionStorage.removeItem(BG_PENDING); }catch(e){}
  if(pend&&pend.t===tableNo){
    const p=getPairs();
    if(m.ns&&p[m.ns]&&(pend.N||pend.S)) p[m.ns].name=joinPairName(pend.N||'',pend.S||'');
    if(m.ew&&p[m.ew]&&(pend.E||pend.W)) p[m.ew].name=joinPairName(pend.E||'',pend.W||'');
    setPairs(p);
    if(pend.N||pend.S||pend.E||pend.W) addLog('ok','Player names entered',`T${tableNo} R${roundNo}: ${joinPairName(pend.N||'',pend.S||'')} vs ${joinPairName(pend.E||'',pend.W||'')}`);
    lockTable(tableNo); bmStartNewRound(tableNo,roundNo); return;
  }
  const nsPair=pairs[m.ns]||{name:'',isPhantom:false};
  const ewPair=pairs[m.ew]||{name:'',isPhantom:false};
  const [ns1,ns2]=splitPairName(nsPair.name);
  const [ew1,ew2]=splitPairName(ewPair.name);
  const hasNames=ns1||ns2||ew1||ew2;

  // Determine if names already entered (from admin or previous entry)
  // Show editable fields always so players can confirm/correct
  document.getElementById('panelContent').innerHTML=`
    <div class="bm-device" style="max-width:380px;">
      <div class="new-players-screen">
        <div class="np-title">✅ Round ${roundNo} — Table ${tableNo}</div>
        <p style="font-size:0.78rem;color:var(--text2);text-align:center;margin-bottom:14px;">Please confirm or enter your names</p>

        <div style="background:var(--bluedim);border:1px solid rgba(91,155,213,0.25);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px;">
          <div style="font-size:0.68rem;font-weight:700;color:var(--blue);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">🔵 North-South</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <input id="ns1inp" value="${ns1}" data-member placeholder="Member number or name"
              style="padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.88rem;outline:none;font-family:inherit;width:100%;">
            <input id="ns2inp" value="${ns2}" data-member placeholder="Member number or name"
              style="padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.88rem;outline:none;font-family:inherit;width:100%;">
          </div>
        </div>

        <div style="background:var(--golddim);border:1px solid rgba(201,168,76,0.25);border-radius:var(--radius-sm);padding:12px;margin-bottom:14px;">
          <div style="font-size:0.68rem;font-weight:700;color:var(--gold);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">🟡 East-West</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <input id="ew1inp" value="${ew1}" data-member placeholder="Member number or name"
              style="padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.88rem;outline:none;font-family:inherit;width:100%;">
            <input id="ew2inp" value="${ew2}" data-member placeholder="Member number or name"
              style="padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.88rem;outline:none;font-family:inherit;width:100%;">
          </div>
        </div>

        <div style="background:var(--surface2);border-radius:8px;padding:10px 12px;margin-bottom:14px;text-align:center;">
          <div style="font-size:0.65rem;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Boards to play</div>
          <div style="font-size:1.3rem;font-weight:700;color:var(--gold);">B${m.boardStart||'?'} – B${m.boardEnd||'?'}</div>
          <div style="font-size:0.75rem;color:var(--text2);margin-top:2px;">${(m.boardEnd||3)-(m.boardStart||1)+1} boards this round</div>
        </div>

        <button class="btn btn-green btn-full" onclick="bmConfirmPlayersAndStart(${tableNo},${roundNo},'${m.ns||''}','${m.ew||''}')">✅ Confirm — Start Playing</button>
      </div>
    </div>`;

  // Focus first empty field + wire autocomplete
  setTimeout(()=>{
    const f=['ns1inp','ns2inp','ew1inp','ew2inp'].find(id=>!document.getElementById(id)?.value);
    if(f)document.getElementById(f)?.focus();
    // Autocomplete from PlayerDB
    const suggestions = PlayerDB.getAll();
    if(suggestions.length){
      ['ns1inp','ns2inp','ew1inp','ew2inp'].forEach(id=>{
        const inp = document.getElementById(id); if(!inp)return;
        inp.setAttribute('list','playerSuggestions');
      });
      let dl = document.getElementById('playerSuggestions');
      if(!dl){ dl=document.createElement('datalist'); dl.id='playerSuggestions'; document.body.appendChild(dl); }
      dl.innerHTML = suggestions.slice(0,50).map(n=>`<option value="${n.replace(/"/g,'&quot;')}">`).join('');
    }
  },80);
};

window.bmConfirmPlayersAndStart=async function(tableNo,roundNo,nsId,ewId){
  // a member number not yet turned into a name: look it up now
  const val=async id=>{ let v=(document.getElementById(id)?.value||'').trim(); if(/^[0-9]{1,8}$/.test(v)) v=(await memberName(v))||v; return v; };
  const ns1=await val('ns1inp'), ns2=await val('ns2inp'), ew1=await val('ew1inp'), ew2=await val('ew2inp');
  const p=getPairs();
  if(nsId&&p[nsId]){p[nsId].name=joinPairName(ns1,ns2);}
  if(ewId&&p[ewId]){p[ewId].name=joinPairName(ew1,ew2);}
  setPairs(p);
  // Save to local player memory
  PlayerDB.save([ns1,ns2,ew1,ew2].filter(Boolean));
  if(ns1||ns2||ew1||ew2)addLog('ok','Player names entered',`T${tableNo} R${roundNo}: ${joinPairName(ns1,ns2)} vs ${joinPairName(ew1,ew2)}`);
  // Re-lock for the new round
  lockTable(tableNo);
  bmStartNewRound(tableNo,roundNo);
};

window.bmStartNewRound=function(tableNo,roundNo){
  const s=getState();
  if(s.currentRound<roundNo){
    toast('⏳ The director has not started Round '+roundNo+' yet. Please wait...');
    if(bmPollInterval)clearInterval(bmPollInterval);
    bmPollInterval=setInterval(()=>{
      const s2=getState();
      if(s2.currentRound>=roundNo){
        clearInterval(bmPollInterval);bmPollInterval=null;
        bmTableNo=tableNo;
        renderTableDetail(tableNo);
      }
    },3000);
    return;
  }
  bmTableNo=tableNo;
  renderTableDetail(tableNo);
};

window.bmEditPairNames=function(tableNo){
  const s=getState();const m=getMovements()[s.currentRound+'_'+tableNo]||{};
  const pairs=getPairs();
  openModal('Edit Pair Names',`
    <div class="field"><label>NS Pair (${m.ns||'—'})</label><input id="ePairNS" value="${pairs[m.ns]?.name||''}"></div>
    <div class="field"><label>EW Pair (${m.ew||'—'})</label><input id="ePairEW" value="${pairs[m.ew]?.name||''}"></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-gold" onclick="savePairNames('${m.ns}','${m.ew}',${tableNo})">Save</button>`);
};
window.savePairNames=function(nsId,ewId,tableNo){
  const p=getPairs();
  const nsName=document.getElementById('ePairNS').value.trim();
  const ewName=document.getElementById('ePairEW').value.trim();
  if(nsId&&nsName)p[nsId]={...p[nsId],name:nsName};
  if(ewId&&ewName)p[ewId]={...p[ewId],name:ewName};
  setPairs(p);addLog('ok','Pair names updated',`${nsName} / ${ewName}`);
  toast('✅ Saved');closeModal();renderTableDetail(tableNo);
};

// ── Board Entry Form ──
window.bmEnterBoard=function(boardNo){
  const vuln=getVuln(boardNo);
  const key=bmTableNo+'_'+getState().currentRound+'_'+boardNo;
  const existing=getBoards()[key];
  boardForm={level:null,suit:null,declarer:null,result:0,doubled:'',leadSuit:'',leadRank:'',isPass:false,vuln,boardNo};
  if(!existing)boardForm._startTime=Date.now();
  renderBoardForm(boardNo,vuln,existing);
};

function renderBoardForm(boardNo,vuln,existing){
  if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
  const s=getState();
  const m=getMovements()[s.currentRound+'_'+bmTableNo]||{};
  const vulCls=vuln==='Both'?'both':vuln==='NS'?'ns':vuln==='EW'?'ew':'none';
  const vulTxt=vuln==='Both'?'BOTH VUL':vuln==='None'?'NO VUL':vuln+' VUL';
  const num=x=>(x||'').replace(/[^0-9]/g,'')||'?';
  // Bridgemate III: a colour touch screen; every step is one tap on a large key
  document.getElementById('panelContent').innerHTML=`
    <div class="bm3">
      <div class="bm3-screen">
        <div class="bm3-bar">
          <span class="td">${CLUB_NAME?'🏛':'♠'}</span>
          <div class="ev"><b>${s.name||'Bridge Tournament'}</b>Table ${bmTableNo} – Round ${s.currentRound}</div>
        </div>
        <div class="bm3-head">
          <div class="bm3-board"><small>Board</small><b>${boardNo}</b><span class="bm3-vul ${vulCls}">${vulTxt}</span></div>
          ${existing?'<div class="bm3-edit">editing</div>':''}
          <div class="bm3-pairs"><div><i>NS</i>${num(m.ns)}</div><div><i>EW</i>${num(m.ew)}</div></div>
        </div>
        <div class="bm3-display">
          <div class="bm3-contract" id="lcdContr">—</div>
          <div class="bm3-sub"><span id="lcdLead">Lead: —</span><span id="lcdResult">Result: —</span></div>
          <div class="bm3-score"><small>NS</small><b id="spVal">—</b></div>
        </div>

        <div class="bm3-step">Contract</div>
        <div class="bm3-keys k4">
          ${[1,2,3,4,5,6,7].map(l=>`<button class="bm3-key" id="lv${l}" onclick="setLvl(${l})">${l}</button>`).join('')}
          <button class="bm3-key pass" id="lvP" onclick="setPass()">PASS</button>
        </div>
        <div class="bm3-keys k5">
          <button class="bm3-key suit" id="s♣" onclick="setSuit('♣')">♣</button>
          <button class="bm3-key suit red" id="s♦" onclick="setSuit('♦')">♦</button>
          <button class="bm3-key suit red" id="s♥" onclick="setSuit('♥')">♥</button>
          <button class="bm3-key suit" id="s♠" onclick="setSuit('♠')">♠</button>
          <button class="bm3-key suit" id="sNT" onclick="setSuit('NT')">NT</button>
        </div>
        <div class="bm3-keys k3">
          <button class="bm3-key" id="lvN" onclick="setDbl('')">—</button>
          <button class="bm3-key dbl" id="lvX" onclick="setDbl('X')">X</button>
          <button class="bm3-key dbl" id="lvXX" onclick="setDbl('XX')">XX</button>
        </div>

        <div class="bm3-step">Declarer</div>
        <div class="bm3-keys k4">
          <button class="bm3-key ns" id="dN" onclick="setDecl('N')">N</button>
          <button class="bm3-key ew" id="dE" onclick="setDecl('E')">E</button>
          <button class="bm3-key ns" id="dS" onclick="setDecl('S')">S</button>
          <button class="bm3-key ew" id="dW" onclick="setDecl('W')">W</button>
        </div>

        <!-- the opening lead once the contract and declarer are in, the result once the lead is -->
        <div id="bm3Lead" style="display:none">
        <div class="bm3-step">Opening lead</div>
        <div class="bm3-keys k4">
          <button class="bm3-key suit" id="ld♣" onclick="setLeadSuit('♣')">♣</button>
          <button class="bm3-key suit red" id="ld♦" onclick="setLeadSuit('♦')">♦</button>
          <button class="bm3-key suit red" id="ld♥" onclick="setLeadSuit('♥')">♥</button>
          <button class="bm3-key suit" id="ld♠" onclick="setLeadSuit('♠')">♠</button>
        </div>
        <div class="bm3-keys k7 small">
          ${['A','K','Q','J','10','9','8','7','6','5','4','3','2'].map(r=>`<button class="bm3-key" id="lr${r}" onclick="setLeadRank('${r}')">${r}</button>`).join('')}
        </div>
        </div>
        <div id="bm3Res" style="display:none">
        <div class="bm3-step">Result <small id="resLabel"></small></div>
        <div class="bm3-keys k7" id="resTiles"></div>
        </div>

        <div class="bm3-actions">
          <button class="bm3-cancel" onclick="renderTableDetail(${bmTableNo})">✕ Cancel</button>
          <button class="bm3-ok" onclick="saveBoardAndSendApproval(${boardNo})">✓ OK</button>
        </div>
      </div>
    </div>`;
  renderResTiles();
  if(existing&&!existing.adjusted&&existing.level){
    setLvl(existing.level);setSuit(existing.suit);setDecl(existing.declarer);
    setDbl(existing.doubled||'');
    boardForm.result=existing.result||0;renderResTiles();
    if(existing.leadSuit)setLeadSuit(existing.leadSuit);
    if(existing.leadRank)setLeadRank(existing.leadRank);
    updateLCD();updateScore();
  } else if(existing&&existing.contract==='PASS') setPass();
  else setDbl('');
}

const bm3Mark=(prefix,id)=>{ document.querySelectorAll('[id^="'+prefix+'"]').forEach(b=>b.classList.remove('active')); document.getElementById(id)?.classList.add('active'); };
function setLvl(l){
  boardForm.level=l;boardForm.isPass=false;
  ['lv1','lv2','lv3','lv4','lv5','lv6','lv7','lvP'].forEach(i=>document.getElementById(i)?.classList.remove('active'));
  document.getElementById('lv'+l)?.classList.add('active');
  // a new level: the result keys change (from all tricks lost to all made)
  if(boardForm.result<-(l+6)||boardForm.result>7-l) boardForm.result=0;
  renderResTiles();updateLCD();updateScore();
}
function setPass(){
  boardForm.isPass=true;boardForm.level=null;
  ['lv1','lv2','lv3','lv4','lv5','lv6','lv7'].forEach(i=>document.getElementById(i)?.classList.remove('active'));
  document.getElementById('lvP')?.classList.add('active');
  renderResTiles();updateLCD();updateScore();
}
window.setDbl=function(d){
  boardForm.doubled=d||'';
  ['lvN','lvX','lvXX'].forEach(i=>document.getElementById(i)?.classList.remove('active'));
  document.getElementById(d==='X'?'lvX':d==='XX'?'lvXX':'lvN')?.classList.add('active');
  updateLCD();updateScore();
};
function setSuit(s){ boardForm.suit=s; bm3Mark('s','s'+s); updateLCD();updateScore(); }
function setDecl(d){ boardForm.declarer=d; ['dN','dE','dS','dW'].forEach(i=>document.getElementById(i)?.classList.remove('active')); document.getElementById('d'+d)?.classList.add('active'); updateLCD();updateScore(); }
function setLeadSuit(s){ boardForm.leadSuit=s; bm3Mark('ld','ld'+s); updateLCD(); bm3ShowScore(); }
function setLeadRank(r){ boardForm.leadRank=r; bm3Mark('lr','lr'+r); updateLCD(); bm3ShowScore(); }
// the scoring part of the Bridgemate screen, once the opening lead is complete (or PASS)
function bm3ShowScore(){
  const f=boardForm, show=(id,on)=>{ const el=document.getElementById(id); if(!el) return; const was=el.style.display!=='none'; el.style.display=on?'':'none'; if(on&&!was) el.scrollIntoView({behavior:'smooth',block:'start'}); };
  const contract=!f.isPass&&f.level&&f.suit&&f.declarer, lead=contract&&f.leadSuit&&f.leadRank;
  show('bm3Lead',contract); show('bm3Res',lead);
}
window.setRes=function(n){ boardForm.result=n; renderResTiles(); updateLCD(); updateScore(); };
window.adjRes=function(n){ setRes(boardForm.result+n); };
// the result keys: every possible number of tricks for this contract (= made exactly, +1 … overtricks, -1 … down)
function renderResTiles(){
  const box=document.getElementById('resTiles'); if(!box) return;
  const lb=document.getElementById('resLabel');
  if(boardForm.isPass){ box.innerHTML='<div class="bm3-note">Passed out</div>'; if(lb) lb.textContent=''; return; }
  const l=boardForm.level;
  if(!l){ box.innerHTML='<div class="bm3-note">Choose the contract first</div>'; if(lb) lb.textContent=''; return; }
  const vals=[]; for(let v=7-l; v>=-(l+6); v--) vals.push(v);
  box.innerHTML=vals.map(v=>`<button class="bm3-key res${v>0?' over':v<0?' down':' made'}${v===boardForm.result?' active':''}" onclick="setRes(${v})">${v===0?'=':v>0?'+'+v:v}</button>`).join('');
  const r=boardForm.result;
  if(lb) lb.textContent=window.i18nText?window.i18nText(r>0?`+${r} overtrick${r>1?'s':''}`:r<0?`${Math.abs(r)} down`:'made exactly'):(r>0?`+${r} overtrick${r>1?'s':''}`:r<0?`${Math.abs(r)} down`:'made exactly');
}
function updateResDisp(){ renderResTiles(); }
function updateScore(){
  bm3ShowScore();   // the next step (lead, result) as soon as this one is complete
  const el=document.getElementById('spVal');if(!el)return;
  if(boardForm.isPass){ el.textContent='0'; el.className=''; return; }
  if(!boardForm.level||!boardForm.suit||!boardForm.declarer){el.textContent='—';el.className='';return;}
  const s=calcScore(boardForm.level,boardForm.suit,boardForm.declarer,boardForm.result,boardForm.vuln,boardForm.doubled);
  el.textContent=(s>0?'+':'')+s;
  el.className=s>0?'pos':s<0?'neg':'';
}
function updateLCD(){
  const lc=document.getElementById('lcdContr');const ll=document.getElementById('lcdLead');const lr=document.getElementById('lcdResult');
  if(!lc)return;
  let contr='—';
  if(boardForm.isPass)contr='PASS';
  else if(boardForm.level){
    const su=boardForm.suit?(boardForm.suit==='♦'||boardForm.suit==='♥'?`<span class="red">${boardForm.suit}</span>`:boardForm.suit):'';
    contr=boardForm.level+su+(boardForm.doubled||'')+(boardForm.declarer?' '+boardForm.declarer:'');
  }
  lc.innerHTML=contr;
  const lead=boardForm.leadSuit&&boardForm.leadRank?boardForm.leadSuit+boardForm.leadRank:boardForm.leadSuit||'—';
  const L=v=>window.i18nText?window.i18nText(v):v;
  ll.textContent=L('Lead: '+lead);
  const r=boardForm.result;
  lr.textContent=L('Result: '+(boardForm.isPass?'PASS':!boardForm.level?'—':r>0?'+'+r:r<0?String(r):'='));
}

// Save board and send to opponent for approval
window.saveBoardAndSendApproval=function(boardNo){
  const key=bmTableNo+'_'+getState().currentRound+'_'+boardNo;
  let boardData={};
  const s=getState();

  if(boardForm.isPass){
    boardData={contract:'PASS',nsScore:0,ewScore:0,level:null,suit:null,declarer:null,result:0,doubled:'',lead:'',vuln:boardForm.vuln,adjusted:false};
  } else {
    if(!boardForm.level||!boardForm.suit||!boardForm.declarer){toast('❌ Select level, suit and declarer');return;}
    if(!boardForm.leadSuit||!boardForm.leadRank){toast('❌ Choose the opening lead');return;}   // every result is entered with its opening lead
    const nsScore=calcScore(boardForm.level,boardForm.suit,boardForm.declarer,boardForm.result,boardForm.vuln,boardForm.doubled);
    const contract=boardForm.level+boardForm.suit+(boardForm.doubled||'')+' '+boardForm.declarer+(boardForm.result>=0?' +'+(boardForm.result||'='):(boardForm.result));
    const lead=boardForm.leadSuit&&boardForm.leadRank?boardForm.leadSuit+boardForm.leadRank:'';
    boardData={contract,level:boardForm.level,suit:boardForm.suit,declarer:boardForm.declarer,result:boardForm.result,doubled:boardForm.doubled,lead,leadSuit:boardForm.leadSuit||'',leadRank:boardForm.leadRank||'',vuln:boardForm.vuln,nsScore,ewScore:-nsScore,adjusted:false};
  }
  if(boardForm._startTime){
    boardData.durationSec = Math.round((Date.now()-boardForm._startTime)/1000);
  }

  // Store pending approval
  const aps=getApprovals();
  aps[key]={...boardData,status:'pending',side:bmSide,sentTime:new Date().toISOString()};
  setApprovals(aps);
  addLog('ok',`Board ${boardNo} sent for approval`,`Table ${bmTableNo} | ${boardData.contract}`);

  // Show approval waiting screen
  renderApprovalWaiting(boardNo,boardData,key);
};

function getOtherTablesSameBoard(boardNo,myTableNo,myRound){
  const boards=getBoards();const movements=getMovements();const pairs=getPairs();
  const approvals=getApprovals();
  const results=[];
  Object.entries(movements).forEach(([mk,m])=>{
    const parts=mk.split('_');if(parts.length!==2)return;
    const r=parseInt(parts[0]);const t=parseInt(parts[1]);
    // Skip my own table+round combo
    if(t===myTableNo&&r===myRound)return;
    if(boardNo>=m.boardStart&&boardNo<=m.boardEnd){
      const bkey=t+'_'+r+'_'+boardNo;
      const ns=pairs[m.ns]||{name:m.ns||'?'};
      const ew=pairs[m.ew]||{name:m.ew||'?'};
      // Check completed boards
      const bd=boards[bkey];
      if(bd&&bd.status==='done'&&typeof bd.nsScore==='number'){
        results.push({table:t,round:r,ns:ns.name,ew:ew.name,nsScore:bd.nsScore,contract:bd.contract||'?',pending:false});
        return;
      }
      // Don't show pending approvals as completed results
    }
  });
  return results;
}

function renderApprovalWaiting(boardNo,boardData,key){
  const s=getState();
  const nsScore=boardData.nsScore;
  const scoreStr=typeof nsScore==='number'?(nsScore>0?'+':'')+nsScore:'PASS';
  const scoreColor=typeof nsScore==='number'?(nsScore>0?'var(--green)':nsScore<0?'var(--red)':'var(--gold)'):'var(--gold)';

  function buildOtherHTML(){
    // Don't show other tables' results on the approval screen — board isn't finished yet
    return '';
  }
  const otherTablesHTML=buildOtherHTML();
  document.getElementById('panelContent').innerHTML=`
    <div class="bm-device" style="max-width:360px;">
      <div class="bm-lcd">
        <div class="bm-lcd-row inv">Board ${String(boardNo).padStart(2,' ')} — Awaiting Approval</div>
        <div class="bm-lcd-row">Contract: ${(boardData.contract||'PASS')}</div>
        <div class="bm-lcd-row">NS Score: ${String(scoreStr)}</div>
        <div class="bm-lcd-row blink" style="color:var(--gold);">Waiting for opponent to confirm...</div>
      </div>
      <div class="approval-screen">
        <div class="approval-title">⏳ Waiting for opponent to confirm</div>
        <div class="approval-contract">${boardData.contract||'PASS'}</div>
        <div class="approval-score" style="color:${scoreColor};">NS: ${scoreStr}</div>
        <div class="approval-waiting">Waiting for opponent device to confirm...</div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-ghost btn-full" onclick="bmCancelApproval('${key}');renderTableDetail(${bmTableNo});">✕ Cancel</button>
          <button class="btn btn-green btn-full" onclick="bmSelfApprove('${key}',${bmTableNo})">✅ Both Agreed</button>
        </div>
      </div>
    </div>`;

  // Poll for approval + refresh other tables info
  if(bmPollInterval)clearInterval(bmPollInterval);
  bmPollInterval=setInterval(()=>{
    const aps=getApprovals();
    const ap=aps[key];
    if(!ap||ap.status==='approved'){
      clearInterval(bmPollInterval);bmPollInterval=null;
      const bs=getBoards();
      if(!bs[key]||bs[key].status!=='done'){
        bs[key]={...boardData,status:'done',time:new Date().toISOString()};
        setBoards(bs);
        delete aps[key];setApprovals(aps);
      }
      addLog('ok','Board '+boardNo+' approved',boardData.contract||'PASS');
      toast('✅ Approved! Next board.');
      renderTableDetail(bmTableNo);
    }
  },1500);
};

// Quick self-approve (both sides agree, only one device)
window.bmSelfApprove=function(key,tableNo){
  const aps=getApprovals();
  const ap=aps[key];if(!ap)return;
  const bs=getBoards();
  bs[key]={...ap,status:'done',time:new Date().toISOString()};
  setBoards(bs);
  delete aps[key];setApprovals(aps);
  if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
  addLog('ok',`Board approved (self)`,key);
  toast('✅ Score saved!');
  renderTableDetail(tableNo);
};

// ══════════════════════════════════════════════════════
