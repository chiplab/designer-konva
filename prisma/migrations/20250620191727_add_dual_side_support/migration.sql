-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "backCanvasData" TEXT,
ADD COLUMN     "frontCanvasData" TEXT;

-- AlterTable
ALTER TABLE "session" RENAME CONSTRAINT "Session_pkey" TO "session_pkey";
