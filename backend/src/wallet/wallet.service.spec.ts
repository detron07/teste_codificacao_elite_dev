import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  let prisma: {
    wallet: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    walletTransaction: {
      create: jest.Mock;
    };
    lot: {
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: WalletService;

  beforeEach(() => {
    prisma = {
      wallet: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
      lot: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    service = new WalletService(prisma as unknown as PrismaService);
  });

  describe('getSummary', () => {
    it('calcula saldo comprometido e disponivel corretamente a partir dos lotes ativos liderados', async () => {
      prisma.wallet.findUnique.mockResolvedValue({
        id: 'w-1',
        userId: 'u-1',
        balanceCents: BigInt(50_000_00), // R$ 50.000,00 total
        transactions: [],
      });

      // Lidera 2 lotes ativos
      prisma.lot.findMany.mockResolvedValue([
        { id: 'lot-1', currentPriceCents: BigInt(15_000_00) },
        { id: 'lot-2', currentPriceCents: BigInt(5_000_00) },
      ]);

      const summary = await service.getSummary('u-1');

      expect(summary.totalBalanceCents).toBe(50_000_00);
      expect(summary.committedBalanceCents).toBe(20_000_00); // 15k + 5k
      expect(summary.availableBalanceCents).toBe(30_000_00); // 50k - 20k
      expect(summary.activeLeadsCount).toBe(2);
    });

    it('lanca NotFoundException quando usuario nao possui carteira', async () => {
      prisma.wallet.findUnique.mockResolvedValue(null);

      await expect(service.getSummary('u-inexistente')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deposit', () => {
    it('credita valor na carteira e cria registro no livro-razao', async () => {
      prisma.wallet.findUnique
        .mockResolvedValueOnce({
          id: 'w-1',
          userId: 'u-1',
          balanceCents: BigInt(10_000_00),
        })
        .mockResolvedValueOnce({
          id: 'w-1',
          userId: 'u-1',
          balanceCents: BigInt(15_000_00),
          transactions: [],
        });

      prisma.lot.findMany.mockResolvedValue([]);

      const summary = await service.deposit('u-1', 5_000_00);

      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { id: 'w-1' },
        data: { balanceCents: BigInt(15_000_00) },
      });
      expect(prisma.walletTransaction.create).toHaveBeenCalled();
      expect(summary.totalBalanceCents).toBe(15_000_00);
    });

    it('rejeita deposito com valor menor ou igual a zero', async () => {
      await expect(service.deposit('u-1', 0)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.deposit('u-1', -100)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
