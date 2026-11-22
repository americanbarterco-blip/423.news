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
  root.innerHTML='<button id="cg-launch" type="button" aria-label="Open Claudia Green AI voice chat"><img src="data:image/webp;base64,UklGRqwXAABXRUJQVlA4IKAXAACQWQCdASqgAKAAPoUylEclIqIhMZb+uKAQiWoAnTnsUx5k/tPNU5L7PfivkP2m9UkaS2L/zfWZ/XfUP8cr13+a3zefTX/XfRV6o/0O+mb/vv/WtiHk1ij5x/mH716HmRvtI1Hfm35kyJ8zHmhqKflv9a4FEBW719o9gaoGfqX0h9IX157B6akRAXH56q5pHTKX7nneCVJnweZCsaxp0fP/ptYJ/6DDSfbEAGPQXsttVj7RTFsmRsdFRCLxOnwXN9y7wHzHTzMOrb2oFTsyX0ZXnuy5xjR327T+yl7ks797NYRzh0kQYZadknTLwvIQ1Exe54D3qpkIuzQdHG4wsSHVc1cVL4uxI8C2N8mxKiNcGvtnmGRnk9cggvDg2agtS/RhgWUUMUB1BbXS+jGp/9hPwV2J4g6hToGCzJ48VwRuW3dpgqfTdpibbKAZm7yDMGonF3EonPYxApXBqHOedwCpO1FGV1jUf1ABssSVTzNHzMtOrMpp7IDgdQSWsGaqEqtRA5ob97YMzrvfUiMZV37Z177XfRz/m1GANBllsh3qu2BBlwuHCkzywJB1sj9n1Y8BzBC1nDrIOPzC7HRWqaFEX+UjWO1Hu9bkguc9CWh+bpbjTzCOAgXUfi8RxTTF7Gz/4i+lV1oiOsSdJoSw2YC+TMTVkYRLwwLBB3dQb+c3lapvCr2Ptbo5OW3zdeUcnSetCQHoUXiWfTwYjIb3hawoEgjLUc/Z2MLIyvPRLiRtnS3xoPUKiaoVwlupI/YrVtCw7u0MJhuoEMR169RW5I0u7m/BAFmEHBfdJOsTOaSFPiocOJe8x1xxYvdzR3GrDvchf+WNjFHGOnHCSpy7jgtKl+m4HEFpBElhA6beXwfyXk76/yDxgr3cuiv9VyLcQFQ3bM3oiTLmdF8jiWf28iroI6WSGC5jSWVS38lR0dPn74bFRMT2kNIeDBT6R2x1QNR3Sj6LQAD+/KmAvRdPEihXfVdGr8vDIEjGvqHh0foI/Wf0RKBPRNiIJdjp4NJUxT3Vtf4hXyEbRDl0U6p+sYu+1NyivtROEuKnFlsCT2JzFiYNaVrcMV2VSUcUfV19ocF1DOKsZC55E2iC0RIsdbZPwYH44whTUQi3bUgnvQF+fPHslNRE8JGJyKz1QoM0ivDyxSNjIfWfJqIqCnQFe90JfvdUhkqeEe4BURQAy+VnQU5U820EcK1fQQU1WP3WX270/kKw5eYGATTnTL6XglJdZe58qy2Vqv2eJy1ben2h3SqBUyClyPuUXo2eRXY8qrs7N3zboA+4fcHE8/XVdGih8wL/iXeO62siOJvWnUtfC4rqRg7/8ar0Cpf5cPCz4H8gBtdLaPyuYnbgA9esUnP50ogyMfVaXDa49C+9y7vnFfFIRFX4HtRgVv4NfQGGBybZmhyoI1NB+mA3YsPsywFKn5x3LEQdR9Buu6PvRLgzdWeXSzj/J9XE+7lkdnsMTWmvZkHde42bpzzYOhV5ufRGC0NOWr410A7phU4gDtp4HGiKyZngTYhNURTZx9O8U0fKn3VU3YhtxF9JzVrRruVbXk+r5oOpGgyvGC6NMEX4fYk1fg/Xp74m9sgPqMlmc3xdK3FjlRuhcH3lCVQIhFjCl+pDp/R54S9Lmc4h4EqSN99OiRJKn55N91uj08huANprSs28a3eJra45RYwmeHo5r4iEjF2CZwm5xxD/YOKomTQkVCEdW+QC+nm/bOe5YFy2Z2clIQbVBU/+NAjubiNVom9qz5Z2v8Ft5mQJEWqDESeQxX6r8GygWlzyB9kjnfKFAipqxj8joadGeDus7ui+3wxjSd2ceMiNDomQr7zV846maxVfU6ABOaxW5makn/+TV54zRoEPr0WoRhwk3TOQU3EqprFJR+buLVhJY4aybif6/lUtIjRGes83jHsUVtBJ4Fv1Hfcdw/RcyuMyv02ppD6envEg++3ztQohxlFGyfJluRQ03/HUpO8e3Katu/LQdD+QzoOT9sUkzS2W2VjVDNdiIsHUKYhxdflocoaFph4prg6cvJK8sLC01UwUUQvJqrq9sq+v9M8IqVzZthhuzFRPDbfP7JXNTUHSPGfXPU3FRmMWnbwUR788yzwzZRjQ2+jUj960BF0xzPpGJNyzYYxHdJK2o3qmc88rdhE808GDq+hel3gYfAryg4Y0f/tbhXry9hCN71FFPSZsB7i8Wl/rsz5YNKnOiv6bVx9IHWsuFIqL6B9qkxVboX4yXzFOgGZ0iZRjM/7/X/UOoOZFrWtX9Agoeuj6rGO7lujMA4fu94gXBRG3O5ab0cUB5NYNpCA7+0SNVN7LiQIXXqVSi5ASCTGnwKsWTvKPaPpxhxgSzgCTuXdlCAdv9zcPgutqeFedg+3sWorNl3PYq1Xrt4t/NYCwXPcY9ZxG8o0q1wKiqJE+vGXC/sCJJF40dLMArnapaxicftlmXNtoHL+cLI7sia4dNQpFZMzN7oi2UJ0uz9QsaiURHTW5OhckJSEKw5cD4D5GLeWBi0WSL9EqQuDyLfCiWYpVvUbKJMoP/kUKlaxklqzTdW/WFK6F/MsKzAdN7ufDVEUP1ez3uuiWBy8nRR0dnz5rfv9qrhdceuWE40tQS4l807TtotAeFlYJKX88eEgM88MByzIzQQiQwWfSWHu4xRe8rWkjgtE44yanU7rhOKq3Ch33kdGOfKDAQTDix8mY7Bf45+RbojoGr/gCrJk4jO2t2YkdxUjZ8nanbd8DlmxoIUVQ4Wu6CfyXic19PzHiQ1LasvGSJTghNe9+YoUslaHVU7iP5PO95P4JBVtJkdEryp1tfhobptt8oJf7vzAoHmbKbkfeUc6UdX8EX+nTDcdCWhKTIamJiDwT9+/nJ2XulFCegxv0zWT0/Ez949n+DxfGwLKUlZpcVsSRhOEFBfoaSVZ6Sne9T6aYHxAHu2xn8dghorOc/6S9uebjWWg0gvoNjdchETdSXT50SS/jb0LC3tXAWr/BfAOaUa+4rXu+Q6697b3hWWh6zERQp34Ks7bpLL/OZnQFkxp3zkNT6DmccP7eFsRMbQcRH57VsdxAXu6LQKunuHHNm7ir3LyM/sGG6alz4vCcg57GCMPd8KlqDnz1jhaQjgzwTvb2FthQ4ACWI22/8zqV6gd+bNLM5teaP/FE6KrMj6XsEwbNHvLtfBagiVVOT0e02KqBFunFBoDHtmjmk5Zp8Y/T4TqanUY0ZawlGG5nJBhttAAdkQIKiXqgF43SCGePXR8NFrEsUw9uI3lGoaUru3nqNI4aX2EO3twMtYk/NdTeX24vteYLdHkuVuvCNCnw1nNOL+1S0+Gyr14SDoy7Fl+KUgI8n4wcwJT8CUfMe1KISGxrLLj3CstJJfo7Faj0vT2M7BnR4PtwgrVaYrjnlW8MhFp7Xeqc7VYYggVJ7xcAn7wENj+NtoJ7m7Xus0I6hEjP1OvYoFVsgMRxD4TFn1WJe06aTwVZbInr0ZRz5m9q2Sgve3zqDhf6U0ombMyEM50yd9PPpRQ2m7mz/7MIrrJBAhb/LxHif3D1bY1AWXR76InRfl8Lvt724gv30B5FUCRO7DXPMSMqDcvzGEVhbEGM478oVOXxjMGpOo3d/mW8pBn/FE86Ty6yX+wEnhF/cbjd4AswQnv8kh8mVEn427P/tX1t/RiJbAPAvabC/4PBfksHG7FJaLIM+HkcjoiN/xEtNS9EKUUOEivVZGLtUFw5mdsta2vxj0QgfKtXW4e3VBg3xOfq+gpjCTnotW9qBGeAAgO3VZNg0z/s+CrtofVX0+5XGN/Egi/J/9i33MX6FBjKrCOAsEvMfYFLnw8cevcgFAwlhjjvp1htyJSv9Q8HkuD2ouoThfMCN44d9dr5CwTHiRJHyJjivI/FSW+2btgEh/TYMEBKNmsHfairrcKB9+hEDTrt9+o0H7oDoCY+36if3m5OpfXPQfpn+kM1zDkw1qtdKTYKECn57d8N3sNQ6kdkEqxtSPDTHWRexRMCw0hBHJ4gsJ6uMV9b46RsC2tafLIr+fGxOp5SkMUT1wrR+WOiad3HoEA2TZbUXFrIDVl00rSlRXUOpSfC3ipgASxqDpCWJledxljfA/vMw6NBlelczrjC5uwnavYyQX6JzL7hh22mV49CeC3QX/573cQ8ej7zD/xDBUbwTtLBOJw9ryClPv1rv7a2MBPshXia3ImSbT4hLtu8EwLqmJlk4QtAB2aHYT4oE+sBPD93+xGOQyvYjJyLq3afiRS9LigucWnb9cgaU0vwuHkFrj1+abVuW3oECES5D3xQndoT8DMckHlPV9/qFbCtbPi3AwDHN1Me1vIQHZF76XOQdz8iuOxWk55/mznJ1k9V1jhFr4vJNLjKapBkq2fiM3T2qA3Y0TF24uuxPlTlfsZIMD1e4xWzSUCQuSih8lEyThNF6oRuWZonRTT0KkDAaF3Y28tw7LozYdLz3atod7MT+hK86mIYMG4maMwCt3mWuBuNHTksfs6pnpWC0OyM50V5NGzXYxLyNGPelLK6qdp7yHjgoIE3S64oZO6yINBNwkRRza6nwf9uugJlfjOpbWA1M6SlXOPw7C2dgjU7+yeHFr/11NCr4A4oFNEd8OLGCexVTHR8hL+IcUKNF0jVFQ9rC2dUjLrCvFk76pdn9KfeIneVfHM+3FT1wFdeNHXNHl2hUXHuYlv+vudiRYneKoCEWUx94alxqPi+xIWWiFD6gWRc0dXGXtfacTgIQOtsKiflgbrcr/W8u+tWmOtOp14zZqxXKgtHCspONk4psWm3eP7w30j1bRm6j/DF8jt6HDxMlgZ1YDOjb3egLE9pFHfTNHDl+vjthmAlhobXJpmHQc7IHSSUAac/GFzghNAbABvPFMNwsHcVFs/cteQHeJmJUNf1cNkkfrl/8wPshYI8P+vVtOliruiKLLDrLPC1ftwLttL1mVORhaj1q2fOlhxPWVOOVPW7rtX3th5/9HoOVQKJLyoXKXMdyAwN5m+XeoeeZEqQ82b3mN6Th7ma7g8erzkf5msWJR+XoZDCeEE7oFkMYfRPCha+jVdHhpXaBuVxSPKKTjG3OdSBm/fNKfFdgJhSIHLSjTH+27mnq3vdH5RK2pYPJhasLnv+/joQkwooK1c3KiudfqkuGAWjO/hgevSJzTv9yche+HujKS8U01cKkvLmmJbmI1W8gC+Y/sj8uuKUStcICGIIaULWJfmnyokmqdgpoflGD5XQ4GDyOCoigXTDANVm2nNi5v0LLJBvzn9OeO6vGUDCHb8ZlTc/7HKnkb+wyTSPNtsj3g24CSP5N4zvxPoz8lBOyy2uAWJUnTwQqzXEhXfK8l+p2JxwA3Ft0W8kHvRptx8udyywjDYa6HwlcPip4MPPDnLZML462FpkEEk2qmu9v70Ho3AYoIOp0fKCvz1tNR+AB13CRBwbb0kXhH4ltfJBxS8ZUmSE0auyYgObydb6vKp+QQXGJ3t8TUPlOz1uZOVO0o8VISVJUM5/YFzgG3Nb9m+UPQnT/vvmU5gkvLGqTRL/S0MJGF1Atlrhvcsct+IGVxvXGZ9Prb0Rm6XZUqMdiveQoTvgt8MHB5C8h2icfl/Pc3lhVfsh82ytcT1tKoGiYpqFS9WegLjaDxdtYOjdpBXhGIHV3fUen3nG1+5V2XGId623vEqlV4IZMOvzKLu3bO2dfkEiSjYE/EJmu0/HJy5HjEbUBzUYt6/BP6WkodcZdZG3HNaCiCivtflkUJjQlVrqfPef82ZVDxINJ9wZZSljF8nPbDT7pEDBCxawWRviUAQ9A9qiASOaB007bxnLXHPeyMNlzJsJ+NUqaoFHHkuJbj9Vc7K70KQZbJ4qpRl5As4gNsE++32+TnKVyLJ6zscKozVbJ/sWnCG0r+RpNYS+jJO8hSXXSzlMCXMUdeIVtiYTQP2b0Xm0faHPPdYicBkXBpX+ksunD6db1G5+431DgwDTsxxPrVxO8qkE3V3BmHjE9DIsyrCjXmFqaPiEvzqiJoB4xuegt2wDGkk6Z8PT2BKAcdTRq44BEZNxlRboj44hPAuK5q9h6bqAuq6wMFbKmeXrLkBqBEItE1Jl3pSjnbxpTsb+l7kNxZest4XcxwZWzpvPtatvCZFE9zwOuMlYQGwnEs1iW80DduHg3OyLKVxr4zaxWOJ+7u9FMIp1zVJ8r/xJ5nYQCQe4cm8hSfJIVUK465zNH2YiogO6xk0xJw8mP/1pIQwZsptIjT/QTQxGvVnWTZ1hmEyMzyurW/loMr5E2Ic9FoCZJjHBmOoowl3LBbw+ft8VHZXb64wtEU2q6Z15B6kyhftwRcrNf4en5+Vgzbdc6fiUtLwC0ijTKNNZZcaI9VrxhkpJg7rbg7VWzD4OUGZL67z6X4WRIqSiNJQqekNERPHYZ1znv+T09axd7x7m38DXyFlnARgVC1qTlAjsX485/095EP93BDjwWtWqdiKPCk/hwbZiALyi4rYciHn1qD4J1BwIVKZLd9zt44/rClMPyRpbv08yxEuIFXdQEFv5XsiF4+3sR4uoOIRlb5isANMyRR8wfHnMt1pGsgTqyHoJ5eKw2CN2j1DK81/wKKHawmb8oMDEdGdmJgGVxe3nZDteTsLXjsqsLDiZGkN2AE1mMFTwKpbc6sZiNnxwzrIIg4d2sxAlPuc1JTHoIN+e3fikcOC/QEzbESn/rHtEdd6PuiaPsVKnjDAo39wefx43Y4PV7Bg2FKAcUXVjIPcm3DGn6IOXgAfIdMiE1t/PDFlms65J08Bmgzrykh/i04chpCnTwj9cDopcwTTUGQtM7rdTaAy+Rq/OLd44T+s/lfhO7JMA6YGFMmGDsHKZZXOJzeAPFbgOm0l0GpsGIRVUBNCo9/DfjawHd6Y6oEfhWyBPsUYwkQrGtQ1TQ7YK20GoQYUPUB43sNYdcQ6ULHKmrUM5yksPMEgPD9nT5dBv/qkh2PulY1jWU2tmIjXk2tV0R1Pu5Y0L4kF/Lcbardr3GyM1O6QbHv2Mp5oygXzbQ9AC+QOcAiizDz4uipGmvTot0tZxS6aFIKkozyaSzyKcInLzu1gupBFcYVieMf165B6KK2qR4FHid4It/c1vgCz2iOb1sxSLJpdBZPebpge18xEFa92yTl2YnqOe6+bGAtcNkjsKqhPtFGBurSgHp43sgF3unz+r0ZIqtQRx+Sl5E7DBE4fqRqPLool2TfZp/KoPnimLuZViqAQ4GqvoNRWUpKdUeNWs0xw+MrCg8R7jJUP7jT3LU9IOS7vqKdTK66vegRv2FtSYEQlXexDaogPCU8SMnAl6GOb2ApVYSuOmFidPMYZI8FJI8xEcXbqSBWrvM2XlWJ9CKzf/DCTChJVOQjeQZ/ZTBroEgnPWLvMuhe6jOCFgGHh+RAO8mo5HpkpF79FiKUYQkdV4m6ZgL5y70X33XmwIYcx1IpmuJ9Xr/wYGINvLeTsAhfAKDmxD8ZPnOUzGANSQJyQnkmp/8JlnsMMDPUwzZelLE/k+AGpeK2WUxyeQDKARiC/cozycbIhdS0JXCdD45aS6JJx09mtpdzQQD2+UO17GVZq9/Dlx64XcUEfWRoeWP5ylaHPqnnpFwqxaSjxZpKoEsGG3c6xa3uXKvoCcpvW2G44P8I5FJhu0l/rMpB7obdu9nAbQh9tkiJ4Ca/yKkcldiRCcqlvYVX1FkH04UzCt3+FtFXZ8LHbsGJ3M0dxRUSWr5gY0iVei6Lav0HxOc6PqplHs+z94FK32BdxNvz1JiPl+sE1K9A6K2c4P017k9KxugsRsgDP7n3LMfFCbHmYgboHgC6V2msmv+luIQeeVrBuLUwrOKdghvTjq356V5BMBNew123AoWk6PGUqzKaDj+Ew1TErNQCCM4HzYCe/7WrKpBN699xjZYzJfodLy2OMRTWKVIS9g/M0k3QFvLvbP5moLKj7vTiB1pz1RkwE1OGSkkTwg1bS45x0ZExULnjq0DrKk5akvSrdV2xs2ShNEN062r8Y4fYkO64ZFsajD8KdhXGH29X/2EiCCB9SwSAhP6rWyITalzWqmhLOS6ZoyLPyrWqpXFpVwa/oJqoYAAAA=" alt="Claudia Green" onerror="this.remove();this.parentElement.textContent=\'CG\';"></button>';
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

