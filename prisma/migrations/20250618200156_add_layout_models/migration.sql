-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "layoutVariantId" TEXT;

-- CreateTable
CREATE TABLE "Layout" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Layout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LayoutVariant" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL,
    "baseImageUrl" TEXT NOT NULL,
    "shopifyImageUrl" TEXT,
    "position" INTEGER NOT NULL,
    "color" TEXT,
    "pattern" TEXT,

    CONSTRAINT "LayoutVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Layout_shop_idx" ON "Layout"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Layout_shop_shopifyProductId_key" ON "Layout"("shop", "shopifyProductId");

-- CreateIndex
CREATE INDEX "LayoutVariant_layoutId_idx" ON "LayoutVariant"("layoutId");

-- CreateIndex
CREATE UNIQUE INDEX "LayoutVariant_layoutId_shopifyVariantId_key" ON "LayoutVariant"("layoutId", "shopifyVariantId");

-- CreateIndex
CREATE INDEX "Template_layoutVariantId_idx" ON "Template"("layoutVariantId");

-- AddForeignKey
ALTER TABLE "LayoutVariant" ADD CONSTRAINT "LayoutVariant_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "Layout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_layoutVariantId_fkey" FOREIGN KEY ("layoutVariantId") REFERENCES "LayoutVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
