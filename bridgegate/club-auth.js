// ══════════════════════════════════════════════════════
//  CLUB TOURNAMENTS IN BRIDGE TABLE — sign-in
// ══════════════════════════════════════════════════════
// The player signs in with their Bridge Table name and PIN (bridge-auth.js). Servet is the super admin; the player who
// opens a club is its admin (no password); a table signs in with its 4-digit code: the club's 2-digit table prefix and
// the table number (prefix 00: table 1 = 0001, table 2 = 0002 …). The database rules check all of it.

// ══════════════════════════════════════════════════════
//  CLUB RESOLUTION (multi-tenant)
// ══════════════════════════════════════════════════════
// Checks /clubs/{id}/info.json — returns the info object if the club exists, else null.
async function checkClubExists(id){
  try{
    const url = await fbRootUrl('/clubs/'+encodeURIComponent(id)+'/info.json');
    const r = await fetch(url,{cache:'no-store'});
    if(!r.ok) return null;
    const v = await r.json();
    return (v && v.name) ? cleanData(v) : null;
  }catch(e){ return null; }
}
let CLUB_INFO=null;   // the resolved club's info (name, owner)

// Locks in the active club: sets CLUB_ID/FBURL, persists it, and reflects it in the URL
// so the page stays a single shareable link (?club=CLUBID).
function setClub(id){
  CLUB_ID=id;
  FBURL=FB_BASE+'/clubs/'+id+'/bm';
  try{ localStorage.setItem('bg_clubId', id); }catch(e){}
  try{
    const u=new URL(location.href);
    u.searchParams.set('club', id);
    history.replaceState(null, '', u);
  }catch(e){}
}

// the signed-in Bridge Table player, and whether they may run this club
const me=()=>window.bridgeUser&&window.bridgeUser();
const isSuper=()=>{ const u=me(); return !!u&&u.key==='servet'; };
const isClubAdmin=()=>{ const u=me(); return !!u&&(isSuper()||(CLUB_INFO&&CLUB_INFO.owner===u.key)); };

function showLoginForm(clubName){
  CLUB_NAME=clubName||null;
  document.getElementById('clubGate').style.display='none';
  document.getElementById('loginForm').style.display='block';
  document.getElementById('loginSub').textContent=clubName||'Tournament Control System';
  const badge=document.getElementById('topbarClub');
  if(badge){
    if(clubName){ badge.textContent='🏛 '+clubName; badge.style.display='inline-flex'; }
    else badge.style.display='none';
  }
  document.querySelectorAll('.superLink').forEach(a=>a.style.display=isSuper()?'':'none');
  // the club's admin (and the super admin) signs in with their PIN; a table comes with its link and code, a screen with its link
  selRole(isClubAdmin()?'admin':'table');
}

async function openClub(id, err){
  const info=await checkClubExists(id);
  if(!info){ if(err) err.textContent='❌ Club not found'; return false; }
  if(info.active===false&&!isSuper()){ if(err) err.textContent='❌ This club is switched off'; return false; }
  CLUB_INFO=info; setClub(id); showLoginForm(info.name);
  return true;
}
window.openMyClub=id=>openClub(id, document.getElementById('clubErr'));

// the clubs this player opened (gate/owners/<name>)
async function myClubs(){
  const u=me(); if(!u) return {};
  try{ const r=await fetch(await fbRootUrl('/owners/'+encodeURIComponent(u.key)+'.json'),{cache:'no-store'}); return r.ok?cleanData(await r.json()||{}):{}; }catch(e){ return {}; }
}
// a new club: this player is its admin; the tables' prefix starts as 00 (table 1 = 0001)
window.createMyClub=async function(){
  const err=document.getElementById('clubErr');err.textContent='';
  const u=me(); if(!u){ err.textContent='❌ Sign in to Bridge Table first'; return; }
  const name=(document.getElementById('newClubName').value||'').trim().slice(0,40);
  if(!name){ err.textContent='❌ Enter the club name'; return; }
  await window.bridgeSession();
  const slug=name.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,20)||'club';
  const id=slug+'-'+Math.random().toString(36).slice(2,6);
  const put=async(path,v)=>{ const r=await fetch(await fbRootUrl(path),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)}); if(!r.ok) throw new Error('Firebase '+r.status); };
  try{
    await put('/clubs/'+id+'/info.json',{name,owner:u.key,ownerName:u.name,created:new Date().toISOString(),active:true});
    await put('/clubs/'+id+'/secret.json',{tprefix:'00'});
    await put('/owners/'+encodeURIComponent(u.key)+'/'+id+'.json',name);
  }catch(e){ err.textContent='❌ '+e.message; return; }
  toast('✅ Club created');
  await openClub(id, err);
};

