export interface PublicReceiptView {
  id: string;
  lotId: string;
  receiptNumber: string;
  verificationHash: string;
  isAuthentic: boolean;
  settledAt: string;
  finalPriceCents: number;
  finalPriceFormatted: string;
  winnerPseudonym: string;
  auctioneerName: string;
  item: {
    title: string;
    description: string | null;
    imageUrl: string;
    externalItemId: string;
    itemAttributes: Record<string, unknown>;
  };
  shareableUrl: string;
}

export interface WonLotSummary {
  lotId: string;
  title: string;
  imageUrl: string;
  receiptId: string;
  receiptNumber: string;
  finalPriceCents: number;
  settledAt: string;
}

export interface ActiveBidSummary {
  lotId: string;
  title: string;
  imageUrl: string;
  currentPriceCents: number;
  myHighestBidCents: number;
  isLeading: boolean;
  endsAt: string;
  timeRemainingSeconds: number;
}

export interface LostLotSummary {
  lotId: string;
  title: string;
  imageUrl: string;
  finalPriceCents: number;
  myHighestBidCents: number;
  winningPseudonym: string | null;
  endedAt: string;
}

export interface BidderParticipationsView {
  won: WonLotSummary[];
  active: ActiveBidSummary[];
  lost: LostLotSummary[];
}

export interface SettlementResult {
  lotId: string;
  settled: boolean;
  hadWinner: boolean;
  receiptId?: string;
  receiptNumber?: string;
  finalPriceCents?: number;
  winnerId?: string;
}
