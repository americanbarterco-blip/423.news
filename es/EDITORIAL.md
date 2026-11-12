# Noticias 423 — flujo editorial en español

Las páginas en español usan un registro de publicación independiente en `reportes.json`. No leen ni modifican la tabla compartida de reportes en Supabase y nunca convierten automáticamente una noticia en inglés en una noticia en español.

## Publicar un reportaje

1. Confirma la información con las fuentes originales y aplica la política editorial de 423.news.
2. Prepara una traducción/adaptación en español revisada por una persona. Conserva nombres propios, cifras, fechas y atribuciones con exactitud.
3. Añade un objeto al arreglo de `reportes.json`. Usa un `slug` único, en minúsculas, sin espacios ni acentos.
4. Mantén `published: false` mientras el texto está en revisión. Cámbialo a `true` únicamente cuando la edición y la verificación estén completas.
5. Si existe una versión original en inglés, añade su URL completa en `english_url`. No marques una versión inglesa como equivalente si no corresponde al mismo reportaje.
6. Añade la URL española final al `sitemap.xml` con sus alternates `hreflang` cuando corresponda.
7. Comprueba el artículo y su enlace desde `/es/noticias.html` en el preview antes de aprobar el PR.

## Campos

```json
{
  "id": "identificador-interno-unico",
  "slug": "ejemplo-de-reportaje",
  "published": false,
  "title": "Titular revisado en español",
  "summary": "Resumen breve y preciso en español.",
  "body": "Primer párrafo.\n\nSegundo párrafo.",
  "section": "Gobierno y servicios",
  "dateline": "Cleveland, Tennessee",
  "published_at": "2026-11-12T12:00:00-05:00",
  "updated_at": "2026-11-12T12:00:00-05:00",
  "author": "Redacción de 423.news",
  "english_url": "https://423.news/report.html?id=ID-ORIGINAL",
  "image_url": "",
  "image_alt": "",
  "image_caption": "",
  "sources": [
    {
      "label": "Nombre de la fuente primaria",
      "url": "https://example.gov/source"
    }
  ]
}
```

El ejemplo es una plantilla, no una noticia real. Sustituye todos los valores antes de publicar. Si no hay una versión inglesa equivalente, deja `english_url` vacío u omítelo. Usa fuentes verificables; no inventes citas, enlaces, hechos ni atribuciones.

## URLs

- Índice: `/es/noticias.html`
- Artículo: `/es/reporte.html?slug=ejemplo-de-reportaje`
- Registro: `/es/reportes.json`

El índice solo muestra registros publicados con titular, slug y cuerpo válidos. Los artículos se enlazan desde el índice y generan título, descripción, canonical y datos estructurados propios al cargarse. Añade cada artículo aprobado al sitemap para facilitar su descubrimiento.