// The club gate: the player's own clubs, a new club, or a club ID (a table device gets the club's link)
async function initClubGate(){
  const params=new URLSearchParams(location.search);
  let id=params.get('club');
  const roleParam=params.get('role');
  const fromLink=!!id;
  if(!id){ try{ id=localStorage.getItem('bg_clubId'); }catch(e){} }
  const u=me();
  if(u) await window.bridgeSession();
  // the tournaments running now: their entry screen (table number, or Admin); ?admin=1 goes past it to the club's sign-in
  if(u&&!roleParam&&params.get('admin')!=='1'){
    const live=await liveTournaments();
    if(live.length){ await renderEntry(live); return; }
  }
  if(id){
    const info=await checkClubExists(id);
    // the club this device opened last opens again only for its admin: another player on the same phone or PC
    // (signed in with another name) goes to the tournament running now, at the table number
    const ownClub=info&&u&&(u.key==='servet'||info.owner===u.key);
    // a player (not this club's admin) at a club whose tournament is running: the table number at once
    if(info&&u&&!ownClub&&!roleParam){
      const lt=(await liveTournaments()).find(t=>t.club===id);
      if(lt){ location.replace(location.pathname+'?club='+encodeURIComponent(id)+'&role=table&p='+lt.p); return; }
    }
    if(info&&(info.active!==false||isSuper())&&(fromLink||ownClub)){
      CLUB_INFO=info; setClub(id); showLoginForm(info.name);
      if(roleParam&&['table','screen'].includes(roleParam)) selRole(roleParam);
      // a table's own link carries its code (&t=0003): it signs in at once
      const tc=params.get('t'); if(roleParam==='table'&&/^\d{4}$/.test(tc||'')){ document.getElementById('pwInput').value=tc; setTimeout(()=>doLogin(),50); }
      // a screen's link (from the admin panel) opens the results screen at once
      if(roleParam==='screen') setTimeout(()=>doLogin(),50);
      // a player from Bridge Table's "Table No" (the club's table code prefix in the link): the players' names, then the table
      // a table number already chosen on the entry screen (&tn=3): straight to the players
      const pp=params.get('p'), tn=+params.get('tn')||0; if(roleParam==='table'&&!tc&&/^\d{2}$/.test(pp||'')){ if(tn) bgPlayerNames(pp,tn); else bgPlayerEntry(pp); }
      return;
    }
    if(!info||(info.active===false&&!isSuper())){ try{ localStorage.removeItem('bg_clubId'); }catch(e){} }
  }
  // the player's own club opens at once (the admin types the PIN and is in the admin panel)
  let mine={};
  if(u){ mine=await myClubs(); const ids=Object.keys(mine); if(ids.length===1&&await openClub(ids[0],null)){ setTimeout(()=>document.getElementById('pwInput')?.focus(),100); return; } }
  // a player: the tournament running now asks the table number at once (several: the player chooses)
  if(u&&!Object.keys(mine).length&&!isSuper()){
    const live=await liveTournaments();
    if(live.length===1){ location.replace(location.pathname+'?club='+encodeURIComponent(live[0].club)+'&role=table&p='+live[0].p); return; }
    if(live.length>1){ renderClubGate(live); return; }
  }
  renderClubGate();
}
// the entry screen of the tournaments running now: each with its table number keys, and Admin for its club's admin
async function renderEntry(live){
  const g=document.getElementById('clubGate'); g.style.display='block';
  const box=document.getElementById('myClubsBox'); if(!box) return;
  const u=me(), go=(t,q)=>location.pathname+'?club='+encodeURIComponent(t.club)+q;
  const own=await Promise.all(live.map(async t=>{ if(isSuper()) return true; const i=await checkClubExists(t.club); return !!(i&&u&&i.owner===u.key); }));
  box.innerHTML=live.map((t,k)=>`<div class="bg-entry"><div class="bg-entry-name">🏛 ${cleanData(t.c||'')}${t.n?' — '+cleanData(t.n):''}</div>
    <div class="bg-entry-lbl">Table No</div>
    <div class="bm3-keys k4" style="padding:0;">${Array.from({length:t.tb||0},(_,i)=>`<button class="bm3-key" onclick="location.replace('${go(t,'&role=table&p='+t.p+'&tn='+(i+1))}')">${i+1}</button>`).join('')}</div>
    ${own[k]?`<button class="btn-primary" style="margin-top:10px;" onclick="location.replace('${go(t,'&admin=1')}')">⚙️ Admin</button>`:''}</div>`).join('')
    +(isSuper()||Object.keys(await myClubs()).length?`<a href="${location.pathname}?admin=1" style="display:inline-block;margin-top:10px;font-size:0.75rem;color:var(--text3);">🏛 My clubs</a>`:'');
  document.querySelectorAll('.superLink').forEach(a=>a.style.display=isSuper()?'':'none');
}
// the club tournaments running now (gate/live: name, club, tables, table code prefix)
async function liveTournaments(){
  try{ const r=await fetch(await fbRootUrl('/live.json')); const v=r.ok?await r.json():null;
    return Object.entries(v||{}).map(([club,t])=>({club,...t})).filter(t=>t&&/^\d{2}$/.test(t.p||'')&&Date.now()-t.ts<24*3600e3).sort((a,b)=>b.ts-a.ts);
  }catch(e){ return []; }
}
async function renderClubGate(live){
  const g=document.getElementById('clubGate'); g.style.display='block';
  const u=me(), box=document.getElementById('myClubsBox');
  document.querySelectorAll('.superLink').forEach(a=>a.style.display=isSuper()?'':'none');
  if(!box) return;
  if(!u){ box.innerHTML=`<div class="login-err" style="color:var(--text2);">Sign in to Bridge Table first (name and PIN), then come back here.</div><a class="btn-primary" style="display:block;text-decoration:none;margin-top:8px;" href="../">← Bridge Table</a>`; return; }
  const mine=await myClubs(), ids=Object.keys(mine);
  // the tournaments running now: a player chooses one and gives the table number
  const lv=(live||[]).map(t=>`<button class="btn-primary" style="margin-bottom:6px;" onclick="location.replace(location.pathname+'?club=${encodeURIComponent(t.club)}&role=table&p=${t.p}')">🃏 ${cleanData(t.c||'')}${t.n?' — '+cleanData(t.n):''}</button>`).join('');
  box.innerHTML=`<div style="font-size:0.8rem;color:var(--text2);margin-bottom:6px;">👤 ${cleanData(u.name)}</div>${lv}
    ${ids.length?`<div style="font-size:0.72rem;color:var(--text3);margin:6px 0 4px;">My clubs</div>`+ids.map(i=>`<button class="btn-primary" style="margin-bottom:6px;" onclick="openMyClub('${i}')">🏛 ${mine[i]}</button>`).join(''):''}
    <div style="font-size:0.72rem;color:var(--text3);margin:10px 0 4px;">${ids.length?'Open another club':'Open your club'}</div>
    <div class="pw-wrap"><input type="text" id="newClubName" maxlength="40" placeholder="Club name" onkeydown="if(event.key==='Enter')createMyClub()"></div>
    <button class="btn-primary" onclick="createMyClub()">➕ Create club</button>`;
}
initClubGate();

