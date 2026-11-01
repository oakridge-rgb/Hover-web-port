/* =====================================================================
   GAME STATE CORE + PLAY STATE (gameplay, judging, HUD, pause)
   ===================================================================== */
if(!CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){
    r=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);
    this.moveTo(x+r,y);this.arcTo(x+w,y,x+w,y+h,r);this.arcTo(x+w,y+h,x,y+h,r);
    this.arcTo(x,y+h,x,y,r);this.arcTo(x,y,x+w,y,r);this.closePath();return this;};
}
const ST={};
const G={
  state:'title',t:0,
  options:store.get('opts',{speed:1.6,down:false,ghost:true,hitsound:false,bot:false,flash:true}),
  scores:store.get('scores',{}),
  songIdx:0,diff:2,lastStats:null,newBest:false,
  optsFrom:'title',menuStart:0
};
const DIFF_NAME=['EASY','NORMAL','HARD'];
const DIFF_COL=['#7bd85e','#f0c33c','#e05555'];
const STRX =[150,270,390,510];   /* opponent strums */
const STRXP=[770,890,1010,1130]; /* player strums */
const RATING_TXT={sick:'SICK!!',good:'GOOD',bad:'BAD',shit:'SHIT'};
const RATING_COL={sick:'#39c5f3',good:'#7bd85e',bad:'#e8a33d',shit:'#c25b5b'};
const HOLD_PAT=[];

const P={};
function ppmNow(){return 0.45*P.cfg.speed*G.options.speed}
function hitY(){return G.options.down?600:140}
function rankOf(acc,misses,sickOnly){
  if(sickOnly)return['PFC','#ffe14d'];
  if(acc>=95)return['S','#ffd700'];
  if(acc>=90)return['A','#7bd85e'];
  if(acc>=80)return['B','#4db8ff'];
  if(acc>=70)return['C','#f0c33c'];
  return['D','#e05555'];
}

/* ---------------- start / flow ---------------- */
function startPlay(songIdx,diff){
  AE.init();AE.resume();
  if(!AE.ctx)return; /* audio needs one user gesture first */
  G.songIdx=songIdx;G.diff=diff;
  const cfg=SONGS[songIdx];
  if(!cfg.data)cfg.data=genSong(cfg);
  const data=cfg.data;
  P.cfg=cfg;P.data=data;P.diff=diff;
  P.notesP=data.charts[diff].map(n=>({t:n.t,l:n.l,d:n.d,hit:false,missed:false,holding:false,holdDone:false}));
  P.notesO=data.opp.map(n=>({t:n.t,l:n.l,d:0,hit:false}));
  P.laneP=[[],[],[],[]];P.laneO=[[],[],[],[]];
  for(const n of P.notesP)P.laneP[n.l].push(n);
  for(const n of P.notesO)P.laneO[n.l].push(n);
  P.pScan=[0,0,0,0];P.pDraw=[0,0,0,0];P.oScan=[0,0,0,0];P.oDraw=[0,0,0,0];
  P.score=0;P.misses=0;P.combo=0;P.maxCombo=0;
  P.ratings={sick:0,good:0,bad:0,shit:0};P.judged=0;P.accSum=0;
  P.health=50;P.pops=[];P.splashes=[];P.holds=[];
  P.keyHeld=[false,false,false,false];
  P.glowP=[0,0,0,0];P.glowO=[0,0,0,0];
  P.charP={pose:-1,timer:0};P.charO={pose:-1,timer:0};
  P.beatVis=-999;P.camZoom=1;P.camX=0;P.iconB=0;P.flash=0;
  P.songTime=-99999;P.songLen=data.dur;
  P.paused=false;P.pauseSel=0;P.dead=false;
  const beatMs=data.beat;
  const evs=data.events.slice();
  for(let i=0;i<3;i++)evs.push({t:i*beatMs,ch:'beep',x:0});
  evs.push({t:3*beatMs,ch:'beep',x:1});
  AE.startSeq(evs,data.dur+beatMs*4,()=>{
    if(G.state==='play'&&!P.dead)finishSong();
  },3*beatMs/1000+0.55);
  P.startT=AE.seq.startT;
  G.state='play';
}
function finishSong(){
  const acc=P.judged?P.accSum/P.judged*100:0;
  const sickOnly=P.judged>0&&P.ratings.sick===P.judged&&P.misses===0;
  const[rank,rankCol]=rankOf(acc,P.misses,sickOnly);
  const stats={songId:P.cfg.id,songName:P.cfg.name,diff:P.diff,score:P.score,misses:P.misses,
    maxCombo:P.maxCombo,acc,rank,rankCol,ratings:{...P.ratings},judged:P.judged,
    notes:P.notesP.length};
  const key='sc_'+P.cfg.id+'_'+P.diff;
  const old=G.scores[key];
  G.newBest=!old||stats.score>old.s;
  if(G.newBest){G.scores[key]={s:stats.score,a:stats.acc,r:rank};store.set('scores',G.scores);}
  G.lastStats=stats;
  AE.stopSeq();
  G.state='results';
}
function die(){
  if(P.dead)return;
  P.dead=true;AE.stopSeq();AE.vDeath(AE.now());
  G.state='gameover';
}
function exitToMenu(){
  AE.stopSeq();startMenuMusic();
  G.state='freeplay';
}

