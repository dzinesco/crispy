// Projects on /portfolio. One object is one app. See PORTFOLIO.md.
// The homepage flagship (Goatshop 5.0) shows featuredProject().
// Shipped apps fill the rest of the homepage grid, newest first.
// status: 'soon' stays off /portfolio. The Defrag teaser is the only
// "under construction" block, and it is only on the homepage.
//
// demoHref    full navigation to a static app in public/demo/<slug>/
// postHref    optional link to a blog post
// image       a 16:10 screenshot in public/
// shippedAt   ISO date (YYYY-MM-DD).
// featured    pins the large slot on /portfolio. Default is Windows 3.11.
// status      'soon' is a teaser only. Not counted as live, no demo, off the homepage.
// bg          frame around the shot and the demo margin. See BACKDROPS.
export const projects = [
  {
    slug: 'macos8',
    title: 'Mac OS 8',
    description: 'A 1997 Mac desktop in your browser. Finder, MacPaint-style paint, games and all.',
    tags: ['Retro', 'Browser', 'Game'],
    image: '/images/portfolio/macos8.png',
    imageAlt: 'Mac OS 8 desktop with Finder, Paint, Calculator, and Brickout open',
    demoHref: '/demo/macos8/',
    shippedAt: '2026-10-10',
    bg: 'space',
  },
  {
    slug: 'windows98',
    title: 'Windows 98 Setup Challenge',
    description: 'Install Windows 98 from floppy and CD against the clock. Time to beat: 00:52. Survive ScanDisk, dodge the blue screen, and earn the ME boot.',
    tags: ['Retro', 'Browser', 'Game'],
    image: '/images/portfolio/windows98.png',
    imageAlt: 'ScanDisk window with a grid of disk sectors and two bad sectors flagged in red',
    demoHref: '/demo/windows98/',
    shippedAt: '2026-10-10',
  },
  {
    slug: 'cad',
    title: 'CAD',
    description: 'A drawing board in the browser. Lines, layers, undo, and an export.',
    tags: ['Drawing', 'Browser'],
    image: '/images/portfolio/cad.png',
    imageAlt: 'CAD drawing board mid-stroke, with a rectangle, a circle, and a line on the grid',
    demoHref: '/demo/cad/',
    postHref: '/blog/draw-and-see',
    shippedAt: '2026-10-10',
    bg: 'tiles',
  },
  {
    slug: 'win311',
    title: 'Windows 3.11 — Folio Edition',
    description: 'A working Windows 3.11 desktop in the browser. Drag windows, play Minesweeper and Solitaire, write in Notepad.',
    tags: ['Retro', 'Browser'],
    image: '/images/portfolio/win311.png',
    imageAlt: 'Windows 3.11 desktop with Program Manager and Minesweeper open',
    demoHref: '/demo/win311/',
    postHref: '/blog/windows-311-folio',
    shippedAt: '2026-10-10',
    bg: 'construction',
    featured: true,
  },
  {
    slug: 'winamp',
    title: 'Winamp 2 — Web Edition',
    description: 'It really whips. Drop in your own MP3s and get a live spectrum visualizer, a 10-band EQ with presets, and a draggable playlist.',
    tags: ['Retro', 'Browser', 'Audio'],
    image: '/images/portfolio/winamp.png',
    imageAlt: 'Winamp playing, with the spectrum visualizer, equalizer, and playlist centered',
    demoHref: '/demo/winamp/',
    shippedAt: '2026-10-10',
    bg: 'starfield',
  },
  {
    slug: 'ipod',
    title: 'iPod — Web Edition',
    description: 'A click-wheel iPod in your browser. Spin the wheel through real menus, hit play on built-in demo tracks, add your own audio files, or connect Spotify.',
    tags: ['Retro', 'Browser', 'Audio'],
    image: '/images/portfolio/ipod.png',
    imageAlt: 'Classic white click-wheel iPod showing its main menu, centered on a starfield',
    demoHref: '/demo/ipod/',
    shippedAt: '2026-10-10',
    bg: 'starfield',
  },
  {
    slug: 'defrag',
    title: 'Defrag',
    description: 'A disk defrag toy. The sectors are still scattered.',
    tags: [],
    status: 'soon',
  },
];

export const BACKDROPS = ['starfield', 'tiles', 'construction', 'space', 'sparkle'];

export function backdropName(project) {
  return BACKDROPS.includes(project?.bg) ? project.bg : 'tiles';
}

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
  return live.find((project) => project.slug === 'win311') || byNewest(list)[0] || null;
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

export function portfolioFilters(list = projects) {
  const counts = new Map();
  for (const project of shippedProjects(list)) {
    for (const tag of project.tags || []) {
      if (!tag || tag === 'Browser') continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

export function shortName(project) {
  if (project?.slug === 'winamp') return 'Winamp';
  return String(project?.title || '').split(' — ')[0];
}

export function cardTagline(project) {
  const parts = String(project?.title || '').split(' — ');
  const edition = parts.length > 1 ? parts.slice(1).join(' — ') : '';
  const description = project?.description || '';
  return edition ? `${edition}. ${description}` : description;
}