// ══════════════════════════════════════════════════════
//  SESSIONS
// ══════════════════════════════════════════════════════
// Admin and super admin: the Bridge Table session (name + PIN) is enough, the rules know the club's admin.
// A table: /tsess/{this device's hidden account} = {club, code}; the rules accept it only with a right code.
async function startSession(r, club, code){
  const token=await authToken(); const uid=window._authUid;
  if(!token||!uid) throw new Error('No connection to the database');
  // the admin types their own Bridge Table PIN: the database accepts the session only with the right one
  if(r==='superadmin') return isSuper() && /^\d{4}$/.test(String(code||'').trim()) && (await window.bridgeSession(code));
  if(r==='admin') return isClubAdmin() && /^\d{4}$/.test(String(code||'').trim()) && (await window.bridgeSession(code));
  if(r==='table'){
    const c=String(code||'').trim();
    if(!/^\d{4}$/.test(c)) return false;
    const res=await fetch(FB_BASE+'/tsess/'+uid+'.json?auth='+token,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({club:String(club),code:c})});
    if(res.ok) return true;
    if(res.status!==401) throw new Error('Firebase error '+res.status);
    return false;
  }
  return false;
}
async function endSession(){
  try{ const token=await authToken(); const uid=window._authUid; if(token&&uid) await fetch(FB_BASE+'/tsess/'+uid+'.json?auth='+token,{method:'DELETE'}); }catch(e){}
}

