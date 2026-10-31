// ══════════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════════
(function(){const t=localStorage.getItem('bmTheme')||'dark';document.documentElement.setAttribute('data-theme',t);})();
window.toggleTheme=function(){const h=document.documentElement;const n=h.getAttribute('data-theme')==='dark'?'light':'dark';h.setAttribute('data-theme',n);localStorage.setItem('bmTheme',n);};

// ══════════════════════════════════════════════════════
//  DATA LAYER
// ══════════════════════════════════════════════════════
// ── Firebase REST DB ──
// the club tournaments live in Bridge Table's database (gate/…), see bridge-auth.js
const FB_BASE=window.GATE_BASE;
let CLUB_ID=null;   // resolved by initClubGate() before login is usable
let CLUB_NAME=null; // human-readable club name, set once club info is loaded
let FBURL=null;     // = FB_BASE + '/clubs/' + CLUB_ID + '/bm', set in setClub()
const _cache={};

// ── Offline write queue ──
// Each entry keeps the address without the sign-in token; a fresh token is added when it is sent
// (a token runs out after an hour, so a stored one would be refused).
const _writeQueue=[];
let _queueProcessing=false;
const _bare=u=>String(u||'').replace(/\?auth=.*$/,'');
async function _processQueue(){
  if(_queueProcessing||!navigator.onLine||!_writeQueue.length)return;
  _queueProcessing=true;
  while(_writeQueue.length&&navigator.onLine){
    const {url,method,body}=_writeQueue[0];
    try{
      const token=await authToken();
      const r=await fetch(_bare(url)+(token?'?auth='+token:''),{method,headers:{'Content-Type':'application/json'},body});
      if(r.status===401) toast('❌ Not allowed — please log in again');
      _writeQueue.shift();
      try{localStorage.setItem('bm_writeQueue',JSON.stringify(_writeQueue));}catch(e){}
    }catch(e){break;}
  }
  _queueProcessing=false;
}
// Restore queue from localStorage on startup
try{const q=JSON.parse(localStorage.getItem('bm_writeQueue')||'[]');if(Array.isArray(q))_writeQueue.push(...q.map(x=>({...x,url:_bare(x.url)})));}catch(e){}
function _queue(url,method,body){
  _writeQueue.push({url:_bare(url),method,body});
  try{localStorage.setItem('bm_writeQueue',JSON.stringify(_writeQueue));}catch(e){}
}
window.addEventListener('online',()=>{
  const b=document.getElementById('connBadge');
  if(b){b.style.background='var(--greendim)';b.style.color='var(--green)';b.textContent='🟢 Online';}
  _processQueue();
  toast('✅ Back online — syncing...');
});
window.addEventListener('offline',()=>{
  const b=document.getElementById('connBadge');
  if(b){b.style.background='var(--reddim)';b.style.color='var(--red)';b.textContent='🔴 Offline';}
  toast('⚠️ Offline — changes queued locally');
});

// ── PWA: register service worker for app-shell offline caching ──
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('service-worker.js').catch(()=>{
      // service-worker.js not deployed alongside index.html — app still works online-only
    });
  });
}

