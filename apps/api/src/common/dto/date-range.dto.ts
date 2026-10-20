import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DateRangeQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  get fromDate(): Date | undefined {
    return this.from ? new Date(this.from) : undefined;
  }

  get toDate(): Date | undefined {
    return this.to ? new Date(this.to) : undefined;
  }
}