// the tables' code prefix (2 digits): table N signs in with prefix + N (00 → 0001, 0002 …)
async function getTablePrefix(){
  try{ const r=await fetch(await fbRootUrl('/clubs/'+CLUB_ID+'/secret/tprefix.json'),{cache:'no-store'}); return r.ok?(await r.json()||'00'):'00'; }catch(e){ return '00'; }
}
async function saveTablePrefix(p){
  if(!/^\d{2}$/.test(p)) throw new Error('Two digits, e.g. 00');
  const r=await fetch(await fbRootUrl('/clubs/'+CLUB_ID+'/secret/tprefix.json'),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
  if(!r.ok) throw new Error('Firebase write failed: '+r.status);
}

// ══════════════════════════════════════════════════════
//  SUPER ADMIN — club-independent, manages /clubs/*
// ══════════════════════════════════════════════════════
async function fbAuthToken(){ return authToken(); }

// Lists all clubs: shallow key fetch, then one info fetch per club.
async function saListClubs(){
  const token = await fbAuthToken();
  const shallowUrl = FB_BASE+'/clubs.json?shallow=true'+(token?'&auth='+token:'');
  const r = await fetch(shallowUrl,{cache:'no-store'});
  if(!r.ok) return [];
  const keys = await r.json();
  if(!keys) return [];
  const ids = Object.keys(keys);
  const infos = await Promise.all(ids.map(async id=>{
    try{
      const url = FB_BASE+'/clubs/'+id+'/info.json'+(token?'?auth='+token:'');
      const rr = await fetch(url,{cache:'no-store'});
      const v = rr.ok ? await rr.json() : null;
      return {id, name:cleanData((v&&v.name)||id), owner:cleanData((v&&(v.ownerName||v.owner))||''), ownerKey:(v&&v.owner)||'', created:(v&&v.created)||null, active:(v&&v.active!==false)};
    }catch(e){ return {id, name:id, created:null, active:true}; }
  }));
  return infos.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
}

async function saSetClubActive(id, active){
  const token = await fbAuthToken();
  const q = token?'?auth='+token:'';
  const r = await fetch(FB_BASE+'/clubs/'+id+'/info/active.json'+q,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(active)});
  if(!r.ok) throw new Error('Firebase write failed: '+r.status);
}

