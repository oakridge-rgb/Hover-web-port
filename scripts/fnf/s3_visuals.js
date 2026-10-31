/* =====================================================================
   VISUALS: prerendered note sprites, characters, stage
   ===================================================================== */
const LANE_COL=['#C24B99','#00E5FF','#12FA05','#F9393F'];
const LANE_ROT=[-Math.PI/2,Math.PI,0,Math.PI/2]; /* base arrow points UP */
const NOTE_R=49;

function arrowPath(c,s){
  c.beginPath();
  c.moveTo(0,-s);
  c.lineTo(s*0.68,-s*0.05);
  c.lineTo(s*0.28,-s*0.05);
  c.lineTo(s*0.28,s*0.95);
  c.lineTo(-s*0.28,s*0.95);
  c.lineTo(-s*0.28,-s*0.05);
  c.lineTo(-s*0.68,-s*0.05);
  c.closePath();
}
function makeArrowSprite(col,mode){ /* mode: 0 static, 1 press, 2 confirm */
  const S=128,cnv=document.createElement('canvas');cnv.width=S;cnv.height=S;
  const c=cnv.getContext('2d');
  c.translate(S/2,S/2);c.rotate(LANE_ROT[LANE_COL.indexOf(col)]||0);
  const s=NOTE_R+8;
  if(mode===2){ /* outer glow */
    c.shadowColor=col;c.shadowBlur=26;
  }
  /* dark base outline */
  arrowPath(c,s);
  c.lineWidth=13;c.strokeStyle='#111';c.stroke();
  /* white body */
  arrowPath(c,s-6);
  c.fillStyle=mode===0?shade(col,-62):col;
  c.fill();
  c.lineWidth=6;c.strokeStyle='#fff';c.stroke();
  /* inner bright edge */
  arrowPath(c,s-16);
  c.lineWidth=3;
  c.strokeStyle=mode===0?'rgba(255,255,255,.25)':'rgba(255,255,255,.75)';
  c.stroke();
  return cnv;
}
function shade(hex,amt){
  const n=parseInt(hex.slice(1),16);
  let r=clamp((n>>16)+amt,0,255),gc=clamp(((n>>8)&255)+amt,0,255),b=clamp((n&255)+amt,0,255);
  return 'rgb('+r+','+gc+','+b+')';
}
const SPR={static:[],press:[],confirm:[]};
for(let i=0;i<4;i++){
  SPR.static.push(makeArrowSprite(LANE_COL[i],0));
  SPR.press.push(makeArrowSprite(LANE_COL[i],1));
  SPR.confirm.push(makeArrowSprite(LANE_COL[i],2));
}
/* sustain ribbon tile */
const HOLD_TILE=LANE_COL.map(col=>{
  const cnv=document.createElement('canvas');cnv.width=36;cnv.height=64;
  const c=cnv.getContext('2d');
  c.fillStyle=shade(col,-40);
  c.fillRect(0,0,36,64);
  c.fillStyle='rgba(255,255,255,.28)';
  c.fillRect(4,0,8,64);
  c.fillStyle='rgba(0,0,0,.3)';
  c.fillRect(28,0,5,64);
  return cnv;
});

/* ---------------- stage / background ---------------- */
const BG_CLOUDS=[];
{const r=mulberry32(42);
 for(let i=0;i<9;i++)BG_CLOUDS.push({x:r()*1280,y:60+r()*220,w:220+r()*300,h:46+r()*60,a:.10+r()*.16,s:.3+r()*.7});}

function drawStage(c,beat,flash,stormy){
  const grd=c.createLinearGradient(0,0,0,H);
  if(stormy){grd.addColorStop(0,'#05060e');grd.addColorStop(.6,'#141a33');grd.addColorStop(1,'#0a0d1c');}
  else{grd.addColorStop(0,'#0a0e1c');grd.addColorStop(.6,'#1b2444');grd.addColorStop(1,'#11152b');}
  c.fillStyle=grd;c.fillRect(0,0,W,H);
  /* clouds */
  for(const cl of BG_CLOUDS){
    c.fillStyle='rgba(30,38,72,'+cl.a+')';
    const w=cl.w*(1+Math.sin(beat*0.5+cl.s*9)*0.02);
    c.beginPath();c.ellipse(cl.x,cl.y+Math.sin(beat*0.22+cl.s*7)*5,w,cl.h,0,0,TAU);c.fill();
    c.beginPath();c.ellipse(cl.x-w*.4,cl.y+14,w*.5,cl.h*.7,0,0,TAU);c.fill();
  }
  /* lightning flash */
  if(flash>0.01){
    c.fillStyle='rgba(190,215,255,'+(flash*0.28)+')';c.fillRect(0,0,W,H);
    c.strokeStyle='rgba(255,255,255,'+flash+')';c.lineWidth=3.5;
    c.beginPath();
    let lx=200+((beat*137)%880),ly=0;
    c.moveTo(lx,ly);
    while(ly<430){lx+=(Math.sin(ly*0.7+beat*31)>0?1:-1)*(18+((ly*7)%46));ly+=52+((ly*3)%40);c.lineTo(lx,ly);}
    c.stroke();
  }
  /* floor platform */
  c.fillStyle='rgba(0,0,0,.35)';
  c.fillRect(0,560,W,160);
  c.strokeStyle='rgba(130,160,255,.14)';c.lineWidth=2;
  c.beginPath();c.moveTo(0,560);c.lineTo(W,560);c.stroke();
}

