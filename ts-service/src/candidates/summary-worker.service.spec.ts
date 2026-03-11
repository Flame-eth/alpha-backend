import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { FakeSummarizationProvider } from '../llm/fake-summarization.provider';
import { SUMMARIZATION_PROVIDER } from '../llm/summarization-provider.interface';
import { QueueService } from '../queue/queue.service';
import { SummaryWorkerService } from './summary-worker.service';

describe('SummaryWorkerService', () => {
  let service: SummaryWorkerService;

  const documentRepository = {
    find: jest.fn(),
  };

  const summaryRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const queueService = {
    registerProcessor: jest.fn(),
    enqueue: jest.fn(),
    getQueuedJobs: jest.fn(),
  };

  const fakeSummaryRecord = {
    id: 'summary-1',
    candidateId: 'candidate-1',
    status: 'pending',
    score: null,
    strengths: null,
    concerns: null,
    summary: null,
    recommendedDecision: null,
    provider: null,
    promptVersion: null,
    errorMessage: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummaryWorkerService,
        {
          provide: getRepositoryToken(CandidateDocument),
          useValue: documentRepository,
        },
        {
          provide: getRepositoryToken(CandidateSummary),
          useValue: summaryRepository,
        },
        {
          provide: SUMMARIZATION_PROVIDER,
          useClass: FakeSummarizationProvider,
        },
        { provide: QueueService, useValue: queueService },
      ],
    }).compile();

    service = module.get<SummaryWorkerService>(SummaryWorkerService);
  });

  it('registers a processor on module init', () => {
    service.onModuleInit();
    expect(queueService.registerProcessor).toHaveBeenCalledWith(
      'generate-summary',
      expect.any(Function),
    );
  });

  it('marks summary as completed on successful LLM call', async () => {
    summaryRepository.findOne.mockResolvedValue(fakeSummaryRecord);
    documentRepository.find.mockResolvedValue([
      { rawText: 'Experienced software engineer with TypeScript skills.' },
    ]);
    summaryRepository.save.mockImplementation(async (v: unknown) => v);

    service.onModuleInit();

    const registeredHandler = queueService.registerProcessor.mock
      .calls[0][1] as (payload: { summaryId: string }) => Promise<void>;

    await registeredHandler({ summaryId: 'summary-1' });

    expect(summaryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        score: expect.any(Number),
        strengths: expect.any(Array),
        concerns: expect.any(Array),
        summary: expect.any(String),
        recommendedDecision: expect.stringMatching(/^(advance|hold|reject)$/),
      }),
    );
  });

  it('marks summary as failed when LLM throws', async () => {
    summaryRepository.findOne.mockResolvedValue(fakeSummaryRecord);
    documentRepository.find.mockResolvedValue([{ rawText: 'Some document' }]);

    const failingProvider = {
      generateCandidateSummary: jest
        .fn()
        .mockRejectedValue(new Error('LLM unavailable')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummaryWorkerService,
        {
          provide: getRepositoryToken(CandidateDocument),
          useValue: documentRepository,
        },
        {
          provide: getRepositoryToken(CandidateSummary),
          useValue: summaryRepository,
        },
        { provide: SUMMARIZATION_PROVIDER, useValue: failingProvider },
        { provide: QueueService, useValue: queueService },
      ],
    }).compile();

    const failService = module.get<SummaryWorkerService>(SummaryWorkerService);
    failService.onModuleInit();

    summaryRepository.save.mockImplementation(async (v: unknown) => v);

    const handler = queueService.registerProcessor.mock.calls[
      queueService.registerProcessor.mock.calls.length - 1
    ][1] as (payload: { summaryId: string }) => Promise<void>;

    await handler({ summaryId: 'summary-1' });

    expect(summaryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'LLM unavailable',
      }),
    );
  });

  it('logs a warning and returns when summary is not found', async () => {
    summaryRepository.findOne.mockResolvedValue(null);

    service.onModuleInit();
    const handler = queueService.registerProcessor.mock
      .calls[0][1] as (payload: { summaryId: string }) => Promise<void>;

    await expect(
      handler({ summaryId: 'no-such-summary' }),
    ).resolves.toBeUndefined();
    expect(summaryRepository.save).not.toHaveBeenCalled();
  });
});
