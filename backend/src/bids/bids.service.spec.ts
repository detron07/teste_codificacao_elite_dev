import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LotStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BidsGateway } from './bids.gateway';
import { BidsService } from './bids.service';

describe('BidsService', () => {
  let prisma: {
    lot: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    wallet: {
      findUnique: jest.Mock;
    };
    bid: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let gateway: {
    broadcastNewBid: jest.Mock;
    broadcastLotUpdated: jest.Mock;
  };
  let service: BidsService;

  beforeEach(() => {
    prisma = {
      lot: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
      },
      bid: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    gateway = {
      broadcastNewBid: jest.fn(),
      broadcastLotUpdated: jest.fn(),
    };

    service = new BidsService(
      prisma as unknown as PrismaService,
      gateway as unknown as BidsGateway,
    );
  });

  const now = new Date();
  const activeLot = {
    id: 'lot-1',
    auctioneerId: 'auctioneer-1',
    winningBidderId: 'other-bidder',
    title: 'Monet Painting',
    startPriceCents: BigInt(5_000_00),
    minIncrementCents: BigInt(500_00),
    currentPriceCents: BigInt(6_000_00),
    startsAt: new Date(now.getTime() - 60000),
    endsAt: new Date(now.getTime() + 600000), // 10 min restantes
    originalEndsAt: new Date(now.getTime() + 600000),
    status: LotStatus.ACTIVE,
    _count: { bids: 2 },
  };

  const richWallet = {
    id: 'wallet-1',
    userId: 'bidder-1',
    balanceCents: BigInt(100_000_00),
  };

  it('rejeita lance se o lote nao for encontrado', async () => {
    prisma.lot.findUnique.mockResolvedValue(null);

    await expect(
      service.placeBid('bidder-1', 'lot-inexistente', { amountCents: 7_000_00 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita lance se o leiloeiro tentar dar lance no proprio lote', async () => {
    prisma.lot.findUnique.mockResolvedValue({
      ...activeLot,
      auctioneerId: 'bidder-1',
    });

    await expect(
      service.placeBid('bidder-1', 'lot-1', { amountCents: 7_000_00 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejeita lance se o licitante ja for o lider do lote', async () => {
    prisma.lot.findUnique.mockResolvedValue({
      ...activeLot,
      winningBidderId: 'bidder-1',
    });

    await expect(service.placeBid('bidder-1', 'lot-1', { amountCents: 7_000_00 })).rejects.toThrow(
      new BadRequestException('Você já é o licitante líder deste lote'),
    );
  });

  it('rejeita lance abaixo do incremento minimo', async () => {
    prisma.lot.findUnique.mockResolvedValue(activeLot);

    // atual: 6.000, incremento: 500 -> min: 6.500. Lance: 6.200 (rejeitado)
    await expect(
      service.placeBid('bidder-1', 'lot-1', { amountCents: 6_200_00 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita lance se o saldo disponivel for insuficiente (considerando outros lotes liderados)', async () => {
    prisma.lot.findUnique.mockResolvedValue(activeLot);
    prisma.wallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      userId: 'bidder-1',
      balanceCents: BigInt(10_000_00), // Saldo total R$ 10.000,00
    });

    // Ja lidera outro lote com lance de R$ 6.000,00 -> Disponivel: R$ 4.000,00
    prisma.lot.findMany.mockResolvedValue([{ currentPriceCents: BigInt(6_000_00) }]);

    // Tenta lance de R$ 7.000,00 (> R$ 4.000,00 disponivel)
    await expect(service.placeBid('bidder-1', 'lot-1', { amountCents: 7_000_00 })).rejects.toThrow(
      /Saldo disponível insuficiente/,
    );
  });

  it('estende o fim do lote em +2 minutos se o lance ocorrer nos ultimos 2 minutos (anti-sniping)', async () => {
    const lotNearEnd = {
      ...activeLot,
      endsAt: new Date(Date.now() + 60_000), // falta 1 minuto
    };

    prisma.lot.findUnique.mockResolvedValue(lotNearEnd);
    prisma.wallet.findUnique.mockResolvedValue(richWallet);
    prisma.lot.findMany.mockResolvedValue([]); // sem outros lotes liderados
    prisma.bid.findFirst.mockResolvedValue({
      id: 'prev-bid-1',
      hash: 'hash-anterior-1234',
    });

    prisma.bid.create.mockResolvedValue({
      id: 'new-bid-1',
      lotId: 'lot-1',
      bidderId: 'bidder-1',
      amountCents: BigInt(7_000_00),
      createdAt: new Date(),
      hash: 'novo-hash',
    });

    prisma.lot.update.mockImplementation(({ data }: { data: { endsAt: Date } }) => ({
      ...lotNearEnd,
      currentPriceCents: BigInt(7_000_00),
      winningBidderId: 'bidder-1',
      endsAt: data.endsAt,
      _count: { bids: 3 },
    }));

    const result = await service.placeBid('bidder-1', 'lot-1', { amountCents: 7_000_00 });

    expect(result.wasExtended).toBe(true);
    // newEndsAt deve ser aproximadamente Date.now() + 120_000 ms
    const diffMs = new Date(result.endsAt).getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(110_000);
    expect(diffMs).toBeLessThanOrEqual(125_000);
    expect(gateway.broadcastNewBid).toHaveBeenCalled();
  });

  it('aceita lance valido e propaga notificacoes via WebSocket', async () => {
    prisma.lot.findUnique.mockResolvedValue(activeLot);
    prisma.wallet.findUnique.mockResolvedValue(richWallet);
    prisma.lot.findMany.mockResolvedValue([]);
    prisma.bid.findFirst.mockResolvedValue(null); // primeiro lance

    prisma.bid.create.mockResolvedValue({
      id: 'bid-1',
      lotId: 'lot-1',
      bidderId: 'bidder-1',
      amountCents: BigInt(6_500_00),
      createdAt: new Date(),
      hash: 'hash-genesis-123',
    });

    prisma.lot.update.mockResolvedValue({
      ...activeLot,
      currentPriceCents: BigInt(6_500_00),
      winningBidderId: 'bidder-1',
      _count: { bids: 3 },
    });

    const result = await service.placeBid('bidder-1', 'lot-1', { amountCents: 6_500_00 });

    expect(result.currentPriceCents).toBe(6_500_00);
    expect(result.isWinning).toBe(true);
    expect(gateway.broadcastNewBid).toHaveBeenCalledWith(
      'lot-1',
      expect.objectContaining({
        leaderId: 'bidder-1',
        currentPriceCents: 6_500_00,
      }),
    );
    expect(gateway.broadcastLotUpdated).toHaveBeenCalled();
  });
});
