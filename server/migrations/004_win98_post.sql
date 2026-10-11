-- Publish the Windows 98 Setup Challenge post. Migrations re-run on every API start, so
-- this stays idempotent. content/blog/windows-98-setup-challenge.md is the same copy for
-- scripts/seed-posts.mjs. The deploy only ships server/, so this insert is
-- what puts the post on the box.

INSERT INTO posts (slug, title, excerpt, body_md, cover_image, status, published_at)
SELECT
  'windows-98-setup-challenge',
  'I Turned Installing Windows 98 Into a Speedrun (and It Ends in Windows ME)',
  'Install Windows 98 from floppy and CD against the clock. Survive ScanDisk or eat a blue screen. A clean run gets you Windows ME.',
  'Some people relax with yoga. I relax by remembering the exact sound a 3.5" floppy makes when it doesn''t want to come out.

So I built **[Windows 98 Setup Challenge](https://crispygoat.com/demo/windows98/)**: a browser game where you install Windows 98 from floppy and CD against the clock. No emulator, no ISO, no 45 minutes of watching a progress bar lie to you. Just the good parts, the panic parts and one very cursed ending.

## Why would anyone do this

Because installing Windows in 1998 was a *ritual*. You had the boot floppy. You had the CD with the hologram. You had the 25-character product key written on a sticky note you''d lose by 1999. And you had a deep, spiritual trust that `setup` would work this time.

It''s so fun for me, and I''m a nerd. That''s the whole pitch.

## How a run works

The clock starts the moment you touch the machine. Every step is something your hands actually did back then:

1. **Eject the floppy.** The boot disk did its job. Thank it. Get it out.
2. **Insert the CD.** Windows 98. Not Second Edition. We''re purists. Mostly.
3. **Type `setup` at `D:\>`.** Yes, you have to type it. Muscle memory is the whole sport. Typos cost you time, just like they cost you dignity in 1998.
4. **Accept the license agreement.** Nobody has ever read it. Nobody ever will. Click faster.
5. **Survive ScanDisk.** This is the boss fight.

![The D:\> prompt, ready for setup](/images/blog/windows98-setup-1.png)

## The ScanDisk boss fight

Remember ScanDisk? The little blue grid of clusters that decided whether your afternoon was fine or ruined? Now it''s a mini-game.

Sectors light up and you have to catch them. Miss sectors and the drive gets angry. Miss too many and you get the most 90s punishment imaginable: **a blue screen of death.** Full screen. Full blue. Full shame. "Press any key to continue" hits different when the thing you''re continuing is your run, from the beginning.

It''s tense and it''s dumb, and I''ve lost runs to it that I''m still emotionally recovering from.

## The ending (no spoilers, sort of)

You did everything right. Floppy out, CD in, `setup` typed clean, license accepted, every sector caught. You''ve earned it.

The machine reboots in 2.7 seconds and you are greeted by **Windows Millennium Edition**, version 4.90.3000.

*"It''s the greatest."*

You installed Windows 98 and got Windows ME. That''s not a bug, it''s a history lesson. Your win card says it best:

> **1998 was a long time ago, but ME is forever.**

![The win card after a clean run: Windows ME installed, 00:52](/images/blog/windows98-setup-2.png)

## Stats, because nerds need numbers

Your runs are tracked, so you can see your times, chase your best, and figure out whether you''re losing seconds at the `D:\>` prompt or getting wrecked by ScanDisk. Small improvements add up. One clean keystroke at a time. This is how speedrunning communities are born, and also how they get weird.

## Speedrun tips from someone who has lost too many runs

- **Pre-type the prompt in your head.** `setup` and Enter. Don''t think. Be the keyboard.
- **The license is not a reading assignment.** Your eyes should never stop on it.
- **ScanDisk rewards calm hands.** Panic-clicking is how you meet the blue screen.
- **Don''t get cocky at the end.** The run isn''t over until ME says it''s the greatest.

## Part of something bigger

This lives in the [crispygoat portfolio](https://crispygoat.com/portfolio) next to the other things I build that are technically software and spiritually nostalgia: Windows 3.11 Folio Edition, a Winamp, an iPod, and a working CAD toy. The idea is simple: a portfolio you can actually play.

## Your move

Go install Windows 98. Beat my time. Post your win card. Tell me you didn''t feel something when ME booted.

**[Play the Windows 98 Setup Challenge →](https://crispygoat.com/demo/windows98/)**

1998 was a long time ago. ME is forever.
',
  '/images/portfolio/windows98.png',
  'published',
  '2026-10-11T00:30:00Z'
WHERE NOT EXISTS (SELECT 1 FROM posts WHERE slug = 'windows-98-setup-challenge');