/* ---------------- judging ---------------- */
function judge(n,l,delta){
  n.hit=true;
  const d=Math.abs(delta);
  const r=d<=45?'sick':d<=90?'good':d<=135?'bad':'shit';
  P.ratings[r]++;P.judged++;
  P.accSum+={sick:1,good:.8,bad:.45,shit:.2}[r];
  P.score+={sick:350,good:200,bad:100,shit:50}[r];
  P.combo++;if(P.combo>P.maxCombo)P.maxCombo=P.combo;
  if(P.combo>0&&P.combo%50===0)P.pops.push({kind:'mile',age:0,val:P.combo});
  if(!G.options.bot)
    P.health=clamp(P.health+(r==='sick'?2.2:r==='good'?1.2:r==='bad'?0:-0.8),0,100);
  P.pops.push({kind:r,age:0});
  P.glowP[l]=0.15;
  P.charP.pose=l;P.charP.timer=0.42;
  if(r==='sick')P.splashes.push({l,age:0});
  if(n.d>0){n.holding=true;P.holds.push(n);}
  if(P.health<=0)die();
}
function doMiss(n,l){
  n.missed=true;
  P.misses++;P.combo=0;
  P.health=clamp(P.health-4.5,0,100);
  AE.vMiss(AE.now());AE.duck();
  P.pops.push({kind:'miss',age:0});
  if(P.health<=0)die();
}
function pressLane(l){
  P.keyHeld[l]=true;
  if(G.state!=='play'||P.paused||P.dead)return;
  if(G.options.hitsound)AE.vClick(AE.now());
  if(G.options.bot)return;
  const st=P.songTime;
  const arr=P.laneP[l];let best=null,bd=1e9;
  for(let i=P.pScan[l];i<arr.length;i++){
    const n=arr[i];if(n.t>st+185)break;
    if(!n.hit&&!n.missed){const d=Math.abs(n.t-st);if(d<bd){bd=d;best=n;}}
  }
  if(best&&bd<=160)judge(best,l,best.t-st);
  else if(!G.options.ghost){
    P.combo=0;P.misses++;P.health=clamp(P.health-1.2,0,100);
    AE.vMiss(AE.now());AE.duck();
    P.pops.push({kind:'ghost',age:0});
    if(P.health<=0)die();
  }
}
function releaseLane(l){
  P.keyHeld[l]=false;
}

