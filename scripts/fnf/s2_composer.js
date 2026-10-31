/* =====================================================================
   MUSIC + CHART COMPOSER
   Every song is data-driven: chord prog + section layout -> synth events
   (audio) and note charts (Easy / Normal / Hard) generated from the
   melody itself, so the arrows ALWAYS match what you hear.
   Spam techniques: 32nd-bursts, zigzags, jackhammers, stairs, rolls.
   ===================================================================== */
const MINOR=[0,2,3,5,7,8,10];
function mtof(m){return 440*Math.pow(2,(m-69)/12)}

const RHYTHM={
 0:[[0,8],[0,4,8,12],[0,6,8],[0,8,12]],
 1:[[0,2,4,8,10,12],[0,4,6,8,12,14],[0,2,8,10,12],[0,3,6,8,11,14]],
 2:[[0,2,4,6,8,10,12,14],[0,1,2,4,8,9,10,12],[0,2,3,4,8,10,11,12],[0,2,4,7,8,10,12,15]],
 3:[[0,1,2,3,4,6,8,9,10,12,14,15],[0,2,3,4,6,8,10,11,12,14,15],[0,1,2,4,5,6,8,10,12,13,14]],
 4:[[0,1,2,3,4,5,6,7,8,10,12,13,14,15],[0,1,2,4,6,8,9,10,12,13,14,15],[0,1,2,3,8,9,10,11,12,13,14,15]]
};

const SECTYPE={
  intro :{drums:0,mel:0,crash:true},
  verse :{drums:1,mel:1},
  verse2:{drums:2,mel:2},
  chorus:{drums:2,mel:2,pad:true,crash:true},
  chorus2:{drums:2,mel:3,pad:true,crash:true},
  bridge:{drums:1,mel:1,pad:true},
  jacksec:{drums:2,mel:2,jack:true,crash:true},
  drop  :{drums:3,mel:3,burst:true,crash:true},
  chaos :{drums:3,mel:4,zig:true,burst:true,crash:true},
  build :{drums:2,mel:0,stairs:true,riser:true},
  break :{drums:0,mel:0,pad:true},
  outro :{drums:1,mel:1}
};

function chordTones(off){
  if(off===8||off===10||off===3)return[off,off+4,off+7]; /* major */
  return[off,off+3,off+7]; /* minor */
}

