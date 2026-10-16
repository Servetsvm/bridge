// ── Player Registry (shared Firebase, persists across tournaments) ──

function renderRegistryList(){
  const all=PlayerDB.getAll();
  const sv=(window._regSearch||'').toLowerCase();
  const filtered=sv?all.filter(n=>n.toLowerCase().includes(sv)):all;
  if(!filtered.length)return`<div style="text-align:center;padding:20px;color:var(--text3);">No players found</div>`;
  return filtered.map((n,i)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);">
    <span style="font-size:0.85rem;">${n}</span>
    <button onclick="deleteFromRegistry('${n.replace(/'/g,"\\'")}',${all.indexOf(n)})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:0.75rem;">✕</button>
  </div>`).join('');
}
window.openPlayerRegistry=function(){
  window._regSearch='';
  window._regTab='list';
  openModal('👤 Player Registry',`<div id="regModalBody">${renderPlayerRegistryModal()}</div>`,`<button class="btn btn-ghost" onclick="closeModal()">Close</button>`);
};
function renderPlayerRegistryModal(){
  const tab=window._regTab||'list';
  return`<div>
    <div style="display:flex;gap:4px;margin-bottom:12px;">
      <button class="sb-tab ${tab==='list'?'active':''}" onclick="window._regTab='list';document.getElementById('regModalBody').innerHTML=renderPlayerRegistryModal()">📋 Players</button>
      <button class="sb-tab ${tab==='history'?'active':''}" onclick="window._regTab='history';document.getElementById('regModalBody').innerHTML=renderPlayerRegistryModal()">📊 History</button>
    </div>
    ${tab==='list'?renderRegistryListTab():renderRegistryHistoryTab()}
  </div>`;
}
function renderRegistryListTab(){
  const count=PlayerDB.getAll().length;
  return`<div>
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
      <input id="regSearchInp" value="${window._regSearch||''}" placeholder="Search ${count} players..."
        oninput="window._regSearch=this.value;document.getElementById('regList').innerHTML=renderRegistryList()"
        style="flex:1;min-width:120px;padding:7px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.82rem;outline:none;">
      <button class="btn btn-green btn-sm" onclick="openAddPlayerToRegistry()">+ New</button>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
      <button class="btn btn-blue btn-sm" onclick="PlayerDB.export();toast('✅ Backup downloaded')">⬇ Export</button>
      <button class="btn btn-gold btn-sm" onclick="document.getElementById('playerImportFile').click()">⬆ Import
        <input type="file" id="playerImportFile" accept=".json" style="display:none" onchange="importPlayerFile(this)">
      </button>
      <button class="btn btn-red btn-sm" onclick="regClearAll()">🗑 Clear All</button>
    </div>
    <div id="regList">${renderRegistryList()}</div>
  </div>`;
}
window.importPlayerFile=function(inp){
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();r.onload=e=>{
    const n=PlayerDB.import(e.target.result);
    if(n>0){toast('✅ '+n+' players imported');document.getElementById('regList').innerHTML=renderRegistryList();}
    else toast('❌ Invalid file format');
  };r.readAsText(f);
};
function renderRegistryHistoryTab(){
  const archives=getArchives();
  if(!archives.length)return`<div style="text-align:center;padding:20px;color:var(--text3);">No archived tournaments yet.</div>`;
  // Build per-player stats from all archives
  const stats={};
  archives.forEach(a=>{
    const mpData=calcMPFromData(a.boards||{},a.movements||{});
    const pairs=a.pairs||{};
    Object.values(pairs).filter(p=>!p.isPhantom&&p.name).forEach(p=>{
      const names=p.name.split('/').map(n=>n.trim()).filter(Boolean);
      names.forEach(name=>{
        if(!name||name.length<2)return;
        if(!stats[name])stats[name]={name,tournaments:0,totalPct:0,best:0,worst:100};
        const mp=mpData[p.id]||{mp:0,top:0};
        const pct=mp.top>0?parseFloat((mp.mp/mp.top*100).toFixed(1)):50;
        stats[name].tournaments++;
        stats[name].totalPct+=pct;
        if(pct>stats[name].best)stats[name].best=pct;
        if(pct<stats[name].worst)stats[name].worst=pct;
      });
    });
  });
  const rows=Object.values(stats).sort((a,b)=>(b.totalPct/b.tournaments)-(a.totalPct/a.tournaments));
  if(!rows.length)return`<div style="text-align:center;padding:20px;color:var(--text3);">No player data found in archives.</div>`;
  return`<div style="overflow-x:auto;">
    <table class="mv-table">
      <thead><tr><th>#</th><th>Player</th><th>Played</th><th>Avg%</th><th>Best%</th><th>Worst%</th></tr></thead>
      <tbody>${rows.map((r,i)=>{
        const avg=(r.totalPct/r.tournaments).toFixed(1);
        const col=avg>=60?'var(--green)':avg>=45?'var(--gold)':'var(--red)';
        return`<tr>
          <td style="color:var(--text3);">${i+1}</td>
          <td style="font-weight:600;">${r.name}</td>
          <td style="color:var(--text3);">${r.tournaments}</td>
          <td style="font-weight:700;color:${col};">${avg}%</td>
          <td style="color:var(--green);">${r.best.toFixed(1)}%</td>
          <td style="color:var(--red);">${r.worst.toFixed(1)}%</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}
window.openAddPlayerToRegistry=function(){
  openModal('Add Player',`
    <div class="field"><label>Full Name</label><input id="newRegName" placeholder="First Last" autofocus style="width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:0.85rem;outline:none;box-sizing:border-box;"></div>`,
    `<button class="btn btn-ghost" onclick="openPlayerRegistry()">Cancel</button>
     <button class="btn btn-green" onclick="savePlayerToRegistry()">Save</button>`);
  setTimeout(()=>document.getElementById('newRegName')?.focus(),80);
};
window.savePlayerToRegistry=function(){
  const name=(document.getElementById('newRegName')?.value||'').trim();
  if(!name){toast('❌ Enter a name');return;}
  PlayerDB.save([name]);
  toast('✅ Saved: '+name);
  window._regSearch='';
  openPlayerRegistry();
};
window.regClearAll=async function(){
  if(!await confirmDialog('Clear entire player registry?',{title:'Clear Registry'}))return;
  PlayerDB.clear();
  document.getElementById('regList').innerHTML=renderRegistryList();
  toast('🗑 Registry cleared');
};
window.deleteFromRegistry=async function(name,idx){
  if(!await confirmDialog(`Remove "${name}" from registry?`,{title:'Remove Player'}))return;
  const all=PlayerDB.getAll();
  const i=all.indexOf(name);
  if(i>-1){all.splice(i,1);}
  _cache['playerdb']=all;
  DB.set('playerdb',all);
  document.getElementById('regList').innerHTML=renderRegistryList();
};

// ── Pair name input with player search dropdown ──
let _searchTarget={pairId:null,slot:null,inp:null};
let _hideDropTimer=null;
window.showPlayerSearch=function(inp,pairId,slot){
  _searchTarget={pairId,slot,inp};
  const drop=document.getElementById('playerSearchDrop');
  if(!drop)return;
  if(_hideDropTimer){clearTimeout(_hideDropTimer);_hideDropTimer=null;}
  const rect=inp.getBoundingClientRect();
  drop.style.left=rect.left+'px';
  drop.style.top=(rect.bottom+4)+'px';
  drop.style.width=Math.max(rect.width,200)+'px';
  updatePlayerSearchDrop(inp.value);
  drop.style.display='block';
  inp.oninput=()=>updatePlayerSearchDrop(inp.value);
  inp.onblur=()=>{ _hideDropTimer=setTimeout(hidePlayerSearch,200); };
};
function updatePlayerSearchDrop(val){
  const drop=document.getElementById('playerSearchDrop');if(!drop)return;
  const all=PlayerDB.getAll();
  const sv=(val||'').toLowerCase();
  const filtered=sv?all.filter(n=>n.toLowerCase().includes(sv)):all.slice(0,25);
  if(!filtered.length){drop.style.display='none';return;}
  drop.innerHTML=filtered.map(n=>{
    const safe=n.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return`<div onmousedown="event.preventDefault();selectPlayerFromDrop('${safe}','${_searchTarget.pairId}',${_searchTarget.slot})"
      style="padding:8px 12px;cursor:pointer;font-size:0.83rem;border-bottom:1px solid var(--border);"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">${n}</div>`;
  }).join('');
  drop.style.display='block';
}
window.selectPlayerFromDrop=function(name,pairId,slot){
  if(_searchTarget.inp){_searchTarget.inp.value=name;}
  updatePairSlot(pairId,slot,name);
  hidePlayerSearch();
};
function hidePlayerSearch(){
  const drop=document.getElementById('playerSearchDrop');
  if(drop)drop.style.display='none';
  _hideDropTimer=null;
}