async function saDeleteClub(id, ownerKey){
  const token = await fbAuthToken();
  const q = token?'?auth='+token:'';
  const r = await fetch(FB_BASE+'/clubs/'+id+'.json'+q,{method:'DELETE'});
  if(!r.ok) throw new Error('Firebase delete failed: '+r.status);
  if(ownerKey) try{ await fetch(FB_BASE+'/owners/'+encodeURIComponent(ownerKey)+'/'+id+'.json'+q,{method:'DELETE'}); }catch(e){}
}

// ══════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════
let role='admin';

window.selRole=function(r){
  role=r;
  document.getElementById('loginErr').textContent='';
  const inp=document.getElementById('pwInput'); inp.value='';
  // a table types its 4-digit code; the admin and the super admin their own Bridge Table PIN; the screen nothing
  document.getElementById('pwWrap').style.display=r==='screen'?'none':'block';
  inp.type=r==='table'?'text':'password';
  inp.placeholder=r==='table'?'Table code (4 digits)':'Your Bridge Table PIN'; inp.inputMode='numeric'; inp.maxLength=4;
};
selRole('table');

// Entered from the club gate — Super Admin doesn't need a resolved club.
window.enterSuperAdminLogin=function(){
  const cl=document.getElementById('clubLinks'); if(cl) cl.style.display='none';
  document.getElementById('clubGate').style.display='none';
  document.getElementById('loginForm').style.display='block';
  document.getElementById('backToClubGate').style.display='block';
  document.getElementById('loginSub').textContent='Super Admin';
  selRole('superadmin');
};
window.backToClubGate=function(){
  const cl=document.getElementById('clubLinks'); if(cl) cl.style.display='flex';
  document.getElementById('loginForm').style.display='none';
  document.getElementById('backToClubGate').style.display='none';
  document.getElementById('loginSub').textContent=CLUB_NAME||'Tournament Control System';
  renderClubGate();
  selRole('table');
};
// "Change club": forget the remembered club (this device and the address bar) and go back to the club gate
window.changeClub=function(){
  CLUB_ID=null; CLUB_NAME=null; CLUB_INFO=null; FBURL=null;
  try{ localStorage.removeItem('bg_clubId'); }catch(e){}
  try{ const u=new URL(location.href); u.searchParams.delete('club'); u.searchParams.delete('role'); history.replaceState(null,'',u); }catch(e){}
  const badge=document.getElementById('topbarClub'); if(badge) badge.style.display='none';
  backToClubGate();
  const err=document.getElementById('clubErr'); if(err) err.textContent='';
};