/* Replace the old on-air video/photo with the current Claudia video (muted, no audio) on every page this script loads on.
   Works even if a page's own HTML is older: the video comes from claudia-speak-video.js. */
(function () {
  var data = null, loading = false, queue = [];
  function withData(cb) {
    if (data || window.CG_SPEAK_VIDEO) { data = window.CG_SPEAK_VIDEO; return cb(data); }
    queue.push(cb);
    if (loading) return; loading = true;
    var sc = document.createElement('script'); sc.src = '/claudia-speak-video.js';
    sc.onload = function () { data = window.CG_SPEAK_VIDEO; if (data) queue.splice(0).forEach(function (f) { f(data); }); };
    document.head.appendChild(sc);
  }
  function patch() {
    var vids = [].slice.call(document.querySelectorAll('video[src*="claudia-onair"]:not([data-cg-onair])'));
    var imgs = [].slice.call(document.querySelectorAll('.cg-hero-portrait img:not([data-cg-onair])'));
    if (!vids.length && !imgs.length) return;
    vids.forEach(function (v) { v.setAttribute('data-cg-onair', '1'); });
    imgs.forEach(function (i) { i.setAttribute('data-cg-onair', '1'); });
    withData(function (d) {
      imgs.forEach(function (i) { i.src = d.poster; i.style.objectFit = 'cover'; i.style.objectPosition = '50% 20%'; });
      vids.forEach(function (v) {
        v.poster = d.poster; v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
        v.style.objectFit = 'cover'; v.style.objectPosition = '50% 14%'; v.style.background = '#e9eaec';
        v.src = d.video; v.load();
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      });
    });
  }
  document.addEventListener('DOMContentLoaded', patch);
  new MutationObserver(patch).observe(document.documentElement, { childList: true, subtree: true });
  patch();
})();
