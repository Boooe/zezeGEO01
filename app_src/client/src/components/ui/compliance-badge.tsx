import React from 'react';
import { Badge } from '@client/src/components/ui/badge';
import type { ComplianceRiskLevel } from '@shared/api.interface';
import { COMPLIANCE_RISK_LABELS } from '@shared/api.interface';

interface ComplianceBadgeProps {
  level: ComplianceRiskLevel;
  count?: number;
}

const levelStyle: Record<
  ComplianceRiskLevel,
  { bg: string; color: string; border: string }
> = {
  pass: {
    bg: 'rgba(23, 201, 100, 0.1)',
    color: '#17C964',
    border: '1px solid rgba(23, 201, 100, 0.2)',
  },
  warn: {
    bg: 'rgba(255, 169, 64, 0.1)',
    color: '#FFA940',
    border: '1px solid rgba(255, 169, 64, 0.2)',
  },
  block: {
    bg: 'rgba(255, 92, 92, 0.1)',
    color: '#FF5C5C',
    border: '1px solid rgba(255, 92, 92, 0.2)',
  },
};

export const ComplianceBadge: React.FC<ComplianceBadgeProps> = ({
  level,
  count,
}) => {
  const style = levelStyle[level];
  const label = COMPLIANCE_RISK_LABELS?.[level] ?? level;
  return (
    <Badge
      variant="outline"
      style={{
        backgroundColor: style.bg,
        color: style.color,
        border: style.border,
      }}
    >
      {label}
      {count != null && count > 0 ? ` · ${count}` : ''}
    </Badge>
  );
};

export default ComplianceBadge;
