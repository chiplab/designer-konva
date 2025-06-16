-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDesign" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customerId" TEXT,
    "email" TEXT,
    "templateId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "canvasState" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "orderId" TEXT,
    "orderLineItemId" TEXT,
    "shareToken" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerDesign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_shop_status_idx" ON "Job"("shop", "status");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDesign_shareToken_key" ON "CustomerDesign"("shareToken");

-- CreateIndex
CREATE INDEX "CustomerDesign_shop_customerId_idx" ON "CustomerDesign"("shop", "customerId");

-- CreateIndex
CREATE INDEX "CustomerDesign_shop_email_idx" ON "CustomerDesign"("shop", "email");

-- CreateIndex
CREATE INDEX "CustomerDesign_shareToken_idx" ON "CustomerDesign"("shareToken");

-- CreateIndex
CREATE INDEX "CustomerDesign_status_idx" ON "CustomerDesign"("status");

-- CreateIndex
CREATE INDEX "CustomerDesign_expiresAt_idx" ON "CustomerDesign"("expiresAt");

-- AddForeignKey
ALTER TABLE "CustomerDesign" ADD CONSTRAINT "CustomerDesign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
