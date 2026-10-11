-- Tracks when a customer requote request is applied to survey inventory and CBM pricing.
BEGIN;
ALTER TABLE "QuotationRequoteRequests" ADD COLUMN "AppliedAtUtc" TIMESTAMPTZ;
COMMIT;
