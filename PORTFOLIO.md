# Adding an app

`/portfolio` reads `src/data/portfolio.js`. One object is one app. The page sorts shipped apps newest-first and will hold a long list.

1. Drop the static build in `public/demo/<slug>/` so `public/demo/<slug>/index.html` is the app.
2. Add a 16:10 screenshot at `public/images/portfolio/<slug>.png` (1280×800 is the usual size).
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

`postHref` is optional. Leave it off and the card has Launch only.

`featured: true` pins the large slot. Omit it and the newest `shippedAt` is featured. If two dates match, the later entry wins.

`status: 'soon'` is the optional Next up teaser. Give it a title and description, no `demoHref`. It is not counted as live and does not appear on the homepage.

Any tag on a shipped app becomes a filter chip. Slugs stay `[a-z0-9-]+`.

`bg` is the 90s frame around the screenshot and the featured stage. One of `starfield`, `tiles`, `construction`, `space`, `sparkle`. Leave it off and the frame is `tiles`.

The same patterns are the page background on `/demo/<slug>/`. They live in `public/demo/_shared/geocities.css`. Link it after the app stylesheet, with a root-absolute path so a `<base>` tag cannot rewrite it:

```html
<link rel="stylesheet" href="/demo/_shared/geocities.css" />
```

Put `class="geo geo-starfield"` (or `geo-tiles`, `geo-construction`, `geo-space`, `geo-sparkle`) on the element that is the empty page behind the UI. Winamp uses that on `<html>` and `<body>`, and the player windows stay on their own skin.

A full-bleed app keeps a margin with `geo-inset` on `<html>` as well. Windows 3.11 uses it so only the outside of the desktop changes. Do not put these classes on the app's own windows or canvas.
