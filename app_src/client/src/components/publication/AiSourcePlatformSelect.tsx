import React from 'react';
import {
  SUBMISSION_AI_SOURCES,
  SUBMISSION_AI_SOURCE_LABELS,
} from '@shared/api.interface';
import type { SubmissionAiSource } from '@shared/api.interface';
import { Badge } from '@client/src/components/ui/badge';

const PRIMARY = '#2E7DFF';

// 已接入 API Key 的平台（高亮显示）
export const CONNECTED_AI_PLATFORMS: SubmissionAiSource[] = ['doubao', 'kimi'];

interface AiSourcePlatformSelectProps {
  selected: SubmissionAiSource[];
  onChange: (platforms: SubmissionAiSource[]) => void;
  size?: 'sm' | 'md';
}

/**
 * AI 信源平台多选组件
 * 已接入 Key 的平台用主色高亮，未接入的置灰但仍可选
 */
export const AiSourcePlatformSelect: React.FC<AiSourcePlatformSelectProps> = ({
  selected,
  onChange,
  size = 'md',
}) => {
  const toggle = (p: SubmissionAiSource) => {
    if (selected.includes(p)) {
      onChange(selected.filter((x) => x !== p));
    } else {
      onChange([...selected, p]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {SUBMISSION_AI_SOURCES.map((p) => {
        const isSelected = selected.includes(p);
        const isConnected = CONNECTED_AI_PLATFORMS.includes(p);
        return (
          <button
            key={p}
            type="button"
            onClick={() => toggle(p)}
            className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs transition-colors ${
              size === 'sm' ? 'px-2 py-0.5 text-[11px]' : ''
            }`}
            style={{
              borderColor: isSelected ? PRIMARY : '#E5E9F2',
              backgroundColor: isSelected ? PRIMARY : '#fff',
              color: isSelected ? '#fff' : '#0f172a',
              fontWeight: isSelected ? 500 : 400,
              cursor: 'pointer',
            }}
          >
            {SUBMISSION_AI_SOURCE_LABELS[p]}
            {!isConnected && (
              <span
                className="ml-1"
                style={{ color: '#94a3b8', fontSize: '10px', lineHeight: 1 }}
              >
                未接入
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export const AiPlatformBadges: React.FC<{ platforms?: string[] | null }> = ({
  platforms,
}) => {
  if (!platforms || platforms.length === 0) {
    return <span style={{ color: '#94A3B8' }}>—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {platforms.map((p) => (
        <Badge
          key={p}
          variant="outline"
          className="text-[11px] h-5 border-0"
          style={{
            backgroundColor: 'rgba(46, 125, 255, 0.08)',
            color: PRIMARY,
          }}
        >
          {SUBMISSION_AI_SOURCE_LABELS[p as SubmissionAiSource] || p}
        </Badge>
      ))}
    </div>
  );
};
