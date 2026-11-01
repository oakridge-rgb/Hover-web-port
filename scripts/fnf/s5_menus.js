/* =====================================================================
   MENUS: title, freeplay, options, gameover, results + input + boot
   ===================================================================== */
const KEYMAP={KeyD:0,KeyF:1,KeyJ:2,KeyK:3,ArrowLeft:0,ArrowDown:1,ArrowUp:2,ArrowRight:3};

function startMenuMusic(){
  if(!AE.ctx)return;
  const lp=genMenuLoop();
  AE.startSeq(lp.events,lp.dur,function loop(){
    if(G.state==='title'||G.state==='freeplay'||G.state==='options')startMenuMusic();
  },0.4);
  G.menuStart=AE.seq.startT;
}

/* ---------------- TITLE ---------------- */
ST.title={
  enter(){startMenuMusic();},
  update(dt){},
  draw(){
    const beat=G.t/(60000/104);
    drawStage(g,beat,0,false);
    const bob=Math.sin(beat*Math.PI)*7;
    /* lightning bolt behind logo */
    g.save();g.translate(W/2,205);g.rotate(-0.12+Math.sin(beat*2)*0.02);
    g.globalAlpha=0.9;
    g.fillStyle='#ffe14d';
    g.shadowColor='#ffb700';g.shadowBlur=30;
    g.beginPath();
    g.moveTo(18,-140);g.lineTo(-34,10);g.lineTo(-4,10);g.lineTo(-20,140);
    g.lineTo(40,-20);g.lineTo(6,-20);g.closePath();
    g.fill();g.restore();
    g.globalAlpha=1;
    g.save();g.translate(0,bob*0.6);
    txt(g,'FRIDAY NIGHT FUNKIN\'',W/2,96,34,'#fff','center',7,'#000');
    g.save();g.translate(W/2,218);g.scale(1+0.03*Math.sin(beat*Math.PI*2),1+0.03*Math.sin(beat*Math.PI*2));
    txt(g,'STORM',0,-38,110,'#7fd0ff','center',14,'#06122b');
    txt(g,'PROTOCOL',0,62,110,'#3a7bd5','center',14,'#06122b');
    g.restore();
    txt(g,'a FAN MOD · 3 songs · GOOD LUCK ON SUPERCELL',W/2,352,24,'#ffe14d','center',6,'#000');
    g.restore();
    /* press enter */
    if(G.t%900<600)txt(g,'PRESS ENTER OR TAP',W/2,438,40,'#fff','center',8,'#000');
    /* DFJK caps */
    const cols=['#C24B99','#00E5FF','#12FA05','#F9393F'];
    const lb=['D\nLEFT','F\nDOWN','J\nUP','K\nRIGHT'];
    for(let i=0;i<4;i++){
      const x=W/2-210+i*140,y=540+Math.sin(beat*Math.PI*2+i)*5;
      drawKeyCap(g,x,y,64,'DFJK'[i],cols[i]);
      txt(g,['LEFT','DOWN','UP','RIGHT'][i],x,y+48,16,'#9fb4ff','center',4,'#000');
    }
    txt(g,'P / BACKSPACE = PAUSE   ·   R = RESTART',W/2,640,20,'#8fa0c8','center',4,'#000');
    txt(g,'PRIME ENGINE v1.0 · PSYCH-STYLE HUD · KADE TIMING WINDOWS · 100% OFFLINE',
        W/2,692,17,'#6c7ca6','center',4,'#000');
  },
  key(e){
    if(e.code==='Enter'||e.code==='Space'){G.state='freeplay';}
  },
  tap(){G.state='freeplay';}
};

