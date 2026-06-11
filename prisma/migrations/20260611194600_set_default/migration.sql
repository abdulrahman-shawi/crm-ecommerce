-- تعيين قيمة افتراضية للعمود لتطابق schema.prisma
ALTER TABLE "Product" ALTER COLUMN "affiliateCommissionRate" SET DEFAULT 10.00;
