import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiptsService } from './receipts.service';
import { computeReceiptVerificationHash } from './settlement.service';

describe('ReceiptsService', () => {
  let service: ReceiptsService;
  let prismaMock: {
    receipt: {
      findUnique: jest.Mock;
    };
    lot: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      receipt: {
        findUnique: jest.fn(),
      },
      lot: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReceiptsService>(ReceiptsService);
  });

  it('deve lancar NotFoundException se o comprovante nao for encontrado por ID', async () => {
    prismaMock.receipt.findUnique.mockResolvedValue(null);

    await expect(service.getReceiptById('non-existent')).rejects.toThrow(NotFoundException);
  });

  it('deve retornar comprovante publico autentico e com dados anonimizados', async () => {
    const lotId = 'lot-123';
    const winnerId = 'winner-456';
    const auctioneerId = 'auctioneer-789';
    const receiptNumber = 'REC-2026-ABC123';
    const finalPriceCents = 250000n;
    const settledAt = new Date('2026-10-27T18:00:00Z');

    const validHash = computeReceiptVerificationHash(
      receiptNumber,
      lotId,
      winnerId,
      auctioneerId,
      finalPriceCents,
      settledAt,
    );

    prismaMock.receipt.findUnique.mockResolvedValue({
      id: 'receipt-1',
      lotId,
      winnerId,
      auctioneerId,
      receiptNumber,
      finalPriceCents,
      verificationHash: validHash,
      settledAt,
      itemSnapshot: {
        title: 'Obra Rara Impressionista',
        description: 'Pintura a oleo',
        imageUrl: 'https://exemplo.com/arte.jpg',
        externalItemId: 'cma-101',
        itemAttributes: { year: '1888' },
      },
      auctioneer: {
        name: 'Roberto Leiloeiro',
      },
    });

    const result = await service.getReceiptById('receipt-1');

    expect(result.id).toBe('receipt-1');
    expect(result.receiptNumber).toBe(receiptNumber);
    expect(result.isAuthentic).toBe(true);
    expect(result.finalPriceCents).toBe(250000);
    expect(result.finalPriceFormatted).toBe('R$ 2500,00');
    expect(result.auctioneerName).toBe('Roberto Leiloeiro');
    // Pseudonimo deterministico que oculta dados reais do licitante
    expect(result.winnerPseudonym).toMatch(/^Licitante #[0-9A-F]{4}$/);
    expect(result.shareableUrl).toBe('/comprovante/receipt-1');
  });

  it('deve sinalizar isAuthentic = false caso o hash gravado nao confira com os dados', async () => {
    const lotId = 'lot-123';
    const winnerId = 'winner-456';
    const auctioneerId = 'auctioneer-789';
    const receiptNumber = 'REC-2026-ABC123';
    const finalPriceCents = 250000n;
    const settledAt = new Date('2026-10-27T18:00:00Z');

    prismaMock.receipt.findUnique.mockResolvedValue({
      id: 'receipt-tampered',
      lotId,
      winnerId,
      auctioneerId,
      receiptNumber,
      finalPriceCents,
      // Hash fraudulento gravado no banco
      verificationHash: '0000000000000000000000000000000000000000000000000000000000000000',
      settledAt,
      itemSnapshot: {
        title: 'Obra Fraudada',
        description: null,
        imageUrl: 'https://exemplo.com/arte.jpg',
        externalItemId: 'cma-101',
        itemAttributes: {},
      },
      auctioneer: {
        name: 'Roberto Leiloeiro',
      },
    });

    const result = await service.getReceiptById('receipt-tampered');

    expect(result.isAuthentic).toBe(false);
  });

  it('deve consultar comprovante a partir do ID do lote', async () => {
    prismaMock.receipt.findUnique.mockImplementation(({ where }: { where: { lotId?: string; id?: string } }) => {
      if (where.lotId === 'lot-target' || where.id === 'receipt-target') {
        return Promise.resolve({
          id: 'receipt-target',
          lotId: 'lot-target',
          winnerId: 'winner-1',
          auctioneerId: 'auctioneer-1',
          receiptNumber: 'REC-2026-XYZ',
          finalPriceCents: 100000n,
          verificationHash: computeReceiptVerificationHash(
            'REC-2026-XYZ',
            'lot-target',
            'winner-1',
            'auctioneer-1',
            100000n,
            new Date('2026-10-27T12:00:00Z'),
          ),
          settledAt: new Date('2026-10-27T12:00:00Z'),
          itemSnapshot: { title: 'Lote Teste', imageUrl: 'url', externalItemId: '1', itemAttributes: {} },
          auctioneer: { name: 'Leiloeiro' },
        });
      }
      return Promise.resolve(null);
    });

    const result = await service.getReceiptByLotId('lot-target');
    expect(result.id).toBe('receipt-target');
  });

  it('deve retornar participacoes do licitante categorizadas em won, active e lost', async () => {
    const bidderId = 'bidder-ana';

    // 1a chamada: wonLots
    // 2a chamada: activeLots
    // 3a chamada: lostLots
    prismaMock.lot.findMany
      .mockResolvedValueOnce([
        {
          id: 'won-1',
          title: 'Obra Vencida',
          imageUrl: 'https://img.com/won.jpg',
          receipt: {
            id: 'rec-won',
            receiptNumber: 'REC-2026-WON',
            finalPriceCents: 180000n,
            settledAt: new Date('2026-10-27T14:00:00Z'),
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'active-1',
          title: 'Obra Ao Vivo',
          imageUrl: 'https://img.com/active.jpg',
          currentPriceCents: 95000n,
          winningBidderId: bidderId,
          endsAt: new Date(Date.now() + 60000),
          bids: [{ amountCents: 95000n }],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'lost-1',
          title: 'Obra Perdida',
          imageUrl: 'https://img.com/lost.jpg',
          currentPriceCents: 200000n,
          winningBidderId: 'bruno-id',
          endsAt: new Date('2026-10-27T10:00:00Z'),
          bids: [{ amountCents: 150000n }],
        },
      ]);

    const result = await service.getMyBids(bidderId);

    expect(result.won).toHaveLength(1);
    expect(result.won[0].receiptNumber).toBe('REC-2026-WON');
    expect(result.won[0].finalPriceCents).toBe(180000);

    expect(result.active).toHaveLength(1);
    expect(result.active[0].isLeading).toBe(true);
    expect(result.active[0].currentPriceCents).toBe(95000);

    expect(result.lost).toHaveLength(1);
    expect(result.lost[0].finalPriceCents).toBe(200000);
    expect(result.lost[0].myHighestBidCents).toBe(150000);
    expect(result.lost[0].winningPseudonym).toMatch(/^Licitante #[0-9A-F]{4}$/);
  });
});
