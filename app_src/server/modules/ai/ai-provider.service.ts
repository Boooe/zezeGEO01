import { Injectable, Logger } from '@nestjs/common';

export type AiProvider = 'platform' | 'deepseek' | 'dashscope' | 'ark';

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private readonly provider: AiProvider;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    this.provider = (process.env.AI_PROVIDER as AiProvider) || 'platform';
    this.apiKey = process.env.AI_API_KEY || '';
    this.baseUrl = process.env.AI_BASE_URL || '';
    this.model = process.env.AI_MODEL || '';
  }

  isPlatform(): boolean {
    return this.provider === 'platform' || !this.apiKey;
  }

  getProvider(): AiProvider {
    return this.isPlatform() ? 'platform' : this.provider;
  }

  getModel(defaultModel: string): string {
    return this.model || defaultModel;
  }

  async chatCompletion(
    messages: AiChatMessage[],
    options: AiChatOptions = {},
  ): Promise<string> {
    const provider = this.getProvider();
    if (provider === 'platform') {
      throw new Error('Platform provider should use CapabilityService instead');
    }

    const url = this.resolveChatUrl(provider);
    const model = options.model || this.model || this.defaultModel(provider);

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (provider === 'ark') {
      headers['x-api-source'] = 'mcp';
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      const data = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string; code?: string };
      };

      if (!res.ok) {
        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      const content = data?.choices?.[0]?.message?.content ?? '';
      return content;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI chat completion failed (${provider}): ${msg}`);
      throw err;
    }
  }

  private resolveChatUrl(provider: AiProvider): string {
    if (this.baseUrl) {
      return this.baseUrl.endsWith('/chat/completions')
        ? this.baseUrl
        : `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    }
    switch (provider) {
      case 'deepseek':
        return 'https://api.deepseek.com/chat/completions';
      case 'dashscope':
        return 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      case 'ark':
        return 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private defaultModel(provider: AiProvider): string {
    switch (provider) {
      case 'deepseek':
        return 'deepseek-chat';
      case 'dashscope':
        return 'qwen-plus';
      case 'ark':
        return 'doubao-1-5-pro-32k-250115';
      default:
        return '';
    }
  }
}
