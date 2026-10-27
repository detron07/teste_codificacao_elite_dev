import { durationToSeconds, validateEnv } from './env.validation';

const VALID_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
};

describe('validateEnv', () => {
  it('aplica valores padrão e converte tipos', () => {
    const env = validateEnv({ ...VALID_ENV, PORT: '4000' });

    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.JWT_EXPIRES_IN).toBe(86_400);
  });

  it('falha no boot quando o JWT_SECRET é curto demais', () => {
    expect(() => validateEnv({ ...VALID_ENV, JWT_SECRET: 'curto' })).toThrow(/JWT_SECRET/);
  });

  it('falha quando DATABASE_URL está ausente', () => {
    expect(() => validateEnv({ JWT_SECRET: VALID_ENV.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('rejeita JWT_EXPIRES_IN em formato inválido', () => {
    expect(() => validateEnv({ ...VALID_ENV, JWT_EXPIRES_IN: 'um dia' })).toThrow(/JWT_EXPIRES_IN/);
  });
});

describe('durationToSeconds', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['12h', 43_200],
    ['7d', 604_800],
  ])('%s → %i segundos', (input, expected) => {
    expect(durationToSeconds(input)).toBe(expected);
  });
});
