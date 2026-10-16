//  SCREEN PANEL — Leaderboard (no Boards tab)
// ══════════════════════════════════════════════════════
let screenTab='overall';

function renderScreenPanel(){
  const s=getState();const pairs=getPairs();const mpData=calcMP();const boards=getBoards();
  const allRows=Object.values(pairs).filter(p=>!p.isPhantom).map(p=>{
    const mp=mpData[p.id]||{mp:0,boards:0,top:0,imp:0};
    const pct=mp.top>0?(mp.mp/mp.top*100).toFixed(1):0;
    return{...p,mp:mp.mp,boards:mp.boards,top:mp.top,pct:parseFloat(pct),imp:mp.imp||0};
  }).sort((a,b)=>scoringShows().byImp?b.imp-a.imp:(b.pct-a.pct||b.mp-a.mp));
  const doneBoards=Object.values(boards).filter(b=>b.status==='done').length;
  const pairCount=Object.values(pairs).filter(p=>!p.isPhantom).length;
  document.getElementById('panelContent').innerHTML=`
    <div class="scoreboard">
      <div class="sb-header">
        <div class="sb-title">🏆 ${s.name}</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="live-pill"><div class="live-dot"></div>Live</span>
          <button class="btn btn-blue btn-sm" onclick="screenPrintPDF()">🖨 Print PDF</button>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-box"><div class="sv">${s.currentRound||0}/${s.roundCount||0}</div><div class="sl">Round</div></div>
        <div class="stat-box"><div class="sv">${s.tableCount||0}</div><div class="sl">Tables</div></div>
        <div class="stat-box"><div class="sv">${pairCount}</div><div class="sl">Pairs</div></div>
        <div class="stat-box"><div class="sv">${doneBoards}</div><div class="sl">Boards Done</div></div>
      </div>
      ${(()=>{const mvs2=getMovements();let tot=0,don=0;for(let t=1;t<=s.tableCount;t++){const mv2=mvs2[s.currentRound+'_'+t]||{};for(let b=mv2.boardStart||1;b<=(mv2.boardEnd||3);b++){tot++;if(boards[t+'_'+s.currentRound+'_'+b]?.status==='done')don++;}}const pct=tot>0?Math.round(don/tot*100):0;return`<div style="padding:0 0 8px;"><div style="font-size:0.7rem;color:var(--text3);margin-bottom:3px;">Round ${s.currentRound} progress: ${don}/${tot} boards · ${pct}%</div><div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${pct>=100?'var(--green)':'var(--gold)'};transition:width 0.5s;"></div></div></div>`;})()} 
      <div class="sb-tabs">
        <button class="sb-tab ${screenTab==='overall'?'active':''}" onclick="setScreenTab('overall',this)">🌐 Overall</button>
        <button class="sb-tab ${screenTab==='ns'?'active':''}" onclick="setScreenTab('ns',this)">🔵 NS</button>
        <button class="sb-tab ${screenTab==='ew'?'active':''}" onclick="setScreenTab('ew',this)">🟡 EW</button>
        <button class="sb-tab ${screenTab==='tables'?'active':''}" onclick="setScreenTab('tables',this)">📋 Tables</button>
      </div>
      <div id="sbContent">${renderSbTab(allRows)}</div>
    </div>`;
  startScreenAutoScroll();
  // Auto-refresh every 10s
  setTimeout(()=>{if(role==='screen')renderScreenPanel();},10000);
}

window.screenPrintPDF=function(){
  const s=getState();const boards=getBoards();const movements=getMovements();const pairs=getPairs();
  const keys=Object.keys(boards).filter(k=>boards[k].status==='done').sort();
  if(!keys.length){toast('No completed boards yet');return;}
  
  let rows='';
  keys.forEach(k=>{
    const d=boards[k];const[t,r,b]=k.split('_');
    const m=movements[r+'_'+t]||{};
    const ns=pairs[m.ns]||{name:m.ns||'?'};
    const ew=pairs[m.ew]||{name:m.ew||'?'};
    const sc=typeof d.nsScore==='number'?((d.nsScore>0?'+':'')+d.nsScore):d.nsScore||'?';
    const rowBg=typeof d.nsScore==='number'?(d.nsScore>0?'#e8f5e9':d.nsScore<0?'#ffebee':'#fff8e1'):'#f5f5f5';
    rows+=`<tr style="background:${rowBg}">
      <td style="font-weight:700;color:#1565c0;">Table ${t}</td>
      <td>Round ${r}</td>
      <td style="font-weight:700;">Board ${b}</td>
      <td style="color:#1565c0;">${ns.name}</td>
      <td style="color:#e65100;">${ew.name}</td>
      <td style="font-family:monospace;">${d.adjusted?'[ADJ] ':''}${d.contract||'PASS'}</td>
      <td style="font-family:monospace;color:#555;">${d.lead||'—'}</td>
      <td style="font-weight:700;color:${typeof d.nsScore==='number'?(d.nsScore>0?'#2e7d32':d.nsScore<0?'#c62828':'#555'):'#7b1fa2'};">${sc}</td>
    </tr>`;
  });

  const mpData=calcMP();
  const allRows=Object.values(pairs).filter(p=>!p.isPhantom).map(p=>{
    const mp=mpData[p.id]||{mp:0,boards:0,top:0};
    const pct=mp.top>0?(mp.mp/mp.top*100).toFixed(1):0;
    return{...p,mp:mp.mp,pct:parseFloat(pct)};
  }).sort((a,b)=>b.pct-a.pct);
  
  let rankRows='';
  allRows.forEach((r,i)=>{
    const bg=i===0?'#fff8e1':i===1?'#f5f5f5':i===2?'#fbe9e7':'#fff';
    rankRows+=`<tr style="background:${bg}">
      <td style="font-weight:700;color:${i<3?'#e65100':'#555'};">${i+1}.</td>
      <td style="font-weight:600;">${r.name}</td>
      <td style="color:${r.dir==='NS'?'#1565c0':'#e65100'};font-weight:600;">${r.dir}</td>
      <td style="font-weight:700;">${r.mp}</td>
      <td style="font-weight:700;color:${r.pct>=60?'#2e7d32':r.pct>=45?'#e65100':'#c62828'};">${r.pct}%</td>
    </tr>`;
  });

  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${s.name} — Tournament Results</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11px;margin:16px;color:#222;}
    h1{font-size:18px;margin-bottom:4px;color:#1a237e;}
    h2{font-size:13px;margin:16px 0 6px;color:#1a237e;border-bottom:2px solid #1a237e;padding-bottom:3px;}
    .meta{font-size:10px;color:#666;margin-bottom:14px;}
    table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10.5px;}
    th{background:#1a237e;color:#fff;padding:5px 7px;text-align:left;font-size:9.5px;text-transform:uppercase;}
    td{padding:4px 7px;border-bottom:1px solid #e0e0e0;}
    @media print{body{margin:8px;}h1{font-size:15px;}}
  </style>
  </head><body>
  <h1>♠ ${s.name}</h1>
  <div class="meta">${s.tableCount} tables · ${s.roundCount} rounds · ${s.boardsPerRound} board/rounds · ${s.scoring||'MP'} · ${s.movement||''} · Printed: ${new Date().toLocaleString(window.getLanguage?.()||'en')}</div>
  <h2>🏆 Overall Rankings</h2>
  <table><thead><tr><th>#</th><th>Player</th><th>Dir</th><th>MP</th><th>%</th></tr></thead><tbody>${rankRows}</tbody></table>
  <h2>📊 All Completed Board Results</h2>
  <table><thead><tr><th>Table</th><th>Round</th><th>Board</th><th>NS Pair</th><th>EW Pair</th><th>Contract</th><th>Opening Lead</th><th>NS Score</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`);
  win.document.close();
  if(window.localizePrintWindow)window.localizePrintWindow(win);
  else setTimeout(()=>win.print(),80);
};

