/**
 * Seed de dados de teste (idempotente: pode ser executado várias vezes).
 *
 * Cria 1 leiloeiro e 2 licitantes com saldo inicial. Os lotes de demonstração
 * são adicionados nas próximas etapas, junto com o módulo de lotes.
 *
 * Execução: npm run db:seed
 */
import { PrismaClient, Role, WalletTransactionType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const SEED_PASSWORD = 'Leilao123';

interface SeedUser {
  name: string;
  email: string;
  role: Role;
  initialDepositCents: number;
}

const SEED_USERS: SeedUser[] = [
  {
    name: 'Casa Aurora Leilões',
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
    console.log(`  - ${seed.email} já existe - mantido`);
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
          description: 'Depósito inicial (seed)',
        },
      });
    }
  });
  console.log(`  [OK] ${seed.email} criado (${seed.role})`);
}

async function main(): Promise<void> {
  console.log('Semeando usuários...');
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const user of SEED_USERS) {
    await seedUser(user, passwordHash);
  }
  console.log(`Concluído. Senha de todos os usuários de teste: ${SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Falha ao executar o seed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
