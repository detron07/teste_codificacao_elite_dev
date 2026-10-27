-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "lots" (
    "id" UUID NOT NULL,
    "auctioneer_id" UUID NOT NULL,
    "winning_bidder_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "external_item_id" VARCHAR(100) NOT NULL,
    "image_url" TEXT NOT NULL,
    "item_attributes" JSONB NOT NULL,
    "start_price_cents" BIGINT NOT NULL,
    "min_increment_cents" BIGINT NOT NULL,
    "current_price_cents" BIGINT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "original_ends_at" TIMESTAMP(3) NOT NULL,
    "status" "LotStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "bidder_id" UUID NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "previous_bid_id" UUID,
    "previous_hash" VARCHAR(64),
    "hash" VARCHAR(64) NOT NULL,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lots_status_starts_at_ends_at_idx" ON "lots"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "lots_auctioneer_id_idx" ON "lots"("auctioneer_id");

-- CreateIndex
CREATE INDEX "bids_lot_id_amount_cents_idx" ON "bids"("lot_id", "amount_cents" DESC);

-- CreateIndex
CREATE INDEX "bids_lot_id_created_at_idx" ON "bids"("lot_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "bids_bidder_id_idx" ON "bids"("bidder_id");

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_auctioneer_id_fkey" FOREIGN KEY ("auctioneer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_winning_bidder_id_fkey" FOREIGN KEY ("winning_bidder_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defesa em profundidade: restricoes de integridade financeira e temporal
ALTER TABLE "lots" ADD CONSTRAINT "lots_start_price_non_negative" CHECK ("start_price_cents" >= 0);
ALTER TABLE "lots" ADD CONSTRAINT "lots_min_increment_positive" CHECK ("min_increment_cents" > 0);
ALTER TABLE "lots" ADD CONSTRAINT "lots_current_price_gte_start" CHECK ("current_price_cents" >= "start_price_cents");
ALTER TABLE "lots" ADD CONSTRAINT "lots_ends_at_after_starts_at" CHECK ("ends_at" > "starts_at");
ALTER TABLE "bids" ADD CONSTRAINT "bids_amount_positive" CHECK ("amount_cents" > 0);

