-- Add variantImages column with default empty object
ALTER TABLE "ProductLayout" ADD COLUMN "variantImages" JSONB NOT NULL DEFAULT '{}'::jsonb;