/* ---------------- characters ---------------- */
/* VOLT — the player: teal hoodie, white head, big headphones */
function drawVolt(c,x,y,pose,bob,scale){
  c.save();c.translate(x,y+bob*0.4);c.scale(scale,scale);
  const sx=pose===0?-16:pose===3?16:0, sy=pose===1?10:pose===2?-10:0;
  /* legs */
  c.fillStyle='#233a4d';
  c.fillRect(-26,-38,20,40);c.fillRect(6,-38,20,40);
  c.fillStyle='#101820';
  c.fillRect(-30,-4,28,10);c.fillRect(4,-4,28,10);
  /* body (hoodie) */
  c.fillStyle='#1fae8e';
  c.beginPath();c.roundRect(-40,-128,80,96,18);c.fill();
  c.fillStyle='#177a66';
  c.beginPath();c.roundRect(-40,-62,80,30,10);c.fill();
  /* lightning chest logo */
  c.fillStyle='#ffe14d';
  c.beginPath();c.moveTo(2,-112);c.lineTo(-10,-84);c.lineTo(-2,-84);c.lineTo(-8,-62);c.lineTo(10,-90);c.lineTo(0,-90);c.closePath();c.fill();
  /* arms — sing pose points to the note direction */
  c.strokeStyle='#1fae8e';c.lineWidth=15;c.lineCap='round';
  c.beginPath();c.moveTo(-34,-108);
  if(pose===0){c.lineTo(-72,-108);}else{c.lineTo(-52,-72);}
  c.stroke();
  c.beginPath();c.moveTo(34,-108);
  if(pose===3){c.lineTo(72,-108);}else{c.lineTo(52,-72);}
  c.stroke();
  c.strokeStyle='#e8d8c4';
  c.lineWidth=9;
  const hx=pose===0?-74:pose===3?74:(pose===1?-54:54),hy=pose===1?-72:pose===2?-70:-72;
  c.beginPath();c.moveTo(hx===-74?-72:hx===74?72:hx===-54?-50:50,hy+4);c.lineTo(hx,hy);c.stroke();
  /* head */
  c.save();c.translate(sx*0.7,sy*0.7);
  c.fillStyle='#f4ead8';
  c.beginPath();c.arc(0,-158,34,0,TAU);c.fill();
  /* headphones */
  c.strokeStyle='#111';c.lineWidth=7;
  c.beginPath();c.arc(0,-160,40,Math.PI*1.05,Math.PI*1.95);c.stroke();
  c.fillStyle='#e63946';
  c.beginPath();c.roundRect(-46,-176,14,26,6);c.fill();
  c.beginPath();c.roundRect(32,-176,14,26,6);c.fill();
  /* eyes + mouth */
  c.fillStyle='#111';
  c.beginPath();c.arc(-12,-160,4.6,0,TAU);c.fill();
  c.beginPath();c.arc(12,-160,4.6,0,TAU);c.fill();
  c.beginPath();c.arc(0,-146,8,0.15*Math.PI,0.85*Math.PI);c.lineWidth=3.4;c.strokeStyle='#111';c.stroke();
  c.restore();
  c.restore();
}

