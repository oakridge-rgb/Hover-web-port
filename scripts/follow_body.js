const nodeStream = require('node:stream');
const nodeTls = require('node:tls');
function g0Duplex(s){
  const d = new nodeStream.Duplex({ write(chunk,enc,cb){ try{ s.send(new Uint8Array(chunk)); cb(); }catch(e){ cb(e);} }, read(){} });
  s.addEventListener('message', e => d.push(Buffer.from(e.data)));
  s.addEventListener('close', () => d.push(null));
  d.on('error', ()=>{});
  return d;
}
async function test(ep, host){
  const conn = await new Promise((res,rej)=>{
    const c = new Di(ep);
    const t=setTimeout(()=>rej(new Error('ws-timeout')),9000);
    c.addEventListener('open',()=>{clearTimeout(t);res(c);});
    c.addEventListener('error',()=>{clearTimeout(t);rej(new Error('ws-err'));});
  });
  const s = conn.create_stream(host,443,'tcp');
  await new Promise((res,rej)=>{
    const t=setTimeout(()=>rej(new Error('stream-timeout')),10000);
    const p=setInterval(()=>{ if(typeof s.buffer_size==='number'){clearInterval(p);clearTimeout(t);res();} },25);
  });
  const tlsSock = await new Promise((res,rej)=>{
    const sock = nodeTls.connect({socket:g0Duplex(s),servername:host,rejectUnauthorized:false,ALPNProtocols:['http/1.1']},()=>res(sock));
    sock.once('error',e=>rej(new Error('tls-'+e.code)));
    setTimeout(()=>rej(new Error('tls-timeout')),12000);
  });
  return await new Promise((res)=>{
    let acc=Buffer.alloc(0), status=null, title=null, loc=null, done=false;
    const fin=()=>{ if(done)return; done=true; try{tlsSock.destroy();}catch(e){} try{s.close(0);}catch(e){}
      res({status,title,loc}); try{conn.ws.close();}catch(e){} };
    const to=setTimeout(fin,14000);
    tlsSock.on('data',c=>{ acc=Buffer.concat([acc,c]);
      if(status===null){ const i=acc.indexOf('\r\n\r\n'); if(i>=0){ const head=acc.slice(0,i).toString('latin1');
        const m=/^HTTP\/[\d.]+ (\d{3})/.exec(head); status=m?+m[1]:null;
        const lm=/^location:\s*(\S+)/im.exec(head); if(lm) loc=lm[1];
        const tm=/<title[^>]*>([^<]{0,120})/i.exec(acc.slice(i+4).toString('latin1')); if(tm) title=tm[1];
      }}
      if(acc.length>60000) fin(); });
    tlsSock.on('close',()=>fin()); tlsSock.on('end',()=>fin()); tlsSock.on('error',()=>fin());
    tlsSock.write(`GET / HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36\r\nAccept: text/html\r\nConnection: close\r\n\r\n`);
  });
}
(async()=>{
  const EP='wss://browserjs-production.up.railway.app/wisp/';
  for(const h of ['moanatv.lfmx.app','www.1shows.org','www.lookmovie2.to','pressplayz.top','www.movy.sx']){
    try{ const r = await test(EP,h);
      console.log(h.padEnd(24), r.status, JSON.stringify((r.title||r.loc||'').slice(0,70)));
    }catch(e){ console.log(h.padEnd(24), 'FAIL', e.message); }
  }
  process.exit(0);
})();
