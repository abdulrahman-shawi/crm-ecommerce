-- CreateEnum
CREATE TYPE "WalletTransferStatus" AS ENUM ('PENDING', 'RECEIVED');

-- CreateTable
CREATE TABLE "affiliate_wallet_transfers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "WalletTransferStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "notes" TEXT,
    "transferred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_wallet_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affiliate_wallet_transfers_user_id_idx" ON "affiliate_wallet_transfers"("user_id");

-- CreateIndex
CREATE INDEX "affiliate_wallet_transfers_status_idx" ON "affiliate_wallet_transfers"("status");

-- CreateIndex
CREATE INDEX "affiliate_wallet_transfers_transferred_at_idx" ON "affiliate_wallet_transfers"("transferred_at");

-- AddForeignKey
ALTER TABLE "affiliate_wallet_transfers" ADD CONSTRAINT "affiliate_wallet_transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
