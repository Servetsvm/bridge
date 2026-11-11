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
// a pair's number only, one for each pair: North-South pairs first, then East-West (EW 1 after the last NS pair)
const pairNo=id=>{ const v=String(id||''), m=v.match(/^(ns|ew|p)_?(\d+)$/); if(!m) return v; const n=+m[2]; if(m[1]!=='ew') return String(n); const ns=Object.keys(getPairs()).filter(k=>/^ns_\d+$/.test(k)).length; return String(ns+n); };
const realName=n=>n&&!/^(NS|EW|Pair|Par|Çift)\s*\d+$/i.test(String(n).trim());
window.ccPairNo=pairNo;
window.ccPairLabel=(id,P)=>{ const p=(P||getPairs())[id]; if(!p) return '—'; if(p.isPhantom) return '👻'; return pairNo(id)+(realName(p.name)?' · '+p.name:''); };
const fmt=(n,d=2)=>(typeof n==='number'&&isFinite(n)?n.toFixed(d):'—');

// a PBN deal → four hands (N E S W) of card numbers
function cards(deal){
  const m=String(deal||'').trim().match(/^([NESW]):(.*)$/i); if(!m) return null;
  const first='NESW'.indexOf(m[1].toUpperCase()), parts=m[2].trim().split(/\s+/); if(parts.length!==4) return null;
  const h=[[],[],[],[]];
  parts.forEach((p,i)=>p.split('.').forEach((rs,k)=>{ for(const ch of rs.toUpperCase()){ const r=RK.indexOf(ch); if(r>=0) h[(first+i)%4].push((3-k)*13+r); } }));
  return h;
}
function handHtml(h){ return [3,2,1,0].map(s=>{ const rs=h.filter(c=>((c/13)|0)===s).sort((a,b)=>b-a).map(c=>RK[c%13]==='T'?'10':RK[c%13]); return `<div><span class="sy${s===1||s===2?' r':''}">${SYM[s]}</span>${rs.length?rs.join(''):'—'}</div>`; }).join(''); }
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
  const ranking=Object.keys(pairs).filter(id=>!pairs[id].isPhantom).map(id=>{ const d=mp[id]||{mp:0,top:0,imp:0,boards:0}; return {id,no:pairNo(id),name:pairs[id].name||id,mp:d.mp,top:d.top,pm:d.mp-d.top/2,pct:d.top>0?d.mp/d.top*100:0,imp:d.imp||0,boards:d.boards}; })
    .sort((a,b)=>sh.byImp?b.imp-a.imp:(b.pct-a.pct||b.mp-a.mp));
  // each board: its results, each with the match points of both sides on that board
  const by={};
  for(const [k,b] of Object.entries(boards)){ if(!b||b.status!=='done') continue; const [t,r,bn]=k.split('_'); const m=mv[r+'_'+t]||{}; (by[bn]=by[bn]||[]).push({t:+t,r:+r,ns:m.ns,ew:m.ew,b}); }
  for(const L of Object.values(by)){
    const sc=L.filter(x=>typeof x.b.nsScore==='number'), top=Math.max(0,(sc.length-1)*2);
    for(const x of L){
      if(typeof x.b.nsScore!=='number'){ x.nsMP=x.ewMP=null; continue; }
      let m=0,imp=0; for(const y of sc){ if(y===x) continue; m+=x.b.nsScore>y.b.nsScore?2:x.b.nsScore===y.b.nsScore?1:0; imp+=scoreToIMP(x.b.nsScore-y.b.nsScore); }
      x.nsMP=sc.length>1?m:null; x.ewMP=sc.length>1?top-m:null; x.pm=sc.length>1?m-top/2:null; x.imp=sc.length>1?imp/(sc.length-1):null; x.top=top;
    }
    L.sort((p,q)=>(q.b.nsScore||0)-(p.b.nsScore||0));
  }
  const nums=[...new Set(Object.keys(by).concat(hands.map(h=>String(h.board))))].sort((a,b)=>(+a||0)-(+b||0));
  const rounds=s.roundCount||Math.max(0,...Object.values(by).flat().map(x=>x.r));
  return {s,sh,ranking,by,nums,hands,dd,rounds};
}

