import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { computeBidHash } from '../bids/bids.types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let prismaMock: {
    lot: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      lot: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('deve lancar NotFoundException se o lote nao existir', async () => {
    prismaMock.lot.findUnique.mockResolvedValue(null);

    await expect(service.auditLot('non-existent')).rejects.toThrow(NotFoundException);
  });

  it('deve retornar INTEGRO para lote sem lances', async () => {
    prismaMock.lot.findUnique.mockResolvedValue({
      id: 'lot-1',
      title: 'Lote Vazio',
      bids: [],
    });

    const result = await service.auditLot('lot-1');

    expect(result.status).toBe('INTEGRO');
    expect(result.isTampered).toBe(false);
    expect(result.totalBids).toBe(0);
    expect(result.genesisHash).toBeNull();
    expect(result.headHash).toBeNull();
    expect(result.violation).toBeNull();
    expect(result.chain).toHaveLength(0);
  });

  it('deve verificar e aprovar uma cadeia valida de lances como INTEGRO', async () => {
    const lotId = 'lot-1';
    const bidder1 = 'user-1';
    const bidder2 = 'user-2';

    const t1 = new Date('2026-10-27T10:00:00.000Z');
    const hash1 = computeBidHash(null, lotId, bidder1, BigInt(100000), t1);

    const t2 = new Date('2026-10-27T10:05:00.000Z');
    const hash2 = computeBidHash(hash1, lotId, bidder2, BigInt(110000), t2);

    const t3 = new Date('2026-10-27T10:10:00.000Z');
    const hash3 = computeBidHash(hash2, lotId, bidder1, BigInt(125000), t3);

    prismaMock.lot.findUnique.mockResolvedValue({
      id: lotId,
      title: 'Obra Rara',
      bids: [
        {
          id: 'bid-1',
          bidderId: bidder1,
          amountCents: BigInt(100000),
          createdAt: t1,
          previousHash: null,
          hash: hash1,
        },
        {
          id: 'bid-2',
          bidderId: bidder2,
          amountCents: BigInt(110000),
          createdAt: t2,
          previousHash: hash1,
          hash: hash2,
        },
        {
          id: 'bid-3',
          bidderId: bidder1,
          amountCents: BigInt(125000),
          createdAt: t3,
          previousHash: hash2,
          hash: hash3,
        },
      ],
    });

    const result = await service.auditLot(lotId);

    expect(result.status).toBe('INTEGRO');
    expect(result.isTampered).toBe(false);
    expect(result.totalBids).toBe(3);
    expect(result.genesisHash).toBe(hash1);
    expect(result.headHash).toBe(hash3);
    expect(result.violation).toBeNull();
    expect(result.chain).toHaveLength(3);
    expect(result.chain[0].isValid).toBe(true);
    expect(result.chain[1].isValid).toBe(true);
    expect(result.chain[2].isValid).toBe(true);
  });

  it('deve detectar adulteracao se o valor de um lance for alterado no banco', async () => {
    const lotId = 'lot-1';
    const bidder1 = 'user-1';
    const bidder2 = 'user-2';

    const t1 = new Date('2026-10-27T10:00:00.000Z');
    const hash1 = computeBidHash(null, lotId, bidder1, BigInt(100000), t1);

    const t2 = new Date('2026-10-27T10:05:00.000Z');
    const hash2 = computeBidHash(hash1, lotId, bidder2, BigInt(110000), t2);

    prismaMock.lot.findUnique.mockResolvedValue({
      id: lotId,
      title: 'Obra Alvo',
      bids: [
        {
          id: 'bid-1',
          bidderId: bidder1,
          amountCents: BigInt(100000),
          createdAt: t1,
          previousHash: null,
          hash: hash1,
        },
        {
          id: 'bid-2',
          bidderId: bidder2,
          // Valor foi adulterado no banco para 999999 sem recalcular o hash
          amountCents: BigInt(999999),
          createdAt: t2,
          previousHash: hash1,
          hash: hash2,
        },
      ],
    });

    const result = await service.auditLot(lotId);

    expect(result.status).toBe('ADULTERADO');
    expect(result.isTampered).toBe(true);
    expect(result.violation).not.toBeNull();
    expect(result.violation?.bidId).toBe('bid-2');
    expect(result.violation?.reason).toContain('Assinatura de conteudo violada');
  });

  it('deve detectar adulteracao se um elo da cadeia for quebrado (previousHash incorreto)', async () => {
    const lotId = 'lot-1';
    const bidder1 = 'user-1';
    const bidder2 = 'user-2';

    const t1 = new Date('2026-10-27T10:00:00.000Z');
    const hash1 = computeBidHash(null, lotId, bidder1, BigInt(100000), t1);

    const t2 = new Date('2026-10-27T10:05:00.000Z');
    const fakePreviousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const hash2 = computeBidHash(fakePreviousHash, lotId, bidder2, BigInt(110000), t2);

    prismaMock.lot.findUnique.mockResolvedValue({
      id: lotId,
      title: 'Obra Alvo',
      bids: [
        {
          id: 'bid-1',
          bidderId: bidder1,
          amountCents: BigInt(100000),
          createdAt: t1,
          previousHash: null,
          hash: hash1,
        },
        {
          id: 'bid-2',
          bidderId: bidder2,
          amountCents: BigInt(110000),
          createdAt: t2,
          previousHash: fakePreviousHash,
          hash: hash2,
        },
      ],
    });

    const result = await service.auditLot(lotId);

    expect(result.status).toBe('ADULTERADO');
    expect(result.isTampered).toBe(true);
    expect(result.violation).not.toBeNull();
    expect(result.violation?.bidId).toBe('bid-2');
    expect(result.violation?.reason).toContain('Elo quebrado');
  });

  it('deve detectar adulteracao se a progressao financeira for regressiva', async () => {
    const lotId = 'lot-1';
    const bidder1 = 'user-1';
    const bidder2 = 'user-2';

    const t1 = new Date('2026-10-27T10:00:00.000Z');
    const hash1 = computeBidHash(null, lotId, bidder1, BigInt(100000), t1);

    // Segundo lance menor que o primeiro, embora computado corretamente sobre os dados
    const t2 = new Date('2026-10-27T10:05:00.000Z');
    const hash2 = computeBidHash(hash1, lotId, bidder2, BigInt(90000), t2);

    prismaMock.lot.findUnique.mockResolvedValue({
      id: lotId,
      title: 'Obra Alvo',
      bids: [
        {
          id: 'bid-1',
          bidderId: bidder1,
          amountCents: BigInt(100000),
          createdAt: t1,
          previousHash: null,
          hash: hash1,
        },
        {
          id: 'bid-2',
          bidderId: bidder2,
          amountCents: BigInt(90000),
          createdAt: t2,
          previousHash: hash1,
          hash: hash2,
        },
      ],
    });

    const result = await service.auditLot(lotId);

    expect(result.status).toBe('ADULTERADO');
    expect(result.isTampered).toBe(true);
    expect(result.violation).not.toBeNull();
    expect(result.violation?.bidId).toBe('bid-2');
    expect(result.violation?.reason).toContain('Inconsistencia financeira');
  });
});
