-- Publish the Windows 3.11 Folio post. Migrations re-run on every API start, so
-- this stays idempotent. content/blog/windows-311-folio.md is the same copy for
-- scripts/seed-posts.mjs. The deploy only ships server/, so this insert is
-- what puts the post on the box.

INSERT INTO posts (slug, title, excerpt, body_md, cover_image, status, published_at)
SELECT
  'windows-311-folio',
  'Windows 3.11 — Folio Edition',
  'A working Windows 3.11 desktop in the browser. Minesweeper, Solitaire, Paintbrush, and the rest. Nothing to install.',
  'Some people collect vinyl. I rebuilt Windows 3.11.

Folio Edition is a working 1993 desktop in a browser tab. Grey title bars, chunky icons, windows you can drag around. No floppy disks. No install. No DOS prompt between you and the good stuff.

## What''s on the desktop

- Program Manager and File Manager, the way you remember them
- Notepad, Write, and Cardfile for the paperwork
- Paintbrush for the art department
- Calculator, Clock, and Control Panel
- Minesweeper, Solitaire, and Hearts for the rest of the afternoon

It is a portfolio piece, but it is also just fun. Open it, lose a round of Minesweeper, and tell nobody.

[Try it](/demo/win311/).

![Windows 3.11 desktop with Program Manager and a Notepad window open](/images/portfolio/win311.png)
',
  '/images/portfolio/win311.png',
  'published',
  '2026-10-10T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE slug = 'windows-311-folio');
