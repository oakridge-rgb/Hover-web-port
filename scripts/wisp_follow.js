var dQ, A0;
function BC(m){}
dQ={CONNECT:1,DATA:2,CONTINUE:3,CLOSE:4},A0=[void 0,"CONNECT","DATA","CONTINUE","CLOSE"];function AC(I){if(I.length==4)return new Uint32Array(I.buffer)[0];if(I.length==2)return new Uint16Array(I.buffer)[0];if(I.length==1)return I[0];throw"invalid array length"}function NB(I,E){let i=new ArrayBuffer(E),t=new DataView(i);if(E==1)t.setUint8(0,I,!0);else if(E==2)t.setUint16(0,I,!0);else if(E==4)t.setUint32(0,I,!0);else throw"invalid array length";return new Uint8Array(i)}function ri(){let I=0;for(let t of arguments)I+=t.length;let E=new Uint8Array(I),i=0;for(let t of arguments)E.set(t,i),i+=t.length;return E}function gC(I,E,i){let t=NB(E,4),s=NB(I,1);return ri(s,t,i)}class g0 extends EventTarget{constructor(E,i,t,s,n,w,R){super(),this.hostname=E,this.port=i,this.ws=t,this.buffer_size=s,this.stream_id=n,this.connection=w,this.stream_type=R,this.send_buffer=[],this.open=!0}send(E){if(this.buffer_size>0||!this.open||this.stream_type===2){let i=gC(2,this.stream_id,E);this.ws.send(i),this.buffer_size--}else this.send_buffer.push(E)}continue_received(E){for(this.buffer_size=E;this.buffer_size>0&&this.send_buffer.length>0;)this.send(this.send_buffer.shift())}close(E=1){if(!this.open)return;let i=NB(E,1),t=gC(4,this.stream_id,i);this.ws.send(t),this.open=!1,delete this.connection.active_streams[this.stream_id]}}class Di extends EventTarget{constructor(E){if(super(),this.wisp_url=E,this.max_buffer_size=null,this.active_streams={},this.connected=!1,this.connecting=!1,this.next_stream_id=1,!this.wisp_url.endsWith("/"))throw"wisp endpoints must end with a trailing forward slash";this.connect_ws()}connect_ws(){this.ws=new WebSocket(this.wisp_url),this.ws.binaryType="arraybuffer",this.connecting=!0,this.ws.addEventListener("error",E=>{this.on_ws_close();let i=new Event("error");this.dispatchEvent(i)}),this.ws.addEventListener("close",()=>{this.on_ws_close();let E=new CloseEvent("close");this.dispatchEvent(E)}),this.ws.addEventListener("message",E=>{if(this.on_ws_msg(E),this.connecting){this.connected=!0,this.connecting=!1;let i=new Event("open");this.dispatchEvent(i)}})}close_stream(E,i){let t=new CloseEvent("close",{code:i});E.open=!1,E.dispatchEvent(t),delete this.active_streams[E.stream_id]}on_ws_close(){this.connected=!1,this.connecting=!1;for(let E of Object.keys(this.active_streams))this.close_stream(this.active_streams[E],3)}create_stream(E,i,t="tcp"){let s=t==="udp"?2:1,n=this.next_stream_id;this.next_stream_id++;let w=new g0(E,i,this.ws,this.max_buffer_size,n,this,s);w.open=this.connected;let R=NB(s,1),N=NB(i,2),J=new TextEncoder().encode(E),H=ri(R,N,J),X=gC(1,n,H);return this.active_streams[n]=w,this.ws.send(X),w}on_ws_msg(E){let i=new Uint8Array(E.data);if(i.length<5){BC("wisp client warning: received a packet which is too short");return}let t=i[0],s=AC(i.slice(1,5)),n=i.slice(5),w=this.active_streams[s];if(typeof w>"u"&&s!==0){BC(`wisp client warning: received a ${A0[t]} packet for a stream which doesn't exist`);return}if(t===dQ.DATA){let R=new MessageEvent("message",{data:n});w.dispatchEvent(R)}else t===dQ.CONTINUE&&s==0?this.max_buffer_size=AC(n):t===dQ.CONTINUE?w.continue_received(AC(n)):t===dQ.CLOSE?this.close_stream(w,n[0]):BC(`wisp client warning: receive an invalid packet of type ${t}`)}}const nodeStream = require('node:stream');
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
