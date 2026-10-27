import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca uma rota como pública (dispensa JWT). Todas as rotas são protegidas por padrão. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
