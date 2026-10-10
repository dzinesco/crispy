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

`bg` is the 90s frame around the screenshot, the featured stage, and the margin of `/demo/<slug>/` where the app does not fill the window. One of `starfield`, `tiles`, `construction`, `space`, `sparkle`. Leave it off and the frame is `tiles`. The patterns are in `public/gc-bg.css`.

Link `/gc-bg.css` after the app stylesheet. A full-bleed app gets `class="gc-frame gc-bg gc-<bg>"` on `<html>` so the pattern is a margin. A fixed full-window shell (Windows 3.11) gets `class="gc-demo gc-bg gc-<bg>"` on `<html>` so the shell is inset and its own desktop stays put. An app that already has a surround (Winamp) puts `gc-bg gc-<bg>` on that surround. Do not restyle the app UI itself.
