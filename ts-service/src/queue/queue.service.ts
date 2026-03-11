import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';

export interface EnqueuedJob<TPayload = unknown> {
  id: string;
  name: string;
  payload: TPayload;
  enqueuedAt: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly jobs: EnqueuedJob[] = [];
  private readonly processors = new Map<
    string,
    (payload: unknown) => Promise<void>
  >();

  enqueue<TPayload>(name: string, payload: TPayload): EnqueuedJob<TPayload> {
    const job: EnqueuedJob<TPayload> = {
      id: randomUUID(),
      name,
      payload,
      enqueuedAt: new Date().toISOString(),
    };

    this.jobs.push(job);

    const processor = this.processors.get(name);
    if (processor) {
      processor(payload as unknown).catch((err: unknown) => {
        this.logger.error(`Processor for job "${name}" failed: ${String(err)}`);
      });
    }

    return job;
  }

  registerProcessor<TPayload>(
    name: string,
    handler: (payload: TPayload) => Promise<void>,
  ): void {
    this.processors.set(name, handler as (payload: unknown) => Promise<void>);
  }

  getQueuedJobs(): readonly EnqueuedJob[] {
    return this.jobs;
  }
}
