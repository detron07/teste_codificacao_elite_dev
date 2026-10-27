import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CancelLotDto } from './dto/cancel-lot.dto';
import { CreateLotDto } from './dto/create-lot.dto';
import { LotsService } from './lots.service';
import { AuctioneerDashboardMetrics, LotView, ShowcaseResponse } from './lots.types';

@Controller('lots')
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  /**
   * Vitrine pública de lotes: ao vivo, agendados e encerrados.
   * Lotes cancelados não aparecem na vitrine.
   */
  @Public()
  @Get('showcase')
  getShowcase(): Promise<ShowcaseResponse> {
    return this.lotsService.getShowcase();
  }

  /**
   * Painel do leiloeiro: lista os próprios lotes com métricas de arrecadação.
   */
  @Roles(Role.AUCTIONEER)
  @Get('auctioneer/my-lots')
  getMyLots(@CurrentUser() user: AuthUser): Promise<AuctioneerDashboardMetrics> {
    return this.lotsService.getAuctioneerDashboard(user.id);
  }

  /**
   * Detalhes públicos de um lote específico.
   */
  @Public()
  @Get(':id')
  getById(@Param('id') id: string): Promise<LotView> {
    return this.lotsService.findById(id);
  }

  /**
   * Cria um novo lote a partir de uma obra de arte. Apenas leiloeiros.
   */
  @Roles(Role.AUCTIONEER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLotDto): Promise<LotView> {
    return this.lotsService.create(user.id, dto);
  }

  /**
   * Cancela um lote. Apenas o leiloeiro proprietário e se o lote ainda não recebeu lances.
   */
  @Roles(Role.AUCTIONEER)
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelLotDto,
  ): Promise<LotView> {
    return this.lotsService.cancel(id, user.id, dto);
  }
}
