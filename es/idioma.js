/* Persist language metadata on native Spanish pages and clear retired Google Translate cookies. */
(function () {
  'use strict';
  try { localStorage.setItem('423lang', 'es'); } catch (e) {}
  document.documentElement.setAttribute('lang', 'es');
  document.cookie = 'googtrans=;path=/;max-age=0;SameSite=Lax';
  document.cookie = 'googtrans=;path=/;domain=423.news;max-age=0;SameSite=Lax';
  document.cookie = 'googtrans=;path=/;domain=.423.news;max-age=0;SameSite=Lax';
})();