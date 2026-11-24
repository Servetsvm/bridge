// ══════════════════════════════════════════════════════
//  SUPER ADMIN PANEL — every club (players open their own clubs; here they are switched off or deleted)
// ══════════════════════════════════════════════════════
let SA_CLUBS=[];
async function renderSuperAdminPanel(){
  const c=document.getElementById('panelContent');
  c.className='panel-anim';
  c.innerHTML='<div class="card" style="text-align:center;color:var(--text2);">Loading clubs…</div>';
  let clubs=[];
  try{ clubs=await saListClubs(); }
  catch(e){ c.innerHTML='<div class="card" style="color:var(--red);">Failed to load clubs.</div>'; return; }
  SA_CLUBS=clubs;
  // the list every player sees in Clubs: every club, as it is now
  try{
    const L=Object.fromEntries(clubs.map(c=>[c.id,{n:String(c.name).slice(0,40),a:c.active}]));
    const u=await fbRootUrl('/clubList.json'), r=await fetch(u+(u.includes('?')?'&':'?')+'shallow=true'); const old=r.ok?await r.json():null;
    for(const id of Object.keys(old||{})) if(!(id in L)) L[id]=null;   // a club gone
    // the running tournaments' entries of clubs that are gone
    const lu=await fbRootUrl('/live.json'), lr=await fetch(lu+(lu.includes('?')?'&':'?')+'shallow=true'); const lv=lr.ok?await lr.json():null;
    for(const id of Object.keys(lv||{})) if(!(id in L)||L[id]===null) try{ await fetch(await fbRootUrl('/live/'+id+'.json'),{method:'DELETE'}); }catch(e){}
    if(Object.keys(L).length) await fetch(await fbRootUrl('/clubList.json'),{method:'PATCH',body:JSON.stringify(L)});   // club by club (the rules allow each club's entry)
  }catch(e){}

  const rows = clubs.length
    ? clubs.map((cl,i)=>`
      <div class="card" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;font-size:0.95rem;">${cl.name}${cl.active?'':' <span style="color:var(--red);font-size:0.7rem;">(inactive)</span>'}</div>
            <div style="font-size:0.72rem;color:var(--text3);margin-top:2px;">${cl.fed==='tbf'?'🇹🇷 TBF':'🇳🇴 NBF'} · 👤 ${cl.owner||'—'} · ID: ${cl.id}${cl.created?' · Created: '+new Date(cl.created).toLocaleDateString():''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" onclick="saNamePrompt(${i})">✏️ Name</button>
            <button class="btn btn-gold btn-sm" onclick="saPwPrompt(${i})">🔑 Password</button>
            <a class="btn btn-ghost btn-sm" href="?club=${encodeURIComponent(cl.id)}" target="_blank" rel="noopener">Open</a>
            <button class="btn ${cl.active?'btn-ghost':'btn-green'} btn-sm" onclick="saToggleActive(${i})">${cl.active?'Deactivate':'Activate'}</button>
            <button class="btn btn-red btn-sm" onclick="saDeletePrompt(${i})">Delete</button>
          </div>
        </div>
      </div>`).join('')
    : '<div class="card" style="text-align:center;color:var(--text2);">No clubs yet.</div>';

  c.innerHTML = `
    <div class="card" style="margin-bottom:14px;">
      <div class="card-title"><span>👥</span> Member lists</div>
      <div style="font-size:0.8rem;color:var(--text2);margin-bottom:8px;">The federations' player files (Magic Contest .mcd): only the member number, first name and last name are kept. At a club's tables a player types their number and their name comes from its federation's list; a number not in it is kept with the name the player types.</div>
      ${['nbf','tbf'].map(f=>`<div style="margin-top:10px;"><b>${f==='nbf'?'🇳🇴 NBF (Norway)':'🇹🇷 TBF (Turkey)'}</b><div id="saMembersInfo-${f}" style="font-size:0.78rem;color:var(--text3);margin:4px 0 6px;">…</div>
      <label class="btn btn-gold btn-full" style="text-align:center;">📥 Load member list (.mcd)<input type="file" accept=".mcd,.txt" style="display:none" onchange="saLoadMembers(this.files[0],'${f}');this.value=''"></label></div>`).join('')}
    </div>
    <div class="card" style="margin-bottom:14px;">
      <div class="card-title"><span>🔑</span> Super admin password</div>
      <button class="btn btn-ghost btn-full" onclick="saSuperPwPrompt()">🔑 Change the super admin password</button>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <div class="card-title"><span>➕</span> New club</div>
      <div style="font-size:0.8rem;color:var(--text2);margin-bottom:8px;">Only you open clubs. The club gets a password: give it with the club ID to the club's admin.</div>
      <div class="pw-wrap"><input type="text" id="saNewClubName" maxlength="40" placeholder="Club name" onkeydown="if(event.key==='Enter')saNewClub()"></div>
      <div class="pw-wrap"><select id="saNewClubFed" style="width:100%;padding:10px;border-radius:8px;background:var(--surface2);color:var(--text);border:1px solid var(--border);"><option value="nbf">🇳🇴 NBF (Norway)</option><option value="tbf">🇹🇷 TBF (Turkey)</option></select></div>
      <div class="login-err" id="saClubErr"></div>
      <button class="btn btn-gold btn-full" onclick="saNewClub()">➕ Create club</button>
    </div>
    <div class="card-title">🛡️ Super Admin — Clubs (${clubs.length})</div>
    ${rows}`;
  saShowMembersInfo('nbf'); saShowMembersInfo('tbf');
  saFillRequest();
}
const saL=v=>window.i18nText?i18nText(v):v;
// a player's club request (BridgePlay's messages → Open the club): the new club's name and federation filled in, and
// whose request it is; once the club is opened its ID and password go to that player's messages
const SA_REQ=(()=>{ const q=new URLSearchParams(location.search), n=(q.get('nc')||'').trim().slice(0,40);
  return n?{n,f:q.get('nf')==='tbf'?'tbf':'nbf',k:(q.get('for')||'').replace(/[.#$\[\]\/]/g,''),pn:(q.get('forn')||'').slice(0,20),done:false}:null; })();
function saFillRequest(){
  if(!SA_REQ||SA_REQ.done) return;
  const n=document.getElementById('saNewClubName'), f=document.getElementById('saNewClubFed'); if(!n) return;
  const card=n.closest('.card');
  if(card&&!card.querySelector('.sa-req')){ const d=document.createElement('div'); d.className='sa-req'; d.style.cssText='font-size:0.85rem;background:var(--surface2);border:1px solid var(--gold);border-radius:8px;padding:8px;margin-bottom:8px;';
    d.innerHTML=`🏛️ <b>${cleanData(SA_REQ.pn||SA_REQ.k)}</b> — ${saL('Club request')}: <b>${cleanData(SA_REQ.n)}</b><br><span style="color:var(--text2)">${saL('Fill in the new club from it, then create the club: its ID and password go to the player\'s messages.')}</span><br><button class="btn btn-gold btn-sm" style="margin-top:6px;" onclick="saUseRequest()">✏️ ${saL('Fill in from the request')}</button>`;
    card.insertBefore(d,card.querySelector('.pw-wrap')); card.scrollIntoView({block:'center'}); }
}
// the request into the new club's fields (only on the super admin's tap): then the club created goes to that player
window.saUseRequest=function(){
  if(!SA_REQ) return; const n=document.getElementById('saNewClubName'), f=document.getElementById('saNewClubFed');
  if(n) n.value=SA_REQ.n; if(f) f.value=SA_REQ.f; SA_REQ.used=true; n?.focus();
};
// the new club's ID and password, to the player who asked for it (a message from the administrator in BridgePlay)
async function saSendClubToPlayer(c){
  if(!SA_REQ||!SA_REQ.k||!c) return false;
  const root=FB_BASE.replace(/\/gate$/,''), token=await authToken(), q=token?'?auth='+token:'', now=Date.now();
  const id=now.toString(36)+Math.random().toString(36).slice(2,6);
  const t=`Your club is open: ${c.name}.\nClub ID: ${c.id}\nClub password: ${c.pw}`;
  const r=await fetch(root+'/destek/'+SA_REQ.k+'/m/'+id+'.json'+q,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({by:'a',t,kd:{n:c.name,id:c.id,pw:c.pw},ts:now})});
  if(!r.ok) throw new Error('HTTP '+r.status);
  try{ await fetch(root+'/destek/'+SA_REQ.k+'/ar.json'+q,{method:'PUT',body:JSON.stringify(now)}); }catch(e){}
  // the player's phone, even with BridgePlay closed (the robots' Worker; the review key kept on this device)
  try{ const t=await authToken(), base=(localStorage.getItem('bridge-bot-ai')||'https://bridge-bots.bridgeplay.workers.dev/').replace(/\/$/,'');
    if(t) fetch(base+'/push/send',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Firebase '+t},body:JSON.stringify({to:SA_REQ.k,kind:'clubopen',n:String(c.name).slice(0,40)})}).catch(()=>{}); }catch(e){}
  SA_REQ.done=true; return true;
}
// how many members the list holds, and when it was loaded
async function saShowMembersInfo(fed){
  const el=document.getElementById('saMembersInfo-'+fed); if(!el) return;
  try{ const r=await fetch(await fbRootUrl(fed==='tbf'?'/membersInfoTbf.json':'/membersInfo.json')); const v=r.ok?await r.json():null;
    el.textContent=v&&v.n?`${v.n} members · ${new Date(v.ts).toLocaleDateString(window.getLanguage?.()||'en')}`:'No member list yet';
  }catch(e){ el.textContent=''; }
}
/* the Magic Contest player file: one field per line, a two-digit code first; a player starts with 00 (member number),
   02 is the last name and 03 the first name. Nothing else (address, e-mail, birth date) is read or sent. */
function parseMcd(text){
  const out={}; let num=null,last='',first='';
  const flush=()=>{ if(num&&(first||last)) out[num]=(first+' '+last).trim().slice(0,60); };
  for(const line of text.split(/\r?\n/)){
    const code=line.slice(0,2), v=line.slice(2).trim();
    if(code==='00'){ flush(); num=/^\d{1,8}$/.test(v)?v:null; last=''; first=''; }
    else if(code==='02') last=v; else if(code==='03') first=v;
  }
  flush();
  return out;
}
window.saLoadMembers=async function(file,fed){
  if(!file) return; fed=fed==='tbf'?'tbf':'nbf';
  // the Norwegian file is Latin-1, the Turkish one Windows-1254 (ş ğ ı İ)
  const text=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsText(file,fed==='tbf'?'windows-1254':'ISO-8859-1'); });
  if(!/Magic Contest|MCPlayer/.test(text.slice(0,200))){ toast('❌ Format not recognised'); return; }
  const list=parseMcd(text), n=Object.keys(list).length;
  if(!n){ toast('❌ File is empty'); return; }
  const el=document.getElementById('saMembersInfo-'+fed); if(el) el.textContent=`⏳ ${n} members…`;
  try{
    const r=await fetch(await fbRootUrl(fed==='tbf'?'/membersTbf.json':'/members.json'),{method:'PUT',body:JSON.stringify(list)});
    if(!r.ok) throw new Error('HTTP '+r.status);
    await fetch(await fbRootUrl(fed==='tbf'?'/membersInfoTbf.json':'/membersInfo.json'),{method:'PUT',body:JSON.stringify({n,ts:Date.now()})});
    toast(`✅ ${n} members loaded`);
  }catch(e){ toast('❌ Firebase error: '+e.message); }
  saShowMembersInfo(fed);
};
// the super admin password: a new one, at least 6 characters, typed twice
window.saSuperPwPrompt=function(){
  openModal('Super admin password',`<div class="pw-wrap"><input type="password" id="saSp1" maxlength="40" placeholder="New password (at least 6)" autocomplete="new-password"></div><div class="pw-wrap"><input type="password" id="saSp2" maxlength="40" placeholder="The new password again" autocomplete="new-password"></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-gold" onclick="saSuperPwSave()">Save</button>`);
};
window.saSuperPwSave=async function(){
  const a=document.getElementById('saSp1')?.value||'', b=document.getElementById('saSp2')?.value||'';
  if(a.length<6){ toast('❌ At least 6 characters'); return; }
  if(a!==b){ toast('❌ The two passwords are not the same'); return; }
  try{ await setSuperPw(a); closeModal(); toast('🔑 Password saved'); }catch(e){ toast('❌ Failed: '+e.message); }
};

window.saNewClub=async function(){
  const c=await createMyClub(true); if(document.getElementById('saClubErr')?.textContent) return;
  // a player's request: the ID and password to their messages (the "Club created" window stays open over the panel)
  if(c&&SA_REQ&&SA_REQ.used&&!SA_REQ.done){ try{ await saSendClubToPlayer(c); toast('📨 '+saL('Sent to the player')); }catch(e){ toast('❌ '+saL('Not sent to the player')+': '+e.message); } }
  renderSuperAdminPanel();
};
// a club's password: shown, and changed (a new one, or one typed)
window.saPwPrompt=async function(i){
  const cl=SA_CLUBS[i]; if(!cl) return;
  let cur=null; try{ const r=await fetch(await fbRootUrl('/clubs/'+cl.id+'/secret/pw.json'),{cache:'no-store'}); cur=r.ok?await r.json():null; }catch(e){}
  openModal('Club password', `<div style="font-size:0.85rem;color:var(--text2);margin-bottom:6px;">${cl.name} · ID: <b>${cl.id}</b></div>
    <div style="font-size:0.85rem;color:var(--text2);">Password now:</div><div style="font-size:1.3rem;font-weight:800;letter-spacing:2px;margin:6px 0 12px;" data-i18n-ignore>${cur?cleanData(cur):'—'}</div>
    <div class="pw-wrap"><input type="text" id="saNewPw" inputmode="numeric" maxlength="12" placeholder="New password (4–12 digits)" autocomplete="off"></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-blue" onclick="document.getElementById('saNewPw').value=newClubPw()">🎲 New</button><button class="btn btn-gold" onclick="saPwSave(${i})">Save</button>`);
};
window.saPwSave=async function(i){
  const cl=SA_CLUBS[i]; const pw=(document.getElementById('saNewPw')?.value||'').trim(); if(!cl) return;
  if(!/^\d{4,12}$/.test(pw)){ toast('❌ 4–12 digits'); return; }
  try{ const r=await fetch(await fbRootUrl('/clubs/'+cl.id+'/secret/pw.json'),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(pw)}); if(!r.ok) throw new Error('HTTP '+r.status); closeModal(); toast('🔑 Password saved'); }
  catch(e){ toast('❌ Failed: '+e.message); }
};
// a club's name: changed everywhere it is kept (the club's info, the players' Clubs list, its owner's list and a running
// tournament's entry); the club's ID and its link stay the same
window.saNamePrompt=function(i){
  const cl=SA_CLUBS[i]; if(!cl) return;
  openModal('Club name', `<div style="font-size:0.85rem;color:var(--text2);margin-bottom:6px;">ID: <b>${cl.id}</b></div>
    <div class="pw-wrap"><input type="text" id="saNewName" maxlength="40" placeholder="Club name" autocomplete="off" onkeydown="if(event.key==='Enter')saNameSave(${i})"></div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-gold" onclick="saNameSave(${i})">Save</button>`);
  const inp=document.getElementById('saNewName'); if(inp){ inp.value=cl.name; setTimeout(()=>{ inp.focus(); inp.select(); },50); }
};
window.saNameSave=async function(i){
  const cl=SA_CLUBS[i]; if(!cl) return;
  const name=(document.getElementById('saNewName')?.value||'').trim().slice(0,40);
  if(!name){ toast('❌ Enter the club name'); return; }
  if(name===cl.name){ closeModal(); return; }
  try{
    await saRenameClub(cl.id, name, cl.ownerKey);
    closeModal(); toast('✏️ Name saved');
    renderSuperAdminPanel();
  }catch(e){ toast('❌ Failed: '+e.message); }
};
window.saToggleActive=async function(i){
  const cl=SA_CLUBS[i]; if(!cl) return;
  try{
    await saSetClubActive(cl.id,!cl.active);
    toast(cl.active?'⏸ Club deactivated':'▶ Club activated');
    renderSuperAdminPanel();
  }catch(e){ toast('❌ Failed: '+e.message); }
};

window.saDeletePrompt=function(i){
  const cl=SA_CLUBS[i]; if(!cl) return;
  openModal('Delete Club', `
    <div style="font-size:0.85rem;color:var(--red);margin-bottom:6px;">
      This permanently deletes <b>${cl.name}</b> and all of its tournament data. This cannot be undone.
    </div>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-red" onclick="saDeleteSubmit(${i})">Delete Permanently</button>
  `);
};
window.saDeleteSubmit=async function(i){
  const cl=SA_CLUBS[i]; if(!cl) return;
  try{
    await saDeleteClub(cl.id, cl.ownerKey);
    closeModal();
    toast('🗑 Club deleted');
    renderSuperAdminPanel();
  }catch(e){ toast('❌ Failed: '+e.message); }
};
