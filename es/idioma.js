/* Persist the Spanish choice while visitors move between the Spanish section and English-only tools. */
(function () {
  'use strict';
  try { localStorage.setItem('423lang', 'es'); } catch (e) {}
  document.cookie = 'googtrans=/en/es;path=/;max-age=31536000;SameSite=Lax';
  document.cookie = 'googtrans=/en/es;path=/;domain=.423.news;max-age=31536000;SameSite=Lax';
  document.documentElement.setAttribute('lang', 'es');
})();
