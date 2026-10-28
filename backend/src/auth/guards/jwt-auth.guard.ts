import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import type { AuthUser } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard global: exige um JWT válido no header `Authorization: Bearer <token>`,
 * exceto em rotas marcadas com `@Public()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
      const token = extractBearerToken(request.headers.authorization);
      if (token) {
        try {
          request.user = await this.authService.verifyToken(token);
        } catch {
          // Rota pública: ignora token expirado/inválido sem rejeitar a requisição
        }
      }
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Autenticação necessária');
    }

    request.user = await this.authService.verifyToken(token);
    return true;
  }
}

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
