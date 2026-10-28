import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReceiptsService } from './receipts.service';
import {
  BidderParticipationsView,
  PublicReceiptView,
  SettlementResult,
} from './receipts.types';
import { SettlementService } from './settlement.service';

@Controller('receipts')
export class ReceiptsController {
  constructor(
    private readonly receiptsService: ReceiptsService,
    private readonly settlementService: SettlementService,
  ) {}

  /**
   * Retorna os lances e arremates do licitante autenticado.
   */
  @Roles(Role.BIDDER)
  @Get('my/bids')
  getMyBidsReceipts(@CurrentUser() user: AuthUser): Promise<BidderParticipationsView> {
    return this.receiptsService.getMyBids(user.id);
  }

  /**
   * Consulta publica de comprovante de arremate por ID.
   */
  @Public()
  @Get(':id')
  getById(@Param('id') id: string): Promise<PublicReceiptView> {
    return this.receiptsService.getReceiptById(id);
  }
}

@Controller('lots')
export class LotReceiptsController {
  constructor(
    private readonly receiptsService: ReceiptsService,
    private readonly settlementService: SettlementService,
  ) {}

  /**
   * Retorna as participacoes e arremates do licitante autenticado (atalho em /lots/bidder/my-bids).
   */
  @Roles(Role.BIDDER)
  @Get('bidder/my-bids')
  getMyBids(@CurrentUser() user: AuthUser): Promise<BidderParticipationsView> {
    return this.receiptsService.getMyBids(user.id);
  }

  /**
   * Consulta publica de comprovante de arremate a partir do ID do lote.
   */
  @Public()
  @Get(':id/receipt')
  getByLotId(@Param('id') lotId: string): Promise<PublicReceiptView> {
    return this.receiptsService.getReceiptByLotId(lotId);
  }

  /**
   * Liquida um lote manualmente. Apenas leiloeiros.
   */
  @Roles(Role.AUCTIONEER)
  @Post(':id/settle')
  @HttpCode(HttpStatus.OK)
  settleLot(
    @CurrentUser() user: AuthUser,
    @Param('id') lotId: string,
  ): Promise<SettlementResult> {
    return this.settlementService.settleLot(lotId, user.id);
  }
}
