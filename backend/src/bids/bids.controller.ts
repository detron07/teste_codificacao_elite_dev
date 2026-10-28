import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { BidsService } from './bids.service';
import { BidView, LiveRoomState, PlaceBidResponse } from './bids.types';
import { PlaceBidDto } from './dto/place-bid.dto';

@Controller('lots/:id')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  /**
   * Submete um novo lance no lote ao vivo. Apenas licitantes.
   */
  @Roles(Role.BIDDER)
  @Post('bids')
  @HttpCode(HttpStatus.CREATED)
  placeBid(
    @CurrentUser() user: AuthUser,
    @Param('id') lotId: string,
    @Body() dto: PlaceBidDto,
    @Req() req: Request,
  ): Promise<PlaceBidResponse> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.bidsService.placeBid(user.id, lotId, dto, ipAddress);
  }

  /**
   * Retorna o estado completo da sala ao vivo do lote (status de lideranca, contagem regressiva, etc.).
   * Rota publica com reconhecimento opcional de sessao autenticada.
   */
  @Public()
  @Get('live-room')
  getLiveRoomState(
    @Param('id') lotId: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<LiveRoomState> {
    return this.bidsService.getLiveRoomState(lotId, user?.id);
  }

  /**
   * Retorna o historico publico de lances do lote com dados anonimizados.
   */
  @Public()
  @Get('bids')
  getLotBids(@Param('id') lotId: string, @CurrentUser() user?: AuthUser): Promise<BidView[]> {
    return this.bidsService.getLotBids(lotId, user?.id);
  }
}
