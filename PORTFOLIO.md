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

Put the classes on `<body>`: `gc-starfield`, `gc-tiles`, `gc-construction`. The iPod and Winamp use `gc-starfield gc-tiles` on the page behind the device. The player itself is not restyled.

A full-bleed app keeps a margin with `gc-inset` on `<html>`, plus `gc-tiles` or `gc-construction` on `<html>` so the pattern stays outside the app. Windows 3.11 uses that so the teal desktop stays put.
