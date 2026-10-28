/**
 * Seed de dados de teste (idempotente: pode ser executado varias vezes).
 *
 * Cria:
 *  - 1 leiloeiro (leiloeiro@casadeleiloes.dev)
 *  - 2 licitantes com saldo simulado (ana@casadeleiloes.dev, bruno@casadeleiloes.dev)
 *  - 1 lote AO VIVO com lances abertos disputados
 *  - 1 lote AGENDADO (sem lances, apto a cancelamento)
 *  - 1 lote ENCERRADO com arremate
 *
 * Senha padrao de todos: Leilao123
 * Execucao: npm run db:seed
 */
import { createHash } from 'node:crypto';
import { LotStatus, PrismaClient, Role, WalletTransactionType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const SEED_PASSWORD = 'Leilao123';

function computeBidHash(
  prevHash: string | null,
  lotId: string,
  bidderId: string,
  amountCents: bigint,
  createdAt: Date,
): string {
  const payload = `${prevHash ?? 'GENESIS'}:${lotId}:${bidderId}:${amountCents.toString()}:${createdAt.toISOString()}`;
  return createHash('sha256').update(payload).digest('hex');
}

interface SeedUser {
  name: string;
  email: string;
  role: Role;
  initialDepositCents: number;
}

const SEED_USERS: SeedUser[] = [
  {
    name: 'Casa Aurora Leiloes',
    email: 'leiloeiro@casadeleiloes.dev',
    role: Role.AUCTIONEER,
    initialDepositCents: 0,
  },
  {
    name: 'Ana Licitante',
    email: 'ana@casadeleiloes.dev',
    role: Role.BIDDER,
    initialDepositCents: 50_000_00, // R$ 50.000,00
  },
  {
    name: 'Bruno Licitante',
    email: 'bruno@casadeleiloes.dev',
    role: Role.BIDDER,
    initialDepositCents: 30_000_00, // R$ 30.000,00
  },
];

async function seedUser(seed: SeedUser, passwordHash: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: seed.email } });
  if (existing) {
    console.log(`  - ${seed.email} ja existe - mantido`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: seed.name,
        email: seed.email,
        passwordHash,
        role: seed.role,
        wallet: { create: { balanceCents: BigInt(seed.initialDepositCents) } },
      },
      include: { wallet: true },
    });

    if (seed.initialDepositCents > 0 && user.wallet) {
      await tx.walletTransaction.create({
        data: {
          walletId: user.wallet.id,
          type: WalletTransactionType.DEPOSIT,
          amountCents: BigInt(seed.initialDepositCents),
          balanceAfterCents: BigInt(seed.initialDepositCents),
          description: 'Deposito inicial (seed)',
        },
      });
    }
  });
  console.log(`  [OK] ${seed.email} criado (${seed.role})`);
}

