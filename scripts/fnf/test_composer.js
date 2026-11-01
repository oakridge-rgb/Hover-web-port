/* Standalone test harness for the composer (runs in Node) */
const fs=require('fs');
const src=fs.readFileSync('/home/z/my-project/scripts/fnf/s2_composer.js','utf8');
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const mod=new Function('clamp','mulberry32',src+'\nreturn {genSong,SONGS,filterChart,assignLanes,mtof,MINOR,genMenuLoop,chordTones};')(clamp,mulberry32);

const d=mod.genSong(mod.SONGS[0]);
const hard=d.charts[2],norm=d.charts[1];
console.log('hard notes:',hard.length,'normal notes:',norm.length,'easy notes:',d.charts[0].length);
let runs=[],runLen=1;
for(let i=1;i<hard.length;i++){
  if(hard[i].l===hard[i-1].l&&hard[i].t-hard[i-1].t<200){runLen++;}
  else{runs.push(runLen);runLen=1;}
}
runs.push(runLen);
runs.sort((a,b)=>b-a);
console.log('hard lane runs top10:',runs.slice(0,10),'(of',runs.length,'runs)');
console.log('normal first 20 lanes:',norm.slice(0,20).map(n=>n.l).join(','));
console.log('normal first 10 gaps:',norm.slice(0,10).map((n,i)=>i?Math.round(n.t-norm[i-1].t):'-').join(','));
console.log('step ms:',Math.round(d.step),'beat ms:',Math.round(d.beat));
// check pN lane sequence from hard: find long same-lane stretches
console.log('hard first 30 lanes:',hard.slice(0,30).map(n=>n.l).join(','));
