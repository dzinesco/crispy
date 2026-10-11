// Projects on /portfolio. One object is one app. See PORTFOLIO.md.
// The homepage hero features `cad` when it is present, otherwise the first
// shipped entry. The homepage Latest strip mixes shipped apps with posts.
//
// demoHref    full navigation to a static app in public/demo/<slug>/
// postHref    optional link to a blog post
// image       a 16:10 screenshot in public/
// shippedAt   ISO date (YYYY-MM-DD).
// featured    pins the large slot on /portfolio. Goatshop 5.0 is the flagship.
// status      'soon' is a teaser only. Not counted as live, no demo, off the homepage.
// bg          frame around the shot and the demo margin. See BACKDROPS.
export const projects = [
  {
    slug: 'goatshop',
    title: 'Goatshop 5.0 — 1998 Edition',
    description: "Layers, History, Magic Wand and a Lens Flare you'll overuse. A full 1998 photo editor that really works.",
    tags: ['Retro', 'Browser'],
    image: '/images/portfolio/goatshop.png',
    imageAlt: 'Goatshop 5.0 mid-edit with layers, a selection, and the lens flare dialog',
    demoHref: '/demo/goatshop/',
    shippedAt: '2026-10-11',
    bg: 'starfield',
    featured: true,
  },
  {
    slug: 'napster',
    title: 'Napster 2 — Web Edition',
    description: 'Log in, search 220 late-90s tracks, watch the KB/s crawl, and chat in #lobby. Nobody gets sued this time.',
    tags: ['Retro', 'Browser'],
    image: '/images/portfolio/napster.png',
    imageAlt: 'Napster search results for Metallica with a download crawling in File Transfers and #lobby chat open',
    demoHref: '/demo/napster/',
    shippedAt: '2026-10-10',
    bg: 'starfield',
  },
  {
    slug: 'deskmate',
    title: 'Tandy DeskMate',
    description: 'Tandy\'s 1984 GUI, F-keys and all. Eight full-screen apps, sixteen colors, and a modem that dials a BBS.',
    tags: ['Retro', 'Browser'],
    image: '/images/portfolio/deskmate.png',
    imageAlt: 'Crispygoat DeskMate worksheet on a blue screen, with a SUM total and the F1–F10 bar, letterboxed on a starfield',
    demoHref: '/demo/deskmate/',
    shippedAt: '2026-10-10',
    bg: 'starfield',
  },
  {
    slug: 'netzero',
    title: 'NetZero — Free Internet',
    description: 'Dial up with the full 56k modem screech, click the banner ad, and spend your free hours wisely.',
    tags: ['Retro', 'Browser'],
    image: '/images/portfolio/netzero.png',
    imageAlt: 'NetZero start page open in its browser window on a teal Windows desktop, connected at 53.3 kbps',
    demoHref: '/demo/netzero/',
    shippedAt: '2026-10-10',
    bg: 'starfield',
  },
  {
    slug: 'netscape',
    title: 'Netscape Navigator 3',
    description: 'Back, Forward, bookmarks and Find all work. Stare at the spinning N like it\'s 1996 and the page is still loading.',
    tags: ['Retro', 'Browser'],
    image: '/images/portfolio/netscape.png',
    imageAlt: 'Netscape Navigator 3 window showing the Welcome to Netscape page',
    demoHref: '/demo/netscape/',
    shippedAt: '2026-10-10',
    bg: 'starfield',
  },
  {
    slug: 'macos8',
    title: 'Mac OS 8 — Platinum Edition',
    description: 'Finder windows, a paint app and Brickout on a 1997 Platinum desktop. Think different, slowly.',
    tags: ['Retro', 'Browser', 'Game'],
    image: '/images/portfolio/macos8.png',
    imageAlt: 'Mac OS 8 desktop with Finder, Paint, Calculator, and Brickout open',
    demoHref: '/demo/macos8/',
    shippedAt: '2026-10-10',
    bg: 'space',
  },
  {
    slug: 'windows98',
    title: 'Windows 98 — Setup Challenge',
    description: 'Install Windows 98 against the clock. Swap disks, type setup, survive ScanDisk. Win and you get ME.',
    tags: ['Retro', 'Browser', 'Game'],
    image: '/images/portfolio/windows98.png',
    imageAlt: 'ScanDisk window with a grid of disk sectors and two bad sectors flagged in red',
    demoHref: '/demo/windows98/',
    shippedAt: '2026-10-10',
  },
  {
    slug: 'cad',
    title: 'CAD — Drafting Table',
    description: 'Lines, layers, undo and a clean export. A drafting table that never runs out of paper.',
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
    description: 'Drag windows around Program Manager, clear Minesweeper, lose at Solitaire. 1993 never crashed this smoothly.',
    tags: ['Retro', 'Browser'],
    image: '/images/portfolio/win311.png',
    imageAlt: 'Windows 3.11 desktop with Program Manager and Minesweeper open',
    demoHref: '/demo/win311/',
    postHref: '/blog/windows-311-folio',
    shippedAt: '2026-10-10',
    bg: 'construction',
  },
  {
    slug: 'winamp',
    title: 'Winamp 2 — Web Edition',
    description: 'Drop in your MP3s for a live spectrum visualizer, a 10-band EQ and a draggable playlist. It really whips.',
    tags: ['Retro', 'Browser', 'Audio'],
    image: '/images/portfolio/winamp.png',
    imageAlt: 'Winamp playing, with the spectrum visualizer, equalizer, and playlist centered',
    demoHref: '/demo/winamp/',
    shippedAt: '2026-10-10',
    bg: 'starfield',
  },
  {
    slug: 'ipod',
    title: 'iPod — Classic Edition',
    description: 'Spin the click wheel through real menus, play the demo tracks or your own, and connect Spotify. 1,000 songs in your pocket.',
    tags: ['Retro', 'Browser', 'Audio'],
    image: '/images/portfolio/ipod.png',
    imageAlt: 'Classic white click-wheel iPod showing its main menu, centered on a starfield',
    demoHref: '/demo/ipod/',
    shippedAt: '2026-10-10',
    bg: 'starfield',
  },
  {
    slug: 'bench',
    title: 'Next up',
    description: 'On the bench now. It gets a link the day it actually works.',
    tags: [],
    status: 'soon',
    bg: 'sparkle',
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
      return a.index - b.index;
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
