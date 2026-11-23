import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { CapabilityService as PlatformCapabilityService } from '@lark-apaas/fullstack-nestjs-core';
import { throwAiError } from '@server/common/utils/ai-error';

const TEXT_GENERATE_ID = 'geo_text_generate_1';
const IMAGE_GENERATE_ID = 'geo_image_generate_1';

@Injectable()
export class CapabilityService {
  private readonly logger = new Logger(CapabilityService.name);

  constructor(
    @Inject(PlatformCapabilityService)
    private readonly platformCapabilityService: PlatformCapabilityService,
  ) {}

  async generateText(params: {
    content_topic: string;
    content_type: string;
    word_count?: string;
    additional_requirements?: string;
    target_audience?: string;
  }): Promise<string> {
    try {
      const result = await this.platformCapabilityService
        .load(TEXT_GENERATE_ID)
        .call('textGenerate', params);

      const resultObj = result as { content?: string; response?: string };
      return resultObj.content ?? resultObj.response ?? '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('文本生成插件调用失败', msg);
      throwAiError('AI 文本生成失败', msg);
    }
  }

  async generateTextStream(
    params: {
      content_topic: string;
      content_type: string;
      word_count?: string;
      additional_requirements?: string;
    },
    onChunk: (text: string) => void,
  ): Promise<string> {
    try {
      let fullText = '';
      const stream = this.platformCapabilityService
        .load(TEXT_GENERATE_ID)
        .callStream('textGenerate', params);
      for await (const chunk of stream) {
        const chunkObj = chunk as { content?: string };
        const text = chunkObj.content ?? '';
        if (text) {
          fullText += text;
          onChunk(text);
        }
      }
      return fullText;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('文本生成流式调用失败', msg);
      throwAiError('AI 文本生成失败', msg);
    }
  }

  async generateImage(params: {
    image_subject: string;
    image_type: string;
    style_requirements?: string;
    ratio?: string;
  }): Promise<string[]> {
    try {
      const result = await this.platformCapabilityService
        .load(IMAGE_GENERATE_ID)
        .call('textToImage', params);

      const resultObj = result as { images?: string[] };
      const images = resultObj.images ?? [];
      if (images.length === 0) {
        throw new BadRequestException('图片生成未返回有效结果');
      }
      return images;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('图片生成插件调用失败', msg);
      throwAiError('AI 图片生成失败', msg);
    }
  }

  async call(capabilityId: string, params: Record<string, unknown>): Promise<unknown> {
    if (capabilityId === TEXT_GENERATE_ID) {
      return this.generateText(params as {
        content_topic: string;
        content_type: string;
        word_count?: string;
        additional_requirements?: string;
      });
    }
    if (capabilityId === IMAGE_GENERATE_ID) {
      const urls = await this.generateImage(params as {
        image_subject: string;
        image_type: string;
        style_requirements?: string;
        ratio?: string;
      });
      return {
        images: urls.map((url: string, idx: number) => ({
          id: `img_${Date.now()}_${idx}`,
          url,
        })),
      };
    }
    throw new BadRequestException(`未知插件实例: ${capabilityId}`);
  }
}
