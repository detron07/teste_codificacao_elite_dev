import { z } from 'zod';

const DURATION_UNITS_IN_SECONDS = { s: 1, m: 60, h: 3_600, d: 86_400 } as const;

/** Converte durações como "15m", "12h" ou "1d" em segundos. */
export function durationToSeconds(value: string): number {
  const unit = value.slice(-1) as keyof typeof DURATION_UNITS_IN_SECONDS;
  return Number(value.slice(0, -1)) * DURATION_UNITS_IN_SECONDS[unit];
}

/**
 * Esquema das variáveis de ambiente. A aplicação falha no boot (fail fast)
 * se alguma variável obrigatória estiver ausente ou inválida.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  /** Validade do token; aceita `<número><s|m|h|d>` e é exposto em segundos. */
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN deve seguir o formato <número><s|m|h|d>, ex.: 1d')
    .default('1d')
    .transform(durationToSeconds),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${details}`);
  }
  return parsed.data;
}