function genSong(cfg){
  const rng=mulberry32(cfg.seed);
  const step=60000/cfg.bpm/4;           /* ms per 16th step */
  const beat=60000/cfg.bpm;
  const ev=[];                          /* audio events */
  const pN=[],oN=[];                    /* player / opponent melody notes */
  const regs=[];                        /* chart pattern directives */
  let absStep=0;

  for(const sec of cfg.sections){
    const S=SECTYPE[sec.type];
    const secStep0=absStep;
    let deg=6;
    for(let bar=0;bar<sec.bars;bar++){
      const barStep=absStep+bar*16;
      const chord=chordTones(cfg.prog[bar%cfg.prog.length]);
      const barT=barStep*step;
      /* ---------- drums ---------- */
      const D=S.drums;
      if(sec.type!=='break'){
        if(D===0){
          ev.push({t:barT,ch:'kick',v:.8});
          for(let i=0;i<16;i+=2)ev.push({t:(barStep+i)*step,ch:'hat',v:.5});
        }
        if(D>=1){
          ev.push({t:barT,ch:'kick',v:1});ev.push({t:(barStep+8)*step,ch:'kick',v:.9});
          ev.push({t:(barStep+4)*step,ch:'snare',v:1});ev.push({t:(barStep+12)*step,ch:'snare',v:1});
          for(let i=0;i<16;i+=2)ev.push({t:(barStep+i)*step,ch:'hat',v:i%4===0?.7:.5});
        }
        if(D>=2){
          if(bar%2===1)ev.push({t:(barStep+6)*step,ch:'kick',v:.8});
          ev.push({t:(barStep+14)*step,ch:'hat',open:true,v:.6});
        }
        if(D>=3){
          ev.push({t:(barStep+3)*step,ch:'kick',v:.85});ev.push({t:(barStep+10)*step,ch:'kick',v:.85});
          for(let i=1;i<16;i+=2)ev.push({t:(barStep+i)*step,ch:'hat',v:.4});
        }
      }else{
        for(let i=0;i<16;i+=4)ev.push({t:(barStep+i)*step,ch:'hat',v:.35});
      }
      /* ---------- bass (8ths) ---------- */
      if(sec.type!=='break'){
        const bassRoot=cfg.bass+cfg.prog[bar%cfg.prog.length];
        for(let i=0;i<16;i+=2){
          const oct=(i===6||i===14)?12:0;
          ev.push({t:(barStep+i)*step,ch:'bass',f:mtof(bassRoot+oct),d:step*1.6,v:D>=3?.9:.75});
        }
      }
      /* ---------- pads ---------- */
      if(S.pad){
        const pr=cfg.key+cfg.prog[bar%cfg.prog.length];
        if(sec.type==='bridge'||sec.type==='break')
          ev.push({t:barT,ch:'pad',f:[pr,pr+7,pr+15].map(mtof),d:beat*4,v:.8});
        else for(const i of[2,6,10,14])
          ev.push({t:(barStep+i)*step,ch:'pad',f:[pr,pr+7,pr+15].map(mtof),d:step*2.2,v:.9});
      }
      /* ---------- player melody ---------- */
      if(sec.who!=='o'){
        const pStart=pN.length;
        let steps;
        if(S.jack)steps=[0,4,8,12];
        else if(S.stairs)steps=[0,4,8,12];
        else if(S.zig)steps=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
        else steps=RHYTHM[S.mel][(bar+(rng()<.5?0:2))%RHYTHM[S.mel].length];
        const melRoot=cfg.key+12;
        for(let si=0;si<steps.length;si++){
          const st=steps[si];
          let midi,dur;
          if(S.stairs){
            deg=3+((bar*4+si)%11);
            midi=melRoot+MINOR[deg%7]+12*Math.floor(deg/7);
            dur=beat*0.85;
          }else if(S.jack){
            if(si===0)deg=6;
            midi=melRoot+MINOR[deg%7];
            dur=step*2.6;
          }else{
            if(st%4===0){
              const target=melRoot+MINOR[deg%7];
              let best=chord[0],bd=999;
              for(const c of chord){for(const o of[0,12]){
                const m=melRoot+c+o,d2=Math.abs(m-target);
                if(d2<bd){bd=d2;best=m;}}}
              midi=best;
              const rel=midi-melRoot;
              const di=MINOR.indexOf(rel%12);
              if(di>=0)deg=Math.floor(rel/12)*7+di;
              if(deg<3)deg=3;if(deg>13)deg=13;
            }else{
              const mv=[-2,-1,0,1,2][(rng()*5)|0];
              deg=clamp(deg+mv,3,13);
              midi=melRoot+MINOR[deg%7]+12*Math.floor(deg/7);
            }
            dur=step*(S.zig?0.9:1.6);
          }
          const t=(barStep+st)*step;
          ev.push({t,ch:'lead',f:mtof(midi),d:Math.max(step*0.9,dur),v:.9,x:S.zig||S.jack});
          pN.push({t,d:dur});
        }
        /* 32nd-note burst at end of bar (Applecore style) */
        if(S.burst){
          const bFrom=pN.length;
          const midi=melRoot+MINOR[deg%7];
          for(let k=0;k<8;k++){
            const t=(barStep+12)*step+k*step/2;
            ev.push({t,ch:'lead',f:mtof(midi+(k%2?12:0)),d:step*0.42,v:.9,x:true});
            pN.push({t,d:step*0.3});
          }
          const roll=rng()<.5;
          regs.push({from:bFrom,count:8,mode:roll?'roll':'trill'});
        }
        if(S.zig){
          const pa=rng()<.5?0:1;
          regs.push({from:pStart,count:16,mode:'zig',pa,pb:pa+2});
        }
        if(S.jack)regs.push({from:pStart,count:4,mode:'jack'});
      }
      /* ---------- opponent melody ---------- */
      if(sec.who!=='p'&&S.mel>0){
        const chordA=chordTones(cfg.prog[bar%cfg.prog.length]);
        const oroot=cfg.bass+cfg.prog[bar%cfg.prog.length]+12;
        const osteps=S.drums>=3?[0,2,4,6,8,10,12,14]:[0,4,8,12];
        for(let si=0;si<osteps.length;si++){
          const st=osteps[si];
          const tone=chordA[[0,1,2,1][si%4]]+(si===3?12:0);
          const t=(barStep+st)*step;
          ev.push({t,ch:'opp',f:mtof(oroot+tone),d:step*1.8,v:.85});
          oN.push({t,d:step*1.4});
        }
      }
    }
    if(S.crash)ev.push({t:secStep0*step,ch:'crash',v:1});
    if(S.riser)ev.push({t:secStep0*step,ch:'riser',d:sec.bars*16*step});
    absStep+=sec.bars*16;
  }
  /* tail */
  ev.push({t:absStep*step,ch:'crash',v:1});
  ev.push({t:absStep*step,ch:'pad',f:[cfg.key,cfg.key+7,cfg.key+12].map(mtof),d:beat*2,v:.7});

  /* ---- shift everything by a 4-beat countdown lead-in ---- */
  const LEAD=beat*4;
  for(const e of ev)e.t+=LEAD;
  for(const n of pN)n.t+=LEAD;
  for(const n of oN)n.t+=LEAD;

  /* ---- lanes ---- */
  assignLanes(pN,regs,rng);
  assignLanes(oN,[],rng);

  /* holds */
  for(const n of pN)n.h=n.d>=step*5.5?n.d-step*2.2:0;

  const hard  =pN.map(n=>({t:Math.round(n.t),l:n.l,d:Math.round(n.h||0)}));
  const normal=filterChart(pN,step,1);
  const easy  =filterChart(pN,step,2);
  const opp   =oN.map(n=>({t:Math.round(n.t),l:n.l,d:0}));

  return{
    events:ev,
    dur:absStep*step+beat*2+LEAD,
    charts:{0:easy,1:normal,2:hard},
    opp,step,beat,
    noteCount:{0:easy.length,1:normal.length,2:hard.length}
  };
}

