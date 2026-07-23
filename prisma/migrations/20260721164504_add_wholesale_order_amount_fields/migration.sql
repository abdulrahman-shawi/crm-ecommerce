-- Add mixed payment fields to wholesale orders
ALTER TABLE "wholesale_orders" ADD COLUMN "amount" TEXT;
ALTER TABLE "wholesale_orders" ADD COLUMN "amountBank" TEXT;