/* ---------------- FREEPLAY ---------------- */
ST.freeplay={
  draw(){
    const beat=(AE.now()-G.menuStart)*104/60;
    drawStage(g,beat,0,false);
    const bob=Math.sin(beat*Math.PI)*4;
    txt(g,'FREEPLAY',W/2,72+bob*0.4,58,'#fff','center',9,'#000');
    txt(g,'Enter = play · Up/Down = song · Left/Right = difficulty · Backspace = title',
        W/2,124,19,'#8fa0c8','center',4,'#000');
    for(let i=0;i<SONGS.length;i++){
      const sel=G.songIdx===i;
      const y=225+i*132;
      const s=sel?1.06:1;
      const col=['#4db8ff','#b44dff','#ff4d4d'][i];
      g.save();g.translate(W/2,y);g.scale(s,s);
      g.fillStyle=sel?'rgba(20,28,60,.95)':'rgba(12,16,34,.85)';
      g.beginPath();g.roundRect(-430,-52,860,104,16);g.fill();
      g.strokeStyle=sel?col:'rgba(90,110,180,.35)';g.lineWidth=sel?4:2;g.stroke();
      if(sel){g.fillStyle=col;g.beginPath();g.roundRect(-430,-52,14,104,7);g.fill();}
      g.restore();
      txt(g,SONGS[i].name,W/2-40,y-14,sel?46:38,sel?col:'#dfe6ff','center',7,'#000');
      txt(g,SONGS[i].sub+'  ·  BPM '+SONGS[i].bpm,W/2-40,y+24,19,'#9fb4ff','center',4,'#000');
      const best=G.scores['sc_'+SONGS[i].id+'_'+G.diff];
      txt(g,best?('BEST: '+best.s+' ('+best.r+')'):'NO RECORD',
          W/2+300,y-14,20,best?'#ffe14d':'#5a6a94','center',4,'#000');
      const nc=SONGS[i].data?SONGS[i].data.noteCount[G.diff]:genSong(SONGS[i]).noteCount[G.diff];
      txt(g,nc+' NOTES',W/2+300,y+24,18,'#7688b8','center',4,'#000');
    }
    /* difficulty selector */
    const dy=648;
    drawKeyCap(g,W/2-170,dy,44,'<','#3a4a7a');
    txt(g,DIFF_NAME[G.diff],W/2,dy,40,DIFF_COL[G.diff],'center',8,'#000');
    drawKeyCap(g,W/2+170,dy,44,'>','#3a4a7a');
  },
  key(e){
    const k=e.code;
    if(k==='ArrowUp'||k==='KeyW')G.songIdx=(G.songIdx+SONGS.length-1)%SONGS.length;
    else if(k==='ArrowDown'||k==='KeyS')G.songIdx=(G.songIdx+1)%SONGS.length;
    else if(k==='ArrowLeft'||k==='KeyA')G.diff=(G.diff+2)%3;
    else if(k==='ArrowRight'||k==='KeyD')G.diff=(G.diff+1)%3;
    else if(k==='Enter'||k==='Space')startPlay(G.songIdx,G.diff);
    else if(k==='Backspace'||k==='Escape')G.state='title';
    else if(k==='KeyO'){G.optsFrom='freeplay';G.state='options';}
  },
  tap(x,y){
    if(y>200&&y<620){
      const i=clamp(Math.round((y-225)/132),0,SONGS.length-1);
      if(i===G.songIdx)startPlay(G.songIdx,G.diff);else G.songIdx=i;
      return;
    }
    if(Math.abs(y-648)<40){
      if(x<W/2-80)G.diff=(G.diff+2)%3;
      else if(x>W/2+80)G.diff=(G.diff+1)%3;
      else startPlay(G.songIdx,G.diff);
      return;
    }
    G.state='title';
  }
};

