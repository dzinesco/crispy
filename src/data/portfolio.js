// Projects on /portfolio. One object is one app. See PORTFOLIO.md.
// The homepage hero features `cad` when it is present, otherwise the first
// shipped entry. The homepage Latest strip mixes shipped apps with posts.
//
// demoHref    full navigation to a static app in public/demo/<slug>/
// postHref    optional link to a blog post
// image       a 16:10 screenshot in public/
// shippedAt   ISO date (YYYY-MM-DD). Newest is featured unless `featured` is set.
// featured    optional pin for the big slot. A later entry wins a date tie.
// status      'soon' is a teaser only. Not counted as live, no demo, off the homepage.
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
  {
    slug: 'bench',
    title: 'Next up',
    description: 'Another toy is in pieces on the bench. It gets a link when you can open it and use it.',
    tags: [],
    status: 'soon',
  },
];

export function isSoon(project) {
  return project?.status === 'soon';
}

export function shippedProjects(list = projects) {
  return (list || []).filter((project) => project?.slug && project?.title && !isSoon(project));
}

export function byNewest(list = projects) {
  const source = list || [];
  return shippedProjects(source)
    .map((project) => ({ project, index: source.indexOf(project) }))
    .sort((a, b) => {
      const ta = Date.parse(a.project.shippedAt || '') || 0;
      const tb = Date.parse(b.project.shippedAt || '') || 0;
      if (tb !== ta) return tb - ta;
      return b.index - a.index;
    })
    .map(({ project }) => project);
}

export function soonProjects(list = projects) {
  return (list || []).filter((project) => project?.slug && project?.title && isSoon(project));
}

export function featuredProject(list = projects) {
  const live = shippedProjects(list);
  const flagged = live.find((project) => project.featured);
  if (flagged) return flagged;
  let best = null;
  let bestAt = -Infinity;
  let bestIndex = -1;
  live.forEach((project, index) => {
    const at = Date.parse(project.shippedAt || '') || 0;
    if (at > bestAt || (at === bestAt && index >= bestIndex)) {
      best = project;
      bestAt = at;
      bestIndex = index;
    }
  });
  return best;
}

export function portfolioTags(list = projects) {
  const tags = [];
  for (const project of shippedProjects(list)) {
    for (const tag of project.tags || []) {
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
  }
  return tags;
}
