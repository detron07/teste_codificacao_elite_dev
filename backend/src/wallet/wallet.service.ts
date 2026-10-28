import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LotStatus, Prisma, WalletTransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletSummary } from './wallet.types';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtem o resumo consolidado da carteira do licitante:
   * - Saldo total
   * - Saldo comprometido (lotes ativos em que ele e lider)
   * - Saldo disponivel = total - comprometido
   * - Ultimas movimentacoes
   */
  async getSummary(userId: string): Promise<WalletSummary> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada para este usuário');
    }

    const now = new Date();

    // Busca os lotes ativos em que o usuario lidera atualmente
    // Fundos permanecem comprometidos enquanto o lote estiver ACTIVE (ate que a liquidacao debite a carteira)
    const activeLeads = await this.prisma.lot.findMany({
      where: {
        winningBidderId: userId,
        status: LotStatus.ACTIVE,
      },
      select: {
        id: true,
        currentPriceCents: true,
      },
    });

    const committedBigInt = activeLeads.reduce(
      (acc, lot) => acc + lot.currentPriceCents,
      BigInt(0),
    );

    const totalCents = Number(wallet.balanceCents);
    const committedCents = Number(committedBigInt);
    const availableCents = Math.max(0, totalCents - committedCents);

    const mappedTransactions = wallet.transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amountCents: Number(tx.amountCents),
      balanceAfterCents: Number(tx.balanceAfterCents),
      description: tx.description,
      createdAt: tx.createdAt.toISOString(),
    }));

    return {
      totalBalanceCents: totalCents,
      committedBalanceCents: committedCents,
      availableBalanceCents: availableCents,
      activeLeadsCount: activeLeads.length,
      recentTransactions: mappedTransactions,
      transactions: mappedTransactions,
    };
  }

  /**
   * Realiza um deposito simulado na carteira do licitante.
   * Toda movimentacao e registrada no livro-razao (wallet_transactions).
   */
  async deposit(userId: string, amountCents: number): Promise<WalletSummary> {
    if (amountCents <= 0) {
      throw new BadRequestException('O valor do depósito deve ser positivo');
    }

    await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Carteira não encontrada');
      }

      const newBalance = wallet.balanceCents + BigInt(amountCents);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: newBalance },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.DEPOSIT,
          amountCents: BigInt(amountCents),
          balanceAfterCents: newBalance,
          description: 'Depósito simulado na carteira',
        },
      });
    });

    return this.getSummary(userId);
  }

  /**
   * Calcula o saldo comprometido do licitante, opcionalmente desconsiderando um lote
   * (usado quando o usuario ja lidera o lote em que esta dando um novo lance, embora a regra
   * de negocio impeca cobrir o proprio lance, a funcao e generica e segura).
   */
  async getCommittedBalance(
    userId: string,
    excludeLotId?: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<bigint> {
    const lots = await tx.lot.findMany({
      where: {
        winningBidderId: userId,
        status: LotStatus.ACTIVE,
        id: excludeLotId ? { not: excludeLotId } : undefined,
      },
      select: { currentPriceCents: true },
    });

    return lots.reduce((acc, lot) => acc + lot.currentPriceCents, BigInt(0));
  }
}
