-- Add unique constraint on site_url to allow upsert
ALTER TABLE public.wp_sites ADD CONSTRAINT wp_sites_site_url_key UNIQUE (site_url);