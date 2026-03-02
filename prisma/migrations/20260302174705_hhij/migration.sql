-- CreateTable
CREATE TABLE "GeneralSetting" (
    "id" SERIAL NOT NULL,
    "siteName" TEXT,
    "companyEmail" TEXT,
    "companyPhone" TEXT,
    "siteCurrency" TEXT DEFAULT 'USD',
    "usdToTryRate" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneralSetting_pkey" PRIMARY KEY ("id")
);
