import {
  Injectable,
  Inject,
  Logger,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';

import { geoComplianceChecks } from '@server/database/schema';
import type {
  ComplianceCheckResponse,
  ComplianceCheckHit,
  ComplianceRiskLevel,
  UserRole,
} from '@shared/api.interface';
import { ComplianceCheckDto } from './dto/compliance.dto';

interface GeoUserCtx {
  id: string;
  role: UserRole;
  brandId: string | null;
}

interface ComplianceRule {
  word: string;
  category: string;
  level: Exclude<ComplianceRiskLevel, 'pass'>;
  suggestion: string;
}

const BLOCK_WORDS: ComplianceRule[] = [
  // 广告法绝对化
  { word: '最', category: '广告法绝对化', level: 'block', suggestion: '避免使用绝对化用语，建议改为"较为""较为出色"等相对表述' },
  { word: '第一', category: '广告法绝对化', level: 'block', suggestion: '避免使用"第一"等绝对化排名表述，建议用数据或用户评价支撑' },
  { word: '顶级', category: '广告法绝对化', level: 'block', suggestion: '避免使用"顶级"等绝对化表述，建议改为"高品质""高端"' },
  { word: '唯一', category: '广告法绝对化', level: 'block', suggestion: '避免使用"唯一"等绝对化表述，建议改为"独特""独具特色"' },
  { word: '国家级', category: '广告法绝对化', level: 'block', suggestion: '禁止使用"国家级"表述，如确有资质请提供官方证明文件' },
  { word: '全网最低', category: '广告法绝对化', level: 'block', suggestion: '避免使用"全网最低"等绝对化价格表述' },
  { word: '100%有效', category: '广告法绝对化', level: 'block', suggestion: '避免使用"100%有效"等绝对化功效表述' },
  { word: '最好', category: '广告法绝对化', level: 'block', suggestion: '避免使用"最好"等绝对化表述，建议改为"优质""出色"' },
  { word: '最大', category: '广告法绝对化', level: 'block', suggestion: '避免使用"最大"等绝对化表述，建议用具体数据说明' },
  { word: '最强', category: '广告法绝对化', level: 'block', suggestion: '避免使用"最强"等绝对化表述，建议用具体参数说明' },
  { word: '最低价', category: '广告法绝对化', level: 'block', suggestion: '避免使用"最低价"等绝对化价格表述' },
  { word: '最优', category: '广告法绝对化', level: 'block', suggestion: '避免使用"最优"等绝对化表述' },
  { word: '独家', category: '广告法绝对化', level: 'block', suggestion: '使用"独家"需提供独家授权证明' },
  { word: '首选', category: '广告法绝对化', level: 'block', suggestion: '避免使用"首选"等绝对化表述' },
  { word: '极致', category: '广告法绝对化', level: 'block', suggestion: '避免使用"极致"等绝对化表述' },
  { word: '完美', category: '广告法绝对化', level: 'block', suggestion: '避免使用"完美"等绝对化表述' },
  // 医疗夸大
  { word: '根治', category: '医疗夸大', level: 'block', suggestion: '禁止使用"根治"等医疗夸大表述' },
  { word: '治愈', category: '医疗夸大', level: 'block', suggestion: '避免使用"治愈"等绝对化医疗表述，建议改为"有助于改善"' },
  { word: '无副作用', category: '医疗夸大', level: 'block', suggestion: '禁止宣称"无副作用"，请补充可能的不适说明' },
  { word: '包治', category: '医疗夸大', level: 'block', suggestion: '禁止使用"包治"等医疗夸大表述' },
  { word: '药到病除', category: '医疗夸大', level: 'block', suggestion: '禁止使用"药到病除"等医疗夸大表述' },
  { word: '永不复发', category: '医疗夸大', level: 'block', suggestion: '禁止使用"永不复发"等医疗绝对化表述' },
  { word: '100%治愈', category: '医疗夸大', level: 'block', suggestion: '禁止使用"100%治愈"等医疗绝对化表述' },
  // 金融承诺
  { word: '稳赚', category: '金融承诺', level: 'block', suggestion: '禁止使用"稳赚"等金融收益承诺表述' },
  { word: '保本', category: '金融承诺', level: 'block', suggestion: '使用"保本"需符合金融监管要求，建议加风险提示' },
  { word: '零风险', category: '金融承诺', level: 'block', suggestion: '禁止使用"零风险"等金融承诺表述' },
  { word: '包下款', category: '金融承诺', level: 'block', suggestion: '禁止使用"包下款"等金融承诺表述' },
  { word: '稳赚不赔', category: '金融承诺', level: 'block', suggestion: '禁止使用"稳赚不赔"等金融收益承诺表述' },
  { word: '高收益无风险', category: '金融承诺', level: 'block', suggestion: '禁止使用"高收益无风险"等金融承诺表述' },
];

const WARN_WORDS: ComplianceRule[] = [
  // 诱导虚假
  { word: '限时秒杀', category: '诱导虚假', level: 'warn', suggestion: '使用"限时秒杀"需明确活动时间和规则' },
  { word: '官方指定', category: '诱导虚假', level: 'warn', suggestion: '使用"官方指定"需提供官方授权证明' },
  { word: '最后一天', category: '诱导虚假', level: 'warn', suggestion: '使用"最后一天"需如实标注活动截止时间' },
  { word: '错过再等一年', category: '诱导虚假', level: 'warn', suggestion: '避免使用"错过再等一年"等制造焦虑的表述' },
  { word: '万人疯抢', category: '诱导虚假', level: 'warn', suggestion: '使用"万人疯抢"需提供真实数据支撑' },
];

const AI_DISCLAIMER_PHRASES = ['AI 辅助生成', 'AI生成', '本文由AI生成'];

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async check(dto: ComplianceCheckDto, user: GeoUserCtx): Promise<ComplianceCheckResponse> {
    const fullText = `${dto.title ?? ''}\n${dto.content}`;
    // 内部带 level 的命中记录，用于计算风险等级和落库
    const internalHits: Array<ComplianceCheckHit & { level?: string }> = [];

    const allRules = [...BLOCK_WORDS, ...WARN_WORDS];
    for (const rule of allRules) {
      // 逐个词匹配，每个命中位置单独记录
      let idx = 0;
      while (idx < fullText.length) {
        const found = fullText.indexOf(rule.word, idx);
        if (found === -1) break;
        internalHits.push({
          word: rule.word,
          category: rule.category,
          suggestion: rule.suggestion,
          position: found,
          level: rule.level,
        });
        idx = found + rule.word.length;
      }
    }

    // AI 生成标识检查：内容 > 800 字且不含 AI 标识短语时 warn
    const contentLength = dto.content.length;
    if (contentLength > 800) {
      const hasAIDisclaimer = AI_DISCLAIMER_PHRASES.some(
        (phrase) => dto.content.includes(phrase),
      );
      if (!hasAIDisclaimer) {
        internalHits.push({
          word: 'AI生成标识缺失',
          category: '内容规范',
          suggestion: '内容超过800字，建议添加"AI辅助生成"等标识说明',
          position: 0,
          level: 'warn',
        });
      }
    }

    // 计算风险等级
    let riskLevel: ComplianceRiskLevel = 'pass';
    if (internalHits.some((h) => h.level === 'block')) {
      riskLevel = 'block';
    } else if (internalHits.some((h) => h.level === 'warn')) {
      riskLevel = 'warn';
    }

    const totalHits = internalHits.length;

    // 落库
    const checkedAt = new Date();
    const inserted = await this.db.insert(geoComplianceChecks).values({
      brandId: dto.brandId ?? null,
      articleId: dto.articleId ?? null,
      title: dto.title ?? '',
      content: dto.content,
      riskLevel,
      hits: JSON.stringify(internalHits),
      totalHits,
      checkedAt,
      creatorId: user.id,
    }).returning({ id: geoComplianceChecks.id });

    // 返回时剥离 level 字段，符合 shared 接口契约
    const hits: ComplianceCheckHit[] = internalHits.map((h) => ({
      word: h.word,
      category: h.category,
      suggestion: h.suggestion,
      position: h.position,
    }));

    return {
      riskLevel,
      hits,
      totalHits,
      checkedAt: checkedAt.toISOString(),
      recordId: inserted[0]?.id,
    };
  }
}
