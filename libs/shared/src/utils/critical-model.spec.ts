import { describe, expect, it } from 'vitest';

import type { BestRecordDto } from '../types/dtos/core/records.dto';
import { RECORD_TYPE } from '../types/misc/core/record-type.enum';
import { SPORT_TYPE } from '../types/misc/core/sport-type.enum';
import {
  criticalFit,
  criticalSwimSpeed,
  parseSwimTime,
} from './critical-model';

const base = {
  recordId: 1,
  date: new Date(),
  eventId: null,
  activityName: null,
};
const run = (distance: number, seconds: number): BestRecordDto => ({
  ...base,
  type: RECORD_TYPE.GAP_SPEED,
  distance,
  duration: null,
  value: seconds,
});
const power = (duration: number, watts: number): BestRecordDto => ({
  ...base,
  type: RECORD_TYPE.POWER,
  distance: null,
  duration,
  value: watts,
});

/** Grade-adjusted bests exactly on a speed of 4 m/s with 140 m above it */
const perfect = [400, 800, 5000].map((distance) =>
  run(distance, (distance - 140) / 4),
);

describe('criticalFit', () => {
  it('finds the critical speed and its reserve', () => {
    const fit = criticalFit(perfect, SPORT_TYPE.RUNNING)!;
    expect(fit.kind).toBe('speed');
    expect(fit.critical).toBeCloseTo(4, 5);
    expect(fit.reserve).toBeCloseTo(140, 3);
    expect(fit.margin).toBeCloseTo(0, 5);
    expect(fit.efforts.map(({ distance }) => distance)).toEqual([
      400, 800, 5000,
    ]);
  });

  it('widens the interval when efforts disagree', () => {
    const fit = criticalFit(
      [run(400, 62), run(800, 180), run(5000, 1215)],
      SPORT_TYPE.RUNNING,
    )!;
    expect(fit.margin).toBeGreaterThan(0.01);
  });

  it('finds the critical power from work', () => {
    const fit = criticalFit(
      [120, 300, 600, 1200].map((t) => power(t, 250 + 20000 / t)),
      SPORT_TYPE.CYCLING,
    )!;
    expect(fit.kind).toBe('power');
    expect(fit.critical).toBeCloseTo(250, 5);
    expect(fit.reserve).toBeCloseTo(20000, 2);
  });

  it('reads the grade-adjusted bests of its three distances only', () => {
    const fit = criticalFit(
      [
        ...perfect,
        run(1000, 100),
        { ...run(400, 30), type: RECORD_TYPE.SPEED },
      ],
      SPORT_TYPE.RUNNING,
    )!;
    expect(fit.efforts).toHaveLength(3);
    expect(fit.critical).toBeCloseTo(4, 5);
  });

  it('needs three efforts', () => {
    expect(criticalFit(perfect.slice(1), SPORT_TYPE.RUNNING)).toBeNull();
  });

  it('gives nothing when the short bests were not all out', () => {
    const easy = [400, 800, 5000].map((distance) =>
      run(distance, (distance - 30) / 4),
    );
    expect(criticalFit(easy, SPORT_TYPE.RUNNING)).toBeNull();
  });

  it('holds on trails, and stays out of the sports it was not tested in', () => {
    expect(
      criticalFit(perfect, SPORT_TYPE.TRAIL_RUNNING)?.critical,
    ).toBeCloseTo(4, 5);
    expect(criticalFit(perfect, SPORT_TYPE.SWIMMING)).toBeNull();
  });
});

describe('criticalSwimSpeed', () => {
  it('reads the slope between the two distances', () => {
    expect(criticalSwimSpeed(180, 380)).toBe(1);
  });

  it('refuses times that cannot be a test', () => {
    expect(criticalSwimSpeed(380, 180)).toBeNull();
    expect(criticalSwimSpeed(0, 180)).toBeNull();
  });
});

describe('parseSwimTime', () => {
  it('reads minutes and seconds, or seconds', () => {
    expect(parseSwimTime('3:05')).toBe(185);
    expect(parseSwimTime('185')).toBe(185);
  });

  it('refuses anything else', () => {
    expect(parseSwimTime('3:75')).toBeNull();
    expect(parseSwimTime('fast')).toBeNull();
    expect(parseSwimTime('')).toBeNull();
  });
});
