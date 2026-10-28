import { Lot, LotStatus, Prisma } from '@prisma/client';

export interface LotView {
  id: string;
  auctioneerId: string;
  winningBidderId: string | null;
  title: string;
  description: string | null;
  externalItemId: string;
  imageUrl: string;
  itemAttributes: Prisma.JsonValue;
  startPriceCents: number;
  minIncrementCents: number;
  currentPriceCents: number;
  startsAt: string;
  endsAt: string;
  originalEndsAt: string;
  status: LotStatus;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  bidsCount?: number;
  timeRemainingSeconds?: number;
  isLive: boolean;
  isFinished: boolean;
  isScheduled: boolean;
}

export interface ShowcaseResponse {
  live: LotView[];
  scheduled: LotView[];
  finished: LotView[];
}

export interface AuctioneerDashboardMetrics {
  totalLots: number;
  activeLots: number;
  scheduledLots: number;
  finishedLots: number;
  cancelledLots: number;
  totalFinishedWithBids: number;
  totalRevenueCents: number;
  lots: LotView[];
}

/**
 * Calcula o status dinamico do lote baseado no horario atual
 * e serializa campos BigInt para number.
 */
export function toLotView(
  lot: Lot & { _count?: { bids: number } },
  now: Date = new Date(),
): LotView {
  let effectiveStatus = lot.status;

  if (lot.status !== LotStatus.CANCELLED) {
    if (now < lot.startsAt) {
      effectiveStatus = LotStatus.SCHEDULED;
    } else if (now >= lot.startsAt && now < lot.endsAt) {
      effectiveStatus = LotStatus.ACTIVE;
    } else {
      effectiveStatus = LotStatus.FINISHED;
    }
  }

  const timeRemainingSeconds =
    effectiveStatus === LotStatus.ACTIVE
      ? Math.max(0, Math.floor((lot.endsAt.getTime() - now.getTime()) / 1000))
      : 0;

  return {
    id: lot.id,
    auctioneerId: lot.auctioneerId,
    winningBidderId: lot.winningBidderId,
    title: lot.title,
    description: lot.description,
    externalItemId: lot.externalItemId,
    imageUrl: lot.imageUrl,
    itemAttributes: lot.itemAttributes,
    startPriceCents: Number(lot.startPriceCents),
    minIncrementCents: Number(lot.minIncrementCents),
    currentPriceCents: Number(lot.currentPriceCents),
    startsAt: lot.startsAt.toISOString(),
    endsAt: lot.endsAt.toISOString(),
    originalEndsAt: lot.originalEndsAt.toISOString(),
    status: effectiveStatus,
    cancelledAt: lot.cancelledAt?.toISOString() ?? null,
    cancellationReason: lot.cancellationReason,
    createdAt: lot.createdAt.toISOString(),
    bidsCount: lot._count?.bids,
    timeRemainingSeconds,
    isLive: effectiveStatus === LotStatus.ACTIVE,
    isFinished: effectiveStatus === LotStatus.FINISHED,
    isScheduled: effectiveStatus === LotStatus.SCHEDULED,
  };
}