// The sign-in token (firebase-init.js is a module and loads a moment after this file: wait for it)
async function authToken(){
  for(let i=0;i<100&&!window._getAuthToken;i++) await new Promise(r=>setTimeout(r,50));
  try{ return window._getAuthToken ? await window._getAuthToken() : null; }catch(e){ return null; }
}
async function fbUrl(path){
  const token=await authToken();
  return FBURL+path+(token?('?auth='+token):'');
}
// Root-level (club-independent) requests: /clubs/*, /superadmin/*, /sess/*
async function fbRootUrl(path){
  const token=await authToken();
  return FB_BASE+path+(token?('?auth='+token):'');
}
// Text from the database is shown inside the page: < > " ' are replaced by look-alike characters,
// so a name can never become HTML or a script.
const _SAFE={'<':'‹','>':'›','"':'”',"'":'’'};
function cleanData(v){
  if(typeof v==='string') return v.replace(/[<>"']/g,c=>_SAFE[c]);
  if(Array.isArray(v)) return v.map(cleanData);
  if(v&&typeof v==='object'){const o={};for(const k in v)o[k]=cleanData(v[k]);return o;}
  return v;
}
// The member list (number → "First Last", loaded by the super admin from the federation's .mcd file): a player
// types their member number and their name comes from there; a name can also be typed as it is.
// the WhatsApp logo and an SMS speech bubble for the buttons that send a message
const ICON_WA='<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88zm8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41z"/></svg>';
const ICON_SMS='<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 2.8h16A2.2 2.2 0 0 1 22.2 5v10.2a2.2 2.2 0 0 1-2.2 2.2H9.6L5 21.2v-3.8H4a2.2 2.2 0 0 1-2.2-2.2V5A2.2 2.2 0 0 1 4 2.8z"/><text x="12" y="12.9" font-size="7.4" font-weight="900" text-anchor="middle" fill="currentColor" font-family="Arial,Helvetica,sans-serif">SMS</text></svg>';
const _members={};
async function memberName(num){
  num=String(num||'').trim();
  if(!/^\d{1,8}$/.test(num)) return null;
  if(num in _members) return _members[num];
  try{ const r=await fetch(await fbRootUrl('/members/'+num+'.json')); const v=r.ok?await r.json():null; _members[num]=typeof v==='string'?cleanData(v):null; }
  catch(e){ return null; }
  return _members[num];
}
// a name box marked data-member: a number typed into it becomes the member's name (the number stays when unknown)
document.addEventListener('change',async e=>{
  const el=e.target; if(!el||!el.matches||!el.matches('input[data-member]')) return;
  const v=el.value.trim(); if(!/^\d{1,8}$/.test(v)) return;
  const n=await memberName(v);
  if(n&&el.value.trim()===v){ el.value=n; el.dispatchEvent(new Event('input',{bubbles:true})); }
  else if(!n) toast('❓ '+v);
});
const DB={
  async get(k){
    try{const url=await fbUrl('/'+k+'.json');const r=await fetch(url,{cache:'no-store'});
      if(!r.ok)return _cache[k]||null;
      const v=cleanData(await r.json());_cache[k]=v;return v;
    }catch(e){return _cache[k]||null;}
  },
  async set(k,v){
    _cache[k]=v;
    const url=await fbUrl('/'+k+'.json');
    if(!navigator.onLine){_queue(url,'PUT',JSON.stringify(v));return;}
    try{
      const r=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)});
      if(r.status===401) toast('❌ Not allowed — please log in again');
    }
    catch(e){
      console.warn('FB write fail, queuing',k);
      _queue(url,'PUT',JSON.stringify(v));
    }
  },
  async del(k){
    delete _cache[k];
    const url=await fbUrl('/'+k+'.json');
    if(!navigator.onLine){_queue(url,'DELETE',null);return;}
    try{
      const r=await fetch(url,{method:'DELETE'});
      if(r.status===401) toast('❌ Not allowed — please log in again');
    }
    catch(e){_queue(url,'DELETE',null);}
  },
  subscribe(k,cb){
    let last=undefined;
    const poll=async()=>{
      try{const url=await fbUrl('/'+k+'.json');const r=await fetch(url,{cache:'no-store'});
        if(r.ok){const v=cleanData(await r.json());const s=JSON.stringify(v);
          if(s!==last){last=s;_cache[k]=v;cb(v);}
        }
      }catch(e){}
      setTimeout(poll,2000);
    };
    poll();
  }
};
const getState=()=>_cache['state']||{name:'Bridge Tournament',tableCount:0,boardsPerRound:3,totalBoards:0,roundCount:0,currentRound:0,status:'setup',movement:'mitchell',phantom:false,scoring:'MP'};
const setState=s=>DB.set('state',s);
const getPairs=()=>_cache['pairs']||{};
const setPairs=p=>DB.set('pairs',p);
const getBoards=()=>_cache['boards']||{};
const setBoards=b=>DB.set('boards',b);
const getMovements=()=>_cache['movements']||{};
const setMovements=m=>DB.set('movements',m);
const getLogs=()=>_cache['logs']||[];
const getArchives=()=>_cache['archives']||[];
const setArchives=a=>DB.set('archives',a);
const getApprovals=()=>_cache['approvals']||{};
const setApprovals=a=>DB.set('approvals',a);

