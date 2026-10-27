import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextWithUser(user?: { role: Role }): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  afterEach(() => jest.restoreAllMocks());

  it('permite acesso quando a rota não exige papel', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextWithUser({ role: Role.BIDDER }))).toBe(true);
  });

  it('permite acesso quando o papel do usuário é aceito', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.BIDDER]);
    expect(guard.canActivate(contextWithUser({ role: Role.BIDDER }))).toBe(true);
  });

  it('bloqueia leiloeiro em rota exclusiva de licitante', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.BIDDER]);
    expect(() => guard.canActivate(contextWithUser({ role: Role.AUCTIONEER }))).toThrow(
      new ForbiddenException('Ação permitida apenas para licitantes'),
    );
  });
});
