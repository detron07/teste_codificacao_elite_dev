import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AuditService } from './audit/audit.service';
import { PrismaService } from './prisma/prisma.service';
import { ReceiptsService } from './receipts/receipts.service';
import { SettlementService } from './receipts/settlement.service';

describe('Phase 4 Smoke Test (End-to-End Services Integration)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let auditService: AuditService;
  let receiptsService: ReceiptsService;
  let settlementService: SettlementService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    auditService = moduleRef.get(AuditService);
    receiptsService = moduleRef.get(ReceiptsService);
    settlementService = moduleRef.get(SettlementService);
  });

  afterAll(async () => {
    settlementService.onModuleDestroy();
    await prisma.$disconnect();
    await moduleRef.close();
  });

  it('deve auditar lote ao vivo e confirmar integridade criptografica (INTEGRO)', async () => {
    const liveLot = await prisma.lot.findFirst({
      where: { title: 'The Red Kerchief' },
    });
    expect(liveLot).not.toBeNull();

    const audit = await auditService.auditLot(liveLot!.id);
    expect(audit.status).toBe('INTEGRO');
    expect(audit.isTampered).toBe(false);
    expect(audit.totalBids).toBeGreaterThanOrEqual(2);
    expect(audit.genesisHash).toBeDefined();
    expect(audit.headHash).toBeDefined();
    expect(audit.violation).toBeNull();
  });

  it('deve carregar comprovante de arremate autentico para lote finalizado', async () => {
    const finishedLot = await prisma.lot.findFirst({
      where: { title: 'Portrait of a Woman' },
    });
    expect(finishedLot).not.toBeNull();

    const receipt = await receiptsService.getReceiptByLotId(finishedLot!.id);
    expect(receipt).toBeDefined();
    expect(receipt.receiptNumber).toMatch(/^REC-2026-/);
    expect(receipt.isAuthentic).toBe(true);
    expect(receipt.winnerPseudonym).toMatch(/^Licitante #[0-9A-F]{4}$/);
    expect(receipt.auctioneerName).toBe('Casa Aurora Leiloes');
    expect(receipt.finalPriceCents).toBe(1400000);
  });

  it('deve retornar historico e arremates de Ana corretamente', async () => {
    const ana = await prisma.user.findUnique({
      where: { email: 'ana@casadeleiloes.dev' },
    });
    expect(ana).not.toBeNull();

    const myBids = await receiptsService.getMyBids(ana!.id);
    expect(myBids.won.length).toBeGreaterThanOrEqual(1);
    expect(myBids.won[0].title).toBe('Portrait of a Woman');
    expect(myBids.won[0].finalPriceCents).toBe(1400000);
  });
});