/* lane assignment: contour mapping + spam pattern overrides */
function assignLanes(notes,regions,rng){
  notes.sort((a,b)=>a.t-b.t);
  let lane=1+((rng()*2)|0),prevF=null;
  for(let i=0;i<notes.length;i++){
    const n=notes[i];
    const reg=regions.find(r=>i>=r.from&&i<r.from+r.count);
    n.reg=reg?reg.mode:null;
    if(reg){
      const k=i-reg.from;
      if(reg.mode==='zig')lane=(k%2===0)?reg.pa:reg.pb;
      else if(reg.mode==='trill')lane=(k%2===0)?1:2;
      else if(reg.mode==='roll')lane=k%4;
      else if(reg.mode==='jack')lane=Math.floor(k/2)%4;
      n.l=clamp(lane,0,3);
      continue;
    }
    if(prevF!=null){
      const d=n.f-prevF;
      if(d>0.5)lane+=1;
      else if(d<-0.5)lane-=1;
      else if(rng()<.3)lane+=rng()<.5?-1:1;
    }
    if(lane<0)lane=1;if(lane>3)lane=2;
    n.l=lane;prevF=n.f;
  }
}

/* difficulty thinning: lvl 1 = NORMAL, lvl 2 = EASY */
function filterChart(notes,step,lvl){
  const out=[];let lastT=-1e9,lastLane=-1,jackRun=0,ci=0;
  for(const n of notes){
    if(n.reg){ /* thin out spam patterns */
      ci++;
      if(lvl===1&&ci%2!==0)continue;
      if(lvl===2&&ci%4!==0)continue;
      out.push({t:n.t,l:n.l,d:n.h||0});
      lastT=n.t;lastLane=n.l;
      continue;
    }
    const minGap=step*(lvl===2?2:1);
    if(n.t-lastT<minGap-1)continue;
    if(n.l===lastLane){jackRun++;if(jackRun>=1+lvl)continue;}
    else jackRun=0;
    out.push({t:n.t,l:n.l,d:n.h||0});
    lastT=n.t;lastLane=n.l;
  }
  return out;
}

