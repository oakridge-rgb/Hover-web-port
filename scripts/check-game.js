const fs=require('fs');
const html=fs.readFileSync('/home/z/my-project/download/fnf-vs-glitch-hard-mod.html','utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m){console.error('NO SCRIPT FOUND');process.exit(1);}
fs.writeFileSync('/tmp/game.js',m[1]);
try{new Function(m[1]);console.log('SYNTAX OK, script length:',m[1].length,'chars');}
catch(e){console.error('SYNTAX ERROR:',e.message);
  // locate line
  const lines=m[1].split('\n');
  console.error('total lines:',lines.length);
  process.exit(1);}
