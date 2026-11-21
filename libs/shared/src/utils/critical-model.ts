import type { BestRecordDto } from '../types/dtos/core/records.dto';
import { RECORD_TYPE } from '../types/misc/core/record-type.enum';
import { SPORT_TYPE } from '../types/misc/core/sport-type.enum';
import {
  type CriticalModel,
  criticalPowerEfforts,
  criticalSpeedEfforts,
  fitCriticalPower,
  fitCriticalSpeed,
  isReliableSpeedModel,
} from './performance-model';

const RUNNING = new Set([SPORT_TYPE.RUNNING, SPORT_TYPE.TRAIL_RUNNING]);
const CYCLING = new Set([
  SPORT_TYPE.CYCLING,
  SPORT_TYPE.GRAVEL_RIDE,
  SPORT_TYPE.MOUNTAIN_BIKE_RIDE,
]);

export interface CriticalFit extends CriticalModel {
  kind: 'speed' | 'power';
  /** The bests it was read from: metres for speed, seconds for power */
  efforts: { distance: number | null; seconds: number }[];
}

/**
 * Critical speed or power from an athlete's best efforts, by the models of
 * performance-model.ts: speed from the fastest grade-adjusted 400 m, 800 m
 * and 5 km, which carries it to trails, and power from the bests of 2 to 20
 * minutes. Only running and cycling, the sports they were tested in with
 * this kind of data. Null without the efforts, or when the short ones were
 * not all out.
 */
export function criticalFit(
  records: BestRecordDto[],
  sport: SPORT_TYPE,
): CriticalFit | null {
  if (RUNNING.has(sport)) {
    const efforts = records.flatMap((record) =>
      record.type === RECORD_TYPE.GAP_SPEED && record.distance
        ? [{ distance: record.distance, value: record.value }]
        : [],
    );
    const model = fitCriticalSpeed(efforts);
    if (!model || !isReliableSpeedModel(model)) return null;
    return {
      kind: 'speed',
      ...model,
      efforts: criticalSpeedEfforts(efforts).map(({ distance, value }) => ({
        distance,
        seconds: value,
      })),
    };
  }
  if (!CYCLING.has(sport)) return null;
  const efforts = records.flatMap((record) =>
    record.type === RECORD_TYPE.POWER && record.duration
      ? [{ duration: record.duration, value: record.value }]
      : [],
  );
  const model = fitCriticalPower(efforts);
  return (
    model && {
      kind: 'power',
      ...model,
      efforts: criticalPowerEfforts(efforts).map(({ duration }) => ({
        distance: null,
        seconds: duration,
      })),
    }
  );
}

/**
 * Critical swim speed from a 200 m and a 400 m swum flat out, in m/s. Needs a
 * real test: the distance-time line says nothing on easy swims.
 */
export function criticalSwimSpeed(
  seconds200: number,
  seconds400: number,
): number | null {
  if (seconds200 <= 0 || seconds400 <= seconds200) return null;
  return 200 / (seconds400 - seconds200);
}

/** "3:05", or a number of seconds */
export function parseSwimTime(text: string): number | null {
  const match = /^\s*(?:(\d+):)?(\d{1,3})\s*$/.exec(text);
  if (!match) return null;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2]);
  if (match[1] !== undefined && seconds >= 60) return null;
  return minutes * 60 + seconds;
}
