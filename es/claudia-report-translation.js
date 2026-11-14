/* 423.news — Spanish Claudia report display translation.
   Display-only: original scanner records and English feed remain untouched.
   Uses the same public Google Translate web endpoint already used by Claudia's Spanish voice fallback.
   No API key, paid account, database write, or scanner-ingestion change. */
(function () {
  'use strict';
  if (!/^es(?:-|$)/i.test(document.documentElement.lang || '') || !location.pathname.startsWith('/es/')) return;

  const cache = new Map();
  const pending = new WeakSet();
  const translated = new WeakSet();

  function translate(text) {
    const source = String(text || '').trim();
    if (!source) return Promise.resolve(source);
    if (cache.has(source)) return Promise.resolve(cache.get(source));
    return fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=' + encodeURIComponent(source))
      .then(response => {
        if (!response.ok) throw new Error('Translation unavailable');
        return response.json();
      })
      .then(data => {
        const result = (data[0] || []).map(part => part[0]).join('').trim();
        if (!result) throw new Error('Empty translation');
        cache.set(source, result);
        return result;
      });
  }

  function markAutomatic(element) {
    if (!element || element.querySelector(':scope > .cg-es-translation-note')) return;
    const note = document.createElement('small');
    note.className = 'cg-es-translation-note';
    note.textContent = 'Traducción automática al español · confirme la información antes de compartir';
    note.style.cssText = 'display:block;margin-top:5px;color:#f5c56b;font-size:10px;line-height:1.4';
    element.appendChild(note);
  }

  function translateNode(node, parent) {
    if (!node || pending.has(node) || translated.has(node)) return;
    const source = node.nodeValue || '';
    if (!source.trim() || !/[A-Za-z]{3}/.test(source)) return;
    pending.add(node);
    translate(source).then(result => {
      if (!node.isConnected) return;
      node.nodeValue = result;
      translated.add(node);
      markAutomatic(parent);
    }).catch(() => {
      if (!node.isConnected) return;
      node.nodeValue = 'Traducción no disponible. Consulte la versión original en inglés.';
      translated.add(node);
      markAutomatic(parent);
    });
  }

  function process() {
    const selectors = [
      '.cg-row-main > .t',
      '.cg-row-main > .desc',
      '.cg-cardl > b',
      '.cg-detail > h2',
      '.cg-detail > p:last-of-type'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(element => {
      if (element.matches('.cg-detail > p:last-of-type')) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) translateNode(node, element);
      } else {
        Array.from(element.childNodes).forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) translateNode(node, element);
        });
      }
    });

    document.querySelectorAll('#cgQueue li a > span').forEach(element => {
      const node = Array.from(element.childNodes).find(child => child.nodeType === Node.TEXT_NODE);
      if (node) translateNode(node, element);
    });
    const deskLine = document.getElementById('cgDeskLine');
    if (deskLine && deskLine.firstChild && deskLine.firstChild.nodeType === Node.TEXT_NODE) {
      translateNode(deskLine.firstChild, deskLine);
    }
  }

  const observer = new MutationObserver(process);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', process, { once: true });
  else process();
  window.addEventListener('load', process, { once: true });
})();