window.doLogin=async function(){
  const err=document.getElementById('loginErr');err.textContent='';
  const pw=document.getElementById('pwInput').value;
  const loginBtn=document.querySelector('.btn-primary');

  // Super Admin — club-independent
  if(role==='superadmin'){
    if(loginBtn){loginBtn.disabled=true;loginBtn.textContent='Checking...';}
    let ok=false;
    try{ ok = await startSession('superadmin', null, pw); }
    catch(e){ if(loginBtn){loginBtn.disabled=false;loginBtn.textContent='Login';} err.textContent='❌ '+e.message; return; }
    if(loginBtn){loginBtn.disabled=false;loginBtn.textContent='Login';}
    if(!ok){ err.textContent=isSuper()?'❌ Wrong PIN':'❌ Only the super admin can sign in here'; return; }
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('app').style.display='flex';
    document.getElementById('topbarRole').textContent='Super Admin';
    const clubBadge=document.getElementById('topbarClub'); if(clubBadge) clubBadge.style.display='none';
    document.getElementById('topbarRound').style.display='none';
    renderSuperAdminPanel();
    return;
  }

  // Admin/Table/Screen all require a resolved club
  if(!CLUB_ID){ err.textContent='❌ No club selected'; return; }

  // Screen role — no password needed
  if(role==='screen'){
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('app').style.display='flex';
    document.getElementById('topbarRole').textContent='Screen';
    await preloadCache();
    refreshTopbar();renderPanel();
    DB.subscribe('state',(val)=>{_cache['state']=val;refreshTopbar();renderScreenPanel();});
    DB.subscribe('boards',(val)=>{_cache['boards']=val;renderScreenPanel();});
    DB.subscribe('pairs',(val)=>{_cache['pairs']=val;renderScreenPanel();});
    return;
  }

  // Check password
  if(loginBtn){loginBtn.disabled=true;loginBtn.textContent='Checking...';}
  let ok=false;
  try{ ok = await startSession(role, CLUB_ID, pw); }
  catch(e){ if(loginBtn){loginBtn.disabled=false;loginBtn.textContent='Login';} err.textContent='❌ '+e.message; return; }
  if(loginBtn){loginBtn.disabled=false;loginBtn.textContent='Login';}
  if(!ok){err.textContent=role==='table'?'❌ Wrong table code':isClubAdmin()?'❌ Wrong PIN':'❌ You are not this club\'s admin';return;}
  // the code says which table this is: prefix + table number (0003 = table 3)
  document.body.classList.toggle('bg-device',role==='table');   // a table: the Bridgemate III look from here on
  if(role==='table'){ window.bmCodeTable=parseInt(String(pw).trim().slice(2),10)||null; window.bmCodePrefix=String(pw).trim().slice(0,2); }   // the prefix: for Change table

  // Preload all data from Firebase
  if(loginBtn){loginBtn.disabled=true;loginBtn.textContent='Loading...';}
  await preloadCache();
  if(loginBtn){loginBtn.disabled=false;loginBtn.textContent='Login';}

  // Enter app
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('app').style.display='flex';
  document.getElementById('topbarRole').textContent=role==='admin'?'Admin':'Table';

  if(role==='admin'){
    const st=getState();
    if(st&&st.status==='running'){
      refreshTopbar();
      document.getElementById('panelContent').innerHTML=`
        <div style="max-width:420px;margin:40px auto;padding:0 14px;">
          <div class="card" style="text-align:center;border-color:var(--gold);">
            <div style="font-size:2rem;margin-bottom:10px;">⚠️</div>
            <div style="font-size:1rem;font-weight:700;color:var(--gold);margin-bottom:6px;">Saved tournament found</div>
            <div style="font-size:0.82rem;color:var(--text2);margin-bottom:18px;">${st.name}</div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-green btn-full" onclick="sessionContinue()">&#x25b6; Continue</button>
              <button class="btn btn-red btn-full" onclick="sessionNew()">&#x2795; New Tournament</button>
            </div>
          </div>
        </div>`;
      DB.subscribe('state',()=>{refreshTopbar();});
      DB.subscribe('approvals',()=>{if(adminTab==='setup')renderAdminTab();});
      return;
    }
  }

  refreshTopbar();renderPanel();
  // signed in again on this page (a phone changing tables): the updates already arrive, the callbacks read role and table
  if(window._bgSubscribed) return;
  window._bgSubscribed=true;
  DB.subscribe('state',(val)=>{
    _cache['state']=val;
    refreshTopbar();
    if(role==='screen') renderScreenPanel();
    else if(role==='table' && bmTableNo) renderTableDetail(bmTableNo);
    else if(role==='table') renderTablePanel();   // the tournament has started: this table opens
    else if(role==='admin') {
      if(adminTab==='setup') { const c=document.getElementById('adminContent'); if(c)c.innerHTML=renderSetup(); }
      checkRoundComplete();
    }
  });
  DB.subscribe('pairs',()=>{ if(role==='admin'&&(adminTab==='players'||adminTab==='tables'))renderAdminTab(); });
  DB.subscribe('boards',(val)=>{
    _cache['boards']=val;
    if(role==='admin') { if(adminTab==='setup'||adminTab==='tables'||adminTab==='boards')renderAdminTab(); checkRoundComplete(); }
    if(role==='screen') renderScreenPanel();
  });
  DB.subscribe('approvals',()=>{
    if(role==='admin'&&adminTab==='setup') renderAdminTab();
    if(role==='table'&&bmTableNo) bmPollApprovals(bmTableNo);
  });
  DB.subscribe('tableLocks',()=>{ _cache['tableLocks']=null; DB.get('tableLocks'); });
  DB.subscribe('playerdb',()=>{}); // keeps _cache fresh for autocomplete
};
window.sessionContinue=function(){renderAdminPanel();};
window.sessionNew=async function(){
  if(!await confirmDialog('This will delete the current tournament. Are you sure?',{title:'New Tournament'}))return;
  Promise.all(['state','pairs','boards','movements','logs','approvals','hands','dd'].map(k=>DB.del(k))).then(()=>renderAdminPanel());
};
window.doLogout=function(){
  if(role==='table'&&bmTableNo){
    const st=getState();
    if(st&&st.status==='finished'){
      showTableFinalResults(bmTableNo);
      return; // real logout happens from the "Log Out" button on that screen
    }
  }
  performLogout();
};
window.showTableFinalResults=function(tableNo){
  if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
  const s=getState();
  // the other tables may still be playing: the results show when the director finishes the tournament
  if(s.status!=='finished'&&role!=='admin'){
    document.getElementById('panelContent').innerHTML=`
      <div class="bm-device" style="max-width:400px;">
        <div class="round-over-screen">
          <div class="ro-badge">🏁</div>
          <div class="ro-title">Table ${tableNo} has finished</div>
          <div class="ro-sub">The results appear here when the director finishes the tournament.</div>
        </div>
        <button class="btn btn-gold btn-full" style="margin-top:14px;" onclick="performLogout()">← Log Out</button>
      </div>`;
    bmPollInterval=setInterval(()=>{ if(getState().status==='finished'){ clearInterval(bmPollInterval); bmPollInterval=null; showTableFinalResults(tableNo); } },3000);
    return;
  }
  const pairMP=calcMP();
  const pairs=getPairs();
  const rows=Object.keys(pairs).filter(id=>!pairs[id].isPhantom).map(id=>{
    const d=pairMP[id]||{mp:0,top:0,imp:0};
    return{id,name:pairs[id].name||id,pct:d.top>0?(d.mp/d.top*100):0,imp:d.imp||0};
  }).sort((a,b)=>scoringShows().byImp?b.imp-a.imp:b.pct-a.pct);
  const sh=scoringShows();
  const rowsHTML=rows.map((r,i)=>`
    <div style="display:flex;justify-content:space-between;padding:7px 10px;border-bottom:1px solid var(--border);font-size:0.8rem;${i===0?'background:var(--golddim);':''}">
      <span>${i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.'} ${r.name}</span>
      <span style="font-weight:700;color:var(--gold);">${sh.mp?r.pct.toFixed(1)+'%':''}${sh.mp&&sh.imp?' · ':''}${sh.imp?fmtImp(r.imp)+' IMP':''}</span>
    </div>`).join('');
  document.getElementById('panelContent').innerHTML=`
    <div class="bm-device" style="max-width:400px;">
      <div class="round-over-screen">
        <div class="ro-badge">🏁</div>
        <div class="ro-title">${s.name||'Tournament'} — Final Results</div>
        <div class="ro-sub">Table ${tableNo}</div>
      </div>
      <div style="max-height:340px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);margin:14px 0;">
        ${rowsHTML||'<div style="padding:14px;text-align:center;color:var(--text3);font-size:0.8rem;">No results yet</div>'}
      </div>
      <button class="btn btn-gold btn-full" onclick="performLogout()">← Log Out</button>
    </div>`;
};
window.performLogout=async function(){
  document.body.classList.remove('bg-device');
  if(role==='table'){ try{ await unlockAllMyTables(); }catch(e){} }
  if(role==='admin'){
    const st=getState();
    if(st&&st.status==='running'){
      const wantsExport=await confirmDialog(
        'You are about to leave the Admin screen while the tournament is still running.',
        {title:'Export backup first?', confirmLabel:'Export Backup', cancelLabel:'Just Log Out', danger:false});
      if(wantsExport)adminExport();
    }
  }
  finishLogoutUI();
};
function finishLogoutUI(){
  setTimeout(endSession, 1500);   // this device may no longer change anything (after the last writes have gone out)
  document.getElementById('app').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('topbarRound').style.display='none';
  if(role==='superadmin'){
    // Super Admin logs back out to the club gate (or straight to login form if a club is already resolved)
    if(CLUB_ID){
      document.getElementById('clubGate').style.display='none';
      document.getElementById('loginForm').style.display='block';
      { const cl=document.getElementById('clubLinks'); if(cl) cl.style.display='flex'; }
      document.getElementById('backToClubGate').style.display='none';
      document.getElementById('loginSub').textContent=CLUB_NAME||'Tournament Control System';
    } else {
      document.getElementById('loginForm').style.display='none';
      { const cl=document.getElementById('clubLinks'); if(cl) cl.style.display='flex'; }
      document.getElementById('backToClubGate').style.display='none';
      document.getElementById('loginSub').textContent='Tournament Control System';
      document.getElementById('clubGate').style.display='block';
    }
  }
  selRole('admin');
  if(bmPollInterval){clearInterval(bmPollInterval);bmPollInterval=null;}
}
function refreshTopbar(){
  const s=getState();const el=document.getElementById('topbarRound');
  if(s.currentRound>0){
    el.style.display='inline-flex';
    el.textContent='Round '+s.currentRound+'/'+s.roundCount+(s.name?' · '+s.name:'');
  } else el.style.display='none';
  // a table's device bar: the club and the tournament, the table and the round
  const bar=document.getElementById('bmDevBar');
  if(bar) bar.innerHTML=`<span class="td">🏛</span><div class="ev"><b>${cleanData(CLUB_NAME||'')}${s.name?' · '+cleanData(s.name):''}</b>${bmTableNo?'Table '+bmTableNo:''}${bmTableNo&&s.currentRound?' – ':''}${s.currentRound?'Round '+s.currentRound:''}</div>`;
}

