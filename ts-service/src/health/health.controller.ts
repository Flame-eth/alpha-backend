import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Service health check' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: { example: { status: 'ok' } },
  })
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
