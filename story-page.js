/* 423.news — crawlable story pages for English and reviewed Spanish translations. */
(function () {
  'use strict';
  var ROOT = 'https://423.news';
  var SB_URL = 'https://kdiwehqtezlhecxsoysj.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkaXdlaHF0ZXpsaGVjeHNveXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDQzOTEsImV4cCI6MjEwNjIyMDM5MX0.upw9MEq05Gs3czsmnknR1d37I2n3a681XzTJU-MGWwE';
  var MEDIA_BASE = SB_URL + '/storage/v1/object/public/news-media/';
  var isSpanish = location.pathname.indexOf('/es/') === 0;
  var locale = isSpanish ? 'es-US' : 'en-US';
  var slug = new URLSearchParams(location.search).get('slug') || '';
  var root = document.getElementById('story');
  var sectionNames = { news: 'News', sports: 'Local Sports', outdoors: 'Outdoors', government: 'Government' };
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  function set(selector, attr, value) {
    var el = document.querySelector(selector);
    if (el && value) el.setAttribute(attr, value);
  }
  function addAlternate(lang, href) {
    var link = document.createElement('link');
    link.rel = 'alternate'; link.hreflang = lang; link.href = href;
    document.head.appendChild(link);
  }
  function safeImage(url) {
    return url && String(url).indexOf(MEDIA_BASE) === 0 ? String(url) : '';
  }
  function date(value) {
    var d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale, { year:'numeric', month:'long', day:'numeric' });
  }
  function paragraphs(body) {
    return String(body || '').trim().split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
  }
  function showError(title, message) {
    document.title = title + ' | 423.news';
    set('meta[name="robots"]', 'content', 'noindex,follow');
    root.innerHTML = '<div class="story-state"><h1>' + esc(title) + '</h1><p>' + esc(message) + '</p><a href="' + (isSpanish ? '/es/noticias.html' : '/news.html') + '">' + (isSpanish ? 'Volver a Noticias 423' : 'Back to local news') + '</a></div>';
  }
  function render(post, translation) {
    var section = sectionNames[post.section];
    if (!section) { showError(isSpanish ? 'Artículo no disponible' : 'Story unavailable', isSpanish ? 'Este contenido no está disponible como reportaje.' : 'This content is not published as a news article.'); return; }
    var translated = translation && translation.translated_content || null;
    if (isSpanish && !(translated && translated.title && translated.body)) {
      showError('Traducción no disponible', 'Este reportaje todavía no tiene una traducción al español aprobada. Consulta Noticias 423 para ver las publicaciones disponibles en español.');
      return;
    }
    var title = isSpanish ? translated.title : post.title;
    var body = isSpanish ? translated.body : post.body;
    var summary = isSpanish ? (translated.summary || translated.description || translated.body) : post.body;
    var canonical = ROOT + (isSpanish ? '/es/historia.html' : '/story.html') + '?slug=' + encodeURIComponent(post.slug);
    var englishUrl = ROOT + '/story.html?slug=' + encodeURIComponent(post.slug);
    var spanishUrl = ROOT + '/es/historia.html?slug=' + encodeURIComponent(post.slug);
    var description = String(summary || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    var image = safeImage(post.image_url);
    var author = post.author_name || '423.news Editorial Team';
    document.documentElement.lang = isSpanish ? 'es' : 'en';
    document.title = title + (isSpanish ? ' | Noticias 423' : ' | 423.news');
    set('meta[name="description"]', 'content', description);
    set('link[rel="canonical"]', 'href', canonical);
    set('meta[property="og:title"]', 'content', title);
    set('meta[property="og:description"]', 'content', description);
    set('meta[property="og:url"]', 'content', canonical);
    set('meta[property="og:image"]', 'content', image || ROOT + '/icon-512.png');
    set('meta[name="twitter:title"]', 'content', title);
    set('meta[name="twitter:description"]', 'content', description);
    set('meta[name="twitter:image"]', 'content', image || ROOT + '/icon-512.png');
    if (translated && translated.title && translated.body) {
      addAlternate('en', englishUrl);
      addAlternate('es', spanishUrl);
    } else {
      addAlternate(isSpanish ? 'es' : 'en', canonical);
    }
    var published = post.created_at;
    var schema = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      headline: title,
      description: description,
      inLanguage: locale,
      datePublished: published,
      dateModified: published,
      articleSection: section,
      author: { '@type': 'Person', name: author },
      publisher: {
        '@type': 'NewsMediaOrganization',
        name: '423.news',
        url: ROOT,
        logo: { '@type': 'ImageObject', url: ROOT + '/icon-512.png' }
      }
    };
    if (image) schema.image = [image];
    document.getElementById('articleSchema').textContent = JSON.stringify(schema);
    var bodyHtml = paragraphs(body).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    root.innerHTML =
      '<p class="story-kicker">' + esc(isSpanish ? 'Noticias 423' : '423.news') + ' · ' + esc(isSpanish ? section : section) + '</p>' +
      '<h1>' + esc(title) + '</h1>' +
      '<p class="story-meta"><time datetime="' + esc(published) + '">' + esc(date(published)) + '</time> · ' + esc(isSpanish ? 'Por ' + author : 'By ' + author) + '</p>' +
      (image ? '<figure><img class="story-image" src="' + esc(image) + '" alt="' + esc(title) + '"></figure>' : '') +
      (isSpanish && translated.summary ? '<p class="story-summary">' + esc(translated.summary) + '</p>' : '') +
      '<div class="story-body">' + bodyHtml + '</div>' +
      '<div class="story-actions"><a href="' + (isSpanish ? '/es/noticias.html' : '/news.html') + '">' + (isSpanish ? '← Todas las noticias' : '← All local news') + '</a>' +
      (isSpanish ? '<a href="' + englishUrl + '" lang="en">Read in English</a>' : (translated && translated.title && translated.body ? '<a href="' + spanishUrl + '" lang="es">Leer en español</a>' : '')) +
      '<a href="/#' + encodeURIComponent('/story/' + post.slug) + '">' + (isSpanish ? 'Abrir comentarios' : 'Open discussion') + '</a></div>';
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
    showError(isSpanish ? 'Enlace no válido' : 'Invalid story link', isSpanish ? 'El enlace no contiene un identificador válido.' : 'This link does not contain a valid story slug.');
    return;
  }
  var headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  fetch(SB_URL + '/rest/v1/news_posts?select=id,slug,section,title,body,image_url,author_name,status,created_at&slug=eq.' + encodeURIComponent(slug) + '&status=eq.published&limit=1', { headers: headers, cache: 'no-store' })
    .then(function (response) { if (!response.ok) throw new Error('Story request failed'); return response.json(); })
    .then(function (rows) {
      if (!rows.length) throw new Error('Story not found');
      var post = rows[0];
      return fetch(SB_URL + '/rest/v1/news_translations?select=translated_content,approved_at&source_table=eq.news_posts&source_id=eq.' + encodeURIComponent(post.id) + '&locale=eq.es&status=eq.approved&limit=1', { headers: headers, cache: 'no-store' })
        .then(function (response) { return response.ok ? response.json() : []; })
        .then(function (translations) { render(post, translations[0] || null); });
    })
    .catch(function () {
      showError(isSpanish ? 'Reportaje no disponible' : 'Story unavailable', isSpanish ? 'No pudimos cargar este reportaje. Inténtalo de nuevo más tarde.' : 'We could not load this story. Please try again later.');
    });
})();