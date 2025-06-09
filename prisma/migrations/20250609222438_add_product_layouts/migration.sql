/*
  Warnings:

  - Added the required column `productLayoutId` to the `Template` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable (before we modify Template)
CREATE TABLE "ProductLayout" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "baseImageUrl" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductLayout_shop_idx" ON "ProductLayout"("shop");

-- Create default ProductLayout for existing shops
INSERT INTO "ProductLayout" ("id", "name", "shop", "width", "height", "baseImageUrl", "attributes", "createdAt", "updatedAt")
SELECT DISTINCT
    'default-' || "shop" as "id",
    'Default Layout' as "name",
    "shop",
    600 as "width",
    400 as "height",
    '/media/images/8-spot-red-base-image.png' as "baseImageUrl",
    '{"colors": ["default"], "edgePatterns": ["default"]}'::jsonb as "attributes",
    CURRENT_TIMESTAMP as "createdAt",
    CURRENT_TIMESTAMP as "updatedAt"
FROM "Template"
WHERE EXISTS (SELECT 1 FROM "Template");

-- AlterTable - add columns with temporary default
ALTER TABLE "Template" 
ADD COLUMN "layoutVariant" TEXT DEFAULT 'default',
ADD COLUMN "productLayoutId" TEXT DEFAULT 'temp';

-- Update existing templates to use their shop's default layout
UPDATE "Template" 
SET "productLayoutId" = 'default-' || "shop"
WHERE "productLayoutId" = 'temp';

-- Remove the defaults now that data is populated
ALTER TABLE "Template" 
ALTER COLUMN "layoutVariant" DROP DEFAULT,
ALTER COLUMN "productLayoutId" SET NOT NULL,
ALTER COLUMN "productLayoutId" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Template_productLayoutId_idx" ON "Template"("productLayoutId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_productLayoutId_fkey" FOREIGN KEY ("productLayoutId") REFERENCES "ProductLayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
