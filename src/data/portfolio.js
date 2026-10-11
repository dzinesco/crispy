// Projects on /portfolio. Add an object to publish a card.
// The homepage hero features `cad` when it is present, otherwise the first
// entry. The homepage Latest strip mixes these with posts from the API.
//
// demoHref   full navigation to a static app in public/demo/<slug>/
// postHref   optional link to a blog post
// image      a 16:10 screenshot in public/
// shippedAt  ISO date (YYYY-MM-DD) so Latest can sort this beside posts
export const projects = [
  {
    slug: 'macos8',
    title: 'Mac OS 8',
    description: 'A 1997 Mac desktop in your browser. Finder, MacPaint-style paint, games and all.',
    tagline: 'A 1997 Mac desktop in your browser. Finder, MacPaint-style paint, games and all.',
    tags: ['Retro'],
    image: '/images/portfolio/macos8.png',
    imageAlt: 'Mac OS 8 desktop with Finder, Paint, Calculator, and Brickout open',
    demoHref: '/demo/macos8/',
    shippedAt: '2026-10-11',
  },
  {
    slug: 'cad',
    title: 'CAD',
    description: 'A drawing board in the browser. Lines, layers, undo, and an export.',
    tags: ['Drawing', 'Browser'],
    image: '/images/portfolio/cad.png',
    imageAlt: 'CAD drawing board with a rectangle, a circle, and a line',
    demoHref: '/demo/cad/',
    postHref: '/blog/draw-and-see',
    shippedAt: '2026-10-10',
  },
];