async function preloadCache(){
  const keys=['state','pairs','boards','movements','logs','archives','approvals','tableLocks','playerdb','hands','dd'];
  await Promise.all(keys.map(k=>DB.get(k)));
}

function addLog(type,msg,detail=''){
  const l=getLogs();l.unshift({id:Date.now(),type,msg,detail,time:new Date().toLocaleTimeString()});
  if(l.length>300)l.splice(300);DB.set('logs',l);
}

// ══════════════════════════════════════════════════════
//  BRIDGE SCORING
// ══════════════════════════════════════════════════════
const SUIT_VAL={'♣':20,'♦':20,'♥':30,'♠':30,'NT':30};
const SUIT_FIRST={'♣':20,'♦':20,'♥':30,'♠':30,'NT':40};

function calcScore(level,suit,declarer,result,vuln,doubled){
  const isNS=declarer==='N'||declarer==='S';
  const isVuln=(isNS&&(vuln==='NS'||vuln==='Both'))||(!isNS&&(vuln==='EW'||vuln==='Both'));
  const dbl=doubled==='XX'?4:doubled==='X'?2:1;
  if(result<0){
    const u=Math.abs(result);let pen=0;
    if(dbl===1){pen=u*(isVuln?100:50);}
    else if(dbl===2){if(!isVuln){pen=u===1?100:u===2?300:500+(u-3)*300;}else{pen=u===1?200:u===2?500:800+(u-3)*300;}}
    else{if(!isVuln){pen=u===1?200:u===2?600:1000+(u-3)*600;}else{pen=u===1?400:u===2?1000:1600+(u-3)*600;}}
    return isNS?-pen:pen;
  }
  let trick=SUIT_FIRST[suit]+(level-1)*SUIT_VAL[suit];
  if(dbl>1)trick*=dbl;
  const game=trick>=100;
  let bonus=game?(isVuln?500:300):50;
  if(level===6)bonus+=isVuln?750:500;
  if(level===7)bonus+=isVuln?1500:1000;
  if(dbl===2)bonus+=50;if(dbl===4)bonus+=100;
  let over=0;
  if(result>0){if(dbl===1)over=result*SUIT_VAL[suit];else if(dbl===2)over=result*(isVuln?200:100);else over=result*(isVuln?400:200);}
  const total=trick+over+bonus;
  return isNS?total:-total;
}

function getVuln(boardNo){
  const v=['None','NS','EW','Both','NS','EW','Both','None','Both','EW','NS','None','Both','NS','EW','None'];
  return v[(boardNo-1)%16];
}

// IMP table
const IMP_TABLE=[15,45,85,125,165,215,265,315,365,425,495,595,745,895,1095,1295,1495,1745,1995,2245,2495,2995,3495,3995];
function scoreToIMP(diff){
  const d=Math.abs(diff);let imp=0;
  for(let i=0;i<IMP_TABLE.length;i++){if(d<IMP_TABLE[i]){imp=i;break;}if(i===IMP_TABLE.length-1)imp=24;}
  return diff>=0?imp:-imp;
}

