-- Add designableArea column with default value
ALTER TABLE "ProductLayout" ADD COLUMN "designableArea" JSONB NOT NULL DEFAULT '{"shape": "circle", "diameter": 744}'::jsonb;