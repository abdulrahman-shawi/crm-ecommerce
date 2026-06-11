-- تصحيح drift: العمود موجود في قاعدة البيانات لكن غير موجود في تاريخ الميجريشنز.
-- استخدام IF NOT EXISTS لضمان عدم الفشل إذا كان العمود موجوداً بالفعل.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "affiliateCommissionRate" DOUBLE PRECISION DEFAULT 10.00;