// ══════════════════════════════════════════════════════
//  MATCHPOINT CALCULATION
// ══════════════════════════════════════════════════════
// every tournament is scored in MP and IMP together (a team match only in IMP)
// the tournament's scoring: MP + IMP (BOTH, also older tournaments), MP or IMP; a team match is always IMPs
const scoringShows=()=>{ const s=getState(), team=s.movement==='team', sc=team?'IMP':(s.scoring||'BOTH'); return { mp: sc!=='IMP', imp: sc!=='MP', byImp: sc==='IMP' }; };
const scoringName=s=>s&&s.movement==='team'?'IMP':s&&s.scoring==='MP'?'MP':s&&s.scoring==='IMP'?'IMP':'MP + IMP';
const fmtImp=v=>{ const x=Math.round((v||0)*10)/10; return (x>0?'+':'')+x.toFixed(1); };
function calcMP(){
  const boards=getBoards();const movements=getMovements();
  const boardScores={};
  Object.entries(boards).forEach(([key,b])=>{
    if(b.status!=='done')return;
    const[t,r,bn]=key.split('_');
    // Group by physical board number only — the same board travels between
    // tables across rounds (e.g. Board 1 is played at a different table each
    // round), so comparisons must span all rounds, not just within one round.
    const groupKey=bn;
    if(!boardScores[groupKey])boardScores[groupKey]=[];
    const m=movements[r+'_'+t]||{};
    if(typeof b.nsScore!=='number')return;
    boardScores[groupKey].push({ns:m.ns,ew:m.ew,nsScore:b.nsScore});
  });
  const pairMP={};
  Object.entries(boardScores).forEach(([,scores])=>{
    const n=scores.length;if(n<2)return;
    const top=(n-1)*2;
    scores.forEach(s=>{
      let nsMP=0,ewMP=0,nsIMP=0;
      scores.forEach(s2=>{
        if(s===s2)return;
        if(s.nsScore>s2.nsScore){nsMP+=2;}
        else if(s.nsScore===s2.nsScore){nsMP+=1;ewMP+=1;}
        else{ewMP+=2;}
        nsIMP+=scoreToIMP(s.nsScore-s2.nsScore);
      });
      nsIMP/=(n-1);   // cross-IMPs, averaged over the other results
      if(s.ns){if(!pairMP[s.ns])pairMP[s.ns]={mp:0,boards:0,top:0,imp:0};pairMP[s.ns].mp+=nsMP;pairMP[s.ns].boards++;pairMP[s.ns].top+=top;pairMP[s.ns].imp+=nsIMP;}
      if(s.ew){if(!pairMP[s.ew])pairMP[s.ew]={mp:0,boards:0,top:0,imp:0};pairMP[s.ew].mp+=ewMP;pairMP[s.ew].boards++;pairMP[s.ew].top+=top;pairMP[s.ew].imp-=nsIMP;}
    });
  });
  return pairMP;
}

// ══════════════════════════════════════════════════════
//  MOVEMENT GENERATORS
// ══════════════════════════════════════════════════════
function generateMitchell(tableCount, boardsPerRound, hasPhantom, totalBoards){
  const movements={};const pairs={};
  for(let i=1;i<=tableCount;i++) pairs['ns_'+i]={id:'ns_'+i,name:'NS '+i,dir:'NS',startTable:i,isPhantom:false};
  for(let i=1;i<=tableCount;i++) pairs['ew_'+i]={id:'ew_'+i,name:'EW '+i,dir:'EW',startTable:i,isPhantom:false};
  if(hasPhantom){pairs['phantom']={id:'phantom',name:'Phantom',dir:'EW',startTable:0,isPhantom:true};}
  const rounds=boardsPerRound>0?Math.floor(totalBoards/boardsPerRound):tableCount;
  const totalBoardSets=rounds;
  for(let r=1;r<=rounds;r++){
    for(let t=1;t<=tableCount;t++){
      const ewIdx=((t+r-2)%tableCount)+1;
      const boardSet=(((t-r)%tableCount+tableCount)%tableCount)%totalBoardSets;
      const boardStart=boardSet*boardsPerRound+1;
      const boardEnd=Math.min(boardStart+boardsPerRound-1,totalBoards);
      movements[r+'_'+t]={ns:'ns_'+t,ew:'ew_'+ewIdx,boardStart,boardEnd};
    }
  }
  return{movements,pairs,rounds};
}

