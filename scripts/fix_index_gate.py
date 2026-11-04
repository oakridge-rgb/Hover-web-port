#!/usr/bin/env python3
"""Fix the V6 access gate on index.html: it redirected unauthenticated
users to index.html itself (infinite reload loop). Replace with a
password prompt that stores the hashed password in localStorage
(fate_v6_auth) and reloads; cancelling just stays on the page.
"""
p = "/home/z/my-project/download/site/index.html"
s = open(p, encoding="utf-8").read()

old = """  if(!isAuthed()){
    location.replace('index.html');
  }
})();"""
new = """  if(!isAuthed()){
    var p=prompt('FATE V6 access password:');
    if(typeof p==='string'&&p.length){
      try{localStorage.setItem(AUTH_KEY,hash(p));}catch(e){}
    }
    if(!isAuthed()&&p!==null){
      location.replace('index.html');
    }
  }
})();"""

assert s.count(old) == 1, s.count(old)
s = s.replace(old, new)
open(p, "w", encoding="utf-8").write(s)
print("gate fixed: prompt + unlock instead of self-redirect loop")
