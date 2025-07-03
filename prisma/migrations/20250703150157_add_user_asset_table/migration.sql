-- CreateTable
CREATE TABLE "UserAsset" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filesize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "mimetype" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAsset_shop_customerId_idx" ON "UserAsset"("shop", "customerId");

-- CreateIndex
CREATE INDEX "UserAsset_shop_sessionId_idx" ON "UserAsset"("shop", "sessionId");

-- CreateIndex
CREATE INDEX "UserAsset_createdAt_idx" ON "UserAsset"("createdAt");