const CSS=`.ccr{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d2733;background:#fff;max-width:1100px;margin:0 auto;padding:14px 14px 40px}
.ccr h1{color:#1d5534;font-size:1.6rem;margin:4px 0 8px}.ccr h2{color:#1d5534;font-size:1.25rem;margin:22px 0 8px}
.ccr .meta div{margin:3px 0}.ccr .r{color:#d32f2f}
.ccr table{border-collapse:collapse;width:100%}
.ccr .rank th,.ccr .res th,.ccr .dd th{background:#1d5534;color:#fff;padding:7px 6px;font-weight:700}
.ccr .rank td,.ccr .res td{padding:7px 6px;border-bottom:1px solid #e3e7ec;text-align:center}
.ccr .rank td.nm{text-align:left}.ccr .rank tr:nth-child(even) td,.ccr .res tr:nth-child(even) td{background:#f4f6f8}
.ccr .rank td.n{text-align:right;font-variant-numeric:tabular-nums}
.ccr .rank tr.pr{cursor:pointer}.ccr .rank tr.pr:hover td{background:#eef6f0}.ccr .rank tr.pr.open td{background:#e7f1ea;font-weight:700}
.ccr .rank tr.pd>td{padding:4px 0 10px;background:#fff!important;text-align:left}.ccr .pb{margin:4px 0 0;font-size:.88rem}.ccr .pb th{background:#e2eee5!important;color:#173f28!important}.ccr .rank tr.pd>td{max-width:0}.ccr .pbw{overflow-x:auto;width:100%}.ccr .pb a{color:#1d5534;font-weight:700}.ccr .pb td.sp{background:#f6faf7}.ccr .pb tr.tot td{font-weight:800;border-top:2px solid #1d5534;background:#fff}
.ccr .pgn{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:6px;margin:6px 0 10px}.ccr .pgn a{color:#1d5534;font-weight:700;text-decoration:none;min-width:30px;height:30px;line-height:30px;text-align:center;padding:0 6px;border-radius:15px}.ccr .pgn a.on{background:#1d5534;color:#fff}.ccr .pgn a.pv{padding:0 10px}.ccr .pgn a.off{color:#b8c2cc;pointer-events:none}.ccr .pgn i{color:#7a8794;font-style:normal}
.ccr .bds{display:grid;grid-template-columns:1fr;gap:16px}
@media (min-width:900px){.ccr .bds{grid-template-columns:1fr 1fr}}
.ccr .bd{min-width:0;border:1px solid #dfe5ec;border-radius:10px;padding:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);background:#fff}
.ccr .bd h3{margin:0 0 8px;color:#1d5534}.ccr .bd h4{margin:14px 0 6px;color:#1d5534;font-size:1.15rem}
.ccr .dg{display:grid;grid-template-columns:1fr auto 1fr;grid-template-areas:". n ." "w c e" ". s .";gap:6px 12px;align-items:center;font-size:1.05rem;margin:0 auto;max-width:420px}.ccr .dg .w{justify-self:end}.ccr .dg .e{justify-self:start}.ccr .dg .n,.ccr .dg .s{justify-self:center}
.ccr .dg .n{grid-area:n}.ccr .dg .s{grid-area:s}.ccr .dg .w{grid-area:w}.ccr .dg .e{grid-area:e}.ccr .dg .h div{white-space:nowrap;line-height:1.35}
.ccr .cp{grid-area:c;width:110px;height:110px;justify-self:center;display:block}
.ccr .ddbox{min-width:0}.ccr .par{margin:0 0 6px;text-align:center;max-width:300px;font-size:1.05rem}.ccr .dd{width:auto;min-width:300px}.ccr .dd th{padding:8px 10px}.ccr .dd tr:first-child th{font-size:1.1rem}.ccr .dd td{padding:7px 10px;text-align:center;border:1px solid #e3e7ec;font-size:1.05rem}.ccr .dd th.r{color:#ff8a80}
.ccr .resw{overflow-x:auto}
.ccr .res{margin-top:6px;font-size:.92rem}.ccr .res td{white-space:nowrap}
.ccr .bar{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
@media print{.ccr .bar,.ccr .pgn{display:none}.ccr .bd{display:block!important;break-inside:avoid;margin-bottom:12px}.ccr .bds{display:block}}
@media (max-width:640px){.ccr{padding:10px 6px 30px}.ccr h1{font-size:1.3rem}.ccr .res{font-size:.8rem}.ccr .res td,.ccr .res th{padding:5px 3px}.ccr .rank td,.ccr .rank th{padding:6px 3px;font-size:.85rem}.ccr .dg{font-size:.95rem;gap:4px 8px}.ccr .cp{width:88px;height:88px}.ccr .dd{min-width:0;width:100%}.ccr .par{max-width:none}.ccr .dd td,.ccr .dd th{padding:6px 4px}.ccr .bd{padding:10px 8px}.ccr .pgn{justify-content:center}}
.ccr .rhead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin:4px 0 18px}
.ccr .rt{font-size:2.6rem;font-weight:500;color:#222;margin:0;line-height:1.1}
.ccr .back{display:inline-block;margin-top:6px;color:#2e7d32;font-size:1.2rem;text-decoration:none}
.ccr .rtools{display:flex;gap:6px}.ccr .rtools .ic{width:40px;height:40px;border-radius:50%;border:1px solid #d5dbe1;background:#fff;font-size:1.05rem;cursor:pointer}
.ccr .tt{color:#1d5534;font-size:1.7rem;font-weight:500;margin:6px 0 10px}
.ccr .meta{font-size:1.05rem;margin:0 0 16px}.ccr .meta div{margin:6px 0}
.ccr .rank{font-size:1.05rem}.ccr .rank td:nth-child(2),.ccr .rank td.n{white-space:nowrap}.ccr .rank th{background:#1d5534}.ccr .rank td{padding:9px 8px}
.ccr .rank .ar{color:#7fa48b;font-size:.8rem;display:inline-block;transition:transform .15s}.ccr .rank tr.open .ar{transform:rotate(90deg)}
.ccr .res th{background:#1d5534}.ccr .pb th{background:#e2eee5!important;color:#173f28!important;font-weight:600}
.ccr .res td.n{text-align:right;font-variant-numeric:tabular-nums}.ccr .res td.l{text-align:left}
.ccr .bhead{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-top:26px}.ccr .bhead h2{margin:0;color:#1d5534;font-weight:600}
.ccr .bhead .pgn{margin:0}
.ccr .bd{border:1px solid #e3e7ec;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.ccr .bd h3{display:none}.ccr .bd h4{color:#1d5534}
.ccr .dg .h div{font-size:1.1rem;letter-spacing:.5px}.ccr .dg .sy{display:inline-block;width:20px}
@media (max-width:640px){.ccr .rt{font-size:1.9rem}.ccr .tt{font-size:1.3rem}.ccr .meta{font-size:.95rem}.ccr .rank{font-size:.9rem}.ccr .rank td{padding:7px 4px}.ccr .dg .h div{font-size:1rem}.ccr .bhead{justify-content:center}}
/* Bridge Table's own look */
.ccr .rhead{background:linear-gradient(135deg,#1d5534,#2f7a4a);border-radius:14px;padding:16px 18px;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.18)}
.ccr .rt{color:#f3d36b;font-family:Georgia,"Times New Roman",serif;letter-spacing:.5px}
.ccr .back{background:rgba(255,255,255,.14);color:#fff;border-radius:999px;padding:4px 14px;font-size:1rem;margin-top:10px}.ccr .back::before{content:"← "}
.ccr .rtools .ic{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.3);color:#fff}
.ccr .tt{color:#1d5534;border-left:5px solid #d4a017;padding-left:10px}
.ccr .meta{display:flex;flex-wrap:wrap;gap:6px 18px;color:#44524a}.ccr .meta div{margin:0;background:#f3f6f4;border-radius:999px;padding:4px 12px}
.ccr .rank{border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)}.ccr .rank tr:first-child th{border-bottom:3px solid #d4a017}
.ccr .rank tr.pr:nth-of-type(2) td:first-child,.ccr .rank tr.pr td:first-child{font-weight:700}
.ccr .bhead h2{color:#1d5534}.ccr .pgn a.on{background:#1d5534}.ccr .pgn a{color:#1d5534}
.ccr .bd{border-radius:14px;border-color:#dfe8e2}.ccr .bd h4{color:#1d5534}
.ccr .dg{background:radial-gradient(ellipse at center,#2f7a4a 0%,#1d5534 75%);border-radius:12px;padding:12px 8px;max-width:none}
.ccr .dg .h{background:#fffdf7;border-radius:8px;padding:4px 10px;box-shadow:0 2px 5px rgba(0,0,0,.3)}
.ccr .cp{filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))}
.ccr .dd th{background:#1d5534}.ccr .dd tr:first-child th{border-bottom:3px solid #d4a017}
@media print{.ccr .rhead{background:none;color:#000;box-shadow:none}.ccr .rt{color:#000}.ccr .dg{background:none}}`;

