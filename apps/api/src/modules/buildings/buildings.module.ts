import { Module } from '@nestjs/common';
import { BuildingsController } from './buildings.controller';

@Module({
  controllers: [BuildingsController],
})
export class BuildingsModule {}