/* ---------------- play update ---------------- */
function playUpdate(dt){
  if(P.paused||P.dead)return;
  const st=(AE.now()-P.startT)*1000;
  P.songTime=st;
  const beatMs=P.data.beat;
  const cb=Math.floor(st/beatMs);
  if(cb>P.beatVis){
    P.beatVis=cb;P.camZoom=1.05;P.iconB=1;
    if(G.options.flash&&P.cfg.id==='supercell'&&cb%4===0&&st>0)P.flash=0.9;
  }
  P.camZoom+=(1-P.camZoom)*Math.min(1,dt*0.006);
  P.iconB=Math.max(0,P.iconB-dt*0.004);
  P.flash=Math.max(0,P.flash-dt*0.0016);
  for(let i=0;i<4;i++){
    P.glowP[i]=Math.max(0,P.glowP[i]-dt/1000);
    P.glowO[i]=Math.max(0,P.glowO[i]-dt/1000);
  }
  P.charP.timer-=dt/1000;if(P.charP.timer<0)P.charP.pose=-1;
  P.charO.timer-=dt/1000;if(P.charO.timer<0)P.charO.pose=-1;
  /* per-lane note processing */
  for(let l=0;l<4;l++){
    const arr=P.laneP[l];
    let i=P.pScan[l];
    while(i<arr.length){
      const n=arr[i];
      if(n.t>st)break;
      if(!n.hit&&!n.missed){
        if(G.options.bot)judge(n,l,0);
        else if(st-n.t>185)doMiss(n,l);
      }
      if(n.hit||n.missed){i++;P.pScan[l]=i;}else break;
    }
    const arrO=P.laneO[l];
    while(P.oScan[l]<arrO.length){
      const n=arrO[P.oScan[l]];
      if(n.t>st)break;
      n.hit=true;P.glowO[l]=0.15;
      P.charO.pose=l;P.charO.timer=0.42;
      P.oScan[l]++;
    }
  }
  /* sustain holds */
  for(let i=P.holds.length-1;i>=0;i--){
    const n=P.holds[i];
    const held=G.options.bot||P.keyHeld[n.l];
    if(n.holding&&held){
      P.score+=dt*0.055;
      if(!G.options.bot)P.health=Math.min(100,P.health+dt*0.0035);
      if(st>=n.t+n.d){n.holding=false;n.holdDone=true;P.holds.splice(i,1);}
    }else if(n.holding){
      n.holding=false;
      if(st<n.t+n.d-110){ /* dropped the hold */
        n.holdDone=true;P.combo=0;P.misses++;
        if(!G.options.bot)P.health=clamp(P.health-3,0,100);
        AE.vMiss(AE.now());AE.duck();
        P.pops.push({kind:'drop',age:0});
      }else n.holdDone=true;
      P.holds.splice(i,1);
      if(P.health<=0){die();return;}
    }
  }
  for(const p of P.pops)p.age+=dt;
  P.pops=P.pops.filter(p=>p.age<650);
  for(const s of P.splashes)s.age+=dt;
  P.splashes=P.splashes.filter(s=>s.age<320);
}

