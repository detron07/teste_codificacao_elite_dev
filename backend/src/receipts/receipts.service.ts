import { Injectable, NotFoundException } from '@nestjs/common';
import { LotStatus } from '@prisma/client';
import { getBidderPseudonym } from '../bids/bids.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActiveBidSummary,
  BidderParticipationsView,
  LostLotSummary,
  PublicReceiptView,
  WonLotSummary,
} from './receipts.types';
import { computeReceiptVerificationHash } from './settlement.service';

function formatCurrency(cents: number | bigint): string {
  return (Number(cents) / 100).toFixed(2).replace('.', ',');
}

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna os detalhes publicos de um comprovante de arremate a partir do ID do comprovante.
   * Valida em tempo real o hash criptografico de autenticidade.
   */
  async getReceiptById(receiptId: string): Promise<PublicReceiptView> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        auctioneer: {
          select: { name: true },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException(`Comprovante com ID ${receiptId} nao encontrado`);
    }

    const expectedHash = computeReceiptVerificationHash(
      receipt.receiptNumber,
      receipt.lotId,
      receipt.winnerId,
      receipt.auctioneerId,
      receipt.finalPriceCents,
      receipt.settledAt,
    );

    const isAuthentic = expectedHash === receipt.verificationHash;
    const itemSnapshot = receipt.itemSnapshot as {
      title: string;
      description: string | null;
      imageUrl: string;
      externalItemId: string;
      itemAttributes: Record<string, unknown>;
    };

    return {
      id: receipt.id,
      lotId: receipt.lotId,
      receiptNumber: receipt.receiptNumber,
      verificationHash: receipt.verificationHash,
      isAuthentic,
      settledAt: receipt.settledAt.toISOString(),
      finalPriceCents: Number(receipt.finalPriceCents),
      finalPriceFormatted: `R$ ${formatCurrency(receipt.finalPriceCents)}`,
      winnerPseudonym: getBidderPseudonym(receipt.winnerId, receipt.lotId),
      auctioneerName: receipt.auctioneer.name,
      item: itemSnapshot,
      shareableUrl: `/comprovante/${receipt.id}`,
    };
  }

  /**
   * Retorna o comprovante emitido para um lote especifico.
   */
  async getReceiptByLotId(lotId: string): Promise<PublicReceiptView> {
    const receipt = await this.prisma.receipt.findUnique({
      where: { lotId },
    });

    if (!receipt) {
      throw new NotFoundException(`Nenhum comprovante emitido ainda para o lote ${lotId}`);
    }

    return this.getReceiptById(receipt.id);
  }

  /**
   * Retorna as participacoes e arremates do licitante logado:
   * 1. Lotes vencidos com comprovante
   * 2. Lances ativos ao vivo
   * 3. Lotes finalizados em que o usuario foi superado
   */
  async getMyBids(bidderId: string): Promise<BidderParticipationsView> {
    const now = new Date();

    // 1. Lotes vencidos pelo licitante
    const wonLots = await this.prisma.lot.findMany({
      where: {
        winningBidderId: bidderId,
        status: LotStatus.FINISHED,
        receipt: { isNot: null },
      },
      include: {
        receipt: true,
      },
      orderBy: { endsAt: 'desc' },
    });

    const won: WonLotSummary[] = wonLots
      .filter((lot) => lot.receipt !== null)
      .map((lot) => ({
        lotId: lot.id,
        title: lot.title,
        imageUrl: lot.imageUrl,
        receiptId: lot.receipt!.id,
        receiptNumber: lot.receipt!.receiptNumber,
        finalPriceCents: Number(lot.receipt!.finalPriceCents),
        settledAt: lot.receipt!.settledAt.toISOString(),
      }));

    // 2. Lotes ativos em que o licitante deu pelo menos um lance
    const activeLots = await this.prisma.lot.findMany({
      where: {
        status: LotStatus.ACTIVE,
        endsAt: { gt: now },
        bids: {
          some: { bidderId },
        },
      },
      include: {
        bids: {
          where: { bidderId },
          orderBy: { amountCents: 'desc' },
          take: 1,
        },
      },
      orderBy: { endsAt: 'asc' },
    });

    const active: ActiveBidSummary[] = activeLots.map((lot) => {
      const myHighestBid = lot.bids[0]?.amountCents ?? 0n;
      const isLeading = lot.winningBidderId === bidderId;
      const timeRemainingSeconds = Math.max(
        0,
        Math.floor((lot.endsAt.getTime() - now.getTime()) / 1000),
      );

      return {
        lotId: lot.id,
        title: lot.title,
        imageUrl: lot.imageUrl,
        currentPriceCents: Number(lot.currentPriceCents),
        myHighestBidCents: Number(myHighestBid),
        isLeading,
        endsAt: lot.endsAt.toISOString(),
        timeRemainingSeconds,
      };
    });

    // 3. Lotes finalizados em que o licitante deu lances mas perdeu
    const lostLots = await this.prisma.lot.findMany({
      where: {
        status: LotStatus.FINISHED,
        winningBidderId: { not: bidderId },
        bids: {
          some: { bidderId },
        },
      },
      include: {
        bids: {
          where: { bidderId },
          orderBy: { amountCents: 'desc' },
          take: 1,
        },
      },
      orderBy: { endsAt: 'desc' },
      take: 20,
    });

    const lost: LostLotSummary[] = lostLots.map((lot) => {
      const myHighestBid = lot.bids[0]?.amountCents ?? 0n;
      const winningPseudonym = lot.winningBidderId
        ? getBidderPseudonym(lot.winningBidderId, lot.id)
        : null;

      return {
        lotId: lot.id,
        title: lot.title,
        imageUrl: lot.imageUrl,
        finalPriceCents: Number(lot.currentPriceCents),
        myHighestBidCents: Number(myHighestBid),
        winningPseudonym,
        endedAt: lot.endsAt.toISOString(),
      };
    });

    return { won, active, lost };
  }
}
