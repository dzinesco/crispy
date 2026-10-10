// Homepage "Latest" rail. Posts come from the API; projects from src/data/portfolio.js.

export function leadProject(projects = []) {
  if (!projects.length) return null;
  return projects.find((project) => project.slug === 'cad') || projects[0];
}

export function mergeLatest(posts = [], projects = [], limit = 6) {
  const notes = (posts || [])
    .filter((post) => post?.slug && post?.title)
    .map((post) => ({
      id: `post:${post.slug}`,
      kind: 'note',
      kicker: 'Note',
      title: post.title,
      excerpt: post.excerpt || '',
      href: `/blog/${post.slug}`,
      external: false,
      date: post.published_at || post.created_at || null,
      image: post.cover_image || null,
      imageAlt: '',
    }));

  const work = (projects || [])
    .filter((project) => project?.slug && project?.title)
    .map((project) => ({
      id: `work:${project.slug}`,
      kind: 'work',
      kicker: 'Work',
      title: project.title,
      excerpt: project.description || '',
      href: project.demoHref || `/portfolio#${project.slug}`,
      external: Boolean(project.demoHref),
      date: project.shippedAt || null,
      image: project.image || null,
      imageAlt: project.imageAlt || '',
    }));

  return [...notes, ...work]
    .sort((a, b) => {
      const ta = Date.parse(a.date || '') || 0;
      const tb = Date.parse(b.date || '') || 0;
      if (tb !== ta) return tb - ta;
      if (a.kind !== b.kind) return a.kind === 'work' ? -1 : 1;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}
