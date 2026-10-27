import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

const JWT_SECRET = 'test-secret-with-at-least-32-characters!!';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: '7d1c8a52-3f7e-4a3b-9a55-1f2b8b0e9a10',
    name: 'Ana Licitante',
    email: 'ana@casadeleiloes.dev',
    passwordHash: bcrypt.hashSync('Senha123', 4),
    role: Role.BIDDER,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('AuthService', () => {
  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail' | 'findById' | 'create'>>;
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    service = new AuthService(
      usersService as unknown as UsersService,
      new JwtService({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
    );
  });

  describe('register', () => {
    it('cria o usuário com a senha em hash e devolve um token válido', async () => {
      usersService.create.mockImplementation((input) =>
        Promise.resolve(buildUser({ ...input, passwordHash: input.passwordHash })),
      );

      const result = await service.register({
        name: 'Ana Licitante',
        email: 'ana@casadeleiloes.dev',
        password: 'Senha123',
        role: Role.BIDDER,
      });

      const createdWith = usersService.create.mock.calls[0][0];
      expect(createdWith.passwordHash).not.toBe('Senha123');
      expect(await bcrypt.compare('Senha123', createdWith.passwordHash)).toBe(true);
      expect(result.user).not.toHaveProperty('passwordHash');
      await expect(service.verifyToken(result.accessToken)).resolves.toMatchObject({
        role: Role.BIDDER,
      });
    });

    it('lança ConflictException quando o e-mail já existe', async () => {
      usersService.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.register({
          name: 'Ana',
          email: 'ana@casadeleiloes.dev',
          password: 'Senha123',
          role: Role.BIDDER,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('autentica com credenciais corretas', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());

      const result = await service.login({ email: 'ana@casadeleiloes.dev', password: 'Senha123' });

      expect(result.user.email).toBe('ana@casadeleiloes.dev');
      expect(typeof result.accessToken).toBe('string');
    });

    it('rejeita senha incorreta com mensagem genérica', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());

      await expect(
        service.login({ email: 'ana@casadeleiloes.dev', password: 'errada123' }),
      ).rejects.toThrow(new UnauthorizedException('E-mail ou senha inválidos'));
    });

    it('rejeita e-mail inexistente com a mesma mensagem (não revela contas)', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ninguem@casadeleiloes.dev', password: 'Senha123' }),
      ).rejects.toThrow(new UnauthorizedException('E-mail ou senha inválidos'));
    });
  });

  describe('verifyToken', () => {
    it('rejeita tokens assinados com outro segredo', async () => {
      const forged = await new JwtService({
        secret: 'another-secret-with-at-least-32-chars!!',
      }).signAsync({ sub: 'x', role: Role.AUCTIONEER, name: 'Hacker' });

      await expect(service.verifyToken(forged)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
