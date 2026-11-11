// ══════════════════════════════════════════════════════
//  THE RESULTS PAGE — at the end of a tournament
// ══════════════════════════════════════════════════════
// One page with everything: the ranking (place, pair, names, points, %), then each board with its four hands, the
// double-dummy table and par, and every table's result on it (pairs, round, contract, declarer, tricks, lead, score,
// match points). Shown in the program and saved as one HTML file that can be shared or printed.
(function(){
'use strict';
const SYM=['♣','♦','♥','♠'], RK='23456789TJQKA';
const esc=s=>String(s==null?'':s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const red=s=>/[♥♦]/.test(s);
const suitHtml=t=>esc(t).replace(/([♥♦])/g,'<span class="r">$1</span>');
const pairNo=id=>String(id||'').replace(/^ns_/,'NS ').replace(/^ew_/,'EW ').replace(/^p/,'');
const fmt=(n,d=2)=>(typeof n==='number'&&isFinite(n)?n.toFixed(d):'—');

// a PBN deal → four hands (N E S W) of card numbers
function cards(deal){
  const m=String(deal||'').trim().match(/^([NESW]):(.*)$/i); if(!m) return null;
  const first='NESW'.indexOf(m[1].toUpperCase()), parts=m[2].trim().split(/\s+/); if(parts.length!==4) return null;
  const h=[[],[],[],[]];
  parts.forEach((p,i)=>p.split('.').forEach((rs,k)=>{ for(const ch of rs.toUpperCase()){ const r=RK.indexOf(ch); if(r>=0) h[(first+i)%4].push((3-k)*13+r); } }));
  return h;
}
function handHtml(h){ return [3,2,1,0].map(s=>{ const rs=h.filter(c=>((c/13)|0)===s).sort((a,b)=>b-a).map(c=>RK[c%13]==='T'?'10':RK[c%13]); return `<div><span class="${s===1||s===2?'r':''}">${SYM[s]}</span> ${rs.length?rs.join(' '):'—'}</div>`; }).join(''); }
function diagram(hd,board){
  const h=cards(hd.deal); if(!h) return '';
  const v=String(hd.vulnerable||'').toLowerCase(), dl='NESW'.indexOf(String(hd.dealer||'').toUpperCase()[0]);
  const vul=s=>v==='all'||v==='both'||(v==='ns'&&s%2===0)||(v==='ew'&&s%2===1);
  const comp=`<div class="cp">${['N','E','S','W'].map((L,s)=>`<span class="c${s}${vul(s)?' v':''}${s===dl?' d':''}">${L}</span>`).join('')}<b>${esc(board)}</b></div>`;
  return `<div class="dg"><div class="h n">${handHtml(h[0])}</div><div class="h w">${handHtml(h[3])}</div>${comp}<div class="h e">${handHtml(h[1])}</div><div class="h s">${handHtml(h[2])}</div></div>`;
}
function ddHtml(a){
  if(!a||!a.t) return '';
  const row=(d,L)=>`<tr><th>${L}</th>${[3,2,1,0,4].map(st=>{ const n=a.t[d][st]; return `<td>${n==null?'':n}</td>`; }).join('')}</tr>`;
  return `<div class="par">Par: <b>${suitHtml(a.par&&a.par.text||'')}</b></div><table class="dd"><tr><th></th><th>♠</th><th class="r">♥</th><th class="r">♦</th><th>♣</th><th>NT</th></tr>${row(0,'N')}${row(2,'S')}${row(1,'E')}${row(3,'W')}</table>`;
}

// everything the page shows, from the tournament as it stands
function collect(){
  const s=getState(), pairs=getPairs(), boards=getBoards(), mv=getMovements(), mp=calcMP(), sh=scoringShows();
  const hands=(typeof ccHandsList==='function'?ccHandsList():(_cache['hands']||[])), dd=_cache['dd']||{};
  const ranking=Object.keys(pairs).filter(id=>!pairs[id].isPhantom).map(id=>{ const d=mp[id]||{mp:0,top:0,imp:0,boards:0}; return {id,no:pairNo(id),name:pairs[id].name||id,mp:d.mp,top:d.top,pct:d.top>0?d.mp/d.top*100:0,imp:d.imp||0,boards:d.boards}; })
    .sort((a,b)=>sh.byImp?b.imp-a.imp:(b.pct-a.pct||b.mp-a.mp));
  // each board: its results, each with the match points of both sides on that board
  const by={};
  for(const [k,b] of Object.entries(boards)){ if(!b||b.status!=='done') continue; const [t,r,bn]=k.split('_'); const m=mv[r+'_'+t]||{}; (by[bn]=by[bn]||[]).push({t:+t,r:+r,ns:m.ns,ew:m.ew,b}); }
  for(const L of Object.values(by)){
    const sc=L.filter(x=>typeof x.b.nsScore==='number'), top=Math.max(0,(sc.length-1)*2);
    for(const x of L){
      if(typeof x.b.nsScore!=='number'){ x.nsMP=x.ewMP=null; continue; }
      let m=0,imp=0; for(const y of sc){ if(y===x) continue; m+=x.b.nsScore>y.b.nsScore?2:x.b.nsScore===y.b.nsScore?1:0; imp+=scoreToIMP(x.b.nsScore-y.b.nsScore); }
      x.nsMP=sc.length>1?m:null; x.ewMP=sc.length>1?top-m:null; x.imp=sc.length>1?imp/(sc.length-1):null; x.top=top;
    }
    L.sort((p,q)=>(q.b.nsScore||0)-(p.b.nsScore||0));
  }
  const nums=[...new Set(Object.keys(by).concat(hands.map(h=>String(h.board))))].sort((a,b)=>(+a||0)-(+b||0));
  const rounds=s.roundCount||Math.max(0,...Object.values(by).flat().map(x=>x.r));
  return {s,sh,ranking,by,nums,hands,dd,rounds};
}

const CSS=`.ccr{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d2733;background:#fff;max-width:1100px;margin:0 auto;padding:14px 14px 40px}
.ccr h1{color:#1f4e79;font-size:1.6rem;margin:4px 0 8px}.ccr h2{color:#1f4e79;font-size:1.25rem;margin:22px 0 8px}
.ccr .meta div{margin:3px 0}.ccr .r{color:#d32f2f}
.ccr table{border-collapse:collapse;width:100%}
.ccr .rank th,.ccr .res th,.ccr .dd th{background:#24476b;color:#fff;padding:7px 6px;font-weight:700}
.ccr .rank td,.ccr .res td{padding:7px 6px;border-bottom:1px solid #e3e7ec;text-align:center}
.ccr .rank td.nm{text-align:left}.ccr .rank tr:nth-child(even) td,.ccr .res tr:nth-child(even) td{background:#f4f6f8}
.ccr .rank td.n{text-align:right;font-variant-numeric:tabular-nums}
.ccr .rank tr.pr{cursor:pointer}.ccr .rank tr.pr:hover td{background:#e6eef7}.ccr .rank tr.pr.open td{background:#dbe7f3;font-weight:700}
.ccr .rank tr.pd>td{padding:4px 0 10px;background:#fff!important;text-align:left}.ccr .pb{margin:4px 0 0;font-size:.88rem}.ccr .pb th{background:#cfe0f3!important;color:#1f3550!important}.ccr .rank tr.pd>td{max-width:0}.ccr .pbw{overflow-x:auto;width:100%}.ccr .pb a{color:#1f4e79;font-weight:700}.ccr .pb td.sp{background:#f7fafd}.ccr .pb tr.tot td{font-weight:800;border-top:2px solid #24476b;background:#fff}
.ccr .nav{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.ccr .nav a{color:#1f4e79;font-weight:700;text-decoration:none;padding:3px 8px;border:1px solid #c9d3de;border-radius:6px}
.ccr .bd{border:1px solid #dfe5ec;border-radius:10px;padding:12px;margin:14px 0;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.ccr .bd h3{margin:0 0 8px;color:#1f4e79}
.ccr .top{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
.ccr .dg{display:grid;grid-template-columns:auto auto auto;grid-template-areas:". n ." "w c e" ". s .";gap:6px 10px;align-items:center;justify-items:start;font-size:1rem}
.ccr .dg .n{grid-area:n}.ccr .dg .s{grid-area:s}.ccr .dg .w{grid-area:w}.ccr .dg .e{grid-area:e}.ccr .dg .h div{white-space:nowrap;line-height:1.35}
.ccr .cp{grid-area:c;position:relative;width:96px;height:96px;border:2px solid #555;background:#e9ecef;justify-self:center}
.ccr .cp b{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:30px;height:30px;line-height:30px;text-align:center;border-radius:50%;background:#fff;border:2px solid #555}
.ccr .cp span{position:absolute;width:24px;height:24px;line-height:24px;text-align:center;font-weight:800;color:#fff;background:#2e7d32;border-radius:5px}
.ccr .cp span.v{background:#d32f2f}.ccr .cp span.d{outline:3px solid #111;outline-offset:1px}
.ccr .cp .c0{top:3px;left:50%;transform:translateX(-50%)}.ccr .cp .c2{bottom:3px;left:50%;transform:translateX(-50%)}.ccr .cp .c3{left:3px;top:50%;transform:translateY(-50%)}.ccr .cp .c1{right:3px;top:50%;transform:translateY(-50%)}
.ccr .ddbox{min-width:240px}.ccr .par{margin:0 0 6px}.ccr .dd{width:auto}.ccr .dd td{padding:6px 10px;text-align:center;border:1px solid #e3e7ec}.ccr .dd th.r{color:#ff8a80}
.ccr .res{margin-top:10px;font-size:.92rem}.ccr .res td.c{white-space:nowrap}
.ccr .bar{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
@media print{.ccr .bar,.ccr .nav{display:none}.ccr .bd{break-inside:avoid}}
@media (max-width:640px){.ccr{padding:10px 6px 30px}.ccr .res{font-size:.78rem}.ccr .res td,.ccr .res th{padding:5px 3px}.ccr .rank td,.ccr .rank th{padding:6px 3px;font-size:.85rem}.ccr .dg{font-size:.9rem}}`;

function pageHtml(withBar){
  const L=v=>window.i18nText?i18nText(v):v;
  const {s,sh,ranking,by,nums,hands,dd,rounds}=collect();
  const date=(s._finishedAt||s._startedAt||new Date().toISOString()).slice(0,10);
  // a pair tapped in the ranking: its boards, each with the opponents, the round, the contract, the lead, its score and points
  const cols=3+(sh.mp?2:0)+(sh.imp?1:0);
  // the points also by who played the hand: as declarer, and in defence by who led (the declarer's left-hand opponent),
  // each under the player's name (North or East first, as the pair's name is written)
  const pairBoards=(id,name)=>{
    const rows=[], who=String(name||'').split(/\s+-\s+/).map(n=>n.trim().split(/\s+/)[0]||'?'); while(who.length<2) who.push('?');
    for(const [bn,L2] of Object.entries(by)) for(const x of L2){
      if(x.ns!==id&&x.ew!==id) continue;
      const me=x.ns===id, b=x.b, pass=!b.level, ns=typeof b.nsScore==='number'?b.nsScore:null;
      rows.push({bn:+bn||bn,r:x.r,opp:pairNo(me?x.ew:x.ns),con:pass?'PASS':`${b.level}${b.suit||''}${b.doubled||''} ${b.declarer||''}`,tr:pass?'—':b.level+6+(+b.result||0),lead:b.lead||'',sc:ns==null?null:(me?ns:-ns),mp:me?x.nsMP:x.ewMP,imp:x.imp==null?null:(me?x.imp:-x.imp)});
      const R=rows[rows.length-1], d='NESW'.indexOf(b.declarer||''); R.pts=sh.byImp?R.imp:R.mp; R.dc=null; R.df=null;
      if(!pass&&d>=0){ const ours=me?d%2===0:d%2===1; if(ours) R.dc=d<2?0:1; else { const ld=(d+1)%4; R.df=ld<2?0:1; } }
    }
    rows.sort((a,b)=>a.r-b.r||a.bn-b.bn);
    if(!rows.length) return `<div style="padding:8px">—</div>`;
    const pv=v=>v==null?'':(sh.byImp?fmt(v):v), cell=(x,k,i)=>`<td class="sp">${x[k]===i?pv(x.pts):''}</td>`;
    return `<div class="pbw"><table class="res pb"><tr><th rowspan="2">${L('Board')}</th><th rowspan="2">${L('Opponents')}</th><th rowspan="2">${L('Round')}</th><th rowspan="2">${L('Contract')}</th><th rowspan="2">${L('Tricks')}</th><th rowspan="2">${L('Lead')}</th><th rowspan="2">${L('Score')}</th>${sh.mp?'<th rowspan="2">MP</th>':''}${sh.imp?'<th rowspan="2">IMP</th>':''}<th colspan="2">${L('Declarer')}</th><th colspan="2">${L('Defence')}</th></tr><tr><th>${esc(who[0])}</th><th>${esc(who[1])}</th><th>${esc(who[0])}</th><th>${esc(who[1])}</th></tr>${rows.map(x=>`<tr><td><a href="#b${esc(x.bn)}" onclick="var e=document.getElementById('b${esc(x.bn)}');if(e){e.scrollIntoView();return false;}">${esc(x.bn)}</a></td><td>${esc(x.opp)}</td><td>${x.r}</td><td class="c">${suitHtml(x.con)}</td><td>${x.tr}</td><td class="c">${suitHtml(x.lead)}</td><td>${x.sc==null?'':x.sc}</td>${sh.mp?`<td>${x.mp==null?'':x.mp}</td>`:''}${sh.imp?`<td>${x.imp==null?'':fmt(x.imp)}</td>`:''}${cell(x,'dc',0)}${cell(x,'dc',1)}${cell(x,'df',0)}${cell(x,'df',1)}</tr>`).join('')}${(()=>{ const sum=(k,i)=>{ const v=rows.filter(x=>x[k]===i&&x.pts!=null).reduce((a,x)=>a+x.pts,0); return sh.byImp?fmt(v):v; }; return `<tr class="tot"><td colspan="${7+(sh.mp?1:0)+(sh.imp?1:0)}"></td><td class="sp">${sum('dc',0)}</td><td class="sp">${sum('dc',1)}</td><td class="sp">${sum('df',0)}</td><td class="sp">${sum('df',1)}</td></tr>`; })()}</table></div>`;
  };
  const rank=`<table class="rank"><tr><th>${L('Place')}</th><th>${L('Pair')}</th><th>${L('Name')}</th>${sh.mp?`<th>${L('Points')}</th><th>%</th>`:''}${sh.imp?'<th>IMP</th>':''}</tr>${ranking.map((p,i)=>`<tr class="pr" onclick="var d=this.nextElementSibling;d.hidden=!d.hidden;this.classList.toggle('open')"><td>${i+1}</td><td>${esc(p.no)}</td><td class="nm">▸ ${esc(p.name)}</td>${sh.mp?`<td class="n">${fmt(p.mp,1)}</td><td class="n">${fmt(p.pct)}</td>`:''}${sh.imp?`<td class="n">${fmt(p.imp)}</td>`:''}</tr><tr class="pd" hidden><td colspan="${cols}">${pairBoards(p.id,p.name)}</td></tr>`).join('')}</table>`;
  const boardsHtml=nums.map(bn=>{
    const hd=hands.find(h=>String(h.board)===String(bn)), a=dd[String(bn)], L2=by[bn]||[];
    const res=L2.length?`<table class="res"><tr><th>NS</th><th>EW</th><th>${L('Round')}</th><th>${L('Contract')}</th><th>${L('Tricks')}</th><th>${L('Lead')}</th><th>NS</th><th>EW</th>${sh.mp?`<th>MP NS</th><th>MP EW</th>`:''}${sh.imp?'<th>IMP NS</th>':''}</tr>${L2.map(x=>{
      const b=x.b, pass=!b.level, tr=pass?'—':b.level+6+(+b.result||0), ns=typeof b.nsScore==='number'?b.nsScore:null;
      const con=pass?'PASS':`${b.level}${b.suit||''}${b.doubled||''} ${b.declarer||''}`;
      return `<tr><td>${esc(pairNo(x.ns))}</td><td>${esc(pairNo(x.ew))}</td><td>${x.r}</td><td class="c">${suitHtml(con)}</td><td>${tr}</td><td class="c">${suitHtml(b.lead||'')}</td><td>${ns>0?ns:''}</td><td>${ns<0?-ns:''}</td>${sh.mp?`<td>${x.nsMP==null?'':x.nsMP}</td><td>${x.ewMP==null?'':x.ewMP}</td>`:''}${sh.imp?`<td>${x.imp==null?'':fmt(x.imp)}</td>`:''}</tr>`;
    }).join('')}</table>`:'';
    return `<div class="bd" id="b${esc(bn)}"><h3>${L('Board')} ${esc(bn)}</h3><div class="top">${hd?diagram(hd,bn):''}<div class="ddbox">${a?`<h4 style="margin:0 0 6px;color:#1f4e79">Double Dummy</h4>${ddHtml(a)}`:''}</div></div>${res}</div>`;
  }).join('');
  const bar=withBar?`<div class="bar"><button class="btn btn-gold" onclick="ccResultsDownload()">⬇ ${L('Save as a page')}</button><button class="btn" style="background:#25d366;color:#fff" onclick="ccResultsShare('wa')">💬 WhatsApp</button><button class="btn btn-blue" onclick="ccResultsShare('sms')">✉️ SMS</button>${navigator.canShare?`<button class="btn btn-ghost" onclick="ccResultsShare('file')">📤 ${L('Share the page')}</button>`:''}<button class="btn btn-ghost" onclick="window.print()">🖨 ${L('Print')}</button><button class="btn btn-ghost" onclick="ccClose&&ccClose()">✕ ${L('Close')}</button></div>`:'';
  return `<div class="ccr">${bar}<h1>${esc(s.name||L('Tournament'))} ${esc(date)}</h1>
    <div class="meta"><div>${L('Date')}: ${esc(date)}</div><div>${L('Club')}: ${esc(CLUB_NAME||'')}</div><div>${L('Boards')}: ${nums.length}, ${L('rounds')}: ${rounds}, ${L('pairs')}: ${ranking.length}</div></div>
    ${rank}<h2>${L('Boards')}</h2><div class="nav">${nums.map(b=>`<a href="#b${esc(b)}" onclick="var e=document.getElementById('b${esc(b)}');if(e){e.scrollIntoView();return false;}">${esc(b)}</a>`).join('')}</div>${boardsHtml}</div>`;
}
window.ccResultsPage=async function(){
  try{ await Promise.all(['hands','dd','boards','pairs','movements','state'].map(k=>DB.get(k))); }catch(e){}
  let el=document.getElementById('ccLayer'); if(!el){ el=document.createElement('div'); el.id='ccLayer'; document.body.appendChild(el); }
  el.style.background='#fff'; el.hidden=false;
  el.innerHTML=`<style>${CSS}</style>${pageHtml(true)}`;
  el.scrollTop=0;
};
// the ranking as a short message (WhatsApp, SMS), or the whole page as a file to the phone's share menu
function shareText(){
  const L=v=>window.i18nText?i18nText(v):v, {s,sh,ranking}=collect(), date=(s._finishedAt||new Date().toISOString()).slice(0,10);
  return [(CLUB_NAME?CLUB_NAME+' — ':'')+(s.name||L('Tournament'))+' '+date, ...ranking.map((p,i)=>(i+1)+'. '+p.name+' — '+(sh.byImp?fmt(p.imp)+' IMP':fmt(p.pct,1)+'%'))].join('\n');
}
function pageFile(){
  const s=getState(), html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.name||'Results')}</title><style>body{margin:0;background:#fff}${CSS}</style></head><body>${pageHtml(false)}</body></html>`;
  return new File([html],(String(s.name||'results').replace(/[^\w\-]+/g,'_')||'results')+'.html',{type:'text/html'});
}
window.ccResultsShare=async function(how){
  const text=shareText();
  if(how==='wa'){ window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank'); return; }
  if(how==='sms'){ location.href='sms:?&body='+encodeURIComponent(text); return; }
  try{ const f=pageFile(); if(navigator.canShare&&navigator.canShare({files:[f]})){ await navigator.share({files:[f],text}); return; } }catch(e){ if(e&&e.name==='AbortError') return; }
  ccResultsDownload();
};
window.ccResultsDownload=function(){
  const s=getState(), html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.name||'Results')}</title><style>body{margin:0;background:#fff}${CSS}</style></head><body>${pageHtml(false)}</body></html>`;
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));
  a.download=(String(s.name||'results').replace(/[^\w\-]+/g,'_')||'results')+'.html'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000);
};
})();
