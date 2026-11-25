/* Persist language metadata on native Spanish pages and clear retired Google Translate cookies. */
(function () {
  'use strict';
  try { localStorage.setItem('423lang', 'es'); } catch (e) {}
  document.documentElement.setAttribute('lang', 'es');
  document.documentElement.classList.add('notranslate');
  var noTranslate = document.querySelector('meta[name="google"]');
  if (!noTranslate) {
    noTranslate = document.createElement('meta');
    noTranslate.setAttribute('name', 'google');
    noTranslate.setAttribute('content', 'notranslate');
    (document.head || document.documentElement).appendChild(noTranslate);
  }
  document.cookie = 'googtrans=;path=/;max-age=0;SameSite=Lax';
  document.cookie = 'googtrans=;path=/;domain=423.news;max-age=0;SameSite=Lax';
  document.cookie = 'googtrans=;path=/;domain=.423.news;max-age=0;SameSite=Lax';
})();