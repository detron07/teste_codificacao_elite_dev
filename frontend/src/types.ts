export type Role = 'AUCTIONEER' | 'BIDDER';
export type LotStatus = 'SCHEDULED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
export type UserAuctionStatus = 'WINNING' | 'OUTBID' | 'NOT_BIDDING' | 'NOT_APPLICABLE';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface WalletView {
  id: string;
  userId: string;
  totalBalanceCents: number;
  committedBalanceCents: number;
  availableBalanceCents: number;
  transactions?: Array<{
    id: string;
    type: 'DEPOSIT' | 'SETTLEMENT_DEBIT' | 'SETTLEMENT_CREDIT';
    amountCents: number;
    balanceAfterCents: number;
    description: string | null;
    createdAt: string;
  }>;
  recentTransactions?: Array<{
    id: string;
    type: 'DEPOSIT' | 'SETTLEMENT_DEBIT' | 'SETTLEMENT_CREDIT';
    amountCents: number;
    balanceAfterCents: number;
    description: string | null;
    createdAt: string;
  }>;
}

export interface ArtworkSearchResult {
  id: string;
  title: string;
  artist: string;
  date: string;
  technique: string;
  dimensions: string;
  imageUrl: string;
  department: string;
  culture: string;
}

export interface LotView {
  id: string;
  auctioneerId: string;
  winningBidderId: string | null;
  title: string;
  description: string | null;
  externalItemId: string;
  imageUrl: string;
  itemAttributes: Record<string, unknown>;
  startPriceCents: number;
  minIncrementCents: number;
  currentPriceCents: number;
  startsAt: string;
  endsAt: string;
  originalEndsAt: string;
  status: LotStatus;
  bidsCount: number;
  timeRemainingSeconds: number | null;
  isLive: boolean;
  isFinished: boolean;
  isScheduled: boolean;
}

export interface ShowcaseResponse {
  live: LotView[];
  scheduled: LotView[];
  finished: LotView[];
}

export interface BidView {
  id: string;
  lotId: string;
  amountCents: number;
  bidderPseudonym: string;
  isMine: boolean;
  createdAt: string;
  hash: string;
}

export interface LiveRoomState {
  lot: LotView;
  bids: BidView[];
  currentLeaderPseudonym: string | null;
  userStatus: UserAuctionStatus;
  timeRemainingSeconds: number;
  minNextBidCents: number;
}

export interface AuditChainNode {
  sequenceIndex: number;
  bidId: string;
  bidderPseudonym: string;
  amountCents: number;
  createdAt: string;
  previousHash: string | null;
  hash: string;
  isValid: boolean;
}

export interface LotAuditResult {
  lotId: string;
  lotTitle: string;
  status: 'INTEGRO' | 'ADULTERADO';
  isTampered: boolean;
  totalBids: number;
  verifiedAt: string;
  genesisHash: string | null;
  headHash: string | null;
  violation: {
    bidId: string;
    sequenceIndex: number;
    reason: string;
    expectedHash?: string;
    actualHash?: string;
  } | null;
  chain: AuditChainNode[];
  techniqueExplanation: string;
}

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

export interface AuctioneerDashboardMetrics {
  totalLots: number;
  activeLots: number;
  scheduledLots: number;
  finishedLots: number;
  totalRevenueCents: number;
  lots: LotView[];
}
