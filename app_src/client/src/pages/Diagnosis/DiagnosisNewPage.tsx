import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@client/src/components/ui/button';
import {
  ArrowRight,
  Search,
  BarChart3,
  Lightbulb,
  Zap,
} from 'lucide-react';
import { SectionCard } from '@client/src/components/layout/SectionCard';

const PRIMARY = '#2E7DFF';
const ACCENT = '#10B981';

const DiagnosisNewPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="新建诊断">
        {/* ===== Hero 横幅 ===== */}
        <div
          className="relative overflow-hidden text-center"
          style={{
            borderRadius: '12px',
            height: '240px',
            background: 'linear-gradient(135deg, #EFF4FF 0%, #E0F2FE 50%, #EFF4FF 100%)',
          }}
        >
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
            <span
              className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: 'rgba(46, 125, 255, 0.1)',
                color: PRIMARY,
              }}
            >
              <Zap className="h-3.5 w-3.5" />
              品牌 AI 搜索诊断
            </span>
            <h2
              className="text-center font-semibold leading-tight"
              style={{
                fontSize: '28px',
                color: '#0f172a',
                lineHeight: '36px',
              }}
            >
              AI 时代，对你的品牌做一次搜索诊断
            </h2>
            <p
              className="mt-3 max-w-xl text-center text-[13px] leading-relaxed"
              style={{ color: '#64748B' }}
            >
              输入品牌和主营品类，系统会到豆包、通义千问、腾讯元宝、DeepSeek、Kimi、文心一言逐个提问，测出你的品牌被提及的比例与推荐顺位。
            </p>
            <Button
              type="button"
              className="mt-5 h-9 px-5 text-sm font-medium"
              style={{ backgroundColor: PRIMARY, borderRadius: '8px' }}
              onClick={() => navigate('/diagnosis/new/create')}
            >
              开始诊断
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ===== 能力介绍 ===== */}
        <div className="mt-8 text-center">
          <h3
            className="text-center font-semibold"
            style={{ fontSize: '18px', color: '#0f172a' }}
          >
            星河GEO 品牌 AI 搜索诊断能力
          </h3>
          <p className="mt-2 text-[13px]" style={{ color: '#64748B' }}>
            从诊断到执行，形成完整优化闭环
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 卡 1：AI 可见度评分 */}
          <div
            className="rounded-[12px] border p-5 bg-white"
            style={{ borderColor: '#E6EAF2', boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.10)' }}
          >
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'rgba(46, 125, 255, 0.1)' }}
            >
              <Search className="h-5 w-5" style={{ color: PRIMARY }} />
            </div>
            <h4 className="text-[15px] font-semibold" style={{ color: '#0f172a' }}>
              AI 可见度评分
            </h4>
            <p
              className="mt-2 text-[13px] leading-relaxed"
              style={{ color: '#64748B' }}
            >
              六个 AI 平台逐词真实提问，统计品牌被提及的比例与出现顺位，不做估算。
            </p>
          </div>

          {/* 卡 2：竞品差距对比 */}
          <div
            className="rounded-[12px] border p-5 bg-white"
            style={{ borderColor: '#E6EAF2', boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.10)' }}
          >
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
            >
              <BarChart3 className="h-5 w-5" style={{ color: ACCENT }} />
            </div>
            <h4 className="text-[15px] font-semibold" style={{ color: '#0f172a' }}>
              竞品差距对比
            </h4>
            <p
              className="mt-2 text-[13px] leading-relaxed"
              style={{ color: '#64748B' }}
            >
              同城同品类竞品同题作答，直接看出你在哪些问题上被对手盖过。
            </p>
          </div>

          {/* 卡 3：优化任务驱动 */}
          <div
            className="rounded-[12px] border p-5 bg-white"
            style={{ borderColor: '#E6EAF2', boxShadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.10)' }}
          >
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
            >
              <Lightbulb className="h-5 w-5" style={{ color: '#F59E0B' }} />
            </div>
            <h4 className="text-[15px] font-semibold" style={{ color: '#0f172a' }}>
              优化任务驱动
            </h4>
            <p
              className="mt-2 text-[13px] leading-relaxed"
              style={{ color: '#64748B' }}
            >
              诊断结论会写明该补哪些关键词、哪些内容方向，可直接到词灵感与创作中心执行。
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

export default DiagnosisNewPage;
