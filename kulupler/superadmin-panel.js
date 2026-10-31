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

  const rows = clubs.length
    ? clubs.map((cl,i)=>`
      <div class="card" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;font-size:0.95rem;">${cl.name}${cl.active?'':' <span style="color:var(--red);font-size:0.7rem;">(inactive)</span>'}</div>
            <div style="font-size:0.72rem;color:var(--text3);margin-top:2px;">👤 ${cl.owner||'—'} · ID: ${cl.id}${cl.created?' · Created: '+new Date(cl.created).toLocaleDateString():''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <a class="btn btn-ghost btn-sm" href="?club=${encodeURIComponent(cl.id)}" target="_blank" rel="noopener">Open</a>
            <button class="btn ${cl.active?'btn-ghost':'btn-green'} btn-sm" onclick="saToggleActive(${i})">${cl.active?'Deactivate':'Activate'}</button>
            <button class="btn btn-red btn-sm" onclick="saDeletePrompt(${i})">Delete</button>
          </div>
        </div>
      </div>`).join('')
    : '<div class="card" style="text-align:center;color:var(--text2);">No clubs yet. A player opens a club from the club page.</div>';

  c.innerHTML = `
    <div class="card" style="margin-bottom:14px;">
      <div class="card-title"><span>👥</span> Member list</div>
      <div style="font-size:0.8rem;color:var(--text2);margin-bottom:8px;">The federation's player file (Magic Contest .mcd, from Ruter): only the member number, first name and last name are kept. At the tables a player types their number and their name comes from here.</div>
      <div id="saMembersInfo" style="font-size:0.78rem;color:var(--text3);margin-bottom:8px;">…</div>
      <label class="btn btn-gold btn-full" style="text-align:center;">📥 Load member list (.mcd)<input type="file" accept=".mcd,.txt" style="display:none" onchange="saLoadMembers(this.files[0]);this.value=''"></label>
    </div>
    <div class="card-title">🛡️ Super Admin — Clubs (${clubs.length})</div>
    ${rows}`;
  saShowMembersInfo();
}
// how many members the list holds, and when it was loaded
async function saShowMembersInfo(){
  const el=document.getElementById('saMembersInfo'); if(!el) return;
  try{ const r=await fetch(await fbRootUrl('/membersInfo.json')); const v=r.ok?await r.json():null;
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
window.saLoadMembers=async function(file){
  if(!file) return;
  const text=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsText(file,'ISO-8859-1'); });
  if(!/Magic Contest|MCPlayer/.test(text.slice(0,200))){ toast('❌ Format not recognised'); return; }
  const list=parseMcd(text), n=Object.keys(list).length;
  if(!n){ toast('❌ File is empty'); return; }
  const el=document.getElementById('saMembersInfo'); if(el) el.textContent=`⏳ ${n} members…`;
  try{
    const r=await fetch(await fbRootUrl('/members.json'),{method:'PUT',body:JSON.stringify(list)});
    if(!r.ok) throw new Error('HTTP '+r.status);
    await fetch(await fbRootUrl('/membersInfo.json'),{method:'PUT',body:JSON.stringify({n,ts:Date.now()})});
    toast(`✅ ${n} members loaded`);
  }catch(e){ toast('❌ Firebase error: '+e.message); }
  saShowMembersInfo();
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
