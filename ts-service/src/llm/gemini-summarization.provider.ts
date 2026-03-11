import { GoogleGenAI, Schema, Type } from '@google/genai';

import {
  CandidateSummaryInput,
  CandidateSummaryResult,
  RecommendedDecision,
  SummarizationProvider,
} from './summarization-provider.interface';

export const PROMPT_VERSION = 'v1';

const VALID_DECISIONS = new Set<string>(['advance', 'hold', 'reject']);

const summaryResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.INTEGER,
      description: 'Candidate score from 0 to 100',
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of candidate strengths',
    },
    concerns: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of concerns or gaps about the candidate',
    },
    summary: {
      type: Type.STRING,
      description: 'A concise narrative summary of the candidate',
    },
    recommendedDecision: {
      type: Type.STRING,
      format: 'enum',
      enum: ['advance', 'hold', 'reject'],
      description: 'Hiring recommendation',
    },
  },
  required: [
    'score',
    'strengths',
    'concerns',
    'summary',
    'recommendedDecision',
  ],
};

export class GeminiSummarizationProvider implements SummarizationProvider {
  private readonly client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateCandidateSummary(
    input: CandidateSummaryInput,
  ): Promise<CandidateSummaryResult> {
    const documentsText = input.documents
      .map((doc, i) => `--- Document ${i + 1} ---\n${doc}`)
      .join('\n\n');

    const prompt = `You are an expert technical recruiter. Evaluate the following candidate documents and provide a structured assessment.

Candidate ID: ${input.candidateId}

${documentsText}

Provide your evaluation as JSON with:
- score: integer from 0-100 representing overall candidate quality
- strengths: array of strings describing candidate strengths
- concerns: array of strings describing gaps or concerns
- summary: a concise paragraph summarizing the candidate
- recommendedDecision: one of "advance", "hold", or "reject"`;

    const response = await this.client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: summaryResponseSchema,
      },
    });

    return this.parseAndValidate(response.text ?? '');
  }

  private parseAndValidate(raw: string): CandidateSummaryResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`LLM returned non-JSON response: ${raw.slice(0, 200)}`);
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('LLM response is not a JSON object');
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj['score'] !== 'number' || !Number.isInteger(obj['score'])) {
      throw new Error('LLM response missing valid "score" field');
    }
    if (
      !Array.isArray(obj['strengths']) ||
      !obj['strengths'].every((s) => typeof s === 'string')
    ) {
      throw new Error('LLM response missing valid "strengths" array');
    }
    if (
      !Array.isArray(obj['concerns']) ||
      !obj['concerns'].every((c) => typeof c === 'string')
    ) {
      throw new Error('LLM response missing valid "concerns" array');
    }
    if (typeof obj['summary'] !== 'string') {
      throw new Error('LLM response missing valid "summary" field');
    }
    if (
      typeof obj['recommendedDecision'] !== 'string' ||
      !VALID_DECISIONS.has(obj['recommendedDecision'])
    ) {
      throw new Error(
        `LLM response has invalid "recommendedDecision": ${String(obj['recommendedDecision'])}`,
      );
    }

    return {
      score: obj['score'] as number,
      strengths: obj['strengths'] as string[],
      concerns: obj['concerns'] as string[],
      summary: obj['summary'] as string,
      recommendedDecision: obj['recommendedDecision'] as RecommendedDecision,
    };
  }
}