async function seedLots(): Promise<void> {
  const auctioneer = await prisma.user.findUnique({
    where: { email: 'leiloeiro@casadeleiloes.dev' },
  });
  const ana = await prisma.user.findUnique({ where: { email: 'ana@casadeleiloes.dev' } });
  const bruno = await prisma.user.findUnique({ where: { email: 'bruno@casadeleiloes.dev' } });

  if (!auctioneer || !ana || !bruno) {
    throw new Error('Usuarios necessarios para os lotes nao foram encontrados');
  }

  const now = new Date();

  // 1. Lote AO VIVO com lances (disputado entre Ana e Bruno)
  const existingLiveLot = await prisma.lot.findFirst({
    where: { externalItemId: 'cma-135382', auctioneerId: auctioneer.id },
  });

  if (!existingLiveLot) {
    const startsAt = new Date(now.getTime() - 1000 * 60 * 60); // comecou ha 1h
    const endsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24); // termina em 24h
    const startPriceCents = BigInt(5_000_00); // R$ 5.000,00
    const minIncrementCents = BigInt(200_00); // R$ 200,00
    const currentPriceCents = BigInt(5_500_00); // R$ 5.500,00

    const lot = await prisma.lot.create({
      data: {
        auctioneerId: auctioneer.id,
        title: 'The Red Kerchief',
        description: 'Obra-prima de Claude Monet retratando Camille Doncieux atraves da janela.',
        externalItemId: 'cma-135382',
        imageUrl: 'https://openaccess-cdn.clevelandart.org/1958.39/1958.39_web.jpg',
        itemAttributes: {
          artist: 'Claude Monet (French, 1840-1926)',
          date: 'c. 1868-73',
          technique: 'oil on fabric',
          culture: 'France, 19th century',
          department: 'European Painting and Sculpture',
          dimensions: '39 x 31 in (99 x 79.8 cm)',
          source: 'cleveland_museum',
        },
        startPriceCents,
        minIncrementCents,
        currentPriceCents,
        startsAt,
        endsAt,
        originalEndsAt: endsAt,
        status: LotStatus.ACTIVE,
      },
    });

    // 1o lance: Ana da lance inicial de R$ 5.000,00
    const bid1Date = new Date(now.getTime() - 1000 * 60 * 45);
    const bid1Hash = computeBidHash(null, lot.id, ana.id, startPriceCents, bid1Date);
    const bid1 = await prisma.bid.create({
      data: {
        lotId: lot.id,
        bidderId: ana.id,
        amountCents: startPriceCents,
        previousBidId: null,
        previousHash: null,
        hash: bid1Hash,
        createdAt: bid1Date,
      },
    });

    // 2o lance: Bruno cobre com R$ 5.500,00 (cadeia de hash ligada ao lance 1)
    const bid2Date = new Date(now.getTime() - 1000 * 60 * 20);
    const bid2Hash = computeBidHash(bid1.hash, lot.id, bruno.id, currentPriceCents, bid2Date);
    await prisma.bid.create({
      data: {
        lotId: lot.id,
        bidderId: bruno.id,
        amountCents: currentPriceCents,
        previousBidId: bid1.id,
        previousHash: bid1.hash,
        hash: bid2Hash,
        createdAt: bid2Date,
      },
    });

    await prisma.lot.update({
      where: { id: lot.id },
      data: { winningBidderId: bruno.id },
    });

    console.log('  [OK] Lote ao vivo criado com lances abertos (The Red Kerchief)');
  } else {
    console.log('  - Lote ao vivo ja existe - mantido');
  }

  // 2. Lote AGENDADO (inicia amanha, sem lances - apto para teste de cancelamento)
  const existingSchedLot = await prisma.lot.findFirst({
    where: { externalItemId: 'cma-146142', auctioneerId: auctioneer.id },
  });

  if (!existingSchedLot) {
    const startsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24); // amanha
    const endsAt = new Date(now.getTime() + 1000 * 60 * 60 * 72); // em 3 dias

    await prisma.lot.create({
      data: {
        auctioneerId: auctioneer.id,
        title: 'Water Lilies (Nympheas)',
        description: 'Imponente estudo de Nympheas em Giverny por Claude Monet.',
        externalItemId: 'cma-146142',
        imageUrl: 'https://openaccess-cdn.clevelandart.org/1960.81/1960.81_web.jpg',
        itemAttributes: {
          artist: 'Claude Monet (French, 1840-1926)',
          date: 'c. 1914-1926',
          technique: 'oil on canvas',
          culture: 'France, 20th century',
          department: 'European Painting and Sculpture',
          dimensions: '79 x 167 1/2 in (200.7 x 425.5 cm)',
          source: 'cleveland_museum',
        },
        startPriceCents: BigInt(20_000_00),
        minIncrementCents: BigInt(1_000_00),
        currentPriceCents: BigInt(20_000_00),
        startsAt,
        endsAt,
        originalEndsAt: endsAt,
        status: LotStatus.SCHEDULED,
      },
    });

    console.log('  [OK] Lote agendado criado (Water Lilies)');
  } else {
    console.log('  - Lote agendado ja existe - mantido');
  }

  // 3. Lote ENCERRADO (Rembrandt arrematado por Ana)
  const existingFinishedLot = await prisma.lot.findFirst({
    where: { externalItemId: 'cma-109312', auctioneerId: auctioneer.id },
  });

  if (!existingFinishedLot) {
    const startsAt = new Date(now.getTime() - 1000 * 60 * 60 * 72);
    const endsAt = new Date(now.getTime() - 1000 * 60 * 60 * 24);
    const startPriceCents = BigInt(10_000_00);
    const winningAmountCents = BigInt(14_000_00);

    const lot = await prisma.lot.create({
      data: {
        auctioneerId: auctioneer.id,
        winningBidderId: ana.id,
        title: 'Portrait of a Woman',
        description: 'Retrato do seculo de ouro holandes por Rembrandt van Rijn.',
        externalItemId: 'cma-109312',
        imageUrl: 'https://openaccess-cdn.clevelandart.org/1944.80/1944.80_web.jpg',
        itemAttributes: {
          artist: 'Rembrandt van Rijn (Dutch, 1606-1669)',
          date: '1635',
          technique: 'oil on canvas',
          culture: 'Netherlands, 17th century',
          department: 'European Painting and Sculpture',
          dimensions: '30 1/8 x 25 7/8 in (76.5 x 65.7 cm)',
          source: 'cleveland_museum',
        },
        startPriceCents,
        minIncrementCents: BigInt(500_00),
        currentPriceCents: winningAmountCents,
        startsAt,
        endsAt,
        originalEndsAt: endsAt,
        status: LotStatus.FINISHED,
      },
    });

    const bidDate = new Date(startsAt.getTime() + 1000 * 60 * 60 * 12);
    const bidHash = computeBidHash(null, lot.id, ana.id, winningAmountCents, bidDate);
    await prisma.bid.create({
      data: {
        lotId: lot.id,
        bidderId: ana.id,
        amountCents: winningAmountCents,
        previousBidId: null,
        previousHash: null,
        hash: bidHash,
        createdAt: bidDate,
      },
    });

    console.log('  [OK] Lote encerrado criado com arremate (Portrait of a Woman)');
  } else {
    console.log('  - Lote encerrado ja existe - mantido');
  }
}

async function main(): Promise<void> {
  console.log('Semeando usuarios de teste...');
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const user of SEED_USERS) {
    await seedUser(user, passwordHash);
  }

  console.log('Semeando lotes de demonstracao...');
  await seedLots();

  console.log(`Concluido. Senha de todos os usuarios de teste: ${SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Falha ao executar o seed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
