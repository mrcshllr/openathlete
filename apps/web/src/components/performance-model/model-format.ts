import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';

import {
  PerformanceModelSlotDto,
  PerformanceModelsDto,
  TrainingFocus,
  formatSpeed,
  formatSpeedUnit,
} from '@openathlete/shared';

export type Measure = 'pace' | 'power';

export const formatPace = (speed: number) =>
  `${formatSpeed(speed, 'min/km')} ${formatSpeedUnit('min/km')}`;

const number = (value: number, digits = 0) =>
  new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: digits,
  }).format(value);

/** CS as a pace, CP in watts */
export const formatCritical = (measure: Measure, value: number) =>
  measure === 'pace' ? formatPace(value) : `${number(value)} W`;

/** D' in metres, W' in kilojoules */
export const formatReserve = (measure: Measure, value: number) =>
  measure === 'pace' ? `${number(value)} m` : `${number(value / 1000, 1)} kJ`;

export const formatPercent = (value: number, digits = 1) =>
  `${number(value, digits)} %`;

export const focusLabel: Record<TrainingFocus, () => string> = {
  LONG_RUNS: m.performance_focus_long_runs,
  THRESHOLD: m.performance_focus_threshold,
  SHORT_INTERVALS: m.performance_focus_short_intervals,
  BALANCED: m.performance_focus_balanced,
};

export const focusReason: Record<TrainingFocus, () => string> = {
  LONG_RUNS: m.performance_focus_long_runs_reason,
  THRESHOLD: m.performance_focus_threshold_reason,
  SHORT_INTERVALS: m.performance_focus_short_intervals_reason,
  BALANCED: m.performance_focus_balanced_reason,
};

export const runningSlot = (
  data: PerformanceModelsDto,
  measure: Measure,
): PerformanceModelSlotDto => data.running[measure];

/** Pace when it has bests, else power: most runners have no power meter */
export const defaultMeasure = (data: PerformanceModelsDto): Measure =>
  data.running.pace.points.length > 0 || data.running.power.points.length === 0
    ? 'pace'
    : 'power';
