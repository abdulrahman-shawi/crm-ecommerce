-- CreateTable
CREATE TABLE "TrakingCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrakingCompany_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrakingCompany_name_key" ON "TrakingCompany"("name");
