import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { FakeAuthGuard } from '../auth/fake-auth.guard';
import { CreateSampleCandidateDto } from './dto/create-sample-candidate.dto';
import { SampleService } from './sample.service';

@ApiTags('Sample')
@ApiSecurity('x-user-id')
@ApiSecurity('x-workspace-id')
@ApiUnauthorizedResponse({
  description: 'Missing x-user-id or x-workspace-id headers',
})
@Controller('sample')
@UseGuards(FakeAuthGuard)
export class SampleController {
  constructor(private readonly sampleService: SampleService) {}

  @Post('candidates')
  @ApiOperation({ summary: 'Create a candidate in the current workspace' })
  @ApiResponse({ status: 201, description: 'Candidate created' })
  async createCandidate(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSampleCandidateDto,
  ) {
    return this.sampleService.createCandidate(user, dto);
  }

  @Get('candidates')
  @ApiOperation({ summary: 'List all candidates in the current workspace' })
  @ApiResponse({ status: 200, description: 'Array of candidates' })
  async listCandidates(@CurrentUser() user: AuthUser) {
    return this.sampleService.listCandidates(user);
  }
}
