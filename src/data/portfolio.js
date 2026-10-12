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
// featured    pins the large slot on /portfolio. Goatshop 5.0 is the flagship.
// status      'soon' is a teaser only. Not counted as live, no demo, off the homepage.
// bg          frame around the shot and the demo margin. See BACKDROPS.
export const projects = [
  {
    slug: 'dusknet',
    title: 'DuskNet BBS',
    description: 'A late-90s bulletin board in plain JavaScript. Five boards, 25+ seeded threads, BBCode, quote-to-reply, sticky and locked threads, and an LED hit counter. Pick a handle and post.',
    tags: ['Retro', 'Browser', 'Community'],
    image: '/images/portfolio/dusknet.png',
    imageAlt: 'The DuskNet BBS home page: a neon DUSKNET BBS logo with an LED calls counter, Home, Boards, Online, Staff and Help buttons, and Enter the Boards, Start a New Thread and See Who\'s Online buttons above the latest threads',
    demoHref: '/demo/dusknet/',
    shippedAt: '2026-10-12',
    bg: 'starfield',
  },
  {
    slug: 'cg-os',
    title: 'CG-OS — A Full Windows 98 Desktop',
    description: 'A whole Windows 98 desktop in plain JavaScript. Boot it, drag windows around, and open Word, Excel, Paint, Minesweeper, Solitaire, Winamp and more from the Start menu.',
    tags: ['Retro', 'Browser', 'Desktop'],
    image: '/images/portfolio/cg-os.png',
    imageAlt: 'CG-OS on a teal Windows 98 desktop: Word 2000, Minesweeper and Winamp open side by side, desktop icons on the left and a taskbar with a Start button and clock',
    demoHref: '/demo/cg-os/',
    shippedAt: '2026-10-12',
    bg: 'starfield',
  },
  {
    slug: 'mavisbeacon',
    title: 'Mavis Beacon Teaches Typing — 1987 Edition',
    description: 'A typing tutor in plain JavaScript. Twenty home-row lessons, timed tests, a falling-letter game and progress reports on a color-coded EGA keyboard.',
    tags: ['Retro', 'Browser', 'Education'],
    image: '/images/portfolio/mavisbeacon.png',
    imageAlt: 'Mavis Beacon Lesson 1 of 20: the F key highlighted in magenta, the jjj fff drill half typed in green, 46 WPM at 100% accuracy, above a finger-colored on-screen keyboard',
    demoHref: '/demo/mavisbeacon/',
    shippedAt: '2026-10-12',
    bg: 'starfield',
  },
  {
    slug: 'geogoated',
    title: 'GeoGoated — GeoCities, Rebuilt',
    description: 'A working GeoCities clone. Sign up, claim your ~handle, and drag-and-drop a homepage with marquees, hit counters, guestbooks and under-construction signs.',
    tags: ['Retro', 'Web App', 'Next.js'],
    image: '/images/portfolio/geogoated.png',
    imageAlt: 'The GeoGoated homepage: a purple Welcome to crispygoat banner with Sign up free and Browse the directory buttons, the newest member sites, and Y2K feature cards',
    demoHref: '/geogoated/',
    shippedAt: '2026-10-12',
    bg: 'starfield',
  },
  {
    slug: 'doom',
    title: 'DOOM — Web Edition',
    description: 'A raycast first-person shooter in plain JavaScript. WASD to move, mouse to look, click to fire through E1M1 with a pistol and a CRT glow.',
    tags: ['Retro', 'Browser', 'Game'],
    image: '/images/portfolio/doom.png',
    imageAlt: 'DOOM Web Edition in-game on E1M1 Hangar, pistol drawn, with health 100, armor 0, and ammo 30 in the HUD inside a CRT bezel on a starfield',
    demoHref: '/demo/doom/',
    shippedAt: '2026-10-12',
    bg: 'starfield',
  },
  {
    slug: 'defrag',
    title: 'Disk Defragmenter — Game Edition',
    description: 'The grid you stared at for hours, now a game. Pack every file toward the front, dodge bad sectors, and survive the classic restart at 10%.',
    tags: ['Retro', 'Browser', 'Game'],
    image: '/images/portfolio/defrag.png',
    imageAlt: 'Defragmenting Drive C mid-pass, with blue optimized blocks, red fragments, a green read head, and the color legend on a starfield',
    demoHref: '/demo/defrag/',
    shippedAt: '2026-10-10',
    bg: 'starfield',
  },
  {
    slug: 'lotus',
    title: 'Lotus 1-2-3 — Web Edition',
    description: 'Type @SUM formulas, drive everything from the / menu, then pop a bar graph in amber phosphor. Spreadsheets were cool once.',
    tags: ['Retro', 'Browser'],
    image: '/images/portfolio/lotus.png',
    imageAlt: 'Lotus 1-2-3 in amber phosphor on a beige IBM monitor, with the slash menu open over a budget sheet',
    demoHref: '/demo/lotus/',
    shippedAt: '2026-10-10',
    bg: 'starfield',
  },
  {
    slug: 'goatshop',
    title: 'Goatshop 5.0 — 1998 Edition',
    description: "Layers, History, Magic Wand and a Lens Flare you'll overuse. A full 1998 photo editor that really works.",
    tags: ['Retro', 'Browser'],
    image: '/images/portfolio/goatshop.png',
    imageAlt: 'Goatshop 5.0 mid-edit with layers, a selection, and the lens flare dialog',
    demoHref: '/demo/goatshop/',
    shippedAt: '2026-10-10',
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
