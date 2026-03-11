import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { SampleCandidate } from './sample-candidate.entity';

export type SummaryStatus = 'pending' | 'completed' | 'failed';
export type RecommendedDecision = 'advance' | 'hold' | 'reject';

@Entity({ name: 'candidate_summaries' })
export class CandidateSummary {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-...' })
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @ApiProperty({ example: 'cand-uuid-here' })
  @Column({ name: 'candidate_id', type: 'varchar', length: 64 })
  candidateId!: string;

  @ApiProperty({ enum: ['pending', 'completed', 'failed'], example: 'completed' })
  @Column({ type: 'varchar', length: 20 })
  status!: SummaryStatus;

  @ApiPropertyOptional({ example: 78, nullable: true })
  @Column({ type: 'integer', nullable: true })
  score!: number | null;

  @ApiPropertyOptional({ type: [String], example: ['Strong TypeScript skills', 'Clear communicator'], nullable: true })
  @Column({ type: 'simple-array', nullable: true })
  strengths!: string[] | null;

  @ApiPropertyOptional({ type: [String], example: ['Limited system design examples'], nullable: true })
  @Column({ type: 'simple-array', nullable: true })
  concerns!: string[] | null;

  @ApiPropertyOptional({ example: 'Strong technical candidate with relevant experience.', nullable: true })
  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @ApiPropertyOptional({ enum: ['advance', 'hold', 'reject'], example: 'advance', nullable: true })
  @Column({
    name: 'recommended_decision',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  recommendedDecision!: RecommendedDecision | null;

  @ApiPropertyOptional({ example: 'gemini', nullable: true })
  @Column({ type: 'varchar', length: 80, nullable: true })
  provider!: string | null;

  @ApiPropertyOptional({ example: 'v1', nullable: true })
  @Column({
    name: 'prompt_version',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  promptVersion!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty()
  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => SampleCandidate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: SampleCandidate;
}
