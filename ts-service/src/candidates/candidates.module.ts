import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { SampleCandidate } from '../entities/sample-candidate.entity';
import { LlmModule } from '../llm/llm.module';
import { QueueModule } from '../queue/queue.module';
import { CandidateAccessGuard } from './candidate-access.guard';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { SummaryWorkerService } from './summary-worker.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SampleCandidate,
      CandidateDocument,
      CandidateSummary,
    ]),
    LlmModule,
    QueueModule,
  ],
  controllers: [CandidatesController],
  providers: [CandidatesService, SummaryWorkerService, CandidateAccessGuard],
})
export class CandidatesModule {}
