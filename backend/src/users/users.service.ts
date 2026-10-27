import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Representação pública do usuário (nunca expõe o hash da senha). */
export interface UserView {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export function toUserView(user: User): UserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Cria o usuário já com a carteira (saldo zero) na mesma transação. */
  create(input: CreateUserInput, tx: Prisma.TransactionClient = this.prisma): Promise<User> {
    return tx.user.create({
      data: {
        ...input,
        wallet: { create: {} },
      },
    });
  }
}