/* Howell: every pair meets every other pair once, and nobody plays the same boards twice.
   n pairs (with an odd number of pairs a phantom is added: its opponent sits out that round) play n-1 rounds.
   Pairs 0..m-1 (m = n-1) sit round a circle plus one pair "∞". A starter splits 1..m-1 into k = (m-1)/2 couples
   {x, y} whose differences ±(x−y) cover 1..m-1 once; in round r, ∞ plays r and every couple plays as {x+r, y+r}, with board set a + r (∞'s match: a0 + r).
   With all a different and {a0} ∪ {a-x, a-y} covering 0..m-1, every round has different sets at its tables
   (boards move between tables) and every pair plays every set once (a Room square, found by a short search).
   None exists for 2 and 3 tables: there all tables play the same set each round, so each table needs its own
   copy of the boards. */
// first the quick pattern (couples {d, m-d}), which works for nearly every size; then any couples
function howellPatterned(m){
  const k=(m-1)/2, h=new Array(k+1).fill(-1), cover=new Array(m).fill(false), usedH=new Array(m).fill(false);let steps=0;
  const go=d=>{
    if(++steps>2e6)return false;
    if(d>k){const left=cover.indexOf(false);if(left<0||usedH[left])return false;h[0]=left;return true;}
    for(let v=0;v<m;v++){const a=(v+d)%m,b=(v-d+m)%m;if(usedH[v]||cover[a]||cover[b])continue;usedH[v]=cover[a]=cover[b]=true;h[d]=v;if(go(d+1))return true;usedH[v]=cover[a]=cover[b]=false;}
    return false;
  };
  return go(1)?[{x:0,y:null,a:h[0]},...Array.from({length:k},(_,i)=>({x:i+1,y:m-i-1,a:h[i+1]}))]:null;
}
function howellPlan(m){
  if(m<7)return null;
  const quick=howellPatterned(m);if(quick)return quick;
  const k=(m-1)/2, paired=new Array(m).fill(false), cover=new Array(m).fill(false), usedA=new Array(m).fill(false), usedD=new Array(m).fill(false), plan=[];
  paired[0]=true;let steps=0;
  const go=()=>{
    if(++steps>3e6)return false;
    let x=paired.indexOf(false);
    if(x<0){const a0=cover.indexOf(false);if(a0<0||usedA[a0])return false;plan.unshift({x:0,y:null,a:a0});return true;}
    paired[x]=true;
    for(let y=x+1;y<m;y++){
      const d1=(y-x+m)%m,d2=(x-y+m)%m;   // the couples' differences cover 1..m-1 once: everyone meets everyone once
      if(paired[y]||usedD[d1]||usedD[d2])continue;paired[y]=true;usedD[d1]=usedD[d2]=true;
      for(let a=0;a<m;a++){
        const p=(a-x+m)%m,q=(a-y+m)%m;
        if(usedA[a]||cover[p]||cover[q])continue;
        usedA[a]=cover[p]=cover[q]=true;plan.push({x,y,a});
        if(go())return true;
        plan.pop();usedA[a]=cover[p]=cover[q]=false;
      }
      paired[y]=false;usedD[d1]=usedD[d2]=false;
    }
    paired[x]=false;return false;
  };
  return go()?plan:null;
}
// Howell, or Barometer (same=true: every table plays the same boards each round, one copy of the boards per table).
// Pair 1 is the circle's fixed point: it stays at table 1, North-South, every round (e.g. a player in a wheelchair).
function generateHowell(tableCount, boardsPerRound, totalBoards, hasPhantom, same){
  const movements={};const pairs={};
  const real=tableCount*2+(hasPhantom?1:0), n=real+(real%2), m=n-1, k=(m-1)/2;
  for(let i=1;i<=real;i++) pairs['p'+i]={id:'p'+i,name:'Pair '+i,dir:'',startTable:0,isPhantom:false};
  const rounds=boardsPerRound>0?Math.min(m,Math.floor(totalBoards/boardsPerRound)):m;
  const plan=same?null:howellPlan(m);   // null: Barometer, or 2–3 tables: every table plays the same boards
  // ∞ (always table 1) → pair 1, circle position v → pair v+2 (the last one is the phantom when the number of pairs is odd)
  const pid=v=>v===m?'p1':(v+2<=real?'p'+(v+2):null);
  const nsN={};   // how often each pair has sat North-South: the one with fewer sits North-South
  for(let r=0;r<rounds;r++){
    const matches=plan?plan.map((c,i)=>c.y==null?[m,r,c.a,i]:[(c.x+r)%m,(c.y+r)%m,c.a,i])
      :[[m,r,0,0],...Array.from({length:k},(_,i)=>[(r+i+1)%m,(r-i-1+m)%m,0,i+1])];
    let table=0;
    for(const [a,b,add,i] of matches){
      const A=pid(a),B=pid(b);
      if(!A||!B)continue;   // against the phantom: sits out this round
      table++;
      const set=plan?(add+r)%m:r;
      const boardStart=set*boardsPerRound+1;
      const boardEnd=Math.min(boardStart+boardsPerRound-1,totalBoards);
      const flip=A==='p1'?false:B==='p1'?true:(nsN[B]||0)<(nsN[A]||0);   // pair 1 always North-South
      const ns=flip?B:A, ew=flip?A:B; nsN[ns]=(nsN[ns]||0)+1;
      movements[(r+1)+'_'+table]={ns,ew,boardStart,boardEnd};
    }
  }
  return{movements,pairs,rounds,copies:!plan};
}

