-- Publish the CAD launch post. Migrations re-run on every API start, so this
-- stays idempotent. content/blog/draw-and-see.md is the same copy for
-- scripts/seed-posts.mjs. The deploy only ships server/, so this insert is
-- what puts the post on the box.

INSERT INTO posts (slug, title, excerpt, body_md, cover_image, status, published_at)
SELECT
  'draw-and-see',
  'CAD — Draw & See',
  'A drawing board that lives in the browser. Lines, layers, undo, and an export. Nothing to install.',
  'I wanted a drawing board I could open in a tab. So here it is.

CAD is a small 2D app. Tools sit on the left, the page in the middle, style and layers on the right. No account. No install. Close the tab and the drawing is gone unless you saved it.

## What you can do

- Lines, rectangles, circles, ellipses, polylines, polygons, and arcs
- Text and dimensions
- Undo, redo, grid, snap, and zoom
- Layers, so a sketch can sit under the real lines
- Save the drawing as JSON, or export SVG and PNG

The page stays a plain drawing surface. The buttons and the mark in the corner use the shop colors. The mark sends you back to the site.

[Try it](/demo/cad/).

![CAD on the drawing board](/images/portfolio/cad.png)
',
  '/images/portfolio/cad.png',
  'published',
  '2026-10-10T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE slug = 'draw-and-see');
