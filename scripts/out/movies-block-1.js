
(function(){
  var HLS_SOURCES=[
    '/hls.min.js/',
    'https://gcore.jsdelivr.net/npm/hls.js@1/dist/hls.min.js',
    'https://testingcf.jsdelivr.net/npm/hls.js@1/dist/hls.min.js',
    'https://fastly.jsdelivr.net/npm/hls.js@1/dist/hls.min.js',
    'https://unpkg.com/hls.js@1/dist/hls.min.js'
  ];
  var ART_SOURCES=[
    '/artplayer.js/',
    'https://gcore.jsdelivr.net/npm/artplayer@5/dist/artplayer.js',
    'https://testingcf.jsdelivr.net/npm/artplayer@5/dist/artplayer.js',
    'https://fastly.jsdelivr.net/npm/artplayer@5/dist/artplayer.js',
    'https://unpkg.com/artplayer@5/dist/artplayer.js'
  ];
  window.fateEngine={hls:null,art:null};
  function loadChain(srcs,i,which){
    return new Promise(function(resolve,reject){
      if(i>=srcs.length)return reject(new Error('all sources failed'));
      var s=document.createElement('script');
      s.src=srcs[i];
      s.onload=function(){window.fateEngine[which]=srcs[i];resolve(srcs[i])};
      s.onerror=function(){s.remove();loadChain(srcs,i+1,which).then(resolve,reject)};
      document.head.appendChild(s);
    });
  }
  window.fateTVLibs='loading';
  window.fateTVLibsReady=Promise.all([
    loadChain(HLS_SOURCES,0,'hls'),
    loadChain(ART_SOURCES,0,'art')
  ]);
  window.fateTVLibsReady.then(function(){ window.fateTVLibs='ok'; }).catch(function(){ window.fateTVLibs='failed'; });
})();
