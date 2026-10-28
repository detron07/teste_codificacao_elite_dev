import { Module } from '@nestjs/common';
import { BidsModule } from '../bids/bids.module';
import { LotReceiptsController, ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';
import { SettlementService } from './settlement.service';

@Module({
  imports: [BidsModule],
  controllers: [ReceiptsController, LotReceiptsController],
  providers: [ReceiptsService, SettlementService],
  exports: [ReceiptsService, SettlementService],
})
export class ReceiptsModule {}