/* ---------------- play draw ---------------- */
function drawNotesSide(ppm,st,down,hy){
  for(let l=0;l<4;l++){
    const arr=P.laneP[l];let i=P.pDraw[l];
    while(i<arr.length){
      const n=arr[i];
      const rel=n.t-st;
      const span=rel*ppm;
      if(down){
        if(-span-(n.d||0)*ppm>H+260){i++;P.pDraw[l]=i;continue;}
        if(span>hy+160)break;
      }else{
        if(span<-(H-hy+260+(n.d||0)*ppm)){i++;P.pDraw[l]=i;continue;}
        if(span>H)break;
      }
      const x=STRXP[l];
      /* sustain ribbon */
      if(n.d>0&&!n.holdDone){
        let headY,tailY;
        if(n.holding){headY=down?hy:hy;tailY=down?hy-(n.t+n.d-st)*ppm:hy+(n.t+n.d-st)*ppm;}
        else{
          headY=down?hy-span:hy+span;
          tailY=down?hy-(n.t+n.d-st)*ppm:hy+(n.t+n.d-st)*ppm;
        }
        const top=Math.min(headY,tailY),bot=Math.max(headY,tailY);
        if(bot>0&&top<H){
          g.globalAlpha=n.missed?0.3:0.85;
          g.fillStyle=HOLD_PAT[l];
          g.fillRect(x-17,top,34,bot-top);
          /* tail cap */
          const capY=down?top:bot;
          g.fillStyle=LANE_COL[l];
          g.beginPath();
          g.moveTo(x-17,capY);g.lineTo(x+17,capY);
          g.lineTo(x,capY+(down?-16:16));
          g.closePath();g.fill();
          g.globalAlpha=1;
        }
      }
      /* head */
      if(!n.hit){
        const y=down?hy-span:hy+span;
        if(y>-90&&y<H+90){
          if(n.missed)g.globalAlpha=0.35;
          g.drawImage(SPR.press[l],x-NOTE_R-6,y-NOTE_R-6,2*(NOTE_R+6),2*(NOTE_R+6));
          g.globalAlpha=1;
        }
      }
      i++;
    }
  }
  /* opponent notes (visual only, auto-played) */
  for(let l=0;l<4;l++){
    const arr=P.laneO[l];let i=P.oDraw[l];
    while(i<arr.length){
      const n=arr[i];
      const rel=n.t-st,span=rel*ppm;
      if(down){
        if(-span>H+200){i++;P.oDraw[l]=i;continue;}
        if(span>hy+160)break;
      }else{
        if(span<-(H-hy+200)){i++;P.oDraw[l]=i;continue;}
        if(span>H)break;
      }
      const x=STRX[l];
      const y=down?hy-span:hy+span;
      if(!n.hit&&y>-90&&y<H+90)
        g.drawImage(SPR.static[l],x-NOTE_R-6,y-NOTE_R-6,2*(NOTE_R+6),2*(NOTE_R+6));
      i++;
    }
  }
}
function drawStrums(hy,ppm,st){
  const bs=1+0.045*P.iconB;
  for(let l=0;l<4;l++){
    const s1=100*bs;
    /* opponent */
    let spr=SPR.static[l];
    if(P.glowO[l]>0)spr=SPR.confirm[l];
    g.drawImage(spr,STRX[l]-s1/2,hy-s1/2,s1,s1);
    /* player */
    spr=P.glowP[l]>0?SPR.confirm[l]:P.keyHeld[l]?SPR.press[l]:SPR.static[l];
    const s2=(P.glowP[l]>0?112:100)*bs;
    g.drawImage(spr,STRXP[l]-s2/2,hy-s2/2,s2,s2);
  }
}
function drawPopups(){
  const px=W/2;
  const py=G.options.down?240:400;
  for(const p of P.pops){
    const a=p.age>380?1-(p.age-380)/270:1;
    if(a<=0)continue;
    g.globalAlpha=a;
    const sc=1+0.35*Math.exp(-p.age/70);
    if(p.kind==='mile'){
      txt(g,p.val+' COMBO!',px,py-120,38,'#ffe14d','center',7,'#000');
    }else if(p.kind==='miss'||p.kind==='ghost'||p.kind==='drop'){
      txt(g,p.kind==='ghost'?'GHOST TAP':p.kind==='drop'?'DROPPED':'MISS',px,py,36,'#c25b5b','center',7,'#000');
    }else{
      g.save();g.translate(px,py);g.scale(sc,sc);
      txt(g,RATING_TXT[p.kind],0,0,52,RATING_COL[p.kind],'center',9,'#000');
      g.restore();
      if(P.combo>=5){
        g.save();g.translate(px,py+58);g.scale(sc,sc);
        txt(g,P.combo,0,0,44,'#fff','center',8,'#000');
        g.restore();
      }
    }
    g.globalAlpha=1;
  }
}
function drawSplashes(hy){
  for(const s of P.splashes){
    const x=STRXP[s.l],a=1-s.age/320;
    g.globalAlpha=a;
    g.strokeStyle=LANE_COL[s.l];g.lineWidth=5;
    for(let i=0;i<6;i++){
      const ang=i*TAU/6+s.age*0.01;
      const r1=26+s.age*0.35,r2=r1+16+s.age*0.25;
      g.beginPath();
      g.moveTo(x+Math.cos(ang)*r1,hy+Math.sin(ang)*r1);
      g.lineTo(x+Math.cos(ang)*r2,hy+Math.sin(ang)*r2);
      g.stroke();
    }
    g.globalAlpha=1;
  }
}
function playDraw(){
  const down=G.options.down;
  const hy=hitY();
  const ppm=ppmNow();
  const st=P.songTime;
  drawStage(g,P.beatVis,P.flash,P.cfg.id==='supercell');
  /* world (camera) */
  g.save();
  const panT=P.charO.timer>0?-110:P.charP.timer>0?110:0;
  P.camX=lerp(P.camX,panT,0.07);
  g.translate(W/2+P.camX*0.4,H/2);
  g.scale(P.camZoom,P.camZoom);
  g.translate(-W/2,-H/2);
  const bob=Math.sin(Math.max(0,P.beatVis)*Math.PI)*6;
  drawCloud(g,320,560,P.charO.pose,bob,1.3,P.health<25);
  drawVolt(g,960,560,P.charP.pose,bob,1.3);
  drawStrums(hy,ppm,st);
  drawNotesSide(ppm,st,down,hy);
  drawSplashes(hy);
  drawPopups();
  /* countdown */
  const beatMs=P.data.beat;
  if(st>-250&&st<3*beatMs+250){
    const labels=['3','2','1','GO!'];
    const idx=clamp(Math.floor(st/beatMs),0,3);
    const frac=(st-idx*beatMs)/beatMs;
    const sc=1+0.45*Math.exp(-frac*5);
    if(st>-beatMs*0.6){
      g.save();g.translate(W/2,H/2-40);g.scale(sc,sc);
      txt(g,labels[idx],0,0,idx===3?110:96,idx===3?'#ffe14d':'#fff','center',12,'#000');
      g.restore();
    }
    /* first-time DFJK hint */
    g.globalAlpha=0.85;
    for(let l=0;l<4;l++)
      drawKeyCap(g,STRXP[l],down?hy-96:hy+92,58,'DFJK'[l],LANE_COL[l]);
    g.globalAlpha=1;
  }
  g.restore();
  /* ============ HUD ============ */
  const bw=560,bx=(W-bw)/2,by=down?36:H-52;
  g.fillStyle='rgba(0,0,0,.55)';
  g.beginPath();g.roundRect(bx-4,by-4,bw+8,30,8);g.fill();
  g.fillStyle='#e03c3c';
  g.beginPath();g.roundRect(bx,by,bw,22,6);g.fill();
  g.fillStyle='#66e84c';
  const gw=bw*P.health/100;
  g.beginPath();g.roundRect(bx+bw-gw,by,gw,22,6);g.fill();
  const xb=bx+bw*(1-P.health/100);
  drawIcon(g,xb-44,by+11,72,1,P.health<20,P.iconB);
  drawIcon(g,xb+44,by+11,72,0,P.health<20,P.iconB);
  const acc=P.judged?(P.accSum/P.judged*100).toFixed(2)+'%':'N/A';
  let rankS='';
  if(P.judged>0){const so=P.ratings.sick===P.judged&&P.misses===0;rankS=' ['+rankOf(P.accSum/P.judged,P.misses,so)[0]+']';}
  txt(g,'Score: '+Math.floor(P.score)+' | Misses: '+P.misses+' | Accuracy: '+acc+rankS,
      W/2,by+(down?-24:42),24,'#fff','center',6,'#000');
  if(G.options.bot&&(G.t%800<500))
    txt(g,'BOTPLAY',W/2,by+(down?52:-38),30,'#ffe14d','center',7,'#000');
  /* time bar */
  const tw=430,tx=(W-tw)/2,ty=down?H-34:20;
  g.fillStyle='rgba(0,0,0,.55)';
  g.beginPath();g.roundRect(tx,ty,tw,20,8);g.fill();
  const prog=clamp(st/P.songLen,0,1);
  g.fillStyle='#fff';
  g.beginPath();g.roundRect(tx+3,ty+3,(tw-6)*prog,14,6);g.fill();
  txt(g,P.cfg.name+' - '+DIFF_NAME[P.diff]+'  ·  '+fmtTime(clamp(st,0,P.songLen))+' / '+fmtTime(P.songLen),
      W/2,ty+(down?-20:36),22,'#fff','center',5,'#000');
  /* pause button (touch) */
  const px2=W-56,py2=down?H-56:56;
  g.fillStyle='rgba(255,255,255,.14)';
  g.beginPath();g.arc(px2,py2,30,0,TAU);g.fill();
  g.fillStyle='#fff';
  g.fillRect(px2-9,py2-11,7,22);g.fillRect(px2+3,py2-11,7,22);
  /* pause overlay */
  if(P.paused)drawPauseOverlay();
}
function drawPauseOverlay(){
  g.fillStyle='rgba(6,8,18,.84)';g.fillRect(0,0,W,H);
  txt(g,'PAUSED',W/2,150,72,'#fff','center',10,'#000');
  txt(g,P.cfg.name+' - '+DIFF_NAME[P.diff],W/2,215,26,'#9fb4ff','center',5,'#000');
  const items=['RESUME','RESTART SONG','BOTPLAY: '+(G.options.bot?'ON':'OFF'),'EXIT TO MENU'];
  for(let i=0;i<items.length;i++){
    const y=320+i*72;
    const sel=P.pauseSel===i;
    if(sel){
      g.fillStyle='rgba(255,255,255,.08)';
      g.beginPath();g.roundRect(W/2-260,y-30,520,58,12);g.fill();
      txt(g,'>',W/2-285,y,34,'#ffe14d','center',6,'#000');
      txt(g,'<',W/2+285,y,34,'#ffe14d','center',6,'#000');
    }
    txt(g,items[i],W/2,y,38,sel?'#ffe14d':'#fff','center',7,'#000');
  }
  txt(g,'Arrows/W,S = select · Enter = confirm · P or Backspace = resume',
      W/2,660,20,'#8fa0c8','center',4,'#000');
  txt(g,'iPad: tap a row · tap the pause circle to resume',W/2,692,18,'#6c7ca6','center',4,'#000');
}
function pauseAction(){
  if(P.pauseSel===0)togglePause();
  else if(P.pauseSel===1){AE.resume();startPlay(G.songIdx,G.diff);}
  else if(P.pauseSel===2){G.options.bot=!G.options.bot;store.set('opts',G.options);}
  else{AE.resume();exitToMenu();}
}
function togglePause(){
  P.paused=!P.paused;
  if(P.paused)AE.suspend();else AE.resume();
}
function playKey(e){
  const k=e.code;
  if(e.repeat)return;
  if(P.paused){
    if(k==='ArrowUp'||k==='KeyW')P.pauseSel=(P.pauseSel+3)%4;
    else if(k==='ArrowDown'||k==='KeyS')P.pauseSel=(P.pauseSel+1)%4;
    else if(k==='Enter'||k==='Space')pauseAction();
    else if(k==='Escape'||k==='Backspace'||k==='KeyP')togglePause();
    return;
  }
  if(k in KEYMAP){e.preventDefault();pressLane(KEYMAP[k]);return;}
  if(k==='Escape'||k==='Backspace'||k==='KeyP'||(e.key==='.'&&e.metaKey)){
    e.preventDefault();togglePause();return;
  }
  if(k==='KeyR')startPlay(G.songIdx,G.diff);
}
ST.play={update:playUpdate,draw:playDraw,key:playKey};
