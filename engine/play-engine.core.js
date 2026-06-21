/* Himkage Vision — Play Engine CORE (Phase 1)
 * Rules-driven blocking resolver + SVG renderer. Replaces the demo's hand-mapped PLAYS[].A.
 * Works in Node (render harness) and browser (play-engine.html). No CDN, no deps.
 *
 * Coordinate system (matches play-demo.html, the quality bar):
 *   viewBox 0 0 1000 720, LOS y=500, downfield = decreasing y, +x = playside/right.
 *   OL split = 46px. Technique shades are ~20px off the lineman. Strength built to the RIGHT,
 *   then mirrored about x=500 for a left-running (dir<0) play.
 */
(function (root) {
'use strict';
const LOS = 500, SPLIT = 46, CX = 500;
const COL = { blk:'#f4f4f4', mov:'#ff9a3c', wr:'#5ec8ff', car:'#ff3b3b' };
// kind -> {color, cap('T' block / 'A' arrow), win:[start,end]}  (verbatim from demo)
const K = {
  drive:{c:COL.blk,cap:'T',win:[0,.42]}, down:{c:COL.blk,cap:'T',win:[0,.42]},
  reach:{c:COL.blk,cap:'T',win:[0,.46]}, combo:{c:COL.blk,cap:'T',win:[0,.5]},
  hinge:{c:COL.blk,cap:'T',win:[.04,.5]}, kick:{c:COL.mov,cap:'T',win:[.06,.52]},
  pull:{c:COL.mov,cap:'T',win:[.05,.64]}, wrap:{c:COL.mov,cap:'T',win:[.08,.72]},
  lead:{c:COL.mov,cap:'T',win:[.1,.6]}, stalk:{c:COL.wr,cap:'T',win:[0,.5]},
  carry:{c:COL.car,cap:'A',win:[.16,1]},
  // coverage kinds (defender movement = arrowhead, house rule). deep/drop draw a zone bubble.
  deep:{c:'#ffd34d',cap:'A',win:[0,.7]}, drop:{c:'#ffd34d',cap:'A',win:[.02,.62]},
  man:{c:'#ff5ed2',cap:'A',win:[.02,.6],dash:'7 7'}, rush:{c:'#e8452f',cap:'A',win:[0,.5]},
  // pass game: routes cyan (receiver movement = arrowhead), pass sets white T-bars,
  // QB drop subtle gray, ball flight dashed red to the primary
  route:{c:COL.wr,cap:'A',win:[.06,.8]}, set:{c:COL.blk,cap:'T',win:[0,.38]},
  qbdrop:{c:'#bfc9da',cap:'A',win:[0,.32]}, ball:{c:COL.car,cap:'A',win:[.5,.9],dash:'3 9'},
  // option football: the second runner's path (QB keep / pitch back), orange arrowhead
  keep:{c:COL.mov,cap:'A',win:[.18,.85]},
  // pre-snap motion: runs before everything else, dashed receiver-cyan
  motion:{c:COL.wr,cap:'A',win:[0,.2],dash:'5 6'}
};

/* ---------------- Offensive formations (strength/playside = right) ----------------
 * Flat {id:{x,y}} maps like the demo. Factory fns return fresh objects (mirror-safe). */
const FORMATIONS = {
  'i-form-pro': () => ({
    LT:{x:408,y:LOS}, LG:{x:454,y:LOS}, C:{x:500,y:LOS}, RG:{x:546,y:LOS}, RT:{x:592,y:LOS},
    TE:{x:638,y:LOS}, QB:{x:500,y:542}, FB:{x:500,y:576}, RB:{x:500,y:616},
    X:{x:150,y:LOS}, Z:{x:850,y:LOS}
  }),
  // Shotgun, TE attached strong (right), RB offset weak, no FB. (Secondary; canonical = i-form-pro)
  'gun-te': () => ({
    LT:{x:408,y:LOS}, LG:{x:454,y:LOS}, C:{x:500,y:LOS}, RG:{x:546,y:LOS}, RT:{x:592,y:LOS},
    TE:{x:638,y:LOS}, QB:{x:500,y:566}, RB:{x:456,y:584},
    X:{x:150,y:LOS}, F:{x:260,y:516}, Z:{x:850,y:LOS}
  })
};

/* ---------------- Defensive fronts (strength = right) ----------------
 * role: 'DL' on the LOS, 'LB' off-ball/walked, 'DB' secondary. t = technique/label shown on token. */
const FRONTS = {
  '4-3-over': () => ({
    DEw:{x:392,y:462,t:'5',role:'DL'}, NT:{x:478,y:466,t:'1',role:'DL'},
    DT:{x:566,y:466,t:'3',role:'DL'}, DEs:{x:660,y:462,t:'5',role:'DL'},
    WILL:{x:422,y:408,t:'W',role:'LB'}, MIKE:{x:512,y:402,t:'M',role:'LB'}, SAM:{x:632,y:406,t:'S',role:'LB'},
    CBL:{x:165,y:452,t:'',role:'DB'}, CBR:{x:835,y:452,t:'',role:'DB'},
    FS:{x:480,y:318,t:'FS',role:'DB'}, SS:{x:642,y:344,t:'SS',role:'DB'}
  }),
  // 4-3 Under: line strength flips weak (3-tech weak B, 1-tech strong A), SAM walked to strong edge.
  '4-3-under': () => ({
    DEw:{x:392,y:462,t:'5',role:'DL'}, DT:{x:434,y:466,t:'3',role:'DL'},
    NT:{x:522,y:466,t:'1',role:'DL'}, DEs:{x:616,y:462,t:'5',role:'DL'},
    SAM:{x:678,y:446,t:'S',role:'LB'}, WILL:{x:452,y:406,t:'W',role:'LB'}, MIKE:{x:524,y:402,t:'M',role:'LB'},
    CBL:{x:165,y:452,t:'',role:'DB'}, CBR:{x:835,y:452,t:'',role:'DB'},
    FS:{x:470,y:318,t:'FS',role:'DB'}, SS:{x:648,y:344,t:'SS',role:'DB'}
  }),
  // Nickel Over (4-2-5): 4 down (2 ends + 2 tackles), 2 LB, nickel apex weak, 2-high.
  'nickel-over': () => ({
    RRE:{x:392,y:462,t:'5',role:'DL'}, RDT2:{x:478,y:466,t:'1',role:'DL'},
    RDT1:{x:566,y:466,t:'3',role:'DL'}, RLE:{x:660,y:462,t:'5',role:'DL'},
    SLB1:{x:512,y:404,t:'M',role:'LB'}, SLB2:{x:602,y:408,t:'B',role:'LB'},
    SLCB1:{x:330,y:430,t:'N',role:'LB'}, // nickel as weak overhang/box defender
    CBL:{x:165,y:452,t:'',role:'DB'}, CBR:{x:835,y:452,t:'',role:'DB'},
    FS:{x:452,y:316,t:'FS',role:'DB'}, SS:{x:600,y:322,t:'SS',role:'DB'}
  })
};

/* ---------------- Coverage shells (post-snap secondary movement) ----------------
 * Layered behind any front: role DL always rushes; LBs aligned on the line (y>=440,
 * walked edges + mugged gaps) rush with them; everyone else drops by the coverage spec.
 * Deep zones match by cost (close to the landmark + already deep = cheaper), man locks
 * use the same global nearest-first + order-preserving re-pair the stalks use, and
 * underneath zones distribute x-sorted onto the landmark set so drops never cross. */
const COVERAGES = {
  'cover-3': { display_name:'COVER 3 ZONE', term:'3 DEEP · 4 UNDER', family:'zone', deep:3, man:false }
};
const DEEP_Y = 272;
function underLandmarks(n){
  if(n<=0) return [];
  if(n===1) return [{x:500,y:396,n:'hook'}];
  if(n===2) return [{x:330,y:392,n:'curl'},{x:670,y:392,n:'curl'}];
  if(n===3) return [{x:250,y:424,n:'curl-flat'},{x:500,y:396,n:'hook'},{x:750,y:424,n:'curl-flat'}];
  if(n===4) return [{x:170,y:438,n:'flat'},{x:390,y:396,n:'hook'},{x:610,y:396,n:'hook'},{x:830,y:438,n:'flat'}];
  if(n===5) return [{x:150,y:440,n:'flat'},{x:330,y:390,n:'curl'},{x:500,y:396,n:'hook'},{x:670,y:390,n:'curl'},{x:850,y:440,n:'flat'}];
  const out=[]; for(let i=0;i<n;i++) out.push({x:30+940*(i+.5)/n, y:410, n:'under'}); return out;
}
function rushPath(D,OFF){ const q=OFF.QB||{x:500,y:560};
  const dx=q.x-D.x, dy=q.y-D.y, L=Math.hypot(dx,dy)||1, r=Math.min(58,L*.55);
  return [{x:D.x,y:D.y},{x:D.x+dx/L*r,y:D.y+dy/L*r}]; }
/* Deep-zone assignment, football rules: an OUTSIDE deep landmark (third/quarter near the
 * sideline) belongs to the widest available DB on that side (the corner bails); interior
 * landmarks go to the deepest remaining DBs, paired x-sorted so rotations never cross.
 * LBs only cap deep zones when the front doesn't carry enough DBs (goal line). */
function assignDeep(DEF, droppers, centers){
  const out={}, taken=new Set();
  const dbs = droppers.filter(id=>DEF[id].role==='DB');
  const pool = dbs.length>=centers.length ? dbs : droppers;
  centers.forEach((cx,ci)=>{
    if(cx-30>=165 && 970-cx>=165) return; // interior landmark
    const side = cx<500 ? 1 : -1;
    const cand = pool.filter(id=>!taken.has(id)).sort((a,b)=>side*(DEF[a].x-DEF[b].x))[0];
    if(cand){ out[ci]=cand; taken.add(cand); }
  });
  const remC = centers.map((cx,ci)=>({cx,ci})).filter(o=>out[o.ci]===undefined).sort((a,b)=>a.cx-b.cx);
  const remD = pool.filter(id=>!taken.has(id))
    .sort((a,b)=>DEF[a].y-DEF[b].y||Math.abs(DEF[a].x-500)-Math.abs(DEF[b].x-500))
    .slice(0,remC.length).sort((a,b)=>DEF[a].x-DEF[b].x);
  remC.forEach((o,i)=>{ if(remD[i]) out[o.ci]=remD[i]; });
  return out;
}
function resolveCoverage(OFF, DEF, spec){
  const C=[], ids=Object.keys(DEF);
  const rushers = ids.filter(id=>DEF[id].role==='DL' || (DEF[id].role==='LB' && DEF[id].y>=440));
  let droppers = ids.filter(id=>rushers.indexOf(id)<0);
  const nDeep = Math.min(spec.deep||0, droppers.length);
  const centers = (spec.deep_centers && spec.deep_centers.length===nDeep) ? spec.deep_centers
    : Array.from({length:nDeep},(_,i)=>30+940*(i+.5)/nDeep);
  const halfBand = nDeep ? 470/nDeep : 0;
  const deepBy = assignDeep(DEF, droppers, centers);
  const usedD = new Set(Object.keys(deepBy).map(ci=>deepBy[ci]));
  centers.forEach((cx,ci)=>{ const id=deepBy[ci]; if(id===undefined) return;
    C.push({id, kind:'deep', pts:[{x:DEF[id].x,y:DEF[id].y},{x:cx,y:DEEP_Y}],
            bubble:{x:cx,y:DEEP_Y-10,rx:Math.max(70,halfBand-10),ry:58}}); });
  droppers = droppers.filter(id=>!usedD.has(id));
  if(spec.man){
    // man: every dropper locks an eligible (any skill player; not OL, not QB)
    const elig = Object.keys(OFF).filter(id=>['LT','LG','C','RG','RT','QB'].indexOf(id)<0);
    const mp=[]; droppers.forEach(d=>elig.forEach(w=>mp.push([Math.abs(DEF[d].x-OFF[w].x)+.35*Math.abs(DEF[d].y-OFF[w].y), d, w])));
    mp.sort((a,b)=>a[0]-b[0]);
    const ud=new Set(), uw=new Set();
    for(const p of mp){ if(ud.has(p[1])||uw.has(p[2])) continue; ud.add(p[1]); uw.add(p[2]); }
    const md=[...ud].sort((a,b)=>DEF[a].x-DEF[b].x||DEF[a].y-DEF[b].y);
    const mw=[...uw].sort((a,b)=>OFF[a].x-OFF[b].x||OFF[a].y-OFF[b].y);
    md.forEach((d,i)=>{ const w=mw[i];
      C.push({id:d, kind:'man', pts:[{x:DEF[d].x,y:DEF[d].y},{x:OFF[w].x,y:OFF[w].y-26}], lock:w}); });
    let left = droppers.filter(d=>!ud.has(d));
    if(spec.hole && left.length){ const h=left.shift(); // leftover sits in the low hole
      C.push({id:h, kind:'drop', pts:[{x:DEF[h].x,y:DEF[h].y},{x:500,y:402}], bubble:{x:500,y:398,rx:64,ry:36}}); }
    left.forEach(d=>C.push({id:d, kind:'rush', pts:rushPath(DEF[d],OFF)})); // green-dog: nobody to cover, go
  } else {
    // underneath zones: x-sorted droppers onto the x-sorted landmark set (drops never cross)
    const lms = underLandmarks(droppers.length);
    droppers.slice().sort((a,b)=>DEF[a].x-DEF[b].x||DEF[a].y-DEF[b].y).forEach((d,i)=>{ const L=lms[i];
      C.push({id:d, kind:'drop', pts:[{x:DEF[d].x,y:DEF[d].y},{x:L.x,y:L.y}],
              bubble:{x:L.x,y:L.y-6,rx:L.n==='flat'?70:62,ry:34}}); });
  }
  rushers.forEach(d=>C.push({id:d, kind:'rush', pts:rushPath(DEF[d],OFF)}));
  return C;
}

/* ---------------- geometry helpers ---------------- */
function mirror(map){ const o={}; for(const id in map){ const e=map[id]; o[id]=Object.assign({},e,{x:1000-e.x}); } return o; }
function mirrorPts(pts){ return pts.map(p=>({x:1000-p.x,y:p.y})); }
const byPlayside = (a,b,dir)=> (b.x-a.x)*dir;       // descending => playside first
function listRole(DEF,role){ return Object.keys(DEF).filter(k=>DEF[k].role===role).map(id=>({id,x:DEF[id].x,y:DEF[id].y})); }
function olList(OFF){ const ids=['LT','LG','C','RG','RT']; if(OFF.TE) ids.push('TE'); return ids.map(id=>({id,x:OFF[id].x})); }

/* Extract front-relative roles for a given playside dir(+1 right / -1 left). */
function extractRoles(DEF, dir){
  const dls = listRole(DEF,'DL').sort((a,b)=>byPlayside(a,b,dir)); // playside-most first
  const lbs = listRole(DEF,'LB').sort((a,b)=>byPlayside(a,b,dir)); // playside-most first
  const nose = dls.slice().sort((a,b)=>Math.abs(a.x-CX)-Math.abs(b.x-CX))[0];
  const psEdge = dls[0], bsEdge = dls[dls.length-1];
  const interior = dls.filter(d=>d.id!==psEdge.id && d.id!==bsEdge.id);
  const psInterior = interior.filter(d=>(d.x-CX)*dir>0).sort((a,b)=>byPlayside(a,b,dir));
  // Force = widest playside LB who can actually set an edge (overhang / walked / apex,
  // clearly outside the box core). Mugged interior LBs are rushers, not force players;
  // if no LB qualifies, the playside edge DL is the de-facto force.
  const force = lbs.find(l => (l.x-CX)*dir >= 90) || psEdge;
  // Climb/wrap target: prefer an off-ball LB inside the box (excludes slot overhangs and
  // mugged-on-the-line LBs), then any box LB, then any non-force LB.
  const box = lbs.filter(l => l.id!==force.id && Math.abs(l.x-CX)<=160);
  const offBall = box.filter(l => l.y < 440);
  const psLBe = offBall[0] || box[0] || lbs.find(l=>l.id!==force.id) || lbs[0] || psEdge;
  // Backside climb target (odd fronts: the center has no second interior DL to drive)
  const bsList = (offBall.length?offBall:box).slice().reverse();
  const bsLBe = bsList.find(l=>l.id!==psLBe.id) || null;
  return {
    dls, lbs, nose: nose&&nose.id, psEdge: psEdge&&psEdge.id, bsEdge: bsEdge&&bsEdge.id,
    psInterior: psInterior.map(d=>d.id),
    forceDef: force.id,
    psLB: psLBe.id,
    bsLB: bsLBe && bsLBe.id
  };
}
function nearestLB(olx, lbs){ if(!lbs.length) return null; return lbs.slice().sort((a,b)=>Math.abs(a.x-olx)-Math.abs(b.x-olx))[0].id; }

/* Auto-stalk: every skill player not already blocking (and not OL/QB/FB/RB) stalks an
 * unclaimed DB within 260px. Pairing is global greedy nearest-first (not per-WR x-order),
 * so on trips/bunch surfaces the widest receiver keeps the corner and stalk paths don't
 * cross. Output sorted x-ascending, which preserves the regression-locked X->CBL, Z->CBR
 * order in classic 2-WR sets. Receivers with no DB in range stay put. */
function stalks(OFF,DEF,A){
  const used = new Set(['LT','LG','C','RG','RT','QB','FB','RB'].concat((A||[]).map(a=>a[0])));
  const claimed = new Set((A||[]).map(a=>a[1]));
  const wrs = Object.keys(OFF).filter(id=>!used.has(id));
  const dbs = Object.keys(DEF).filter(id=>DEF[id].role==='DB'&&!claimed.has(id));
  const pairs = [];
  for(const w of wrs) for(const d of dbs){
    const dist=Math.abs(DEF[d].x-OFF[w].x);
    if(dist<=260) pairs.push([dist,w,d]);
  }
  pairs.sort((a,b)=>a[0]-b[0] || OFF[a[1]].x-OFF[b[1]].x);
  const uw=new Set(), ud=new Set();
  for(const [,w,d] of pairs){
    if(uw.has(w)||ud.has(d)) continue;
    uw.add(w); ud.add(d);
  }
  // re-pair the matched sets order-preserving: on a line this minimizes the max distance
  // (so every pair stays inside the 260 window) and guarantees stalk paths never cross
  const mw=[...uw].sort((a,b)=>OFF[a].x-OFF[b].x || OFF[a].y-OFF[b].y); // stacked WRs: shallow first
  const md=[...ud].sort((a,b)=>DEF[a].x-DEF[b].x || DEF[a].y-DEF[b].y);
  return mw.map((w,i)=>[w, md[i], 'stalk']);
}

/* ---------------- scheme resolvers (playside dir; built strength-right => dir=+1) ---------------- */
/* blockAll: true = account for every DL (iso); 'read' = leave the BACKSIDE edge unblocked
 * (zone read); 'ps-read' = leave the PLAYSIDE edge unblocked (speed option pitch key). */
function resolveZone(OFF, DEF, scheme, blockAll){
  const dir=1, A=[];
  const R0 = extractRoles(DEF,1);
  const ols = olList(OFF).sort((a,b)=>byPlayside(a,b,dir)); // playside-most first
  let dls = listRole(DEF,'DL'); const lbs = listRole(DEF,'LB');
  if(blockAll==='read') dls = dls.filter(d=>d.id!==R0.bsEdge);
  if(blockAll==='ps-read') dls = dls.filter(d=>d.id!==R0.psEdge);
  const used = new Set(); const man = {};
  const coverK = scheme==='outside-zone' ? 'reach' : 'drive';
  // pass 1: covered = a DL head-up or in this lineman's playside gap
  for(const ol of ols){ let best=null,bd=1e9; for(const d of dls){ if(used.has(d.id))continue;
      const rel=(d.x-ol.x)*dir, hu=Math.abs(d.x-ol.x);
      if(hu<=16 || (rel>0&&rel<SPLIT)){ if(hu<bd){bd=hu;best=d;} } }
    if(best){ used.add(best.id); man[ol.id]=best.id; } }
  // pass 2: uncovered linemen take an unblocked DL in their BACKSIDE gap (cutoff); else they climb
  for(const ol of ols){ if(man[ol.id])continue; let bsd=null,bd=1e9; for(const d of dls){ if(used.has(d.id))continue;
      const rel=(d.x-ol.x)*dir, hu=Math.abs(d.x-ol.x);
      if(rel<0 && hu<SPLIT){ if(hu<bd){bd=hu;bsd=d;} } }
    if(bsd){ used.add(bsd.id); man[ol.id]=bsd.id; } }
  // pass 3: fan — any DL still unblocked gets the nearest unassigned lineman
  // (wide 7/9 techs and 5-man surfaces sit outside the gap windows). Without a TE
  // the playside edge stays free on purpose: he's the zone-read man.
  const R = R0;
  const skip = (OFF.TE || blockAll) ? null : R.psEdge;
  for(const d of dls){
    if(used.has(d.id) || d.id===skip) continue;
    let best=null,bd=1e9;
    for(const ol of ols){ if(man[ol.id]) continue;
      const dist=Math.abs(d.x-ol.x); if(dist<bd){bd=dist;best=ol;} }
    if(best){ used.add(d.id); man[best.id]=d.id; }
  }
  // emit: covered/cutoff = drive/reach; uncovered = combo & climb to nearest LB
  for(const ol of ols){
    if(man[ol.id]) A.push([ol.id, man[ol.id], coverK]);
    else A.push([ol.id, nearestLB(ol.x,lbs) || (lbs[0]&&lbs[0].id), 'combo']);
  }
  return A.concat(stalks(OFF,DEF,A));
}

function resolveGap(OFF, DEF, scheme){
  const dir=1, A=[]; const R=extractRoles(DEF,dir);
  const TE = OFF.TE?'TE':null;
  const psT='RT', psG='RG', bsT='LT', bsG='LG';
  // interior DLs (between the two edges), playside-first. 4-down fronts have 2 interiors
  // (the demo shape); odd/5-down fronts have 1 or 3, so the down-block ladder adapts:
  // each playside blocker takes the next interior DL inside, the last one drives or climbs.
  const interior = listRole(DEF,'DL').sort((a,b)=>byPlayside(a,b,dir)).filter(d=>d.id!==R.psEdge && d.id!==R.bsEdge).map(d=>d.id);
  const i0=interior[0]||R.nose, i1=interior[1], i2=interior[2];
  if(scheme==='power'){
    if(TE) A.push([TE, R.psEdge, 'down']); else A.push([psT, R.psEdge, 'down']);
    if(i2){ A.push([psT,i0,'down']); A.push([psG,i1,'down']); A.push(['C',i2,'drive']); }
    else if(i1){ A.push([psT,i0,'down']); A.push([psG,i0,'down']); A.push(['C',i1,'drive']); } // demo shape: double the POA DL
    else { A.push([psT,i0,'down']); A.push([psG,i0,'down']); A.push(['C', R.bsLB||i0, R.bsLB?'combo':'drive']); } // odd front: C climbs backside
    if(OFF.FB) A.push(['FB', R.forceDef, 'kick']);              // fullback kicks the force
    A.push([bsG, R.psLB, 'pull']);                              // backside guard pulls & wraps to the Mike
    A.push([bsT, R.bsEdge, 'hinge']);                           // backside tackle hinge
  } else { // counter (GT)
    if(TE) A.push([TE, R.psEdge, 'down']); else A.push([psT, R.psEdge, 'down']);
    if(i2){ A.push([psT,i0,'down']); A.push([psG,i1,'down']); A.push(['C',i2,'drive']);
      if(OFF.FB) A.push(['FB', R.bsEdge, 'hinge']); }           // 5-down: FB seals what the C can't reach
    else { A.push([psT,i0,'down']); A.push([psG, i1||i0, 'down']);
      A.push(['C', R.bsEdge, 'hinge']); }                       // center hinges the backside edge
    A.push([bsG, R.forceDef, 'kick']);                          // backside guard pulls to kick the force
    A.push([bsT, R.psLB, 'wrap']);                              // backside tackle pulls to wrap the Mike
    if(!i2 && OFF.FB && DEF.SS && DEF.SS.role==='DB' && DEF.SS.y<440 && DEF.SS.x>CX)
      A.push(['FB','SS','lead']);                               // fullback leads through the hole (box SS only)
  }
  return A.concat(stalks(OFF,DEF,A));
}

/* ---------------- run families beyond zone/power/counter ---------------- */
/* DUO: power without the puller. Vertical double teams at both interior DLs, TE seals the
 * edge, backside tackle hinges. Nobody blocks the Mike: the back reads him (so a free
 * playside LB here is the design, not a bust). */
function resolveDuo(OFF, DEF){
  const dir=1, A=[]; const R=extractRoles(DEF,dir);
  const TE=OFF.TE?'TE':null;
  const interior=listRole(DEF,'DL').sort((a,b)=>byPlayside(a,b,dir)).filter(d=>d.id!==R.psEdge&&d.id!==R.bsEdge).map(d=>d.id);
  const i0=interior[0]||R.nose, i1=interior[1], i2=interior[2];
  if(i2){ // 5-DL surface: no room for two doubles, down the line + one double on the last
    if(TE){ A.push([TE,R.psEdge,'down']); A.push(['RT',i0,'down']); A.push(['RG',i1,'down']);
      A.push(['C',i2,'combo']); A.push(['LG',i2,'combo']); }
    else { A.push(['RT',R.psEdge,'down']); A.push(['RG',i0,'down']); A.push(['C',i1,'down']);
      A.push(['LG',i2,'combo']); }
  } else if(i1){ // even front: the duo picture, two vertical doubles
    if(TE){ A.push([TE,R.psEdge,'down']); A.push(['RT',i0,'combo']); }
    else { A.push(['RT',R.psEdge,'down']); A.push(['RT',i0,'combo']); } // tackle doubles edge + POA
    A.push(['RG',i0,'combo']);
    A.push(['C',i1,'combo']); A.push(['LG',i1,'combo']);
  } else { // odd front: double the edge and the nose
    if(TE){ A.push([TE,R.psEdge,'combo']); A.push(['RT',R.psEdge,'combo']); }
    else A.push(['RT',R.psEdge,'down']);
    A.push(['RG',i0,'combo']); A.push(['C',i0,'combo']);
    A.push(['LG', R.bsLB||i0, R.bsLB?'combo':'drive']);
  }
  A.push(['LT',R.bsEdge,'hinge']);
  if(OFF.FB) A.push(['FB', R.psLB, 'lead']);
  return A.concat(stalks(OFF,DEF,A));
}
/* ISO: base man blocking (zone's covered/uncovered logic with everyone accounted for),
 * fullback isolates the playside LB. One-back versions are the quick dive. */
function resolveIso(OFF, DEF){
  const A = resolveZone(OFF, DEF, 'inside-zone', true);
  if(OFF.FB){ const R=extractRoles(DEF,1); A.push(['FB', R.psLB, 'lead']); }
  return A;
}
/* TRAP: invite the first playside DL upfield, backside guard pulls short and kicks him
 * inside-out. Remaining interior DLs are blocked back by the nearest free OL, leftovers
 * climb. No-TE trap leaves the playside edge free on purpose (the influence). */
function resolveTrap(OFF, DEF){
  const dir=1, A=[]; const R=extractRoles(DEF,dir);
  const TE=OFF.TE?'TE':null;
  const interior=listRole(DEF,'DL').sort((a,b)=>byPlayside(a,b,dir)).filter(d=>d.id!==R.psEdge&&d.id!==R.bsEdge).map(d=>d.id);
  const trapT = R.psInterior[0] || R.psEdge; // odd fronts long-trap the edge
  A.push(['LG', trapT, 'kick']);
  const pool=['RG','C','RT'];
  interior.filter(d=>d!==trapT).forEach(d=>{ if(!pool.length) return;
    pool.sort((a,b)=>Math.abs(OFF[a].x-DEF[d].x)-Math.abs(OFF[b].x-DEF[d].x));
    A.push([pool.shift(), d, 'down']); });
  const lbs=[R.psLB, R.bsLB].filter(Boolean);
  pool.forEach(ol=>{ const lb=lbs.shift(); A.push([ol, lb||R.bsEdge, lb?'combo':'hinge']); });
  if(TE && trapT!==R.psEdge) A.push([TE, R.psEdge, 'down']);
  else if(TE) A.push([TE, R.psLB, 'combo']);
  A.push(['LT', R.bsEdge, 'hinge']);
  if(OFF.FB) A.push(['FB', R.psLB, 'lead']);
  return A.concat(stalks(OFF,DEF,A));
}
/* DRAW: show pass. The line pass-sets (the same protection the dropback game uses) and
 * rides the rush upfield; the back delays and takes the vacated lane. */
function resolveDraw(OFF, DEF){
  const A = resolveProtection(OFF, DEF, []);
  if(OFF.TE){ // 6-man protection: the TE takes the nearest leftover rusher, else chips the edge
    const ud=new Set(A.map(a=>a[1]));
    const rushers=Object.keys(DEF).filter(id=>DEF[id].role==='DL'||(DEF[id].role==='LB'&&DEF[id].y>=440));
    const free=rushers.filter(d=>!ud.has(d)).sort((a,b)=>Math.abs(DEF[a].x-OFF.TE.x)-Math.abs(DEF[b].x-OFF.TE.x));
    const R=extractRoles(DEF,1);
    A.push(['TE', free[0]||R.psEdge, 'set']);
  }
  if(OFF.FB){ const R=extractRoles(DEF,1); A.push(['FB', R.psLB, 'lead']); }
  return A.concat(stalks(OFF,DEF,A));
}
/* TOSS (pin & pull): playside pins down, the playside guard pulls for the force and the
 * center wraps to the first backer. Backside reaches inside-out; with both pullers gone
 * the backside edge (and on 5-DL no-TE surfaces the last interior DL) stays free, the
 * toss runs away from them. */
function resolveToss(OFF, DEF){
  const dir=1, A=[]; const R=extractRoles(DEF,dir);
  const TE=OFF.TE?'TE':null;
  const interior=listRole(DEF,'DL').sort((a,b)=>byPlayside(a,b,dir)).filter(d=>d.id!==R.psEdge&&d.id!==R.bsEdge).map(d=>d.id);
  if(TE) A.push([TE,R.psEdge,'down']); else A.push(['RT',R.psEdge,'reach']);
  A.push(['RG', R.forceDef, 'pull']);
  A.push(['C', R.psLB, 'pull']);
  const pool = TE ? ['RT','LG','LT'] : ['LG','LT'];
  interior.forEach(d=>{ if(!pool.length) return;
    pool.sort((a,b)=>Math.abs(OFF[a].x-DEF[d].x)-Math.abs(OFF[b].x-DEF[d].x));
    A.push([pool.shift(), d, 'down']); });
  if(pool.length){
    const jobs=[[R.bsEdge,'hinge'],[R.bsLB,'combo']].filter(j=>j[0]);
    pool.sort((a,b)=>OFF[a].x-OFF[b].x); // backside-most takes the hinge
    pool.forEach(ol=>{ const j=jobs.shift();
      A.push(j ? [ol, j[0], j[1]] : [ol, R.psLB, 'combo']); }); // light boxes: climb to the wrap point
  }
  if(OFF.FB) A.push(['FB', R.forceDef, 'lead']); // escort: lead through with the kick
  return A.concat(stalks(OFF,DEF,A));
}

/* POWER READ: power blocking with the kick stripped — the force defender stays unblocked
 * and gets read by the QB while the sweep stretches him. */
function resolvePowerRead(OFF, DEF){
  const R=extractRoles(DEF,1);
  const A = resolveGap(OFF,DEF,'power').filter(a=>a[2]!=='kick');
  if(OFF.FB) A.push(['FB', R.psLB, 'lead']); // escort through behind the puller
  return A;
}

/* ball-carrier path, auto-derived from scheme + aiming point (strength-right).
 * A (the resolved assignments) tells us whether the force got kicked: if nobody kicks
 * (one-back gap run), the lane stays tight and vertical off the double team instead of
 * bouncing outward into the unblocked force defender. */
function deriveCarry(OFF, scheme, A, DEF){
  const RB=OFF.RB||OFF.QB; const dir=1; // empty sets: the playbook's empty runs are QB runs
  const gun = !OFF.FB;                          // offset back, mesh in front of the QB
  const kicked = (A||[]).some(a=>a[2]==='kick');
  // option carries need the read man's position
  if(scheme==='speed-option' && DEF){ // QB attacks the unblocked pitch key's shoulder
    const q=OFF.QB, e=DEF[extractRoles(DEF,1).psEdge];
    return [ {x:q.x,y:q.y}, {x:q.x+46,y:q.y}, {x:e.x+6,y:488}, {x:e.x+40,y:436}, {x:e.x+74,y:366} ];
  }
  if(scheme==='power-read'){ // sweep path: stretch the force while the QB reads him
    const q=OFF.QB, edge=(OFF.TE?OFF.TE.x:OFF.RT.x), aim=Math.min(920, edge+120);
    return [ {x:RB.x,y:RB.y}, {x:q.x+10,y:q.y-6}, {x:aim-60,y:516}, {x:aim,y:472}, {x:aim+30,y:400} ];
  }
  const aim = {
    'inside-zone': CX + 23*dir,                 // playside A gap
    'outside-zone': (OFF.TE?OFF.TE.x:OFF.RT.x) + 26*dir, // off the edge
    'power': CX + 69*dir,                        // playside B gap
    'counter': CX + 69*dir,
    'duo': CX + 46*dir,                          // B gap, vertical off the doubles
    'iso': CX + 23*dir,                          // A gap behind the lead block
    'trap': CX + 34*dir,                         // tight behind the trap
    'draw': CX + 18*dir,                         // up the vacated middle
    'toss': Math.min(910, (OFF.TE?OFF.TE.x:OFF.RT.x) + 96)*dir, // wide, win the corner
    'read-option': CX + 23*dir                   // the give: standard inside-zone track
  }[scheme];
  // downhill one-cut families: quick mesh, then straight north
  if(scheme==='duo'||scheme==='iso'||scheme==='trap'||scheme==='draw'){
    const pts=[{x:RB.x,y:RB.y}];
    if(scheme==='draw') pts.push({x:(RB.x+OFF.QB.x)/2, y:Math.max(RB.y,OFF.QB.y)+6}); // hesitate, then go
    else pts.push(gun?{x:OFF.QB.x-4*dir,y:OFF.QB.y-8}:{x:RB.x+10*dir,y:560});
    pts.push({x:aim,y:500},{x:aim+8*dir,y:426},{x:aim+18*dir,y:328});
    return pts;
  }
  if(scheme==='toss'){
    const arcY = gun ? RB.y+4 : 578;
    return [ {x:RB.x,y:RB.y}, {x:RB.x+64*dir,y:arcY},
             {x:aim-50*dir,y:520}, {x:aim,y:468}, {x:aim+28*dir,y:376} ];
  }
  // gap runs without a kick block finish vertical, inside the unblocked force
  const d1 = (scheme==='power'&&!kicked) ? 5 : (scheme==='outside-zone'?30:16);
  const d2 = (scheme==='power'&&!kicked) ? 12 : 40;
  if(scheme==='counter'){
    const meshY = gun ? OFF.QB.y-8 : 558;
    return [ {x:RB.x,y:RB.y}, {x:RB.x-30*dir,y:RB.y-12}, {x:RB.x+44*dir,y:meshY},
             {x:aim,y:500}, {x:aim+16*dir,y:424}, {x:aim+40*dir,y:326} ];
  }
  const lateral = scheme==='outside-zone'?60:40;
  const second = gun ? {x:OFF.QB.x-4*dir, y:OFF.QB.y-8} : {x:RB.x+lateral*dir, y:560};
  const pts = [ {x:RB.x,y:RB.y}, second ];
  if(gun && scheme==='outside-zone') pts.push({x:(second.x+aim)/2, y:528}); // smooth the stretch arc
  pts.push({x:aim,y:500}, {x:aim+d1*dir,y:426}, {x:aim+d2*dir,y:328});
  return pts;
}

/* ---------------- Pass game: route shapes + concepts ----------------
 * Route local frame: dx = px toward the receiver's sideline (negative = toward the middle),
 * dy = px downfield. Full library lives in data/routes.json + data/concepts.json (hydrated
 * below); minimal fallback inline so the engine runs without play-data.js. */
const ROUTES = {
  go:{pts:[{dx:6,dy:52},{dx:10,dy:248}]}, seam:{pts:[{dx:0,dy:248}]},
  bender:{pts:[{dx:0,dy:110},{dx:-34,dy:228}]}, sit:{pts:[{dx:0,dy:44}]},
  'check-release':{pts:[{dx:54,dy:-8},{dx:96,dy:14}]}
};
const CONCEPTS = {
  'four-verticals': { display_name:'FOUR VERTICALS', term:'4 VERT · STRETCH THE DEEP THIRDS', drop:'7',
    ps:['go','*seam','?bender'], bs:['go','?seam','bender'], rb:'check-release', fill:'sit',
    desc:'Four receivers stretch the deep coverage vertically.' }
};

/* Receiver slots: ps = strength-side (right) receivers OUTSIDE-IN, bs = backside OUTSIDE-IN,
 * backs = backfield (y>=560) deepest-first. Concepts assign routes by slot order. */
function passSlots(OFF){
  const skill = Object.keys(OFF).filter(id=>['LT','LG','C','RG','RT','QB'].indexOf(id)<0);
  const backs = skill.filter(id=>OFF[id].y>=560).sort((a,b)=>OFF[b].y-OFF[a].y);
  const rcv = skill.filter(id=>OFF[id].y<560);
  return {
    ps: rcv.filter(id=>OFF[id].x>=CX).sort((a,b)=>OFF[b].x-OFF[a].x),
    bs: rcv.filter(id=>OFF[id].x<CX).sort((a,b)=>OFF[a].x-OFF[b].x),
    backs
  };
}
/* Fit a concept's route list to the side's receiver count: '?'-prefixed entries drop first
 * (innermost-first), then drop from the END, so the concept's core routes survive thin sides. */
function fitRoutes(arr, n){
  const L=(arr||[]).slice();
  while(L.length>n){
    let idx=-1; for(let j=L.length-1;j>=0;j--) if(L[j][0]==='?'){ idx=j; break; }
    if(idx>=0) L.splice(idx,1); else L.pop();
  }
  return L;
}
function routePts(P, key, s){
  const r=ROUTES[key]; if(!r) return null;
  const pts=[{x:P.x,y:P.y}];
  r.pts.forEach(w=>pts.push({ x:Math.max(40,Math.min(960,P.x+s*w.dx)), y:Math.max(44,Math.min(700,P.y-w.dy)) }));
  return pts;
}
function qbDrop(OFF, depth){
  const q=OFF.QB, gun=q.y>545;
  const d = depth==='quick' ? (gun?10:34) : depth==='7' ? (gun?34:80) : (gun?22:62);
  return [{x:q.x,y:q.y},{x:q.x,y:Math.min(700,q.y+d)}];
}
/* BOB protection: OL pair the most dangerous rushers (global nearest-first then
 * order-preserving by x, the stalks algorithm); uncovered OL double the nearest blocked
 * rusher; blocking backs scan the leftovers nearest them; anything left stays hot
 * (its red rush arrow tells the story). */
function resolveProtection(OFF, DEF, backsInPro){
  const A=[];
  const rushers=Object.keys(DEF)
    .filter(id=>DEF[id].role==='DL'||(DEF[id].role==='LB'&&DEF[id].y>=440));
  const ols=['LT','LG','C','RG','RT'].filter(id=>OFF[id]);
  const pairs=[]; ols.forEach(o=>rushers.forEach(d=>pairs.push([Math.abs(OFF[o].x-DEF[d].x),o,d])));
  pairs.sort((a,b)=>a[0]-b[0]);
  const uo=new Set(), ud=new Set();
  for(const p of pairs){ if(uo.has(p[1])||ud.has(p[2]))continue; uo.add(p[1]); ud.add(p[2]); }
  const mo=[...uo].sort((a,b)=>OFF[a].x-OFF[b].x);
  const md=[...ud].sort((a,b)=>DEF[a].x-DEF[b].x);
  mo.forEach((o,i)=>A.push([o,md[i],'set']));
  ols.filter(o=>!uo.has(o)).forEach(o=>{
    const d=md.slice().sort((a,b)=>Math.abs(DEF[a].x-OFF[o].x)-Math.abs(DEF[b].x-OFF[o].x))[0];
    if(d) A.push([o,d,'set']);
  });
  const free=rushers.filter(d=>!ud.has(d));
  backsInPro.forEach(rb=>{
    if(!free.length) return;
    free.sort((a,b)=>Math.abs(DEF[a].x-OFF[rb].x)-Math.abs(DEF[b].x-OFF[rb].x));
    A.push([rb, free.shift(), 'set']);
  });
  return A;
}
function resolvePass(formKey, frontKey, conceptKey, dir, covKey){
  dir = dir<0?-1:1;
  const OFF=(FORMATIONS[formKey]||FORMATIONS['i-form-pro'])();
  const DEF=(FRONTS[frontKey]||FRONTS['4-3-over'])();
  const spec=CONCEPTS[conceptKey]||CONCEPTS['four-verticals'];
  const slots=passSlots(OFF);
  const R=[], blockers=[], stalkers=[];
  let primary=null;
  const give=(id, raw)=>{
    let key=raw, prim=false;
    if(key[0]==='*'){ prim=true; key=key.slice(1); }
    if(key[0]==='?') key=key.slice(1);
    if(key==='block'){ blockers.push(id); return; }
    if(key==='stalk'){ stalkers.push(id); return; }
    const pts=routePts(OFF[id], key, OFF[id].x>=CX?1:-1); if(!pts) return;
    const ent={id, route:key, pts};
    R.push(ent); if(prim) primary=ent;
  };
  const side=(ids, arr)=>{ const fit=fitRoutes(arr, ids.length);
    ids.forEach((id,i)=>give(id, fit[i]!==undefined?fit[i]:(spec.fill||'sit'))); };
  side(slots.ps, spec.ps); side(slots.bs, spec.bs);
  const barr=[spec.rb||'block', spec.rb2||'block'];
  slots.backs.forEach((id,i)=>give(id, barr[i]!==undefined?barr[i]:'block'));
  // protection + stalk blocks (screens)
  const A=resolveProtection(OFF,DEF,blockers);
  const claimed=new Set(A.map(a=>a[1]));
  stalkers.forEach(w=>{ let best=null,bd=261;
    Object.keys(DEF).forEach(d=>{ if(DEF[d].role!=='DB'||claimed.has(d))return;
      const dist=Math.abs(DEF[d].x-OFF[w].x); if(dist<bd){bd=dist;best=d;} });
    if(best){ claimed.add(best); A.push([w,best,'stalk']); } });
  // QB drop + ball flight to the primary's break point
  let drop=qbDrop(OFF, spec.drop||'5');
  let ball=null;
  if(primary){ const end=primary.pts[primary.pts.length-1];
    ball=[{x:drop[1].x,y:drop[1].y},{x:end.x,y:end.y}]; }
  // coverage: blocked defenders keep their engagement; man defenders trail their man's route
  let C=null;
  if(covKey && COVERAGES[covKey]){
    const targets=new Set(A.map(a=>a[1]));
    C=resolveCoverage(OFF,DEF,COVERAGES[covKey]).filter(c=>!targets.has(c.id));
    const routeBy={}; R.forEach(r=>routeBy[r.id]=r);
    C.forEach(c=>{ const r=c.kind==='man'&&routeBy[c.lock]; if(!r) return;
      const end=r.pts[r.pts.length-1], prev=r.pts[r.pts.length-2]||end;
      const a2=Math.atan2(end.y-prev.y,end.x-prev.x);
      const tp={x:end.x-26*Math.cos(a2), y:end.y-26*Math.sin(a2)};
      const mid=r.pts.length>2?{x:r.pts[1].x,y:r.pts[1].y+22}:null;
      c.pts=[c.pts[0]].concat(mid?[mid]:[]).concat([tp]);
    });
  }
  let off=OFF, def=DEF, Rm=R;
  if(dir<0){ off=mirror(OFF); def=mirror(DEF);
    Rm=R.map(r=>Object.assign({},r,{pts:mirrorPts(r.pts)}));
    drop=mirrorPts(drop); if(ball) ball=mirrorPts(ball);
    if(C) C=C.map(mirrorCov);
  }
  return { key:conceptKey, kind:'pass', name:spec.display_name||conceptKey, term:spec.term||'',
           desc:spec.desc||'', A, R:Rm, C, drop, ball, carry:null,
           OFF:off, DEF:def, dir, formKey, frontKey, coverage:covKey||null,
           primary:primary&&primary.id };
}

/* classify a playbook pass-play NAME (+ its PASS/RPO type tag) into a concept key.
 * Rules fire in order: structural concepts (screens, mesh, verts) before single-route
 * fallbacks (corner, curl), so "Mesh Spot" lands on mesh and "Bench Dig Curl" on bench. */
const PASS_RULES=[
  [/screen/i, n=>/\b(hb|rb|f|halfback)\b.*screen|screen.*\b(hb|rb)\b/i.test(n)?'hb-screen':'wr-screen'],
  [/bubble|tunnel/i, 'wr-screen'],
  [/mesh/i, 'mesh'], [/vert/i, 'four-verticals'], [/switch/i, 'switch'],
  [/dagger/i, 'dagger'], [/mills/i, 'mills'], [/scissors/i, 'scissors'],
  [/wheel/i, 'post-wheel'], [/texas|angle/i, 'texas'],
  [/levels/i, 'levels'], [/bench/i, 'bench'],
  [/flood|sail/i, 'flood'], [/smash/i, 'smash'],
  [/stick/i, 'stick'], [/snag|spot/i, 'snag'], [/spacing/i, 'spacing'],
  [/drive|trail|follow/i, 'drive'], [/shallow|cross|under|drag/i, 'shallow-cross'],
  [/whip|return|pivot/i, 'whips'], [/fade/i, 'fade-out'],
  [/jet|touch pass/i, 'wr-screen'],                       // jet-motion touch passes: quick flip behind the line
  [/\bpa\b.*(read|zone|stretch|counter|power)/i, 'rpo-slant'], // run-action pop passes: run look, quick throw
  [/circle/i, 'texas'], [/swing/i, 'hb-screen'],
  [/poco/i, 'corner-flat'], [/fork|attack/i, 'dagger'],
  [/slide/i, 'spacing'], [/shot|swirl/i, 'mills'], [/\bins?\b/i, 'levels'],
  // playbook call names with no structural token, classified from their card art:
  // Escape = crossers + intermediate in (p55), Salem = seam/deep-out sail (p119), Shock = quick in-breakers (p127)
  [/escape/i, 'shallow-cross'], [/salem/i, 'flood'], [/shock/i, 'slants'],
  [/slant/i, 'slants'], [/curl|hitch/i, 'curls'],
  [/corner|china/i, 'corner-flat'], [/post/i, 'mills'],
  [/comeback|\bout(s)?\b/i, 'bench'], [/seam|shake|go\b/i, 'four-verticals'],
  [/option|choice/i, 'stick'], [/boot|waggle|roll/i, 'flood'], [/dig/i, 'dagger']
];
function classifyPass(name, type){
  const n=String(name||'');
  if(type==='RPO') return /bubble|screen/i.test(n) ? 'rpo-bubble' : 'rpo-slant';
  for(const [re, to] of PASS_RULES){
    if(re.test(n)) return typeof to==='function' ? to(n) : to;
  }
  return 'curls';
}

const NAMES = {
  'inside-zone':['INSIDE ZONE','BANG · BEND · BOUNCE','Zone: covered drive, uncovered combo & climb. Back reads bang-bend-bounce.'],
  'outside-zone':['OUTSIDE ZONE','REACH · PRESS · BOUNCE','Stretch: reach playside, press the edge, bend-bang-bounce off the tackle block.'],
  'power':['POWER O','DOWN · DOUBLE · KICK · PULL','Playside down-blocks + double, fullback kicks the force, backside guard pulls to the Mike.'],
  'counter':['COUNTER (GT)','TWO PULLERS: G KICKS · T WRAPS','Playside down-blocks; backside guard kicks the edge, backside tackle wraps the Mike. Back counter-steps.'],
  'duo':['DUO','DOUBLE TEAMS · READ THE MIKE','Two double teams move the line, no pullers. The back reads the Mike and hits the crease.'],
  'iso':['ISO','BASE BLOCKS · LEAD AT THE BACKER','Man blocking across the front, fullback isolates the playside backer, back follows him downhill.'],
  'trap':['TRAP','INFLUENCE · TRAP THE FIRST DL INSIDE','The line blocks down and invites penetration, then the backside guard traps the first defender past center.'],
  'draw':['DRAW','SHOW PASS · RUN LATE','The line sets like a pass to invite the rush upfield, then the back takes it downhill through the vacated lane.'],
  'toss':['TOSS','PIN & PULL · GET THE EDGE','Playside pins down, guard and center pull around, the back takes the pitch and outruns the box.'],
  'read-option':['READ OPTION','GIVE OR KEEP · READ THE BACKSIDE END','Zone blocking with the backside end unblocked. He crashes, the QB keeps; he sits, the back gets it.'],
  'speed-option':['SPEED OPTION','PITCH OFF THE EDGE','Nobody blocks the pitch key. The QB attacks his shoulder and pitches off his answer; the back keeps the relation.'],
  'power-read':['POWER READ','SWEEP OR KEEP · READ THE FORCE','Power blocking with the force unblocked. The sweep stretches him; if he runs with it the QB pulls and hits the B gap.']
};

/* classify a playbook RUN-play name into {scheme, motion, weak}. Structural families fire
 * before single-token fallbacks; motion prefixes (Jet/Orbit/Mtn/Reload/Escort) stack on top. */
const RUN_RULES=[
  [/trap/i,'trap'], [/draw/i,'draw'],
  [/power read|inverted veer/i,'power-read'],
  [/toss|sweep/i,'toss'],
  [/duo/i,'duo'],
  [/blast|iso|dive|punch|base\b/i,'iso'],
  [/speed option|triple/i,'speed-option'],
  [/read|option|veer|midline/i,'read-option'],
  [/counter/i,'counter'],
  [/wrap|direct snap|power/i,'power'],
  [/stretch|outside zone|wide zone/i,'outside-zone'],
  [/zone|gut|inside/i,'inside-zone'],
  [/lead/i,'iso']
];
function classifyRun(name){
  const n=String(name||'');
  const motion = /jet/i.test(n) ? 'jet' : /orbit/i.test(n) ? 'orbit'
    : /mtn|reload|escort|sft/i.test(n) ? 'across' : null;
  const weak = /\bwk\b|weak/i.test(n);
  for(const [re, to] of RUN_RULES) if(re.test(n)) return {scheme:to, motion, weak};
  return {scheme:'inside-zone', motion, weak};
}

/* ---------------- data hydration (shared corpus) ----------------
 * data/*.json (via generated play-data.js) is the source of truth shared with the Discord bot.
 * The inline maps above stay as fallback: no play-data.js, engine still runs. */
(function hydrate(){
  let D = root.PlayData;
  if(!D && typeof module!=='undefined' && typeof require!=='undefined'){
    try { D = require('./play-data.js'); } catch(e) {}
  }
  if(!D) return;
  const factory = obj => () => JSON.parse(JSON.stringify(obj));
  if(D.formations) for(const k in D.formations) FORMATIONS[k] = factory(D.formations[k].players);
  if(D.fronts) for(const k in D.fronts) FRONTS[k] = factory(D.fronts[k].players);
  if(D.schemes) for(const k in D.schemes){ const s=D.schemes[k]; NAMES[k] = [s.name, s.term, s.desc]; }
  if(D.coverages) for(const k in D.coverages) COVERAGES[k] = D.coverages[k];
  if(D.routes) for(const k in D.routes) ROUTES[k] = D.routes[k];
  if(D.concepts) for(const k in D.concepts) CONCEPTS[k] = D.concepts[k];
})();

/* ---------------- public: resolve a full play ---------------- */
function mirrorCov(c){ const o=Object.assign({},c,{pts:mirrorPts(c.pts)});
  if(c.bubble) o.bubble=Object.assign({},c.bubble,{x:1000-c.bubble.x}); return o; }
/* pick the motion man: prefer a backside (left, pre-mirror) off-LOS receiver nearest the
 * core, then any backside receiver, then the innermost playside slot. Backs never motion. */
function pickMotionMan(OFF){
  const skill = Object.keys(OFF).filter(id=>['LT','LG','C','RG','RT','QB'].indexOf(id)<0 && OFF[id].y<560);
  if(!skill.length) return null;
  const score = id => (OFF[id].x<CX?0:1000) + (OFF[id].y>500?0:200) + Math.abs(OFF[id].x-CX);
  return skill.sort((a,b)=>score(a)-score(b))[0];
}
function motionPath(OFF, mw, motion){
  const w=OFF[mw], q=OFF.QB;
  if(motion==='jet')   return [ {x:w.x,y:w.y}, {x:(w.x+q.x)/2,y:q.y-2}, {x:Math.min(940,CX+150),y:q.y-6} ];
  if(motion==='orbit') return [ {x:w.x,y:w.y}, {x:q.x,y:q.y+26}, {x:q.x+(w.x<CX?110:-110),y:q.y+14} ];
  return [ {x:w.x,y:w.y}, {x:CX,y:520}, {x:Math.max(60,Math.min(940,2*CX-w.x)),y:Math.min(540,w.y+6)} ]; // across
}
function resolvePlay(formKey, frontKey, scheme, dir, covKey, motion){
  dir = dir<0 ? -1 : 1;
  const OFF = (FORMATIONS[formKey]||FORMATIONS['i-form-pro'])();
  const DEF = (FRONTS[frontKey]||FRONTS['4-3-over'])();
  const zone = (scheme==='inside-zone'||scheme==='outside-zone');
  let A = zone ? resolveZone(OFF,DEF,scheme)
        : scheme==='duo'  ? resolveDuo(OFF,DEF)
        : scheme==='iso'  ? resolveIso(OFF,DEF)
        : scheme==='trap' ? resolveTrap(OFF,DEF)
        : scheme==='draw' ? resolveDraw(OFF,DEF)
        : scheme==='toss' ? resolveToss(OFF,DEF)
        : scheme==='read-option'  ? resolveZone(OFF,DEF,'inside-zone','read')
        : scheme==='speed-option' ? resolveZone(OFF,DEF,'outside-zone','ps-read')
        : scheme==='power-read'   ? resolvePowerRead(OFF,DEF)
        : resolveGap(OFF,DEF,scheme);
  let carry = deriveCarry(OFF,scheme,A,DEF);
  let ball = null;
  if(scheme==='toss') ball=[{x:OFF.QB.x,y:OFF.QB.y},{x:carry[1].x,y:carry[1].y}]; // the pitch
  // option football: the second runner's path (X ents), and who actually carries
  let X = null, carrier = null;
  if(scheme==='read-option'){
    const e = DEF[extractRoles(DEF,1).bsEdge];
    X=[{owner:'QB',kind:'keep',pts:[{x:OFF.QB.x,y:OFF.QB.y},{x:OFF.QB.x-40,y:OFF.QB.y-4},{x:e.x-22,y:470},{x:e.x-42,y:404}]}];
  } else if(scheme==='speed-option'){
    carrier='QB';
    if(OFF.RB){ const e = DEF[extractRoles(DEF,1).psEdge];
      X=[{owner:'RB',kind:'keep',pts:[{x:OFF.RB.x,y:OFF.RB.y},{x:OFF.RB.x+86,y:OFF.RB.y+8},{x:Math.min(944,e.x+120),y:494},{x:Math.min(950,e.x+152),y:436}]}];
      ball=[{x:e.x+6,y:488},{x:Math.min(944,e.x+118),y:496}]; // the pitch relationship
    }
  } else if(scheme==='power-read'){
    X=[{owner:'QB',kind:'keep',pts:[{x:OFF.QB.x,y:OFF.QB.y},{x:CX+52,y:500},{x:CX+64,y:432},{x:CX+82,y:356}]}];
  }
  // pre-snap motion layer: jet / orbit / across. The motion man gives up any stalk job.
  if(motion){
    const mw = pickMotionMan(OFF);
    if(mw){
      A = A.filter(a=>!(a[0]===mw && a[2]==='stalk'));
      X = (X||[]).concat([{owner:mw, kind:'motion', pts:motionPath(OFF,mw,motion)}]);
    }
  }
  // optional coverage layer: defenders already engaged by a block keep that engagement
  let C = null;
  if(covKey && COVERAGES[covKey]){
    const targets = new Set(A.map(a=>a[1]));
    C = resolveCoverage(OFF,DEF,COVERAGES[covKey]).filter(c=>!targets.has(c.id));
  }
  let off=OFF, def=DEF;
  if(dir<0){ off=mirror(OFF); def=mirror(DEF); carry=mirrorPts(carry);
    if(ball) ball=mirrorPts(ball); if(C) C=C.map(mirrorCov);
    if(X) X=X.map(e=>Object.assign({},e,{pts:mirrorPts(e.pts)})); }
  const [name,term,desc]=NAMES[scheme];
  return { key:scheme, name, term, desc, A, C, X, carry, carrier, ball,
           OFF:off, DEF:def, dir, formKey, frontKey, coverage:covKey||null, motion:motion||null };
}

/* shell-only board: no offensive assignments, the defense shows its coverage rotation */
function resolveShell(formKey, frontKey, covKey, dir){
  dir = dir<0 ? -1 : 1;
  const OFF = (FORMATIONS[formKey]||FORMATIONS['i-form-pro'])();
  const DEF = (FRONTS[frontKey]||FRONTS['4-3-over'])();
  const spec = COVERAGES[covKey]||COVERAGES['cover-3'];
  let C = resolveCoverage(OFF,DEF,spec);
  let off=OFF, def=DEF;
  if(dir<0){ off=mirror(OFF); def=mirror(DEF); C=C.map(mirrorCov); }
  return { key:covKey, name:spec.display_name||covKey, term:spec.term||'', desc:spec.rules||'',
           A:[], C, carry:null, OFF:off, DEF:def, dir, formKey, frontKey, coverage:covKey };
}

/* ---------------- geometry build (ents + defender drive) — adapted from demo ---------------- */
function pullPath(o,d){ const s=d.x>o.x?1:-1; return [{x:o.x,y:o.y},{x:o.x+60*s,y:o.y+40},{x:(o.x+d.x)/2+30*s,y:o.y+18},{x:d.x,y:d.y}]; }
function leadPath(o,d){ return [{x:o.x,y:o.y},{x:(o.x+d.x)/2,y:(o.y+d.y)/2+20},{x:d.x,y:d.y}]; }
/* pass set: meet the rusher at his intercept point toward the QB (blocker retreats into it) */
function setPath(o,d,q){ const ix=d.x+(q.x-d.x)*.42, iy=d.y+(q.y-d.y)*.42;
  return [{x:o.x,y:o.y},{x:(o.x+ix)/2,y:(o.y+iy)/2+10},{x:ix,y:iy}]; }
function buildModel(m){
  const OFF=m.OFF, DEF=m.DEF, ents=[], driveAcc={};
  m.A.forEach(([o,d,kind])=>{
    const O=OFF[o], D=DEF[d]; if(!O||!D) return; const spec=K[kind]||K.drive;
    let pts;
    if(kind==='pull'||kind==='wrap'||kind==='kick') pts=pullPath(O,D);
    else if(kind==='lead') pts=leadPath(O,D);
    else if(kind==='set') pts=setPath(O,D,OFF.QB||{x:500,y:566});
    else pts=[{x:O.x,y:O.y},{x:D.x,y:D.y}];
    ents.push({owner:o,pts,color:spec.c,cap:spec.cap,win:spec.win,kind});
    // pass sets: the rusher comes downhill INTO the block (toward the QB), not away from it
    const q=OFF.QB||{x:500,y:566};
    const a=(kind==='set')?Math.atan2(q.y-D.y,q.x-D.x):Math.atan2(D.y-O.y,D.x-O.x);
    const mag=(kind==='stalk')?8:(kind==='set')?9:(kind==='pull'||kind==='wrap'||kind==='lead')?10:15;
    driveAcc[d]=driveAcc[d]||{dx:0,dy:0}; driveAcc[d].dx+=Math.cos(a)*mag; driveAcc[d].dy+=Math.sin(a)*mag;
  });
  // coverage layer: defender-owned ents (drops/man/rush move the DEFENSE tokens)
  (m.C||[]).forEach(c=>{ const spec=K[c.kind]||K.drop;
    ents.push({owner:c.id,team:'def',pts:c.pts,color:spec.c,cap:spec.cap,win:spec.win,dash:spec.dash,bubble:c.bubble,kind:c.kind});
  });
  // pass layer: routes move the receivers, QB drops, ball flight is pure art (no token)
  (m.R||[]).forEach(r=>ents.push({owner:r.id,pts:r.pts,color:K.route.c,cap:K.route.cap,win:K.route.win,kind:'route'}));
  if(m.drop && OFF.QB) ents.push({owner:'QB',pts:m.drop,color:K.qbdrop.c,cap:K.qbdrop.cap,win:K.qbdrop.win,kind:'qbdrop'});
  // extra movement ents: option keep / pitch paths, pre-snap motion
  (m.X||[]).forEach(e=>{ const spec=K[e.kind]||K.keep;
    ents.push({owner:e.owner,pts:e.pts,color:spec.c,cap:spec.cap,win:spec.win,dash:spec.dash,kind:e.kind}); });
  if(m.ball) ents.push({owner:'BALL',pts:m.ball,color:K.ball.c,cap:K.ball.cap,win:K.ball.win,dash:K.ball.dash,kind:'ball'});
  if(m.carry) ents.push({owner:m.carrier||(OFF.RB?'RB':'QB'),pts:m.carry,color:K.carry.c,cap:K.carry.cap,win:K.carry.win,carrier:true});
  return { m, ents, driveAcc };
}

/* ---------------- path math + easing (verbatim from demo) ---------------- */
function plen(pts){let L=0;for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);return L;}
function pAt(pts,f){ if(f<=0)return pts[0]; if(f>=1)return pts[pts.length-1];
  const total=plen(pts); let target=total*f, acc=0;
  for(let i=1;i<pts.length;i++){const seg=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
    if(acc+seg>=target){const t=(target-acc)/seg;return {x:pts[i-1].x+(pts[i].x-pts[i-1].x)*t,y:pts[i-1].y+(pts[i].y-pts[i-1].y)*t};}acc+=seg;}
  return pts[pts.length-1]; }
const easeOut=t=>1-Math.pow(1-t,2.4), easeIO=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2, clamp01=t=>Math.max(0,Math.min(1,t));

/* token positions at global progress g (0..1) */
function positionsAt(B,g){
  const OFF=B.m.OFF, DEF=B.m.DEF, pos={off:{},def:{}};
  for(const id in OFF) pos.off[id]={x:OFF[id].x,y:OFF[id].y};
  for(const id in DEF) pos.def[id]={x:DEF[id].x,y:DEF[id].y};
  B.ents.forEach(e=>{ const w=e.win, lp=clamp01((g-w[0])/(w[1]-w[0])), f=e.carrier?easeIO(lp):easeOut(lp);
    const pt=pAt(e.pts,f);
    if(e.team==='def'){ if(pos.def[e.owner]) pos.def[e.owner]=pt; }
    else if(pos.off[e.owner]) pos.off[e.owner]=pt; });
  for(const id in B.driveAcc){ const dr=B.driveAcc[id], dw=[.14,.5], df=easeOut(clamp01((g-dw[0])/(dw[1]-dw[0])));
    if(pos.def[id]) pos.def[id]={x:DEF[id].x+dr.dx*df,y:DEF[id].y+dr.dy*df}; }
  return pos;
}

/* ---------------- SVG string renderer (demo-identical look; usable in Node) ---------------- */
function pathStr(pts){return pts.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');}
function capStr(pts,color,cap){ const a=pts[pts.length-1],b=pts[pts.length-2]||a, ang=Math.atan2(a.y-b.y,a.x-b.x);
  if(cap==='T'){const ca=ang+Math.PI/2,cl=13; return `<line x1="${a.x+cl*Math.cos(ca)}" y1="${a.y+cl*Math.sin(ca)}" x2="${a.x-cl*Math.cos(ca)}" y2="${a.y-cl*Math.sin(ca)}" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`; }
  const L=14; return `<polygon points="${a.x},${a.y} ${a.x-L*Math.cos(ang-.45)},${a.y-L*Math.sin(ang-.45)} ${a.x-L*Math.cos(ang+.45)},${a.y-L*Math.sin(ang+.45)}" fill="${color}"/>`; }
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
function fieldStr(idn,noVig){ idn=idn||''; let s='';
  for(let i=0;i<14;i++) s+=`<rect x="0" y="${i*52}" width="1000" height="52" fill="${i%2?'#1c7a40':'#187038'}"/>`;
  if(!noVig) s+=`<rect x="0" y="0" width="1000" height="720" fill="url(#vig${idn})"/>`; // browser-only (PyMuPDF renders the radial opaque)
  for(let y=24;y<720;y+=52){ if(y!==LOS) s+=`<line x1="30" y1="${y}" x2="970" y2="${y}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="2"/>`;
    for(const hx of [410,590]) s+=`<line x1="${hx}" y1="${y-6}" x2="${hx}" y2="${y+6}" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2"/>`; }
  s+=`<line x1="30" y1="${LOS}" x2="970" y2="${LOS}" stroke="#78c8ff" stroke-opacity="0.9" stroke-width="3"/>`;
  s+=`<rect x="30" y="0" width="940" height="720" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="3"/>`;
  return s; }
function tokenStr(x,y,label,team,tech){ let s=`<g transform="translate(${x},${y})">`;
  if(team==='off') s+=`<circle r="17" fill="#10204a" stroke="#dfe8fb" stroke-width="2.5"/>`;
  else s+=`<rect x="-16" y="-16" width="32" height="32" rx="6" fill="#7a1224" stroke="#ffd6dc" stroke-width="2.5"/>`;
  if(tech) s+=`<text text-anchor="middle" y="-22" font-size="11" font-weight="700" fill="#ffd6dc">${esc(tech)}</text>`;
  s+=`<text text-anchor="middle" y="5" font-size="14" font-weight="800" fill="#fff" font-family="Segoe UI,Arial">${esc(label)}</text></g>`; return s; }
function defLabel(id){ return id.replace(/^CB[LR]$/,'CB'); }

function renderSVG(model, g, idn, noVig){
  idn = idn||'';
  const B=buildModel(model), pos=positionsAt(B,g), dir=model.dir;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 720" width="1000" height="720">`;
  s+=`<defs><radialGradient id="vig${idn}" cx="50%" cy="42%" r="75%"><stop offset="60%" stop-color="#000000" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.45"/></radialGradient></defs>`;
  s+=fieldStr(idn,noVig);
  // static art: zone bubbles under everything, then paths + caps
  let art='';
  B.ents.forEach(e=>{ if(e.bubble) art+=`<ellipse cx="${e.bubble.x}" cy="${e.bubble.y}" rx="${e.bubble.rx}" ry="${e.bubble.ry}" fill="${e.color}" fill-opacity="0.12" stroke="${e.color}" stroke-opacity="0.45" stroke-width="2"/>`; });
  B.ents.forEach(e=>{ art+=`<path d="${pathStr(e.pts)}" fill="none" stroke="${e.color}" stroke-width="${e.carrier?5:4}"${e.dash?` stroke-dasharray="${e.dash}"`:''} stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>`; art+=capStr(e.pts,e.color,e.cap); });
  s+=art;
  // labels
  s+=`<text x="500" y="48" text-anchor="middle" font-size="30" font-weight="800" fill="#ffd34d" font-family="Segoe UI,Arial">${esc(model.name)}</text>`;
  s+=`<text x="500" y="74" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">${esc(model.term)}</text>`;
  if(model.coverage && model.key!==model.coverage){ const cv=COVERAGES[model.coverage];
    s+=`<text x="500" y="96" text-anchor="middle" font-size="13" font-weight="700" fill="#ffd34d">vs ${esc(cv&&cv.display_name||model.coverage)}</text>`; }
  s+= dir>0 ? `<text x="720" y="556" font-size="13" fill="#bfe0ff" font-weight="700">PLAYSIDE →</text>`
            : `<text x="190" y="556" font-size="13" fill="#bfe0ff" font-weight="700" text-anchor="end">← PLAYSIDE</text>`;
  // tokens
  for(const id in model.DEF){ const p=pos.def[id]; s+=tokenStr(p.x,p.y,defLabel(id),'def',model.DEF[id].t); }
  for(const id in model.OFF){ const p=pos.off[id]; s+=tokenStr(p.x,p.y,id,'off'); }
  s+=`</svg>`; return s;
}

const SCHEMES=['inside-zone','outside-zone','power','counter','duo','iso','trap','draw','toss','read-option','speed-option','power-read'];
const FRONT_KEYS=Object.keys(FRONTS);
const COVERAGE_KEYS=Object.keys(COVERAGES);
const CONCEPT_KEYS=Object.keys(CONCEPTS);
const API={ LOS,SPLIT,K,COL,FORMATIONS,FRONTS,SCHEMES,FRONT_KEYS,COVERAGES,COVERAGE_KEYS,
  ROUTES,CONCEPTS,CONCEPT_KEYS,
  resolvePlay, resolveShell, resolveCoverage, resolvePass, classifyPass, classifyRun,
  buildModel, positionsAt, renderSVG, extractRoles };
if(typeof module!=='undefined'&&module.exports) module.exports=API;
root.PlayEngine=API;
})(typeof window!=='undefined'?window:globalThis);