window.clearAllPairNames=async function(){
  if(!await confirmDialog('Clear all pair names? This cannot be undone.',{title:'Clear All Names'}))return;
  const p=getPairs();
  Object.keys(p).forEach(k=>{if(!p[k].isPhantom)p[k].name='';});
  setPairs(p);toast('🗑 All names cleared');renderAdminTab();
};

window.updatePairName=function(id,name){const p=getPairs();if(p[id]){p[id].name=name.trim();setPairs(p);}};

window.updatePairSlot=function(id,slot,val){
  const p=getPairs();if(!p[id])return;
  const [p1,p2]=splitPairName(p[id].name);
  p[id].name=slot===1?joinPairName(val,p2):joinPairName(p1,val);
  setPairs(p);
  if(val.trim())PlayerDB.save([val.trim()]);
};

window.addPair=function(){
  const p=getPairs();
  const s=getState();
  const nsKeys=Object.keys(p).filter(k=>k.startsWith('ns_'));
  const ewKeys=Object.keys(p).filter(k=>k.startsWith('ew_'));
  const pKeys=Object.keys(p).filter(k=>k.startsWith('p')&&!k.startsWith('phantom'));
  const mov=s.movement||'mitchell';
  if(mov==='mitchell'){
    const nextNS=nsKeys.length+1;
    const nextEW=ewKeys.length+1;
    if(nextNS!==nextEW){toast('❌ NS/EW counts mismatch — cannot add');return;}
    openModal('Add Pair',`
      <p style="font-size:0.82rem;color:var(--text2);margin-bottom:12px;">Table ${nextNS} — NS + EW pair</p>
      <div class="field"><label>NS Player Name</label><input id="addNsName" placeholder="Full Name" autofocus></div>
      <div class="field"><label>EW Player Name</label><input id="addEwName" placeholder="Full Name"></div>`,
      `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
       <button class="btn btn-green" onclick="confirmAddMitchell(${nextNS})">Add</button>`);
  } else {
    const next=pKeys.length+1;
    openModal('Add Pair',`
      <p style="font-size:0.82rem;color:var(--text2);margin-bottom:12px;">Pair ${next}</p>
      <div class="field"><label>Player Name</label><input id="addPName" placeholder="Full Name" autofocus></div>`,
      `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
       <button class="btn btn-green" onclick="confirmAddHowell(${next})">Add</button>`);
  }
};

window.confirmAddMitchell=function(n){
  const nsName=document.getElementById('addNsName')?.value.trim()||('NS '+n);
  const ewName=document.getElementById('addEwName')?.value.trim()||('EW '+n);
  const p=getPairs();
  p['ns_'+n]={id:'ns_'+n,name:nsName,dir:'NS',startTable:n,isPhantom:false};
  p['ew_'+n]={id:'ew_'+n,name:ewName,dir:'EW',startTable:n,isPhantom:false};
  setPairs(p);
  PlayerDB.save([nsName,ewName]);
  addLog('ok','Pair added','NS: '+nsName+' / EW: '+ewName);
  toast('✅ Added: '+nsName+' & '+ewName);
  closeModal();renderAdminTab();
};

window.confirmAddHowell=function(n){
  const name=document.getElementById('addPName')?.value.trim()||('Pair '+n);
  const p=getPairs();
  p['p'+n]={id:'p'+n,name:name,dir:'',startTable:0,isPhantom:false};
  setPairs(p);
  PlayerDB.save([name]);
  addLog('ok','Pair added','Pair '+n+': '+name);
  toast('✅ Added: '+name);
  closeModal();renderAdminTab();
};

window.removePair=async function(id){
  const p=getPairs();
  const name=p[id]?.name||id;
  if(!await confirmDialog(`Remove pair "${name}"? This cannot be undone.`,{title:'Remove Pair'}))return;
  const s=getState();
  const mov=s.movement||'mitchell';
  if(mov==='mitchell'){
    const num=id.split('_')[1];
    const paired=id.startsWith('ns_')?'ew_'+num:'ns_'+num;
    if(p[paired]&&await confirmDialog(`Also remove paired player "${p[paired].name}"?`,{title:'Remove Partner Too?',danger:false})){delete p[paired];}
  }
  delete p[id];
  setPairs(p);
  addLog('warn','Pair removed',name);
  toast('🗑 Removed: '+name);
  renderAdminTab();
};

window.adminLoadBoardsFile=function(inp){
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();r.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      const boards={...getBoards(),...data};
      setBoards(boards);addLog('ok','Boards loaded from file',Object.keys(data).length+' boards');
      toast('✅ Boards loaded');renderAdminTab();
    }catch{toast('❌ Invalid JSON');}
  };r.readAsText(f);
};
window.adminImportHandsOpen=function(){
  openModal('Load Hand Records',`
    <p style="font-size:0.82rem;color:var(--text2);margin-bottom:8px;">Load the hands of this session: the file from your dealing machine or bridge program. The double-dummy analysis starts by itself.</p>
    <div style="background:var(--surface2);border-radius:6px;padding:10px;margin-bottom:10px;font-size:0.75rem;color:var(--text2);">
      <b>Supported:</b> PBN · DLM (Dealer4, Dealmaster) · DUP · BRI · DGE (Duplimate) · LIN (BBO)
    </div>
    <div class="import-drop" onclick="document.getElementById('handsFile').click()">
      <div style="font-size:2rem;">🃏</div><div style="font-weight:600;">Select a hand file</div>
      <input type="file" id="handsFile" accept=".pbn,.lin,.txt,.csv,.dlm,.dup,.bri,.dge" onchange="adminLoadHandsFile(this)" style="display:none;">
    </div>
    <div class="login-err" id="handsErr"></div>
    <div class="field"><label>Or paste file contents (PBN or LIN):</label><textarea id="handsText" rows="5" placeholder='[Board "1"]&#10;[Deal "N:AKQ.23.456.789 ..."]'></textarea></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-gold" onclick="adminParseHandsText()">Load</button>`);
};
// keep the boards read from a file: the hands, then the analysis in the background
function adminUseHands(res, source){
  const err=document.getElementById('handsErr');
  if(res.crypt){ if(err) err.textContent='❌ This file is locked (crypto key). Save the boards unlocked or as PBN in the dealer program.'; return; }
  const hands=res.hands||[];
  if(!hands.length){ if(err) err.textContent='❌ No complete boards found in this file'+(res.bad?' ('+res.bad+' damaged)':''); else toast('❌ Format not recognised'); return; }
  hands.sort((a,b)=>(+a.board||0)-(+b.board||0));
  _cache['hands']=hands; DB.set('hands',hands);
  _cache['dd']={}; DB.set('dd',{});
  addLog('ok','Hand file loaded',hands.length+' boards · '+(res.format||source)+(res.bad?' · '+res.bad+' damaged boards skipped':''));
  toast('✅ '+hands.length+' boards loaded'+(res.bad?' — '+res.bad+' damaged boards skipped':''));
  closeModal(); renderAdminTab();
  startDDAnalysis();
}
window.adminLoadHandsFile=function(inp){
  const f=inp.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{ try{ adminUseHands(readDealFile(f.name,new Uint8Array(e.target.result)),f.name); }catch(x){ const err=document.getElementById('handsErr'); if(err) err.textContent='❌ '+x.message; } };
  r.readAsArrayBuffer(f);
  inp.value='';
};
window.adminParseHandsText=function(){
  const raw=(document.getElementById('handsText').value||'').trim();
  if(!raw){toast('❌ File is empty');return;}
  const res=readDealFile('pasted.txt',new TextEncoder().encode(raw));
  if(!res.hands.length){ const old=parsePBNorLIN(raw); if(old.length){ res.hands=old; res.format='CSV'; } }
  adminUseHands(res,'pasted');
};

