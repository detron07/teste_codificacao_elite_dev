import { Role } from '@prisma/client';

/** Conteúdo assinado no JWT. */
export interface JwtPayload {
  sub: string;
  role: Role;
  name: string;
}

/** Usuário autenticado anexado à requisição pelos guards. */
export interface AuthUser {
  id: string;
  role: Role;
  name: string;
}
