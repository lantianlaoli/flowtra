-- Add SEO-specific fields to articles table for better search engine optimization

-- Add meta_description field for custom meta descriptions
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS meta_description text;

-- Add keywords field as text array for article-specific keywords
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS keywords text[];

-- Add og_image field for custom Open Graph images
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS og_image text;

-- Add comments for documentation
COMMENT ON COLUMN articles.meta_description IS 'Custom meta description for SEO (overrides auto-generated excerpt if provided)';
COMMENT ON COLUMN articles.keywords IS 'Article-specific keywords for SEO';
COMMENT ON COLUMN articles.og_image IS 'Custom Open Graph image URL (overrides default if provided)';
