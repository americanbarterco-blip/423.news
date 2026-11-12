/* Noticias 423 — reviewed Spanish report registry.
   Only records in /es/reportes.json are published here. Never auto-fallback to English. */
(function () {
  'use strict';
  var DATA_URL = '/es/reportes.json';
  var ROOT = 'https://423.news';
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(value) {
    try { var u = new URL(value, ROOT); return u.protocol === 'https:' ? u.href : ''; }
    catch (e) { return ''; }
  }
  function date(value) {
    var d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-US', { year:'numeric', month:'long', day:'numeric' });
  }
  function load() {
    return fetch(DATA_URL, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('No se pudo cargar el registro de noticias en español.');
      return r.json();
    }).then(function (rows) {
      if (!Array.isArray(rows)) throw new Error('El registro de noticias tiene un formato no válido.');
      return rows.filter(function (r) {
        return r && r.published === true && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(r.slug || '')) &&
          String(r.title || '').trim() && String(r.body || '').trim();
      }).sort(function (a, b) { return new Date(b.published_at || b.ts || 0) - new Date(a.published_at || a.ts || 0); });
    });
  }
  function renderList(rows) {
    var target = document.getElementById('esReports');
    if (!target) return;
    if (!rows.length) {
      target.innerHTML = '<p class="small">Todavía no hay reportajes originales en español publicados. Vuelve pronto; no mostraremos artículos en inglés como si fueran traducciones.</p>';
      return;
    }
    target.innerHTML = rows.map(function (r) {
      var summary = r.summary || r.body;
      return '<article class="es-report-card"><div class="es-report-meta">' + esc(r.section || 'Noticias locales') +
        (r.dateline ? ' · ' + esc(r.dateline) : '') + (date(r.published_at || r.ts) ? ' · ' + esc(date(r.published_at || r.ts)) : '') +
        '</div><h2><a href="/es/reporte.html?slug=' + encodeURIComponent(r.slug) + '">' + esc(r.title) + '</a></h2>' +
        '<p>' + esc(summary.slice(0, 220)) + (summary.length > 220 ? '…' : '') + '</p>' +
        '<a class="es-read" href="/es/reporte.html?slug=' + encodeURIComponent(r.slug) + '">Leer el reportaje →</a></article>';
    }).join('');
  }
  function setMeta(selector, attr, value) {
    var el = document.querySelector(selector);
    if (el && value) el.setAttribute(attr, value);
  }
  function renderArticle(rows) {
    var target = document.getElementById('esArticle');
    if (!target) return;
    var slug = new URLSearchParams(location.search).get('slug') || '';
    var r = rows.find(function (item) { return item.slug === slug; });
    if (!r) {
      target.innerHTML = '<div class="es-article-state"><h1>Reportaje no disponible</h1><p>Este reportaje no está publicado o el enlace no es válido. Consulta la sección de noticias en español.</p><a class="es-read" href="/es/noticias.html">Volver a Noticias 423 →</a></div>';
      document.title = 'Reportaje no disponible | Noticias 423';
      return;
    }
    var canonical = ROOT + '/es/reporte.html?slug=' + encodeURIComponent(r.slug);
    var english = safeUrl(r.english_url);
    var description = String(r.summary || r.body).replace(/\s+/g, ' ').slice(0, 180);
    document.documentElement.lang = 'es';
    document.title = r.title + ' | Noticias 423';
    setMeta('meta[name="description"]', 'content', description);
    setMeta('link[rel="canonical"]', 'href', canonical);
    setMeta('meta[property="og:title"]', 'content', r.title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', canonical);
    setMeta('meta[name="twitter:title"]', 'content', r.title);
    setMeta('meta[name="twitter:description"]', 'content', description);
    var alternates = document.getElementById('esAlternates');
    if (alternates) alternates.innerHTML = english ? '<link rel="alternate" hreflang="es" href="' + esc(canonical) + '"><link rel="alternate" hreflang="en" href="' + esc(english) + '">' : '<link rel="alternate" hreflang="es" href="' + esc(canonical) + '">';
    var schema = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: r.title,
      description: description,
      inLanguage: 'es-US',
      datePublished: r.published_at || r.ts || undefined,
      dateModified: r.updated_at || r.published_at || r.ts || undefined,
      mainEntityOfPage: canonical,
      articleSection: r.section || 'Noticias locales',
      author: { '@type': 'Organization', name: r.author || 'Redacción de 423.news' },
      publisher: { '@type': 'NewsMediaOrganization', name: '423.news', url: ROOT }
    };
    var jsonld = document.getElementById('esArticleSchema');
    if (jsonld) jsonld.textContent = JSON.stringify(schema);
    var paragraphs = Array.isArray(r.paragraphs) ? r.paragraphs : String(r.body).split(/\n\s*\n/);
    var body = paragraphs.map(function (p) { return String(p || '').trim(); }).filter(Boolean)
      .map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    var sources = (Array.isArray(r.sources) ? r.sources : []).map(function (s) {
      var url = safeUrl(s.url);
      return url ? '<li><a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label || url) + '</a></li>' : '';
    }).join('');
    var image = safeUrl(r.image_url);
    target.innerHTML =
      '<div class="es-article-kicker">' + esc(r.section || 'Noticias locales') + (r.dateline ? ' · ' + esc(r.dateline) : '') + '</div>' +
      '<h1>' + esc(r.title) + '</h1>' +
      '<p class="es-article-date">' + esc(date(r.published_at || r.ts)) + (r.author ? ' · Por ' + esc(r.author) : ' · Redacción de 423.news') + '</p>' +
      (image ? '<figure><img src="' + esc(image) + '" alt="' + esc(r.image_alt || r.title) + '"><figcaption>' + esc(r.image_caption || '') + '</figcaption></figure>' : '') +
      (r.summary ? '<p class="es-article-summary">' + esc(r.summary) + '</p>' : '') +
      '<div class="es-article-body">' + body + '</div>' +
      (sources ? '<section class="es-sources"><h2>Fuentes y documentos</h2><ul>' + sources + '</ul></section>' : '') +
      (english ? '<p class="es-english-link"><a href="' + esc(english) + '" lang="en">Leer la versión original en inglés</a></p>' : '') +
      '<p class="es-accuracy">423.news distingue la información confirmada de los reportes preliminares. Si hay una emergencia, llama al 911.</p>' +
      '<a class="es-read" href="/es/noticias.html">← Volver a Noticias 423</a>';
  }
  load().then(function (rows) { renderList(rows); renderArticle(rows); }).catch(function (error) {
    ['esReports', 'esArticle'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = 'No pudimos cargar los reportajes en español. Inténtalo de nuevo más tarde.';
    });
    if (window.console) console.error(error);
  });
})();
