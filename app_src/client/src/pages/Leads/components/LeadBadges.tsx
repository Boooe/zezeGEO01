import React from 'react';
import { Pill } from '@client/src/components/layout/Pill';
import {
  LEAD_STAGE_LABELS,
  INTENT_LEVEL_LABELS,
  type LeadStage,
  type IntentLevel,
} from '@shared/api.interface';

const STAGE_VARIANT: Record<LeadStage, 'muted' | 'info' | 'warning' | 'success'> = {
  pending: 'muted',
  contacted: 'info',
  quoted: 'warning',
  signed: 'success',
  shelved: 'muted',
};

const INTENT_VARIANT: Record<IntentLevel, 'danger' | 'warning' | 'muted'> = {
  high: 'danger',
  medium: 'warning',
  low: 'muted',
};

export const StageBadge: React.FC<{ stage: LeadStage }> = ({ stage }) => {
  const variant = STAGE_VARIANT[stage];
  return (
    <Pill variant={variant}>
      {LEAD_STAGE_LABELS[stage]}
    </Pill>
  );
};

export const IntentBadge: React.FC<{ level: IntentLevel }> = ({ level }) => {
  const variant = INTENT_VARIANT[level];
  return (
    <Pill variant={variant}>
      {INTENT_LEVEL_LABELS[level]}
    </Pill>
  );
};
