import { ApiProperty } from '@nestjs/swagger';

export class GenerateSummaryResponseDto {
  @ApiProperty({
    description: 'Internal queue job ID',
    example: 'a1b2c3d4-...',
  })
  jobId!: string;

  @ApiProperty({
    description: 'Created summary record ID',
    example: 'b2c3d4e5-...',
  })
  summaryId!: string;

  @ApiProperty({ enum: ['pending'], example: 'pending' })
  status!: string;
}
