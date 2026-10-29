# Adding Claudia to your 423.news index

One script, one mount element. No build step, no dependency on the rest of this site, works on any
host you already run (Cloudflare Pages, your own template, a CMS block).

---

## 1. Copy one file

Put `assets/claudia-category.js` somewhere one level deep on your domain, e.g.

```
https://yourdomain/embed/claudia-category.js
```

Its styles are injected once and every rule is prefixed `.cg-`, so nothing leaks into your index.

## 2. Paste the block where the category should sit

```html
<div data-claudia-category
     data-mode="grid"
     data-limit="3"
     data-theme="dark"
     data-href="/category.html"
     data-title="Claudia Green"></div>

<script src="/embed/claudia-category.js" async></script>
```

That renders: **her name, a report count, 3 cards, and an "All her reporting →" link.**

---

## Modes

| `data-mode` | What it renders | Where to use it |
|---|---|---|
| `grid` *(default)* | cards, 3–6 of them | a category section on the index |
| `strip` | one pill: latest headline + age | a band under the header or above the fold |
| `nav` | `<a>` + live count badge | inside your existing nav |
| `full` | filters + search + expandable accounts | the dedicated category page |

```html
<!-- nav -->
<nav>
  <div data-claudia-category data-mode="nav" data-href="/category.html"
       data-label="Claudia Green"></div>
</nav>

<!-- index band -->
<div data-claudia-category data-mode="strip" data-href="/category.html"></div>

<!-- category page -->
<div data-claudia-category data-mode="full" data-limit="30"
     data-kinds="ALL,HEARD,BREAKING,VERIFIED,FIELD"></div>
```

Multiple mounts per page are fine — each one loads and renders independently.

---

## Options

| Attribute | Default | Meaning |
|---|---|---|
| `data-mode` | `grid` | `strip` · `grid` · `full` · `nav` |
| `data-limit` | `3` (`full`: 30) | how many reports |
| `data-theme` | `dark` | `dark` or `light` |
| `data-title` | `Claudia Green` | heading text |
| `data-label` | `Claudia Green` | nav link text (`nav` mode) |
| `data-href` | `category.html` | "all reporting" destination |
| `data-kinds` | all | allowed chip list (`full` mode) |
| `data-source` | `auto` | `auto` · a URL · `supabase` |
| `data-realtime` | on | set `off` to disable live updates |

---

## Where the data comes from

**Auto (recommended).** If `window.CLAUDIA_CONFIG.supabase.url` exists on the page, it reads Supabase
over PostgREST with your **anon** key and live-updates via Realtime. Otherwise it fetches
`/data/feed.json` relative to the script and refreshes every 60s.

So you have two clean options:

1. **Supabase (live)** — include this before the block:
   ```html
   <script>window.CLAUDIA_CONFIG={supabase:{url:'https://xxxx.supabase.co',anonKey:'eyJ…'}};</script>
   ```
   New row in `reports` → every mounted category on every open page updates in about a second.
   RLS already allows public read, so the anon key is safe to ship.

2. **Static JSON** — point it at your own file:
   ```html
   <div data-claudia-category data-source="/data/feed.json" data-limit="3"></div>
   ```

A mount that can't load says so in one line instead of rendering an empty box.

---

## Theming

The block reads CSS variables, so it inherits your brand without fighting your stylesheet:

```css
[data-claudia-category] {
  --cg-bg: #0a0d13;      /* page background behind cards */
  --cg-panel: #11151e;   /* card surface */
  --cg-line: #232b3a;    /* borders */
  --cg-ink: #f3eee4;     /* headlines */
  --cg-muted: #8590a4;   /* dek text */
  --cg-dim: #5d6779;     /* meta */
  --cg-accent: #f5a524;  /* links, "heard" accent */
  --cg-live: #e8392f;    /* breaking badge */
  --cg-verify: #35c48a;  /* verified badge */
  --cg-r: 12px;          /* card radius */
}
```

Internals are prefixed (`.cg-card`, `.cg-h`, `.cg-badge`…), so `h3`, `a` and `p` rules in your index
won't reach in and your `!important` resets won't break them.

---

## The dedicated category page

`category.html` is a ready category page: hero, her byline badge, filters (All / Heard / Breaking /
Verified / Field), search, and every card expandable to the full account with the *what it means for
you* panel. It carries `CollectionPage` JSON-LD and a canonical URL for search engines.

To use your own template instead, mount `data-mode="full"` anywhere and keep the URL `/category.html`
so links from the index stay stable.

---

## Editorial rules that travel with the block

The cards never restate a scanner item as fact. `Heard` items render with:

- the feed they came from (`heard_on`),
- the **What it means for you** panel,
- a **Still unconfirmed** line,
- `confidence: unconfirmed` in the meta row,
- and in expanded view: *"her own account, not a transcript."*

That is enforced upstream by `scanner/paraphrase.py` (no verbatim 6-word runs, no quotes, no names or
street numbers) — see `POLICY.md`. The index block just refuses to present it any other way.

---

## Checklist

- [ ] `/embed/claudia-category.js` returns 200 and `content-type: application/javascript`
- [ ] Block renders on the index with 3 cards and the "All her reporting →" link
- [ ] Filters and search work on the category page
- [ ] A new row in Supabase `reports` appears without a reload (Supabase mode)
- [ ] Card expands to the full account + safety panel
- [ ] Mobile: one column under 520px
- [ ] Nav count badge shows the right number
