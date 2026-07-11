-- CreateTable
CREATE TABLE "ad_page_visits" (
    "id" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "path" TEXT,
    "referrer" TEXT,
    "user_agent" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device_type" TEXT,
    "locale" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_page_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_page_visits_product_id_idx" ON "ad_page_visits"("product_id");

-- CreateIndex
CREATE INDEX "ad_page_visits_visitor_id_idx" ON "ad_page_visits"("visitor_id");

-- CreateIndex
CREATE INDEX "ad_page_visits_created_at_idx" ON "ad_page_visits"("created_at");

-- CreateIndex
CREATE INDEX "ad_page_visits_product_id_created_at_idx" ON "ad_page_visits"("product_id", "created_at");

-- AddForeignKey
ALTER TABLE "ad_page_visits" ADD CONSTRAINT "ad_page_visits_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
