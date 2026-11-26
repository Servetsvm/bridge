/* BridgePlay (new) — the movements (the same as the first BridgePlay's club program, kulupler/core.js): Mitchell, Howell, Barometer. */
function generateMitchell(tableCount, boardsPerRound, hasPhantom, totalBoards){
  // an odd number of pairs: one table more, its last East-West pair the phantom (who meets it sits out that round)
  const T=tableCount+(hasPhantom?1:0), movements={}, pairs={};
  for(let i=1;i<=T;i++) pairs['ns_'+i]={id:'ns_'+i,name:'NS '+i,dir:'NS',startTable:i,isPhantom:false};
  for(let i=1;i<=T;i++) pairs['ew_'+i]={id:'ew_'+i,name:'EW '+i,dir:'EW',startTable:i,isPhantom:false};
  if(hasPhantom) pairs['ew_'+T]={id:'ew_'+T,name:'Phantom',dir:'EW',startTable:T,isPhantom:true};
  // North-South stay, East-West move up a table, the boards down a table. With an even number of tables East-West would
  // meet boards they have played: after half the rounds they skip a table, and one round fewer is played (skip Mitchell)
  const even=T%2===0, rounds=even?T-1:T;
  for(let r=1;r<=rounds;r++){
    const skip=even&&r>T/2?1:0;
    for(let t=1;t<=T;t++){
      const ewIdx=((t-1+(r-1)+skip)%T)+1;
      const boardSet=((t-r)%T+T)%T;
      const boardStart=boardSet*boardsPerRound+1;
      movements[r+'_'+t]={ns:'ns_'+t,ew:'ew_'+ewIdx,boardStart,boardEnd:boardStart+boardsPerRound-1};
    }
  }
  return{movements,pairs,rounds,tableCount:T,totalBoards:T*boardsPerRound};
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
export { generateMitchell, generateHowell };
