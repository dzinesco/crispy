-- Retro GeoCities-style art covers for posts without app screenshots. Idempotent.
UPDATE posts SET cover_image = '/images/blog/cover-25-years-owned-operated.webp' WHERE slug = '25-years-owned-operated' AND (cover_image IS NULL OR cover_image = '');
UPDATE posts SET cover_image = '/images/blog/cover-837-reject-patterns.webp' WHERE slug = '837-reject-patterns' AND (cover_image IS NULL OR cover_image = '');
UPDATE posts SET cover_image = '/images/blog/cover-agent-audited-itself-600-mistake.webp' WHERE slug = 'agent-audited-itself-600-mistake' AND (cover_image IS NULL OR cover_image = '');
UPDATE posts SET cover_image = '/images/blog/cover-billing-service-vs-software.webp' WHERE slug = 'billing-service-vs-software' AND (cover_image IS NULL OR cover_image = '');
UPDATE posts SET cover_image = '/images/blog/cover-black-canyon-tickets-automation.webp' WHERE slug = 'black-canyon-tickets-automation' AND (cover_image IS NULL OR cover_image = '');
UPDATE posts SET cover_image = '/images/blog/cover-co-medicaid-billing-without-chaos.webp' WHERE slug = 'co-medicaid-billing-without-chaos' AND (cover_image IS NULL OR cover_image = '');
UPDATE posts SET cover_image = '/images/blog/cover-evv-to-claim-pipeline.webp' WHERE slug = 'evv-to-claim-pipeline' AND (cover_image IS NULL OR cover_image = '');
UPDATE posts SET cover_image = '/images/blog/cover-hcpf-provider-ops.webp' WHERE slug = 'hcpf-provider-ops' AND (cover_image IS NULL OR cover_image = '');
UPDATE posts SET cover_image = '/images/blog/cover-home-assistant-bridge-setup.webp' WHERE slug = 'home-assistant-bridge-setup' AND (cover_image IS NULL OR cover_image = '');
UPDATE posts SET cover_image = '/images/blog/cover-neoclaim-file-intake.webp' WHERE slug = 'neoclaim-file-intake' AND (cover_image IS NULL OR cover_image = '');
UPDATE posts SET cover_image = '/images/blog/cover-scheduling-ops-closed-loop.webp' WHERE slug = 'scheduling-ops-closed-loop' AND (cover_image IS NULL OR cover_image = '');
UPDATE posts SET cover_image = '/images/blog/cover-tesla-behind-home-assistant.webp' WHERE slug = 'tesla-behind-home-assistant' AND (cover_image IS NULL OR cover_image = '');