// ══════════════════════════════════════════════════════
//  SWISS MOVEMENT (v1 — even pair counts only, no bye/phantom)
// ══════════════════════════════════════════════════════

// Round 1: random seed pairing (only called once, by the admin who starts
// setup — no concurrency concern, so Math.random() here is safe).
function generateSwissRound1(pairCount, boardsPerRound, roundCount){
  const pairs={};
  const ids=[];
  for(let i=1;i<=pairCount;i++){ pairs['p'+i]={id:'p'+i,name:'Pair '+i,dir:'',startTable:0,isPhantom:false}; ids.push('p'+i); }
  for(let i=ids.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]]; }
  ids.splice(ids.indexOf('p1'),1); ids.unshift('p1');   // pair 1 stays at table 1, North-South
  const movements={};
  for(let m=0;m<pairCount/2;m++){
    const table=m+1;
    const a=ids[m*2], b=ids[m*2+1];
    const ns=a, ew=b; // round 1: arbitrary — first of the shuffled pair sits NS
    movements['1_'+table]={ns,ew,boardStart:1,boardEnd:boardsPerRound};
  }
  return{movements,pairs,rounds:roundCount};
}

// Current standings, best first. Reuses calcMP() — safe because Swiss board
// numbers never repeat across rounds, so calcMP's "group by board number"
// logic naturally compares the right instances (same round, different tables)
// without needing separate handling.
function calcSwissStandingsArray(){
  const pairMP=calcMP();
  const pairs=getPairs();
  const arr=Object.keys(pairs).filter(id=>!pairs[id].isPhantom).map(id=>{
    const d=pairMP[id]||{mp:0,top:0,boards:0};
    return{id, mp:d.mp||0, top:d.top||0, pct:(d.top>0?d.mp/d.top:0)};
  });
  arr.sort((a,b)=>b.pct-a.pct||(a.id<b.id?-1:1)); // deterministic tie-break by id
  return arr;
}

