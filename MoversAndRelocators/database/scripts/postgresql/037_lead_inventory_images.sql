-- Optional picture on a sales-lead inventory line (the lead photo or the video frame the AI picked) and where the item is in it. The API also applies this at startup (LeadInventorySchema).
ALTER TABLE "SalesLeadInventoryItems" ADD COLUMN IF NOT EXISTS "ImageKey" varchar(500) NULL;
ALTER TABLE "SalesLeadInventoryItems" ADD COLUMN IF NOT EXISTS "ImageMark" varchar(40) NULL;
