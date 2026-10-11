-- Tracks when a customer requote request is applied to survey inventory and CBM pricing.
SET XACT_ABORT ON; BEGIN TRANSACTION;
ALTER TABLE [dbo].[QuotationRequoteRequests] ADD [AppliedAtUtc] DATETIMEOFFSET NULL;
COMMIT TRANSACTION;
