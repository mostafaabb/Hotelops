import { Module } from '@nestjs/common';
import { RoomTypesController } from './room-types.controller';

@Module({
  controllers: [RoomTypesController],
})
export class RoomTypesModule {}
