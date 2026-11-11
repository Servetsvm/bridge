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
  const tri=['0,0 100,0 50,50','100,0 100,100 50,50','0,100 100,100 50,50','0,0 0,100 50,50'], at=[[50,15],[85,51],[50,87],[15,51]];
  const comp=`<svg class="cp" viewBox="0 0 100 100" aria-hidden="true">${tri.map((p,s)=>`<polygon points="${p}" fill="${vul(s)?'#e53935':'#e9ecef'}" stroke="#555" stroke-width="1"/>`).join('')}<rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="#333" stroke-width="1.5"/>${['N','E','S','W'].map((L,s)=>(s===dl?`<circle cx="${at[s][0]}" cy="${at[s][1]}" r="10" fill="#111"/>`:'')+`<text x="${at[s][0]}" y="${at[s][1]+5}" text-anchor="middle" font-size="15" font-weight="700" fill="${s===dl||vul(s)?'#fff':'#222'}">${L}</text>`).join('')}<circle cx="50" cy="50" r="13" fill="#fff" stroke="#333" stroke-width="1.5"/><text x="50" y="55.5" text-anchor="middle" font-size="15" font-weight="700" fill="#222">${esc(board)}</text></svg>`;
  return `<div class="dg"><div class="h n">${handHtml(h[0])}</div><div class="h w">${handHtml(h[3])}</div>${comp}<div class="h e">${handHtml(h[1])}</div><div class="h s">${handHtml(h[2])}</div></div>`;
}
function ddHtml(a){
  if(!a||!a.t) return '';
  const row=(d,L)=>`<tr><th>${L}</th>${[3,2,1,0,4].map(st=>{ const n=a.t[d][st]; return `<td>${n==null?'':n}</td>`; }).join('')}</tr>`;
  const same=(x,y)=>a.t[x]&&a.t[y]&&a.t[x].every((n,i)=>n===a.t[y][i]);
  const p=a.par||{}, SY=['♣','♦','♥','♠','NT'];
  const best=p.level?`${p.level}${SY[p.strain]||''}${p.dbl===2?'XX':p.dbl?'X':''} ${p.decl||''} ${p.tricks!=null?p.tricks:''} ${p.score!=null?p.score:''}`:(p.text||'');
  return `<div class="par">${suitHtml(best)}</div><table class="dd"><tr><th></th><th>♠</th><th class="r">♥</th><th class="r">♦</th><th>♣</th><th>NT</th></tr>${same(0,2)?row(0,'NS'):row(0,'N')+row(2,'S')}${same(1,3)?row(1,'EW'):row(1,'E')+row(3,'W')}</table>`;
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
.ccr .pgn{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:6px;margin:6px 0 10px}.ccr .pgn a{color:#1f4e79;font-weight:700;text-decoration:none;min-width:30px;height:30px;line-height:30px;text-align:center;padding:0 6px;border-radius:15px}.ccr .pgn a.on{background:#24476b;color:#fff}.ccr .pgn a.pv{padding:0 10px}.ccr .pgn a.off{color:#b8c2cc;pointer-events:none}.ccr .pgn i{color:#7a8794;font-style:normal}
.ccr .bds{display:grid;grid-template-columns:1fr;gap:16px}
@media (min-width:900px){.ccr .bds{grid-template-columns:1fr 1fr}}
.ccr .bd{min-width:0;border:1px solid #dfe5ec;border-radius:10px;padding:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);background:#fff}
.ccr .bd h3{margin:0 0 8px;color:#1f4e79}.ccr .bd h4{margin:14px 0 6px;color:#1f4e79;font-size:1.15rem}
.ccr .dg{display:grid;grid-template-columns:1fr auto 1fr;grid-template-areas:". n ." "w c e" ". s .";gap:6px 12px;align-items:center;font-size:1.05rem;margin:0 auto;max-width:420px}.ccr .dg .w{justify-self:end}.ccr .dg .e{justify-self:start}.ccr .dg .n,.ccr .dg .s{justify-self:center}
.ccr .dg .n{grid-area:n}.ccr .dg .s{grid-area:s}.ccr .dg .w{grid-area:w}.ccr .dg .e{grid-area:e}.ccr .dg .h div{white-space:nowrap;line-height:1.35}
.ccr .cp{grid-area:c;width:110px;height:110px;justify-self:center;display:block}
.ccr .ddbox{min-width:0}.ccr .par{margin:0 0 6px;text-align:center;max-width:300px;font-size:1.05rem}.ccr .dd{width:auto;min-width:300px}.ccr .dd th{padding:8px 10px}.ccr .dd tr:first-child th{font-size:1.1rem}.ccr .dd td{padding:7px 10px;text-align:center;border:1px solid #e3e7ec;font-size:1.05rem}.ccr .dd th.r{color:#ff8a80}
.ccr .resw{overflow-x:auto}
.ccr .res{margin-top:6px;font-size:.92rem}.ccr .res td{white-space:nowrap}
.ccr .bar{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
@media print{.ccr .bar,.ccr .pgn{display:none}.ccr .bd{display:block!important;break-inside:avoid;margin-bottom:12px}.ccr .bds{display:block}}
@media (max-width:640px){.ccr{padding:10px 6px 30px}.ccr h1{font-size:1.3rem}.ccr .res{font-size:.8rem}.ccr .res td,.ccr .res th{padding:5px 3px}.ccr .rank td,.ccr .rank th{padding:6px 3px;font-size:.85rem}.ccr .dg{font-size:.95rem;gap:4px 8px}.ccr .cp{width:88px;height:88px}.ccr .dd{min-width:0;width:100%}.ccr .par{max-width:none}.ccr .dd td,.ccr .dd th{padding:6px 4px}.ccr .bd{padding:10px 8px}.ccr .pgn{justify-content:center}}`;

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
    return `<div class="pbw"><table class="res pb"><tr><th rowspan="2">${L('Board')}</th><th rowspan="2">${L('Opponents')}</th><th rowspan="2">${L('Round')}</th><th rowspan="2">${L('Contract')}</th><th rowspan="2">${L('Tricks')}</th><th rowspan="2">${L('Lead')}</th><th rowspan="2">${L('Score')}</th>${sh.mp?'<th rowspan="2">MP</th>':''}${sh.imp?'<th rowspan="2">IMP</th>':''}<th colspan="2">${L('Declarer')}</th><th colspan="2">${L('Defence')}</th></tr><tr><th>${esc(who[0])}</th><th>${esc(who[1])}</th><th>${esc(who[0])}</th><th>${esc(who[1])}</th></tr>${rows.map(x=>`<tr><td><a href="#b${esc(x.bn)}" onclick="return window.ccrGo?ccrGo('${esc(x.bn)}'):true">${esc(x.bn)}</a></td><td>${esc(x.opp)}</td><td>${x.r}</td><td class="c">${suitHtml(x.con)}</td><td>${x.tr}</td><td class="c">${suitHtml(x.lead)}</td><td>${x.sc==null?'':x.sc}</td>${sh.mp?`<td>${x.mp==null?'':x.mp}</td>`:''}${sh.imp?`<td>${x.imp==null?'':fmt(x.imp)}</td>`:''}${cell(x,'dc',0)}${cell(x,'dc',1)}${cell(x,'df',0)}${cell(x,'df',1)}</tr>`).join('')}${(()=>{ const sum=(k,i)=>{ const v=rows.filter(x=>x[k]===i&&x.pts!=null).reduce((a,x)=>a+x.pts,0); return sh.byImp?fmt(v):v; }; return `<tr class="tot"><td colspan="${7+(sh.mp?1:0)+(sh.imp?1:0)}"></td><td class="sp">${sum('dc',0)}</td><td class="sp">${sum('dc',1)}</td><td class="sp">${sum('df',0)}</td><td class="sp">${sum('df',1)}</td></tr>`; })()}</table></div>`;
  };
  const rank=`<table class="rank"><tr><th>${L('Place')}</th><th>${L('Pair')}</th><th>${L('Name')}</th>${sh.mp?`<th>${L('Points')}</th><th>%</th>`:''}${sh.imp?'<th>IMP</th>':''}</tr>${ranking.map((p,i)=>`<tr class="pr" onclick="var d=this.nextElementSibling;d.hidden=!d.hidden;this.classList.toggle('open')"><td>${i+1}</td><td>${esc(p.no)}</td><td class="nm">▸ ${esc(p.name)}</td>${sh.mp?`<td class="n">${fmt(p.mp,1)}</td><td class="n">${fmt(p.pct)}</td>`:''}${sh.imp?`<td class="n">${fmt(p.imp)}</td>`:''}</tr><tr class="pd" hidden><td colspan="${cols}">${pairBoards(p.id,p.name)}</td></tr>`).join('')}</table>`;
  const boardsHtml=nums.map(bn=>{
    const hd=hands.find(h=>String(h.board)===String(bn)), a=dd[String(bn)], L2=by[bn]||[];
    const res=L2.length?`<div class="resw"><table class="res"><tr><th>NS</th><th>EW</th><th>${L('Round')}</th><th>${L('Contract')}</th><th>${L('Tricks')}</th><th>${L('Lead')}</th><th>NS</th><th>EW</th>${sh.mp?`<th>MP NS</th><th>MP EW</th>`:''}${sh.imp?'<th>IMP NS</th>':''}</tr>${L2.map(x=>{
      const b=x.b, pass=!b.level, tr=pass?'—':b.level+6+(+b.result||0), ns=typeof b.nsScore==='number'?b.nsScore:null;
      const con=pass?'PASS':`${b.level}${b.suit||''}${b.doubled||''} ${b.declarer||''}`;
      return `<tr><td>${esc(pairNo(x.ns))}</td><td>${esc(pairNo(x.ew))}</td><td>${x.r}</td><td class="c">${suitHtml(con)}</td><td>${tr}</td><td class="c">${suitHtml(b.lead||'')}</td><td>${ns>0?ns:''}</td><td>${ns<0?-ns:''}</td>${sh.mp?`<td>${x.nsMP==null?'':x.nsMP}</td><td>${x.ewMP==null?'':x.ewMP}</td>`:''}${sh.imp?`<td>${x.imp==null?'':fmt(x.imp)}</td>`:''}</tr>`;
    }).join('')}</table></div>`:'';
    return `<div class="bd" id="b${esc(bn)}"><h3>${L('Board')} ${esc(bn)}</h3>${hd?diagram(hd,bn):''}${a?`<div class="ddbox"><h4>Double Dummy</h4>${ddHtml(a)}</div>`:''}${L2.length?`<h4>${L('Results')}</h4>`:''}${res}</div>`;
  }).join('');
  const bar=withBar?`<div class="bar"><button class="btn btn-gold" onclick="ccResultsDownload()">⬇ ${L('Save as a page')}</button><button class="btn" style="background:#25d366;color:#fff" onclick="ccResultsShare('wa')">💬 WhatsApp</button><button class="btn btn-blue" onclick="ccResultsShare('sms')">✉️ SMS</button>${navigator.canShare?`<button class="btn btn-ghost" onclick="ccResultsShare('file')">📤 ${L('Share the page')}</button>`:''}<button class="btn btn-ghost" onclick="window.print()">🖨 ${L('Print')}</button><button class="btn btn-ghost" onclick="ccResultsClose()">✕ ${L('Close')}</button></div>`:'';
  return `<div class="ccr">${bar}<h1>${esc(s.name||L('Tournament'))} ${esc(date)}</h1>
    <div class="meta"><div>${L('Date')}: ${esc(date)}</div><div>${L('Club')}: ${esc(CLUB_NAME||'')}</div><div>${L('Boards')}: ${nums.length}, ${L('rounds')}: ${rounds}, ${L('pairs')}: ${ranking.length}</div></div>
    ${rank}<h2>${L('Boards')}</h2><div class="pgn" data-prev="${esc(L('Previous'))}" data-next="${esc(L('Next'))}"></div><div class="bds">${boardsHtml}</div><div class="pgn pgn2" data-prev="${esc(L('Previous'))}" data-next="${esc(L('Next'))}"></div></div>`;
}
/* the pages of boards (two on a wide screen, one on a phone); runs in the program and inside the saved page, so it
   uses nothing from the program */
function pager(){
  var R=document.querySelector('.ccr'); if(!R) return;
  var B=[].slice.call(R.querySelectorAll('.bd')), navs=[].slice.call(R.querySelectorAll('.pgn')), cur=0;
  var per=function(){ return window.matchMedia&&window.matchMedia('(min-width:900px)').matches?2:1; };
  var count=function(){ return Math.max(1,Math.ceil(B.length/per())); };
  function draw(){
    var P=count(), h='', gap=false;
    var a=function(i,t,c,off){ return '<a href="#" data-p="'+i+'" class="'+(c||'')+(off?' off':'')+'">'+t+'</a>'; };
    for(var i=0;i<P;i++){ if(i===0||i===P-1||Math.abs(i-cur)<=2){ h+=a(i,String(i+1),i===cur?'on':''); gap=false; } else if(!gap){ h+='<i>…</i>'; gap=true; } }
    navs.forEach(function(n){ n.innerHTML=h+a(cur-1,n.getAttribute('data-prev'),'pv',cur===0)+a(cur+1,n.getAttribute('data-next'),'pv',cur>=P-1); });
  }
  function show(p){ var n=per(); cur=Math.max(0,Math.min(count()-1,p)); B.forEach(function(b,i){ b.style.display=Math.floor(i/n)===cur?'':'none'; }); draw(); }
  navs.forEach(function(n){ n.addEventListener('click',function(e){ var t=e.target.closest('[data-p]'); if(!t) return; e.preventDefault(); if(t.className.indexOf('off')>=0) return; show(+t.getAttribute('data-p')); var top=R.querySelector('.pgn'); if(top) top.scrollIntoView(); }); });
  window.ccrGo=function(bn){ var i=-1; B.forEach(function(b,k){ if(b.id==='b'+bn) i=k; }); if(i<0) return true; show(Math.floor(i/per())); B[i].scrollIntoView(); return false; };
  var w=per(); window.addEventListener('resize',function(){ if(per()!==w){ w=per(); show(cur); } });
  show(0);
}
window.ccResultsClose=function(){ if(window._ccResultsOnly){ try{ const P=window.parent; if(P&&P!==window&&typeof P.closeClubs==='function'){ P.closeClubs(); return; } }catch(e){} history.back(); return; } ccClose&&ccClose(); };
// which tournament the page shows: null = the current one, a number = that archive (0 = the last one finished)
let SRC=null;
const KEYS=['state','pairs','boards','movements','hands','dd'];
function withSrc(fn){
  const a=SRC==null?null:(getArchives()||[])[SRC]; if(!a) return fn();
  const keep={}; KEYS.forEach(k=>{ keep[k]=_cache[k]; }); _cache.state=a.state; _cache.pairs=a.pairs; _cache.boards=a.boards; _cache.movements=a.movements; _cache.hands=a.hands||[]; _cache.dd=a.dd||{};
  try{ return fn(); } finally { KEYS.forEach(k=>{ _cache[k]=keep[k]; }); }
}
window.ccResultsPick=function(v){ SRC=v===''?null:+v; ccResultsDraw(); };
function ccResultsDraw(){
  const el=document.getElementById('ccLayer'); if(!el) return;
  const L=v=>window.i18nText?i18nText(v):v, arc=getArchives()||[], cur=getState();
  const opts=(cur.status==='finished'?[`<option value=""${SRC==null?' selected':''}>${esc(cur.name||L('Tournament'))} · ${esc(String(cur._finishedAt||'').slice(0,10))}</option>`]:[])
    .concat(arc.map((a,i)=>`<option value="${i}"${SRC===i?' selected':''}>${esc(a.state&&a.state.name||L('Tournament'))} · ${esc(String(a.finished||'').slice(0,10))}</option>`));
  const pick=opts.length>1?`<div class="bar"><select class="pick" onchange="ccResultsPick(this.value)">${opts.join('')}</select></div>`:'';
  el.innerHTML=`<style>${CSS}.ccr .pick{font-size:1rem;padding:6px 8px;border-radius:8px;border:1px solid #c9d3de;max-width:100%}</style>${withSrc(()=>pageHtml(true)).replace('<div class="ccr">','<div class="ccr">'+pick)}`;
  el.scrollTop=0; pager();
}
window.ccResultsPage=async function(i){
  try{ await Promise.all(['hands','dd','boards','pairs','movements','state','archives'].map(k=>DB.get(k))); }catch(e){}
  // nothing said: the tournament just finished, else the last one archived
  SRC=i!=null?i:(getState().status==='finished'||!(getArchives()||[]).length?null:0);
  let el=document.getElementById('ccLayer'); if(!el){ el=document.createElement('div'); el.id='ccLayer'; document.body.appendChild(el); }
  el.style.background='#fff'; el.hidden=false;
  ccResultsDraw();
};
// the ranking as a short message (WhatsApp, SMS), or the whole page as a file to the phone's share menu
function shareText(){
  const L=v=>window.i18nText?i18nText(v):v, {s,sh,ranking}=withSrc(collect), date=(s._finishedAt||new Date().toISOString()).slice(0,10);
  return [(CLUB_NAME?CLUB_NAME+' — ':'')+(s.name||L('Tournament'))+' '+date, ...ranking.map((p,i)=>(i+1)+'. '+p.name+' — '+(sh.byImp?fmt(p.imp)+' IMP':fmt(p.pct,1)+'%'))].join('\n');
}
function pageFile(){
  const s=withSrc(getState), html=withSrc(()=>`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.name||'Results')}</title><style>body{margin:0;background:#fff}${CSS}</style></head><body>${pageHtml(false)}<script>(${pager.toString()})();</script></body></html>`);
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
  const s=withSrc(getState), html=withSrc(()=>`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.name||'Results')}</title><style>body{margin:0;background:#fff}${CSS}</style></head><body>${pageHtml(false)}<script>(${pager.toString()})();</script></body></html>`);
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));
  a.download=(String(s.name||'results').replace(/[^\w\-]+/g,'_')||'results')+'.html'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000);
};
})();
