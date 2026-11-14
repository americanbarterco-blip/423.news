/* Persist the Spanish language preference on native Spanish pages.
   Clear legacy Google Website Translator cookies left by the retired widget. */
(function () {
  'use strict';
  try { localStorage.setItem('423lang', 'es'); } catch (e) {}
  document.documentElement.setAttribute('lang', 'es');
  document.cookie = 'googtrans=;path=/;max-age=0;SameSite=Lax';
  document.cookie = 'googtrans=;path=/;domain=423.news;max-age=0;SameSite=Lax';
  document.cookie = 'googtrans=;path=/;domain=.423.news;max-age=0;SameSite=Lax';
})();
