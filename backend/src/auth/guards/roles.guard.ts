import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import type { AuthUser } from '../auth.types';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ROLE_LABELS: Record<Role, string> = {
  AUCTIONEER: 'leiloeiros',
  BIDDER: 'licitantes',
};

/** Guard global: aplica as restrições declaradas com `@Roles(...)`. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (user && requiredRoles.includes(user.role)) return true;

    const allowed = requiredRoles.map((role) => ROLE_LABELS[role]).join(' ou ');
    throw new ForbiddenException(`Ação permitida apenas para ${allowed}`);
  }
}
