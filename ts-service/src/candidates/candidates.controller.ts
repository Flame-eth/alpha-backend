import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { FakeAuthGuard } from '../auth/fake-auth.guard';
import { CandidateDocument } from '../entities/candidate-document.entity';
import { CandidateSummary } from '../entities/candidate-summary.entity';
import { CandidateAccessGuard } from './candidate-access.guard';
import { CandidatesService } from './candidates.service';
import { GenerateSummaryResponseDto } from './dto/generate-summary-response.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@ApiTags('Candidates')
@ApiSecurity('x-user-id')
@ApiSecurity('x-workspace-id')
@ApiUnauthorizedResponse({
  description: 'Missing x-user-id or x-workspace-id headers',
})
@Controller('candidates')
@UseGuards(FakeAuthGuard, CandidateAccessGuard)
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post(':candidateId/documents')
  @ApiOperation({ summary: 'Upload a candidate document' })
  @ApiParam({ name: 'candidateId', description: 'ID of the candidate' })
  @ApiResponse({
    status: 201,
    description: 'Document uploaded',
    type: CandidateDocument,
  })
  @ApiNotFoundResponse({
    description: 'Candidate not found or does not belong to your workspace',
  })
  async uploadDocument(
    @Param('candidateId') candidateId: string,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.candidatesService.uploadDocument(candidateId, dto);
  }

  @Post(':candidateId/summaries/generate')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Request async summary generation',
    description:
      'Enqueues a background job to generate a structured LLM summary for the candidate. ' +
      'Returns immediately with a pending summary ID. Poll GET summaries/:summaryId to check status.',
  })
  @ApiParam({ name: 'candidateId', description: 'ID of the candidate' })
  @ApiResponse({
    status: 202,
    description: 'Summary generation accepted',
    type: GenerateSummaryResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Candidate not found or does not belong to your workspace',
  })
  async requestSummary(@Param('candidateId') candidateId: string) {
    return this.candidatesService.requestSummary(candidateId);
  }

  @Get(':candidateId/summaries')
  @ApiOperation({ summary: 'List all summaries for a candidate' })
  @ApiParam({ name: 'candidateId', description: 'ID of the candidate' })
  @ApiResponse({
    status: 200,
    description: 'List of summaries',
    type: [CandidateSummary],
  })
  @ApiNotFoundResponse({
    description: 'Candidate not found or does not belong to your workspace',
  })
  async listSummaries(@Param('candidateId') candidateId: string) {
    return this.candidatesService.listSummaries(candidateId);
  }

  @Get(':candidateId/summaries/:summaryId')
  @ApiOperation({ summary: 'Get a single summary' })
  @ApiParam({ name: 'candidateId', description: 'ID of the candidate' })
  @ApiParam({ name: 'summaryId', description: 'ID of the summary' })
  @ApiResponse({
    status: 200,
    description: 'The summary record',
    type: CandidateSummary,
  })
  @ApiNotFoundResponse({ description: 'Candidate or summary not found' })
  async getSummary(
    @Param('candidateId') candidateId: string,
    @Param('summaryId') summaryId: string,
  ) {
    return this.candidatesService.getSummary(candidateId, summaryId);
  }
}
