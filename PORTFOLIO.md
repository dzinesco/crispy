# Adding an app

`/portfolio` reads `src/data/portfolio.js`. One object is one app. Shipped apps sort newest-first. The page is a quiet frame: hero, one featured app, a tag filter, then the gallery.

1. Drop the static build in `public/demo/<slug>/` so `public/demo/<slug>/index.html` is the app.
2. Add a 16:10 screenshot at `public/images/portfolio/<slug>.png` (1280×800), shot mid-action and centered. Also ship AVIF and WebP next to it: `<slug>-1280`, `<slug>-640`, and a tighter mobile crop `<slug>-m`, each as `.avif` and `.webp`. The page lazy-loads those and falls back to the PNG.
3. Append one entry to `projects`:

```js
{
  slug: 'my-app',
  title: 'My App',
  description: 'One sentence. It has to run in the browser.',
  tags: ['Browser'],
  image: '/images/portfolio/my-app.png',
  imageAlt: 'What the screenshot shows',
  demoHref: '/demo/my-app/',
  postHref: '/blog/my-app',
  shippedAt: '2026-10-10',
  bg: 'tiles',
}
```

`postHref` is optional. Leave it off and the featured card hides “Read the build”. Gallery cards are a single link to the demo.

`featured: true` pins the large slot on `/portfolio` and the Goatshop 5.0 slot on the homepage. Omit it and Windows 3.11 is featured. The card title is the part of `title` before ` — `; the edition stays in the tagline. Winamp’s card title is `Winamp`.

`status: 'soon'` is a teaser. Give it a title and description, no `demoHref`. It is not counted as live and does not appear on `/portfolio`. The Defrag teaser is the only “under construction” block, and it only appears on the homepage.

Filter chips are `All` plus each tag except `Browser`, sorted by how many shipped apps use it. The choice is stored in `?tag=`. Slugs stay `[a-z0-9-]+`.

`bg` is the pattern inside the screenshot bezel only. One of `starfield`, `tiles`, `construction`, `space`, `sparkle`. Leave it off and the bezel is `tiles`. It is not the page background.

Demo pages keep their own surround in `public/demo/_shared/geocities.css`. Link it after the app stylesheet, with a root-absolute path so a `<base>` tag cannot rewrite it:

```html
<link rel="stylesheet" href="/demo/_shared/geocities.css" />
```

Put the classes on `<body>`: `gc-starfield`, `gc-tiles`, `gc-construction`. The iPod and Winamp use `gc-starfield gc-tiles` on the page behind the device. The player itself is not restyled.

A full-bleed app keeps a margin with `gc-inset` on `<html>`, plus `gc-tiles` or `gc-construction` on `<html>` so the pattern stays outside the app. Windows 3.11 uses that so the teal desktop stays put.
