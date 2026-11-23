import { BadRequestException } from '@nestjs/common';
import { BusinessException } from '../interfaces/exception.interface';
import { ResponseCode } from '../constants/api_response_code';

const QUOTA_KEYWORDS = [
  '额度',
  'quota',
  'rate limit',
  'rate_limit',
  'insufficient',
  '用尽',
  '用完',
  '不足',
  '超限',
  'throttl',
  '429',
  'exhaust',
  'limit exceed',
];

export function isAiQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return QUOTA_KEYWORDS.some((keyword: string) => lower.includes(keyword));
}

export function throwAiError(prefix: string, message: string): never {
  if (isAiQuotaError(message)) {
    throw new BusinessException(
      ResponseCode.AI_QUOTA_EXHAUSTED,
      'AI 能力暂不可用，请稍后重试',
      503,
      message,
    );
  }
  throw new BadRequestException(`${prefix}：${message}`);
}
