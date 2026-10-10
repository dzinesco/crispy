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
  {
    slug: 'win311',
    title: 'Windows 3.11 — Folio Edition',
    description: 'A working Windows 3.11 desktop in the browser. Drag windows, play Minesweeper and Solitaire, write in Notepad.',
    tags: ['Retro', 'Browser'],
    image: '/images/portfolio/win311.png',
    imageAlt: 'Windows 3.11 desktop with Program Manager and a Notepad window open',
    demoHref: '/demo/win311/',
    postHref: '/blog/windows-311-folio',
    shippedAt: '2026-10-10',
  },
  {
    slug: 'winamp',
    title: 'Winamp 2 — Web Edition',
    description: 'It really whips. Drop in your own MP3s and get a live spectrum visualizer, a 10-band EQ with presets, and a draggable playlist.',
    tags: ['Retro', 'Browser', 'Audio'],
    image: '/images/portfolio/winamp.png',
    imageAlt: 'Winamp 2 player with the equalizer and playlist windows open',
    demoHref: '/demo/winamp/',
    shippedAt: '2026-10-10',
  },
];
