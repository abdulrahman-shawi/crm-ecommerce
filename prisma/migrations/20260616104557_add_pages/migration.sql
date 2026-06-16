-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "addPages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletePages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "editPages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewPages" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");