// Set of "pairA|pairB" keys (alphabetically sorted) for every match already played.
function getSwissPairingHistory(movements){
  const played=new Set();
  Object.values(movements).forEach(mv=>{
    if(mv.ns&&mv.ew)played.add([mv.ns,mv.ew].sort().join('|'));
  });
  return played;
}

// Greedy pairing down the standings list, skipping rematches where possible.
// Deterministic given the same standings+history — safe if two clients both
// trigger generation at the same time, since they'll compute the same result.
function pairSwissMatches(standings, history){
  const remaining=standings.map(s=>s.id);
  const matches=[];
  while(remaining.length>0){
    const a=remaining.shift();
    let idx=remaining.findIndex(b=>!history.has([a,b].sort().join('|')));
    if(idx===-1)idx=0; // everyone remaining already played `a` — forced rematch
    const b=remaining.splice(idx,1)[0];
    matches.push([a,b]);
  }
  return matches;
}

function generateSwissRoundMovements(roundNum, boardsPerRound){
  const standings=calcSwissStandingsArray();
  const history=getSwissPairingHistory(getMovements());
  const matches=pairSwissMatches(standings,history);
  // pair 1 stays at table 1, North-South (every table plays the same boards, so only the table numbers change)
  const fixed=matches.findIndex(p=>p.includes('p1'));
  if(fixed>0)matches.unshift(matches.splice(fixed,1)[0]);
  const movements={};
  const boardStart=(roundNum-1)*boardsPerRound+1;
  const boardEnd=boardStart+boardsPerRound-1;
  matches.forEach((pair,idx)=>{
    const table=idx+1;
    const[a,b]=pair;
    // Alternate direction by round parity for rough NS/EW balance over the session.
    const ns=a==='p1'?a:b==='p1'?b:roundNum%2===1?a:b;
    const ew=ns===a?b:a;
    movements[roundNum+'_'+table]={ns,ew,boardStart,boardEnd};
  });
  return movements;
}

// Auto-trigger: called from checkRoundComplete() whenever it detects the
// current round is fully done. Idempotent — if the next round's pairing
// already exists, it does nothing, so it's safe to call from multiple
// clients/polling ticks without producing duplicate/conflicting pairings.
let _swissGenerating=false;
async function maybeAdvanceSwissRound(){
  const s=getState();
  if(s.movement!=='swiss'||s.status!=='running'||_swissGenerating)return;
  const boards=getBoards();const movements=getMovements();
  let total=0,done=0;
  for(let t=1;t<=s.tableCount;t++){
    const m=movements[s.currentRound+'_'+t]||{};
    for(let b=m.boardStart||1;b<=(m.boardEnd||3);b++){
      total++;
      if(boards[t+'_'+s.currentRound+'_'+b]?.status==='done')done++;
    }
  }
  const allDone=total>0&&done>=total;
  const nextR=s.currentRound+1;
  if(!allDone||nextR>s.roundCount)return;
  if(movements[nextR+'_1'])return; // already generated by someone else
  _swissGenerating=true;
  try{
    const nextMovements=generateSwissRoundMovements(nextR,s.boardsPerRound);
    await setMovements({...movements,...nextMovements});
    addLog('ok','Swiss pairing generated','Round '+nextR);
  }catch(e){ console.error('Swiss pairing generation failed',e); }
  _swissGenerating=false;
}

function getNextRoundInfo(tableNo,currentRound,state,movements,pairs){
  const nextR=currentRound+1;
  if(nextR>state.roundCount)return null;
  const m=movements[nextR+'_'+tableNo];
  if(!m)return null;
  const ns=pairs[m.ns]||{name:m.ns||'—',isPhantom:false};
  const ew=pairs[m.ew]||{name:m.ew||'—',isPhantom:false};
  return{round:nextR,table:tableNo,ns,ew,boardStart:m.boardStart,boardEnd:m.boardEnd};
}

// ══════════════════════════════════════════════════════
