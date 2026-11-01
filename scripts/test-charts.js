// Stubs so the game script loads headlessly
global.window=global;global.innerWidth=1280;global.innerHeight=720;global.devicePixelRatio=1;
global.addEventListener=()=>{};
const el={getContext:()=>null,style:{},addEventListener:()=>{},width:0,height:0};
global.document={getElementById:()=>el,addEventListener:()=>{}};
global.localStorage={getItem:()=>null,setItem:()=>{}};
global.performance={now:()=>0};
global.requestAnimationFrame=()=>{};
const fs=require('fs');
const js=fs.readFileSync('/tmp/game.js','utf8');
const test=`
let fails=0;
function chk(c,msg){if(!c){console.error('FAIL:',msg);fails++;}}
for(const song of SONGS){
  for(const diff of DIFFS){
    const b=buildSong(song,diff);
    const st=60/song.bpm/4;
    chk(b.total>0,song.name+' total');
    chk(b.pl.flat().every(n=>n.t>=0&&n.t<b.total),song.name+' notes in range');
    chk(b.ev.every((e,i,a)=>i===0||a[i-1].t<=e.t),song.name+' events sorted');
    chk(b.pl.every(arr=>arr.every((n,i,a)=>i===0||a[i-1].t<=n.t)),song.name+' lane sorted');
    chk(b.pl.every(arr=>arr.every((n,i,a)=>i===0||n.t-a[i-1].t>=st*0.9)),song.name+' same-lane min gap');
    chk(b.ol.every(arr=>arr.every((n,i,a)=>i===0||n.t-a[i-1].t>=st*0.9)),song.name+' opp min gap');
    console.log(song.name.padEnd(16),diff.padEnd(7),'player notes:',String(b.pl.flat().length).padStart(4),' opp:',String(b.ol.flat().length).padStart(4),' length:',(b.total).toFixed(1)+'s',' speed:',b.speedMult.toFixed(2));
  }
}
// spot checks
const b3=buildSong(S3,'INSANE');
chk(b3.pl.flat().length>400,'meltdown insane should be huge, got '+b3.pl.flat().length);
const b1n=buildSong(S1,'NORMAL');
chk(b1n.pl.flat().length<buildSong(S1,'HARD').pl.flat().length,'normal < hard');
chk(buildSong(S1,'HARD').pl.flat().length<buildSong(S1,'INSANE').pl.flat().length,'hard < insane');
// simulate a full botplay run for song1 to exercise judge math
const sim=buildSong(S1,'HARD');
let accN=0,accSum=0,score=0,combo=0;
for(const lane of sim.pl){for(const n of lane){accN++;accSum+=1;score+=350+Math.min(++combo*10,500);}}
console.log('simulated full-combo score S1 HARD:',score,'acc:',(accSum/accN*100).toFixed(1)+'%');
if(fails){console.error('TESTS FAILED:',fails);process.exit(1);}
console.log('ALL CHART TESTS PASSED');
`;
eval(js+'\n'+test);
