# Publicar un reportaje en español en 423.news

Este flujo conserva el reportaje original en inglés y publica una versión en español como una página separada. No reemplaza ni modifica el original.

## Archivos que participan

- `es/reportes.json`: registro de reportajes traducidos y aprobados.
- `es/reportes.js`: carga el registro, muestra las tarjetas y renderiza cada artículo.
- `es/reportes.html`: índice público de reportajes en español.
- `es/reporte.html?slug=...`: página individual en español.

## Requisitos antes de publicar

1. Confirma que el reportaje original en inglés está publicado y que su URL es correcta.
2. Traduce el titular, resumen y cuerpo al español natural. No añadas hechos que no estén en el original.
3. Conserva las fechas, lugares, enlaces y atribuciones de las fuentes.
4. Revisa nombres propios, números, direcciones y términos de seguridad pública.
5. Si el original contiene información preliminar, conserva esa advertencia. Una transmisión de radio o scanner por sí sola no confirma un incidente.
6. No publiques la traducción hasta que una persona la haya revisado.

## Formato de cada registro

Añade un objeto al arreglo JSON de `es/reportes.json`:

```json
{
  "slug": "ejemplo-de-titular-local",
  "published": true,
  "published_at": "2026-11-13T18:00:00-05:00",
  "updated_at": "2026-11-13T18:00:00-05:00",
  "title": "Titular revisado en español",
  "summary": "Resumen fiel en español.",
  "body": "Primer párrafo.\n\nSegundo párrafo.",
  "section": "Noticias locales",
  "dateline": "Cleveland, Tennessee",
  "author": "Redacción de 423.news",
  "english_url": "https://423.news/report.html?id=ID_ORIGINAL",
  "sources": [
    {
      "label": "Fuente oficial",
      "url": "https://example.gov/"
    }
  ]
}
```

Reemplaza los valores de ejemplo por información real. No uses una URL de ejemplo ni publiques datos inventados. Los enlaces de fuentes deben ser HTTPS. Puedes añadir opcionalmente `paragraphs`, `image_url`, `image_alt` y `image_caption`.

## Cómo funciona la publicación

- `published: false` mantiene el borrador fuera del sitio público.
- `published: true` hace que el reportaje aparezca en el índice y pueda abrirse mediante su slug.
- `english_url` muestra un enlace a la versión original en inglés y permite declarar el alternativo hreflang inglés.
- Cada artículo español usa su propia URL canónica `/es/reporte.html?slug=...`.
- Añade las URLs de artículos publicados al sitemap cuando corresponda; no añadas borradores.

## Seguridad editorial

No copies credenciales, claves API ni datos privados al archivo JSON. No publiques nombres de personas privadas ni datos personales sensibles que no sean necesarios para el interés público. Si la información aún no está confirmada, identifícala como preliminar y explica qué falta verificar.