/* ---------------- OPTIONS ---------------- */
const OPT_ROWS=[
  {k:'speed',   n:'SCROLL SPEED', fmt:v=>Number(v).toFixed(1)+'x', lo:1,hi:3.5,st:0.1},
  {k:'down',    n:'DOWNSCROLL',   fmt:v=>v?'ON':'OFF'},
  {k:'ghost',   n:'GHOST TAPPING',fmt:v=>v?'ON':'OFF'},
  {k:'hitsound',n:'HIT SOUNDS',   fmt:v=>v?'ON':'OFF'},
  {k:'bot',     n:'BOTPLAY',      fmt:v=>v?'ON':'OFF'},
  {k:'flash',   n:'BG FLASHES',   fmt:v=>v?'ON':'OFF'}
];
let optSel=0;
ST.options={
  draw(){
    drawStage(g,G.t/(60000/104),0,false);
    txt(g,'OPTIONS',W/2,80,58,'#fff','center',9,'#000');
    txt(g,'Left/Right = adjust · Enter = toggle · Backspace = back',W/2,130,19,'#8fa0c8','center',4,'#000');
    for(let i=0;i<OPT_ROWS.length;i++){
      const o=OPT_ROWS[i],y=215+i*72,sel=optSel===i;
      if(sel){
        g.fillStyle='rgba(255,255,255,.08)';
        g.beginPath();g.roundRect(W/2-330,y-30,660,58,12);g.fill();
      }
      txt(g,(sel?'> ':'')+o.n,W/2-300,y,32,sel?'#ffe14d':'#dfe6ff','left',6,'#000');
      const v=G.options[o.k];
      txt(g,o.fmt?o.fmt(v):(v?'ON':'OFF'),W/2+300,y,32,sel?'#7fd0ff':'#9fb4ff','right',6,'#000');
    }
    txt(g,'DFJK to hit notes · arrows also work · options save automatically',
        W/2,680,19,'#6c7ca6','center',4,'#000');
  },
  key(e){
    const k=e.code,o=OPT_ROWS[optSel];
    if(k==='ArrowUp'||k==='KeyW')optSel=(optSel+OPT_ROWS.length-1)%OPT_ROWS.length;
    else if(k==='ArrowDown'||k==='KeyS')optSel=(optSel+1)%OPT_ROWS.length;
    else if(k==='ArrowLeft'||k==='KeyA'){
      if(o.k==='speed')G.options.speed=clamp(Math.round((G.options.speed-o.st)*10)/10,o.lo,o.hi);
      else G.options[o.k]=!G.options[o.k];
      store.set('opts',G.options);
    }
    else if(k==='ArrowRight'||k==='KeyD'){
      if(o.k==='speed')G.options.speed=clamp(Math.round((G.options.speed+o.st)*10)/10,o.lo,o.hi);
      else G.options[o.k]=!G.options[o.k];
      store.set('opts',G.options);
    }
    else if(k==='Enter'||k==='Space'){
      if(o.k!=='speed')G.options[o.k]=!G.options[o.k];
      store.set('opts',G.options);
    }
    else if(k==='Backspace'||k==='Escape')G.state=G.optsFrom;
  },
  tap(x,y){
    for(let i=0;i<OPT_ROWS.length;i++){
      const yy=215+i*72;
      if(Math.abs(y-yy)<34){
        if(x>W/2+120||optSel===i&&x>W/2){
          const o=OPT_ROWS[i];
          if(o.k==='speed')G.options.speed=clamp(Math.round((G.options.speed+(x>W/2?0.1:-0.1))*10)/10,o.lo,o.hi);
          else G.options[o.k]=!G.options[o.k];
          store.set('opts',G.options);
        }else optSel=i;
        return;
      }
    }
    G.state=G.optsFrom;
  }
};

/* ---------------- GAME OVER ---------------- */
ST.gameover={
  draw(){
    g.fillStyle='#05060e';g.fillRect(0,0,W,H);
    g.fillStyle='rgba(40,10,20,.25)';g.fillRect(0,0,W,H);
    drawIcon(g,W/2,250,190,0,true,0);
    txt(g,'YOU GOT STRUCK DOWN',W/2,420,52,'#e05555','center',10,'#000');
    txt(g,'STORMCLOUD wins this round... run it back?',W/2,480,24,'#9fb4ff','center',5,'#000');
    drawKeyCap(g,W/2-160,575,56,'ENTER','#ffe14d');
    txt(g,'RETRY',W/2-160,620,22,'#fff','center',5,'#000');
    drawKeyCap(g,W/2+160,575,56,'BACK','#3a4a7a');
    txt(g,'MENU',W/2+160,620,22,'#fff','center',5,'#000');
    txt(g,'iPad: tap RETRY or MENU',W/2,680,18,'#6c7ca6','center',4,'#000');
  },
  key(e){
    const k=e.code;
    if(k==='Enter'||k==='Space'){AE.resume();startPlay(G.songIdx,G.diff);}
    else if(k==='Backspace'||k==='Escape'||k==='KeyP'){AE.resume();exitToMenu();}
  },
  tap(x,y){
    if(x<W/2){AE.resume();startPlay(G.songIdx,G.diff);}
    else{AE.resume();exitToMenu();}
  }
};

/* ---------------- RESULTS ---------------- */
ST.results={
  draw(){
    const s=G.lastStats;
    drawStage(g,G.t/(60000/104),0,false);
    txt(g,'SONG CLEARED!',W/2,86,60,'#66e84c','center',10,'#000');
    txt(g,s.songName+' - '+DIFF_NAME[s.diff],W/2,142,26,'#9fb4ff','center',5,'#000');
    /* rank badge */
    g.save();g.translate(W/2-330,330);
    const sc=1+0.04*Math.sin(G.t/220);
    g.scale(sc,sc);
    g.fillStyle='rgba(10,14,30,.9)';
    g.beginPath();g.arc(0,0,110,0,TAU);g.fill();
    g.strokeStyle=s.rankCol;g.lineWidth=6;g.stroke();
    txt(g,s.rank,0,8,s.rank.length>1?84:120,s.rankCol,'center',12,'#000');
    g.restore();
    const rows=[
      ['SCORE',Math.floor(s.score)],
      ['ACCURACY',s.acc.toFixed(2)+'%'],
      ['MAX COMBO',s.maxCombo+' / '+s.notes],
      ['MISSES',s.misses],
      ['SICK / GOOD',s.ratings.sick+' / '+s.ratings.good],
      ['BAD / SHIT',s.ratings.bad+' / '+s.ratings.shit]
    ];
    for(let i=0;i<rows.length;i++){
      const y=210+i*52;
      txt(g,rows[i][0],W/2-300,y,26,'#7688b8','left',4,'#000');
      txt(g,rows[i][1],W/2+180,y,30,'#fff','right',5,'#000');
    }
    if(G.newBest&&G.t%700<450)
      txt(g,'NEW HIGHSCORE!',W/2,560,36,'#ffe14d','center',8,'#000');
    txt(g,'Enter / tap = back to freeplay',W/2,650,22,'#8fa0c8','center',4,'#000');
    txt(g,'PRIME ENGINE v1.0',W/2,692,16,'#5a6a94','center',4,'#000');
  },
  key(e){
    if(e.code==='Enter'||e.code==='Space'||e.code==='Backspace'||e.code==='Escape'){
      startMenuMusic();G.state='freeplay';
    }
  },
  tap(){startMenuMusic();G.state='freeplay';}
};