function pageHtml(withBar){
  const L=v=>window.i18nText?i18nText(v):v;
  const {s,sh,ranking,by,nums,hands,dd,rounds}=collect();
  const date=(s._finishedAt||s._startedAt||new Date().toISOString()).slice(0,10);
  // numbers as the reader writes them (46,70 or 46.70)
  const loc={tr:'tr-TR',no:'nb-NO',es:'es-ES',fr:'fr-FR',it:'it-IT',de:'de-DE',ru:'ru-RU',pl:'pl-PL',zh:'zh-CN'}[(()=>{ try{ return localStorage.getItem('bricskor_language'); }catch(e){ return ''; } })()]||'en-GB';
  const num=v=>typeof v==='number'&&isFinite(v)?(v+0||0).toLocaleString(loc,{minimumFractionDigits:2,maximumFractionDigits:2}):'';
  const pts=x=>sh.byImp?x.imp:x.pm;   // a result's points: ± match points, or IMPs in a team match
  const conCells=b=>{ const pass=!b.level; return pass?`<td class="c" colspan="3">PASS</td><td class="c">${suitHtml(b.lead||'')}</td>`:`<td class="c l">${suitHtml(b.level+(b.suit||'')+(b.doubled||''))}</td><td>${esc(b.declarer||'')}</td><td>${b.level+6+(+b.result||0)}</td><td class="c">${suitHtml(b.lead||'')}</td>`; };
  // a pair tapped in the ranking: its boards (the opponents, the contract, the result, the points), and the points again by
  // who played the hand: as declarer, or in defence by who led, under each player's name
  const pairBoards=(id,name)=>{
    const rows=[], who=String(name||'').split(/\s+-\s+/).map(n=>n.trim().split(/\s+/)[0]||'?'); while(who.length<2) who.push('?');
    for(const [bn,L2] of Object.entries(by)) for(const x of L2){
      if(x.ns!==id&&x.ew!==id) continue;
      const me=x.ns===id, b=x.b, ns=typeof b.nsScore==='number'?b.nsScore:null, p=pts(x), d='NESW'.indexOf(b.declarer||'');
      const R={bn:+bn||bn,r:x.r,me:pairNo(id),opp:pairNo(me?x.ew:x.ns),b,sc:ns==null?null:(me?ns:-ns),p:p==null?null:(me?p:-p),dc:null,df:null};
      if(b.level&&d>=0){ const ours=me?d%2===0:d%2===1; if(ours) R.dc=d<2?0:1; else R.df=((d+1)%4)<2?0:1; }
      rows.push(R);
    }
    rows.sort((a,b)=>a.r-b.r||a.bn-b.bn);
    if(!rows.length) return `<div style="padding:8px">—</div>`;
    const cell=(x,k,i)=>`<td class="sp">${x[k]===i?num(x.p):''}</td>`, sum=(k,i)=>num(rows.filter(x=>x[k]===i&&x.p!=null).reduce((a,x)=>a+x.p,0));
    return `<div class="pbw"><table class="res pb"><tr><th rowspan="2">${L('Board')}</th><th rowspan="2" colspan="2">${L('Pair')}</th><th rowspan="2" colspan="4">${L('Contract')}</th><th rowspan="2">${L('Score')}</th><th rowspan="2">${L('Points')}</th><th colspan="2">${L('Declarer')}</th><th colspan="2">${L('Defence')}</th></tr><tr><th>${esc(who[0])}</th><th>${esc(who[1])}</th><th>${esc(who[0])}</th><th>${esc(who[1])}</th></tr>${rows.map(x=>`<tr><td><a href="#b${esc(x.bn)}" onclick="return window.ccrGo?ccrGo('${esc(x.bn)}'):true">${esc(x.bn)}</a></td><td>${esc(x.me)}</td><td>${esc(x.opp)}</td>${conCells(x.b)}<td class="n">${x.sc==null?'':x.sc}</td><td class="n">${num(x.p)}</td>${cell(x,'dc',0)}${cell(x,'dc',1)}${cell(x,'df',0)}${cell(x,'df',1)}</tr>`).join('')}<tr class="tot"><td colspan="9"></td><td class="sp">${sum('dc',0)}</td><td class="sp">${sum('dc',1)}</td><td class="sp">${sum('df',0)}</td><td class="sp">${sum('df',1)}</td></tr></table></div>`;
  };
  const cols=sh.byImp?4:5;
  const rank=`<table class="rank"><tr><th>${L('Place')}</th><th>${L('Pair')}</th><th>${L('Name')}</th>${sh.byImp?'<th>IMP</th>':`<th>${L('Points')}</th><th>%</th>`}</tr>${ranking.map((p,i)=>`<tr class="pr" onclick="var d=this.nextElementSibling;d.hidden=!d.hidden;this.classList.toggle('open')"><td>${i+1}</td><td>${esc(p.no)}</td><td class="nm"><span class="ar">▸</span> ${esc(p.name)}</td>${sh.byImp?`<td class="n">${num(p.imp)}</td>`:`<td class="n">${num(p.pm)}</td><td class="n">${num(p.pct)}</td>`}</tr><tr class="pd" hidden><td colspan="${cols}">${pairBoards(p.id,p.name)}</td></tr>`).join('')}</table>`;
  const boardsHtml=nums.map(bn=>{
    const hd=hands.find(h=>String(h.board)===String(bn)), a=dd[String(bn)], L2=by[bn]||[];
    const res=L2.length?`<div class="resw"><table class="res"><tr><th colspan="2">${L('Pair')}</th><th>${L('Round')}</th><th colspan="4">${L('Contract')}</th><th colspan="2">${L('Score')}</th><th colspan="2">${L('Points')}</th></tr>${L2.map(x=>{
      const b=x.b, ns=typeof b.nsScore==='number'?b.nsScore:null, p=pts(x);
      return `<tr><td>${esc(pairNo(x.ns))}</td><td>${esc(pairNo(x.ew))}</td><td>${x.r}</td>${conCells(b)}<td class="n">${ns>0?ns:ns===0?'0':'–'}</td><td class="n">${ns<0?-ns:'–'}</td><td class="n">${num(p)}</td><td class="n">${p==null?'':num(-p)}</td></tr>`;
    }).join('')}</table></div>`:'';
    return `<div class="bd" id="b${esc(bn)}"><h3>${L('Board')} ${esc(bn)}</h3>${hd?diagram(hd,bn):''}${a?`<div class="ddbox"><h4>Double Dummy</h4>${ddHtml(a)}</div>`:''}${L2.length?`<h4>${L('Results')}</h4>`:''}${res}</div>`;
  }).join('');
  const head=withBar?`<div class="rhead"><div><h1 class="rt">${L('Results')}</h1><a href="#" class="back" onclick="ccResultsIndex();return false;">${L('Back')}</a></div><div class="rtools"><button class="ic" title="${esc(L('Print'))}" onclick="window.print()">🖨</button><button class="ic" title="${esc(L('Close'))}" onclick="ccResultsClose()">✕</button></div></div>`:'';
  return `<div class="ccr">${head}<h2 class="tt">${esc(s.name||L('Tournament'))} ${esc(date)}</h2>
    <div class="meta"><div>${L('Date')}: ${esc(date)}</div><div>${L('Club')}: ${esc(CLUB_NAME||'')}</div><div>${L('Boards')}: ${nums.length}, ${L('rounds')}: ${rounds}, ${L('pairs')}: ${ranking.length}</div></div>
    ${rank}<div class="bhead"><h2>${L('Boards')}</h2><div class="pgn" data-prev="${esc(L('Previous'))}" data-next="${esc(L('Next'))}"></div></div><div class="bds">${boardsHtml}</div><div class="pgn pgn2" data-prev="${esc(L('Previous'))}" data-next="${esc(L('Next'))}"></div></div>`;
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
function layerEl(){ let el=document.getElementById('ccLayer'); if(!el){ el=document.createElement('div'); el.id='ccLayer'; document.body.appendChild(el); } el.style.background='#fff'; el.hidden=false; return el; }
function ccResultsDraw(){
  const el=document.getElementById('ccLayer'); if(!el) return;
  el.innerHTML=`<style>${CSS}</style>${withSrc(()=>pageHtml(true))}`;
  el.scrollTop=0; pager();
}
// one tournament's page: i = its place in the archive; nothing given: the tournament just finished (else the last one)
window.ccResultsPage=async function(i){
  try{ await Promise.all(['hands','dd','boards','pairs','movements','state','archives'].map(k=>DB.get(k))); }catch(e){}
  SRC=i!=null?i:(getState().status==='finished'||!(getArchives()||[]).length?null:0);
  layerEl(); ccResultsDraw();
};
// the list of the club's results: a tab for each year, the months newest first, each tournament's date and name
let IDXY=null;
const IDX_CSS=`.ccr .ihead{display:flex;align-items:center;justify-content:center;gap:22px;background:#f1f1f1;padding:20px 10px;margin:4px 0 14px}
.ccr .ihead span{flex:0 1 100px;height:5px;background:#f39c12;border-radius:2px}
.ccr .ihead h1{margin:0;font-family:Georgia,"Times New Roman",serif;font-size:2.3rem;letter-spacing:1px;text-transform:uppercase;color:#222}
.ccr .iclub{color:#555;margin:0 0 12px;font-size:1.05rem}
.ccr .ytabs{display:flex;flex-wrap:wrap;border-bottom:1px solid #dee2e6;margin:0 0 6px}
.ccr .ytabs a{padding:10px 22px;color:#2e7d32;cursor:pointer;font-size:1.15rem;border:1px solid transparent;border-radius:6px 6px 0 0;text-decoration:none}
.ccr .ytabs a.on{color:#222;border-color:#dee2e6 #dee2e6 #fff;background:#fff;margin-bottom:-1px}
.ccr .imon{font-size:1.9rem;font-weight:400;color:#222;margin:22px 0 10px}
.ccr .ir{display:grid;grid-template-columns:200px 1fr;gap:10px;padding:14px 12px;border-bottom:1px solid #e3e3e3;cursor:pointer;font-size:1.15rem}
.ccr .ir:nth-child(odd){background:#f2f2f2}.ccr .ir:hover{background:#e8f2ea}
.ccr .ir a{color:#2e7d32;text-decoration:none}
.ccr .inone{color:#777;padding:20px 0}
@media (max-width:640px){.ccr .ihead h1{font-size:1.6rem}.ccr .ihead span{flex-basis:40px}.ccr .ir{grid-template-columns:105px 1fr;font-size:1rem;padding:12px 8px}.ccr .imon{font-size:1.4rem}.ccr .ytabs a{padding:8px 14px;font-size:1rem}}`;
function indexHtml(){
  const L=v=>window.i18nText?i18nText(v):v;
  const loc={tr:'tr-TR',no:'nb-NO',es:'es-ES',fr:'fr-FR',it:'it-IT',de:'de-DE',ru:'ru-RU',pl:'pl-PL',zh:'zh-CN'}[(()=>{ try{ return localStorage.getItem('bricskor_language'); }catch(e){ return ''; } })()]||'en-GB';
  const list=(getArchives()||[]).map((a,i)=>({i,name:(a.state&&a.state.name)||L('Tournament'),d:new Date(a.finished||(a.state&&a.state._finishedAt)||0)})).filter(x=>x.d.getTime()>0).sort((a,b)=>b.d-a.d);
  const years=[...new Set(list.map(x=>x.d.getFullYear()))];
  if(!years.includes(IDXY)) IDXY=years[0];
  const months=[]; for(const x of list.filter(x=>x.d.getFullYear()===IDXY)){ const k=x.d.getMonth(); let m=months.find(m=>m.k===k); if(!m) months.push(m={k,t:x.d.toLocaleDateString(loc,{month:'long',year:'numeric'}),rows:[]}); m.rows.push(x); }
  const dd=d=>String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();
  return `<div class="ccr"><div class="bar"><button class="btn btn-ghost" onclick="ccResultsClose()">✕ ${L('Close')}</button></div>
    <div class="ihead"><span></span><h1>${L('Results')}</h1><span></span></div><div class="iclub">${esc(CLUB_NAME||'')}</div>
    ${years.length?`<div class="ytabs">${years.map(y=>`<a class="${y===IDXY?'on':''}" onclick="ccResultsYear(${y})">${y}</a>`).join('')}</div>
    ${months.map(m=>`<div class="imon">${esc(m.t)}</div><div>${m.rows.map(x=>`<div class="ir" onclick="ccResultsPage(${x.i})"><span>${dd(x.d)}</span><a href="#" onclick="return false">${esc(x.name)}</a></div>`).join('')}</div>`).join('')}`:`<div class="inone">${L('No results yet.')}</div>`}</div>`;
}
window.ccResultsYear=function(y){ IDXY=y; const el=layerEl(); el.innerHTML=`<style>${CSS}${IDX_CSS}</style>${indexHtml()}`; };
window.ccResultsIndex=async function(){
  try{ await DB.get('archives'); }catch(e){}
  const el=layerEl(); el.innerHTML=`<style>${CSS}${IDX_CSS}</style>${indexHtml()}`; el.scrollTop=0;
};
// the movement: for each round, at each table the North-South and East-West pairs (number and names) and the boards;
// a pair chosen: only its own way round (table, its seats, its opponents, the boards)
let MOVP=null, MOVT=null;
function movementHtml(){
  const L=v=>window.i18nText?i18nText(v):v, s=getState(), mv=getMovements(), P=getPairs();
  const head=`<div class="rhead"><div><h1 class="rt">${L('Movement')}</h1></div><div class="rtools"><button class="ic" title="${esc(L('Close'))}" onclick="ccResultsClose()">✕</button></div></div>`;
  if(!s.tableCount||!Object.keys(mv).length||s.status==='finished') return `<div class="ccr">${head}<div class="inone">${L('No tournament is being played now.')}</div></div>`;
  const ids=Object.keys(P).filter(id=>!P[id].isPhantom).sort((a,b)=>(+pairNo(a)||0)-(+pairNo(b)||0));
  const nm=id=>P[id]&&!P[id].isPhantom?`<b>${esc(pairNo(id))}</b>${realName(P[id].name)?` <small>${esc(P[id].name)}</small>`:''}`:(P[id]&&P[id].isPhantom?'👻':'—');
  const rounds=[...new Set(Object.keys(mv).map(k=>+k.split('_')[0]))].sort((a,b)=>a-b);
  const tables=[...new Set(Object.keys(mv).map(k=>+k.split('_')[1]))].sort((a,b)=>a-b);
  const tpick=`<div class="mpick"><span>${L('Table')}:</span>${tables.map(t=>`<a class="${MOVT===t?'on':''}" onclick="ccMoveTable(${t})">${t}</a>`).join('')}</div>`;
  const pick=tpick+`<div class="mpick"><span>${L('Choose your pair')}:</span><a class="${MOVP==null&&MOVT==null?'on':''}" onclick="ccMovePair(null)">${L('All')}</a>${ids.map(id=>`<a class="${MOVP===id?'on':''}" title="${esc(P[id].name||'')}" onclick="ccMovePair('${id}')">${esc(pairNo(id))}</a>`).join('')}</div>`;
  let body='';
  if(MOVT!=null){
    const rows=rounds.map(r=>{ const m=mv[r+'_'+MOVT]; if(!m) return ''; return `<tr class="${r===s.currentRound?'now':''}"><td>${r}</td><td class="nmc">${nm(m.ns)}</td><td class="nmc">${nm(m.ew)}</td><td>${m.boardStart}${m.boardEnd!==m.boardStart?' – '+m.boardEnd:''}</td></tr>`; }).join('');
    body=`<h2 class="tt">${L('Table')} ${MOVT}</h2><div class="resw"><table class="res mv"><tr><th>${L('Round')}</th><th>${L('North–South')}</th><th>${L('East–West')}</th><th>${L('Boards')}</th></tr>${rows}</table></div>`;
  } else if(MOVP){
    const rows=rounds.map(r=>{ const t=Object.keys(mv).find(k=>+k.split('_')[0]===r&&(mv[k].ns===MOVP||mv[k].ew===MOVP)); if(!t) return `<tr><td>${r}</td><td colspan="4">—</td></tr>`; const m=mv[t], ns=m.ns===MOVP; return `<tr class="${r===s.currentRound?'now':''}"><td>${r}</td><td><b>${t.split('_')[1]}</b></td><td>${ns?L('North–South'):L('East–West')}</td><td class="nmc">${nm(ns?m.ew:m.ns)}</td><td>${m.boardStart}${m.boardEnd!==m.boardStart?' – '+m.boardEnd:''}</td></tr>`; }).join('');
    body=`<h2 class="tt">${esc(pairNo(MOVP))} · ${esc(P[MOVP]&&P[MOVP].name||'')}</h2><div class="resw"><table class="res mv"><tr><th>${L('Round')}</th><th>${L('Table')}</th><th>${L('Seat')}</th><th>${L('Opponents')}</th><th>${L('Boards')}</th></tr>${rows}</table></div>`;
  } else {
    body=rounds.map(r=>{ const ts=Object.keys(mv).filter(k=>+k.split('_')[0]===r).map(k=>+k.split('_')[1]).sort((a,b)=>a-b);
      return `<h2 class="tt${r===s.currentRound?' now':''}">${L('Round')} ${r}</h2><div class="resw"><table class="res mv"><tr><th>${L('Table')}</th><th>${L('North–South')}</th><th>${L('East–West')}</th><th>${L('Boards')}</th></tr>${ts.map(t=>{ const m=mv[r+'_'+t]; return `<tr><td><b>${t}</b></td><td class="nmc">${nm(m.ns)}</td><td class="nmc">${nm(m.ew)}</td><td>${m.boardStart}${m.boardEnd!==m.boardStart?' – '+m.boardEnd:''}</td></tr>`; }).join('')}</table></div>`; }).join('');
  }
  return `<div class="ccr">${head}<h2 class="tt">${esc(s.name||L('Tournament'))}</h2>${pick}${body}</div>`;
}
const MOV_CSS=`.ccr .mpick{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:6px 0 14px}.ccr .mpick span{font-weight:600;margin-right:4px}
.ccr .mpick a{min-width:36px;height:36px;line-height:36px;text-align:center;padding:0 8px;border-radius:18px;border:1px solid #c9d8cd;color:#1d5534;font-weight:700;cursor:pointer;background:#fff}
.ccr .mpick a.on{background:#1d5534;color:#fff;border-color:#1d5534}
.ccr .mv td{text-align:center}.ccr .mv td.nmc{text-align:left;white-space:normal}.ccr .mv td.nmc small{color:#5b6b61}
.ccr .mv tr.now td{background:#fff6d6!important}.ccr .tt.now{color:#b8860b}.ccr .inone{color:#777;padding:20px 0}`;
window.ccMoveTable=function(t){ MOVT=MOVT===t?null:t; MOVP=null; const el=layerEl(); el.innerHTML=`<style>${CSS}${MOV_CSS}</style>${movementHtml()}`; };
window.ccMovePair=function(id){ MOVP=id; MOVT=null; const el=layerEl(); el.innerHTML=`<style>${CSS}${MOV_CSS}</style>${movementHtml()}`; };
window.ccMovementPage=async function(){
  try{ await Promise.all(['state','movements','pairs'].map(k=>DB.get(k))); }catch(e){}
  const el=layerEl(); el.innerHTML=`<style>${CSS}${MOV_CSS}</style>${movementHtml()}`; el.scrollTop=0;
  // the page follows the tournament (a new round, a Swiss pairing)
  clearInterval(window._ccMovT); window._ccMovT=setInterval(async()=>{ const L=document.getElementById('ccLayer'); if(!L||L.hidden||!L.querySelector('.mpick,.inone')){ clearInterval(window._ccMovT); return; } try{ await Promise.all(['state','movements','pairs'].map(k=>DB.get(k))); }catch(e){} const top=L.scrollTop; L.innerHTML=`<style>${CSS}${MOV_CSS}</style>${movementHtml()}`; L.scrollTop=top; },15000);
};
})();
