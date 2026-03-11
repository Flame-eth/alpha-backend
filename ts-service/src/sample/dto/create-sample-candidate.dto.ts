import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSampleCandidateDto {
  @ApiProperty({ example: 'Ada Lovelace', minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @ApiPropertyOptional({ example: 'ada@example.com', maxLength: 160 })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;
}
