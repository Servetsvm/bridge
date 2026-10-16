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
    <div class="card-title">🛡️ Super Admin — Clubs (${clubs.length})</div>
    ${rows}`;
}

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