/* ---------------- THE SETLIST ---------------- */
const SONGS=[
 {id:'breeze',name:'BREEZE',sub:'a calm warm-up',bpm:168,speed:1.7,seed:1101,
  key:57,bass:45,prog:[0,8,10,7],
  sections:[
   {type:'intro',bars:2,who:'b'},{type:'verse',bars:4,who:'o'},{type:'verse',bars:4,who:'p'},
   {type:'chorus',bars:4,who:'b'},{type:'verse2',bars:4,who:'o'},{type:'verse2',bars:4,who:'p'},
   {type:'chorus',bars:6,who:'b'},{type:'bridge',bars:4,who:'o'},{type:'chorus2',bars:6,who:'b'},
   {type:'outro',bars:2,who:'b'}]},
 {id:'tempest',name:'TEMPEST',sub:'the storm rolls in',bpm:192,speed:2.0,seed:2202,
  key:55,bass:43,prog:[0,3,8,10],
  sections:[
   {type:'intro',bars:2,who:'b'},{type:'verse',bars:4,who:'o'},{type:'verse2',bars:4,who:'p'},
   {type:'chorus',bars:4,who:'b'},{type:'verse2',bars:4,who:'o'},{type:'verse2',bars:4,who:'p'},
   {type:'chorus2',bars:4,who:'b'},{type:'jacksec',bars:4,who:'b'},{type:'chorus2',bars:4,who:'b'},
   {type:'drop',bars:4,who:'b'},{type:'outro',bars:2,who:'b'}]},
 {id:'supercell',name:'SUPERCELL',sub:'GOOD LUCK.',bpm:210,speed:2.4,seed:3303,
  key:60,bass:48,prog:[0,8,5,10],
  sections:[
   {type:'break',bars:2,who:'b'},{type:'build',bars:4,who:'b'},{type:'drop',bars:4,who:'b'},
   {type:'break',bars:2,who:'b'},{type:'build',bars:4,who:'b'},{type:'drop',bars:4,who:'b'},
   {type:'bridge',bars:4,who:'o'},{type:'drop',bars:4,who:'b'},
   {type:'chaos',bars:4,who:'b'},{type:'jacksec',bars:4,who:'b'},{type:'chaos',bars:4,who:'b'},
   {type:'outro',bars:2,who:'b'}]}
];

/* menu music: chill 8-bar lo-fi loop */
function genMenuLoop(){
  const ev=[];const bpm=104,beat=60000/bpm,bar=beat*4;let t=0;
  const chords=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]];
  for(let b=0;b<8;b++){
    const c=chords[b%4];
    ev.push({t,ch:'pad',f:c.map(x=>mtof(x)),d:bar*0.95,v:.9});
    ev.push({t,ch:'bass',f:mtof(c[0]-12),d:beat*1.5,v:.5});
    ev.push({t,ch:'kick',v:.55});
    ev.push({t:t+beat*2,ch:'kick',v:.45});
    ev.push({t:t+beat,ch:'snare',v:.4});ev.push({t:t+beat*3,ch:'snare',v:.4});
    for(let i=0;i<8;i++)ev.push({t:t+i*beat/2,ch:'hat',v:i%2?.2:.32});
    for(let i=0;i<4;i++)ev.push({t:t+beat/2+i*beat,ch:'opp',f:mtof(c[(i+1)%3]+12),d:beat*.6,v:.4});
    t+=bar;
  }
  return{events:ev,dur:t};
}
