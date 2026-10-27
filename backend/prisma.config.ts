import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Configuração do Prisma CLI (substitui a chave `prisma` do package.json, depreciada).
 * O `dotenv/config` carrega o `.env` em desenvolvimento; em produção as variáveis
 * vêm do ambiente e o arquivo simplesmente não existe.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
