-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_productLayoutId_fkey";

-- DropIndex
DROP INDEX "Template_productLayoutId_colorVariant_idx";

-- AlterTable
ALTER TABLE "ProductLayout" ALTER COLUMN "designableArea" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "isColorVariant" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "masterTemplateId" TEXT,
ADD COLUMN     "shopifyProductId" TEXT,
ADD COLUMN     "shopifyVariantId" TEXT,
ALTER COLUMN "productLayoutId" DROP NOT NULL,
ALTER COLUMN "colorVariant" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TemplateColor" (
    "id" TEXT NOT NULL,
    "chipColor" TEXT NOT NULL,
    "color1" TEXT NOT NULL,
    "color2" TEXT NOT NULL,
    "color3" TEXT NOT NULL,
    "color4" TEXT,
    "color5" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateColor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplateColor_chipColor_key" ON "TemplateColor"("chipColor");

-- CreateIndex
CREATE INDEX "Template_shopifyProductId_idx" ON "Template"("shopifyProductId");

-- CreateIndex
CREATE INDEX "Template_masterTemplateId_idx" ON "Template"("masterTemplateId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_productLayoutId_fkey" FOREIGN KEY ("productLayoutId") REFERENCES "ProductLayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