// ══════════════════════════════════════════════════════
//  DOUBLE-DUMMY ANALYSIS — worked out on the director's device in the background (dd.js), kept in /dd
// ══════════════════════════════════════════════════════
let _ddWorker=null, _ddRunning=false;
function startDDAnalysis(force){
  const hands=_cache['hands']||[]; if(!hands.length||_ddRunning) return;
  const done=_cache['dd']||{};
  const todo=hands.filter(h=>force||!done[String(h.board)]).map(h=>({board:h.board,deal:h.deal,vulnerable:h.vulnerable}));
  if(!todo.length) return;
  try{ _ddWorker=new Worker('dd.js'); }catch(e){ toast('❌ Analysis is not available on this device'); return; }
  _ddRunning=true; let got=0;
  const res={...done};
  _ddWorker.onmessage=m=>{
    const d=m.data||{};
    if(d.done){ _ddRunning=false; _ddWorker.terminate(); _ddWorker=null; _cache['dd']=res; DB.set('dd',res); addLog('ok','Double-dummy analysis finished',got+' boards'); toast('✅ Analysis ready: '+got+' boards'); if(role==='admin'&&adminTab==='boards')renderAdminTab(); return; }
    got++; if(d.res) res[d.board]=d.res;
    _cache['dd']=res;
    if(got%4===0||got===todo.length) DB.set('dd',res);   // the others see it come in
    const p=document.getElementById('ddProgress'); if(p) p.textContent='⏳ '+got+' / '+todo.length;
    if(role==='admin'&&adminTab==='boards'&&!document.querySelector('#modalBg.open'))renderAdminTab();
  };
  _ddWorker.onerror=()=>{ _ddRunning=false; toast('❌ Analysis stopped'); };
  _ddWorker.postMessage({boards:todo});
  toast('🧮 Analysing '+todo.length+' boards…');
}
window.startDDAnalysis=startDDAnalysis;
function parsePBNorLIN(raw){
  const hands=[];
  if(raw.indexOf('[Board')!==-1){
    const blocks=raw.split(/(?=\[Board )/i).filter(Boolean);
    blocks.forEach(bl=>{
      const bm=bl.match(/\[Board "([^"]+)"\]/i);
      const dm=bl.match(/\[Deal "([^"]+)"\]/i);
      const vm=bl.match(/\[Vulnerable "([^"]+)"\]/i);
      const fm=bl.match(/\[Dealer "([^"]+)"\]/i);
      if(bm&&dm){hands.push({board:bm[1],deal:dm[1],vulnerable:vm?vm[1]:'None',dealer:fm?fm[1]:'N'});}
    });
    return hands;
  }
  if(raw.indexOf('md|')!==-1||raw.indexOf('pn|')!==-1){
    const lines=raw.split(/\r?\n/).filter(Boolean);
    lines.forEach((ln,i)=>{
      const md=ln.match(/md\|([^|]+)/);
      if(md){hands.push({board:String(i+1),deal:'LIN:'+md[1],vulnerable:'None',dealer:'N'});}
    });
    return hands;
  }
  if(raw.indexOf(',')!==-1){
    const rows=raw.split(/\r?\n/).filter(Boolean);
    const header=rows[0].toLowerCase();
    if(header.indexOf('board')!==-1){
      rows.slice(1).forEach(row=>{
        const cols=row.split(',');
        if(cols.length>=2)hands.push({board:cols[0].trim(),deal:cols.slice(1).join(','),vulnerable:'None',dealer:'N'});
      });
      return hands;
    }
  }
  return hands;
}


// ── PBN Export ──
const SUIT_TO_PBN={'♣':'C','♦':'D','♥':'H','♠':'S','NT':'NT'};
const VULN_TO_PBN={None:'None',NS:'NS',EW:'EW',Both:'All'};
function pbnContractStr(d){
  if(!d||d.contract==='PASS'||!d.level||!d.suit)return'Pass';
  const suit=SUIT_TO_PBN[d.suit]||d.suit;
  return `${d.level}${suit}${d.doubled||''}`;
}
function buildPBNText(boards, movements, pairs, hands, tournamentName){
  const handsByBoard={};
  (hands||[]).forEach(h=>{ handsByBoard[String(h.board)]=h; });
  const doneKeys=Object.keys(boards||{}).filter(k=>boards[k].status==='done');
  const byBoardNo={};
  doneKeys.forEach(k=>{
    const[t,r,b]=k.split('_');
    if(!byBoardNo[b])byBoardNo[b]=[];
    byBoardNo[b].push({table:t,round:r,boardNo:b,data:boards[k]});
  });
  const boardNos=Object.keys(byBoardNo).sort((a,b)=>Number(a)-Number(b));
  if(!boardNos.length)return null;
  let out=`% PBN 2.1\n% Exported from BridgeGate — ${(tournamentName||'Tournament')}\n% ${new Date().toISOString()}\n\n`;
  boardNos.forEach(bn=>{
    const instances=byBoardNo[bn].sort((a,b)=>Number(a.round)-Number(b.round)||Number(a.table)-Number(b.table));
    const hand=handsByBoard[bn];
    const dealer=(hand&&hand.dealer)||['N','E','S','W'][(Number(bn)-1)%4];
    const vulnRaw=(hand&&hand.vulnerable)||instances[0].data.vuln||getVuln(Number(bn));
    const vuln=VULN_TO_PBN[vulnRaw]||vulnRaw||'None';
    const primary=instances[0].data;
    const contractStr=pbnContractStr(primary);
    out+=`[Event "${(tournamentName||'Tournament').replace(/"/g,'')}"]\n`;
    out+=`[Board "${bn}"]\n`;
    if(hand&&hand.deal)out+=`[Deal "${hand.deal}"]\n`;
    out+=`[Dealer "${dealer}"]\n`;
    out+=`[Vulnerable "${vuln}"]\n`;
    out+=`[Contract "${contractStr}"]\n`;
    if(contractStr!=='Pass'&&primary.declarer){
      out+=`[Declarer "${primary.declarer}"]\n`;
      const tricks=6+Number(primary.level)+(primary.result||0);
      out+=`[Result "${tricks}"]\n`;
    }
    out+=`; Traveller — all results for Board ${bn}\n`;
    instances.forEach(inst=>{
      const d=inst.data;
      const mv=(movements||{})[inst.round+'_'+inst.table]||{};
      const ns=(pairs||{})[mv.ns]||{};const ew=(pairs||{})[mv.ew]||{};
      const sc=typeof d.nsScore==='number'?((d.nsScore>0?'+':'')+d.nsScore):(d.nsScore||'?');
      out+=`; Table ${inst.table} Round ${inst.round}: ${ns.name||'NS'} vs ${ew.name||'EW'} — ${d.contract||'PASS'} — NS ${sc}\n`;
    });
    out+='\n';
  });
  return out;
}
function downloadPBN(text, filename){
  const blob=new Blob([text],{type:'text/plain'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
}
window.exportCurrentPBN=function(){
  const s=getState();
  const text=buildPBNText(getBoards(),getMovements(),getPairs(),_cache['hands']||[],s.name);
  if(!text){toast('❌ No completed boards to export');return;}
  downloadPBN(text,(s.name||'tournament').replace(/[^a-z0-9]/gi,'_')+'.pbn');
  toast('✅ PBN file downloaded');
};
window.exportArchivePBN=function(i){
  const a=getArchives()[i];if(!a)return;
  const text=buildPBNText(a.boards,a.movements,a.pairs,a.hands||[],a.state?.name);
  if(!text){toast('❌ No completed boards to export');return;}
  downloadPBN(text,((a.state&&a.state.name)||'tournament').replace(/[^a-z0-9]/gi,'_')+'.pbn');
  toast('✅ PBN file downloaded');
};

function renderMovement(){
  const s=getState();const mv=getMovements();const pairs=getPairs();
  if(!Object.keys(mv).length)return`<div class="empty-state"><div class="empty-icon">🔄</div>Tournament not created yet</div>`;

  let html=`
    <div class="card" style="margin-bottom:8px;">
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-weight:700;font-size:0.95rem;">${s.name}</div>
          <div style="font-size:0.78rem;color:var(--text2);">${s.tableCount} tables · ${s.roundCount} rounds · ${s.boardsPerRound} boards/round · ${s.scoring||'MP'} · ${s.movement}</div>
        </div>
        <button class="btn btn-gold btn-sm" onclick="adminPrintMovement()">🖨 Print PDF</button>
      </div>
    </div>`;

  for(let r=1;r<=s.roundCount;r++){
    const active=r===s.currentRound;
    html+=`<div class="card" style="${active?'border-color:var(--gold);':''}">
      <div class="card-title"><span>${active?'▶':'○'}</span> Round ${r} ${active?'<span style="color:var(--green);font-size:0.68rem;margin-left:4px;">● ACTIVE</span>':''}</div>
      <div class="movement-full">
        <table>
          <thead><tr><th>Table</th><th>NS Pair</th><th>EW Pair</th><th>Boards</th></tr></thead>
          <tbody>${Array.from({length:s.tableCount},(_,i)=>i+1).map(t=>{
            const m=mv[r+'_'+t]||{};
            const ns=pairs[m.ns]||{name:m.ns||'—',isPhantom:false};
            const ew=pairs[m.ew]||{name:m.ew||'—',isPhantom:false};
            return`<tr>
              <td style="font-weight:700;color:var(--gold);">Table ${t}</td>
              <td style="color:var(--blue);">${ns.name}${ns.isPhantom?' 👻':''}</td>
              <td style="color:var(--gold);">${ew.name}${ew.isPhantom?' 👻':''}</td>
              <td style="color:var(--text3);font-family:'Share Tech Mono',monospace;">B${m.boardStart||'?'}–B${m.boardEnd||'?'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }
  return html;
}

window.adminPrintMovement=function(){
  const s=getState();const mv=getMovements();const pairs=getPairs();
  let rows='';
  for(let r=1;r<=s.roundCount;r++){
    rows+=`<tr><td colspan="4" style="background:#eee;font-weight:bold;padding:6px 8px;">Round ${r}</td></tr>`;
    for(let t=1;t<=s.tableCount;t++){
      const m=mv[r+'_'+t]||{};
      const ns=pairs[m.ns]||{name:m.ns||'—'};
      const ew=pairs[m.ew]||{name:m.ew||'—'};
      rows+=`<tr><td>Table ${t}</td><td>${ns.name}</td><td>${ew.name}</td><td>B${m.boardStart||'?'}–B${m.boardEnd||'?'}</td></tr>`;
    }
  }
  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${s.name} — Movement</title>
  <style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px;}h1{font-size:16px;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left;}th{background:#f5f5f5;font-weight:bold;}tr:nth-child(even)td{background:#fafafa;}</style>
  </head><body><h1>${s.name} — Movement Chart</h1>
  <p>${s.tableCount} tables · ${s.roundCount} rounds · ${s.boardsPerRound} boards/round · ${s.scoring} · ${s.movement}</p>
  <table><thead><tr><th>Table</th><th>NS Pair</th><th>EW Pair</th><th>Boards</th></tr></thead><tbody>${rows}</tbody></table>
  </body></html>`);
  win.document.close();
  if(window.localizePrintWindow)window.localizePrintWindow(win);
  else setTimeout(()=>win.print(),80);
};

// ── Tables (admin) ──
function renderTables(){
  const s=getState();if(!s.tableCount)return`<div class="empty-state"><div class="empty-icon">🃏</div>Tournament not created</div>`;
  const movements=getMovements();const pairs=getPairs();const boards=getBoards();
  let html='<div class="table-grid">';
  for(let t=1;t<=s.tableCount;t++){
    const m=movements[s.currentRound+'_'+t]||{};
    const ns=pairs[m.ns]||{name:'—',isPhantom:false};const ew=pairs[m.ew]||{name:'—',isPhantom:false};
    let done=0,total=0;
    for(let b=m.boardStart||1;b<=(m.boardEnd||3);b++){total++;if(boards[t+'_'+s.currentRound+'_'+b]?.status==='done')done++;}
    const st=done===total&&total>0?'st-done':done>0?'st-wait':'st-empty';
    const pct=total>0?Math.round(done/total*100):0;
    const barColor=pct>=100?'var(--green)':pct>0?'var(--gold)':'var(--border)';
    html+=`<div class="table-card">
      <div class="table-card-head"><span class="tcnum">Table ${t}</span><span class="tc-status ${st}">${done}/${total}</span></div>
      <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin:4px 0 8px;">
        <div style="height:100%;width:${pct}%;background:${barColor};transition:width 0.3s ease;"></div>
      </div>
      <div class="tc-pairs">
        <div style="color:var(--blue);">🔵 ${ns.name}${ns.isPhantom?' 👻':''}</div>
        <div style="color:var(--gold);">🟡 ${ew.name}${ew.isPhantom?' 👻':''}</div>
      </div>
      <div style="font-size:0.7rem;color:var(--text3);margin-bottom:6px;">Boards ${m.boardStart||'?'}–${m.boardEnd||'?'}</div>
      <div class="tc-actions">
        <button class="btn btn-blue btn-sm" onclick="adminEditTable(${t})">✏️ Boards</button>
        <button class="btn btn-purple btn-sm" onclick="adminAdjScore(${t})">⚖️ ADJ</button>
      </div>
    </div>`;
  }
  return html+'</div>';
}

window.adminEditTable=function(t){
  const s=getState();const m=getMovements()[s.currentRound+'_'+t]||{};
  const boards=getBoards();let rows='';
  for(let b=m.boardStart||1;b<=(m.boardEnd||3);b++){
    const key=t+'_'+s.currentRound+'_'+b;const d=boards[key];
    rows+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);gap:6px;">
      <span style="font-size:0.8rem;color:var(--text2);min-width:55px;">Board ${b}</span>
      <span style="font-size:0.8rem;flex:1;font-family:'Share Tech Mono',monospace;">${d?(d.adjusted?'<span class="adj-badge">ADJ</span> ':'')+d.contract:'—'}</span>
      <span style="font-weight:600;font-size:0.82rem;min-width:44px;text-align:right;color:${d?(typeof d.nsScore==='number'?(d.nsScore>=0?'var(--green)':'var(--red)'):'var(--purple)'):'var(--text3)'};">${d?(typeof d.nsScore==='number'?(d.nsScore>0?'+':'')+d.nsScore:d.nsScore):'—'}</span>
      <div style="display:flex;gap:3px;">
        <button class="btn btn-blue btn-sm" onclick="closeModal();adminEditBoard('${key}',${t})">✏️</button>
        <button class="btn btn-red btn-sm" onclick="confirmDeleteBoard('${key}',()=>{closeModal();adminEditTable(${t});})">🗑</button>
      </div>
    </div>`;
  }
  openModal(`Table ${t} — Round ${s.currentRound}`,rows,`<button class="btn btn-ghost" onclick="closeModal()">Close</button><button class="btn btn-purple" onclick="closeModal();adminAdjScore(${t})">⚖️ ADJ</button>`);
};

window.adminEditBoard=function(key,t){
  const boards=getBoards();const d=boards[key]||{};
  const[tbl,rnd,brd]=key.split('_');
  openModal(`Edit Board ${brd} (Table ${tbl}, Round ${rnd})`,`
    <div class="field"><label>Contract</label><input id="ebContract" value="${d.contract||''}"></div>
    <div class="field-row">
      <div class="field"><label>NS Score</label><input type="number" id="ebNS" value="${typeof d.nsScore==='number'?d.nsScore:0}"></div>
      <div class="field"><label>EW Score</label><input type="number" id="ebEW" value="${typeof d.ewScore==='number'?d.ewScore:0}"></div>
    </div>
    <div class="field"><label>Note</label><input id="ebNote" value="${d.note||''}"></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-gold" onclick="adminSaveBoard('${key}',${t})">Save</button>`);
};
window.adminSaveBoard=function(key,t){
  const boards=getBoards();const d=boards[key]||{};
  const contract=document.getElementById('ebContract').value.trim();
  const nsScore=parseInt(document.getElementById('ebNS').value)||0;
  const ewScore=parseInt(document.getElementById('ebEW').value)||0;
  const note=document.getElementById('ebNote').value.trim();
  boards[key]={...d,contract,nsScore,ewScore,note,status:'done',manualEdit:true,time:new Date().toISOString()};
  setBoards(boards);addLog('warn','Board edited: '+key,contract+' NS:'+nsScore);
  toast('✅ Saved');closeModal();renderAdminTab();
};
window.adminDelBoard=function(key){
  const boards=getBoards();delete boards[key];setBoards(boards);
  addLog('warn','Board deleted: '+key,'');
};
window.confirmDeleteBoard=async function(key,after){
  if(!await confirmDialog('Delete this board result?',{title:'Delete Board'}))return;
  adminDelBoard(key);
  if(after)after();
};
window.confirmClearLogs=async function(){
  if(!await confirmDialog('Clear the system log?',{title:'Clear Logs'}))return;
  DB.del('logs').then(()=>{_cache['logs']=[];renderAdminTab();});
};
window.adminAdjScore=function(t){
  const s=getState();const m=getMovements()[s.currentRound+'_'+t]||{};
  let opts='';for(let b=m.boardStart||1;b<=(m.boardEnd||3);b++)opts+=`<option value="${b}">Board ${b}</option>`;
  openModal(`Table ${t} — Adjusted Score`,`
    <div class="field"><label>Board</label><select id="adjB">${opts}</select></div>
    <div class="field-row">
      <div class="field"><label>NS</label><select id="adjNS"><option value="A+">A+ (60%)</option><option value="A" selected>A (50%)</option><option value="A-">A- (40%)</option><option value="0">0%</option></select></div>
      <div class="field"><label>EW</label><select id="adjEW"><option value="A+">A+ (60%)</option><option value="A" selected>A (50%)</option><option value="A-">A- (40%)</option><option value="0">0%</option></select></div>
    </div>
    <div class="field"><label>Note</label><input id="adjNote" placeholder="e.g. Card misplayed"></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-purple" onclick="adminSaveAdj(${t})">⚖️ Save ADJ</button>`);
};
window.adminSaveAdj=function(t){
  const brd=document.getElementById('adjB').value;
  const ns=document.getElementById('adjNS').value;
  const ew=document.getElementById('adjEW').value;
  const note=document.getElementById('adjNote').value.trim();
  const key=t+'_'+getState().currentRound+'_'+brd;
  const boards=getBoards();
  boards[key]={contract:`ADJ(${ns}/${ew})`,nsScore:ns,ewScore:ew,status:'done',adjusted:true,note,time:new Date().toISOString()};
  setBoards(boards);addLog('warn',`ADJ Score: Table ${t} Board ${brd}`,`NS:${ns} EW:${ew} — ${note}`);
  toast('✅ ADJ saved');closeModal();renderAdminTab();
};

// ── Boards overview ──
function renderBoards(){
  const boards=getBoards();const keys=Object.keys(boards).filter(k=>boards[k].status==='done').sort();
  if(!keys.length)return renderHandsAnalysis()+`<div class="empty-state"><div class="empty-icon">📊</div>No boards entered yet</div>`;
  return renderHandsAnalysis()+`<div class="card">
    <div class="card-title"><span>📊</span> All Completed Boards (${keys.length})</div>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
      <button class="btn btn-blue btn-sm" onclick="adminExportBoards()">⬇ Export JSON</button>
      <button class="btn btn-gold btn-sm" onclick="exportCurrentPBN()">🃏 Export PBN</button>
    </div>
    <table class="mv-table">
      <thead><tr><th>Key</th><th>Contract</th><th>Lead</th><th>NS</th><th>⏱</th><th></th></tr></thead>
      <tbody>${keys.map(k=>{const d=boards[k];const[t,r,b]=k.split('_');
        const dur=d.durationSec?(d.durationSec<60?d.durationSec+'s':Math.floor(d.durationSec/60)+'m '+(d.durationSec%60)+'s'):'—';
        return`<tr>
          <td style="color:var(--gold);font-size:0.72rem;">T${t}/R${r}/B${b}</td>
          <td style="font-family:'Share Tech Mono',monospace;">${d.adjusted?'<span class="adj-badge">ADJ</span> ':''}${d.contract||'—'}</td>
          <td style="font-family:'Share Tech Mono',monospace;color:var(--text2);">${d.lead||'—'}</td>
          <td style="color:${typeof d.nsScore==='number'?(d.nsScore>=0?'var(--green)':'var(--red)'):'var(--purple)'};">${typeof d.nsScore==='number'?(d.nsScore>0?'+':'')+d.nsScore:d.nsScore||'—'}</td>
          <td style="font-size:0.7rem;color:var(--text3);">${dur}</td>
          <td><div style="display:flex;gap:3px;">
            <button class="btn btn-blue btn-sm" onclick="adminEditBoard('${k}',${t})">✏️</button>
            <button class="btn btn-red btn-sm" onclick="confirmDeleteBoard('${k}',()=>renderAdminTab())">🗑</button>
          </div></td>
        </tr>`;
      }).join('')}
    </tbody></table>
  </div>`;
}
window.adminExportBoards=function(){
  const blob=new Blob([JSON.stringify(getBoards(),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='boards_'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);
};

// ── History ──
function renderHistory(){
  const arc=getArchives();
  if(!arc.length)return`<div class="empty-state"><div class="empty-icon">📜</div>No archived tournaments</div>`;
  return`<div class="card">
    <div class="card-title"><span>📜</span> Archived Tournaments (${arc.length})</div>
    ${arc.map((a,i)=>`<div class="round-card">
      <div class="rc-head">
        <span class="rc-num">${a.state.name}</span>
        <span class="rc-stat">${a.state.tableCount} tables · ${a.state.roundCount} rounds · ${new Date(a.finished).toLocaleDateString()}</span>
      </div>
      <button class="btn btn-blue btn-sm" onclick="viewArchive(${i})">View Results</button>
    </div>`).join('')}
  </div>`;
}
window.viewArchive=function(i){
  const a=getArchives()[i];if(!a)return;
  const mpData=calcMPFromData(a.boards,a.movements);
  const pairs=a.pairs||{};
  const rows=Object.values(pairs).filter(p=>!p.isPhantom).map(p=>{
    const mp=mpData[p.id]||{mp:0,boards:0,top:0};
    const pct=mp.top>0?(mp.mp/mp.top*100).toFixed(1):0;
    return{...p,mp:mp.mp,pct:parseFloat(pct)};
  }).sort((a,b)=>b.pct-a.pct);
  const rowsHTML=rows.map((r,idx)=>`<tr>
    <td style="font-weight:700;">${idx+1}</td>
    <td style="font-weight:600;">${r.name}</td>
    <td style="color:${r.dir==='NS'?'var(--blue)':'var(--gold)'};">${r.dir}</td>
    <td style="font-weight:700;">${r.mp}</td>
    <td style="color:${r.pct>=60?'var(--green)':r.pct>=45?'var(--gold)':'var(--red)'};">${r.pct}%</td>
  </tr>`).join('');
  // Also show all board results in a separate section
  const bkeys=Object.keys(a.boards||{}).filter(k=>a.boards[k].status==='done').sort();
  const boardRowsHTML=bkeys.slice(0,50).map(k=>{
    const d=a.boards[k];const[t,r,b]=k.split('_');
    const m=(a.movements||{})[r+'_'+t]||{};
    const ns=pairs[m.ns]||{name:m.ns||'?'};
    const ew=pairs[m.ew]||{name:m.ew||'?'};
    const sc=typeof d.nsScore==='number'?((d.nsScore>0?'+':'')+d.nsScore):d.nsScore||'?';
    return`<tr>
      <td style="color:var(--gold);font-size:0.7rem;">M${t}/T${r}/B${b}</td>
      <td style="color:var(--blue);font-size:0.75rem;">${ns.name}</td>
      <td style="color:var(--gold);font-size:0.75rem;">${ew.name}</td>
      <td style="font-family:'Share Tech Mono',monospace;font-size:0.75rem;">${d.contract||'PASS'}</td>
      <td style="font-weight:700;color:${typeof d.nsScore==='number'?(d.nsScore>0?'var(--green)':'var(--red)'):'var(--purple)'};">${sc}</td>
    </tr>`;
  }).join('');
  openModal(`${a.state.name} — Results`,
    `<div style="font-size:0.75rem;color:var(--text3);margin-bottom:8px;">${rows.length} pairs · ${bkeys.length} boards completed</div>
    <div style="font-weight:600;color:var(--gold);font-size:0.78rem;margin-bottom:6px;">Rankings</div>
    <table class="mv-table"><thead><tr><th>#</th><th>Full Name</th><th>Dir</th><th>MP</th><th>%</th></tr></thead><tbody>${rowsHTML}</tbody></table>
    ${boardRowsHTML?'<div style="font-weight:600;color:var(--gold);font-size:0.78rem;margin:10px 0 6px;">Board Results</div><table class="mv-table"><thead><tr><th>Table/R/B</th><th>NS</th><th>EW</th><th>Contract</th><th>NS Score</th></tr></thead><tbody>'+boardRowsHTML+'</tbody></table>':''}`,
    `<button class="btn btn-ghost" onclick="closeModal()">Close</button>
     <button class="btn btn-gold btn-sm" onclick="exportArchivePBN(${i})">🃏 PBN</button>
     <button class="btn btn-blue btn-sm" onclick="archivePDF(${i})">PDF Output</button>`);
};

window.archivePDF=function(i){
  const a=getArchives()[i];if(!a)return;
  const mpData=calcMPFromData(a.boards,a.movements);
  const pairs=a.pairs||{};
  const rows=Object.values(pairs).filter(p=>!p.isPhantom).map(p=>{
    const mp=mpData[p.id]||{mp:0,boards:0,top:0};
    const pct=mp.top>0?(mp.mp/mp.top*100).toFixed(1):0;
    return{...p,mp:mp.mp,pct:parseFloat(pct)};
  }).sort((x,y)=>y.pct-x.pct);
  let rankRows='';
  rows.forEach((r,idx)=>{
    const bg=idx===0?'#fff8e1':idx%2===0?'#fafafa':'#fff';
    rankRows+=`<tr style="background:${bg}"><td style="font-weight:700;">${idx+1}</td><td style="font-weight:600;">${r.name}</td><td style="color:${r.dir==='NS'?'#1565c0':'#e65100'};">${r.dir}</td><td style="font-weight:700;">${r.mp}</td><td style="font-weight:700;color:${r.pct>=60?'#2e7d32':r.pct>=45?'#e65100':'#c62828'};">${r.pct}%</td></tr>`;
  });
  const bkeys=Object.keys(a.boards||{}).filter(k=>a.boards[k].status==='done').sort();
  let bRows='';
  bkeys.forEach(k=>{
    const d=a.boards[k];const[t,r,b]=k.split('_');
    const m=(a.movements||{})[r+'_'+t]||{};
    const ns=pairs[m.ns]||{name:m.ns||'?'};const ew=pairs[m.ew]||{name:m.ew||'?'};
    const sc=typeof d.nsScore==='number'?((d.nsScore>0?'+':'')+d.nsScore):d.nsScore||'?';
    const bg=typeof d.nsScore==='number'?(d.nsScore>0?'#e8f5e9':d.nsScore<0?'#ffebee':'#fff8e1'):'#f5f5f5';
    bRows+=`<tr style="background:${bg}"><td>M${t}/T${r}/B${b}</td><td>${ns.name}</td><td>${ew.name}</td><td style="font-family:monospace;">${d.contract||'PASS'}</td><td style="font-family:monospace;">${d.lead||'-'}</td><td style="font-weight:700;">${sc}</td></tr>`;
  });
  const st=a.state||{};
  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${st.name} Results</title>
  <style>body{font-family:Arial,sans-serif;font-size:11px;margin:16px;color:#222;}h1{font-size:17px;color:#1a237e;margin-bottom:3px;}h2{font-size:12px;color:#1a237e;border-bottom:1px solid #1a237e;padding-bottom:2px;margin:14px 0 5px;}.meta{font-size:10px;color:#666;margin-bottom:12px;}table{width:100%;border-collapse:collapse;margin-bottom:10px;}th{background:#1a237e;color:#fff;padding:4px 7px;text-align:left;font-size:9px;text-transform:uppercase;}td{padding:4px 7px;border-bottom:1px solid #e0e0e0;}</style>
  </head><body>
  <h1>♠ ${st.name||'Tournament'}</h1>
  <div class="meta">${st.tableCount||'?'} tables · ${st.roundCount||'?'} rounds · ${st.scoring||'MP'} · Finished: ${a.finished?new Date(a.finished).toLocaleString(window.isTurkish?.()?'tr-TR':'en-US'):''}</div>
  <h2>Overall Rankings</h2>
  <table><thead><tr><th>#</th><th>Full Name</th><th>Dir</th><th>MP</th><th>%</th></tr></thead><tbody>${rankRows}</tbody></table>
  <h2>Board Results (${bkeys.length} boards)</h2>
  <table><thead><tr><th>Table/Round/B</th><th>NS</th><th>EW</th><th>Contract</th><th>Opening Lead</th><th>NS Score</th></tr></thead><tbody>${bRows}</tbody></table>
  </body></html>`);
  win.document.close();
  if(window.localizePrintWindow)window.localizePrintWindow(win);
  else setTimeout(()=>win.print(),80);
};

function calcMPFromData(boards,movements){
  const boardScores={};
  Object.entries(boards).forEach(([key,b])=>{
    if(b.status!=='done')return;const[t,r,bn]=key.split('_');
    // Same fix as calcMP() — group by board number only, not round+board.
    const groupKey=bn;
    if(!boardScores[groupKey])boardScores[groupKey]=[];const m=movements[r+'_'+t]||{};
    if(typeof b.nsScore!=='number')return;
    boardScores[groupKey].push({ns:m.ns,ew:m.ew,nsScore:b.nsScore});
  });
  const pairMP={};
  Object.entries(boardScores).forEach(([,scores])=>{
    const n=scores.length;if(n<2)return;const top=(n-1)*2;
    scores.forEach(s=>{let nsMP=0,ewMP=0;scores.forEach(s2=>{if(s===s2)return;if(s.nsScore>s2.nsScore)nsMP+=2;else if(s.nsScore===s2.nsScore){nsMP++;ewMP++;}else ewMP+=2;});
      if(s.ns){if(!pairMP[s.ns])pairMP[s.ns]={mp:0,boards:0,top:0};pairMP[s.ns].mp+=nsMP;pairMP[s.ns].boards++;pairMP[s.ns].top+=top;}
      if(s.ew){if(!pairMP[s.ew])pairMP[s.ew]={mp:0,boards:0,top:0};pairMP[s.ew].mp+=ewMP;pairMP[s.ew].boards++;pairMP[s.ew].top+=top;}
    });
  });
  return pairMP;
}


// ── Security ──
function renderSecurity(){
  setTimeout(async()=>{ const p=await getTablePrefix(); const i=document.getElementById('secPrefix'); if(i){ i.value=p; secShowCodes(); } },0);
  const link=location.origin+location.pathname+'?club='+encodeURIComponent(CLUB_ID||'')+'&role=table';
  return`
  <div class="card">
    <div class="card-title"><span>🔑</span> Table codes</div>
    <p style="font-size:0.82rem;color:var(--text2);margin-bottom:14px;">Each table signs in with a 4-digit code: the 2-digit prefix below and its table number. With 00, table 1 is 0001, table 2 is 0002 and so on. Change the prefix to make the old codes stop working.</p>
    <div class="field"><label>Prefix (2 digits)</label>
      <div style="display:flex;gap:6px;"><input type="text" id="secPrefix" maxlength="2" inputmode="numeric" style="width:90px;font-size:1.2rem;text-align:center;" oninput="secShowCodes()"><button class="btn btn-gold" onclick="secSavePrefix()">💾 Save</button></div>
    </div>
    <div id="secCodes" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px;margin:10px 0 16px;"></div>
    <div class="field"><label>Link for the table devices</label><input type="text" readonly value="${link}" onclick="this.select()"></div>
    <div style="font-size:0.75rem;color:var(--text3);">Open this link on each table's phone or tablet and type that table's code.</div>
    <div style="display:flex;gap:8px;margin-top:10px;"><button class="btn btn-full" style="background:#25d366;color:#fff;" onclick="secSend('wa',0)">💬 WhatsApp</button><button class="btn btn-ghost btn-full" onclick="secSend('sms',0)">✉️ SMS</button></div>
    <div style="font-size:0.75rem;color:var(--text3);margin-top:6px;">💬 / ✉️ under a table: its link and its code in one message.</div>
  </div>`;
}
// the codes of every table, from the prefix being typed
// the address a table opens (the club and the table role filled in)
const secLink=()=>location.origin+location.pathname+'?club='+encodeURIComponent(CLUB_ID||'')+'&role=table';
// the message for one table (its code), or for every table (the link only)
const secMsg=(n,code)=>n?`BridgeGate · ${CLUB_NAME||''}\n${i18nText?i18nText('Table')+' '+n:'Table '+n} · ${i18nText?i18nText('Code'):'Code'}: ${code}\n${secLink()}`:`BridgeGate · ${CLUB_NAME||''}\n${secLink()}`;
window.secSend=function(how,n){
  const p=(document.getElementById('secPrefix')?.value||'').replace(/\D/g,'');
  const code=n?p+String(n).padStart(2,'0'):'';
  // a table's link carries its code: tapping it signs that table in at once
  const text=secMsg(n, code).replace(secLink(), code?secLink()+'&t='+code:secLink());
  if(how==='wa') window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener');
  else location.href='sms:?&body='+encodeURIComponent(text);
};
window.secShowCodes=function(){
  const p=(document.getElementById('secPrefix')?.value||'').replace(/\D/g,'');
  const box=document.getElementById('secCodes'); if(!box) return;
  const n=Math.max(getState().tableCount||0, 1);
  box.innerHTML=p.length===2?Array.from({length:Math.min(n,99)},(_,i)=>`<div style="padding:8px;border:1px solid var(--border);border-radius:8px;text-align:center;"><div style="font-size:0.7rem;color:var(--text3);">Table ${i+1}</div><div style="font-size:1.3rem;font-weight:700;letter-spacing:2px;color:var(--gold);">${p}${String(i+1).padStart(2,'0')}</div><div style="display:flex;gap:4px;justify-content:center;margin-top:6px;"><button class="btn btn-sm" style="background:#25d366;color:#fff;" title="WhatsApp" onclick="secSend('wa',${i+1})">💬</button><button class="btn btn-ghost btn-sm" title="SMS" onclick="secSend('sms',${i+1})">✉️</button></div></div>`).join(''):'';
};
window.secSavePrefix=async function(){
  const p=(document.getElementById('secPrefix')?.value||'').trim();
  try{ await saveTablePrefix(p); toast('✅ Table codes saved'); secShowCodes(); }
  catch(e){ toast('❌ '+e.message); }
};

// ── Log ──
function renderLog(){
  const logs=getLogs();
  if(!logs.length)return`<div class="empty-state"><div class="empty-icon">📋</div>No logs yet</div>`;
  return`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div class="card-title" style="margin:0;"><span>📋</span> System Log (${logs.length})</div>
      <button class="btn btn-red btn-sm" onclick="confirmClearLogs()">Clear</button>
    </div>
    ${logs.map(l=>`<div class="log-item">
      <span style="font-size:0.9rem;">${l.type==='ok'?'✅':l.type==='warn'?'⚠️':'❌'}</span>
      <div class="log-text"><div class="lt">${l.msg}</div>${l.detail?`<div class="ls">${l.detail}</div>`:''}</div>
      <span class="log-badge ${l.type==='ok'?'lb-ok':l.type==='warn'?'lb-warn':'lb-err'}">${l.time}</span>
    </div>`).join('')}
  </div>`;
}

// ── Init ──
document.getElementById('loginScreen').style.display='flex';
document.getElementById('app').style.display='none';

// Connectivity monitor
(function(){
  function updateConn(){
    const b=document.getElementById('connBadge'); if(!b)return;
    if(navigator.onLine){
      b.style.background='var(--greendim)';b.style.color='var(--green)';
      b.style.borderColor='rgba(76,175,125,0.3)';b.textContent='🟢 Online';
    } else {
      b.style.background='var(--reddim)';b.style.color='var(--red)';
      b.style.borderColor='rgba(224,90,78,0.3)';b.textContent='🔴 Offline';
    }
  }
  window.addEventListener('online', updateConn);
  window.addEventListener('offline', updateConn);
  setInterval(updateConn, 5000);
})();
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeModal();
  if(e.key==='Enter'&&document.activeElement?.id==='pwInput')doLogin();
  if(e.key==='Enter'&&document.activeElement?.id==='tableInput')bmSelectTable();
});

// ── Hands & double-dummy analysis (Boards tab) ──
const DD_SYM=['♣','♦','♥','♠','NT'], DD_SEAT='NESW';
const ddRed=s=>s==='♥'||s==='♦';
function ddSuitLine(sym,cards){return `<div class="dd-sl"><span class="${ddRed(sym)?'dd-red':''}">${sym}</span> ${cards?cards.split('').map(c=>c==='T'?'10':c).join(' '):'—'}</div>`;}
// the four hands round the table (North on top), from a PBN deal "N:… … … …"
function ddDiagram(deal){
  const m=String(deal||'').match(/^N:(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/);if(!m)return'';
  const hand=(i,name)=>{const p=m[i].split('.');return `<div class="dd-hand"><b>${name}</b>${['♠','♥','♦','♣'].map((s,k)=>ddSuitLine(s,p[k])).join('')}</div>`;};
  return `<div class="dd-diag"><div class="dd-n">${hand(1,'N')}</div><div class="dd-w">${hand(4,'W')}</div><div class="dd-e">${hand(2,'E')}</div><div class="dd-s">${hand(3,'S')}</div></div>`;
}
// tricks for each declarer in each strain
function ddTableHtml(t){
  if(!t)return'';
  return `<table class="mv-table dd-tab"><thead><tr><th></th>${[4,3,2,1,0].map(s=>`<th class="${ddRed(DD_SYM[s])?'dd-red':''}">${DD_SYM[s]}</th>`).join('')}</tr></thead><tbody>${[0,2,1,3].map(d=>`<tr><th>${DD_SEAT[d]}</th>${[4,3,2,1,0].map(s=>{const n=t[d][s];return `<td class="${n>=7?'dd-make':''}">${n==null?'?':n>=7?n-6:'–'}</td>`;}).join('')}</tr>`).join('')}</tbody></table>
  <div class="dd-note">The numbers are the level each player can make as declarer (– = not even 1); all four hands open, best play on both sides.</div>`;
}
// a result at a table against the analysis: how many tricks were taken compared with double dummy
function ddCompare(d,dd){
  if(!dd||!d||!d.level||!d.suit||!d.declarer)return'';
  const si=DD_SYM.indexOf(d.suit),di=DD_SEAT.indexOf(d.declarer);if(si<0||di<0)return'';
  const best=dd.t[di][si];if(best==null)return'';
  const took=d.level+6+(+d.result||0),diff=took-best;
  return diff===0?'<span class="dd-eq">= DD</span>':diff>0?`<span class="dd-up">+${diff} vs DD</span>`:`<span class="dd-down">${diff} vs DD</span>`;
}
function renderHandsAnalysis(){
  const hands=_cache['hands']||[],dd=_cache['dd']||{};
  const done=hands.filter(h=>dd[String(h.board)]).length;
  const head=`<div class="card-title"><span>🧮</span> Hands &amp; Double-Dummy Analysis</div>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center;">
      <button class="btn btn-blue btn-sm" onclick="adminImportHandsOpen()">🃏 Load hand file</button>
      ${hands.length?`<button class="btn btn-gold btn-sm" onclick="startDDAnalysis(true)">🧮 Analyse again</button>`:''}
      <span id="ddProgress" style="font-size:0.75rem;color:var(--text3);">${hands.length?(_ddRunning?'⏳ ':'')+done+' / '+hands.length+' analysed':''}</span>
    </div>`;
  if(!hands.length)return `<div class="card">${head}<div style="font-size:0.8rem;color:var(--text3);">Load the file from your dealing machine (Dealer4 .dlm, Duplimate .dup/.bri/.dge) or a PBN / LIN file: every board then shows its hands, what each player can make and the par score.</div></div>`;
  if(!_ddRunning&&done<hands.length&&role==='admin')setTimeout(()=>startDDAnalysis(),300);   // continue an analysis that was interrupted
  return `<div class="card">${head}<div class="dd-list">${hands.map(h=>{
    const a=dd[String(h.board)];
    return `<button class="dd-row" onclick="showBoardAnalysis('${String(h.board).replace(/[^0-9A-Za-z]/g,'')}')"><b>Board ${h.board}</b><span>${h.dealer||''} · ${h.vulnerable||''}</span><span class="dd-par">${a?'Par: '+a.par.text:'⏳'}</span></button>`;
  }).join('')}</div></div>`;
}
window.showBoardAnalysis=function(b){
  const h=(_cache['hands']||[]).find(x=>String(x.board)===String(b));if(!h)return;
  const a=(_cache['dd']||{})[String(h.board)];
  const boards=getBoards(),pairs=getPairs(),mv=getMovements();
  const rows=Object.keys(boards).filter(k=>k.split('_')[2]===String(h.board)&&boards[k].status==='done').map(k=>{
    const d=boards[k],[t,r]=k.split('_'),m=mv[r+'_'+t]||{};
    return `<tr><td>T${t}/R${r}</td><td>${pairs[m.ns]?.name||m.ns||''}</td><td>${pairs[m.ew]?.name||m.ew||''}</td><td style="font-family:'Share Tech Mono',monospace;">${d.contract||'—'}</td><td>${typeof d.nsScore==='number'?(d.nsScore>0?'+':'')+d.nsScore:'—'}</td><td>${a?ddCompare(d,a):''}</td></tr>`;
  }).join('');
  openModal('Board '+h.board,`
    <div style="font-size:0.75rem;color:var(--text2);margin-bottom:6px;">Dealer ${h.dealer||'?'} · Vulnerable: ${h.vulnerable||'?'}</div>
    ${ddDiagram(h.deal)}
    ${a?`<div class="dd-parline">Par: <b>${a.par.text}</b></div>${ddTableHtml(a.t)}`:'<div class="dd-note">⏳ The analysis of this board is not ready yet.</div>'}
    ${rows?`<table class="mv-table" style="margin-top:10px;"><thead><tr><th>Table</th><th>NS</th><th>EW</th><th>Contract</th><th>NS score</th><th>Tricks</th></tr></thead><tbody>${rows}</tbody></table>`:''}`,
    `<button class="btn btn-gold" onclick="closeModal()">Close</button>`);
};