// ══════════════════════════════════════════════════════
//  TOAST & MODAL
// ══════════════════════════════════════════════════════
function toast(msg,dur=2500){
  const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),dur);
}
function openModal(title,body,actions=''){
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=body;
  document.getElementById('modalActions').innerHTML=actions;
  document.getElementById('modalBg').classList.add('open');
}
window.closeModal=function(){document.getElementById('modalBg').classList.remove('open');};

// In-page replacement for native confirm() — returns a Promise<boolean>,
// styled consistently with the rest of the app instead of a browser popup.
function confirmDialog(message, opts={}){
  return new Promise(resolve=>{
    const danger=opts.danger!==false;
    const confirmLabel=opts.confirmLabel||'Confirm';
    const cancelLabel=opts.cancelLabel||'Cancel';
    const safeMsg=String(message).replace(/\n/g,'<br>');
    openModal(opts.title||'Please Confirm',
      `<div style="font-size:0.85rem;color:var(--text2);line-height:1.5;">${safeMsg}</div>`,
      `<button class="btn btn-ghost" onclick="__confirmDialogResolve(false)">${cancelLabel}</button>
       <button class="btn ${danger?'btn-red':'btn-gold'}" onclick="__confirmDialogResolve(true)">${confirmLabel}</button>`);
    window.__confirmDialogResolve=(val)=>{ closeModal(); resolve(val); delete window.__confirmDialogResolve; };
  });
}

// ══════════════════════════════════════════════════════
//  PANEL ROUTER
// ══════════════════════════════════════════════════════
window.renderPanel=function(){
  const c=document.getElementById('panelContent');
  c.innerHTML='';c.className='panel-anim';void c.offsetWidth;
  if(role==='superadmin')renderSuperAdminPanel();
  else if(role==='table')renderTablePanel();
  else if(role==='screen')renderScreenPanel();
  else renderAdminPanel();
};

// ══════════════════════════════════════════════════════
