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
}
```

`postHref` is optional. Leave it off and the card has Launch only.

`featured: true` pins the large slot. Omit it and the newest `shippedAt` is featured. If two dates match, the later entry wins.

`status: 'soon'` is the optional Next up teaser. Give it a title and description, no `demoHref`. It is not counted as live and does not appear on the homepage.

Any tag on a shipped app becomes a filter chip. Slugs stay `[a-z0-9-]+`.
