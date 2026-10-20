import { Module } from '@nestjs/common';
import { RatePlansController } from './rate-plans.controller';

@Module({
  controllers: [RatePlansController],
})
export class RatePlansModule {}