-- Who paid each packing and delivery expense ("Paid by"), used by Accounting report 27, Employee expenses.
-- The API also applies this idempotently at startup (EmployeeExpenseSchema).
IF COL_LENGTH(N'dbo.PackingJobTransactions', N'PaidByEmployeeId') IS NULL ALTER TABLE [dbo].[PackingJobTransactions] ADD [PaidByEmployeeId] UNIQUEIDENTIFIER NULL;
GO
IF COL_LENGTH(N'dbo.DeliveryJobTransactions', N'PaidByEmployeeId') IS NULL ALTER TABLE [dbo].[DeliveryJobTransactions] ADD [PaidByEmployeeId] UNIQUEIDENTIFIER NULL;
GO
