-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "winner_id" UUID NOT NULL,
    "auctioneer_id" UUID NOT NULL,
    "final_price_cents" BIGINT NOT NULL,
    "receipt_number" VARCHAR(50) NOT NULL,
    "verification_hash" VARCHAR(64) NOT NULL,
    "item_snapshot" JSONB NOT NULL,
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipts_lot_id_key" ON "receipts"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receipt_number_key" ON "receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "receipts_winner_id_idx" ON "receipts"("winner_id");

-- CreateIndex
CREATE INDEX "receipts_auctioneer_id_idx" ON "receipts"("auctioneer_id");

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_auctioneer_id_fkey" FOREIGN KEY ("auctioneer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defesa em profundidade: valor final arrematado deve ser estritamente positivo
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_final_price_positive" CHECK ("final_price_cents" > 0);

