import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LotStatus, WalletTransactionType } from '@prisma/client';
import { BidsGateway } from '../bids/bids.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementService } from './settlement.service';

describe('SettlementService', () => {
  let service: SettlementService;
  let prismaMock: {
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
    lot: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    wallet: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    walletTransaction: {
      create: jest.Mock;
    };
    receipt: {
      create: jest.Mock;
    };
  };
  let gatewayMock: {
    broadcastLotSettled: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(prismaMock)),
      $executeRaw: jest.fn().mockResolvedValue(1),
      lot: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      walletTransaction: {
        create: jest.fn(),
      },
      receipt: {
        create: jest.fn(),
      },
    };

    gatewayMock = {
      broadcastLotSettled: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: BidsGateway, useValue: gatewayMock },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('deve lancar NotFoundException se o lote nao for encontrado', async () => {
    prismaMock.lot.findUnique.mockResolvedValue(null);

    await expect(service.settleLot('non-existent')).rejects.toThrow(NotFoundException);
  });

  it('deve lancar BadRequestException se o lote estiver cancelado', async () => {
    prismaMock.lot.findUnique.mockResolvedValue({
      id: 'lot-1',
      status: LotStatus.CANCELLED,
      receipt: null,
    });

    await expect(service.settleLot('lot-1')).rejects.toThrow(BadRequestException);
  });

  it('deve lancar BadRequestException se o lote estiver agendado (SCHEDULED)', async () => {
    prismaMock.lot.findUnique.mockResolvedValue({
      id: 'lot-sched',
      status: LotStatus.SCHEDULED,
      auctioneerId: 'auc-1',
      receipt: null,
    });

    await expect(service.settleLot('lot-sched', 'auc-1')).rejects.toThrow(BadRequestException);
  });

  it('deve lancar ForbiddenException se outro leiloeiro tentar liquidar o lote', async () => {
    prismaMock.lot.findUnique.mockResolvedValue({
      id: 'lot-1',
      status: LotStatus.ACTIVE,
      auctioneerId: 'owner-auc',
      receipt: null,
    });

    await expect(service.settleLot('lot-1', 'invader-auc')).rejects.toThrow(ForbiddenException);
  });

  it('deve retornar idempotente se o lote ja possuir comprovante', async () => {
    prismaMock.lot.findUnique.mockResolvedValue({
      id: 'lot-1',
      status: LotStatus.FINISHED,
      receipt: {
        id: 'rec-1',
        receiptNumber: 'REC-2026-AAA111',
        finalPriceCents: 50000n,
        winnerId: 'winner-1',
      },
    });

    const result = await service.settleLot('lot-1');

    expect(result.settled).toBe(true);
    expect(result.hadWinner).toBe(true);
    expect(result.receiptId).toBe('rec-1');
    expect(result.receiptNumber).toBe('REC-2026-AAA111');
    expect(gatewayMock.broadcastLotSettled).not.toHaveBeenCalled();
  });

  it('deve encerrar lote sem lances sem debitar carteiras nem criar comprovante', async () => {
    prismaMock.lot.findUnique.mockResolvedValue({
      id: 'lot-empty',
      status: LotStatus.ACTIVE,
      winningBidderId: null,
      receipt: null,
    });

    const result = await service.settleLot('lot-empty');

    expect(result.settled).toBe(true);
    expect(result.hadWinner).toBe(false);
    expect(prismaMock.lot.update).toHaveBeenCalledWith({
      where: { id: 'lot-empty' },
      data: { status: LotStatus.FINISHED },
    });
    expect(gatewayMock.broadcastLotSettled).toHaveBeenCalledWith(
      'lot-empty',
      expect.objectContaining({
        lotId: 'lot-empty',
        status: 'FINISHED',
        hadWinner: false,
      }),
    );
  });

  it('deve liquidar com sucesso lote com vencedor: debita vencedor, credita leiloeiro e emite comprovante', async () => {
    prismaMock.receipt.create.mockResolvedValue({
      id: 'receipt-uuid',
      winnerId: 'winner-uuid',
      receiptNumber: 'REC-2026-XYZ999',
      finalPriceCents: 150000n,
      settledAt: new Date('2026-10-27T22:00:00Z'),
    });

    prismaMock.lot.findUnique.mockResolvedValue({
      id: 'lot-success',
      title: 'Obra Prima',
      description: 'Descricao',
      imageUrl: 'https://exemplo.com/obra.jpg',
      externalItemId: 'cma-123',
      itemAttributes: { artist: 'Van Gogh' },
      status: LotStatus.ACTIVE,
      winningBidderId: 'winner-uuid',
      auctioneerId: 'auctioneer-uuid',
      currentPriceCents: 150000n,
      receipt: null,
    });

    prismaMock.wallet.findUnique.mockImplementation(({ where }: { where: { userId: string } }) => {
      if (where.userId === 'winner-uuid') {
        return Promise.resolve({
          id: 'wallet-winner',
          userId: 'winner-uuid',
          balanceCents: 500000n,
        });
      }
      if (where.userId === 'auctioneer-uuid') {
        return Promise.resolve({
          id: 'wallet-auctioneer',
          userId: 'auctioneer-uuid',
          balanceCents: 10000n,
        });
      }
      return Promise.resolve(null);
    });

    const result = await service.settleLot('lot-success');

    expect(result.settled).toBe(true);
    expect(result.hadWinner).toBe(true);
    expect(result.receiptId).toBe('receipt-uuid');
    expect(result.receiptNumber).toBe('REC-2026-XYZ999');
    expect(result.finalPriceCents).toBe(150000);

    // Verifica debito no vencedor (500000 - 150000 = 350000)
    expect(prismaMock.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          walletId: 'wallet-winner',
          type: WalletTransactionType.SETTLEMENT_DEBIT,
          amountCents: -150000n,
          balanceAfterCents: 350000n,
        }),
      }),
    );

    // Verifica credito no leiloeiro (10000 + 150000 = 160000)
    expect(prismaMock.walletTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          walletId: 'wallet-auctioneer',
          type: WalletTransactionType.SETTLEMENT_CREDIT,
          amountCents: 150000n,
          balanceAfterCents: 160000n,
        }),
      }),
    );

    // Verifica criacao do comprovante
    expect(prismaMock.receipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lotId: 'lot-success',
          winnerId: 'winner-uuid',
          auctioneerId: 'auctioneer-uuid',
          finalPriceCents: 150000n,
        }),
      }),
    );

    // Verifica atualizacao do lote para FINISHED
    expect(prismaMock.lot.update).toHaveBeenCalledWith({
      where: { id: 'lot-success' },
      data: { status: LotStatus.FINISHED },
    });

    // Verifica emissao via gateway
    expect(gatewayMock.broadcastLotSettled).toHaveBeenCalledWith(
      'lot-success',
      expect.objectContaining({
        lotId: 'lot-success',
        status: 'FINISHED',
        hadWinner: true,
        winnerId: 'winner-uuid',
        finalPriceCents: 150000,
        receiptId: 'receipt-uuid',
      }),
    );
  });
});
