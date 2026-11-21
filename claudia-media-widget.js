/* Claudia Green floating AI launcher for 423.news.
   The portrait button opens the existing LiveKit AI voice assistant, not a media picker. */
(function(){
  'use strict';
  if(window.__cgMediaWidget)return;window.__cgMediaWidget=true;
  var style=document.createElement('style');
  style.textContent=`
    #cg-livekit-launch{display:none!important}\n    #cg-float{position:fixed;right:16px;bottom:86px;z-index:99999;font-family:system-ui}
    #cg-launch{width:62px;height:62px;border-radius:50%;overflow:hidden;border:2px solid #35d1eb;background:#08324b;color:#e8faff;font-weight:900;box-shadow:0 4px 20px #0008,0 0 18px #25c7e655;cursor:pointer;padding:0}
    #cg-launch img{width:100%;height:100%;object-fit:cover;display:block}
    #cg-launch:focus-visible{outline:3px solid #f5c451;outline-offset:3px}
    @media(max-width:480px){#cg-float{right:12px;bottom:82px}#cg-launch{width:58px;height:58px}}
  `;
  document.head.appendChild(style);
  var root=document.createElement('div');root.id='cg-float';
  root.innerHTML='<button id="cg-launch" type="button" aria-label="Open Claudia Green AI voice chat"><img src="/claudia-studio.jpg" alt="Claudia Green" onerror="this.remove();this.parentElement.textContent=\'CG\';"></button>';
  document.body.appendChild(root);
  var launch=root.querySelector('#cg-launch');
  launch.addEventListener('click',function(){
    var aiButton=document.getElementById('cg-livekit-launch');
    var aiPanel=document.getElementById('cg-livekit-panel');
    if(aiButton){
      if(aiPanel&&aiPanel.style.display!=='block')aiButton.click();
      else if(!aiPanel)aiButton.click();
      var start=aiPanel&&aiPanel.querySelector('#cg-livekit-start');
      if(aiPanel&&aiPanel.style.display==='block')aiPanel.scrollIntoView({block:'nearest'});
      return;
    }
    window.location.href='/live-wire.html';
  });
})();
