-- Only explicitly labeled starter originals can reference bundled illustrations.
-- Uploaded visitor images continue through the private sanitized asset pipeline.
alter table public.memories drop constraint memories_seed_image_url_check;
alter table public.memories add constraint memories_seed_image_url_check
check (seed_image_url is null or (is_seed and (
  seed_image_url ~ '^/seed-[a-z-]+[.]svg$'
  or seed_image_url ~ '^/starter-world/[a-z-]+[.]svg$'
)));
