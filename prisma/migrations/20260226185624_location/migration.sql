-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "accessSyria" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "accessTurkey" BOOLEAN NOT NULL DEFAULT false;
