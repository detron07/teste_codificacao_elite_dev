import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Lot, LotStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LotsService } from './lots.service';

type LotWithCount = Lot & { _count: { bids: number } };

function buildLot(overrides: Partial<LotWithCount> = {}): LotWithCount {
  const now = new Date();
  const startsAt = new Date(now.getTime() - 1000 * 60 * 10);
  const endsAt = new Date(now.getTime() + 1000 * 60 * 50);

  return {
    id: '11111111-1111-1111-1111-111111111111',
    auctioneerId: '22222222-2222-2222-2222-222222222222',
    winningBidderId: null,
    title: 'Water Lilies',
    description: 'Claude Monet masterpiece',
    externalItemId: 'cma-146142',
    imageUrl: 'https://openaccess-cdn.clevelandart.org/1960.81/1960.81_web.jpg',
    itemAttributes: { artist: 'Claude Monet' },
    startPriceCents: BigInt(10_000_00),
    minIncrementCents: BigInt(500_00),
    currentPriceCents: BigInt(10_000_00),
    startsAt,
    endsAt,
    originalEndsAt: endsAt,
    status: LotStatus.ACTIVE,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    _count: { bids: 0 },
    ...overrides,
  };
}

describe('LotsService', () => {
  let prisma: {
    lot: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let gateway: {
    broadcastLotCancelled: jest.Mock;
  };
  let service: LotsService;

  beforeEach(() => {
    prisma = {
      lot: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    gateway = {
      broadcastLotCancelled: jest.fn(),
    };
    service = new LotsService(
      prisma as unknown as PrismaService,
      gateway as unknown as import('../bids/bids.gateway').BidsGateway,
    );
  });

  describe('create', () => {
    it('cria lote com snapshot e precos em centavos', async () => {
      const now = new Date();
      const startsAt = new Date(now.getTime() + 1000 * 60);
      const endsAt = new Date(now.getTime() + 1000 * 60 * 60);

      const created = buildLot({
        startsAt,
        endsAt,
        status: LotStatus.SCHEDULED,
      });

      prisma.lot.create.mockResolvedValue(created);

      const result = await service.create('22222222-2222-2222-2222-222222222222', {
        title: 'Water Lilies',
        externalItemId: 'cma-146142',
        imageUrl: 'https://openaccess-cdn.clevelandart.org/1960.81/1960.81_web.jpg',
        itemAttributes: { artist: 'Claude Monet' },
        startPriceCents: 10_000_00,
        minIncrementCents: 500_00,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });

      expect(result.startPriceCents).toBe(10_000_00);
      expect(result.minIncrementCents).toBe(500_00);
      expect(result.status).toBe(LotStatus.SCHEDULED);
    });

    it('rejeita lote cuja data de término seja anterior ou igual à data de início', async () => {
      const now = new Date();
      const startsAt = new Date(now.getTime() + 1000 * 60 * 30);
      const endsAt = new Date(now.getTime() + 1000 * 60 * 10);

      await expect(
        service.create('22222222-2222-2222-2222-222222222222', {
          title: 'Obra Invalida',
          externalItemId: 'cma-999',
          imageUrl: 'https://example.com/art.jpg',
          itemAttributes: {},
          startPriceCents: 5000,
          minIncrementCents: 500,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('permite cancelar um lote que ainda nao recebeu lances', async () => {
      const lot = buildLot({ _count: { bids: 0 } });
      prisma.lot.findUnique.mockResolvedValue(lot);
      prisma.lot.update.mockResolvedValue({
        ...lot,
        status: LotStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: 'Desistencia do leiloeiro',
      });

      const result = await service.cancel(lot.id, lot.auctioneerId, {
        reason: 'Desistencia do leiloeiro',
      });

      expect(result.status).toBe(LotStatus.CANCELLED);
      expect(prisma.lot.update).toHaveBeenCalled();
    });

    it('bloqueia cancelamento de lote que ja recebeu lances', async () => {
      const lot = buildLot({ _count: { bids: 3 } });
      prisma.lot.findUnique.mockResolvedValue(lot);

      await expect(service.cancel(lot.id, lot.auctioneerId)).rejects.toThrow(
        new BadRequestException('Não é possível cancelar um lote que já recebeu lances'),
      );
    });

    it('bloqueia cancelamento por leiloeiro que nao e o dono do lote', async () => {
      const lot = buildLot({ auctioneerId: 'outro-leiloeiro', _count: { bids: 0 } });
      prisma.lot.findUnique.mockResolvedValue(lot);

      await expect(service.cancel(lot.id, 'leiloeiro-invasor')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('retorna NotFoundException quando o lote nao existe', async () => {
      prisma.lot.findUnique.mockResolvedValue(null);

      await expect(service.cancel('inexistente', 'leiloeiro')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getShowcase', () => {
    it('separa lotes ao vivo, agendados e encerrados e ignora cancelados', async () => {
      const now = new Date();

      const liveLot = buildLot({
        id: 'live-1',
        startsAt: new Date(now.getTime() - 60000),
        endsAt: new Date(now.getTime() + 60000),
      });

      const scheduledLot = buildLot({
        id: 'sched-1',
        startsAt: new Date(now.getTime() + 60000),
        endsAt: new Date(now.getTime() + 120000),
      });

      const finishedLot = buildLot({
        id: 'fin-1',
        startsAt: new Date(now.getTime() - 120000),
        endsAt: new Date(now.getTime() - 60000),
      });

      prisma.lot.findMany.mockResolvedValue([liveLot, scheduledLot, finishedLot]);

      const showcase = await service.getShowcase();

      expect(showcase.live.map((l) => l.id)).toEqual(['live-1']);
      expect(showcase.scheduled.map((l) => l.id)).toEqual(['sched-1']);
      expect(showcase.finished.map((l) => l.id)).toEqual(['fin-1']);
    });
  });
});
