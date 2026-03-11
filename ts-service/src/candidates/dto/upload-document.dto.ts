import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({
    enum: ['resume', 'cover_letter', 'portfolio', 'other'],
    example: 'resume',
  })
  @IsString()
  @IsIn(['resume', 'cover_letter', 'portfolio', 'other'])
  documentType!: string;

  @ApiProperty({ example: 'ada_resume.txt', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    example: 'Ada Lovelace — Software Engineer with 10 years of experience...',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  rawText!: string;
}
