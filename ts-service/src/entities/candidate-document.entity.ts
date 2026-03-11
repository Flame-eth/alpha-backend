import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { SampleCandidate } from './sample-candidate.entity';

@Entity({ name: 'candidate_documents' })
export class CandidateDocument {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-...' })
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @ApiProperty({ example: 'cand-uuid-here' })
  @Column({ name: 'candidate_id', type: 'varchar', length: 64 })
  candidateId!: string;

  @ApiProperty({ enum: ['resume', 'cover_letter', 'portfolio', 'other'], example: 'resume' })
  @Column({ name: 'document_type', type: 'varchar', length: 80 })
  documentType!: string;

  @ApiProperty({ example: 'ada_resume.txt' })
  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @ApiProperty({ example: 'local/cand-id/uuid-ada_resume.txt' })
  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey!: string;

  @ApiProperty({ example: 'Ada Lovelace — Software Engineer...' })
  @Column({ name: 'raw_text', type: 'text' })
  rawText!: string;

  @ApiProperty()
  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt!: Date;

  @ManyToOne(() => SampleCandidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: SampleCandidate;
}
