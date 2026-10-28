import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { LotStatus, WalletTransactionType } from '@prisma/client';
import * as crypto from 'crypto';
import { BidsGateway } from '../bids/bids.gateway';
import { getBidderPseudonym } from '../bids/bids.types';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementResult } from './receipts.types';

const SETTLEMENT_INTERVAL_MS = 5000;

export function computeReceiptVerificationHash(
  receiptNumber: string,
  lotId: string,
  winnerId: string,
  auctioneerId: string,
  finalPriceCents: bigint | number,
  settledAt: Date | string,
): string {
  const dateStr = settledAt instanceof Date ? settledAt.toISOString() : settledAt;
  const rawData = `${receiptNumber}:${lotId}:${winnerId}:${auctioneerId}:${finalPriceCents.toString()}:${dateStr}`;
  return crypto.createHash('sha256').update(rawData).digest('hex');
}

@Injectable()
export class SettlementService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettlementService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: BidsGateway,
  ) {}

  onModuleInit(): void {
    // Escaneia e liquida periodicamente lotes que ultrapassaram a data de encerramento
    this.timer = setInterval(() => {
      void this.settleExpiredLots();
    }, SETTLEMENT_INTERVAL_MS);
    this.logger.log('Agendador de liquidacao automatica iniciado (intervalo: 5s)');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Executa a liquidacao atomica de um lote encerrado:
   * 1. Trava o registro do lote com SELECT ... FOR UPDATE
   * 2. Se houver vencedor: debita carteira do vencedor (SETTLEMENT_DEBIT),
   *    credita carteira do leiloeiro (SETTLEMENT_CREDIT), emite comprovante criptografico (Receipt)
   *    e marca o lote como FINISHED.
   * 3. Se nao houver lances: marca o lote como FINISHED sem vencedor.
   * 4. Transmite evento Socket.IO 'lot:settled' para a sala do lote e vitrine.
   */
  async settleLot(lotId: string): Promise<SettlementResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM lots WHERE id = ${lotId}::uuid FOR UPDATE;`;

      const lot = await tx.lot.findUnique({
        where: { id: lotId },
        include: { receipt: true },
      });

      if (!lot) {
        throw new NotFoundException(`Lote com ID ${lotId} nao encontrado`);
      }

      if (lot.status === LotStatus.CANCELLED) {
        throw new BadRequestException('Lote cancelado nao pode ser liquidado');
      }

      // Se o lote ja possuir comprovante emitido, retorna idempotente
      if (lot.receipt) {
        return {
          lotId: lot.id,
          settled: true,
          hadWinner: true,
          receiptId: lot.receipt.id,
          receiptNumber: lot.receipt.receiptNumber,
          finalPriceCents: Number(lot.receipt.finalPriceCents),
          winnerId: lot.receipt.winnerId,
          alreadySettled: true,
        };
      }

      // Caso 1: Lote sem lances
      if (!lot.winningBidderId) {
        if (lot.status !== LotStatus.FINISHED) {
          await tx.lot.update({
            where: { id: lot.id },
            data: { status: LotStatus.FINISHED },
          });
        }
        return {
          lotId: lot.id,
          settled: true,
          hadWinner: false,
          alreadySettled: false,
        };
      }

      // Caso 2: Lote com vencedor
      const winnerWallet = await tx.wallet.findUnique({
        where: { userId: lot.winningBidderId },
      });

      if (!winnerWallet) {
        throw new BadRequestException('Carteira do vencedor nao encontrada para liquidacao');
      }

      // Debito da carteira do vencedor
      const newWinnerBalance = winnerWallet.balanceCents - lot.currentPriceCents;
      await tx.wallet.update({
        where: { id: winnerWallet.id },
        data: { balanceCents: newWinnerBalance },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: winnerWallet.id,
          type: WalletTransactionType.SETTLEMENT_DEBIT,
          amountCents: -lot.currentPriceCents,
          balanceAfterCents: newWinnerBalance,
          description: `Liquidacao de arremate do lote: ${lot.title}`,
        },
      });

      // Credito da carteira do leiloeiro
      let auctioneerWallet = await tx.wallet.findUnique({
        where: { userId: lot.auctioneerId },
      });

      if (!auctioneerWallet) {
        auctioneerWallet = await tx.wallet.create({
          data: {
            userId: lot.auctioneerId,
            balanceCents: 0n,
          },
        });
      }

      const newAuctioneerBalance = auctioneerWallet.balanceCents + lot.currentPriceCents;
      await tx.wallet.update({
        where: { id: auctioneerWallet.id },
        data: { balanceCents: newAuctioneerBalance },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: auctioneerWallet.id,
          type: WalletTransactionType.SETTLEMENT_CREDIT,
          amountCents: lot.currentPriceCents,
          balanceAfterCents: newAuctioneerBalance,
          description: `Recebimento de arremate do lote: ${lot.title}`,
        },
      });

      // Geracao de numero e hash criptografico do comprovante
      const settledAt = new Date();
      const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const receiptNumber = `REC-${settledAt.getFullYear()}-${randomSuffix}`;
      const verificationHash = computeReceiptVerificationHash(
        receiptNumber,
        lot.id,
        lot.winningBidderId,
        lot.auctioneerId,
        lot.currentPriceCents,
        settledAt,
      );

      const itemSnapshot = {
        title: lot.title,
        description: lot.description,
        imageUrl: lot.imageUrl,
        externalItemId: lot.externalItemId,
        itemAttributes: lot.itemAttributes,
      };

      const receipt = await tx.receipt.create({
        data: {
          lotId: lot.id,
          winnerId: lot.winningBidderId,
          auctioneerId: lot.auctioneerId,
          finalPriceCents: lot.currentPriceCents,
          receiptNumber,
          verificationHash,
          itemSnapshot,
          settledAt,
        },
      });

      await tx.lot.update({
        where: { id: lot.id },
        data: { status: LotStatus.FINISHED },
      });

      return {
        lotId: lot.id,
        settled: true,
        hadWinner: true,
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber,
        finalPriceCents: Number(receipt.finalPriceCents),
        winnerId: lot.winningBidderId,
        settledAt: receipt.settledAt.toISOString(),
        alreadySettled: false,
      };
    });

    // Notifica clientes em tempo real somente se a liquidacao acabou de acontecer
    if (!result.alreadySettled) {
      this.gateway.broadcastLotSettled(lotId, {
        lotId,
        status: 'FINISHED',
        hadWinner: result.hadWinner,
        winnerId: result.winnerId,
        winnerPseudonym: result.winnerId ? getBidderPseudonym(result.winnerId, lotId) : null,
        finalPriceCents: result.finalPriceCents,
        receiptNumber: result.receiptNumber,
        receiptId: result.receiptId,
        settledAt: result.settledAt,
      });
    }

    return result;
  }

  /**
   * Varre e liquida todos os lotes que estao com status ACTIVE mas cujo tempo limite expirou.
   */
  async settleExpiredLots(): Promise<number> {
    const now = new Date();
    const expiredLots = await this.prisma.lot.findMany({
      where: {
        status: LotStatus.ACTIVE,
        endsAt: { lte: now },
      },
      select: { id: true },
    });

    if (expiredLots.length === 0) {
      return 0;
    }

    let settledCount = 0;
    for (const lot of expiredLots) {
      try {
        await this.settleLot(lot.id);
        settledCount++;
      } catch (err) {
        this.logger.error(`Erro ao liquidar lote expirado ${lot.id}: ${String(err)}`);
      }
    }

    return settledCount;
  }
}
