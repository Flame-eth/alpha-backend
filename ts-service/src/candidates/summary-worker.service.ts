import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { PROMPT_VERSION } from '../llm/gemini-summarization.provider';
import {
  SUMMARIZATION_PROVIDER,
  SummarizationProvider,
} from '../llm/summarization-provider.interface';
import { QueueService } from '../queue/queue.service';
import { GenerateSummaryJobPayload } from './candidates.service';

@Injectable()
export class SummaryWorkerService implements OnModuleInit {
  private readonly logger = new Logger(SummaryWorkerService.name);

  constructor(
    @InjectRepository(CandidateDocument)
    private readonly documentRepository: Repository<CandidateDocument>,
    @InjectRepository(CandidateSummary)
    private readonly summaryRepository: Repository<CandidateSummary>,
    @Inject(SUMMARIZATION_PROVIDER)
    private readonly summarizationProvider: SummarizationProvider,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit(): void {
    this.queueService.registerProcessor<GenerateSummaryJobPayload>(
      'generate-summary',
      (payload) => this.process(payload),
    );
  }

  private async process(payload: GenerateSummaryJobPayload): Promise<void> {
    const { summaryId } = payload;

    const summary = await this.summaryRepository.findOne({
      where: { id: summaryId },
    });
    if (!summary) {
      this.logger.warn(
        `Summary job received for unknown summaryId: ${summaryId}`,
      );
      return;
    }

    const documents = await this.documentRepository.find({
      where: { candidateId: summary.candidateId },
    });

    try {
      const result = await this.summarizationProvider.generateCandidateSummary({
        candidateId: summary.candidateId,
        documents: documents.map((d) => d.rawText),
      });

      const provider = this.summarizationProvider.constructor.name.includes(
        'Gemini',
      )
        ? 'gemini'
        : 'fake';

      await this.summaryRepository.save({
        ...summary,
        status: 'completed',
        score: result.score,
        strengths: result.strengths,
        concerns: result.concerns,
        summary: result.summary,
        recommendedDecision: result.recommendedDecision,
        provider,
        promptVersion: PROMPT_VERSION,
        errorMessage: null,
        updatedAt: new Date(),
      });

      this.logger.log(`Summary ${summaryId} completed successfully`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Summary ${summaryId} failed: ${message}`);

      await this.summaryRepository.save({
        ...summary,
        status: 'failed',
        errorMessage: message,
        updatedAt: new Date(),
      });
    }
  }
}
