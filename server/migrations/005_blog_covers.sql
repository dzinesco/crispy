-- Blog cover images: real screenshots of the live apps. Idempotent.
UPDATE posts SET cover_image = '/images/blog/cover-windows98.webp' WHERE slug = 'windows-98-setup-challenge';
UPDATE posts SET cover_image = '/images/blog/cover-win311.webp' WHERE slug = 'windows-311-folio';
UPDATE posts SET cover_image = '/images/blog/cover-cad.webp' WHERE slug = 'draw-and-see';
UPDATE posts SET cover_image = '/images/blog/cover-crispygoat-home.webp' WHERE slug = 'welcome-to-the-crispy-goat-blog';
-- These pointed at images that were never deployed (404 -> HTML); clear them.
UPDATE posts SET cover_image = NULL WHERE cover_image IN ('/images/blog-25-years-owned-operated.png','/images/blog-evv-claim-leaks.png','/images/blog-co-medicaid-clearinghouse.png');
