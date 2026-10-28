import { Module } from '@nestjs/common';
import { BidsController } from './bids.controller';
import { BidsGateway } from './bids.gateway';
import { BidsService } from './bids.service';

@Module({
  controllers: [BidsController],
  providers: [BidsService, BidsGateway],
  exports: [BidsService, BidsGateway],
})
export class BidsModule {}
