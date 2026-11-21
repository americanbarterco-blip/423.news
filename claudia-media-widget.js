/* Claudia Green floating AI launcher for 423.news.
   Portrait opens the LiveKit AI voice panel; it never redirects or opens media tools. */
(function(){
  'use strict';
  if(window.__cgMediaWidget)return;window.__cgMediaWidget=true;
  var style=document.createElement('style');
  style.textContent=`
    #cg-livekit-launch{display:none!important}
    #cg-float{position:fixed;right:16px;bottom:86px;z-index:99999;font-family:system-ui}
    #cg-launch{width:62px;height:62px;border-radius:50%;overflow:hidden;border:2px solid #35d1eb;background:#08324b;color:#e8faff;font-weight:900;box-shadow:0 4px 20px #0008,0 0 18px #25c7eb55;cursor:pointer;padding:0}
    #cg-launch img{width:100%;height:100%;object-fit:cover;display:block}
    #cg-launch:focus-visible{outline:3px solid #f5c451;outline-offset:3px}
    @media(max-width:480px){#cg-float{right:12px;bottom:82px}#cg-launch{width:58px;height:58px}}
  `;
  document.head.appendChild(style);
  var root=document.createElement('div');root.id='cg-float';
  root.innerHTML='<button id="cg-launch" type="button" aria-label="Open Claudia Green AI voice chat"><img src="/claudia-avatar-v2.jpg" alt="Claudia Green" onerror="this.remove();this.parentElement.textContent=\'CG\';"></button>';
  document.body.appendChild(root);
  root.querySelector('#cg-launch').addEventListener('click',function(){
    var attempts=0;
    function openVoicePanel(){
      var panel=document.getElementById('cg-livekit-panel');
      var launcher=document.getElementById('cg-livekit-launch');
      if(panel){
        if(panel.style.display==='none'||!panel.style.display){
          if(launcher)launcher.click();
          panel.style.display='block';
          if(launcher)launcher.setAttribute('aria-expanded','true');
        }
        panel.scrollIntoView({block:'nearest'});
        return;
      }
      if(attempts++<20){window.setTimeout(openVoicePanel,100);return;}
      // No redirect or media-picker fallback: voice panel failed to initialize.
    }
    openVoicePanel();
  });
})();