/* ---------------- INPUT WIRING ---------------- */
addEventListener('keydown',e=>{
  AE.init();AE.resume();
  if(!AE.seq.playing&&(G.state==='title'||G.state==='freeplay'||G.state==='options'))startMenuMusic();
  if(e.code==='Space'||e.code==='Backspace'||KEYMAP.hasOwnProperty(e.code))e.preventDefault();
  const st=ST[G.state];
  if(st&&st.key)st.key(e);
});
addEventListener('keyup',e=>{
  if(KEYMAP.hasOwnProperty(e.code)&&G.state==='play')releaseLane(KEYMAP[e.code]);
});

function canvasXY(clientX,clientY){
  const r=cv.getBoundingClientRect();
  return{x:(clientX-r.left)/r.width*W,y:(clientY-r.top)/r.height*H};
}
const touchLane={};
function tapStart(id,x,y){
  AE.init();AE.resume();
  if(!AE.seq.playing&&(G.state==='title'||G.state==='freeplay'||G.state==='options'))startMenuMusic();
  if(G.state==='play'){
    if(P.paused){
      for(let i=0;i<4;i++)if(Math.abs(y-(320+i*72))<34){P.pauseSel=i;pauseAction();break;}
      return;
    }
    /* pause button */
    const pbx=W-56,pby=G.options.down?H-56:56;
    if(Math.hypot(x-pbx,y-pby)<46){togglePause();return;}
    const lane=clamp(Math.floor(x/(W/4)),0,3);
    touchLane[id]=lane;
    pressLane(lane);
    return;
  }
  const st=ST[G.state];
  if(st&&st.tap)st.tap(x,y);
}
function tapEnd(id){
  if(G.state==='play'&&touchLane.hasOwnProperty(id)){
    releaseLane(touchLane[id]);
    delete touchLane[id];
  }
}
cv.addEventListener('touchstart',e=>{
  e.preventDefault();
  for(const t of e.changedTouches){const p=canvasXY(t.clientX,t.clientY);tapStart(t.identifier,p.x,p.y);}
},{passive:false});
cv.addEventListener('touchend',e=>{
  e.preventDefault();
  for(const t of e.changedTouches)tapEnd(t.identifier);
},{passive:false});
cv.addEventListener('touchcancel',e=>{
  for(const t of e.changedTouches)tapEnd(t.identifier);
});
cv.addEventListener('mousedown',e=>{
  const p=canvasXY(e.clientX,e.clientY);
  tapStart('m',p.x,p.y);
});
addEventListener('mouseup',()=>tapEnd('m'));
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&G.state==='play'&&!P.paused&&!P.dead)togglePause();
});

/* ---------------- MAIN LOOP ---------------- */
let lastFrame=0;
function loop(ts){
  requestAnimationFrame(loop);
  const dt=Math.min(48,(ts-lastFrame)||16);
  lastFrame=ts;
  G.t+=dt;
  const st=ST[G.state];
  if(st){
    if(st.update)st.update(dt);
    st.draw();
  }
  /* debug hook */
  window.__DBG={state:G.state,score:P.score||0,misses:P.misses||0,
    health:P.health||0,songTime:P.songTime||0,err:ERR.join(' | ')};
}

/* ---------------- BOOT ---------------- */
for(let i=0;i<4;i++)HOLD_PAT.push(g.createPattern(HOLD_TILE[i],'repeat'));
ST.title.enter();
requestAnimationFrame(loop);
</script>
</body>
</html>
