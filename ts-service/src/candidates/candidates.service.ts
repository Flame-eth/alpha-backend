import { randomUUID } from 'crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { QueueService } from '../queue/queue.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

export interface GenerateSummaryJobPayload {
  summaryId: string;
}

@Injectable()
export class CandidatesService {
  constructor(
    @InjectRepository(CandidateDocument)
    private readonly documentRepository: Repository<CandidateDocument>,
    @InjectRepository(CandidateSummary)
    private readonly summaryRepository: Repository<CandidateSummary>,
    private readonly queueService: QueueService,
  ) {}

  async uploadDocument(
    candidateId: string,
    dto: UploadDocumentDto,
  ): Promise<CandidateDocument> {
    const document = this.documentRepository.create({
      id: randomUUID(),
      candidateId,
      documentType: dto.documentType,
      fileName: dto.fileName,
      storageKey: `local/${candidateId}/${randomUUID()}-${dto.fileName}`,
      rawText: dto.rawText,
    });

    return this.documentRepository.save(document);
  }

  async requestSummary(
    candidateId: string,
  ): Promise<{ jobId: string; summaryId: string; status: string }> {
    const now = new Date();
    const summary = this.summaryRepository.create({
      id: randomUUID(),
      candidateId,
      status: 'pending',
      score: null,
      strengths: null,
      concerns: null,
      summary: null,
      recommendedDecision: null,
      provider: null,
      promptVersion: null,
      errorMessage: null,
      updatedAt: now,
    });

    await this.summaryRepository.save(summary);

    const job = this.queueService.enqueue<GenerateSummaryJobPayload>(
      'generate-summary',
      {
        summaryId: summary.id,
      },
    );

    return { jobId: job.id, summaryId: summary.id, status: summary.status };
  }

  async listSummaries(candidateId: string): Promise<CandidateSummary[]> {
    return this.summaryRepository.find({
      where: { candidateId },
      order: { createdAt: 'DESC' },
    });
  }

  async getSummary(
    candidateId: string,
    summaryId: string,
  ): Promise<CandidateSummary> {
    const summary = await this.summaryRepository.findOne({
      where: { id: summaryId, candidateId },
    });

    if (!summary) {
      throw new NotFoundException(`Summary not found`);
    }

    return summary;
  }
}
