import { describe, expect, it } from 'vitest';

import {
  athleteProfile,
  fitCriticalModel,
  isReliableModel,
  missingModelEfforts,
  modelValueAt,
  profilePosition,
  racePredictions,
  reserveBalance,
  trainingFocusOf,
} from './performance-model';

const line = (
  critical: number,
  reserve: number,
  durations = [120, 300, 600, 1200],
) =>
  durations.map((duration) => ({
    duration,
    value: critical + reserve / duration,
  }));

describe('fitCriticalModel', () => {
  it('finds the line the bests lie on', () => {
    const model = fitCriticalModel(line(300, 18000));
    expect(model?.critical).toBeCloseTo(300, 6);
    expect(model?.reserve).toBeCloseTo(18000, 3);
    expect(modelValueAt(model!, 600)).toBeCloseTo(330, 6);
  });

  it('keeps the best of each duration and ignores the others', () => {
    const model = fitCriticalModel([
      ...line(4, 240),
      { duration: 300, value: 3 },
      { duration: 3600, value: 9 },
    ]);
    expect(model?.critical).toBeCloseTo(4, 6);
  });

  it('needs a best on each side of the range', () => {
    expect(fitCriticalModel(line(300, 18000, [600, 1200]))).toBeNull();
    expect(missingModelEfforts(line(300, 18000, [600, 1200]))).toEqual([
      'SHORT',
    ]);
    expect(missingModelEfforts(line(300, 18000, [120]))).toEqual(['LONG']);
    expect(missingModelEfforts([])).toEqual(['SHORT', 'LONG']);
  });

  it('gives no model when the long effort beats the short one', () => {
    expect(
      fitCriticalModel([
        { duration: 300, value: 280 },
        { duration: 1200, value: 300 },
      ]),
    ).toBeNull();
  });
});

describe('profile and focus', () => {
  const model = (seconds: number) => ({
    critical: 300,
    reserve: 300 * seconds,
  });

  it('places the athlete by the seconds the reserve lasts', () => {
    expect(athleteProfile(model(30))).toBe('ENDURANCE');
    expect(athleteProfile(model(55))).toBe('HYBRID');
    expect(athleteProfile(model(90))).toBe('SPEED');
    expect(profilePosition(model(100))).toBe(0);
    expect(profilePosition(model(15))).toBe(1);
  });

  it('doubts a reserve too small to be an all-out effort', () => {
    expect(isReliableModel(model(5))).toBe(false);
    expect(isReliableModel(model(20))).toBe(true);
  });

  it('trains the short side, and endurance first when heart rate drifts', () => {
    expect(trainingFocusOf(model(90), 3)).toBe('THRESHOLD');
    expect(trainingFocusOf(model(30), null)).toBe('SHORT_INTERVALS');
    expect(trainingFocusOf(model(55), 5)).toBe('BALANCED');
    expect(trainingFocusOf(model(90), 5.1)).toBe('LONG_RUNS');
  });
});

describe('racePredictions', () => {
  it('reads 5 km from the model and the rest by Riegel', () => {
    const [five, ten, , marathon] = racePredictions({
      critical: 4,
      reserve: 240,
    });
    expect(five.seconds).toBeCloseTo(1190, 6);
    expect(ten.seconds).toBeCloseTo(1190 * 2 ** 1.06, 6);
    expect(marathon.distance).toBe(42195);
  });

  it('starts from the 20 minutes when 5 km takes longer', () => {
    const [five] = racePredictions({ critical: 3, reserve: 150 });
    // 20 minutes cover 3750 m
    expect(five.seconds).toBeCloseTo(1200 * (5000 / 3750) ** 1.06, 6);
  });
});

describe('reserveBalance', () => {
  const model = { critical: 300, reserve: 18000 };
  const time = Array.from({ length: 241 }, (_, i) => i);

  it('empties above the critical value, by the work done over it', () => {
    const balance = reserveBalance(
      time,
      time.map(() => 400),
      model,
    );
    expect(balance[0]).toBe(1);
    // 100 W over for 90 s is half the reserve; all of it after 180 s
    expect(balance[90]).toBeCloseTo(0.5, 6);
    expect(balance[180]).toBe(0);
    expect(balance[240]).toBe(0);
  });

  it('recovers below it, the slower the fuller it is', () => {
    const watts = time.map((t) => (t < 90 ? 400 : 100));
    const balance = reserveBalance(time, watts, model);
    const first = balance[100] - balance[90];
    const later = balance[240] - balance[230];
    expect(first).toBeGreaterThan(later);
    expect(balance[240]).toBeGreaterThan(0.5);
    expect(balance[240]).toBeLessThan(1);
  });

  it('stays full below the critical value, and rests over a pause', () => {
    expect(
      reserveBalance(
        time,
        time.map(() => 250),
        model,
      ).every((b) => b === 1),
    ).toBe(true);
    // 400 W written before a 10-minute pause: not held through it
    expect(
      reserveBalance([0, 1, 601, 602], [400, 400, 400, 400], model)[2],
    ).toBeGreaterThan(0.99);
  });
});
