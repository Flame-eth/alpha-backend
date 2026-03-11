import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { QueueService } from '../queue/queue.service';
import { CandidatesService } from './candidates.service';

describe('CandidatesService', () => {
  let service: CandidatesService;

  const documentRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const summaryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const queueService = {
    enqueue: jest.fn(),
    registerProcessor: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidatesService,
        {
          provide: getRepositoryToken(CandidateDocument),
          useValue: documentRepository,
        },
        {
          provide: getRepositoryToken(CandidateSummary),
          useValue: summaryRepository,
        },
        { provide: QueueService, useValue: queueService },
      ],
    }).compile();

    service = module.get<CandidatesService>(CandidatesService);
  });

  describe('uploadDocument', () => {
    it('creates and saves a document for a valid candidate', async () => {
      documentRepository.create.mockImplementation((v: unknown) => v);
      documentRepository.save.mockImplementation(async (v: unknown) => v);

      const result = await service.uploadDocument('candidate-1', {
        documentType: 'resume',
        fileName: 'resume.pdf',
        rawText: 'Software engineer with 5 years experience.',
      });

      expect(documentRepository.create).toHaveBeenCalled();
      expect(result).toMatchObject({
        candidateId: 'candidate-1',
        documentType: 'resume',
        fileName: 'resume.pdf',
        rawText: 'Software engineer with 5 years experience.',
      });
    });
  });

  describe('requestSummary', () => {
    it('creates a pending summary and enqueues a job', async () => {
      const summaryRecord = {
        id: 'summary-1',
        candidateId: 'candidate-1',
        status: 'pending',
      };
      summaryRepository.create.mockReturnValue(summaryRecord);
      summaryRepository.save.mockResolvedValue(summaryRecord);
      queueService.enqueue.mockReturnValue({
        id: 'job-1',
        name: 'generate-summary',
        payload: {},
        enqueuedAt: new Date().toISOString(),
      });

      const result = await service.requestSummary('candidate-1');

      expect(summaryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId: 'candidate-1',
          status: 'pending',
        }),
      );
      expect(queueService.enqueue).toHaveBeenCalledWith('generate-summary', {
        summaryId: 'summary-1',
      });
      expect(result).toMatchObject({
        summaryId: 'summary-1',
        status: 'pending',
      });
    });
  });

  describe('listSummaries', () => {
    it('returns summaries for a valid candidate', async () => {
      summaryRepository.find.mockResolvedValue([
        { id: 'summary-1', candidateId: 'candidate-1' },
      ]);

      const result = await service.listSummaries('candidate-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('summary-1');
    });
  });

  describe('getSummary', () => {
    it('returns a summary by id', async () => {
      summaryRepository.findOne.mockResolvedValue({
        id: 'summary-1',
        candidateId: 'candidate-1',
      });

      const result = await service.getSummary('candidate-1', 'summary-1');

      expect(result.id).toBe('summary-1');
    });

    it('throws NotFoundException when summary does not exist', async () => {
      summaryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getSummary('candidate-1', 'no-such-summary'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