window.setScreenTab=function(tab,btn){
  screenTab=tab;
  document.querySelectorAll('.sb-tab').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active');
  const pairs=getPairs();const mpData=calcMP();
  const allRows=Object.values(pairs).filter(p=>!p.isPhantom).map(p=>{
    const mp=mpData[p.id]||{mp:0,boards:0,top:0};
    const pct=mp.top>0?(mp.mp/mp.top*100).toFixed(1):0;
    return{...p,mp:mp.mp,boards:mp.boards,top:mp.top,pct:parseFloat(pct)};
  }).sort((a,b)=>b.pct-a.pct||b.mp-a.mp);
  document.getElementById('sbContent').innerHTML=renderSbTab(allRows);
};

function renderSbTab(allRows){
  if(screenTab==='tables')return renderTablesTab();
  // the rankings stay hidden until the director finishes the tournament
  if(getState().status!=='finished')return`<div class="empty-state"><div class="empty-icon">🔒</div>The results appear when the director finishes the tournament.</div>`;
  const data=screenTab==='ns'?allRows.filter(r=>r.dir==='NS'):screenTab==='ew'?allRows.filter(r=>r.dir==='EW'):allRows;
  if(!data.length)return`<div class="empty-state"><div class="empty-icon">♠</div>No scores entered yet</div>`;
  return`<div id="sbScrollWrap" style="max-height:60vh;overflow-y:auto;scroll-behavior:smooth;"><table class="sb-table">
    <thead><tr><th>#</th><th>Pair / Player</th><th>Dir</th>${scoringShows().mp?'<th>MP</th><th>Score %</th>':''}${scoringShows().imp?'<th>IMP</th>':''}<th>Boards</th></tr></thead>
    <tbody>${data.map((r,i)=>{
      const rk=i+1;const rc=rk===1?'r1':rk===2?'r2':rk===3?'r3':'rn';
      const pc=r.pct>=60?'mp-high':r.pct>=45?'mp-mid':'mp-low';
      return`<tr>
        <td><span class="rank-badge ${rc}">${rk}</span></td>
        <td><div style="font-weight:600;">${r.name}</div><div style="font-size:0.72rem;color:var(--text3);">${r.id}</div></td>
        <td><span style="font-size:0.72rem;color:${r.dir==='NS'?'var(--blue)':'var(--gold)'};">${r.dir}</span></td>
        ${scoringShows().mp?`<td><span class="mp-pill ${pc}">${r.mp}</span></td>
        <td><div style="font-size:0.82rem;font-weight:600;">${r.pct}%</div><div class="pct-bar-bg"><div class="pct-bar" style="width:${r.pct}%"></div></div></td>`:''}${scoringShows().imp?`<td style="font-weight:700;">${fmtImp(r.imp)}</td>`:''}
        <td style="color:var(--text3);font-size:0.78rem;">${r.boards}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

// ── Screen auto-scroll for long leaderboards ──
let _sbScrollTimer=null, _sbScrollDir=1;
function startScreenAutoScroll(){
  if(_sbScrollTimer)clearInterval(_sbScrollTimer);
  _sbScrollTimer=setInterval(()=>{
    if(role!=='screen'){clearInterval(_sbScrollTimer);_sbScrollTimer=null;return;}
    const el=document.getElementById('sbScrollWrap');
    if(!el||el.scrollHeight<=el.clientHeight+10)return;
    const max=el.scrollHeight-el.clientHeight;
    if(el.scrollTop>=max-2)_sbScrollDir=-1;
    else if(el.scrollTop<=2)_sbScrollDir=1;
    el.scrollTop += _sbScrollDir*1.2;
  },50);
}

function renderTablesTab(){
  const s=getState();if(!s.tableCount)return`<div class="empty-state"><div class="empty-icon">⚙️</div>Tournament not set up</div>`;
  const movements=getMovements();const pairs=getPairs();const boards=getBoards();
  const locks=getTableLocks();
  const stalled=checkStalledTables()||[];
  const stalledMap={};stalled.forEach(x=>stalledMap[x.table]=x.elapsedMin);
  let html='<div class="table-grid">';
  for(let t=1;t<=s.tableCount;t++){
    const m=movements[s.currentRound+'_'+t]||{};
    const ns=pairs[m.ns]||{name:'—',isPhantom:false};const ew=pairs[m.ew]||{name:'—',isPhantom:false};
    let done=0,total=0;
    for(let b=m.boardStart||1;b<=(m.boardEnd||3);b++){total++;if(boards[t+'_'+s.currentRound+'_'+b]?.status==='done')done++;}
    const st=done===total&&total>0?'st-done':done>0?'st-wait':'st-empty';
    const isLocked=!!locks[s.currentRound+'_'+t];
    const isStalled=stalledMap[t]!==undefined;
    html+=`<div class="table-card"${isStalled?' style="border-color:var(--red);"':''}>
      <div class="table-card-head">
        <span class="tcnum">Table ${t}</span>
        <div style="display:flex;gap:4px;align-items:center;">
          ${isLocked?'<span style="font-size:0.62rem;background:var(--greendim);color:var(--green);border:1px solid rgba(76,175,125,0.3);border-radius:8px;padding:1px 6px;">🔒 Occupied</span>':'<span style="font-size:0.62rem;background:var(--surface);color:var(--text3);border:1px solid var(--border);border-radius:8px;padding:1px 6px;">Free</span>'}
          <span class="tc-status ${st}">${done}/${total}</span>
        </div>
      </div>
      <div class="tc-pairs">
        <div style="color:var(--blue);">🔵 ${ns.name}${ns.isPhantom?' 👻':''}</div>
        <div style="color:var(--gold);">🟡 ${ew.name}${ew.isPhantom?' 👻':''}</div>
      </div>
      <div style="font-size:0.7rem;color:var(--text3);">Boards ${m.boardStart||'?'}–${m.boardEnd||'?'}</div>
      ${isStalled?`<div style="margin-top:6px;font-size:0.68rem;color:var(--red);font-weight:600;">⚠️ ${Math.floor(stalledMap[t])} min without a score</div>`:''}
      ${isLocked?`<button onclick="adminForceUnlock(${t})" style="margin-top:6px;font-size:0.65rem;background:none;border:none;color:var(--text3);cursor:pointer;text-decoration:underline;">Force Unlock</button>`:''}
    </div>`;
  }
  return html+'</div>';
}

// ══════════════════════════════════════════════════════