/* STORMCLOUD — the opponent: living thunderhead, glowing eyes */
function drawCloud(c,x,y,pose,bob,scale,angry){
  c.save();c.translate(x,y+bob*0.35);c.scale(scale,scale);
  const sx=pose===0?-18:pose===3?18:0, sy=pose===1?12:pose===2?-12:0;
  const dark=angry?'#23283b':'#2b3350';
  /* body: cloud blob */
  c.fillStyle=dark;
  c.beginPath();
  c.arc(-46,-84,34,0,TAU);c.arc(0,-108,46,0,TAU);c.arc(48,-84,34,0,TAU);
  c.arc(-20,-64,40,0,TAU);c.arc(26,-64,38,0,TAU);
  c.fill();
  c.fillStyle='rgba(90,110,180,.25)';
  c.beginPath();c.arc(0,-118,34,0,TAU);c.fill();
  /* legs: little wisps */
  c.strokeStyle=dark;c.lineWidth=16;c.lineCap='round';
  c.beginPath();c.moveTo(-30,-40);c.lineTo(-34,-2);c.stroke();
  c.beginPath();c.moveTo(28,-40);c.lineTo(32,-2);c.stroke();
  /* arms */
  c.strokeStyle=dark;c.lineWidth=14;
  const ax=pose===0?-64:pose===3?64:(pose===2?46:-46);
  const ay=pose===2?-150:pose===1?-40:-100;
  c.beginPath();c.moveTo(-52,-84);c.lineTo(pose===0?-82:ax,ay);c.stroke();
  c.beginPath();c.moveTo(52,-84);c.lineTo(pose===3?82:pose===0?-20:20,pose===1?-40:-84-(pose===2?60:0));c.stroke();
  /* lightning sparks when singing */
  if(pose>=0){
    c.strokeStyle='rgba(255,235,120,.9)';c.lineWidth=3;
    c.beginPath();c.moveTo(ax*0.8,ay+8);c.lineTo(ax*0.8+12,ay+26);c.lineTo(ax*0.8-4,ay+26);c.lineTo(ax*0.8+10,ay+46);c.stroke();
  }
  /* face */
  c.save();c.translate(sx*0.6,sy*0.6);
  const ey=-104;
  c.fillStyle='#0affff';
  c.shadowColor='#0affff';c.shadowBlur=12;
  c.beginPath();c.moveTo(-26,ey);c.lineTo(-8,ey+6);c.lineTo(-26,ey+12);c.closePath();c.fill();
  c.beginPath();c.moveTo(26,ey);c.lineTo(8,ey+6);c.lineTo(26,ey+12);c.closePath();c.fill();
  c.shadowBlur=0;
  c.strokeStyle='#0affff';c.lineWidth=3.4;
  c.beginPath();
  if(angry)c.arc(0,ey+34,12,1.15*Math.PI,1.85*Math.PI);
  else c.arc(0,ey+26,12,0.15*Math.PI,0.85*Math.PI);
  c.stroke();
  c.restore();
  c.restore();
}

/* health bar icons */
function drawIcon(c,x,y,s,who,losing,bounce){
  c.save();c.translate(x,y);const sc=1+bounce*0.06;c.scale(sc*s/60,sc*s/60);
  if(who===0){ /* VOLT icon */
    c.fillStyle=losing?'#e07070':'#f4ead8';
    c.beginPath();c.arc(0,0,28,0,TAU);c.fill();
    c.strokeStyle='#111';c.lineWidth=3;c.stroke();
    c.fillStyle='#e63946';
    c.beginPath();c.roundRect(-30,-16,10,18,4);c.fill();
    c.beginPath();c.roundRect(20,-16,10,18,4);c.fill();
    c.fillStyle='#111';
    c.beginPath();c.arc(-9,losing?2:-2,3.4,0,TAU);c.fill();
    c.beginPath();c.arc(9,losing?2:-2,3.4,0,TAU);c.fill();
    c.beginPath();
    if(losing)c.arc(0,20,7,1.1*Math.PI,1.9*Math.PI);
    else c.arc(0,10,7,0.15*Math.PI,0.85*Math.PI);
    c.lineWidth=2.6;c.strokeStyle='#111';c.stroke();
  }else{ /* STORMCLOUD icon */
    c.fillStyle=losing?'#141824':'#2b3350';
    c.beginPath();
    c.arc(-14,2,13,0,TAU);c.arc(0,-6,16,0,TAU);c.arc(15,2,13,0,TAU);
    c.fill();
    c.strokeStyle='#0affff';c.lineWidth=2.6;c.shadowColor='#0affff';c.shadowBlur=6;
    c.beginPath();c.moveTo(-18,-2);c.lineTo(-8,2);c.lineTo(-18,6);c.closePath();c.stroke();
    c.beginPath();c.moveTo(18,-2);c.lineTo(8,2);c.lineTo(18,6);c.closePath();c.stroke();
    c.shadowBlur=0;
  }
  c.restore();
}

/* key cap (title screen + tutorial) */
function drawKeyCap(c,x,y,s,label,col){
  c.save();c.translate(x,y);
  c.fillStyle='rgba(10,12,24,.85)';
  c.beginPath();c.roundRect(-s/2,-s/2,s,s,10);c.fill();
  c.strokeStyle=col;c.lineWidth=3;c.stroke();
  txt(c,label,0,2,s*0.5,'#fff','center',4,'#000');
  c.restore();
}
