-- First add the new column with a default value
ALTER TABLE "Template" ADD COLUMN "colorVariant" TEXT NOT NULL DEFAULT 'default';

-- Drop the old column
ALTER TABLE "Template" DROP COLUMN "layoutVariant";

-- Create the new index
CREATE INDEX "Template_productLayoutId_colorVariant_idx" ON "Template"("productLayoutId", "colorVariant");

-- Remove the default constraint after data is migrated
ALTER TABLE "Template" ALTER COLUMN "colorVariant" DROP DEFAULT;