
/* ===== V6 ACCESS GATE (same auth as the portal — opens straight through if you're logged in) ===== */
(function(){
  var AUTH_KEY='fate_v6_auth';
  function passes(){
    if(typeof FATE_PASS==='undefined')return['fate2026'];
    return Array.isArray(FATE_PASS)?FATE_PASS.map(String):[String(FATE_PASS)];
  }
  function hash(s){
    var h=5381;
    for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))>>>0;
    return h.toString(36);
  }
  function isAuthed(){
    try{
      var v=localStorage.getItem(AUTH_KEY);
      return !!v&&passes().map(hash).indexOf(v)>-1;
    }catch(e){return false}
  }
  if(!isAuthed()){
    location.replace('index.html');
  }
})();
