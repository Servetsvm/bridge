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
  const rank=`<table class="rank"><tr><th>${L('Place')}</th><th>${L('Pair')}</th><th>${L('Name')}</th>${sh.mp?`<th>${L('Points')}</th><th>%</th>`:''}${sh.imp?'<th>IMP</th>':''}</tr>${ranking.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.no)}</td><td class="nm">${esc(p.name)}</td>${sh.mp?`<td class="n">${fmt(p.mp,1)}</td><td class="n">${fmt(p.pct)}</td>`:''}${sh.imp?`<td class="n">${fmt(p.imp)}</td>`:''}</tr>`).join('')}</table>`;
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
