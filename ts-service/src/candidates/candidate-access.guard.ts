import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';

import { AuthUser } from '../auth/auth.types';
import { SampleCandidate } from '../entities/sample-candidate.entity';

@Injectable()
export class CandidateAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(SampleCandidate)
    private readonly candidateRepository: Repository<SampleCandidate>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser;
    const candidateId = request.params['candidateId'] as string;

    const candidate = await this.candidateRepository.findOne({
      where: { id: candidateId, workspaceId: user.workspaceId },
    });

    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    return true;
  }
}
