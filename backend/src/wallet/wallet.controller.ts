import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DepositDto } from './dto/deposit.dto';
import { WalletService } from './wallet.service';
import { WalletSummary } from './wallet.types';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * Consulta o resumo financeiro da carteira do licitante autenticado.
   */
  @Roles(Role.BIDDER)
  @Get('me')
  getSummary(@CurrentUser() user: AuthUser): Promise<WalletSummary> {
    return this.walletService.getSummary(user.id);
  }

  /**
   * Realiza um depósito simulado na carteira. Apenas licitantes.
   */
  @Roles(Role.BIDDER)
  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  deposit(@CurrentUser() user: AuthUser, @Body() dto: DepositDto): Promise<WalletSummary> {
    return this.walletService.deposit(user.id, dto.amountCents);
  }
}
