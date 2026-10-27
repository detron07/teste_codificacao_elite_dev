import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { toUserView, UsersService, UserView } from '../users/users.service';
import type { AuthUser, JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;
/** Hash fictício usado quando o e-mail não existe, para o tempo de resposta não revelar contas. */
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

export interface AuthResponse {
  accessToken: string;
  user: UserView;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      const user = await this.usersService.create({
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
      });
      return { accessToken: await this.signToken(user), user: toUserView(user) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Já existe uma conta com este e-mail');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    const passwordMatches = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    return { accessToken: await this.signToken(user), user: toUserView(user) };
  }

  async me(userId: string): Promise<UserView> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('Sessão inválida');
    return toUserView(user);
  }

  /** Valida um JWT e devolve o usuário autenticado. Reutilizado por HTTP e WebSocket. */
  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      return { id: payload.sub, role: payload.role, name: payload.name };
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }
  }

  private signToken(user: { id: string; role: JwtPayload['role']; name: string }): Promise<string> {
    const payload: JwtPayload = { sub: user.id, role: user.role, name: user.name };
    return this.jwtService.signAsync(payload);
  }
}
