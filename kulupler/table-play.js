//  TABLE LOCK SYSTEM — Soft warning only
//  tableLocks: { "round_tableNo": { lockedAt } }
// ══════════════════════════════════════════════════════
const getTableLocks=()=>_cache['tableLocks']||{};
const setTableLocks=l=>DB.set('tableLocks',l);

function tableLockKey(tableNo){
  return getState().currentRound+'_'+tableNo;
}
function lockTable(tableNo){
  window._bgSatAt=window._bgSatAt||Date.now();
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
  const locks=getTableLocks(), l=locks[tableLockKey(tableNo)];
  return !!l&&(l.lockedAt||0)>=(Date.parse(getState()._startedAt||0)||0);   // a lock from the last tournament does not count
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
    let n=window.bmCodeTable;
    { const sv=bmSeatOf(CLUB_ID); if(sv&&sv.c===window._bgCode&&sv.sid&&sv.sid===s._startedAt&&+sv.r===+s.currentRound&&+sv.t>0&&+sv.t<=s.tableCount) n=window.bmCodeTable=+sv.t; }
    if(n<1||n>s.tableCount){ c.innerHTML=`<div class="empty-state"><div class="empty-icon">❌</div><div style="font-weight:600;">Table ${n} is not in this tournament</div></div>`; return; }
    const seat=bmSeatOf(CLUB_ID);
    if(seat&&+seat.t===+n&&+seat.r===+s.currentRound&&seat.sid&&seat.sid===s._startedAt&&Date.now()-seat.at<12*3600e3){ lockTable(n); bmTableNo=n; renderTableDetail(n); return; }   // back at its table (the phone slept)
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
  document.body.classList.add('bg-device');
  const box=document.querySelector('#loginScreen .login-box'); if(!box) return;
  ['clubGate','loginForm'].forEach(id=>{const el=document.getElementById(id); if(el) el.style.display='none';});
  let pe=document.getElementById('playerEntry');
  if(!pe){ pe=document.createElement('div'); pe.id='playerEntry'; box.appendChild(pe); }
  const s=await DB.get('state')||{};
  // the tables taken this round are not offered
  const lk=await DB.get('tableLocks')||{}, t0=Date.parse(s._startedAt||0)||0, taken=new Set(Object.keys(lk).filter(k=>k.startsWith(s.currentRound+'_')&&((lk[k]&&lk[k].lockedAt)||0)>=t0).map(k=>+k.split('_')[1]));
  if(s.status!=='running'){ pe.innerHTML=`<div class="empty-state"><div class="empty-icon">⏳</div><div style="font-weight:600;margin-bottom:4px;">Tournament not started</div><div style="font-size:0.82rem;">Ask the director to start the tournament</div></div><button class="btn-primary" onclick="bgPlayerEntry('${prefix}')">↻</button>`; return; }
  pe.innerHTML=`<div class="bm-lcd" style="text-align:center;margin-bottom:10px;"><div class="bm-lcd-row inv" style="display:inline-block;">${s.name||'BridgeGate'}</div><div class="bm-lcd-row" style="text-align:center;color:var(--text);">Select your table number</div></div>
    <div class="bm3-keys k4" style="padding:0;">${Array.from({length:s.tableCount||0},(_,i)=>i+1).filter(n=>!taken.has(n)).map(n=>`<button class="bm3-key" onclick="bgPlayerNames('${prefix}',${n})">${n}</button>`).join('')}</div>`;
};
// the four players at the chosen table, drawn as the table: North at the top, South at the bottom, West and East at the sides
const BG_SEATS={N:'North',S:'South',E:'East',W:'West'};
window.bgPlayerNames=function(prefix,n){
  document.body.classList.add('bg-device');
  let pe=document.getElementById('playerEntry');
  if(!pe){ const box=document.querySelector('#loginScreen .login-box'); if(!box) return; ['clubGate','loginForm'].forEach(id=>{const el=document.getElementById(id); if(el) el.style.display='none';}); pe=document.createElement('div'); pe.id='playerEntry'; box.appendChild(pe); }
  if(!window._bgEntry||window._bgEntry.n!==n) window._bgEntry={prefix,n,seats:{N:'',S:'',E:'',W:''}};
  const st=window._bgEntry.seats;
  const seat=k=>`<button class="pe-pos pe-${k}" onclick="bgSeatEdit('${k}')"><small>${BG_SEATS[k]}</small><b>${st[k]?cleanData(st[k]):'＋'}</b></button>`;
  // the boards this table plays first: fetched from the board box before sitting down
  const s0=getState(), mv=getMovements()[s0.currentRound+'_'+n];
  if(!mv&&!window._bgMovLoad){ window._bgMovLoad=1; Promise.all([DB.get('movements'),DB.get('state')]).then(()=>{ window._bgMovLoad=0; if(window._bgEntry&&window._bgEntry.n===n) bgPlayerNames(prefix,n); }).catch(()=>{ window._bgMovLoad=0; }); }
  const brd=mv?`<div class="pe-boards"><div><span>Boards</span> <b>${mv.boardStart}${mv.boardEnd!==mv.boardStart?' – '+mv.boardEnd:''}</b></div><small>Take these boards to the table</small></div>`:'';
  pe.innerHTML=`${brd}<div class="pe-table">${seat('N')}${seat('W')}<div class="pe-mid">Table ${n}</div>${seat('E')}${seat('S')}</div>
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:12px;"><button class="btn btn-ghost" onclick="bgLeaveEntry('${prefix}')">🚪 Leave the table</button><button class="btn-primary" style="margin:0;" onclick="bgPlayerSit()">Continue →</button></div>`;
};
// one seat: a member number (its name is shown at once) or a name; OK goes back to the table
window.bgSeatEdit=function(k){
  window._bgSeatK=k;
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
    if(!/^\d{1,8}$/.test(v)){
      // a name or surname: the members it fits, with their numbers
      if(v.length<2){ out.textContent=''; return; }
      const L=await memberSearch(v);
      if((document.getElementById('peInput')?.value||'').trim()!==v) return;
      out.className='pe-found pe-list';
      out.innerHTML=L.map(m=>`<button type="button" class="pe-pick" onclick="bgSeatPick('${m.num}')">👤 ${m.name} <small>${m.num}</small></button>`).join('');
      return;
    }
    const name=await memberName(v);
    if((document.getElementById('peInput')?.value||'').trim()!==v) return;
    out.textContent=name?'👤 '+name:'❓ '+v; out.className='pe-found'+(name?' ok':' no');
  },250);
};
// a member chosen from the names found: seated at once
window.bgSeatPick=async function(num){
  const e=window._bgEntry, k=window._bgSeatK; if(!e||!k) return;
  const name=await memberName(num); if(!name) return;
  e.seats[k]=name.slice(0,40); bgPlayerNames(e.prefix,e.n);
};
window.bgSeatOk=async function(k){
  const e=window._bgEntry; if(!e) return;
  let v=(document.getElementById('peInput')?.value||'').trim();
  if(/^\d{1,8}$/.test(v)){
    let name=await memberName(v);
    if(!name){
      // not in the list: the player's name, kept with the number for the next time
      const nm=(document.getElementById('peName')?.value||'').trim();
      if(!nm){ const out=document.getElementById('peFound'); if(out){ out.className='pe-found no'; out.innerHTML=`❓ ${v}<input id="peName" class="pe-input" maxlength="40" autocomplete="off" placeholder="${i18nText('Name and surname')}" style="margin-top:8px;" onkeydown="if(event.key==='Enter')bgSeatOk('${k}')">`; setTimeout(()=>document.getElementById('peName')?.focus(),50); } return; }
      name=nm.slice(0,60); addMember(v,name);
    }
    v=name;
  }
  e.seats[k]=v.slice(0,40);
  bgPlayerNames(e.prefix,e.n);
};
// sign this phone in at that table (prefix + number); its names go to the pairs sitting there
window.bgPlayerSit=async function(){
  const e=window._bgEntry; if(!e) return;
  try{ sessionStorage.setItem(BG_PENDING,JSON.stringify({t:e.n,...e.seats})); }catch(err){}
  window._bgEntry=null;
  document.getElementById('playerEntry')?.remove();
  document.getElementById('loginForm').style.display='block';
  window._bgWantTable=e.n; selRole('table');
  const cl=document.getElementById('clubLinks'); if(cl) cl.style.display='none';
  // the table's code from the running tournament (no code to type); a club without codes: prefix + table number
  let lv=null; try{ const r=await fetch(await fbRootUrl('/live/'+CLUB_ID+'.json'),{cache:'no-store'}); lv=r.ok?await r.json():null; }catch(err){}
  const code=lv&&lv.k?lv.k['t'+e.n]:lv?e.prefix+String(e.n).padStart(2,'0'):null;
  if(code){
    const inp=document.getElementById('pwInput'), w=document.getElementById('pwWrap'); inp.value=code; if(w) w.style.display='none';
    await doLogin();
    // not signed in (a tournament started before the codes went with it): the player types the code
    if(document.getElementById('app').style.display!=='flex'){ if(w) w.style.display='block'; inp.value=''; inp.focus(); }
    return;
  }
  setTimeout(()=>document.getElementById('pwInput')?.focus(),80);   // no code known: the player types it
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
  refreshTopbar(); bmSeatSave(tableNo);
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
  // Social Bridge: a board another table is playing now (taken in the last 40 minutes and not finished there) is busy
  const social=!!m.social, locks=social?(_cache['boardLocks']||{}):{}, busyAt=b=>{ const l=locks[b]; if(!l||+l.t===+tableNo||Date.now()-(l.at||0)>40*60e3) return 0; return boards[l.t+'_'+s.currentRound+'_'+b]?.status==='done'?0:+l.t; };
  const nextBoard=boardList.find(bl=>!(bl.data&&bl.data.status==='done')&&!busyAt(bl.boardNo))||boardList.find(bl=>!(bl.data&&bl.data.status==='done'));
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
  // a played board's MP % and IMP against the other tables that have finished it (from this table's side)
  const cmpOf=bl=>{
    if(!(bl.data&&bl.data.status==='done'&&typeof bl.data.nsScore==='number')) return '';
    const o=getOtherTablesSameBoard(bl.boardNo,tableNo,s.currentRound); if(!o.length) return '';
    let mp=0,imp=0; o.forEach(x=>{mp+=bl.data.nsScore>x.nsScore?2:bl.data.nsScore===x.nsScore?1:0; imp+=scoreToIMP(bl.data.nsScore-x.nsScore);});
    let pct=Math.round(mp/(2*o.length)*1000)/10, im=imp/o.length;
    if(bmSide==='ew'){ pct=Math.round((100-pct)*10)/10; im=-im; }
    return `MP ${pct}% · IMP ${fmtImp(im)}`;
  };

  const allDone=doneCount===totalBoards&&totalBoards>0;
  if(allDone)unlockTable(tableNo); // Remove lock — table finished
  window._bgEndOf=allDone&&s.currentRound<s.roundCount?s.currentRound:null;
  if(allDone&&s.currentRound<s.roundCount) bgAutoNextRound();
  let actionHTML='';
  if(allDone){
    if(s.currentRound<s.roundCount){
      actionHTML=`<button class="btn btn-gold btn-full" style="margin-top:10px;" onclick="bmShowRoundOver(${tableNo},${s.currentRound})">▶ Round Complete — Continue</button>`;
    } else {
      actionHTML=`<div class="next-round-card">
        <div class="nr-title">🏁 Tournament Finished</div>
        <div class="nr-main" style="font-size:1rem;margin-bottom:8px;">All boards completed</div>
        <div class="nr-detail" style="margin-bottom:14px;">Results can be viewed on the Screen display</div>
        <button class="btn btn-ghost btn-full" onclick="doLogout()" style="font-size:0.82rem;">← Log Out</button>
      </div>`;
    }
  }

  // the four players round the table (North at the top), as on a BridgeScore
  const [pN,pS]=splitPairName(nsPair.isPhantom?'':nsPair.name), [pE,pW]=splitPairName(ewPair.isPhantom?'':ewPair.name);
  // the boards of this round as large tiles: a played one with its score, the next one to tap
  const tiles=boardList.map(bl=>{
    const done=bl.data&&bl.data.status==='done', pend=approvalPending&&approvalPending.boardNo===bl.boardNo;
    const isNext=!done&&!pend&&!approvalPending&&nextBoard&&nextBoard.boardNo===bl.boardNo;
    const score=done&&typeof bl.data.nsScore==='number'?(bl.data.nsScore>0?'+':'')+bl.data.nsScore+' NS':done?'✓':'';
    const cmp=cmpOf(bl);
    const busy=!done&&!pend&&busyAt(bl.boardNo);
    return `<button class="sbb${done?' me':''}${isNext?' some':''}${pend?' pend':''}${busy?' busy':''}" ${done?`onclick="bmShowOthers(${bl.boardNo},1)"`:!pend&&!approvalPending&&!busy?`onclick="bmEnterBoard(${bl.boardNo})"`:'disabled'}><b>${bl.boardNo}</b><small>${done?'✓ '+score:pend?'⏳':busy?'🔒 '+busy:isNext?'▶':'—'}</small>${cmp?`<i>${cmp}</i>`:''}</button>`;
  }).join('');
  document.getElementById('panelContent').innerHTML=`
    <div class="bm3t">
      <div class="bm3t-pairs"><div><i>NS ${nsNum}</i><b>${[pN,pS].filter(Boolean).map(cleanData).join(' – ')||'—'}</b></div><div><i>EW ${ewNum}</i><b>${[pE,pW].filter(Boolean).map(cleanData).join(' – ')||'—'}</b></div></div>
      ${isPhantom?`<div class="bm3t-note">👻 Phantom pair — sit out</div>`:''}
      ${allDone?`<div class="bm3-step">All Boards Complete ✓</div>`:''}
      <div class="sbgrid">${tiles}</div>
      ${approvalPending?`<div class="bm3t-pendrow">${boardsHTML}</div>`:''}
      <div id="boardsSection">${actionHTML}</div>
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

  // the other tables' results and the double dummy are on each finished board's own screen (tap its tile)
  if(typeof DB!=='undefined'&&Date.now()-(window._bgHandsAt||0)>15000){ window._bgHandsAt=Date.now(); Promise.all([DB.get('hands'),DB.get('dd')]).catch(()=>{}); }

  // Auto-poll for approvals
  if(bmPollInterval)clearInterval(bmPollInterval);
  bmPollInterval=setInterval(()=>bmPollApprovals(tableNo),1500);
}

function bmPollApprovals(tableNo){
  const s=getState();
  const m=getMovements()[s.currentRound+'_'+tableNo]||{};
  if(m.social&&Date.now()-(window._bgLockT||0)>5000){ window._bgLockT=Date.now(); const was=JSON.stringify(_cache['boardLocks']||{}); Promise.all([DB.get('boardLocks'),DB.get('boards')]).then(()=>{ if(JSON.stringify(_cache['boardLocks']||{})!==was&&document.querySelector('.sbgrid')&&!document.getElementById('modalBg')?.classList.contains('open')) renderTableDetail(tableNo); }).catch(()=>{}); }
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

window.bmShowRoundOver=function(tableNo,rnd){
  if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
  const s=getState(), cr=rnd||s.currentRound;
  window._bgEndOf=cr;
  const movements=getMovements();const pairs=getPairs();
  const nextR=cr+1;
  if(nextR>s.roundCount){
    showTableFinalResults(tableNo);
    return;
  }

  // Current round info for who's playing right now at this table
  const curM=movements[cr+'_'+tableNo]||{};
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
          <div class="ro-title">Round ${cr} Complete</div>
          <div class="ro-sub">Waiting for other tables to finish so Round ${nextR}'s pairing can be calculated…</div>
        </div>
      </div>`;
    if(bmPollInterval)clearInterval(bmPollInterval);
    bmPollInterval=setInterval(()=>{
      maybeAdvanceSwissRound(); // redundant trigger — safe/idempotent
      if(getMovements()[nextR+'_1']){
        clearInterval(bmPollInterval);bmPollInterval=null;
        bmShowRoundOver(tableNo,cr); // re-render now that pairing exists
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
        <div class="ro-title">Round ${cr} Complete</div>
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
        ${bgStandingsHtml()}
        <button class="btn btn-gold btn-full" onclick="bgMoveTo(${(bmSide==='ew'?ewNextTable:nsNextTable)||tableNo},${nextR},${tableNo})">OK — ${(bmSide==='ew'?ewNextTable:nsNextTable)&&(bmSide==='ew'?ewNextTable:nsNextTable)!==tableNo?'→ Table '+(bmSide==='ew'?ewNextTable:nsNextTable):'Show Waiting Screen →'}</button>
      </div>
    </div>`;
};

// the standings after this round: every pair's matchpoints (%) and IMPs so far, best first
function bgStandingsHtml(){
  const P=getPairs(), mp=calcMP(), L=(window.i18nText?i18nText:x=>x);
  const rows=Object.entries(mp).filter(([id])=>P[id]&&!P[id].isPhantom).map(([id,x])=>({name:P[id].name||id,pct:x.top?Math.round(x.mp/x.top*1000)/10:0,imp:x.imp})).sort((a,b)=>b.pct-a.pct||b.imp-a.imp);
  if(!rows.length) return '';
  return `<div class="ro-move-card" style="margin-bottom:14px;text-align:left;"><div class="ro-move-label">🏆 ${L('Standings')}</div><table style="width:100%;font-size:0.8rem;border-collapse:collapse;">${rows.map((r,i)=>`<tr style="border-top:1px solid var(--border);"><td style="padding:3px 4px;">${i+1}</td><td style="padding:3px 4px;">${cleanData(r.name)}</td><td style="padding:3px 4px;text-align:right;">${r.pct}%</td><td style="padding:3px 4px;text-align:right;">${fmtImp(r.imp)}</td></tr>`).join('')}</table></div>`;
}
// the names of a table not sat at yet: back to Bridge Table's Clubs (or this program's table numbers) to choose again
window.bgLeaveEntry=function(prefix){
  window._bgEntry=null;
  try{ const P=window.parent; if(P&&P!==window&&typeof P.closeClubs==='function'){ const U=P.eval('ui'), id=CLUB_ID; P.closeClubs(); if(typeof P.showClubs==='function'){ U.clubOpen=id; U.clubLive=null; P.showClubs(); if(P.clubTaken) P.clubTaken(id).then(x=>{ (U.clubTaken=U.clubTaken||{})[id]=x.taken; P.showClubs(); }); } return; } }catch(e){}
  bgPlayerEntry(prefix);
};
// the director took this device off its table: back to Bridge Table's Clubs (no question asked)
window.bgKicked=async function(){
  if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
  bmTableNo=null; window.bmCodeTable=null; window._bgSatAt=null;
  try{ await endSession(); }catch(e){}
  try{ const P=window.parent; if(P&&P!==window&&typeof P.closeClubs==='function'){ P.closeClubs(); if(typeof P.flash==='function') P.flash('🚪 '+(window.i18nText?i18nText('The director took you off the table.'):'The director took you off the table.'),3500); return; } }catch(e){}
  location.reload();
};
// the wrong table chosen: it is free again, and the player chooses again in Bridge Table's Clubs
window.bgLeaveTable=async function(){
  const L=window.i18nText?i18nText:x=>x;
  if(!await confirmDialog(L('Leave this table? It becomes free again and you choose your table again.'),{title:'🚪',confirmLabel:L('Leave the table'),danger:false})) return;
  const t=bmTableNo; bmSeatForget(); if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
  try{ if(t){ const lk=getTableLocks(); delete lk[tableLockKey(t)]; await DB.set('tableLocks',lk); } }catch(e){}   // written before the page goes away
  try{ if(typeof bgTestOn==='function'&&bgTestOn()) sessionStorage.removeItem('bgTestMine:'+CLUB_ID); }catch(e){}
  bmTableNo=null; window.bmCodeTable=null;
  try{ await endSession(); }catch(e){}
  // inside Bridge Table: back to its Clubs, with the tables as they are now
  try{ const P=window.parent; if(P&&P!==window&&typeof P.closeClubs==='function'){ const U=P.eval('ui'), id=CLUB_ID; P.closeClubs(); if(typeof P.showClubs==='function'){ U.clubOpen=id; U.clubLive=null; P.showClubs(); if(P.clubTaken) P.clubTaken(id).then(x=>{ (U.clubTaken=U.clubTaken||{})[id]=x.taken; P.showClubs(); }); } return; } }catch(e){}
  location.reload();
};
// this device goes with its pair: the next round's table (the waiting screen there; the scores are entered there)
window.bgMoveTo=function(t,nextR,from){
  window._bgEndOf=null;
  // a test tournament: this table has seen where to go; the next round may start
  if(typeof bgTestOn==='function'&&bgTestOn()){ DB.get('ready').then(v=>{ const r=v||{}; r[(nextR-1)+'_'+from]=true; DB.set('ready',r); }).catch(()=>{}); }
  // the pair moves: this device leaves its table now (another device may take it) and goes with its player straight
  // to the new table (no number to type); there the new players confirm who sits where and the boards follow.
  // Whoever signs out leaves the table free: another player picks its number and goes on.
  if(t!==from){ try{ unlockTable(from); }catch(e){} bmTableNo=null; window.bmCodeTable=null; bgAutoSit(t,nextR,from); return; }
  bmShowWaiting(t,nextR);
};
// the new table taken by this device; if another phone already has it open there, the player chooses: this phone
// too, or the table numbers (the old screen) to sit elsewhere
window.bgAutoSit=async function(t,nextR,from){
  const L=window.i18nText?i18nText:x=>x;
  if(isTableLocked(t)&&!await confirmDialog(L('Table {0} is already open on another phone. Go on with this phone too?').replace('{0}',t),{title:'Table '+t,confirmLabel:L('Go on with this phone'),danger:false})){ bgNewTableEntry(t,nextR,from); return; }
  lockTable(t); bmTableNo=t; window.bmCodeTable=t;
  try{ if(typeof bgTestOn==='function'&&bgTestOn()) sessionStorage.setItem('bgTestMine:'+CLUB_ID,String(t)); }catch(e){}
  bmShowWaiting(t,nextR);
};
window.bgNewTableEntry=function(t,nextR,from){
  if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
  const s=getState(), n=s.tableCount||0;
  document.getElementById('panelContent').innerHTML=`
    <div class="bm-device" style="max-width:360px;">
      <div class="bm-lcd">
        <div class="bm-lcd-row inv">Round ${String(nextR).padStart(2,' ')}</div>
        <div class="bm-lcd-row">→ Table ${t}</div>
      </div>
      <div class="waiting-screen">
        <div class="waiting-icon">🚶</div>
        <div class="waiting-title">Go to your new table</div>
        <div class="waiting-sub">At the table, type its number</div>
      </div>
      <div class="bm3-keys k4" style="padding:0;margin-top:12px;">${Array.from({length:n},(_,i)=>i+1).map(k=>`<button class="bm3-key" onclick="bgNewTablePick(${k},${t},${nextR})">${k}</button>`).join('')}</div>
    </div>`;
};
window.bgNewTablePick=async function(k,t,nextR){
  const L=window.i18nText?i18nText:x=>x;
  if(k!==t&&!await confirmDialog(L('This is not the table your pair goes to.')+' (→ '+t+')',{title:'Table '+k,confirmLabel:L('Sit here anyway'),danger:false})) return;
  if(isTableLocked(k)&&!await confirmDialog(`Table ${k} already appears open on another device.\n\nDo you still want to enter this table?`,{title:'Table Already Open',confirmLabel:'Enter Anyway'})) return;
  lockTable(k); bmTableNo=k; window.bmCodeTable=k;
  try{ if(typeof bgTestOn==='function'&&bgTestOn()) sessionStorage.setItem('bgTestMine:'+CLUB_ID,String(k)); }catch(e){}
  bmShowWaiting(k,nextR);
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
  if(typeof bgTestOn==='function'&&bgTestOn()&&m.ns&&pairs[m.ns]){ const u=window.bridgeUser&&window.bridgeUser(), nm=u&&(u.name||u.key); const [a,b]=splitPairName(pairs[m.ns].name); if(nm&&a!==nm){ pairs[m.ns].name=joinPairName(nm,b||a); setPairs(pairs); } }
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
        <button class="btn btn-ghost btn-full" style="margin-top:8px;" onclick="bgLeaveTable()">🚪 Leave the table</button>
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
    toast('⏳ The next round starts when every table has finished this round');
    if(bmPollInterval)clearInterval(bmPollInterval);
    bmPollInterval=setInterval(()=>{
      if(typeof bgAutoNextRound==='function') bgAutoNextRound();
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
  const m0=bmXM()[bmRound()+'_'+bmTableNo]||{};
  if(m0.social&&bmTableNo&&!window._tdEdit){ (async()=>{ try{ const L=(await DB.get('boardLocks'))||{}, put=async(b,v)=>fetch(await fbUrl('/boardLocks/'+b+'.json'),{method:'PUT',body:JSON.stringify(v)});
    for(const [b,l] of Object.entries(L)) if(l&&+l.t===+bmTableNo&&+b!==+boardNo) await put(b,null);
    await put(boardNo,{t:bmTableNo,at:Date.now()}); const N={}; for(const [b,l] of Object.entries(L)) if(!(l&&+l.t===+bmTableNo)) N[b]=l; N[boardNo]={t:bmTableNo,at:Date.now()}; _cache['boardLocks']=N; }catch(e){} })(); }
  const vuln=getVuln(boardNo);
  const key=bmTableNo+'_'+bmRound()+'_'+boardNo;
  const existing=bmXB()[key]||(window._tdEdit&&!bmArc()?getApprovals()[key]:null);   // the TD: a result still waiting for the OK is corrected too
  boardForm={level:null,suit:null,declarer:null,result:0,doubled:'',leadSuit:'',leadRank:'',isPass:false,vuln,boardNo};
  if(!existing)boardForm._startTime=Date.now();
  renderBoardForm(boardNo,vuln,existing);
};

// BridgeScore, one step a screen (each fits a phone): the contract → who played it (the compass: North at the top
// with the player's name, South below, East and West at the sides) → the opening lead → the tricks declarer took →
// the result to confirm. After the opponents' approval: the other tables' results on this board, then the next board
let bmStepNo = 'contract';
const BM_DIRS = ['N', 'E', 'S', 'W'];
function renderBoardForm(boardNo, vuln, existing) {
  if (bmPollInterval) { clearInterval(bmPollInterval); bmPollInterval = null; }
  if (existing && existing.notPlayed) boardForm.notPlayed = true;
  else if (existing && existing.contract === 'PASS') boardForm.isPass = true;
  else if (existing && !existing.adjusted && existing.level) Object.assign(boardForm, { level: existing.level, suit: existing.suit, declarer: existing.declarer, doubled: existing.doubled || '', result: existing.result || 0, leadSuit: existing.leadSuit || '', leadRank: existing.leadRank || '', _tricksSet: true });
  boardForm._editing = !!existing;
  bmStepNo = 'contract'; bm3Draw();
}
// the names of a pair's two players ("A & B" at the club, "A – B" online)
const bmNames = p => { const n = String((p && p.name) || ''); if (!n || /^(NS|EW|Pair|Par|Çift)\s*\d+$/i.test(n.trim())) return ['', '']; const x = n.includes(' & ') ? n.split(' & ') : n.split(/\s+[–-]\s+/); return [x[0] || '', x[1] || '']; };
const bmTricks = () => boardForm.level ? boardForm.level + 6 + (boardForm.result || 0) : null;
function bm3Score() { const f = boardForm; return f.notPlayed ? null : f.isPass ? 0 : f.level && f.suit && f.declarer ? calcScore(f.level, f.suit, f.declarer, f.result || 0, f.vuln, f.doubled) : null; }
// each suit its own colour: ♠ navy, ♥ red, ♦ orange, ♣ green
const bmSuitCls = x => ({ '♠': 'sS', '♥': 'sH', '♦': 'sD', '♣': 'sC' })[x] || '';
function bm3Draw() {
  const L = v => window.i18nText ? i18nText(v) : v, f = boardForm, s = bmXS(), boardNo = f.boardNo;
  const m = bmXM()[bmRound() + '_' + bmTableNo] || {}, P = bmXP(), num = x => (x || '').replace(/[^0-9]/g, '') || '?';
  const vuln = f.vuln, vulCls = vuln === 'Both' ? 'both' : vuln === 'NS' ? 'ns' : vuln === 'EW' ? 'ew' : 'none', vulTxt = vuln === 'Both' ? 'BOTH VUL' : vuln === 'None' ? 'NO VUL' : vuln + ' VUL';
  const red = x => x === '♦' || x === '♥';
  const su = x => x ? `<span class="${bmSuitCls(x)}">${x}</span>` : '';
  const contr = f.notPlayed ? L('Not played') : f.isPass ? 'PASS' : f.level ? f.level + su(f.suit) + (f.doubled || '') + (f.declarer ? ' ' + f.declarer : '') : '—';
  const lead = f.leadSuit && f.leadRank ? su(f.leadSuit) + f.leadRank : '—', tr = bmTricks(), sc = bm3Score();
  const resTxt = f.isPass ? 'PASS' : tr == null || !f.declarer || bmStepNo === 'contract' || bmStepNo === 'decl' || bmStepNo === 'lead' || !f._tricksSet ? '—' : f.result === 0 ? '=' : f.result > 0 ? '+' + f.result : String(f.result);
  const key = (on, label, act, cls) => `<button class="bm3-key${cls ? ' ' + cls : ''}${on ? ' active' : ''}" onclick="${act}">${label}</button>`;
  let body = '', back = '', next = '';
  if (bmStepNo === 'contract') {
    body = `<div class="bm3-step">${L('Contract')}</div>
      <div class="bm3-keys k4">${[1, 2, 3, 4, 5, 6, 7].map(l => key(f.level === l && !f.isPass, l, `bmSet('lvl',${l})`)).join('')}${key(f.isPass, 'PASS', "bmSet('pass')", 'pass')}</div>
      <div class="bm3-keys k1">${key(f.notPlayed, L('Not played'), "bmSet('np')", 'np')}</div>
      <div class="bm3-keys k5">${['♣', '♦', '♥', '♠', 'NT'].map(x => key(f.suit === x && !f.isPass, x, `bmSet('suit','${x}')`, 'suit ' + bmSuitCls(x))).join('')}</div>
      <div class="bm3-keys k3">${key(!f.doubled, '—', "bmSet('dbl','')")}${key(f.doubled === 'X', 'X', "bmSet('dbl','X')", 'dbl')}${key(f.doubled === 'XX', 'XX', "bmSet('dbl','XX')", 'dbl')}</div>`;
    back = `<button class="bm3-cancel" onclick="bmEntryCancel()">✕ ${L('Cancel')}</button>`;
    next = `<button class="bm3-ok" onclick="bmGo(1)"${f.isPass || f.notPlayed || (f.level && f.suit) ? '' : ' disabled'}>${L('Next')} ›</button>`;
  } else if (bmStepNo === 'decl') {
    const [n1, s1] = bmNames(P[m.ns]), [e1, w1] = bmNames(P[m.ew]), nm = { N: n1, S: s1, E: e1, W: w1 };
    const seat = d => `<button class="bm3-seat ${d === 'N' || d === 'S' ? 'ns' : 'ew'}${f.declarer === d ? ' active' : ''}" onclick="bmSet('decl','${d}')"><b>${d}</b><small>${cleanData(nm[d] || '')}</small></button>`;
    body = `<div class="bm3-step">${L('Who played the contract?')}</div>
      <div class="bm3-compass"><span></span>${seat('N')}<span></span>${seat('W')}<div class="bm3-tbl">${contr}</div>${seat('E')}<span></span>${seat('S')}<span></span></div>`;
    back = `<button class="bm3-cancel" onclick="bmGo(-1)">‹ ${L('Back')}</button>`;
    next = `<button class="bm3-ok" onclick="bmGo(1)"${f.declarer ? '' : ' disabled'}>${L('Next')} ›</button>`;
  } else if (bmStepNo === 'lead') {
    body = `<div class="bm3-step">${L('Opening lead')}</div>
      <div class="bm3-keys k4">${['♣', '♦', '♥', '♠'].map(x => key(f.leadSuit === x, x, `bmSet('ls','${x}')`, 'suit ' + bmSuitCls(x))).join('')}</div>
      <div class="bm3-keys k7">${['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'].map(r => key(f.leadRank === r, r, `bmSet('lr','${r}')`)).join('')}</div>`;
    back = `<button class="bm3-cancel" onclick="bmGo(-1)">‹ ${L('Back')}</button>`;
    next = `<button class="bm3-ok" onclick="bmGo(1)"${f.leadSuit && f.leadRank ? '' : ' disabled'}>${L('Next')} ›</button>`;
  } else if (bmStepNo === 'tricks') {
    body = `<div class="bm3-step">${L('Tricks taken by declarer')}</div>
      <div class="bm3-keys k7">${[...Array(14).keys()].map(t => key(tr === t && f._tricksSet, (t - f.level - 6 === 0 ? "=" : (t - f.level - 6 > 0 ? "+" : "") + (t - f.level - 6)) + `<small>${t}</small>`, `bmSet('tr',${t})`, t >= f.level + 6 ? 'res made' : 'res down')).join('')}</div>`;
    back = `<button class="bm3-cancel" onclick="bmGo(-1)">‹ ${L('Back')}</button>`;
    next = `<button class="bm3-ok" onclick="bmGo(1)"${f._tricksSet ? '' : ' disabled'}>${L('Next')} ›</button>`;
  } else {   // the result to confirm
    const rr = f.notPlayed ? L('Not played') : f.isPass ? L('Passed out') : f.result === 0 ? L('made exactly') : f.result > 0 ? '+' + f.result + ' ' + L('overtricks') : Math.abs(f.result) + ' ' + L('down');
    body = `<div class="bm3-step">${L('Check and confirm')}</div>
      <div class="bm3-final"><b>${rr}</b>${f.isPass || f.notPlayed ? '' : `<span>${tr} ${L('tricks')}</span>`}</div>`;
    back = `<button class="bm3-cancel" onclick="bmGo(-1)">‹ ${L('Back')}</button>`;
    next = `<button class="bm3-ok" onclick="saveBoardAndSendApproval(${boardNo})">✓ OK</button>`;
  }
  document.getElementById('panelContent').innerHTML = `
    <div class="bm3 bm3w">
      <div class="bm3-screen">
        <div class="bm3-bar"><span class="td">${CLUB_NAME ? '🏛' : '♠'}</span><div class="ev"><b>${cleanData(s.name || 'Bridge Tournament')}</b>${L('Table')} ${bmTableNo} – ${L('Round')} ${bmRound()}</div>${bmBarBtns()}</div>
        <div class="bm3-head">
          <div class="bm3-board"><small>${L('Board')}</small><b>${boardNo}</b><span class="bm3-vul ${vulCls}">${vulTxt}</span></div>
          ${f._editing ? `<div class="bm3-edit">${L('editing')}</div>` : ''}
          <div class="bm3-pairs"><div><i>NS</i>${num(m.ns)}</div><div><i>EW</i>${num(m.ew)}</div></div>
        </div>
        <div class="bm3-display">
          <div class="bm3-contract">${contr}</div>
          <div class="bm3-sub"><span>${L('Lead')}: ${lead}</span><span>${L('Result')}: ${resTxt}</span></div>
          <div class="bm3-score"><small>NS</small><b>${sc == null || bmStepNo !== 'confirm' && !f.isPass ? '—' : (sc > 0 ? '+' : '') + sc}</b></div>
        </div>
        <div class="bm3-body">${body}</div>
        <div class="bm3-actions">${back}${next}</div>
      </div>
    </div>`;
}
const BM_STEPS = ['contract', 'decl', 'lead', 'tricks', 'confirm'];
window.bmGo = function (d) {
  const f = boardForm; let i = BM_STEPS.indexOf(bmStepNo) + d;
  if (f.isPass || f.notPlayed) i = d > 0 ? BM_STEPS.length - 1 : 0;   // passed out: from the contract straight to the result
  bmStepNo = BM_STEPS[Math.max(0, Math.min(BM_STEPS.length - 1, i))]; bm3Draw();
};
// a key: the step's choice; a step with one choice goes on by itself
window.bmSet = function (k, v) {
  const f = boardForm;
  if (k === 'np') { (async () => { if (!f.notPlayed && !await bmTdAuth()) return; f.notPlayed = !f.notPlayed; if (f.notPlayed) Object.assign(f, { isPass: false, level: null, suit: null, declarer: null, doubled: '', result: 0, leadSuit: '', leadRank: '' }); bm3Draw(); })(); return; }
  if (k !== 'dbl') f.notPlayed = false;
  if (k === 'lvl') { f.level = v; f.isPass = false; }
  else if (k === 'pass') { f.isPass = !f.isPass; if (f.isPass) Object.assign(f, { level: null, suit: null, declarer: null, doubled: '', result: 0, leadSuit: '', leadRank: '' }); }
  else if (k === 'suit') { f.suit = v; f.isPass = false; }
  else if (k === 'dbl') f.doubled = v;
  else if (k === 'decl') { f.declarer = v; bm3Draw(); setTimeout(() => { if (bmStepNo === 'decl') bmGo(1); }, 220); return; }
  else if (k === 'ls') f.leadSuit = v;
  else if (k === 'lr') { f.leadRank = v; if (f.leadSuit) { bm3Draw(); setTimeout(() => { if (bmStepNo === 'lead') bmGo(1); }, 220); return; } }
  else if (k === 'tr') { f.result = v - (f.level + 6); f._tricksSet = true; bm3Draw(); setTimeout(() => { if (bmStepNo === 'tricks') bmGo(1); }, 220); return; }
  bm3Draw();
};
// after the approval: the other tables' results on this board (and this table's), then the next board's number
window.bmShowOthers = function (boardNo, back) {
  if (bmPollInterval) { clearInterval(bmPollInterval); bmPollInterval = null; }
  const L = v => window.i18nText ? i18nText(v) : v, s = getState(), mine = getBoards()[bmTableNo + '_' + s.currentRound + '_' + boardNo];
  const o = getOtherTablesSameBoard(boardNo, bmTableNo, s.currentRound).filter(x => !x.pending);
  const row = (t, c, sc, me) => `<div class="bm3-orow${me ? ' me' : ''}"><span>${L('Table')} ${t}</span><span>${cleanData(c || '')}</span><b>${typeof sc === 'number' ? (sc > 0 ? '+' : '') + sc : '—'}</b></div>`;
  document.getElementById('panelContent').innerHTML = `
    <div class="bm3 bm3w"><div class="bm3-screen">
      <div class="bm3-bar"><span class="td">${CLUB_NAME ? '🏛' : '♠'}</span><div class="ev"><b>${cleanData(s.name || 'Bridge Tournament')}</b>${L('Table')} ${bmTableNo} – ${L('Round')} ${s.currentRound}</div>${bmBarBtns()}</div>
      <div class="bm3-display"><div class="bm3-contract">${L('Board')} ${boardNo} ✓</div><div class="bm3-sub"><span>${L('Other tables on this board')}</span></div></div>
      <div class="bm3-body"><div class="bm3-others">${mine ? row(bmTableNo, mine.contract, mine.nsScore, true) : ''}${o.map(x => row(x.table, x.contract, x.nsScore)).join('') || `<div class="bm3-note">${L('No other table has finished this board yet.')}</div>`}</div></div>
      ${typeof ccShowDD === 'function' && (_cache['hands'] || []).some(h => String(h.board) === String(boardNo)) ? `<div class="bm3-tdtools" style="grid-template-columns:1fr"><button class="btn" onclick="ccShowDD('${boardNo}')">🎯 ${L('Double dummy')}</button></div>` : ''}
      <div class="bm3-actions">${back ? `<span></span><button class="bm3-ok" onclick="renderTableDetail(${bmTableNo})">‹ ${L('Table')}</button>` : `<span></span><button class="bm3-ok" onclick="bmAskNext()">${L('Continue')} ›</button>`}</div>
    </div></div>`;
};
// the next board: its number asked (the boards of this round not yet played here); none left: the table's screen
window.bmAskNext = function () {
  const L = v => window.i18nText ? i18nText(v) : v, s = getState(), m = getMovements()[s.currentRound + '_' + bmTableNo] || {}, B = getBoards(), left = [];
  for (let b = m.boardStart || 1; b <= (m.boardEnd || 0); b++) if (!(B[bmTableNo + '_' + s.currentRound + '_' + b] || {}).status) left.push(b);
  if (!left.length) { renderTableDetail(bmTableNo); return; }
  document.getElementById('panelContent').innerHTML = `
    <div class="bm3 bm3w"><div class="bm3-screen">
      <div class="bm3-bar"><span class="td">${CLUB_NAME ? '🏛' : '♠'}</span><div class="ev"><b>${cleanData(s.name || 'Bridge Tournament')}</b>${L('Table')} ${bmTableNo} – ${L('Round')} ${s.currentRound}</div>${bmBarBtns()}</div>
      <div class="bm3-display"><div class="bm3-contract">${L('Next board number?')}</div></div>
      <div class="bm3-body"><div class="bm3-keys k4">${left.map(b => `<button class="bm3-key" onclick="bmEnterBoard(${b})">${b}</button>`).join('')}</div></div>
      <div class="bm3-actions"><button class="bm3-cancel" onclick="renderTableDetail(${bmTableNo})">${L('Table')}</button><span></span></div>
    </div></div>`;
};

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
// the scoring part of the BridgeScore screen, once the opening lead is complete (or PASS)
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

  if(boardForm.notPlayed){
    boardData={contract:'Not played',notPlayed:true,vuln:boardForm.vuln,adjusted:false};
  } else if(boardForm.isPass){
    boardData={contract:'PASS',nsScore:0,ewScore:0,level:null,suit:null,declarer:null,result:0,doubled:'',lead:'',vuln:boardForm.vuln,adjusted:false};
  } else {
    if(!boardForm.level||!boardForm.suit||!boardForm.declarer){toast('❌ Select level, suit and declarer');return;}
    if(!boardForm.leadSuit||!boardForm.leadRank){toast('❌ Choose the opening lead');return;}   // every result is entered with its opening lead
    const nsScore=calcScore(boardForm.level,boardForm.suit,boardForm.declarer,boardForm.result,boardForm.vuln,boardForm.doubled);
    const contract=boardForm.level+boardForm.suit+(boardForm.doubled||'')+' '+boardForm.declarer+(boardForm.result>0?' +'+boardForm.result:boardForm.result===0?' =':' '+boardForm.result);
    const lead=boardForm.leadSuit&&boardForm.leadRank?boardForm.leadSuit+boardForm.leadRank:'';
    boardData={contract,level:boardForm.level,suit:boardForm.suit,declarer:boardForm.declarer,result:boardForm.result,doubled:boardForm.doubled,lead,leadSuit:boardForm.leadSuit||'',leadRank:boardForm.leadRank||'',vuln:boardForm.vuln,nsScore,ewScore:-nsScore,adjusted:false};
  }
  if(boardForm._startTime){
    boardData.durationSec = Math.round((Date.now()-boardForm._startTime)/1000);
  }

  // the TD's correction: saved at once, back to where the TD came from
  if(window._tdEdit&&bmArc()){ const k2=bmTableNo+'_'+bmRound()+'_'+boardNo, A=getArchives(), a=A[window._tdEdit.arc]; a.boards=a.boards||{}; a.boards[k2]={...boardData,status:'done',td:true,manualEdit:true,time:new Date().toISOString()}; setArchives(A); addLog('warn','TD: archived board corrected',(a.state&&a.state.name||'')+' '+k2+' '+(boardData.contract||'')); toast('✅ '+BM_L('Saved')); bmEntryCancel(); return; }
  if(window._tdEdit){ const k2=bmTableNo+'_'+bmRound()+'_'+boardNo, bs=getBoards(); bs[k2]={...boardData,status:'done',td:true,manualEdit:true,time:new Date().toISOString()}; setBoards(bs); const A=getApprovals(); if(A[k2]){ delete A[k2]; setApprovals(A); } addLog('warn','TD: board corrected',k2+' '+(boardData.contract||'')); toast('✅ '+BM_L('Saved')); bmEntryCancel(); return; }
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
  const scoreStr=typeof nsScore==='number'?(nsScore>0?'+':'')+nsScore:boardData.notPlayed?'—':'PASS';
  const scoreColor=typeof nsScore==='number'?(nsScore>0?'var(--green)':nsScore<0?'var(--red)':'var(--gold)'):'var(--gold)';

  function buildOtherHTML(){
    // Don't show other tables' results on the approval screen — board isn't finished yet
    return '';
  }
  const otherTablesHTML=buildOtherHTML();
  const L=v=>window.i18nText?i18nText(v):v;
  document.getElementById('panelContent').innerHTML=`
    <div class="bm3 bm3w"><div class="bm3-screen">
      <div class="bm3-display"><div class="bm3-contract">${L('Board')} ${boardNo} · ${cleanData(boardData.contract||'PASS')}</div><div class="bm3-sub"><span>${L('Lead')}: ${cleanData(boardData.lead||'—')}</span></div><div class="bm3-score"><small>NS</small><b style="color:${scoreColor}">${scoreStr}</b></div></div>
      <div class="bm3-step">⏳ ${L('Opponents: check and press OK')}</div>
      <div class="bm3-body"></div>
      <div class="bm3-actions"><button class="bm3-cancel" onclick="bmCancelApproval('${key}');renderTableDetail(${bmTableNo});">‹ ${L('Back')}</button><button class="bm3-ok" onclick="bmSelfApprove('${key}',${bmTableNo})">✓ OK</button></div>
    </div></div>`;

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
      toast('✅ Approved!');
      bmShowOthers(boardNo);
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
  bmShowOthers(+String(key).split('_')[2]);
};

// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
//  TD ON THE TABLE (BridgeScore): the players call the TD; the TD's menu opens with the club's password
// ══════════════════════════════════════════════════════
const BM_L=v=>window.i18nText?i18nText(v):v;
// the two buttons in the bar of every BridgeScore screen
window.bmBarBtns=()=>role==='table'&&bmTableNo?`<span class="bm3-tdbtns"><button type="button" class="bm3-tdcall" onclick="bmCallTD()">📣 ${BM_L('Call TD')}</button><button type="button" class="bm3-tdkey" onclick="bmTdMenu()">🧑‍⚖️ TD</button></span>`:'';
window.bmCallTD=async function(){
  if(!bmTableNo) return;
  if(!await confirmDialog(BM_L('Call the tournament director to this table?'),{title:'📣 '+BM_L('Call TD'),confirmLabel:'OK',danger:false})) return;
  await DB.set('tdcalls/'+bmTableNo,{t:bmTableNo,r:getState().currentRound,at:Date.now()});
  toast('📣 '+BM_L('The TD is called'));
};
// the TD's password: the club's password (checked by the database); it holds 10 minutes on this table
let _tdOk=0, _tdR=null;
function bmAskPw(){ return new Promise(res=>{
  window._tdPwRes=v=>{ window._tdPwRes=null; closeModal(); res(v); };
  openModal('🧑‍⚖️ TD',`<div class="field"><label>${BM_L('Club password')}</label><input id="tdPw" type="password" inputmode="numeric" autocomplete="off" onkeydown="if(event.key==='Enter')_tdPwRes(this.value.trim())"></div>`,
    `<button class="btn btn-ghost" onclick="_tdPwRes('')">${BM_L('Cancel')}</button><button class="btn btn-gold" onclick="_tdPwRes(document.getElementById('tdPw').value.trim())">OK</button>`);
  setTimeout(()=>document.getElementById('tdPw')?.focus(),80);
}); }
async function bmTdAuth(){
  if(Date.now()<_tdOk) return true;
  const pw=await bmAskPw(); if(!pw) return false;
  let ok=false; try{ ok=await startSession('admin',CLUB_ID,pw); }catch(e){}
  // only the check: this table keeps writing with its own session (not the TD's)
  { try{ const token=await authToken(); const uid=window._authUid; if(token&&uid) await fetch(FB_BASE+'/csess/'+uid+'.json?auth='+token,{method:'DELETE'}); }catch(e){} }
  if(!ok){ toast('❌ '+BM_L('Wrong password')); return false; }
  _tdOk=Infinity; return true;   // until the TD closes the menu
}
const bmTdText=d=>!d?'—':d.notPlayed?BM_L('Not played'):d.adjusted?'ADJ '+d.nsScore+' / '+d.ewScore:(d.contract||'')+(typeof d.nsScore==='number'?' · NS '+(d.nsScore>0?'+':'')+d.nsScore:'');
// the TD's menu: this table's rounds (‹ ›), each board's result with delete, not played and adjusted score
window.bmTdMenu=async function(r){
  if(!await bmTdAuth()) return;
  if(bmPollInterval){ clearInterval(bmPollInterval); bmPollInterval=null; }
  const s=getState(), t=bmTableNo; _tdR=Math.max(1,Math.min(s.currentRound||1,r||_tdR||s.currentRound||1));
  const m=getMovements()[_tdR+'_'+t]||{}, B=getBoards(), P=getPairs(), num=x=>(x||'').replace(/[^0-9]/g,'')||'?';
  let rows='';
  for(let b=m.boardStart||1;b<=(m.boardEnd||0);b++){
    const k=t+'_'+_tdR+'_'+b, d=B[k];
    rows+=`<div class="bm3-tdrow"><b onclick="bmTdEdit(${b})">${b}</b><span onclick="bmTdEdit(${b})">${cleanData(bmTdText(d))} <i class="tdgo">✏️ ${BM_L('Correct')}</i></span><div>
      <button onclick="bmTdEdit(${b})" title="${BM_L('Enter again')}">✏️</button>
      <button onclick="bmTdNP('${k}')">${BM_L('Not played')}</button><button onclick="bmTdAdj('${k}',${b})">ADJ</button>
      ${d?`<button class="del" onclick="bmTdDel('${k}',${b})">🗑</button>`:''}</div></div>`;
  }
  document.getElementById('panelContent').innerHTML=`
    <div class="bm3 bm3w"><div class="bm3-screen">
      <div class="bm3-bar"><span class="td">🧑‍⚖️</span><div class="ev"><b>${BM_L('TD menu')}</b>${BM_L('Table')} ${t}</div></div>
      <div class="bm3-tdnav"><button onclick="bmTdMenu(${_tdR-1})"${_tdR>1?'':' disabled'}>‹</button><b>${BM_L('Round')} ${_tdR}</b><span>NS ${num(m.ns)} – EW ${num(m.ew)}</span><button onclick="bmTdMenu(${_tdR+1})"${_tdR<s.currentRound?'':' disabled'}>›</button></div>
      <div class="bm3-body"><div class="bm3-tdlist">${rows||`<div class="bm3-note">${BM_L('No boards')}</div>`}</div></div>
      <div class="bm3-tdtools"><button class="btn" onclick="bmTdTable()">🔢 ${BM_L('Change table')}</button><button class="btn" onclick="bmTdPlayers()">👥 ${BM_L('Players')}</button></div>
      <div class="bm3-actions"><span></span><button class="bm3-ok" onclick="bmTdClose()">${BM_L('Close')}</button></div>
    </div></div>`;
};
window.bmTdClose=()=>{ _tdR=null; _tdOk=0; renderTableDetail(bmTableNo); };
const bmTdPut=(k,v)=>{ const B=getBoards(); if(v) B[k]=v; else delete B[k]; setBoards(B); const A=getApprovals(); if(A[k]){ delete A[k]; setApprovals(A); } };
window.bmTdDel=async function(k,b){
  if(!await confirmDialog(BM_L('Delete this board result? It cannot be undone; the board is entered again.'),{title:BM_L('Board')+' '+b,confirmLabel:BM_L('Delete')})) return;
  bmTdPut(k,null); addLog('warn','TD: result deleted',k); bmTdMenu(_tdR);
};
window.bmTdNP=function(k){ bmTdPut(k,{contract:'Not played',notPlayed:true,status:'done',td:true,time:new Date().toISOString()}); addLog('warn','TD: not played',k); bmTdMenu(_tdR); };
window.bmTdEdit=function(b){ window._tdEdit={back:'menu',r:_tdR}; bmEnterBoard(b); };
// an adjusted score: average minus, average or average plus for each side
window.bmTdAdj=function(k,b){ bmAdjScreen(k,b,(ns,ew)=>{ bmTdPut(k,{contract:`ADJ(${ns}/${ew})`,nsScore:ns,ewScore:ew,status:'done',adjusted:true,td:true,time:new Date().toISOString()}); addLog('warn','TD: adjusted score',k+' '+ns+'/'+ew); bmTdMenu(_tdR); },()=>bmTdMenu(_tdR)); };
// the adjusted score on a BridgeScore screen (used at a table and on the TD's screen)
let _adj=null;
window.bmAdjScreen=function(k,b,ok,back,cur){
  const d=cur||{}; _adj={k,b,ok,back,ns:d.adjusted?d.nsScore:'A',ew:d.adjusted?d.ewScore:'A'}; bmAdjDraw();
};
const ADJ_OPT=[['A-','Average minus','40%'],['A','Average','50%'],['A+','Average plus','60%']];
function bmAdjDraw(){
  const x=_adj, row=side=>`<div class="bm3-step">${side==='ns'?'NS':'EW'}</div><div class="bm3-keys k3">${ADJ_OPT.map(([v,n,p])=>`<button class="bm3-key adjk${x[side]===v?' active':''}" onclick="bmAdjSet('${side}','${v}')"><b>${v}</b><small>${BM_L(n)} · ${p}</small></button>`).join('')}</div>`;
  document.getElementById('panelContent').innerHTML=`<div class="bm3 bm3w"><div class="bm3-screen">
    <div class="bm3-display"><div class="bm3-contract">${BM_L('Board')} ${x.b} · ADJ</div><div class="bm3-sub"><span>${BM_L('Adjusted score')}</span></div><div class="bm3-score"><small>NS / EW</small><b>${x.ns} / ${x.ew}</b></div></div>
    <div class="bm3-body">${row('ns')}${row('ew')}</div>
    <div class="bm3-actions"><button class="bm3-cancel" onclick="bmAdjBack()">‹ ${BM_L('Back')}</button><button class="bm3-ok" onclick="bmAdjOk()">✓ OK</button></div></div></div>`;
}
window.bmAdjSet=(side,v)=>{ _adj[side]=v; bmAdjDraw(); };
window.bmAdjOk=()=>{ const x=_adj; _adj=null; x.ok(x.ns,x.ew); };
window.bmAdjBack=()=>{ const x=_adj; _adj=null; x.back(); };
// a pair sat down at the wrong table: this BridgeScore becomes the right table
window.bmTdTable=function(){
  const n=getState().tableCount||0;
  openModal('🔢 '+BM_L('Change table'),`<div class="bm3-keys k4">${Array.from({length:n},(_,i)=>i+1).map(k=>`<button class="bm3-key${k===bmTableNo?' active':''}" onclick="bmTdTableOk(${k})">${k}</button>`).join('')}</div>`,`<button class="btn btn-ghost" onclick="closeModal()">${BM_L('Cancel')}</button>`);
};
window.bmTdTableOk=function(k){
  closeModal(); if(k===bmTableNo){ bmTdMenu(_tdR); return; }
  try{ unlockTable(bmTableNo); }catch(e){}
  bmTableNo=k; window.bmCodeTable=k; lockTable(k); addLog('warn','TD: table changed','→ '+k); _tdR=null; _tdOk=0; renderTableDetail(k);
};
// the players' names at this table: a member number (NBF / TBF) or a name
window.bmTdPlayers=function(){ tdNames(bmTableNo,_tdR,'menu'); };
window.bmTdPlayersOld=function(){
  const s=getState(), m=getMovements()[(_tdR||s.currentRound)+'_'+bmTableNo]||{}, P=getPairs();
  const [n,so]=splitPairName((P[m.ns]||{}).name||''), [e,w]=splitPairName((P[m.ew]||{}).name||'');
  const f=(id,lab,v)=>`<div class="field"><label>${lab}</label><input id="${id}" value="${cleanData(v||'')}" data-member placeholder="${BM_L('Member number or name')}"></div>`;
  openModal('👥 '+BM_L('Players'),f('tdpN',BM_L('North'),n)+f('tdpS',BM_L('South'),so)+f('tdpE',BM_L('East'),e)+f('tdpW',BM_L('West'),w),
    `<button class="btn btn-ghost" onclick="closeModal()">${BM_L('Cancel')}</button><button class="btn btn-gold" onclick="bmTdPlayersOk('${m.ns||''}','${m.ew||''}')">OK</button>`);
};
window.bmTdPlayersOk=async function(ns,ew){
  const v=async id=>{ let x=(document.getElementById(id)?.value||'').trim(); if(/^[0-9]{1,8}$/.test(x)) x=(await memberName(x))||x; return x.slice(0,40); };
  const N=await v('tdpN'), S=await v('tdpS'), E=await v('tdpE'), W=await v('tdpW'), P=getPairs();
  if(ns&&P[ns]) P[ns].name=joinPairName(N,S); if(ew&&P[ew]) P[ew].name=joinPairName(E,W);
  setPairs(P); PlayerDB.save([N,S,E,W].filter(Boolean)); addLog('ok','TD: names',joinPairName(N,S)+' vs '+joinPairName(E,W)); closeModal(); bmTdMenu(_tdR);
};
// the TD's calls, on the TD's screen: each table that called, until the TD answers it
let _tdCallsSeen=0;
window.tdCallsShow=function(v){
  if(role!=='admin') return;
  let box=document.getElementById('tdCalls'); const L=Object.values(v||{}).filter(x=>x&&x.t).sort((a,b)=>a.at-b.at);
  if(!L.length){ if(box) box.remove(); return; }
  if(!box){ box=document.createElement('div'); box.id='tdCalls'; document.body.appendChild(box); }
  box.innerHTML=L.map(c=>`<div class="tdcall">📣 <b>${BM_L('Table')} ${c.t}</b> <span>${BM_L('calls the TD')}</span><button onclick="tdCallDone(${c.t})">✓</button></div>`).join('');
  const last=Math.max(...L.map(c=>c.at||0));
  if(last>_tdCallsSeen){ _tdCallsSeen=last; try{ const a=new (window.AudioContext||window.webkitAudioContext)(), o=a.createOscillator(), g=a.createGain(); o.frequency.value=880; g.gain.value=0.15; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime+0.35); }catch(e){} if(navigator.vibrate) navigator.vibrate(300); }
};
window.tdCallDone=t=>{ DB.del('tdcalls/'+t); const v={..._cache['tdcalls']||{}}; delete v[t]; _cache['tdcalls']=v; tdCallsShow(v); };

// the round a board is entered for: the TD may correct an earlier one
// an archived tournament being corrected by the TD (its index), or the running one
const bmArc=()=>window._tdEdit&&window._tdEdit.arc!=null?getArchives()[window._tdEdit.arc]:null;
const bmXB=()=>{ const a=bmArc(); return a?(a.boards||{}):getBoards(); }, bmXM=()=>{ const a=bmArc(); return a?(a.movements||{}):getMovements(); };
const bmXP=()=>{ const a=bmArc(); return a?(a.pairs||{}):getPairs(); }, bmXS=()=>{ const a=bmArc(); return a?(a.state||{}):getState(); };
const bmRound=()=>(window._tdEdit&&window._tdEdit.r)||getState().currentRound;
// leaving a board's entry: the table, the TD's menu or the TD's screen
window.bmEntryCancel=function(){
  const e=window._tdEdit; window._tdEdit=null;
  if(!e){ renderTableDetail(bmTableNo); return; }
  if(e.back==='admin'){ bmTableNo=null; adminTab='tables'; renderAdminPanel(); return; }
  bmTdMenu(e.r);
};
// the TD's screen: ✏️ on a board opens the BridgeScore at that table and round
window.adminEditBoard=function(key){ const [t,r,b]=String(key).split('_').map(Number); if(!t||!r||!b) return; window._tdEdit={back:'admin',r}; bmTableNo=t; bmEnterBoard(b); };
// the names at a table as on the BridgeScore: the four seats round the table; a seat: a member number (NBF / TBF) or a name
let _tdN=null;
window.tdNames=function(t,r,back,arc){
  const a=arc!=null?getArchives()[arc]:null, s=a?a.state||{}:getState(); r=r||s.currentRound; const m=(a?a.movements||{}:getMovements())[r+'_'+t]||{}, P=a?a.pairs||{}:getPairs();
  const [N,S]=splitPairName((P[m.ns]||{}).name||''), [E,W]=splitPairName((P[m.ew]||{}).name||'');
  _tdN={t,r,ns:m.ns,ew:m.ew,back,arc,seats:{N,S,E,W}}; tdNamesDraw();
};
function tdNamesDraw(){
  const e=_tdN, st=e.seats, seat=k=>`<button class="pe-pos pe-${k}" onclick="tdSeatEdit('${k}')"><small>${BM_L(BG_SEATS[k])}</small><b>${st[k]?cleanData(st[k]):'＋'}</b></button>`;
  document.getElementById('panelContent').innerHTML=`<div class="bm3t tdnames"><div class="sbchg"><span class="sbtno">👥 ${BM_L('Table')} ${e.t}</span></div><div class="bm3t-info">${BM_L('Round')} ${e.r}</div>
    <div class="pe-table">${seat('N')}${seat('W')}<div class="pe-mid">${BM_L('Table')} ${e.t}</div>${seat('E')}${seat('S')}</div>
    <div class="bm3-actions"><button class="bm3-cancel" onclick="tdNamesBack()">✕ ${BM_L('Cancel')}</button><button class="bm3-ok" onclick="tdNamesSave()">✓ OK</button></div></div>`;
}
window.tdSeatEdit=function(k){
  _tdN.k=k;
  document.getElementById('panelContent').innerHTML=`<div class="bm3t tdnames"><div class="sbchg"><span class="sbtno">${BM_L('Table')} ${_tdN.t} · ${BM_L(BG_SEATS[k])}</span></div>
    <input id="tdpeInput" class="pe-input" maxlength="40" autocomplete="off" placeholder="${BM_L('Member number or name')}" value="${cleanData(_tdN.seats[k]||'')}" oninput="tdSeatLook()" onkeydown="if(event.key==='Enter')tdSeatOk()">
    <div id="tdpeFound" class="pe-found"></div>
    <div class="bm3-actions"><button class="bm3-cancel" onclick="tdNamesDraw()">✕ ${BM_L('Cancel')}</button><button class="bm3-ok" onclick="tdSeatOk()">✓ OK</button></div></div>`;
  setTimeout(()=>{ const i=document.getElementById('tdpeInput'); if(i){ i.focus(); i.select(); } },60);
};
window.tdNamesDraw=tdNamesDraw;
let _tdLookT=0;
window.tdSeatLook=function(){
  clearTimeout(_tdLookT);
  _tdLookT=setTimeout(async()=>{
    const v=(document.getElementById('tdpeInput')?.value||'').trim(), out=document.getElementById('tdpeFound'); if(!out) return;
    if(/^\d{1,8}$/.test(v)){ const n=await memberName(v); out.className='pe-found'+(n?' ok':' no'); out.textContent=n?'👤 '+n:'❓ '+v; return; }
    if(v.length<2){ out.textContent=''; return; }
    const L=await memberSearch(v); if((document.getElementById('tdpeInput')?.value||'').trim()!==v) return;
    out.className='pe-found pe-list'; out.innerHTML=L.map(m=>`<button type="button" class="pe-pick" onclick="tdSeatPick('${m.num}')">👤 ${m.name} <small>${m.num}</small></button>`).join('');
  },250);
};
window.tdSeatPick=async function(num){ const n=await memberName(num); if(n){ _tdN.seats[_tdN.k]=n.slice(0,40); tdNamesDraw(); } };
window.tdSeatOk=async function(){ let v=(document.getElementById('tdpeInput')?.value||'').trim(); if(/^\d{1,8}$/.test(v)) v=(await memberName(v))||v; _tdN.seats[_tdN.k]=v.slice(0,40); tdNamesDraw(); };
window.tdNamesSave=function(){
  const e=_tdN, st=e.seats, A=e.arc!=null?getArchives():null, P=A?(A[e.arc].pairs||{}):getPairs();
  if(e.ns&&P[e.ns]) P[e.ns].name=joinPairName(st.N,st.S); if(e.ew&&P[e.ew]) P[e.ew].name=joinPairName(st.E,st.W);
  if(A) setArchives(A); else setPairs(P); PlayerDB.save([st.N,st.S,st.E,st.W].filter(Boolean)); addLog('ok','TD: names',joinPairName(st.N,st.S)+' vs '+joinPairName(st.E,st.W)); toast('✅ '+BM_L('Saved')); tdNamesBack();
};
window.tdNamesBack=function(){ const b=_tdN&&_tdN.back; _tdN=null; if(b==='admin'){ adminTab='tables'; renderAdminPanel(); } else bmTdMenu(_tdR); };
