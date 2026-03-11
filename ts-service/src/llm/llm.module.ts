import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { FakeSummarizationProvider } from './fake-summarization.provider';
import { GeminiSummarizationProvider } from './gemini-summarization.provider';
import { SUMMARIZATION_PROVIDER } from './summarization-provider.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    FakeSummarizationProvider,
    {
      provide: SUMMARIZATION_PROVIDER,
      inject: [ConfigService, FakeSummarizationProvider],
      useFactory: (
        configService: ConfigService,
        fake: FakeSummarizationProvider,
      ) => {
        const apiKey = configService.get<string>('GEMINI_API_KEY');
        if (apiKey) {
          return new GeminiSummarizationProvider(apiKey);
        }
        return fake;
      },
    },
  ],
  exports: [SUMMARIZATION_PROVIDER, FakeSummarizationProvider],
})
export class LlmModule {}
